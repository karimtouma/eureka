/**
 * Global State Store using Zustand
 * Centralized state management for the Eureka application
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================
// Types
// ============================================

export interface DataRow {
  [key: string]: number | string;
}

export interface ColumnConfig {
  features: string[];
  target: string;
}

export interface OperatorConfig {
  operators: string[];
  functions: string[];
}

export interface EvolutionParams {
  populationSize: number;
  generations: number;
  mutationProb: number;
  crossoverProb: number;
  tournamentSize: number;
  maxDepth: number;
  parsimonyCoefficient: number;
}

export interface Candidate {
  equation: string;
  fitness: number;
  complexity: number;
  mse: number;
  r_squared: number;
}

export interface GenerationStats {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  std_fitness?: number;
  best_equation: string;
  best_r_squared: number;
  best_complexity?: number;
}

export interface EvolutionState {
  sessionId: string | null;
  status: "idle" | "running" | "completed" | "stopped" | "error";
  currentGeneration: number;
  totalGenerations: number;
  hallOfFame: Candidate[];
  paretoFront: Candidate[];
  generationStats: GenerationStats[];
  errorMessage?: string;
}

// ============================================
// Default Values
// ============================================

// SOTA-optimized defaults for bloat control and simplicity
const DEFAULT_EVOLUTION_PARAMS: EvolutionParams = {
  populationSize: 300,
  generations: 100,          // Increased for better convergence
  mutationProb: 0.2,
  crossoverProb: 0.5,
  tournamentSize: 7,         // Used by lexicographic selection
  maxDepth: 4,               // Strict limit for simple equations
  parsimonyCoefficient: 0.01, // 10x higher for simplicity pressure
};

const DEFAULT_OPERATOR_CONFIG: OperatorConfig = {
  operators: ["+", "-", "*", "/"],
  functions: ["sin", "cos", "sqrt", "log", "exp"],
};

const DEFAULT_EVOLUTION_STATE: EvolutionState = {
  sessionId: null,
  status: "idle",
  currentGeneration: 0,
  totalGenerations: 0,
  hallOfFame: [],
  paretoFront: [],
  generationStats: [],
};

// ============================================
// Store Interface
// ============================================

interface AppState {
  // Data
  data: DataRow[];
  columns: string[];
  columnConfig: ColumnConfig | null;
  datasetName: string | null;
  
  // Data actions
  setData: (data: DataRow[], columns: string[], name?: string) => void;
  setColumnConfig: (config: ColumnConfig) => void;
  updateDataCell: (rowIndex: number, column: string, value: number | string) => void;
  addDataRow: () => void;
  removeDataRow: (index: number) => void;
  addDataColumn: (name: string) => void;
  removeDataColumn: (name: string) => void;
  clearData: () => void;

  // Operators/Functions
  operatorConfig: OperatorConfig;
  setOperatorConfig: (config: OperatorConfig) => void;
  toggleOperator: (symbol: string) => void;
  toggleFunction: (name: string) => void;

  // Evolution params
  evolutionParams: EvolutionParams;
  setEvolutionParams: (params: Partial<EvolutionParams>) => void;
  resetEvolutionParams: () => void;

  // Evolution state
  evolution: EvolutionState;
  setEvolutionSessionId: (sessionId: string) => void;
  setEvolutionStatus: (status: EvolutionState["status"], errorMessage?: string) => void;
  updateEvolution: (update: Partial<EvolutionState>) => void;
  addGenerationStats: (stats: GenerationStats) => void;
  resetEvolution: () => void;
  
  // UI State
  isBackendConnected: boolean;
  setBackendConnected: (connected: boolean) => void;
}

// ============================================
// Store Implementation
// ============================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ----------------------------------------
      // Data State
      // ----------------------------------------
      data: [],
      columns: [],
      columnConfig: null,
      datasetName: null,

      setData: (data, columns, name) =>
        set({
          data,
          columns,
          datasetName: name || null,
          columnConfig: null, // Reset config when new data is loaded
        }),

      setColumnConfig: (config) => set({ columnConfig: config }),

      updateDataCell: (rowIndex, column, value) =>
        set((state) => {
          const newData = [...state.data];
          if (newData[rowIndex]) {
            newData[rowIndex] = { ...newData[rowIndex], [column]: value };
          }
          return { data: newData };
        }),

      addDataRow: () =>
        set((state) => {
          const newRow: DataRow = {};
          state.columns.forEach((col) => {
            newRow[col] = 0;
          });
          return { data: [...state.data, newRow] };
        }),

      removeDataRow: (index) =>
        set((state) => ({
          data: state.data.filter((_, i) => i !== index),
        })),

      addDataColumn: (name) =>
        set((state) => {
          const newData = state.data.map((row) => ({ ...row, [name]: 0 }));
          return {
            columns: [...state.columns, name],
            data: newData,
          };
        }),

      removeDataColumn: (name) =>
        set((state) => {
          const newColumns = state.columns.filter((c) => c !== name);
          const newData = state.data.map((row) => {
            const { [name]: _, ...rest } = row;
            return rest;
          });
          const newConfig = state.columnConfig
            ? {
                features: state.columnConfig.features.filter((f) => f !== name),
                target: state.columnConfig.target === name ? "" : state.columnConfig.target,
              }
            : null;
          return {
            columns: newColumns,
            data: newData,
            columnConfig: newConfig,
          };
        }),

      clearData: () =>
        set({
          data: [],
          columns: [],
          columnConfig: null,
          datasetName: null,
        }),

      // ----------------------------------------
      // Operator Config
      // ----------------------------------------
      operatorConfig: DEFAULT_OPERATOR_CONFIG,

      setOperatorConfig: (config) => set({ operatorConfig: config }),

      toggleOperator: (symbol) =>
        set((state) => {
          const current = state.operatorConfig.operators;
          const operators = current.includes(symbol)
            ? current.filter((o) => o !== symbol)
            : [...current, symbol];
          return {
            operatorConfig: { ...state.operatorConfig, operators },
          };
        }),

      toggleFunction: (name) =>
        set((state) => {
          const current = state.operatorConfig.functions;
          const functions = current.includes(name)
            ? current.filter((f) => f !== name)
            : [...current, name];
          return {
            operatorConfig: { ...state.operatorConfig, functions },
          };
        }),

      // ----------------------------------------
      // Evolution Params
      // ----------------------------------------
      evolutionParams: DEFAULT_EVOLUTION_PARAMS,

      setEvolutionParams: (params) =>
        set((state) => ({
          evolutionParams: { ...state.evolutionParams, ...params },
        })),

      resetEvolutionParams: () =>
        set({ evolutionParams: DEFAULT_EVOLUTION_PARAMS }),

      // ----------------------------------------
      // Evolution State
      // ----------------------------------------
      evolution: DEFAULT_EVOLUTION_STATE,

      setEvolutionSessionId: (sessionId) =>
        set((state) => ({
          evolution: { ...state.evolution, sessionId },
        })),

      setEvolutionStatus: (status, errorMessage) =>
        set((state) => ({
          evolution: { ...state.evolution, status, errorMessage },
        })),

      updateEvolution: (update) =>
        set((state) => ({
          evolution: { ...state.evolution, ...update },
        })),

      addGenerationStats: (stats) =>
        set((state) => ({
          evolution: {
            ...state.evolution,
            generationStats: [...state.evolution.generationStats, stats],
          },
        })),

      resetEvolution: () => set({ evolution: DEFAULT_EVOLUTION_STATE }),

      // ----------------------------------------
      // UI State
      // ----------------------------------------
      isBackendConnected: false,
      setBackendConnected: (connected) => set({ isBackendConnected: connected }),
    }),
    {
      name: "eureka-storage",
      partialize: (state) => ({
        // Only persist these fields
        operatorConfig: state.operatorConfig,
        evolutionParams: state.evolutionParams,
      }),
    }
  )
);

// ============================================
// Selectors (for optimized re-renders)
// ============================================

export const selectData = (state: AppState) => state.data;
export const selectColumns = (state: AppState) => state.columns;
export const selectColumnConfig = (state: AppState) => state.columnConfig;
export const selectEvolution = (state: AppState) => state.evolution;
export const selectIsReady = (state: AppState) =>
  state.data.length > 0 &&
  state.columnConfig !== null &&
  state.columnConfig.features.length > 0 &&
  state.columnConfig.target !== "";
