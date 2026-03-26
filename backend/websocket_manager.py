from typing import Set
import asyncio
import json
from datetime import datetime
import random

class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Set = set()
    
    async def connect(self, websocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"✅ Client connected. Total clients: {len(self.active_connections)}")
    
    def disconnect(self, websocket):
        """Remove disconnected WebSocket"""
        self.active_connections.remove(websocket)
        print(f"❌ Client disconnected. Total clients: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Send message to all connected clients"""
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error sending to client: {e}")
                disconnected.add(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
    
    async def broadcast_metrics(self, db):
        """Broadcast real-time metrics to all clients"""
        from database import Metrics, RobotPosition, RobotIMU, RobotHealth
        
        while True:
            try:
                # Fetch latest data from database
                latest_metrics = db.query(Metrics).filter_by(robot_id="robot-001").order_by(
                    Metrics.timestamp.desc()
                ).first()
                
                latest_position = db.query(RobotPosition).filter_by(robot_id="robot-001").order_by(
                    RobotPosition.timestamp.desc()
                ).first()
                
                latest_imu = db.query(RobotIMU).filter_by(robot_id="robot-001").order_by(
                    RobotIMU.timestamp.desc()
                ).first()
                
                latest_health = db.query(RobotHealth).filter_by(robot_id="robot-001").order_by(
                    RobotHealth.timestamp.desc()
                ).first()
                
                # Prepare message
                message = {
                    "type": "metrics_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "avg_latency": latest_metrics.avg_latency if latest_metrics else 42.5,
                        "min_latency": latest_metrics.min_latency if latest_metrics else 12.3,
                        "max_latency": latest_metrics.max_latency if latest_metrics else 98.7,
                        "pose_message_count": latest_metrics.pose_message_count if latest_metrics else 1250,
                        "imu_message_count": latest_metrics.imu_message_count if latest_metrics else 3450,
                    },
                    "position": {
                        "x": latest_position.x if latest_position else random.uniform(0, 100),
                        "y": latest_position.y if latest_position else random.uniform(-50, 50),
                    },
                    "imu": {
                        "accel_x": latest_imu.accel_x if latest_imu else random.uniform(-2, 2),
                        "accel_y": latest_imu.accel_y if latest_imu else random.uniform(-2, 2),
                        "accel_z": latest_imu.accel_z if latest_imu else 9.8,
                    },
                    "health": {
                        "status": latest_health.status if latest_health else "Online",
                        "uptime_hours": latest_health.uptime_hours if latest_health else 48.5,
                    }
                }
                
                # Broadcast to all clients
                await self.broadcast(message)
                
                # Send every 2 seconds
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"Error in broadcast_metrics: {e}")
                await asyncio.sleep(2)


# Global connection manager
manager = ConnectionManager()