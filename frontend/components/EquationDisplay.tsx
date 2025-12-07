"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import katex from "katex";

interface EquationFormatted {
  original: string;
  simplified: string;
  latex: string;
  success: boolean;
}

interface EquationDisplayProps {
  equation: string;
  equationFormatted?: EquationFormatted;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EquationDisplay({ 
  equation, 
  equationFormatted,
  className,
  size = "md"
}: EquationDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const katexRef = useRef<HTMLDivElement>(null);

  // Render LaTeX using KaTeX
  useEffect(() => {
    if (katexRef.current && equationFormatted?.success && equationFormatted?.latex) {
      try {
        katex.render(equationFormatted.latex, katexRef.current, {
          throwOnError: false,
          displayMode: true,
          output: "html",
        });
      } catch (e) {
        console.warn("KaTeX render error:", e);
        // Fallback to text
        if (katexRef.current) {
          katexRef.current.textContent = equationFormatted.simplified || equation;
        }
      }
    }
  }, [equationFormatted, equation]);

  const handleCopy = async () => {
    // Copy the simplified version if available, otherwise original
    const textToCopy = equationFormatted?.simplified || equation;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  // If we have formatted equation with LaTeX, use KaTeX
  if (equationFormatted?.success && equationFormatted?.latex) {
    return (
      <div className={cn("relative group", className)}>
        {/* LaTeX rendered equation */}
        <div 
          ref={katexRef}
          className={cn(
            "text-center py-3 text-text-primary overflow-x-auto",
            sizeClasses[size]
          )}
        />

        {/* Toggle to show original */}
        {showOriginal && (
          <div className="mt-2 p-2 bg-surface rounded-lg">
            <p className="text-caption text-text-muted mb-1">Original (DEAP):</p>
            <code className="text-xs font-mono text-text-secondary break-all">
              {equation}
            </code>
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="p-1.5 rounded-md bg-surface hover:bg-surface-raised text-xs text-text-muted"
            title="Toggle original"
          >
            {showOriginal ? "Hide" : "Raw"}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md bg-surface hover:bg-surface-raised"
            title="Copy equation"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Fallback: basic text display
  return (
    <div className={cn("relative group", className)}>
      <div className={cn(
        "font-mono text-center py-3 text-text-secondary overflow-x-auto",
        sizeClasses[size]
      )}>
        {formatBasic(equation)}
      </div>

      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-surface hover:bg-surface-raised opacity-0 group-hover:opacity-100 transition-all"
        title="Copy equation"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-text-muted" />
        )}
      </button>
    </div>
  );
}

/**
 * Basic formatting for equations without LaTeX (fallback).
 */
function formatBasic(eq: string): string {
  return eq
    .replace(/protected_div/g, "÷")
    .replace(/protected_sqrt/g, "√")
    .replace(/protected_log/g, "ln")
    .replace(/protected_/g, "")
    .replace(/safe_/g, "")
    .replace(/add\(/g, "(")
    .replace(/sub\(/g, "(")
    .replace(/mul\(/g, "(")
    .replace(/div\(/g, "(")
    .replace(/\*/g, "×")
    .replace(/\//g, "÷");
}

/**
 * Compact equation display for lists (Hall of Fame).
 */
export function EquationCompact({ 
  equation, 
  equationFormatted,
  className 
}: { 
  equation: string; 
  equationFormatted?: EquationFormatted;
  className?: string;
}) {
  const katexRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (katexRef.current && equationFormatted?.success && equationFormatted?.latex) {
      try {
        katex.render(equationFormatted.latex, katexRef.current, {
          throwOnError: false,
          displayMode: false,
          output: "html",
        });
      } catch (e) {
        if (katexRef.current) {
          katexRef.current.textContent = equationFormatted.simplified || equation;
        }
      }
    }
  }, [equationFormatted, equation]);

  if (equationFormatted?.success && equationFormatted?.latex) {
    return (
      <span 
        ref={katexRef} 
        className={cn("text-text-secondary", className)}
      />
    );
  }

  return (
    <code className={cn("text-sm text-text-secondary font-mono", className)}>
      {equationFormatted?.simplified || formatBasic(equation)}
    </code>
  );
}
