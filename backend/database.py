from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from .env
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/robot_monitoring")

# Create database engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# ==================== DATABASE MODELS ====================

class Metrics(Base):
    """Store network latency metrics"""
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    avg_latency = Column(Float)
    min_latency = Column(Float)
    max_latency = Column(Float)
    pose_message_count = Column(Integer)
    imu_message_count = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('idx_robot_timestamp', 'robot_id', 'timestamp'),)


class RobotPosition(Base):
    """Store robot X-Y coordinates"""
    __tablename__ = "robot_position"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    x = Column(Float)
    y = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('idx_robot_timestamp', 'robot_id', 'timestamp'),)


class RobotIMU(Base):
    """Store IMU acceleration data"""
    __tablename__ = "robot_imu"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    accel_x = Column(Float)
    accel_y = Column(Float)
    accel_z = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('idx_robot_timestamp', 'robot_id', 'timestamp'),)


class RobotHealth(Base):
    """Store robot health status"""
    __tablename__ = "robot_health"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    status = Column(String(50))
    uptime_hours = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (Index('idx_robot_timestamp', 'robot_id', 'timestamp'),)


class Robot(Base):
    """Store robot registry"""
    __tablename__ = "robots"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), unique=True, index=True)
    name = Column(String(100))
    location = Column(String(100))
    status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

class Alert(Base):
    """Store alert history"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    alert_type = Column(String(50))
    metric_name = Column(String(100))
    threshold = Column(Float)
    current_value = Column(Float)
    severity = Column(String(20))  # 'info', 'warning', 'critical'
    message = Column(String(500))
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AlertRule(Base):
    """Store alert threshold rules"""
    __tablename__ = "alert_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    metric_name = Column(String(100))
    threshold_type = Column(String(20))  # 'greater_than', 'less_than'
    threshold_value = Column(Float)
    severity = Column(String(20))
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create all tables
Base.metadata.create_all(bind=engine)


# Dependency for FastAPI to get database session
def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()