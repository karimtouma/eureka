"""Fitness functions and evaluation metrics for GP with NumPy vectorization."""
import numpy as np
from typing import Tuple
import warnings

# Suppress numpy warnings for cleaner output
warnings.filterwarnings('ignore', category=RuntimeWarning)


def calculate_mse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calculate Mean Squared Error with proper handling of invalid values."""
    try:
        y_true = np.asarray(y_true, dtype=np.float64).flatten()
        y_pred = np.asarray(y_pred, dtype=np.float64).flatten()
        
        # Handle invalid values
        mask = np.isfinite(y_pred)
        if not np.any(mask):
            return 1e10
        
        y_true_valid = y_true[mask]
        y_pred_valid = y_pred[mask]
        
        if len(y_true_valid) == 0:
            return 1e10
        
        mse = np.mean((y_true_valid - y_pred_valid) ** 2)
        
        if not np.isfinite(mse):
            return 1e10
            
        return float(mse)
    except Exception:
        return 1e10


def calculate_r_squared(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calculate R-squared (coefficient of determination)."""
    try:
        y_true = np.asarray(y_true, dtype=np.float64).flatten()
        y_pred = np.asarray(y_pred, dtype=np.float64).flatten()
        
        # Handle invalid values
        mask = np.isfinite(y_pred) & np.isfinite(y_true)
        if not np.any(mask):
            return 0.0
        
        y_true_valid = y_true[mask]
        y_pred_valid = y_pred[mask]
        
        if len(y_true_valid) < 2:
            return 0.0
        
        ss_res = np.sum((y_true_valid - y_pred_valid) ** 2)
        ss_tot = np.sum((y_true_valid - np.mean(y_true_valid)) ** 2)
        
        if ss_tot < 1e-10:
            return 1.0 if ss_res < 1e-10 else 0.0
        
        r2 = 1.0 - (ss_res / ss_tot)
        
        # Clamp to [0, 1] range
        return float(np.clip(r2, 0.0, 1.0))
    except Exception:
        return 0.0


def calculate_aic(mse: float, n_samples: int, complexity: int) -> float:
    """Calculate Akaike Information Criterion (AIC). Lower is better."""
    try:
        if mse <= 0 or not np.isfinite(mse) or n_samples <= 0:
            return 1e10
        
        # AIC = n * ln(MSE) + 2 * k
        aic = n_samples * np.log(mse) + 2 * complexity
        return float(aic) if np.isfinite(aic) else 1e10
    except Exception:
        return 1e10


def calculate_bic(mse: float, n_samples: int, complexity: int) -> float:
    """Calculate Bayesian Information Criterion (BIC). Lower is better."""
    try:
        if mse <= 0 or not np.isfinite(mse) or n_samples <= 0:
            return 1e10
        
        # BIC = n * ln(MSE) + k * ln(n)
        bic = n_samples * np.log(mse) + complexity * np.log(n_samples)
        return float(bic) if np.isfinite(bic) else 1e10
    except Exception:
        return 1e10


def calculate_parsimony_score(r_squared: float, complexity: int, alpha: float = 0.01) -> float:
    """Calculate parsimony-adjusted score. Higher is better."""
    return r_squared - alpha * complexity


def get_predictions_vectorized(individual, toolbox, X: np.ndarray) -> np.ndarray:
    """
    Get predictions from an individual using vectorized NumPy operations.
    
    This is the optimized version that uses np.vectorize for faster evaluation.
    """
    try:
        # Compile the individual to a function
        func = toolbox.compile(expr=individual)
        
        X = np.asarray(X, dtype=np.float64)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        
        n_samples = X.shape[0]
        n_features = X.shape[1]
        
        # For single variable, use vectorize directly
        if n_features == 1:
            # Use np.vectorize for scalar functions
            vectorized_func = np.vectorize(func, otypes=[np.float64])
            try:
                predictions = vectorized_func(X[:, 0])
            except Exception:
                # Fallback to loop if vectorize fails
                predictions = np.array([_safe_eval(func, row[0]) for row in X])
        else:
            # Multi-variable: evaluate row by row with unpacking
            predictions = np.array([
                _safe_eval_multi(func, row) for row in X
            ])
        
        # Clean up predictions
        predictions = np.where(np.isfinite(predictions), predictions, 0.0)
        predictions = np.clip(predictions, -1e10, 1e10)
        
        return predictions
        
    except Exception:
        return np.zeros(len(X))


def _safe_eval(func, x: float) -> float:
    """Safely evaluate a function with a single argument."""
    try:
        result = func(x)
        if np.isfinite(result) and abs(result) < 1e10:
            return float(result)
        return 0.0
    except Exception:
        return 0.0


def _safe_eval_multi(func, args) -> float:
    """Safely evaluate a function with multiple arguments."""
    try:
        result = func(*args)
        if np.isfinite(result) and abs(result) < 1e10:
            return float(result)
        return 0.0
    except Exception:
        return 0.0


def evaluate_individual_vectorized(
    individual,
    toolbox,
    X: np.ndarray,
    y: np.ndarray,
    parsimony_coefficient: float = 0.001
) -> Tuple[float]:
    """
    Evaluate an individual's fitness using vectorized NumPy operations.
    
    Fitness = MSE + parsimony_coefficient * complexity
    
    Lower is better.
    """
    try:
        # Get predictions using vectorized evaluation
        predictions = get_predictions_vectorized(individual, toolbox, X)
        
        # Calculate MSE
        y = np.asarray(y, dtype=np.float64).flatten()
        mse = calculate_mse(y, predictions)
        
        # Add parsimony pressure (penalize complexity)
        complexity = len(individual)
        fitness = mse + parsimony_coefficient * complexity
        
        # Ensure valid fitness
        if not np.isfinite(fitness) or fitness > 1e10:
            fitness = 1e10
        
        return (float(fitness),)
        
    except Exception:
        return (1e10,)


# Legacy function for compatibility
def evaluate_individual(
    individual,
    toolbox,
    X: np.ndarray,
    y: np.ndarray,
    parsimony_coefficient: float = 0.001
) -> Tuple[float]:
    """Legacy wrapper - redirects to vectorized version."""
    return evaluate_individual_vectorized(individual, toolbox, X, y, parsimony_coefficient)


def get_predictions(individual, toolbox, X: np.ndarray) -> np.ndarray:
    """Legacy wrapper - redirects to vectorized version."""
    return get_predictions_vectorized(individual, toolbox, X)


def evaluate_on_split(
    individual,
    toolbox,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray
) -> dict:
    """Evaluate an individual on both train and test sets."""
    complexity = len(individual)
    n_train = len(y_train)
    n_test = len(y_test)
    
    # Train metrics
    pred_train = get_predictions_vectorized(individual, toolbox, X_train)
    mse_train = calculate_mse(y_train, pred_train)
    r2_train = calculate_r_squared(y_train, pred_train)
    
    # Test metrics
    pred_test = get_predictions_vectorized(individual, toolbox, X_test)
    mse_test = calculate_mse(y_test, pred_test)
    r2_test = calculate_r_squared(y_test, pred_test)
    
    # Information criteria (on test set)
    aic = calculate_aic(mse_test, n_test, complexity)
    bic = calculate_bic(mse_test, n_test, complexity)
    
    # Parsimony score (on test set)
    parsimony_score = calculate_parsimony_score(r2_test, complexity)
    
    # Overfitting indicator
    overfit_gap = r2_train - r2_test
    
    return {
        "train": {"mse": mse_train, "r_squared": r2_train},
        "test": {"mse": mse_test, "r_squared": r2_test},
        "complexity": complexity,
        "aic": aic,
        "bic": bic,
        "parsimony_score": parsimony_score,
        "overfit_gap": overfit_gap,
    }
