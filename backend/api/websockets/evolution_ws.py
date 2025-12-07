"""WebSocket endpoints for real-time evolution updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for evolution sessions."""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        logger.info(f"WebSocket connected for session {session_id}")
    
    def disconnect(self, websocket: WebSocket, session_id: str):
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        logger.info(f"WebSocket disconnected for session {session_id}")
    
    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send a message to a specific WebSocket."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
    
    async def broadcast(self, session_id: str, message: dict):
        """Broadcast a message to all connections for a session."""
        if session_id not in self.active_connections:
            return
        
        dead_connections = set()
        for connection in self.active_connections[session_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to connection: {e}")
                dead_connections.add(connection)
        
        # Clean up dead connections
        for conn in dead_connections:
            self.active_connections[session_id].discard(conn)
    
    def has_connections(self, session_id: str) -> bool:
        """Check if there are active connections for a session."""
        return session_id in self.active_connections and len(self.active_connections[session_id]) > 0


manager = ConnectionManager()


@router.websocket("/evolution/{session_id}")
async def evolution_websocket(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time evolution updates."""
    await manager.connect(websocket, session_id)
    
    try:
        # Send initial connection confirmation
        await manager.send_personal(websocket, {
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to evolution stream"
        })
        
        while True:
            try:
                # Wait for messages with timeout for heartbeat
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                try:
                    message = json.loads(data)
                except json.JSONDecodeError:
                    continue
                
                msg_type = message.get("type", "")
                
                if msg_type == "ping":
                    await manager.send_personal(websocket, {"type": "pong"})
                    
                elif msg_type == "start":
                    # Acknowledge start request
                    await manager.send_personal(websocket, {
                        "type": "evolution_started",
                        "session_id": session_id
                    })
                    
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                try:
                    await manager.send_personal(websocket, {"type": "heartbeat"})
                except:
                    break
                    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
    finally:
        manager.disconnect(websocket, session_id)


async def send_evolution_update(session_id: str, update: dict):
    """Send an evolution update to all connected clients for a session."""
    await manager.broadcast(session_id, update)


def get_manager() -> ConnectionManager:
    """Get the connection manager instance."""
    return manager
