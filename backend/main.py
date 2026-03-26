from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import random
import asyncio
import logging
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import database models and functions
from database import get_db, Metrics, RobotPosition, RobotIMU, RobotHealth, Robot, Alert, AlertRule
from websocket_manager import manager
from alertmanager import AlertManager
from sqlalchemy.orm import Session

# Load environment variables
load_dotenv()

# ==================== LOGGING SETUP ====================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== CONFIG ====================
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

DUMMY_USER = {
    "email": "admin@gmail.com",
    "password": "1234"
}

# ==================== PYDANTIC MODELS ====================
class LoginRequest(BaseModel):
    """Login request model"""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Token response model"""
    access_token: str
    token_type: str


class RobotPose(BaseModel):
    """Robot position model"""
    x: float
    y: float


class IMUData(BaseModel):
    """IMU data model"""
    accel_x: float
    accel_y: float
    accel_z: float


class HealthMetrics(BaseModel):
    """Health metrics model"""
    status: str
    uptime_hours: float


class LatencyMetrics(BaseModel):
    """Latency metrics model"""
    avg_latency: float
    min_latency: float
    max_latency: float
    pose_message_count: int
    imu_message_count: int


class RobotInfo(BaseModel):
    """Robot info model"""
    robot_id: str
    name: str
    location: str
    status: str


class RobotListResponse(BaseModel):
    """Robot list response model"""
    robots: List[RobotInfo]
    total: int


class AlertResponse(BaseModel):
    """Alert response model"""
    id: int
    robot_id: str
    metric_name: str
    severity: str
    message: str
    created_at: str


class AlertRuleResponse(BaseModel):
    """Alert rule response model"""
    id: int
    robot_id: str
    metric_name: str
    threshold_type: str
    threshold_value: float
    severity: str
    enabled: bool


# ==================== SECURITY ====================
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT token
    
    Args:
        data: Dictionary with token data
        expires_delta: Token expiration time delta
    
    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials = Depends(HTTPBearer())) -> str:
    """
    Verify JWT token from request
    
    Args:
        credentials: HTTP Bearer token credentials
    
    Returns:
        Email from token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return email
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


def verify_websocket_token(token: str) -> Optional[str]:
    """
    Verify JWT token for WebSocket
    
    Args:
        token: JWT token string
    
    Returns:
        Email from token payload or None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        return email
    except JWTError as e:
        logger.error(f"WebSocket JWT verification failed: {e}")
        return None


# ==================== FASTAPI APP ====================
app = FastAPI(
    title="Cloud Robot Monitoring API",
    description="Real-time monitoring system for cloud-based robots with alerts and multi-robot support",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== PUBLIC ROUTES ====================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Public health check endpoint
    
    Returns:
        Server status and timestamp
    """
    return {
        "status": "Server is running",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0"
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Cloud Robot Monitoring API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/login",
            "robots": "/api/robots",
            "metrics": "/api/metrics/",
            "alerts": "/api/alerts/",
            "websocket": "/ws"
        }
    }


# ==================== AUTH ROUTES ====================

@app.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(request: LoginRequest):
    """
    Login endpoint - returns JWT token
    
    Test credentials:
    - email: admin@gmail.com
    - password: 1234
    
    Args:
        request: Login credentials
    
    Returns:
        JWT token for authenticated requests
    
    Raises:
        HTTPException: If credentials are invalid
    """
    logger.info(f"Login attempt for email: {request.email}")
    
    if request.email != DUMMY_USER["email"] or request.password != DUMMY_USER["password"]:
        logger.warning(f"Failed login attempt for email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": request.email},
        expires_delta=access_token_expires
    )
    
    logger.info(f"Successful login for email: {request.email}")
    
    return {"access_token": access_token, "token_type": "bearer"}


# ==================== ROBOT MANAGEMENT ROUTES ====================

@app.get("/api/robots", response_model=RobotListResponse, tags=["Robots"])
async def list_robots(
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get list of all robots
    
    Args:
        email: Authenticated user email
        db: Database session
    
    Returns:
        List of robots with their current status
    """
    try:
        robots = db.query(Robot).all()
        logger.info(f"Fetching {len(robots)} robots for user {email}")
        
        robot_list = []
        for robot in robots:
            # Get latest health status
            latest_health = db.query(RobotHealth).filter_by(robot_id=robot.robot_id).order_by(
                RobotHealth.timestamp.desc()
            ).first()
            
            robot_list.append({
                "robot_id": robot.robot_id,
                "name": robot.name,
                "location": robot.location,
                "status": latest_health.status if latest_health else robot.status,
            })
        
        return {
            "robots": robot_list,
            "total": len(robot_list)
        }
    except Exception as e:
        logger.error(f"Error fetching robots: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch robots")


@app.post("/api/robots", tags=["Robots"])
async def create_robot(
    robot_data: RobotInfo,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Create a new robot
    
    Args:
        robot_data: Robot information
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation message with robot ID
    
    Raises:
        HTTPException: If robot already exists
    """
    try:
        # Check if robot already exists
        existing = db.query(Robot).filter_by(robot_id=robot_data.robot_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Robot already exists")
        
        new_robot = Robot(
            robot_id=robot_data.robot_id,
            name=robot_data.name,
            location=robot_data.location,
            status=robot_data.status
        )
        
        db.add(new_robot)
        db.commit()
        
        logger.info(f"Robot created: {new_robot.robot_id} by user {email}")
        
        return {
            "message": "Robot created successfully",
            "robot_id": new_robot.robot_id,
            "name": new_robot.name
        }
    except Exception as e:
        logger.error(f"Error creating robot: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create robot")


@app.delete("/api/robots/{robot_id}", tags=["Robots"])
async def delete_robot(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Delete a robot
    
    Args:
        robot_id: ID of robot to delete
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation message
    
    Raises:
        HTTPException: If robot not found
    """
    try:
        robot = db.query(Robot).filter_by(robot_id=robot_id).first()
        if not robot:
            raise HTTPException(status_code=404, detail="Robot not found")
        
        db.delete(robot)
        db.commit()
        
        logger.info(f"Robot deleted: {robot_id} by user {email}")
        
        return {"message": "Robot deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting robot: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete robot")


# ==================== WEBSOCKET ROUTE ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, robot_id: str = Query("robot-001")):
    """
    WebSocket endpoint for real-time data streaming
    
    Connection parameters:
    - token: JWT token for authentication (required)
    - robot_id: Robot ID to stream data for (default: robot-001)
    
    Messages:
    - ping: Keep-alive message, responds with pong
    - get_data: Request current data for robot
    - select_robot:ROBOT_ID: Switch to different robot
    
    Broadcasts:
    - metrics_update: Real-time metrics data
    - data_response: Response to get_data request
    """
    
    # Get token from query parameter
    token = websocket.query_params.get("token")
    if not token or not verify_websocket_token(token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        logger.warning("WebSocket connection rejected: Invalid token")
        return
    
    # Connect client
    await manager.connect(websocket)
    logger.info(f"WebSocket client connected for robot: {robot_id}")
    
    try:
        while True:
            # Receive message (keep connection alive)
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_text("pong")
            
            elif data == "get_data":
                # Client requested data
                try:
                    db = next(get_db())
                    
                    latest_metrics = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
                        Metrics.timestamp.desc()
                    ).first()
                    
                    latest_position = db.query(RobotPosition).filter_by(robot_id=robot_id).order_by(
                        RobotPosition.timestamp.desc()
                    ).first()
                    
                    latest_imu = db.query(RobotIMU).filter_by(robot_id=robot_id).order_by(
                        RobotIMU.timestamp.desc()
                    ).first()
                    
                    latest_health = db.query(RobotHealth).filter_by(robot_id=robot_id).order_by(
                        RobotHealth.timestamp.desc()
                    ).first()
                    
                    message = {
                        "type": "data_response",
                        "robot_id": robot_id,
                        "data": {
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
                    }
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error in get_data: {e}")
            
            elif data.startswith("select_robot:"):
                # Change robot
                new_robot_id = data.split(":", 1)[1]
                robot_id = new_robot_id
                logger.info(f"WebSocket robot changed to: {robot_id}")
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected for robot: {robot_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# ==================== PROTECTED ROUTES ====================

@app.get("/api/metrics/health", response_model=HealthMetrics, tags=["Metrics"])
async def get_health(
    robot_id: str = Query("robot-001"),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get robot health metrics
    
    Args:
        robot_id: Robot ID (default: robot-001)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Robot health status and uptime
    """
    try:
        latest = db.query(RobotHealth).filter_by(robot_id=robot_id).order_by(
            RobotHealth.timestamp.desc()
        ).first()
        
        if latest:
            return {
                "status": latest.status,
                "uptime_hours": latest.uptime_hours
            }
        
        return {
            "status": "Online",
            "uptime_hours": 48.5
        }
    except Exception as e:
        logger.error(f"Error fetching health metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch health metrics")


@app.get("/api/metrics/latency", response_model=LatencyMetrics, tags=["Metrics"])
async def get_latency(
    robot_id: str = Query("robot-001"),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get latency metrics
    
    Args:
        robot_id: Robot ID (default: robot-001)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Latency statistics and message counts
    """
    try:
        latest = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
            Metrics.timestamp.desc()
        ).first()
        
        if latest:
            return {
                "avg_latency": latest.avg_latency,
                "min_latency": latest.min_latency,
                "max_latency": latest.max_latency,
                "pose_message_count": latest.pose_message_count,
                "imu_message_count": latest.imu_message_count
            }
        
        return {
            "avg_latency": 42.5,
            "min_latency": 12.3,
            "max_latency": 98.7,
            "pose_message_count": 1250,
            "imu_message_count": 3450
        }
    except Exception as e:
        logger.error(f"Error fetching latency metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch latency metrics")


@app.get("/api/robot/{robot_id}/pose", response_model=RobotPose, tags=["Metrics"])
async def get_robot_pose(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get robot X-Y position
    
    Args:
        robot_id: Robot ID
        email: Authenticated user email
        db: Database session
    
    Returns:
        Robot coordinates (x, y)
    """
    try:
        latest = db.query(RobotPosition).filter_by(robot_id=robot_id).order_by(
            RobotPosition.timestamp.desc()
        ).first()
        
        if latest:
            return {
                "x": latest.x,
                "y": latest.y
            }
        
        return {
            "x": random.uniform(0, 100),
            "y": random.uniform(-50, 50)
        }
    except Exception as e:
        logger.error(f"Error fetching pose data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch pose data")


@app.get("/api/robot/{robot_id}/imu", response_model=IMUData, tags=["Metrics"])
async def get_robot_imu(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get IMU acceleration data
    
    Args:
        robot_id: Robot ID
        email: Authenticated user email
        db: Database session
    
    Returns:
        IMU acceleration on X, Y, Z axes
    """
    try:
        latest = db.query(RobotIMU).filter_by(robot_id=robot_id).order_by(
            RobotIMU.timestamp.desc()
        ).first()
        
        if latest:
            return {
                "accel_x": latest.accel_x,
                "accel_y": latest.accel_y,
                "accel_z": latest.accel_z
            }
        
        return {
            "accel_x": random.uniform(-2, 2),
            "accel_y": random.uniform(-2, 2),
            "accel_z": 9.8
        }
    except Exception as e:
        logger.error(f"Error fetching IMU data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch IMU data")


# ==================== DATA SAVING ENDPOINT ====================

@app.post("/api/data/save", tags=["Data"])
async def save_data(
    robot_id: str = Query("robot-001"),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Save simulated data to database and check for alerts
    
    Args:
        robot_id: Robot ID (default: robot-001)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation with any triggered alerts
    """
    try:
        # Generate realistic data
        metrics = Metrics(
            robot_id=robot_id,
            avg_latency=random.uniform(30, 50),
            min_latency=random.uniform(10, 20),
            max_latency=random.uniform(80, 100),
            pose_message_count=random.randint(1000, 1500),
            imu_message_count=random.randint(3000, 4000)
        )
        
        position = RobotPosition(
            robot_id=robot_id,
            x=random.uniform(0, 100),
            y=random.uniform(-50, 50)
        )
        
        imu = RobotIMU(
            robot_id=robot_id,
            accel_x=random.uniform(-2, 2),
            accel_y=random.uniform(-2, 2),
            accel_z=9.8 + random.uniform(-0.5, 0.5)
        )
        
        health = RobotHealth(
            robot_id=robot_id,
            status="Online",
            uptime_hours=random.uniform(40, 50)
        )
        
        db.add(metrics)
        db.add(position)
        db.add(imu)
        db.add(health)
        db.commit()
        
        # Check for alert violations
        triggered_alerts = AlertManager.check_metrics(db, robot_id)
        
        logger.info(f"Data saved for {robot_id}. Alerts triggered: {len(triggered_alerts)}")
        
        return {
            "message": "Data saved successfully",
            "robot_id": robot_id,
            "timestamp": datetime.utcnow().isoformat(),
            "alerts_triggered": len(triggered_alerts),
            "triggered_alerts": triggered_alerts
        }
    except Exception as e:
        logger.error(f"Error saving data: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save data")


# ==================== HISTORICAL DATA ENDPOINTS ====================

@app.get("/api/metrics/history", tags=["History"])
async def get_metrics_history(
    robot_id: str = Query("robot-001"),
    hours: int = Query(24, ge=1, le=720),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get historical metrics data
    
    Args:
        robot_id: Robot ID (default: robot-001)
        hours: Number of hours to retrieve (1-720, default: 24)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Historical metrics data with timestamps
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        records = db.query(Metrics).filter(
            Metrics.robot_id == robot_id,
            Metrics.timestamp >= cutoff_time
        ).order_by(Metrics.timestamp).all()
        
        logger.info(f"Fetched {len(records)} historical metrics for {robot_id} ({hours}h)")
        
        return {
            "robot_id": robot_id,
            "hours": hours,
            "timestamps": [r.timestamp.isoformat() for r in records],
            "avg_latency": [r.avg_latency for r in records],
            "min_latency": [r.min_latency for r in records],
            "max_latency": [r.max_latency for r in records],
            "pose_count": [r.pose_message_count for r in records],
            "imu_count": [r.imu_message_count for r in records],
            "record_count": len(records)
        }
    except Exception as e:
        logger.error(f"Error fetching metrics history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch metrics history")


@app.get("/api/robot/{robot_id}/position/history", tags=["History"])
async def get_position_history(
    robot_id: str,
    hours: int = Query(24, ge=1, le=720),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get historical position data
    
    Args:
        robot_id: Robot ID
        hours: Number of hours to retrieve (1-720, default: 24)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Historical position data with timestamps
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        records = db.query(RobotPosition).filter(
            RobotPosition.robot_id == robot_id,
            RobotPosition.timestamp >= cutoff_time
        ).order_by(RobotPosition.timestamp).all()
        
        logger.info(f"Fetched {len(records)} historical positions for {robot_id} ({hours}h)")
        
        return {
            "robot_id": robot_id,
            "hours": hours,
            "timestamps": [r.timestamp.isoformat() for r in records],
            "x_values": [r.x for r in records],
            "y_values": [r.y for r in records],
            "record_count": len(records)
        }
    except Exception as e:
        logger.error(f"Error fetching position history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch position history")


@app.get("/api/robot/{robot_id}/imu/history", tags=["History"])
async def get_imu_history(
    robot_id: str,
    hours: int = Query(24, ge=1, le=720),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get historical IMU data
    
    Args:
        robot_id: Robot ID
        hours: Number of hours to retrieve (1-720, default: 24)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Historical IMU acceleration data with timestamps
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        records = db.query(RobotIMU).filter(
            RobotIMU.robot_id == robot_id,
            RobotIMU.timestamp >= cutoff_time
        ).order_by(RobotIMU.timestamp).all()
        
        logger.info(f"Fetched {len(records)} historical IMU records for {robot_id} ({hours}h)")
        
        return {
            "robot_id": robot_id,
            "hours": hours,
            "timestamps": [r.timestamp.isoformat() for r in records],
            "accel_x": [r.accel_x for r in records],
            "accel_y": [r.accel_y for r in records],
            "accel_z": [r.accel_z for r in records],
            "record_count": len(records)
        }
    except Exception as e:
        logger.error(f"Error fetching IMU history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch IMU history")


# ==================== COMPARISON ENDPOINTS ====================

@app.get("/api/metrics/compare", tags=["Comparison"])
async def compare_robots(
    robot_ids: str = Query("robot-001,robot-002"),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Compare metrics across multiple robots
    
    Args:
        robot_ids: Comma-separated robot IDs
        email: Authenticated user email
        db: Database session
    
    Returns:
        Comparison of metrics for all specified robots
    """
    try:
        robot_list = [rid.strip() for rid in robot_ids.split(",")]
        comparison = {}
        
        for robot_id in robot_list:
            latest = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
                Metrics.timestamp.desc()
            ).first()
            
            if latest:
                comparison[robot_id] = {
                    "avg_latency": latest.avg_latency,
                    "min_latency": latest.min_latency,
                    "max_latency": latest.max_latency,
                    "pose_count": latest.pose_message_count,
                    "imu_count": latest.imu_message_count,
                    "timestamp": latest.timestamp.isoformat()
                }
        
        logger.info(f"Compared {len(comparison)} robots")
        
        return {
            "comparison": comparison,
            "robots_compared": len(comparison),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error comparing robots: {e}")
        raise HTTPException(status_code=500, detail="Failed to compare robots")


# ==================== ALERT ROUTES ====================

@app.get("/api/alerts/active", tags=["Alerts"])
async def get_active_alerts(
    robot_id: str = Query(None),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get all active (unacknowledged) alerts
    
    Args:
        robot_id: Optional robot ID to filter by
        email: Authenticated user email
        db: Database session
    
    Returns:
        List of active alerts with statistics
    """
    try:
        alerts = AlertManager.get_active_alerts(db, robot_id)
        
        critical_count = sum(1 for a in alerts if a['severity'] == 'critical')
        warning_count = sum(1 for a in alerts if a['severity'] == 'warning')
        info_count = sum(1 for a in alerts if a['severity'] == 'info')
        
        logger.info(f"Fetched {len(alerts)} active alerts for user {email}")
        
        return {
            "alerts": alerts,
            "total": len(alerts),
            "critical_count": critical_count,
            "warning_count": warning_count,
            "info_count": info_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching active alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch active alerts")


@app.get("/api/alerts/history", tags=["Alerts"])
async def get_alert_history(
    robot_id: str = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get alert history
    
    Args:
        robot_id: Optional robot ID to filter by
        limit: Maximum number of alerts to return (1-1000, default: 100)
        email: Authenticated user email
        db: Database session
    
    Returns:
        List of historical alerts
    """
    try:
        history = AlertManager.get_alert_history(db, robot_id, limit)
        
        logger.info(f"Fetched {len(history)} alert history records for user {email}")
        
        return {
            "history": history,
            "total": len(history),
            "showing": min(limit, len(history)),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching alert history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch alert history")


@app.post("/api/alerts/{alert_id}/acknowledge", tags=["Alerts"])
async def acknowledge_alert(
    alert_id: int,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert
    
    Args:
        alert_id: ID of alert to acknowledge
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation message
    
    Raises:
        HTTPException: If alert not found
    """
    try:
        success = AlertManager.acknowledge_alert(db, alert_id, email)
        
        if not success:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        logger.info(f"Alert {alert_id} acknowledged by {email}")
        
        return {
            "message": "Alert acknowledged",
            "alert_id": alert_id,
            "acknowledged_by": email,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to acknowledge alert")


@app.get("/api/alert-rules", tags=["Alerts"])
async def get_alert_rules(
    robot_id: str = Query(None),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get alert rules
    
    Args:
        robot_id: Optional robot ID to filter by
        email: Authenticated user email
        db: Database session
    
    Returns:
        List of alert rules
    """
    try:
        rules = AlertManager.get_alert_rules(db, robot_id)
        
        logger.info(f"Fetched {len(rules)} alert rules for user {email}")
        
        return {
            "rules": rules,
            "total": len(rules),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching alert rules: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch alert rules")


@app.post("/api/alert-rules", tags=["Alerts"])
async def create_alert_rule(
    robot_id: str = Query(...),
    metric_name: str = Query(...),
    threshold_type: str = Query(...),
    threshold_value: float = Query(...),
    severity: str = Query(...),
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Create a new alert rule
    
    Args:
        robot_id: Robot ID for rule
        metric_name: Name of metric to monitor
        threshold_type: Type of threshold (greater_than, less_than)
        threshold_value: Threshold value
        severity: Alert severity level (info, warning, critical)
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation with rule ID
    
    Raises:
        HTTPException: If rule creation fails
    """
    try:
        rule = AlertManager.create_alert_rule(
            db, robot_id, metric_name, threshold_type, threshold_value, severity
        )
        
        logger.info(f"Alert rule created for {robot_id} by user {email}")
        
        return {
            "message": "Alert rule created",
            "rule_id": rule.id,
            "robot_id": robot_id,
            "metric_name": metric_name,
            "threshold_type": threshold_type,
            "threshold_value": threshold_value,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating alert rule: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create alert rule")


@app.delete("/api/alert-rules/{rule_id}", tags=["Alerts"])
async def delete_alert_rule(
    rule_id: int,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Delete an alert rule
    
    Args:
        rule_id: ID of rule to delete
        email: Authenticated user email
        db: Database session
    
    Returns:
        Confirmation message
    
    Raises:
        HTTPException: If rule not found
    """
    try:
        rule = db.query(AlertRule).filter_by(id=rule_id).first()
        
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        db.delete(rule)
        db.commit()
        
        logger.info(f"Alert rule {rule_id} deleted by user {email}")
        
        return {
            "message": "Alert rule deleted",
            "rule_id": rule_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error deleting alert rule: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete alert rule")


# ==================== STATS ENDPOINTS ====================

@app.get("/api/stats/overview", tags=["Statistics"])
async def get_overview_stats(
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get overall system statistics
    
    Args:
        email: Authenticated user email
        db: Database session
    
    Returns:
        System-wide statistics
    """
    try:
        # Get robot count
        robot_count = db.query(Robot).count()
        
        # Get metrics count
        metrics_count = db.query(Metrics).count()
        
        # Get active alerts
        active_alerts = db.query(Alert).filter_by(is_acknowledged=False).count()
        
        # Get critical alerts
        critical_alerts = db.query(Alert).filter(
            Alert.severity == 'critical',
            Alert.is_acknowledged == False
        ).count()
        
        logger.info(f"System stats fetched by user {email}")
        
        return {
            "total_robots": robot_count,
            "total_metrics_recorded": metrics_count,
            "active_alerts": active_alerts,
            "critical_alerts": critical_alerts,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching overview stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch overview stats")


@app.get("/api/stats/robot/{robot_id}", tags=["Statistics"])
async def get_robot_stats(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get statistics for a specific robot
    
    Args:
        robot_id: Robot ID
        email: Authenticated user email
        db: Database session
    
    Returns:
        Robot-specific statistics
    
    Raises:
        HTTPException: If robot not found
    """
    try:
        # Get robot info
        robot = db.query(Robot).filter_by(robot_id=robot_id).first()
        
        if not robot:
            raise HTTPException(status_code=404, detail="Robot not found")
        
        # Get latest metrics
        latest_metrics = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
            Metrics.timestamp.desc()
        ).first()
        
        # Get average metrics (last 24 hours)
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        metrics_24h = db.query(Metrics).filter(
            Metrics.robot_id == robot_id,
            Metrics.timestamp >= cutoff_time
        ).all()
        
        avg_latency = sum(m.avg_latency for m in metrics_24h) / len(metrics_24h) if metrics_24h else 0
        
        # Get alert count
        alert_count = db.query(Alert).filter_by(robot_id=robot_id).count()
        
        logger.info(f"Robot stats fetched for {robot_id} by user {email}")
        
        return {
            "robot_id": robot_id,
            "name": robot.name,
            "location": robot.location,
            "metrics_recorded_24h": len(metrics_24h),
            "average_latency_24h": round(avg_latency, 2),
            "latest_latency": round(latest_metrics.avg_latency, 2) if latest_metrics else None,
            "total_alerts": alert_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching robot stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch robot stats")


# ==================== ERROR HANDLERS ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    logger.error(f"HTTP Exception: {exc.detail}")
    return {
        "error": exc.detail,
        "status_code": exc.status_code,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"General Exception: {str(exc)}")
    return {
        "error": "Internal server error",
        "status_code": 500,
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    
    print("=" * 70)
    print("🚀 Cloud Robot Monitoring API v2.0.0")
    print("=" * 70)
    print(f"📍 Server: http://0.0.0.0:8000")
    print(f"📚 API Docs: http://localhost:8000/docs")
    print(f"🔐 Test Credentials:")
    print(f"   Email: {DUMMY_USER['email']}")
    print(f"   Password: {DUMMY_USER['password']}")
    print("=" * 70)
    print("Features:")
    print("  ✅ JWT Authentication")
    print("  ✅ Multi-Robot Management")
    print("  ✅ Real-time WebSocket Streaming")
    print("  ✅ Alert System with Thresholds")
    print("  ✅ Historical Data Analysis")
    print("  ✅ Robot Comparison")
    print("  ✅ Comprehensive Statistics")
    print("=" * 70)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)