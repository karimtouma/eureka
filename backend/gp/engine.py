"""
Main Genetic Programming Engine using DEAP.

SOTA Techniques Implemented:
- Lexicographic Selection: Prioritize simplicity when fitness is similar
- Double Tournament: Separate pressure for fitness and size
- Adaptive Parsimony: Increase complexity penalty over generations
- Strict Size Limits: Hard cap on tree size (20 nodes max)
- Multi-objective Hall of Fame: Track best by fitness AND simplicity
"""
import numpy as np
import random
import time
from deap import base, creator, tools, gp
from typing import List, Dict, Any, Optional, Callable
import logging
from sklearn.model_selection import train_test_split

from .primitives import create_primitive_set
from .fitness import (
    evaluate_individual_vectorized,
    calculate_r_squared, 
    calculate_mse, 
    calculate_aic,
    calculate_bic,
    calculate_parsimony_score,
    get_predictions_vectorized,
)
from .equation_formatter import simplify_equation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create fitness and individual classes at module level (only once)
if not hasattr(creator, "FitnessMin"):
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
if not hasattr(creator, "Individual"):
    creator.create("Individual", gp.PrimitiveTree, fitness=creator.FitnessMin)


def operator_len(individual):
    """Return the length of an individual."""
    return len(individual)


def sel_lexicographic(individuals, k, tournsize=7, epsilon=0.01):
    """
    SOTA: Lexicographic Tournament Selection.
    
    Selects based on fitness first, but when fitness values are within epsilon,
    prefers the simpler (shorter) individual. This prevents bloat while 
    maintaining selection pressure for good solutions.
    
    Reference: Luke & Panait (2006) "A Comparison of Bloat Control Methods"
    """
    selected = []
    for _ in range(k):
        # Select random individuals for tournament
        aspirants = random.sample(individuals, min(tournsize, len(individuals)))
        
        # Sort by fitness (lower is better)
        aspirants.sort(key=lambda x: x.fitness.values[0])
        
        # Get best fitness
        best_fitness = aspirants[0].fitness.values[0]
        
        # Find all individuals within epsilon of best
        similar = [ind for ind in aspirants 
                   if abs(ind.fitness.values[0] - best_fitness) < epsilon * max(1, abs(best_fitness))]
        
        # Among similar fitness, select shortest (simplest)
        winner = min(similar, key=len)
        selected.append(winner)
    
    return selected


def sel_double_tournament(individuals, k, fitness_size=7, parsimony_size=1.4):
    """
    SOTA: Double Tournament Selection.
    
    Two-stage tournament: first by fitness, then by size.
    parsimony_size controls how much to favor smaller trees.
    
    Reference: Luke (2000) "Two Fast Tree-Creation Algorithms for GP"
    """
    selected = []
    for _ in range(k):
        # First tournament: by fitness
        aspirants = random.sample(individuals, min(fitness_size, len(individuals)))
        winner1 = min(aspirants, key=lambda x: x.fitness.values[0])
        
        # Second tournament: compare with random individual by size
        if random.random() < 1.0 / parsimony_size:
            competitor = random.choice(individuals)
            if len(competitor) < len(winner1):
                # Only replace if competitor has reasonable fitness
                if competitor.fitness.values[0] < winner1.fitness.values[0] * 1.5:
                    winner1 = competitor
        
        selected.append(winner1)
    
    return selected


class GPEngine:
    """
    Genetic Programming Engine for Symbolic Regression.
    
    SOTA Features:
    - Lexicographic selection for bloat control
    - Adaptive parsimony pressure
    - Strict tree size limits (max 20 nodes)
    - Multi-objective tracking (accuracy + simplicity)
    - Train/Test split for overfitting detection
    """
    
    # SOTA: Strict size limits to prevent bloat
    MAX_TREE_SIZE = 20
    MAX_TREE_DEPTH = 4
    
    def __init__(
        self,
        X: np.ndarray,
        y: np.ndarray,
        variable_names: List[str],
        operators: List[str] = ["+", "-", "*", "/"],
        functions: List[str] = ["sin", "cos", "sqrt", "log", "exp"],
        population_size: int = 300,
        mutation_prob: float = 0.2,
        crossover_prob: float = 0.5,
        tournament_size: int = 7,
        max_depth: int = 4,  # Reduced default
        parsimony_coefficient: float = 0.01,  # Increased 10x
        update_interval: float = 0.5,
        test_size: float = 0.2,
        random_state: int = 42,
        **kwargs
    ):
        self.X = np.array(X, dtype=np.float64)
        self.y = np.array(y, dtype=np.float64)
        self.variable_names = [self._sanitize_name(name) for name in variable_names]
        self.operators = operators
        self.functions = functions
        self.population_size = min(population_size, 500)
        self.mutation_prob = mutation_prob
        self.crossover_prob = crossover_prob
        self.tournament_size = tournament_size
        self.max_depth = min(max_depth, self.MAX_TREE_DEPTH)
        self.parsimony_coefficient = parsimony_coefficient
        self.update_interval = update_interval
        self.test_size = test_size
        self.random_state = random_state
        
        # SOTA: Adaptive parsimony - starts low, increases over generations
        self.base_parsimony = parsimony_coefficient
        self.adaptive_parsimony = parsimony_coefficient
        
        # Train/Test split
        if self.X.ndim == 1:
            self.X = self.X.reshape(-1, 1)
        
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, 
            test_size=test_size, 
            random_state=random_state
        )
        
        logger.info(f"GPEngine initialized (SOTA bloat control):")
        logger.info(f"  - Total samples: {len(self.y)}")
        logger.info(f"  - Train samples: {len(self.y_train)}")
        logger.info(f"  - Test samples: {len(self.y_test)}")
        logger.info(f"  - Variables: {self.variable_names}")
        logger.info(f"  - Population: {self.population_size}")
        logger.info(f"  - Max depth: {self.max_depth} (strict limit: {self.MAX_TREE_DEPTH})")
        logger.info(f"  - Max tree size: {self.MAX_TREE_SIZE} nodes")
        logger.info(f"  - Parsimony coefficient: {self.parsimony_coefficient}")
        
        self._setup_deap()
        
        self.hall_of_fame: List[Dict[str, Any]] = []
        self.pareto_front: List[Dict[str, Any]] = []
        self.generation_stats: List[Dict[str, Any]] = []
        self.is_running = False
        self.should_stop = False
        self.current_generation = 0
        self.start_time: Optional[float] = None
        
        # For checkpointing
        self.population = None
        self.hof = None
        self.simplest_hof = None  # SOTA: Track simplest good solutions
    
    def _sanitize_name(self, name: str) -> str:
        """Sanitize variable name to be valid Python identifier."""
        sanitized = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        if sanitized and sanitized[0].isdigit():
            sanitized = 'x' + sanitized
        return sanitized or 'x'
    
    def _setup_deap(self):
        """Set up DEAP toolbox with SOTA techniques."""
        num_vars = self.X_train.shape[1]
        
        logger.info(f"Setting up DEAP with {num_vars} variables (SOTA config)")
        
        self.pset = create_primitive_set(
            num_vars,
            self.variable_names,
            self.operators,
            self.functions
        )
        
        self.toolbox = base.Toolbox()
        
        # SOTA: Use ramped half-and-half with strict depth limit
        self.toolbox.register("expr", gp.genHalfAndHalf, pset=self.pset, 
                              min_=1, max_=self.max_depth)
        self.toolbox.register("individual", tools.initIterate, creator.Individual, 
                              self.toolbox.expr)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        self.toolbox.register("compile", gp.compile, pset=self.pset)
        
        # Test compilation
        try:
            test_ind = self.toolbox.individual()
            logger.info(f"Test individual: {test_ind} (size: {len(test_ind)})")
            test_func = self.toolbox.compile(expr=test_ind)
            
            if self.X_train.shape[1] == 1:
                test_result = test_func(self.X_train[0, 0])
            else:
                test_result = test_func(*self.X_train[0])
            logger.info(f"Test compilation successful, result: {test_result}")
            
            test_fitness = self._evaluate_individual(test_ind)
            logger.info(f"Test evaluation successful, fitness: {test_fitness}")
            
        except Exception as e:
            logger.error(f"Test compilation/evaluation failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
        
        # SOTA: Lexicographic selection (prioritizes simplicity when fitness similar)
        self.toolbox.register("select", sel_lexicographic, 
                              tournsize=self.tournament_size, epsilon=0.05)
        
        # Genetic operators
        self.toolbox.register("mate", gp.cxOnePoint)
        self.toolbox.register("expr_mut", gp.genFull, min_=0, max_=1)  # Smaller mutations
        self.toolbox.register("mutate", gp.mutUniform, expr=self.toolbox.expr_mut, pset=self.pset)
        
        # SOTA: Strict limits on tree size
        self.toolbox.decorate("mate", gp.staticLimit(key=operator_len, 
                                                     max_value=self.MAX_TREE_SIZE))
        self.toolbox.decorate("mutate", gp.staticLimit(key=operator_len, 
                                                       max_value=self.MAX_TREE_SIZE))
        
        logger.info("DEAP toolbox setup complete with SOTA bloat control")
    
    def _evaluate_individual(self, individual) -> tuple:
        """
        Evaluate with adaptive parsimony pressure.
        
        Fitness = MSE + parsimony_coefficient * complexity^2
        
        The quadratic penalty strongly discourages complex solutions.
        """
        # Base evaluation
        pred = get_predictions_vectorized(individual, self.toolbox, self.X_train)
        mse = calculate_mse(self.y_train, pred)
        
        # SOTA: Quadratic complexity penalty
        complexity = len(individual)
        complexity_penalty = self.adaptive_parsimony * (complexity ** 1.5)
        
        fitness = mse + complexity_penalty
        
        # Extra penalty for exceeding size limit
        if complexity > self.MAX_TREE_SIZE:
            fitness += 1e6
        
        if not np.isfinite(fitness) or fitness > 1e10:
            fitness = 1e10
        
        return (float(fitness),)
    
    def _evaluate_population(self, individuals: List) -> List[tuple]:
        """Evaluate all individuals in population."""
        return [self._evaluate_individual(ind) for ind in individuals]
    
    def _update_adaptive_parsimony(self):
        """
        SOTA: Adaptive Parsimony Pressure.
        
        Increases parsimony coefficient as evolution progresses to
        maintain selection pressure toward simpler solutions.
        """
        if self.current_generation > 0:
            # Increase every 50 generations
            factor = 1.0 + (self.current_generation / 200)
            self.adaptive_parsimony = self.base_parsimony * min(factor, 5.0)
    
    def _individual_to_dict(self, individual, include_test: bool = True, 
                            include_predictions: bool = False) -> Dict[str, Any]:
        """Convert an individual to a dictionary with metrics."""
        try:
            complexity = len(individual)
            
            # Train metrics
            pred_train = get_predictions_vectorized(individual, self.toolbox, self.X_train)
            mse_train = calculate_mse(self.y_train, pred_train)
            r2_train = calculate_r_squared(self.y_train, pred_train)
            
            # Format equation using SymPy
            equation_str = str(individual)
            equation_formatted = simplify_equation(equation_str)
            
            result = {
                "equation": equation_str,
                "equation_formatted": equation_formatted,
                "fitness": float(individual.fitness.values[0]) if individual.fitness.valid else 999.0,
                "complexity": complexity,
                "mse": mse_train,
                "r_squared": r2_train,
                "train_r_squared": r2_train,
                "train_mse": mse_train,
            }
            
            # Include predictions for visualization
            if include_predictions:
                result["train_predictions"] = pred_train.tolist()
                # For single variable, use actual x values; otherwise use sample indices
                if self.X_train.shape[1] == 1:
                    result["train_x"] = self.X_train[:, 0].tolist()
                else:
                    result["train_x"] = list(range(len(self.y_train)))
                result["train_y"] = self.y_train.tolist()
                result["n_features"] = self.X_train.shape[1]
            
            if include_test:
                pred_test = get_predictions_vectorized(individual, self.toolbox, self.X_test)
                mse_test = calculate_mse(self.y_test, pred_test)
                r2_test = calculate_r_squared(self.y_test, pred_test)
                
                n_test = len(self.y_test)
                aic = calculate_aic(mse_test, n_test, complexity)
                bic = calculate_bic(mse_test, n_test, complexity)
                parsimony_score = calculate_parsimony_score(r2_test, complexity, alpha=0.02)
                overfit_gap = r2_train - r2_test
                
                result.update({
                    "test_r_squared": r2_test,
                    "test_mse": mse_test,
                    "aic": aic,
                    "bic": bic,
                    "parsimony_score": parsimony_score,
                    "overfit_gap": overfit_gap,
                })
                
                if include_predictions:
                    result["test_predictions"] = pred_test.tolist()
                    # For single variable, use actual x values; otherwise use sample indices
                    if self.X_test.shape[1] == 1:
                        result["test_x"] = self.X_test[:, 0].tolist()
                    else:
                        # Use indices offset from train size for clarity
                        result["test_x"] = list(range(len(self.y_train), len(self.y_train) + len(self.y_test)))
                    result["test_y"] = self.y_test.tolist()
            
            return result
            
        except Exception as e:
            logger.warning(f"Error converting individual: {e}")
            return {
                "equation": str(individual),
                "fitness": 999.0,
                "complexity": len(individual),
                "mse": 999.0,
                "r_squared": 0.0,
                "train_r_squared": 0.0,
                "test_r_squared": 0.0,
            }
    
    def _prune_population(self, population):
        """
        SOTA: Aggressive pruning of oversized individuals.
        
        Replace bloated individuals with new random ones.
        """
        pruned = 0
        for i, ind in enumerate(population):
            if len(ind) > self.MAX_TREE_SIZE:
                population[i] = self.toolbox.individual()
                pruned += 1
        
        if pruned > 0:
            logger.debug(f"Pruned {pruned} oversized individuals")
    
    async def evolve(self, callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Run evolution with SOTA bloat control."""
        import asyncio
        
        self.is_running = True
        self.should_stop = False
        self.current_generation = 0
        self.start_time = time.time()
        self.adaptive_parsimony = self.base_parsimony
        
        logger.info("Starting evolution with SOTA bloat control...")
        
        try:
            # Initialize population
            logger.info(f"Creating population of {self.population_size}")
            population = self.toolbox.population(n=self.population_size)
            self.population = population
            
            # SOTA: Two halls of fame - best fitness and simplest good
            hof = tools.HallOfFame(10)
            simplest_hof = tools.HallOfFame(10)  # For tracking simple solutions
            self.hof = hof
            self.simplest_hof = simplest_hof
            
            # Evaluate initial population
            logger.info("Evaluating initial population...")
            fitnesses = self._evaluate_population(population)
            for ind, fit in zip(population, fitnesses):
                ind.fitness.values = fit
            
            hof.update(population)
            self._update_simplest_hof(population, simplest_hof)
            
            # Log initial best
            best_init = hof[0]
            best_init_info = self._individual_to_dict(best_init)
            logger.info(f"Initial best: {best_init}")
            logger.info(f"  Fitness: {best_init.fitness.values[0]:.6f}")
            logger.info(f"  Train R²: {best_init_info['train_r_squared']:.4f}")
            logger.info(f"  Complexity: {best_init_info['complexity']}")
            
            last_update_time = time.time()
            
            # Evolution loop
            while not self.should_stop:
                self.current_generation += 1
                
                # SOTA: Update adaptive parsimony
                self._update_adaptive_parsimony()
                
                # Selection (lexicographic - prefers simpler when similar fitness)
                offspring = self.toolbox.select(population, len(population))
                offspring = list(map(self.toolbox.clone, offspring))
                
                # Crossover
                for child1, child2 in zip(offspring[::2], offspring[1::2]):
                    if random.random() < self.crossover_prob:
                        self.toolbox.mate(child1, child2)
                        del child1.fitness.values
                        del child2.fitness.values
                
                # Mutation
                for mutant in offspring:
                    if random.random() < self.mutation_prob:
                        self.toolbox.mutate(mutant)
                        del mutant.fitness.values
                
                # SOTA: Prune oversized individuals
                self._prune_population(offspring)
                
                # Evaluate
                invalid_ind = [ind for ind in offspring if not ind.fitness.valid]
                fitnesses = self._evaluate_population(invalid_ind)
                for ind, fit in zip(invalid_ind, fitnesses):
                    ind.fitness.values = fit
                
                # Replace population
                population[:] = offspring
                self.population = population
                hof.update(population)
                self._update_simplest_hof(population, simplest_hof)
                
                # Send updates
                current_time = time.time()
                if current_time - last_update_time >= self.update_interval:
                    last_update_time = current_time
                    
                    # Use simplest good solution as "best" for reporting
                    best = self._get_best_parsimonious(hof, simplest_hof)
                    best_info = self._individual_to_dict(best, include_predictions=True)
                    elapsed = current_time - self.start_time
                    
                    fitnesses_vals = [ind.fitness.values[0] for ind in population if ind.fitness.valid]
                    complexities = [len(ind) for ind in population]
                    
                    gen_stats = {
                        "generation": self.current_generation,
                        "elapsed_time": elapsed,
                        "generations_per_second": self.current_generation / elapsed if elapsed > 0 else 0,
                        "best_fitness": float(min(fitnesses_vals)) if fitnesses_vals else 999.0,
                        "avg_fitness": float(np.mean(fitnesses_vals)) if fitnesses_vals else 999.0,
                        "std_fitness": float(np.std(fitnesses_vals)) if fitnesses_vals else 0.0,
                        "train_r_squared": best_info["train_r_squared"],
                        "test_r_squared": best_info.get("test_r_squared", 0),
                        "overfit_gap": best_info.get("overfit_gap", 0),
                        "best_complexity": best_info["complexity"],
                        "avg_complexity": float(np.mean(complexities)),
                        "aic": best_info.get("aic", 0),
                        "bic": best_info.get("bic", 0),
                        "parsimony_score": best_info.get("parsimony_score", 0),
                        "best_equation": best_info["equation"],
                        "adaptive_parsimony": self.adaptive_parsimony,
                    }
                    self.generation_stats.append(gen_stats)
                    
                    logger.info(
                        f"Gen {self.current_generation} ({elapsed:.1f}s): "
                        f"Train R²={best_info['train_r_squared']:.4f}, "
                        f"Test R²={best_info.get('test_r_squared', 0):.4f}, "
                        f"Complexity={best_info['complexity']}, "
                        f"AvgSize={np.mean(complexities):.1f}, "
                        f"{self.current_generation/elapsed:.1f} gen/s"
                    )
                    
                    if callback:
                        # Include predictions for all top 5 candidates (for FitChart selection)
                        hof_list = [self._individual_to_dict(ind, include_predictions=True) 
                                    for ind in hof[:5]]
                        
                        update = {
                            "type": "generation_update",
                            "generation": self.current_generation,
                            "elapsed_time": elapsed,
                            "stats": gen_stats,
                            "best": best_info,
                            "hall_of_fame": hof_list
                        }
                        try:
                            await callback(update)
                        except Exception as e:
                            logger.error(f"Failed to send update: {e}")
                    
                    await asyncio.sleep(0)
            
            # Final results
            elapsed = time.time() - self.start_time
            logger.info(f"Evolution stopped after {self.current_generation} generations ({elapsed:.1f}s)")
            
            self.hall_of_fame = [self._individual_to_dict(ind, include_predictions=True) 
                                 for ind in hof]
            self.pareto_front = self._calculate_pareto_front(hof)
            
            if self.hall_of_fame:
                logger.info(f"Best solution: {self.hall_of_fame[0]['equation']}")
                logger.info(f"  Train R²: {self.hall_of_fame[0]['train_r_squared']:.4f}")
                logger.info(f"  Test R²: {self.hall_of_fame[0].get('test_r_squared', 0):.4f}")
                logger.info(f"  Complexity: {self.hall_of_fame[0]['complexity']}")
            
            return {
                "status": "stopped",
                "generations_completed": self.current_generation,
                "elapsed_time": elapsed,
                "best_equation": self.hall_of_fame[0]["equation"] if self.hall_of_fame else None,
                "best_fitness": self.hall_of_fame[0]["fitness"] if self.hall_of_fame else None,
                "hall_of_fame": self.hall_of_fame,
                "pareto_front": self.pareto_front
            }
            
        except Exception as e:
            import traceback
            logger.error(f"Evolution error: {e}")
            logger.error(traceback.format_exc())
            return {
                "status": "error",
                "error": str(e),
                "hall_of_fame": [],
                "pareto_front": []
            }
        finally:
            self.is_running = False
    
    def _update_simplest_hof(self, population, simplest_hof):
        """
        SOTA: Track simplest individuals with good fitness.
        
        Only add to simplest HOF if R² > 0.8 (good enough solution).
        """
        r2_threshold = 0.8
        
        for ind in population:
            if not ind.fitness.valid:
                continue
            
            # Check if it's a good solution
            try:
                pred = get_predictions_vectorized(ind, self.toolbox, self.X_train)
                r2 = calculate_r_squared(self.y_train, pred)
                
                if r2 >= r2_threshold:
                    # Check if simpler than current simplest HOF members
                    if len(simplest_hof) < simplest_hof.maxsize:
                        simplest_hof.insert(ind)
                    elif len(ind) < len(simplest_hof[-1]):
                        simplest_hof.insert(ind)
            except:
                pass
    
    def _get_best_parsimonious(self, hof, simplest_hof):
        """
        SOTA: Get best solution balancing accuracy and simplicity.
        
        Prefer simplest solution if its R² is within 5% of best.
        """
        if not simplest_hof:
            return hof[0]
        
        best = hof[0]
        simplest = simplest_hof[0]
        
        # Get R² for both
        try:
            pred_best = get_predictions_vectorized(best, self.toolbox, self.X_train)
            r2_best = calculate_r_squared(self.y_train, pred_best)
            
            pred_simple = get_predictions_vectorized(simplest, self.toolbox, self.X_train)
            r2_simple = calculate_r_squared(self.y_train, pred_simple)
            
            # If simplest is within 5% of best R², prefer simplest
            if r2_simple >= r2_best * 0.95 and len(simplest) < len(best):
                return simplest
        except:
            pass
        
        return best
    
    def _calculate_pareto_front(self, individuals) -> List[Dict[str, Any]]:
        """Calculate Pareto front based on Test R² and complexity."""
        candidates = []
        for ind in individuals:
            info = self._individual_to_dict(ind, include_predictions=True)
            candidates.append(info)
        
        candidates.sort(key=lambda x: x["complexity"])
        
        pareto = []
        best_test_r2 = -float('inf')
        
        for c in candidates:
            test_r2 = c.get("test_r_squared", c["r_squared"])
            if test_r2 > best_test_r2:
                pareto.append(c)
                best_test_r2 = test_r2
        
        return pareto
    
    def stop(self):
        """Stop the evolution."""
        logger.info("Stop requested")
        self.should_stop = True
    
    def get_checkpoint_state(self) -> Dict[str, Any]:
        """Get current state for checkpointing."""
        return {
            "generation": self.current_generation,
            "population": self.population,
            "hall_of_fame": self.hof,
            "generation_stats": self.generation_stats,
            "adaptive_parsimony": self.adaptive_parsimony,
            "config": {
                "population_size": self.population_size,
                "mutation_prob": self.mutation_prob,
                "crossover_prob": self.crossover_prob,
                "tournament_size": self.tournament_size,
                "max_depth": self.max_depth,
                "parsimony_coefficient": self.parsimony_coefficient,
                "variable_names": self.variable_names,
                "operators": self.operators,
                "functions": self.functions,
            },
            "data_info": {
                "n_samples": len(self.y),
                "n_features": self.X.shape[1] if self.X.ndim > 1 else 1,
                "n_train": len(self.y_train),
                "n_test": len(self.y_test),
            }
        }
    
    def restore_from_checkpoint(self, checkpoint: Dict[str, Any]):
        """Restore state from checkpoint."""
        self.current_generation = checkpoint.get("generation", 0)
        self.population = checkpoint.get("population")
        self.hof = checkpoint.get("hall_of_fame")
        self.generation_stats = checkpoint.get("generation_stats", [])
        self.adaptive_parsimony = checkpoint.get("adaptive_parsimony", self.base_parsimony)
        logger.info(f"Restored from checkpoint at generation {self.current_generation}")
