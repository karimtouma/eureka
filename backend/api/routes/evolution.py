"""Evolution API Routes"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import asyncio
import numpy as np

from gp.engine import GPEngine
from gp.checkpoint import get_checkpoint_manager
from api.websockets.evolution_ws import send_evolution_update

router = APIRouter()

# Store for evolution sessions
evolution_sessions: Dict[str, Dict[str, Any]] = {}
# Store for running engines
running_engines: Dict[str, GPEngine] = {}


# ============================================
# Request/Response Models
# ============================================

class EvolutionConfig(BaseModel):
    features: List[str]
    target: str
    operators: List[str] = ["+", "-", "*", "/"]
    functions: List[str] = ["sin", "cos", "sqrt", "log", "exp"]
    population_size: int = 300
    mutation_prob: float = 0.2
    crossover_prob: float = 0.5
    tournament_size: int = 7
    max_depth: int = 5
    parsimony_coefficient: float = 0.001
    update_interval: float = 0.5  # How often to send updates (seconds)


class EvolutionStatus(BaseModel):
    session_id: str
    status: str
    current_generation: int
    elapsed_time: Optional[float] = None
    best_fitness: Optional[float]
    best_equation: Optional[str]


# ============================================
# Background Evolution Task
# ============================================

async def run_evolution(session_id: str, config: EvolutionConfig):
    """Background task to run the evolution algorithm."""
    from api.routes.data import current_dataset
    
    if current_dataset is None:
        evolution_sessions[session_id]["status"] = "error"
        evolution_sessions[session_id]["error"] = "No dataset loaded"
        return
    
    try:
        # Prepare data
        X = current_dataset[config.features].values
        y = current_dataset[config.target].values
        
        # Create GP engine (continuous evolution)
        engine = GPEngine(
            X=X,
            y=y,
            variable_names=config.features,
            operators=config.operators,
            functions=config.functions,
            population_size=config.population_size,
            mutation_prob=config.mutation_prob,
            crossover_prob=config.crossover_prob,
            tournament_size=config.tournament_size,
            max_depth=config.max_depth,
            parsimony_coefficient=config.parsimony_coefficient,
            update_interval=config.update_interval
        )
        
        running_engines[session_id] = engine
        evolution_sessions[session_id]["status"] = "running"
        
        # Callback to send updates via WebSocket
        async def on_update(update: Dict[str, Any]):
            await send_evolution_update(session_id, update)
            
            # Also update session storage
            evolution_sessions[session_id].update({
                "current_generation": update.get("generation", 0),
                "elapsed_time": update.get("elapsed_time", 0),
                "best_fitness": update.get("best", {}).get("fitness"),
                "best_equation": update.get("best", {}).get("equation"),
                "hall_of_fame": update.get("hall_of_fame", []),
            })
        
        # Run evolution
        results = await engine.evolve(callback=on_update)
        
        # Update final results
        evolution_sessions[session_id].update({
            "status": results["status"],
            "elapsed_time": results.get("elapsed_time", 0),
            "hall_of_fame": results["hall_of_fame"],
            "pareto_front": results["pareto_front"],
            "best_equation": results["best_equation"],
            "best_fitness": results["best_fitness"],
        })
        
        # Send completion message
        await send_evolution_update(session_id, {
            "type": "evolution_stopped",
            "status": results["status"],
            "elapsed_time": results.get("elapsed_time", 0),
            "generations_completed": results.get("generations_completed", 0),
            "hall_of_fame": results["hall_of_fame"],
            "pareto_front": results["pareto_front"],
            "best_equation": results["best_equation"],
            "best_fitness": results["best_fitness"],
        })
        
    except Exception as e:
        evolution_sessions[session_id]["status"] = "error"
        evolution_sessions[session_id]["error"] = str(e)
        await send_evolution_update(session_id, {
            "type": "error",
            "message": str(e)
        })
    finally:
        if session_id in running_engines:
            del running_engines[session_id]


# ============================================
# API Endpoints
# ============================================

@router.post("/start")
async def start_evolution(config: EvolutionConfig, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """Start a new evolution session."""
    from api.routes.data import current_dataset
    
    if current_dataset is None:
        raise HTTPException(status_code=400, detail="No dataset loaded")
    
    # Validate columns
    missing_features = set(config.features) - set(current_dataset.columns)
    if missing_features:
        raise HTTPException(status_code=400, detail=f"Features not found: {missing_features}")
    
    if config.target not in current_dataset.columns:
        raise HTTPException(status_code=400, detail=f"Target column not found: {config.target}")
    
    session_id = str(uuid.uuid4())
    
    evolution_sessions[session_id] = {
        "status": "pending",
        "config": config.model_dump(),
        "current_generation": 0,
        "elapsed_time": 0,
        "best_fitness": None,
        "best_equation": None,
        "hall_of_fame": [],
        "pareto_front": []
    }
    
    # Start evolution in background
    background_tasks.add_task(run_evolution, session_id, config)
    
    return {"session_id": session_id, "status": "created"}


@router.get("/status/{session_id}")
async def get_evolution_status(session_id: str) -> EvolutionStatus:
    """Get the status of an evolution session."""
    if session_id not in evolution_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = evolution_sessions[session_id]
    return EvolutionStatus(
        session_id=session_id,
        status=session["status"],
        current_generation=session["current_generation"],
        elapsed_time=session.get("elapsed_time"),
        best_fitness=session["best_fitness"],
        best_equation=session["best_equation"]
    )


@router.get("/results/{session_id}")
async def get_evolution_results(session_id: str) -> Dict[str, Any]:
    """Get the full results of an evolution session."""
    if session_id not in evolution_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = evolution_sessions[session_id]
    return {
        "session_id": session_id,
        "status": session["status"],
        "hall_of_fame": session["hall_of_fame"],
        "pareto_front": session["pareto_front"],
        "best_equation": session["best_equation"],
        "best_fitness": session["best_fitness"]
    }


@router.post("/stop/{session_id}")
async def stop_evolution(session_id: str) -> Dict[str, str]:
    """Stop an evolution session."""
    if session_id not in evolution_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Stop the engine if running
    if session_id in running_engines:
        running_engines[session_id].stop()
    
    evolution_sessions[session_id]["status"] = "stopped"
    return {"status": "stopped", "session_id": session_id}


@router.get("/operators")
async def get_available_operators() -> Dict[str, Any]:
    """Get list of available operators and functions.
    
    Returns plain dict to avoid Pydantic validation issues.
    """
    return {
        "operators": [
            {"id": "add", "symbol": "+", "name": "Addition", "arity": 2},
            {"id": "sub", "symbol": "-", "name": "Subtraction", "arity": 2},
            {"id": "mul", "symbol": "*", "name": "Multiplication", "arity": 2},
            {"id": "div", "symbol": "/", "name": "Protected Division", "arity": 2},
            {"id": "pow", "symbol": "^", "name": "Power", "arity": 2},
        ],
        "functions": [
            {"id": "sin", "symbol": "sin", "name": "Sine", "arity": 1},
            {"id": "cos", "symbol": "cos", "name": "Cosine", "arity": 1},
            {"id": "tan", "symbol": "tan", "name": "Tangent", "arity": 1},
            {"id": "sqrt", "symbol": "√", "name": "Square Root", "arity": 1},
            {"id": "log", "symbol": "log", "name": "Natural Logarithm", "arity": 1},
            {"id": "exp", "symbol": "exp", "name": "Exponential", "arity": 1},
            {"id": "abs", "symbol": "|x|", "name": "Absolute Value", "arity": 1},
        ],
        "terminals": [
            {"id": "const", "name": "Constants", "description": "Numeric constants (ephemeral)"},
            {"id": "var", "name": "Variables", "description": "Input variables from dataset"},
        ]
    }


# ============================================
# Checkpoint Endpoints
# ============================================

class CheckpointRequest(BaseModel):
    name: Optional[str] = None


@router.post("/checkpoint/{session_id}")
async def save_checkpoint(session_id: str, request: CheckpointRequest = None) -> Dict[str, Any]:
    """Save current evolution state as a checkpoint."""
    if session_id not in running_engines:
        raise HTTPException(status_code=404, detail="No running engine found for session")
    
    engine = running_engines[session_id]
    checkpoint_manager = get_checkpoint_manager()
    
    try:
        state = engine.get_checkpoint_state()
        name = request.name if request else None
        checkpoint_id = checkpoint_manager.save_checkpoint(session_id, state, name)
        
        return {
            "checkpoint_id": checkpoint_id,
            "session_id": session_id,
            "generation": state.get("generation", 0),
            "message": "Checkpoint saved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save checkpoint: {str(e)}")


@router.get("/checkpoints")
async def list_checkpoints(session_id: Optional[str] = None) -> Dict[str, Any]:
    """List all available checkpoints."""
    checkpoint_manager = get_checkpoint_manager()
    checkpoints = checkpoint_manager.list_checkpoints(session_id)
    
    return {
        "checkpoints": checkpoints,
        "count": len(checkpoints)
    }


@router.get("/checkpoint/{checkpoint_id}")
async def get_checkpoint(checkpoint_id: str) -> Dict[str, Any]:
    """Get checkpoint metadata."""
    checkpoint_manager = get_checkpoint_manager()
    checkpoints = checkpoint_manager.list_checkpoints()
    
    for cp in checkpoints:
        if cp.get("checkpoint_id") == checkpoint_id:
            return cp
    
    raise HTTPException(status_code=404, detail="Checkpoint not found")


@router.delete("/checkpoint/{checkpoint_id}")
async def delete_checkpoint(checkpoint_id: str) -> Dict[str, str]:
    """Delete a checkpoint."""
    checkpoint_manager = get_checkpoint_manager()
    
    if checkpoint_manager.delete_checkpoint(checkpoint_id):
        return {"status": "deleted", "checkpoint_id": checkpoint_id}
    
    raise HTTPException(status_code=404, detail="Checkpoint not found")


@router.post("/restore/{checkpoint_id}")
async def restore_from_checkpoint(
    checkpoint_id: str,
    background_tasks: BackgroundTasks
) -> Dict[str, str]:
    """Restore evolution from a checkpoint and continue running."""
    from api.routes.data import current_dataset
    
    checkpoint_manager = get_checkpoint_manager()
    
    try:
        state = checkpoint_manager.load_checkpoint(checkpoint_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load checkpoint: {str(e)}")
    
    if current_dataset is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Please load the original dataset first.")
    
    # Create new session for restored evolution
    session_id = str(uuid.uuid4())
    config = state.get("config", {})
    
    evolution_sessions[session_id] = {
        "status": "pending",
        "config": config,
        "current_generation": state.get("generation", 0),
        "elapsed_time": 0,
        "best_fitness": None,
        "best_equation": None,
        "hall_of_fame": [],
        "pareto_front": [],
        "restored_from": checkpoint_id
    }
    
    # Start restored evolution in background
    background_tasks.add_task(
        run_restored_evolution,
        session_id,
        state,
        config
    )
    
    return {
        "session_id": session_id,
        "status": "restored",
        "restored_from": checkpoint_id,
        "starting_generation": state.get("generation", 0)
    }


async def run_restored_evolution(
    session_id: str,
    checkpoint_state: Dict[str, Any],
    config: Dict[str, Any]
):
    """Background task to run evolution from a restored checkpoint."""
    from api.routes.data import current_dataset
    
    if current_dataset is None:
        evolution_sessions[session_id]["status"] = "error"
        evolution_sessions[session_id]["error"] = "No dataset loaded"
        return
    
    try:
        # Get feature/target from config
        features = config.get("variable_names", [])
        target_col = None
        
        # Try to find target column (not in features)
        for col in current_dataset.columns:
            if col not in features:
                target_col = col
                break
        
        if not features or not target_col:
            raise ValueError("Could not determine features and target from checkpoint")
        
        X = current_dataset[features].values
        y = current_dataset[target_col].values
        
        # Create engine with checkpoint config
        engine = GPEngine(
            X=X,
            y=y,
            variable_names=features,
            operators=config.get("operators", ["+", "-", "*", "/"]),
            functions=config.get("functions", ["sin", "cos", "sqrt", "log", "exp"]),
            population_size=config.get("population_size", 300),
            mutation_prob=config.get("mutation_prob", 0.2),
            crossover_prob=config.get("crossover_prob", 0.5),
            tournament_size=config.get("tournament_size", 7),
            max_depth=config.get("max_depth", 5),
            parsimony_coefficient=config.get("parsimony_coefficient", 0.001),
        )
        
        # Restore state
        engine.restore_from_checkpoint(checkpoint_state)
        
        running_engines[session_id] = engine
        evolution_sessions[session_id]["status"] = "running"
        
        # Callback for updates
        async def on_update(update: Dict[str, Any]):
            await send_evolution_update(session_id, update)
            evolution_sessions[session_id].update({
                "current_generation": update.get("generation", 0),
                "elapsed_time": update.get("elapsed_time", 0),
                "best_fitness": update.get("best", {}).get("fitness"),
                "best_equation": update.get("best", {}).get("equation"),
                "hall_of_fame": update.get("hall_of_fame", []),
            })
        
        # Run evolution
        results = await engine.evolve(callback=on_update)
        
        # Update final results
        evolution_sessions[session_id].update({
            "status": results["status"],
            "elapsed_time": results.get("elapsed_time", 0),
            "hall_of_fame": results["hall_of_fame"],
            "pareto_front": results["pareto_front"],
            "best_equation": results["best_equation"],
            "best_fitness": results["best_fitness"],
        })
        
        await send_evolution_update(session_id, {
            "type": "evolution_stopped",
            "status": results["status"],
            "hall_of_fame": results["hall_of_fame"],
            "pareto_front": results["pareto_front"],
        })
        
    except Exception as e:
        evolution_sessions[session_id]["status"] = "error"
        evolution_sessions[session_id]["error"] = str(e)
        await send_evolution_update(session_id, {
            "type": "error",
            "message": str(e)
        })
    finally:
        if session_id in running_engines:
            del running_engines[session_id]
