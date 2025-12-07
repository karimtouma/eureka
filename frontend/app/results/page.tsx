"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Area,
  AreaChart,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts";
import Link from "next/link";
import { Play, Square, Trophy, Dna, Target, Database, Clock, Zap, AlertTriangle, Scale, Sparkles, TrendingUp } from "lucide-react";
import { useAppStore, Candidate, GenerationStats, selectIsReady } from "@/lib/store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EquationDisplay, EquationCompact } from "@/components/EquationDisplay";
import { PageTransition, SlideUp, PulseIndicator, motion, AnimatePresence } from "@/components/motion";

interface EquationFormatted {
  original: string;
  simplified: string;
  latex: string;
  success: boolean;
}

interface ExtendedCandidate extends Candidate {
  train_r_squared?: number;
  test_r_squared?: number;
  train_mse?: number;
  test_mse?: number;
  aic?: number;
  bic?: number;
  parsimony_score?: number;
  overfit_gap?: number;
  // Formatted equation from backend
  equation_formatted?: EquationFormatted;
  // Prediction data for fit visualization
  train_predictions?: number[];
  train_x?: number[];
  train_y?: number[];
  test_predictions?: number[];
  test_x?: number[];
  test_y?: number[];
}

interface ExtendedStats extends GenerationStats {
  train_r_squared?: number;
  test_r_squared?: number;
  overfit_gap?: number;
  avg_complexity?: number;
  aic?: number;
  bic?: number;
  parsimony_score?: number;
  generations_per_second?: number;
}

export default function ResultsPage() {
  const evolution = useAppStore((s) => s.evolution);
  const evolutionParams = useAppStore((s) => s.evolutionParams);
  const columnConfig = useAppStore((s) => s.columnConfig);
  const updateEvolution = useAppStore((s) => s.updateEvolution);
  const setEvolutionStatus = useAppStore((s) => s.setEvolutionStatus);
  const addGenerationStats = useAppStore((s) => s.addGenerationStats);
  const isReady = useAppStore(selectIsReady);

  const [selectedCandidate, setSelectedCandidate] = useState<ExtendedCandidate | null>(null);
  const [selectedFitIndex, setSelectedFitIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  // Keep selectedFitIndex within valid range
  useEffect(() => {
    const maxIndex = Math.max(0, evolution.hallOfFame.length - 1);
    if (selectedFitIndex > maxIndex) {
      setSelectedFitIndex(Math.min(selectedFitIndex, maxIndex));
    }
  }, [evolution.hallOfFame.length, selectedFitIndex]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [genPerSec, setGenPerSec] = useState(0);
  const [currentStats, setCurrentStats] = useState<ExtendedStats | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (evolution.status !== "running") return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [evolution.status]);

  useEffect(() => {
    if (!evolution.sessionId || evolution.status !== "running") return;
    if (evolution.sessionId.startsWith("demo-")) {
      simulateEvolution();
      return;
    }

    const ws = api.createEvolutionWebSocket(evolution.sessionId, {
      onMessage: handleWebSocketMessage,
      onOpen: () => {
        console.log("WebSocket connected");
        ws?.send(JSON.stringify({ type: "start" }));
      },
      onClose: () => {
        console.log("WebSocket closed");
        if (evolution.status === "running") {
          pollStatus();
        }
      },
    });

    wsRef.current = ws;

    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [evolution.sessionId, evolution.status]);

  const handleWebSocketMessage = useCallback((message: unknown) => {
    const msg = message as {
      type: string;
      generation?: number;
      elapsed_time?: number;
      stats?: ExtendedStats;
      hall_of_fame?: ExtendedCandidate[];
      pareto_front?: ExtendedCandidate[];
      best?: ExtendedCandidate;
    };

    console.log("WS message:", msg.type, msg.generation);

    switch (msg.type) {
      case "generation_update":
        if (msg.elapsed_time) setElapsedTime(msg.elapsed_time);
        if (msg.stats?.generations_per_second) setGenPerSec(msg.stats.generations_per_second);
        if (msg.stats) setCurrentStats(msg.stats);

        updateEvolution({
          currentGeneration: msg.generation || 0,
          hallOfFame: msg.hall_of_fame || evolution.hallOfFame,
        });
        if (msg.stats) {
          addGenerationStats(msg.stats);
        }
        break;

      case "evolution_completed":
      case "evolution_stopped":
        setEvolutionStatus("completed");
        updateEvolution({
          hallOfFame: msg.hall_of_fame || evolution.hallOfFame,
          paretoFront: msg.pareto_front || [],
        });
        break;

      case "error":
        setEvolutionStatus("error");
        break;
    }
  }, [evolution, updateEvolution, addGenerationStats, setEvolutionStatus]);

  const handleStop = async () => {
    if (!evolution.sessionId) return;

    if (evolution.sessionId.startsWith("demo-")) {
      setEvolutionStatus("completed");
      return;
    }

    try {
      await api.stopEvolution(evolution.sessionId);
      setEvolutionStatus("completed");
    } catch (e) {
      console.error("Failed to stop evolution:", e);
    }
  };

  const pollStatus = async () => {
    if (!evolution.sessionId || evolution.sessionId.startsWith("demo-")) return;

    try {
      const status = await api.getEvolutionStatus(evolution.sessionId);
      updateEvolution({
        currentGeneration: status.current_generation,
      });

      if (status.status === "completed" || status.status === "stopped") {
        const results = await api.getEvolutionResults(evolution.sessionId);
        setEvolutionStatus("completed");
        updateEvolution({
          hallOfFame: results.hall_of_fame,
          paretoFront: results.pareto_front,
        });
      }
    } catch (e) {
      console.error("Failed to poll status:", e);
    }
  };

  const simulateEvolution = useCallback(async () => {
    if (isSimulating) return;
    setIsSimulating(true);

    const startTime = Date.now();
    let gen = 0;

    const runGeneration = async () => {
      const currentStatus = useAppStore.getState().evolution.status;
      if (currentStatus !== "running") {
        setIsSimulating(false);
        return;
      }

      gen++;
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);
      setGenPerSec(gen / elapsed);

      const baseFitness = 10 / (gen * 0.1 + 1);
      const trainR2 = Math.min(0.999, 0.3 + Math.log10(gen + 1) * 0.25 + Math.random() * 0.03);
      const testR2 = Math.min(trainR2, trainR2 - Math.random() * 0.02 - 0.01);
      const overfitGap = trainR2 - testR2;

      const featureNames = columnConfig?.features || ["x"];
      const equations = generateDemoEquations(featureNames, gen);
      const complexity = 3 + Math.floor(Math.random() * 8);

      const candidates: ExtendedCandidate[] = equations.map((eq, i) => ({
        equation: eq,
        fitness: baseFitness * (1 + i * 0.1),
        complexity: complexity + i * 2,
        mse: baseFitness * (1 + i * 0.1),
        r_squared: trainR2 - i * 0.02,
        train_r_squared: trainR2 - i * 0.02,
        test_r_squared: testR2 - i * 0.025,
        aic: -50 + complexity * 2 + i * 5,
        bic: -45 + complexity * 2.5 + i * 6,
        parsimony_score: testR2 - 0.01 * complexity - i * 0.03,
        overfit_gap: overfitGap + i * 0.005,
      }));

      const stats: ExtendedStats = {
        generation: gen,
        best_fitness: baseFitness,
        avg_fitness: baseFitness * 2,
        std_fitness: baseFitness * 0.5,
        best_equation: candidates[0].equation,
        best_r_squared: trainR2,
        best_complexity: complexity,
        train_r_squared: trainR2,
        test_r_squared: testR2,
        overfit_gap: overfitGap,
        avg_complexity: complexity + 2,
        aic: candidates[0].aic,
        bic: candidates[0].bic,
        parsimony_score: candidates[0].parsimony_score,
        generations_per_second: gen / elapsed,
      };

      setCurrentStats(stats);

      updateEvolution({
        currentGeneration: gen,
        hallOfFame: candidates,
      });
      addGenerationStats(stats);

      setTimeout(runGeneration, 50);
    };

    runGeneration();
  }, [columnConfig, updateEvolution, addGenerationStats, isSimulating]);

  const bestCandidate = evolution.hallOfFame[0] as ExtendedCandidate | undefined;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <PageTransition>
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
          <SlideUp>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline">Evolution Results</h1>
            <p className="text-body text-text-muted mt-1">
              {evolution.status === "running"
                ? "Evolving equations..."
                : evolution.status === "completed"
                ? "Evolution complete"
                : "Configure and start evolution"}
            </p>
          </div>
          <div className="flex items-center gap-3">
                <AnimatePresence>
            {evolution.status === "running" && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={handleStop}
                      className="btn-danger"
                    >
                <Square className="w-4 h-4" />
                Stop
                    </motion.button>
            )}
                </AnimatePresence>
            <StatusBadge status={evolution.status} />
          </div>
        </div>
          </SlideUp>

        {/* Empty State */}
          <AnimatePresence mode="wait">
        {evolution.status === "idle" && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
          <EmptyState isReady={isReady} />
              </motion.div>
        )}
          </AnimatePresence>

        {/* Running Stats */}
          <AnimatePresence>
        {evolution.status === "running" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
          <RunningStatsCard
            generation={evolution.currentGeneration}
            elapsedTime={elapsedTime}
            genPerSec={genPerSec}
            stats={currentStats}
            formatTime={formatTime}
          />
              </motion.div>
        )}
          </AnimatePresence>

        {/* Best Candidate */}
          <AnimatePresence>
        {bestCandidate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
          <BestCandidateCard candidate={bestCandidate} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fit Visualization - Model vs Data */}
          <AnimatePresence>
            {evolution.hallOfFame.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <FitChart 
                  candidate={(evolution.hallOfFame[Math.min(selectedFitIndex, evolution.hallOfFame.length - 1)] as ExtendedCandidate) || bestCandidate!}
                  hallOfFame={evolution.hallOfFame as ExtendedCandidate[]}
                  selectedIndex={Math.min(selectedFitIndex, evolution.hallOfFame.length - 1)}
                  onSelectIndex={setSelectedFitIndex}
                />
              </motion.div>
        )}
          </AnimatePresence>

        {/* Charts */}
          <AnimatePresence>
        {evolution.generationStats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid lg:grid-cols-2 gap-4"
              >
            <TrainTestChart data={evolution.generationStats as ExtendedStats[]} />
            <ParetoChart
              data={evolution.hallOfFame as ExtendedCandidate[]}
              onSelect={setSelectedCandidate}
              selected={selectedCandidate}
            />
              </motion.div>
        )}
          </AnimatePresence>

        {/* Hall of Fame */}
          <AnimatePresence>
        {evolution.hallOfFame.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
          <HallOfFameList
            candidates={evolution.hallOfFame as ExtendedCandidate[]}
            selected={selectedCandidate}
            onSelect={setSelectedCandidate}
            selectedForFit={selectedFitIndex}
            onSelectForFit={setSelectedFitIndex}
          />
              </motion.div>
        )}
          </AnimatePresence>
      </div>
    </div>
    </PageTransition>
  );
}

function generateDemoEquations(features: string[], gen: number): string[] {
  const x = features[0] || "x";
  const complexity = Math.min(gen / 10, 5);

  const templates = [
    () => `mul(${x}, ${x})`,
    () => `add(mul(${x}, ${x}), ${(Math.random() * 2 - 1).toFixed(2)})`,
    () => `mul(${x}, add(${x}, ${(Math.random() * 3).toFixed(2)}))`,
    () => `add(mul(${x}, ${x}), mul(${(Math.random() * 2).toFixed(2)}, ${x}))`,
    () => `div(mul(${x}, ${x}), add(1, ${(Math.random()).toFixed(2)}))`,
  ];

  const idx = Math.min(Math.floor(complexity), templates.length - 1);
  return [
    templates[idx](),
    templates[Math.max(0, idx - 1)](),
    templates[Math.max(0, idx - 2)](),
  ];
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    idle: { className: "badge", icon: null },
    running: { className: "badge-success", icon: <PulseIndicator color="#40c057" size={6} /> },
    completed: { className: "badge-accent", icon: <Trophy className="w-3 h-3" /> },
    stopped: { className: "badge-warning", icon: <Square className="w-3 h-3" /> },
    error: { className: "badge-error", icon: null },
  };

  const c = config[status as keyof typeof config] || config.idle;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("badge", c.className)}
    >
      {c.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </motion.div>
  );
}

function EmptyState({ isReady }: { isReady: boolean }) {
  return (
    <motion.div 
      className="text-center py-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center mb-5"
        animate={{ 
          borderColor: ["var(--border)", "var(--accent)", "var(--border)"],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Dna className="w-7 h-7 text-text-muted" />
      </motion.div>
      <h2 className="text-headline mb-2">No evolution running</h2>
      <p className="text-body text-text-muted mb-6 max-w-md mx-auto">
        {isReady
          ? "Your data is ready. Go to the Functions page to configure parameters and start evolving equations."
          : "Start by loading your dataset. Then configure the evolution parameters to begin discovering equations."}
      </p>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
      <Link
        href={isReady ? "/functions" : "/data"}
        className="btn-primary"
      >
        {isReady ? <Play className="w-4 h-4" /> : <Database className="w-4 h-4" />}
        {isReady ? "Configure Evolution" : "Load Data"}
      </Link>
      </motion.div>
    </motion.div>
  );
}

function RunningStatsCard({
  generation,
  elapsedTime,
  genPerSec,
  stats,
  formatTime,
}: {
  generation: number;
  elapsedTime: number;
  genPerSec: number;
  stats: ExtendedStats | null;
  formatTime: (s: number) => string;
}) {
  const trainR2 = stats?.train_r_squared ?? 0;
  const testR2 = stats?.test_r_squared ?? 0;
  const overfitGap = stats?.overfit_gap ?? 0;
  const isOverfitting = overfitGap > 0.05;

  return (
    <motion.div 
      className="card p-5 space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Main stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatItem
          icon={<Dna className="w-4 h-4 text-accent" />}
          label="Generation"
          value={generation.toLocaleString()}
          animate
        />
        <StatItem
          icon={<Clock className="w-4 h-4 text-warning" />}
          label="Elapsed"
          value={formatTime(elapsedTime)}
        />
        <StatItem
          icon={<Zap className="w-4 h-4 text-success" />}
          label="Speed"
          value={`${genPerSec.toFixed(0)} gen/s`}
        />
        <StatItem
          icon={<Scale className="w-4 h-4 text-text-muted" />}
          label="Avg Complexity"
          value={(stats?.avg_complexity ?? 0).toFixed(1)}
        />
      </div>

      {/* Train/Test comparison */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-surface rounded-xl border border-border">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-caption text-text-muted mb-1">Train R²</div>
          <div className="text-2xl font-mono text-success metric-value">{(trainR2 * 100).toFixed(2)}%</div>
        </motion.div>
        <motion.div 
          className="text-center border-x border-border"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-caption text-text-muted mb-1">Test R²</div>
          <div className="text-2xl font-mono text-accent metric-value">{(testR2 * 100).toFixed(2)}%</div>
        </motion.div>
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-caption text-text-muted mb-1 flex items-center justify-center gap-1.5">
            Overfit Gap
            {isOverfitting && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <AlertTriangle className="w-3 h-3 text-warning" />
              </motion.span>
            )}
          </div>
          <div className={cn("text-2xl font-mono metric-value", isOverfitting ? "text-warning" : "text-text-muted")}>
            {(overfitGap * 100).toFixed(2)}%
          </div>
        </motion.div>
        </div>
    </motion.div>
  );
}

function StatItem({ 
  icon, 
  label, 
  value, 
  animate = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  animate?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-caption text-text-muted">{label}</div>
        <motion.div 
          className="text-xl font-mono font-medium text-text-primary metric-value"
          key={animate ? value : undefined}
          initial={animate ? { opacity: 0.5 } : false}
          animate={animate ? { opacity: 1 } : false}
        >
          {value}
        </motion.div>
      </div>
    </div>
  );
}

function BestCandidateCard({ candidate }: { candidate: ExtendedCandidate }) {
  const trainR2 = candidate.train_r_squared ?? candidate.r_squared;
  const testR2 = candidate.test_r_squared ?? candidate.r_squared;
  const overfitGap = candidate.overfit_gap ?? 0;
  const isOverfitting = overfitGap > 0.05;

  return (
    <motion.div 
      className="card p-6 space-y-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h2 className="text-title flex items-center gap-2">
              Best Equation
              <Sparkles className="w-4 h-4 text-warning" />
            </h2>
            <p className="text-caption text-text-muted">
              Test R² = <span className="text-accent font-mono">{(testR2 * 100).toFixed(2)}%</span>
              {isOverfitting && (
                <span className="ml-2 text-warning">• Possible overfitting</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <motion.div 
        className="equation-box"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <EquationDisplay 
          equation={candidate.equation} 
          equationFormatted={candidate.equation_formatted}
          size="lg"
        />
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Train R²" value={`${(trainR2 * 100).toFixed(2)}%`} color="text-success" delay={0.1} />
        <MetricCard label="Test R²" value={`${(testR2 * 100).toFixed(2)}%`} color="text-accent" delay={0.15} />
        <MetricCard label="Complexity" value={candidate.complexity.toString()} delay={0.2} />
        <MetricCard label="Parsimony" value={(candidate.parsimony_score ?? 0).toFixed(3)} delay={0.25} />
      </div>

      {/* AIC/BIC row */}
      <motion.div 
        className="grid grid-cols-2 gap-4 p-4 bg-surface rounded-xl border border-border"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-center">
          <div className="text-caption text-text-muted mb-1">AIC (lower is better)</div>
          <div className="font-mono text-lg text-text-secondary metric-value">{(candidate.aic ?? 0).toFixed(2)}</div>
        </div>
        <div className="text-center border-l border-border">
          <div className="text-caption text-text-muted mb-1">BIC (lower is better)</div>
          <div className="font-mono text-lg text-text-secondary metric-value">{(candidate.bic ?? 0).toFixed(2)}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({ 
  label, 
  value, 
  color,
  delay = 0 
}: { 
  label: string; 
  value: string; 
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div 
      className="p-4 bg-surface rounded-xl border border-border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ borderColor: "var(--border-hover)" }}
    >
      <div className="text-caption text-text-muted mb-1">{label}</div>
      <div className={cn("text-xl font-mono metric-value", color || "text-text-secondary")}>{value}</div>
    </motion.div>
  );
}

function TrainTestChart({ data }: { data: ExtendedStats[] }) {
  const chartData = data.slice(-100).map(d => ({
    generation: d.generation,
    train: (d.train_r_squared ?? d.best_r_squared ?? 0) * 100,
    test: (d.test_r_squared ?? d.best_r_squared ?? 0) * 100,
  }));

  interface TooltipPayload {
    value: number;
    dataKey: string;
    color: string;
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
    if (!active || !payload) return null;
  return (
      <div className="bg-background p-3 rounded-lg shadow-lg border border-border">
        <p className="text-caption text-text-muted mb-2 font-medium">Generation {label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm text-text-secondary">
              {entry.dataKey === "train" ? "Train" : "Test"}: 
              <span className="ml-1 font-mono text-text-primary font-medium">{entry.value.toFixed(2)}%</span>
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div 
      className="card p-5 space-y-3"
      whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
      <h3 className="text-title">Train vs Test R²</h3>
        <div className="flex items-center gap-4 text-caption">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#40c057" }} />
            Train
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#228be6" }} />
            Test
          </span>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="trainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#40c057" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#40c057" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="testGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#228be6" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#228be6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" strokeOpacity={0.8} />
            <XAxis 
              dataKey="generation" 
              stroke="#868e96" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
            />
            <YAxis 
              stroke="#868e96" 
              fontSize={11} 
              domain={[0, 100]} 
              unit="%" 
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="train" 
              stroke="#40c057" 
              strokeWidth={2} 
              fill="url(#trainGradient)" 
              name="Train" 
            />
            <Area 
              type="monotone" 
              dataKey="test" 
              stroke="#228be6" 
              strokeWidth={2} 
              fill="url(#testGradient)" 
              name="Test" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-text-muted text-center">
        Growing gap between lines indicates overfitting
      </p>
    </motion.div>
  );
}

function ParetoChart({
  data,
  onSelect,
  selected,
}: {
  data: ExtendedCandidate[];
  onSelect: (c: ExtendedCandidate) => void;
  selected: ExtendedCandidate | null;
}) {
  const chartData = data.map((c, i) => ({
    ...c,
    r_squared_pct: (c.test_r_squared ?? c.r_squared) * 100,
    isSelected: selected === c,
    index: i,
  }));

  interface ParetoTooltipPayload {
    payload: ExtendedCandidate & { r_squared_pct: number };
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: ParetoTooltipPayload[] }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
  return (
      <div className="bg-background p-3 rounded-lg shadow-lg border border-border space-y-1.5">
        <div className="flex items-center gap-2 text-caption text-text-muted font-medium">
          <Sparkles className="w-3 h-3" />
          Candidate
        </div>
        <div className="text-sm">
          <span className="text-text-muted">Test R²: </span>
          <span className="font-mono text-accent font-medium">{d.r_squared_pct.toFixed(2)}%</span>
        </div>
        <div className="text-sm">
          <span className="text-text-muted">Complexity: </span>
          <span className="font-mono text-text-primary font-medium">{d.complexity}</span>
        </div>
        <div className="text-caption text-text-muted pt-1 border-t border-border">
          Click to select
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      className="card p-5 space-y-3"
      whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
      <h3 className="text-title">Pareto Front</h3>
        <div className="flex items-center gap-1.5 text-caption text-text-muted">
          <Target className="w-3.5 h-3.5" />
          {data.length} solutions
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" strokeOpacity={0.8} />
            <XAxis 
              dataKey="complexity" 
              name="Complexity" 
              stroke="#868e96" 
              fontSize={11} 
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
              label={{ value: "Complexity", position: "insideBottom", offset: -5, fill: "#868e96", fontSize: 10 }}
            />
            <YAxis 
              dataKey="r_squared_pct" 
              name="Test R²" 
              stroke="#868e96" 
              fontSize={11} 
              unit="%" 
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
              label={{ value: "Test R²", angle: -90, position: "insideLeft", fill: "#868e96", fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter 
              data={chartData} 
              fill="#228be6"
              onClick={(d) => onSelect(d as ExtendedCandidate)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <motion.circle
                  key={`dot-${index}`}
                  r={entry.index === 0 ? 8 : 6}
                  fill={entry.index === 0 ? "#40c057" : "#228be6"}
                  stroke={entry.index === 0 ? "#2f9e44" : "#1c7ed6"}
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-text-muted text-center">
        <span style={{ color: "#40c057" }}>●</span> Best solution • Upper-left = optimal trade-off
      </p>
    </motion.div>
  );
}

function HallOfFameList({
  candidates,
  selected,
  onSelect,
  selectedForFit,
  onSelectForFit,
}: {
  candidates: ExtendedCandidate[];
  selected: ExtendedCandidate | null;
  onSelect: (c: ExtendedCandidate) => void;
  selectedForFit?: number;
  onSelectForFit?: (index: number) => void;
}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          <h3 className="text-title">Hall of Fame</h3>
        </div>
        <span className="text-caption text-text-muted">{candidates.length} candidates</span>
      </div>
      <div className="space-y-2">
        {candidates.slice(0, 5).map((candidate, i) => {
          const trainR2 = candidate.train_r_squared ?? candidate.r_squared;
          const testR2 = candidate.test_r_squared ?? candidate.r_squared;
          const overfitGap = candidate.overfit_gap ?? 0;
          const isOverfitting = overfitGap > 0.05;
          const isSelected = selected === candidate;
          const isSelectedForFit = selectedForFit === i;
          const isBest = i === 0;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(candidate)}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              className={cn(
                "p-4 rounded-xl border transition-all cursor-pointer",
                isSelectedForFit
                  ? "border-accent bg-accent-muted ring-2 ring-accent/30"
                  : isSelected
                  ? "border-accent bg-accent-muted"
                  : isBest
                  ? "border-warning/40 bg-warning/5 hover:border-warning/60"
                  : "border-border hover:border-border-hover hover:bg-surface"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-mono font-medium mt-0.5",
                    isSelectedForFit
                      ? "bg-accent/20 text-accent"
                      : isBest 
                      ? "bg-warning/20 text-warning" 
                      : "bg-surface-raised text-text-muted"
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* LaTeX formatted equation */}
                    <div className="mb-1">
                      <EquationCompact 
                        equation={candidate.equation}
                        equationFormatted={candidate.equation_formatted}
                      />
                    </div>
                    {/* Original expression (collapsed) */}
                    <code className="text-xs text-text-muted truncate block opacity-60 font-mono">
                      {candidate.equation.length > 60 
                        ? candidate.equation.substring(0, 60) + "..." 
                        : candidate.equation}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm flex-shrink-0">
                  {onSelectForFit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectForFit(i);
                      }}
                      className={cn(
                        "px-2 py-1 rounded-md text-xs font-medium transition-all",
                        isSelectedForFit
                          ? "bg-accent text-white"
                          : "bg-surface-raised text-text-muted hover:bg-accent/10 hover:text-accent"
                      )}
                    >
                      {isSelectedForFit ? "Viewing" : "View Fit"}
                    </button>
                  )}
                  <div className="flex flex-col items-end">
                    <span className="text-caption text-text-muted">Train</span>
                    <span className="text-success font-mono metric-value">{(trainR2 * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col items-end">
                    <span className="text-caption text-text-muted">Test</span>
                    <span className="text-accent font-mono metric-value">{(testR2 * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col items-end">
                    <span className="text-caption text-text-muted">Size</span>
                    <span className="font-mono metric-value text-text-secondary">{candidate.complexity}</span>
                  </div>
                  {isOverfitting && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="p-1.5 rounded-md bg-warning-muted"
                      title="Possible overfitting"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * FitChart - Visualization of model predictions vs actual data
 * 
 * Shows how well the discovered equation fits the training and test data.
 * This is crucial for understanding model quality beyond just R² metrics.
 * 
 * Features:
 * - Selectable candidates from Hall of Fame
 * - Zoom with Brush component
 * - Detailed statistics panel
 */
function FitChart({ 
  candidate, 
  hallOfFame,
  selectedIndex,
  onSelectIndex,
}: { 
  candidate: ExtendedCandidate;
  hallOfFame?: ExtendedCandidate[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
}) {
  const [zoomDomain, setZoomDomain] = useState<{ x?: [number, number]; y?: [number, number] } | null>(null);
  const [showTrain, setShowTrain] = useState(true);
  const [showTest, setShowTest] = useState(true);
  
  // Prepare data for scatter plot
  const trainData = candidate.train_x && candidate.train_y && candidate.train_predictions
    ? candidate.train_x.map((x, i) => ({
        x: x,
        actual: candidate.train_y![i],
        predicted: candidate.train_predictions![i],
        residual: Math.abs(candidate.train_y![i] - candidate.train_predictions![i]),
        type: 'train' as const,
      }))
    : [];

  const testData = candidate.test_x && candidate.test_y && candidate.test_predictions
    ? candidate.test_x.map((x, i) => ({
        x: x,
        actual: candidate.test_y![i],
        predicted: candidate.test_predictions![i],
        residual: Math.abs(candidate.test_y![i] - candidate.test_predictions![i]),
        type: 'test' as const,
      }))
    : [];

  const allData = [...trainData, ...testData].sort((a, b) => a.x - b.x);
  
  // Calculate statistics
  const trainResiduals = trainData.map(d => d.residual);
  const testResiduals = testData.map(d => d.residual);
  const allResiduals = [...trainResiduals, ...testResiduals];
  
  const stats = {
    avgResidual: allResiduals.length > 0 ? allResiduals.reduce((a, b) => a + b, 0) / allResiduals.length : 0,
    maxResidual: allResiduals.length > 0 ? Math.max(...allResiduals) : 0,
    minResidual: allResiduals.length > 0 ? Math.min(...allResiduals) : 0,
    trainMAE: trainResiduals.length > 0 ? trainResiduals.reduce((a, b) => a + b, 0) / trainResiduals.length : 0,
    testMAE: testResiduals.length > 0 ? testResiduals.reduce((a, b) => a + b, 0) / testResiduals.length : 0,
  };
  
  // If no prediction data available, show placeholder
  if (allData.length === 0) {
    return (
      <motion.div 
        className="card p-6"
        whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-title">Model Fit Visualization</h3>
            <p className="text-caption text-text-muted">Predictions vs actual data</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center text-text-muted text-sm bg-surface/50 rounded-xl border border-dashed border-border">
          <div className="text-center space-y-2">
            <TrendingUp className="w-8 h-8 mx-auto opacity-30" />
            <p>Prediction data will appear once the backend sends it...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Prepare line data for the fitted curve
  const lineData = allData.map(d => ({
    x: d.x,
    predicted: d.predicted,
  }));

  // Prepare scatter data for actual points
  const trainScatter = trainData.map(d => ({ x: d.x, y: d.actual, residual: d.residual }));
  const testScatter = testData.map(d => ({ x: d.x, y: d.actual, residual: d.residual }));

  interface FitTooltipPayload {
    payload: { x: number; actual?: number; predicted?: number; y?: number; residual?: number };
    dataKey: string;
    color: string;
    value: number;
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: FitTooltipPayload[] }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-background p-3 rounded-xl shadow-lg border border-border space-y-1.5">
        <div className="text-caption text-text-muted font-medium border-b border-border pb-1.5 mb-1.5">
          x = <span className="font-mono text-text-primary">{d.x?.toFixed(4)}</span>
        </div>
        {d.y !== undefined && (
          <div className="text-sm flex justify-between gap-4">
            <span className="text-text-muted">Actual:</span>
            <span className="font-mono text-text-primary font-medium">{d.y?.toFixed(4)}</span>
          </div>
        )}
        {d.predicted !== undefined && (
          <div className="text-sm flex justify-between gap-4">
            <span className="text-text-muted">Predicted:</span>
            <span className="font-mono text-accent font-medium">{d.predicted?.toFixed(4)}</span>
          </div>
        )}
        {d.residual !== undefined && (
          <div className="text-sm flex justify-between gap-4 pt-1 border-t border-border">
            <span className="text-text-muted">Residual:</span>
            <span className={cn(
              "font-mono font-medium",
              d.residual < stats.avgResidual ? "text-success" : "text-warning"
            )}>{d.residual?.toFixed(4)}</span>
          </div>
        )}
      </div>
    );
  };

  const trainR2 = candidate.train_r_squared ?? candidate.r_squared;
  const testR2 = candidate.test_r_squared ?? candidate.r_squared;

  // Handle brush zoom
  const handleBrushChange = (domain: { startIndex?: number; endIndex?: number } | null) => {
    if (domain && domain.startIndex !== undefined && domain.endIndex !== undefined) {
      const startX = allData[domain.startIndex]?.x;
      const endX = allData[domain.endIndex]?.x;
      if (startX !== undefined && endX !== undefined) {
        setZoomDomain({ x: [startX, endX] });
      }
    }
  };

  const resetZoom = () => setZoomDomain(null);

  return (
    <motion.div 
      className="card p-6 space-y-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.2 }}
    >
      {/* Header with candidate selector */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-title">Model Fit Visualization</h3>
            <p className="text-caption text-text-muted">
              {candidate.equation_formatted?.success 
                ? <EquationCompact equation={candidate.equation} equationFormatted={candidate.equation_formatted} />
                : `Complexity: ${candidate.complexity} nodes`
              }
            </p>
          </div>
        </div>
        
        {/* Candidate selector tabs */}
        {hallOfFame && hallOfFame.length > 1 && onSelectIndex && (
          <div className="flex items-center gap-1 p-1 bg-surface rounded-lg border border-border">
            {hallOfFame.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={cn(
                  "w-8 h-8 rounded-md text-sm font-mono font-medium transition-all",
                  selectedIndex === i
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTrain(!showTrain)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              showTrain ? "bg-success/10 text-success" : "bg-surface text-text-muted"
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: showTrain ? "#40c057" : "#adb5bd" }} />
            Train ({trainData.length})
          </button>
          <button
            onClick={() => setShowTest(!showTest)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              showTest ? "bg-error/10 text-error" : "bg-surface text-text-muted"
            )}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: showTest ? "#fa5252" : "#adb5bd" }} />
            Test ({testData.length})
          </button>
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted">
            <span className="w-4 h-0.5 rounded bg-accent" />
            Prediction
          </span>
        </div>
        
        {zoomDomain && (
          <button
            onClick={resetZoom}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface hover:bg-surface-raised text-text-muted transition-all"
          >
            Reset Zoom
          </button>
        )}
      </div>
      
      {/* Main chart - increased height */}
      <div className="h-96 bg-surface/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" strokeOpacity={0.8} />
            <XAxis 
              dataKey="x" 
              type="number"
              stroke="#868e96" 
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
              domain={zoomDomain?.x || ['auto', 'auto']}
              label={{ value: "x (input)", position: "bottom", offset: 20, fill: "#868e96", fontSize: 11 }}
            />
            <YAxis 
              stroke="#868e96" 
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#dee2e6" }}
              domain={zoomDomain?.y || ['auto', 'auto']}
              label={{ value: "y (output)", angle: -90, position: "insideLeft", offset: 0, fill: "#868e96", fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Fitted line (predictions) */}
            <Scatter 
              data={lineData} 
              dataKey="predicted"
              fill="none"
              line={{ stroke: "#228be6", strokeWidth: 2.5 }}
              lineType="joint"
              name="Prediction"
            />
            
            {/* Train points */}
            {showTrain && (
              <Scatter 
                data={trainScatter} 
                dataKey="y"
                fill="#40c057"
                name="Train"
              >
                {trainScatter.map((_, index) => (
                  <circle
                    key={`train-${index}`}
                    r={5}
                    fill="#40c057"
                    stroke="#2f9e44"
                    strokeWidth={1.5}
                    opacity={0.85}
                  />
                ))}
              </Scatter>
            )}
            
            {/* Test points */}
            {showTest && (
              <Scatter 
                data={testScatter} 
                dataKey="y"
                fill="#fa5252"
                name="Test"
              >
                {testScatter.map((_, index) => (
                  <circle
                    key={`test-${index}`}
                    r={6}
                    fill="#fa5252"
                    stroke="#e03131"
                    strokeWidth={1.5}
                    opacity={0.85}
                  />
                ))}
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
      {/* Zoom hint */}
      <p className="text-center text-caption text-text-muted">
        Click and drag on the chart to zoom • Use toggle buttons to show/hide data series
      </p>

      {/* Extended statistics panel */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-border">
        <div className="p-3 bg-surface rounded-xl text-center">
          <div className="text-caption text-text-muted mb-0.5">Train R²</div>
          <div className="font-mono text-xl text-success font-medium">{(trainR2 * 100).toFixed(2)}%</div>
        </div>
        <div className="p-3 bg-surface rounded-xl text-center">
          <div className="text-caption text-text-muted mb-0.5">Test R²</div>
          <div className="font-mono text-xl text-accent font-medium">{(testR2 * 100).toFixed(2)}%</div>
        </div>
        <div className="p-3 bg-surface rounded-xl text-center">
          <div className="text-caption text-text-muted mb-0.5">Mean Abs Error</div>
          <div className="font-mono text-xl text-text-secondary font-medium">{stats.avgResidual.toFixed(4)}</div>
        </div>
        <div className="p-3 bg-surface rounded-xl text-center">
          <div className="text-caption text-text-muted mb-0.5">Max Residual</div>
          <div className="font-mono text-xl text-warning font-medium">{stats.maxResidual.toFixed(4)}</div>
        </div>
        <div className="p-3 bg-surface rounded-xl text-center">
          <div className="text-caption text-text-muted mb-0.5">Complexity</div>
          <div className="font-mono text-xl text-text-secondary font-medium">{candidate.complexity}</div>
        </div>
      </div>
    </motion.div>
  );
}
