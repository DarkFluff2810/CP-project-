from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
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


class RobotPosition(Base):
    """Store robot X-Y coordinates"""
    __tablename__ = "robot_position"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    x = Column(Float)
    y = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class RobotIMU(Base):
    """Store IMU acceleration data"""
    __tablename__ = "robot_imu"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    accel_x = Column(Float)
    accel_y = Column(Float)
    accel_z = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class RobotHealth(Base):
    """Store robot health status"""
    __tablename__ = "robot_health"
    
    id = Column(Integer, primary_key=True, index=True)
    robot_id = Column(String(50), index=True)
    status = Column(String(50))
    uptime_hours = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


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