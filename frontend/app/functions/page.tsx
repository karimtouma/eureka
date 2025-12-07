"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Minus,
  X,
  Divide,
  Superscript,
  Play,
  Settings,
  Zap,
  AlertCircle,
  Database,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useAppStore, selectIsReady } from "@/lib/store";
import { api, AvailableOperators, Operator } from "@/lib/api";
import { cn } from "@/lib/utils";

const operatorIcons: Record<string, React.ReactNode> = {
  "+": <Plus className="w-4 h-4" />,
  "-": <Minus className="w-4 h-4" />,
  "*": <X className="w-4 h-4" />,
  "/": <Divide className="w-4 h-4" />,
  "^": <Superscript className="w-4 h-4" />,
};

export default function FunctionsPage() {
  const router = useRouter();

  const data = useAppStore((s) => s.data);
  const columnConfig = useAppStore((s) => s.columnConfig);
  const operatorConfig = useAppStore((s) => s.operatorConfig);
  const evolutionParams = useAppStore((s) => s.evolutionParams);
  const toggleOperator = useAppStore((s) => s.toggleOperator);
  const toggleFunction = useAppStore((s) => s.toggleFunction);
  const setEvolutionParams = useAppStore((s) => s.setEvolutionParams);
  const setEvolutionSessionId = useAppStore((s) => s.setEvolutionSessionId);
  const setEvolutionStatus = useAppStore((s) => s.setEvolutionStatus);
  const resetEvolution = useAppStore((s) => s.resetEvolution);
  const updateEvolution = useAppStore((s) => s.updateEvolution);
  const isReady = useAppStore(selectIsReady);

  const [availableOps, setAvailableOps] = useState<AvailableOperators | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingOps, setIsLoadingOps] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const loadOperators = async () => {
      setIsLoadingOps(true);
      try {
        const ops = await api.getAvailableOperators();
        setAvailableOps(ops);
      } catch (e) {
        console.warn("Failed to load operators, using defaults:", e);
        setAvailableOps(await api.getAvailableOperators());
      } finally {
        setIsLoadingOps(false);
      }
    };
    loadOperators();
  }, []);

  const handleStartEvolution = async () => {
    if (!isReady || !columnConfig) {
      setError("Please configure your data columns first");
      return;
    }

    setIsStarting(true);
    setError(null);
    resetEvolution();

    try {
      await api.uploadJson(data, Object.keys(data[0]));
      await api.configureColumns(columnConfig.features, columnConfig.target);

      const result = await api.startEvolution({
        features: columnConfig.features,
        target: columnConfig.target,
        operators: operatorConfig.operators,
        functions: operatorConfig.functions,
        population_size: evolutionParams.populationSize,
        generations: evolutionParams.generations,
        mutation_prob: evolutionParams.mutationProb,
        crossover_prob: evolutionParams.crossoverProb,
        tournament_size: evolutionParams.tournamentSize,
        max_depth: evolutionParams.maxDepth,
        parsimony_coefficient: evolutionParams.parsimonyCoefficient,
      });

      setEvolutionSessionId(result.session_id);
      setEvolutionStatus("running");
      updateEvolution({ totalGenerations: evolutionParams.generations });
      router.push("/results");
    } catch (e) {
      console.warn("Backend not available, starting demo mode:", e);

      setEvolutionSessionId("demo-" + Date.now());
      setEvolutionStatus("running");
      updateEvolution({ totalGenerations: evolutionParams.generations });
      router.push("/results");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-headline">Functions & Parameters</h1>
          <p className="text-body text-text-muted mt-1">
            Select mathematical building blocks for equation discovery
          </p>
        </div>

        {/* Data Status */}
        {!isReady && (
          <Link
            href="/data"
            className="flex items-center gap-3 p-4 rounded-lg bg-warning-muted border border-warning/20 text-warning hover:bg-warning/15 transition-colors"
          >
            <Database className="w-4 h-4" />
            <div className="flex-1">
              <p className="text-sm font-medium">Data not configured</p>
              <p className="text-caption opacity-80">
                Click to load data and select features/target columns
              </p>
            </div>
          </Link>
        )}

        {/* Loading State */}
        {isLoadingOps ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            {/* Operators Section */}
            <OperatorSection
              title="Operators"
              description="Binary operations between values"
              icon={<Zap className="w-4 h-4 text-accent" />}
              items={availableOps?.operators || []}
              selected={operatorConfig.operators}
              onToggle={toggleOperator}
              renderIcon={(item) => operatorIcons[item.symbol] || item.symbol}
            />

            {/* Functions Section */}
            <OperatorSection
              title="Functions"
              description="Mathematical functions to apply"
              icon={<span className="text-accent font-mono text-sm">f(x)</span>}
              items={availableOps?.functions || []}
              selected={operatorConfig.functions}
              onToggle={toggleFunction}
              renderIcon={(item) => <span className="font-mono text-sm">{item.symbol}</span>}
            />

            {/* Simple Parameters */}
            <div className="card p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h2 className="text-title">Evolution Settings</h2>
                  <p className="text-caption text-text-muted">Optimized for simple, accurate equations</p>
                </div>
              </div>

              {/* Essential Parameters - Only 2 */}
              <div className="grid md:grid-cols-2 gap-5">
                <ParamSlider
                  label="Population Size"
                  value={evolutionParams.populationSize}
                  onChange={(v) => setEvolutionParams({ populationSize: v })}
                  min={100}
                  max={500}
                  step={50}
                  description="More = better exploration, slower"
                />
                <ParamSlider
                  label="Max Complexity"
                  value={evolutionParams.maxDepth}
                  onChange={(v) => setEvolutionParams({ maxDepth: v })}
                  min={2}
                  max={4}
                  step={1}
                  description="Tree depth (2=simple, 4=complex)"
                  format={(v) => {
                    const labels: Record<number, string> = {
                      2: "Simple",
                      3: "Medium",
                      4: "Complex"
                    };
                    return labels[v] || v.toString();
                  }}
                />
              </div>

              {/* Advanced Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  showAdvanced && "rotate-180"
                )} />
                Advanced settings
              </button>

              {/* Advanced Parameters - Hidden by default */}
              {showAdvanced && (
                <div className="grid md:grid-cols-2 gap-5 pt-4 border-t border-border">
                <ParamSlider
                  label="Mutation Rate"
                  value={evolutionParams.mutationProb}
                  onChange={(v) => setEvolutionParams({ mutationProb: v })}
                    min={0.1}
                    max={0.4}
                  step={0.05}
                    description="Random changes probability"
                  format={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <ParamSlider
                  label="Crossover Rate"
                  value={evolutionParams.crossoverProb}
                  onChange={(v) => setEvolutionParams({ crossoverProb: v })}
                    min={0.3}
                    max={0.8}
                  step={0.05}
                    description="Equation combining probability"
                  format={(v) => `${(v * 100).toFixed(0)}%`}
                />
                </div>
              )}

              {/* Info about SOTA optimization */}
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/10 text-sm text-text-secondary">
                <span className="text-accent font-medium">Auto-optimized:</span>{" "}
                Lexicographic selection and adaptive parsimony ensure simple, 
                generalizable equations without overfitting.
              </div>
            </div>
          </>
        )}

        {/* Start Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            {!isReady ? (
              <span className="text-warning">Configure data to continue</span>
            ) : (
              <span className="text-success">
                Ready with {data.length} data points
              </span>
            )}
          </div>

          <button
            onClick={handleStartEvolution}
            disabled={!isReady || isStarting}
            className={cn(
              "flex items-center gap-2.5 px-6 py-3 rounded-lg font-medium transition-colors",
              isReady && !isStarting
                ? "bg-text-primary hover:bg-black text-white"
                : "bg-surface-raised text-text-muted cursor-not-allowed"
            )}
          >
            {isStarting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isStarting ? "Starting..." : "Start Evolution"}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-error-muted border border-error/20 text-error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface OperatorSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: Operator[];
  selected: string[];
  onToggle: (id: string) => void;
  renderIcon: (item: Operator) => React.ReactNode;
}

function OperatorSection({
  title,
  description,
  icon,
  items,
  selected,
  onToggle,
  renderIcon,
}: OperatorSectionProps) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="text-title">{title}</h2>
          <p className="text-caption text-text-muted">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isSelected = selected.includes(item.symbol) || selected.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.symbol)}
              className={cn(
                "px-3 py-2 rounded-lg border transition-colors flex items-center gap-2",
                isSelected
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border hover:border-border-hover text-text-muted hover:text-text-secondary"
              )}
            >
              {renderIcon(item)}
              <span className="text-sm">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ParamSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  description: string;
  format?: (value: number) => string;
}

function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  description,
  format,
}: ParamSliderProps) {
  const displayValue = format ? format(value) : value.toString();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-mono text-accent">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-surface-raised rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110"
      />
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}
