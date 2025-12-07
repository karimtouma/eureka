"""Checkpoint system for saving and restoring evolution state."""
import os
import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

# Default checkpoint directory
CHECKPOINT_DIR = Path(__file__).parent.parent / "checkpoints"


class CheckpointManager:
    """Manages saving and loading evolution checkpoints."""
    
    def __init__(self, checkpoint_dir: Optional[Path] = None):
        self.checkpoint_dir = checkpoint_dir or CHECKPOINT_DIR
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"CheckpointManager initialized with dir: {self.checkpoint_dir}")
    
    def _get_checkpoint_path(self, checkpoint_id: str) -> Path:
        """Get full path for a checkpoint."""
        return self.checkpoint_dir / f"{checkpoint_id}.pkl"
    
    def _get_metadata_path(self, checkpoint_id: str) -> Path:
        """Get path for checkpoint metadata."""
        return self.checkpoint_dir / f"{checkpoint_id}.json"
    
    def save_checkpoint(
        self,
        session_id: str,
        state: Dict[str, Any],
        name: Optional[str] = None
    ) -> str:
        """
        Save a checkpoint to disk.
        
        Args:
            session_id: Evolution session ID
            state: State dictionary from GPEngine.get_checkpoint_state()
            name: Optional human-readable name for checkpoint
            
        Returns:
            checkpoint_id: Unique identifier for this checkpoint
        """
        timestamp = datetime.now()
        checkpoint_id = f"{session_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
        
        # Save binary state with pickle
        checkpoint_path = self._get_checkpoint_path(checkpoint_id)
        try:
            with open(checkpoint_path, 'wb') as f:
                pickle.dump(state, f, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as e:
            logger.error(f"Failed to save checkpoint state: {e}")
            raise
        
        # Save metadata as JSON
        metadata = {
            "checkpoint_id": checkpoint_id,
            "session_id": session_id,
            "name": name or f"Checkpoint at generation {state.get('generation', 0)}",
            "created_at": timestamp.isoformat(),
            "generation": state.get("generation", 0),
            "config": state.get("config", {}),
            "data_info": state.get("data_info", {}),
            "file_size_bytes": os.path.getsize(checkpoint_path),
        }
        
        metadata_path = self._get_metadata_path(checkpoint_id)
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved checkpoint {checkpoint_id} at generation {state.get('generation', 0)}")
        return checkpoint_id
    
    def load_checkpoint(self, checkpoint_id: str) -> Dict[str, Any]:
        """
        Load a checkpoint from disk.
        
        Args:
            checkpoint_id: Unique identifier for the checkpoint
            
        Returns:
            state: State dictionary to pass to GPEngine.restore_from_checkpoint()
        """
        checkpoint_path = self._get_checkpoint_path(checkpoint_id)
        
        if not checkpoint_path.exists():
            raise FileNotFoundError(f"Checkpoint not found: {checkpoint_id}")
        
        try:
            with open(checkpoint_path, 'rb') as f:
                state = pickle.load(f)
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            raise
        
        logger.info(f"Loaded checkpoint {checkpoint_id}")
        return state
    
    def list_checkpoints(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all available checkpoints.
        
        Args:
            session_id: Optional filter by session ID
            
        Returns:
            List of checkpoint metadata dictionaries
        """
        checkpoints = []
        
        for metadata_file in self.checkpoint_dir.glob("*.json"):
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                # Filter by session if specified
                if session_id and metadata.get("session_id") != session_id:
                    continue
                
                # Verify checkpoint file exists
                checkpoint_id = metadata.get("checkpoint_id")
                if checkpoint_id and self._get_checkpoint_path(checkpoint_id).exists():
                    checkpoints.append(metadata)
                    
            except Exception as e:
                logger.warning(f"Failed to read metadata {metadata_file}: {e}")
                continue
        
        # Sort by creation time, newest first
        checkpoints.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return checkpoints
    
    def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """
        Delete a checkpoint.
        
        Args:
            checkpoint_id: Unique identifier for the checkpoint
            
        Returns:
            True if deleted, False if not found
        """
        checkpoint_path = self._get_checkpoint_path(checkpoint_id)
        metadata_path = self._get_metadata_path(checkpoint_id)
        
        deleted = False
        
        if checkpoint_path.exists():
            checkpoint_path.unlink()
            deleted = True
        
        if metadata_path.exists():
            metadata_path.unlink()
            deleted = True
        
        if deleted:
            logger.info(f"Deleted checkpoint {checkpoint_id}")
        
        return deleted
    
    def cleanup_old_checkpoints(
        self,
        session_id: str,
        keep_count: int = 5
    ) -> int:
        """
        Clean up old checkpoints, keeping only the most recent ones.
        
        Args:
            session_id: Session ID to clean up
            keep_count: Number of checkpoints to keep
            
        Returns:
            Number of checkpoints deleted
        """
        checkpoints = self.list_checkpoints(session_id)
        
        if len(checkpoints) <= keep_count:
            return 0
        
        # Delete older checkpoints
        to_delete = checkpoints[keep_count:]
        deleted = 0
        
        for cp in to_delete:
            if self.delete_checkpoint(cp["checkpoint_id"]):
                deleted += 1
        
        return deleted


# Global checkpoint manager instance
checkpoint_manager = CheckpointManager()


def get_checkpoint_manager() -> CheckpointManager:
    """Get the global checkpoint manager instance."""
    return checkpoint_manager

