from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from datetime import datetime, timedelta
from jose import JWTError, jwt
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import random

# Import database models and functions
from database import get_db, Metrics, RobotPosition, RobotIMU, RobotHealth
from sqlalchemy.orm import Session

# Load environment variables
load_dotenv()

# ==================== CONFIG ====================
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

DUMMY_USER = {
    "email": "admin@gmail.com",
    "password": "1234"
}

# ==================== PYDANTIC MODELS ====================
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class RobotPose(BaseModel):
    x: float
    y: float


class IMUData(BaseModel):
    accel_x: float
    accel_y: float
    accel_z: float


class HealthMetrics(BaseModel):
    status: str
    uptime_hours: float


class LatencyMetrics(BaseModel):
    avg_latency: float
    min_latency: float
    max_latency: float
    pose_message_count: int
    imu_message_count: int


# ==================== SECURITY ====================
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials = Depends(HTTPBearer())):
    """Verify JWT token"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return email
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


# ==================== FASTAPI APP ====================
app = FastAPI(title="Cloud Robot Monitoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== PUBLIC ROUTES ====================
@app.get("/health")
async def health_check():
    """Public health check"""
    return {"status": "Server is running"}


# ==================== AUTH ROUTES ====================
@app.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Login endpoint - returns JWT token"""
    if request.email != DUMMY_USER["email"] or request.password != DUMMY_USER["password"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": request.email},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# ==================== PROTECTED ROUTES ====================

@app.get("/api/metrics/health", response_model=HealthMetrics)
async def get_health(
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get robot health metrics"""
    # Get latest health record from database
    latest = db.query(RobotHealth).filter_by(robot_id="robot-001").order_by(
        RobotHealth.timestamp.desc()
    ).first()
    
    if latest:
        return {
            "status": latest.status,
            "uptime_hours": latest.uptime_hours
        }
    
    # Fallback if no data in database
    return {
        "status": "Online",
        "uptime_hours": 48.5
    }


@app.get("/api/metrics/latency", response_model=LatencyMetrics)
async def get_latency(
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get latency metrics"""
    # Get latest metrics from database
    latest = db.query(Metrics).filter_by(robot_id="robot-001").order_by(
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
    
    # Fallback if no data in database
    return {
        "avg_latency": 42.5,
        "min_latency": 12.3,
        "max_latency": 98.7,
        "pose_message_count": 1250,
        "imu_message_count": 3450
    }


@app.get("/api/robot/{robot_id}/pose", response_model=RobotPose)
async def get_robot_pose(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get robot X-Y position"""
    latest = db.query(RobotPosition).filter_by(robot_id=robot_id).order_by(
        RobotPosition.timestamp.desc()
    ).first()
    
    if latest:
        return {
            "x": latest.x,
            "y": latest.y
        }
    
    # Fallback
    return {
        "x": random.uniform(0, 100),
        "y": random.uniform(-50, 50)
    }


@app.get("/api/robot/{robot_id}/imu", response_model=IMUData)
async def get_robot_imu(
    robot_id: str,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get IMU acceleration data"""
    latest = db.query(RobotIMU).filter_by(robot_id=robot_id).order_by(
        RobotIMU.timestamp.desc()
    ).first()
    
    if latest:
        return {
            "accel_x": latest.accel_x,
            "accel_y": latest.accel_y,
            "accel_z": latest.accel_z
        }
    
    # Fallback
    return {
        "accel_x": random.uniform(-2, 2),
        "accel_y": random.uniform(-2, 2),
        "accel_z": 9.8
    }


# ==================== DATA SAVING ENDPOINT ====================

@app.post("/api/data/save")
async def save_data(
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Save simulated data to database"""
    
    # Generate realistic data
    metrics = Metrics(
        robot_id="robot-001",
        avg_latency=random.uniform(30, 50),
        min_latency=random.uniform(10, 20),
        max_latency=random.uniform(80, 100),
        pose_message_count=random.randint(1000, 1500),
        imu_message_count=random.randint(3000, 4000)
    )
    
    position = RobotPosition(
        robot_id="robot-001",
        x=random.uniform(0, 100),
        y=random.uniform(-50, 50)
    )
    
    imu = RobotIMU(
        robot_id="robot-001",
        accel_x=random.uniform(-2, 2),
        accel_y=random.uniform(-2, 2),
        accel_z=9.8 + random.uniform(-0.5, 0.5)
    )
    
    health = RobotHealth(
        robot_id="robot-001",
        status="Online",
        uptime_hours=random.uniform(40, 50)
    )
    
    # Save to database
    db.add(metrics)
    db.add(position)
    db.add(imu)
    db.add(health)
    db.commit()
    
    return {"message": "Data saved successfully"}


# ==================== HISTORICAL DATA ENDPOINTS ====================

@app.get("/api/metrics/history")
async def get_metrics_history(
    robot_id: str = "robot-001",
    hours: int = 24,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get historical metrics data"""
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    records = db.query(Metrics).filter(
        Metrics.robot_id == robot_id,
        Metrics.timestamp >= cutoff_time
    ).order_by(Metrics.timestamp).all()
    
    return {
        "timestamps": [r.timestamp.isoformat() for r in records],
        "avg_latency": [r.avg_latency for r in records],
        "min_latency": [r.min_latency for r in records],
        "max_latency": [r.max_latency for r in records],
        "pose_count": [r.pose_message_count for r in records],
        "imu_count": [r.imu_message_count for r in records],
        "record_count": len(records)
    }


@app.get("/api/robot/{robot_id}/position/history")
async def get_position_history(
    robot_id: str,
    hours: int = 24,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get historical position data"""
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    records = db.query(RobotPosition).filter(
        RobotPosition.robot_id == robot_id,
        RobotPosition.timestamp >= cutoff_time
    ).order_by(RobotPosition.timestamp).all()
    
    return {
        "timestamps": [r.timestamp.isoformat() for r in records],
        "x_values": [r.x for r in records],
        "y_values": [r.y for r in records],
        "record_count": len(records)
    }


@app.get("/api/robot/{robot_id}/imu/history")
async def get_imu_history(
    robot_id: str,
    hours: int = 24,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get historical IMU data"""
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    records = db.query(RobotIMU).filter(
        RobotIMU.robot_id == robot_id,
        RobotIMU.timestamp >= cutoff_time
    ).order_by(RobotIMU.timestamp).all()
    
    return {
        "timestamps": [r.timestamp.isoformat() for r in records],
        "accel_x": [r.accel_x for r in records],
        "accel_y": [r.accel_y for r in records],
        "accel_z": [r.accel_z for r in records],
        "record_count": len(records)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)