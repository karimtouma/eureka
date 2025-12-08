/**
 * API Client for Eureka Backend
 * Handles all HTTP and WebSocket communication with the FastAPI server
 */

// ============================================
// Types
// ============================================

export interface DatasetInfo {
  columns: string[];
  rows: number;
  preview: Record<string, unknown>[];
}

export interface EvolutionConfig {
  features: string[];
  target: string;
  operators: string[];
  functions: string[];
  population_size: number;
  generations: number;
  mutation_prob: number;
  crossover_prob: number;
  tournament_size: number;
  max_depth: number;
  parsimony_coefficient: number;
}

export interface Operator {
  id: string;
  symbol: string;
  name: string;
  arity: number;
}

export interface AvailableOperators {
  operators: Operator[];
  functions: Operator[];
  terminals: Array<{ id: string; name: string; description: string }>;
}

export interface EvolutionStatus {
  session_id: string;
  status: string;
  current_generation: number;
  total_generations: number;
  best_fitness: number | null;
  best_equation: string | null;
}

export interface Candidate {
  equation: string;
  fitness: number;
  complexity: number;
  mse: number;
  r_squared: number;
}

export interface EvolutionResults {
  session_id: string;
  status: string;
  hall_of_fame: Candidate[];
  pareto_front: Candidate[];
  best_equation: string | null;
  best_fitness: number | null;
}

// ============================================
// API Error
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============================================
// Configuration
// ============================================

const getApiUrl = () => {
  // In production, API is served via nginx at /eureka/api
  if (process.env.NODE_ENV === "production") {
    if (typeof window === "undefined") return "http://eureka-backend:8000";
    return "/eureka/api";
  }
  // Development: direct to backend
  if (typeof window === "undefined") return "http://localhost:8000";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

const getWsUrl = () => {
  // In production, WebSocket via nginx at /eureka/ws
  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/eureka/ws`;
  }
  // Development
  if (typeof window === "undefined") return "ws://localhost:8000";
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
};

// ============================================
// API Client
// ============================================

class ApiClient {
  private baseUrl: string;
  private wsUrl: string;
  private _isBackendAvailable: boolean = true;

  constructor() {
    this.baseUrl = getApiUrl();
    this.wsUrl = getWsUrl();
  }

  /**
   * Check if backend is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      this._isBackendAvailable = response.ok;
      return this._isBackendAvailable;
    } catch {
      this._isBackendAvailable = false;
      return false;
    }
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.detail || `HTTP error ${response.status}`,
          response.status
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;

      this._isBackendAvailable = false;
      throw new ApiError(
        "Backend not available. Using offline mode.",
        0,
        "NETWORK_ERROR"
      );
    }
  }

  // ============================================
  // Data Endpoints
  // ============================================

  async uploadCsv(file: File): Promise<DatasetInfo> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/data/upload/csv`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(error.detail || "Failed to upload CSV");
    }

    return response.json();
  }

  async uploadJson(
    data: Record<string, unknown>[],
    columns: string[]
  ): Promise<DatasetInfo> {
    return this.fetch<DatasetInfo>("/api/data/upload/json", {
      method: "POST",
      body: JSON.stringify({ data, columns }),
    });
  }

  async getCurrentDataset(): Promise<{
    data: Record<string, unknown>[];
    columns: string[];
    rows: number;
  }> {
    return this.fetch("/api/data/current");
  }

  async configureColumns(features: string[], target: string): Promise<void> {
    await this.fetch("/api/data/configure", {
      method: "POST",
      body: JSON.stringify({ features, target }),
    });
  }

  async clearDataset(): Promise<void> {
    await this.fetch("/api/data/clear", { method: "DELETE" });
  }

  // ============================================
  // Evolution Endpoints
  // ============================================

  async getAvailableOperators(): Promise<AvailableOperators> {
    if (!this._isBackendAvailable) {
      return getDefaultOperators();
    }

    try {
      return await this.fetch("/api/evolution/operators");
    } catch {
      return getDefaultOperators();
    }
  }

  async startEvolution(
    config: EvolutionConfig
  ): Promise<{ session_id: string }> {
    return this.fetch("/api/evolution/start", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getEvolutionStatus(sessionId: string): Promise<EvolutionStatus> {
    return this.fetch(`/api/evolution/status/${sessionId}`);
  }

  async getEvolutionResults(sessionId: string): Promise<EvolutionResults> {
    return this.fetch(`/api/evolution/results/${sessionId}`);
  }

  async stopEvolution(sessionId: string): Promise<void> {
    await this.fetch(`/api/evolution/stop/${sessionId}`, { method: "POST" });
  }

  // ============================================
  // WebSocket
  // ============================================

  createEvolutionWebSocket(
    sessionId: string,
    handlers: {
      onMessage: (data: unknown) => void;
      onError?: (error: Event) => void;
      onClose?: () => void;
      onOpen?: () => void;
    }
  ): WebSocket | null {
    if (typeof window === "undefined") return null;

    try {
      const ws = new WebSocket(`${this.wsUrl}/ws/evolution/${sessionId}`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        handlers.onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handlers.onMessage(data);
        } catch (e) {
          console.warn("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (error) => {
        // WebSocket errors don't provide much info, just log it
        console.warn("WebSocket connection issue");
        handlers.onError?.(error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        handlers.onClose?.();
      };

      return ws;
    } catch (e) {
      console.error("Failed to create WebSocket:", e);
      return null;
    }
  }

  get isOnline(): boolean {
    return this._isBackendAvailable;
  }
}

// ============================================
// Default Operators
// ============================================

function getDefaultOperators(): AvailableOperators {
  return {
    operators: [
      { id: "add", symbol: "+", name: "Addition", arity: 2 },
      { id: "sub", symbol: "-", name: "Subtraction", arity: 2 },
      { id: "mul", symbol: "*", name: "Multiplication", arity: 2 },
      { id: "div", symbol: "/", name: "Protected Division", arity: 2 },
      { id: "pow", symbol: "^", name: "Power", arity: 2 },
    ],
    functions: [
      { id: "sin", symbol: "sin", name: "Sine", arity: 1 },
      { id: "cos", symbol: "cos", name: "Cosine", arity: 1 },
      { id: "tan", symbol: "tan", name: "Tangent", arity: 1 },
      { id: "sqrt", symbol: "√", name: "Square Root", arity: 1 },
      { id: "log", symbol: "log", name: "Natural Logarithm", arity: 1 },
      { id: "exp", symbol: "exp", name: "Exponential", arity: 1 },
      { id: "abs", symbol: "|x|", name: "Absolute Value", arity: 1 },
    ],
    terminals: [
      {
        id: "const",
        name: "Constants",
        description: "Numeric constants (ephemeral)",
      },
      {
        id: "var",
        name: "Variables",
        description: "Input variables from dataset",
      },
    ],
  };
}

// Singleton instance
export const api = new ApiClient();
