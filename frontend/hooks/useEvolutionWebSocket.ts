"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore, Candidate } from "@/lib/store";

interface EvolutionMessage {
  type: string;
  generation?: number;
  total_generations?: number;
  stats?: {
    generation: number;
    best_fitness: number;
    avg_fitness: number;
    std_fitness: number;
    best_equation: string;
    best_r_squared: number;
    best_complexity: number;
  };
  best?: Candidate;
  hall_of_fame?: Candidate[];
  pareto_front?: Candidate[];
  status?: string;
  message?: string;
}

export function useEvolutionWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const {
    evolution,
    updateEvolution,
    setEvolutionStatus,
  } = useAppStore();

  const connect = useCallback(() => {
    if (!evolution.sessionId || evolution.status !== "running") {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const ws = new WebSocket(`${wsUrl}/ws/evolution/${evolution.sessionId}`);

    ws.onopen = () => {
      setIsConnected(true);
      // Send start message
      ws.send(JSON.stringify({ type: "start" }));
    };

    ws.onmessage = (event) => {
      try {
        const message: EvolutionMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      
      // Attempt to reconnect if still running
      if (evolution.status === "running") {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      }
    };

    wsRef.current = ws;
  }, [evolution.sessionId, evolution.status]);

  const handleMessage = useCallback((message: EvolutionMessage) => {
    switch (message.type) {
      case "connected":
        console.log("Connected to evolution stream");
        break;
        
      case "generation_update":
        updateEvolution({
          currentGeneration: message.generation || 0,
          totalGenerations: message.total_generations || 0,
          hallOfFame: message.hall_of_fame || [],
          generationStats: message.stats 
            ? [...useAppStore.getState().evolution.generationStats, message.stats]
            : useAppStore.getState().evolution.generationStats,
        });
        break;
        
      case "evolution_completed":
        setEvolutionStatus("completed");
        updateEvolution({
          hallOfFame: message.hall_of_fame || [],
          paretoFront: message.pareto_front || [],
        });
        break;
        
      case "error":
        setEvolutionStatus("error");
        console.error("Evolution error:", message.message);
        break;
        
      case "heartbeat":
      case "pong":
        // Keep-alive messages, ignore
        break;
        
      default:
        console.log("Unknown message type:", message.type);
    }
  }, [updateEvolution, setEvolutionStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect when session starts
  useEffect(() => {
    if (evolution.sessionId && evolution.status === "running") {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [evolution.sessionId, evolution.status, connect, disconnect]);

  // Send ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;
    
    const pingInterval = setInterval(() => {
      sendMessage({ type: "ping" });
    }, 25000);
    
    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
  };
}

