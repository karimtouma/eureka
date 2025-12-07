#!/usr/bin/env python3
"""Test script for the GP engine."""
import asyncio
import numpy as np
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from gp.engine import GPEngine


async def test_evolution():
    """Test the evolution engine with a simple dataset."""
    print("=" * 60)
    print("Testing GP Evolution Engine")
    print("=" * 60)
    
    # Create simple test data: y = x^2
    X = np.linspace(-5, 5, 50).reshape(-1, 1)
    y = X.flatten() ** 2
    
    print(f"\nTest data: y = x^2")
    print(f"X shape: {X.shape}")
    print(f"y shape: {y.shape}")
    print(f"X range: [{X.min():.2f}, {X.max():.2f}]")
    print(f"y range: [{y.min():.2f}, {y.max():.2f}]")
    
    # Create engine
    print("\n--- Creating GP Engine ---")
    engine = GPEngine(
        X=X,
        y=y,
        variable_names=["x"],
        operators=["+", "-", "*", "/"],
        functions=["sqrt", "abs"],
        population_size=50,
        generations=10,
        mutation_prob=0.2,
        crossover_prob=0.5,
        tournament_size=5,
        max_depth=4,
        parsimony_coefficient=0.001
    )
    
    # Run evolution
    print("\n--- Running Evolution ---")
    
    async def on_update(update):
        gen = update.get("generation", "?")
        best = update.get("best", {})
        eq = best.get("equation", "?")
        r2 = best.get("r_squared", 0)
        print(f"  Gen {gen}: {eq} (R²={r2:.4f})")
    
    result = await engine.evolve(callback=on_update)
    
    # Print results
    print("\n--- Results ---")
    print(f"Status: {result.get('status')}")
    print(f"Best equation: {result.get('best_equation')}")
    print(f"Best fitness: {result.get('best_fitness')}")
    
    print("\nHall of Fame:")
    for i, candidate in enumerate(result.get("hall_of_fame", [])[:5]):
        print(f"  {i+1}. {candidate['equation']} (R²={candidate['r_squared']:.4f})")
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_evolution())

