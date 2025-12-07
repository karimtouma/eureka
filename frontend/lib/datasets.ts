/**
 * Sample Datasets for Eureka
 * Classic regression problems to demonstrate the system
 */

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  equation: string;  // The "true" equation (for reference)
  columns: string[];
  data: Record<string, number>[];
  suggestedFeatures: string[];
  suggestedTarget: string;
}

/**
 * Generate data points for a given function
 */
function generateData(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  points: number,
  noise: number = 0
): { x: number; y: number }[] {
  const data: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / (points - 1);
  
  for (let i = 0; i < points; i++) {
    const x = xMin + i * step;
    const y = fn(x) + (Math.random() - 0.5) * 2 * noise;
    data.push({ x: parseFloat(x.toFixed(4)), y: parseFloat(y.toFixed(4)) });
  }
  
  return data;
}

/**
 * Generate 2D data points
 */
function generateData2D(
  fn: (x1: number, x2: number) => number,
  range: { x1: [number, number]; x2: [number, number] },
  pointsPerDim: number,
  noise: number = 0
): { x1: number; x2: number; y: number }[] {
  const data: { x1: number; x2: number; y: number }[] = [];
  const step1 = (range.x1[1] - range.x1[0]) / (pointsPerDim - 1);
  const step2 = (range.x2[1] - range.x2[0]) / (pointsPerDim - 1);
  
  for (let i = 0; i < pointsPerDim; i++) {
    for (let j = 0; j < pointsPerDim; j++) {
      const x1 = range.x1[0] + i * step1;
      const x2 = range.x2[0] + j * step2;
      const y = fn(x1, x2) + (Math.random() - 0.5) * 2 * noise;
      data.push({
        x1: parseFloat(x1.toFixed(4)),
        x2: parseFloat(x2.toFixed(4)),
        y: parseFloat(y.toFixed(4)),
      });
    }
  }
  
  return data;
}

/**
 * Sample datasets
 */
export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "quadratic",
    name: "Quadratic Function",
    description: "Simple parabola: y = x²",
    equation: "x²",
    columns: ["x", "y"],
    data: generateData((x) => x * x, -5, 5, 50, 0.1),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "sine-wave",
    name: "Sine Wave",
    description: "Trigonometric function: y = sin(x)",
    equation: "sin(x)",
    columns: ["x", "y"],
    data: generateData((x) => Math.sin(x), -Math.PI * 2, Math.PI * 2, 60, 0.05),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "polynomial",
    name: "Polynomial",
    description: "Cubic polynomial: y = 0.5x³ - 2x² + x + 3",
    equation: "0.5x³ - 2x² + x + 3",
    columns: ["x", "y"],
    data: generateData(
      (x) => 0.5 * x * x * x - 2 * x * x + x + 3,
      -3, 5, 50, 0.2
    ),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "exponential",
    name: "Exponential Decay",
    description: "Exponential function: y = 10 * e^(-0.5x)",
    equation: "10 * e^(-0.5x)",
    columns: ["x", "y"],
    data: generateData((x) => 10 * Math.exp(-0.5 * x), 0, 8, 40, 0.1),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "logarithmic",
    name: "Logarithmic",
    description: "Logarithmic function: y = 2 * ln(x) + 1",
    equation: "2 * ln(x) + 1",
    columns: ["x", "y"],
    data: generateData((x) => 2 * Math.log(x) + 1, 0.5, 10, 40, 0.1),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "compound",
    name: "Compound Formula",
    description: "Mixed function: y = x * sin(x) + 2",
    equation: "x * sin(x) + 2",
    columns: ["x", "y"],
    data: generateData((x) => x * Math.sin(x) + 2, 0, 10, 60, 0.1),
    suggestedFeatures: ["x"],
    suggestedTarget: "y",
  },
  {
    id: "multivariate",
    name: "Two Variables",
    description: "Multivariate: y = x₁² + x₂² (Paraboloid)",
    equation: "x₁² + x₂²",
    columns: ["x1", "x2", "y"],
    data: generateData2D(
      (x1, x2) => x1 * x1 + x2 * x2,
      { x1: [-3, 3], x2: [-3, 3] },
      10,
      0.1
    ),
    suggestedFeatures: ["x1", "x2"],
    suggestedTarget: "y",
  },
  {
    id: "kepler",
    name: "Kepler's Third Law",
    description: "Planetary motion: T² ∝ R³",
    equation: "R^1.5 (approximately T = R^1.5)",
    columns: ["R", "T"],
    data: [
      { R: 0.39, T: 0.24 },   // Mercury
      { R: 0.72, T: 0.62 },   // Venus
      { R: 1.00, T: 1.00 },   // Earth
      { R: 1.52, T: 1.88 },   // Mars
      { R: 5.20, T: 11.86 },  // Jupiter
      { R: 9.54, T: 29.46 },  // Saturn
      { R: 19.2, T: 84.01 },  // Uranus
      { R: 30.1, T: 164.8 },  // Neptune
    ],
    suggestedFeatures: ["R"],
    suggestedTarget: "T",
  },
  {
    id: "physics-spring",
    name: "Spring Oscillation",
    description: "Damped harmonic motion",
    equation: "e^(-0.2t) * cos(2πt)",
    columns: ["t", "displacement"],
    data: generateData(
      (t) => Math.exp(-0.2 * t) * Math.cos(2 * Math.PI * t),
      0, 10, 100, 0.02
    ).map(d => ({ t: d.x, displacement: d.y })),
    suggestedFeatures: ["t"],
    suggestedTarget: "displacement",
  },
];

/**
 * Get a dataset by ID
 */
export function getDatasetById(id: string): SampleDataset | undefined {
  return SAMPLE_DATASETS.find((d) => d.id === id);
}

/**
 * Create empty dataset template for manual entry
 */
export function createEmptyDataset(
  columns: string[] = ["x", "y"],
  rows: number = 10
): Record<string, number>[] {
  return Array.from({ length: rows }, () => {
    const row: Record<string, number> = {};
    columns.forEach((col) => {
      row[col] = 0;
    });
    return row;
  });
}

