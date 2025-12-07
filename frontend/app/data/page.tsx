"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Check,
  AlertCircle,
  Plus,
  Minus,
  Database,
  Edit3,
  Beaker,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SAMPLE_DATASETS, SampleDataset } from "@/lib/datasets";
import Papa from "papaparse";

type ViewMode = "samples" | "upload" | "manual" | "data";

export default function DataPage() {
  const {
    data,
    columns,
    columnConfig,
    datasetName,
    setData,
    setColumnConfig,
    updateDataCell,
    addDataRow,
    removeDataRow,
    addDataColumn,
    removeDataColumn,
    clearData,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>(data.length > 0 ? "data" : "samples");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setError(null);

      try {
        if (file.name.endsWith(".csv")) {
          const text = await file.text();
          Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: async (results) => {
              const parsedData = results.data as Record<string, unknown>[];
              const parsedColumns = results.meta.fields || [];

              setData(
                parsedData.map((row) => {
                  const cleanRow: Record<string, number | string> = {};
                  parsedColumns.forEach((col) => {
                    cleanRow[col] = (row[col] as number | string) ?? 0;
                  });
                  return cleanRow;
                }),
                parsedColumns,
                file.name.replace(".csv", "")
              );
              setViewMode("data");

              try {
                await api.uploadCsv(file);
              } catch (e) {
                console.warn("Backend upload failed, using local data:", e);
              }
            },
            error: (err) => {
              setError(`Failed to parse CSV: ${err.message}`);
            },
          });
        } else {
          setError("Please upload a CSV file");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to process file");
      } finally {
        setIsUploading(false);
      }
    },
    [setData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const loadSampleDataset = (dataset: SampleDataset) => {
    setData(dataset.data, dataset.columns, dataset.name);
    setColumnConfig({
      features: dataset.suggestedFeatures,
      target: dataset.suggestedTarget,
    });
    setViewMode("data");
  };

  const createManualDataset = () => {
    const cols = ["x", "y"];
    const rows = Array.from({ length: 10 }, () => ({ x: 0, y: 0 }));
    setData(rows, cols, "Manual Entry");
    setColumnConfig({ features: ["x"], target: "y" });
    setViewMode("data");
  };

  const handleAddColumn = () => {
    if (newColumnName && !columns.includes(newColumnName)) {
      addDataColumn(newColumnName);
      setNewColumnName("");
    }
  };

  const handleColumnSelect = (column: string, type: "feature" | "target") => {
    const currentFeatures = columnConfig?.features || [];
    const currentTarget = columnConfig?.target || "";

    if (type === "target") {
      setColumnConfig({
        features: currentFeatures.filter((f) => f !== column),
        target: column,
      });
    } else {
      if (currentFeatures.includes(column)) {
        setColumnConfig({
          features: currentFeatures.filter((f) => f !== column),
          target: currentTarget,
        });
      } else {
        setColumnConfig({
          features: [...currentFeatures.filter((f) => f !== column), column],
          target: currentTarget === column ? "" : currentTarget,
        });
      }
    }
  };

  const handleClear = async () => {
    clearData();
    setViewMode("samples");
    try {
      await api.clearDataset();
    } catch {
      // Ignore backend errors
    }
  };

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline">Data</h1>
            <p className="text-body text-text-muted mt-1">
              {data.length > 0
                ? `${datasetName || "Dataset"} · ${data.length} rows × ${columns.length} columns`
                : "Load a sample dataset, upload a CSV, or enter data manually"}
            </p>
          </div>

          {data.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode("samples")} className="btn-ghost text-sm">
                Load Different
              </button>
              <button onClick={handleClear} className="btn-danger text-sm">
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          )}
        </div>

        {/* View Mode Tabs */}
        {viewMode !== "data" && (
          <div className="flex gap-1 p-1 bg-surface rounded-lg w-fit">
            <TabButton
              active={viewMode === "samples"}
              onClick={() => setViewMode("samples")}
              icon={<Beaker className="w-4 h-4" />}
            >
              Samples
            </TabButton>
            <TabButton
              active={viewMode === "upload"}
              onClick={() => setViewMode("upload")}
              icon={<Upload className="w-4 h-4" />}
            >
              Upload
            </TabButton>
            <TabButton
              active={viewMode === "manual"}
              onClick={() => setViewMode("manual")}
              icon={<Edit3 className="w-4 h-4" />}
            >
              Manual
            </TabButton>
          </div>
        )}

        {/* Sample Datasets */}
        {viewMode === "samples" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SAMPLE_DATASETS.map((dataset) => (
              <DatasetCard
                key={dataset.id}
                dataset={dataset}
                onClick={() => loadSampleDataset(dataset)}
              />
            ))}
          </div>
        )}

        {/* Upload Zone */}
        {viewMode === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative border border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
              isDragging
                ? "border-accent bg-accent-muted"
                : "border-border hover:border-border-hover"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-lg bg-surface-raised flex items-center justify-center">
                <Upload className="w-5 h-5 text-text-muted" />
              </div>
              <div>
                <p className="text-title">
                  {isUploading ? "Processing..." : "Drop your CSV file here"}
                </p>
                <p className="text-caption text-text-muted mt-1">or click to browse</p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Entry Setup */}
        {viewMode === "manual" && (
          <div className="card p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-lg bg-surface-raised flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-text-muted" />
            </div>
            <div>
              <h3 className="text-title mb-1">Manual Data Entry</h3>
              <p className="text-body text-text-muted">
                Create a new dataset and enter your data point by point
              </p>
            </div>
            <button onClick={createManualDataset} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create Dataset
            </button>
          </div>
        )}

        {/* Data View */}
        {viewMode === "data" && data.length > 0 && (
          <>
            {/* Column Configuration */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Database className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h2 className="text-title">Column Configuration</h2>
                  <p className="text-caption text-text-muted">
                    Select columns as features (X) or target (Y)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {columns.map((column) => {
                  const isFeature = columnConfig?.features.includes(column);
                  const isTarget = columnConfig?.target === column;

                  return (
                    <div
                      key={column}
                      className={cn(
                        "p-3 rounded-lg border transition-colors",
                        isTarget
                          ? "border-success bg-success-muted"
                          : isFeature
                          ? "border-accent bg-accent-muted"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm truncate text-text-secondary" title={column}>
                          {column}
                        </span>
                        {columns.length > 2 && (
                          <button
                            onClick={() => removeDataColumn(column)}
                            className="p-0.5 hover:bg-error-muted rounded text-text-muted hover:text-error transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleColumnSelect(column, "feature")}
                          className={cn(
                            "flex-1 px-2 py-1 text-xs rounded font-medium transition-colors",
                            isFeature
                              ? "bg-accent text-white"
                              : "bg-surface-raised text-text-muted hover:text-text-secondary"
                          )}
                        >
                          X
                        </button>
                        <button
                          onClick={() => handleColumnSelect(column, "target")}
                          className={cn(
                            "flex-1 px-2 py-1 text-xs rounded font-medium transition-colors",
                            isTarget
                              ? "bg-success text-white"
                              : "bg-surface-raised text-text-muted hover:text-text-secondary"
                          )}
                        >
                          Y
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Column */}
                <div className="p-3 rounded-lg border border-dashed border-border">
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                    placeholder="New column..."
                    className="w-full bg-transparent text-sm font-mono mb-2 outline-none text-text-secondary placeholder:text-text-muted"
                  />
                  <button
                    onClick={handleAddColumn}
                    disabled={!newColumnName || columns.includes(newColumnName)}
                    className="w-full px-2 py-1 text-xs rounded bg-surface-raised text-text-muted hover:text-text-secondary disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    Add
                  </button>
                </div>
              </div>

              {/* Config Summary */}
              {columnConfig && (columnConfig.features.length > 0 || columnConfig.target) && (
                <div className="flex items-center gap-4 pt-3 border-t border-border text-sm">
                  {columnConfig.features.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-accent" />
                      <span className="text-text-muted">Features:</span>
                      <span className="font-mono text-text-secondary">{columnConfig.features.join(", ")}</span>
                    </div>
                  )}
                  {columnConfig.target && (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-success" />
                      <span className="text-text-muted">Target:</span>
                      <span className="font-mono text-text-secondary">{columnConfig.target}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-text-muted" />
                  <h2 className="text-title">Data</h2>
                </div>
                <button
                  onClick={addDataRow}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-sm bg-surface-raised hover:bg-border rounded-md text-text-muted hover:text-text-secondary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-surface">
                      <th className="px-3 py-2.5 text-left text-caption font-medium text-text-muted w-12">
                        #
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className={cn(
                            "px-3 py-2.5 text-left text-caption font-medium",
                            columnConfig?.target === col && "text-success",
                            columnConfig?.features.includes(col) && "text-accent"
                          )}
                        >
                          {col}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-border/50 hover:bg-surface group"
                      >
                        <td className="px-3 py-1.5 text-caption text-text-muted font-mono">
                          {rowIndex + 1}
                        </td>
                        {columns.map((col) => (
                          <td key={col} className="px-1.5 py-1">
                            <input
                              type="number"
                              step="any"
                              value={row[col] ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateDataCell(
                                  rowIndex,
                                  col,
                                  value === "" ? 0 : parseFloat(value)
                                );
                              }}
                              className="w-full px-2 py-1 bg-transparent font-mono text-sm text-text-secondary border border-transparent hover:border-border focus:border-accent rounded outline-none transition-colors"
                            />
                          </td>
                        ))}
                        <td className="px-1.5 py-1">
                          <button
                            onClick={() => removeDataRow(rowIndex)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-error-muted rounded text-text-muted hover:text-error transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

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

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-surface-raised text-text-primary"
          : "text-text-muted hover:text-text-secondary"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function DatasetCard({
  dataset,
  onClick,
}: {
  dataset: SampleDataset;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 card-interactive text-left group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-surface-raised flex items-center justify-center text-text-muted group-hover:text-accent transition-colors">
          <Beaker className="w-4 h-4" />
        </div>
        <span className="text-caption font-mono text-text-muted">
          {dataset.data.length} pts
        </span>
      </div>
      <h3 className="text-title mb-0.5">{dataset.name}</h3>
      <p className="text-caption text-text-muted mb-2">{dataset.description}</p>
      <code className="text-caption px-2 py-0.5 rounded bg-surface-raised text-accent font-mono">
        y = {dataset.equation}
      </code>
    </button>
  );
}
