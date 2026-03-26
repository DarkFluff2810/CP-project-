from datetime import datetime
from database import get_db, Alert, AlertRule, Metrics, RobotHealth
from sqlalchemy.orm import Session
from typing import List, Dict

class AlertManager:
    """Manage alert creation and checking"""
    
    @staticmethod
    def check_metrics(db: Session, robot_id: str):
        """Check if metrics violate any rules"""
        
        # Get latest metrics
        latest_metrics = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
            Metrics.timestamp.desc()
        ).first()
        
        if not latest_metrics:
            return []
        
        # Get alert rules for this robot
        rules = db.query(AlertRule).filter_by(robot_id=robot_id, enabled=True).all()
        
        triggered_alerts = []
        
        for rule in rules:
            current_value = None
            
            # Get current value based on metric name
            if rule.metric_name == 'avg_latency':
                current_value = latest_metrics.avg_latency
            elif rule.metric_name == 'min_latency':
                current_value = latest_metrics.min_latency
            elif rule.metric_name == 'max_latency':
                current_value = latest_metrics.max_latency
            elif rule.metric_name == 'pose_message_count':
                current_value = latest_metrics.pose_message_count
            elif rule.metric_name == 'imu_message_count':
                current_value = latest_metrics.imu_message_count
            
            if current_value is None:
                continue
            
            # Check if threshold is violated
            should_alert = False
            if rule.threshold_type == 'greater_than' and current_value > rule.threshold_value:
                should_alert = True
            elif rule.threshold_type == 'less_than' and current_value < rule.threshold_value:
                should_alert = True
            
            if should_alert:
                # Check if recent alert already exists
                recent_alert = db.query(Alert).filter(
                    Alert.robot_id == robot_id,
                    Alert.metric_name == rule.metric_name,
                    Alert.is_acknowledged == False
                ).order_by(Alert.created_at.desc()).first()
                
                # Only create new alert if no recent unacknowledged alert exists
                if not recent_alert:
                    message = f"{rule.metric_name} is {current_value} (threshold: {rule.threshold_value})"
                    
                    alert = Alert(
                        robot_id=robot_id,
                        alert_type='threshold_violation',
                        metric_name=rule.metric_name,
                        threshold=rule.threshold_value,
                        current_value=current_value,
                        severity=rule.severity,
                        message=message
                    )
                    
                    db.add(alert)
                    db.commit()
                    triggered_alerts.append({
                        'id': alert.id,
                        'robot_id': alert.robot_id,
                        'metric_name': alert.metric_name,
                        'current_value': alert.current_value,
                        'threshold': alert.threshold,
                        'severity': alert.severity,
                        'message': alert.message,
                    })
        
        return triggered_alerts
    
    @staticmethod
    def check_health_status(db: Session, robot_id: str):
        """Check if robot health status changed"""
        
        latest_health = db.query(RobotHealth).filter_by(robot_id=robot_id).order_by(
            RobotHealth.timestamp.desc()
        ).first()
        
        if not latest_health:
            return None
        
        # Check if there's a recent offline alert
        recent_offline_alert = db.query(Alert).filter(
            Alert.robot_id == robot_id,
            Alert.alert_type == 'status_change',
            Alert.severity == 'critical'
        ).order_by(Alert.created_at.desc()).first()
        
        if latest_health.status == 'Offline':
            # Create alert if no recent one exists
            if not recent_offline_alert:
                alert = Alert(
                    robot_id=robot_id,
                    alert_type='status_change',
                    metric_name='status',
                    severity='critical',
                    message=f"Robot {robot_id} is OFFLINE",
                    current_value=0
                )
                db.add(alert)
                db.commit()
                
                return {
                    'robot_id': robot_id,
                    'message': f"Robot {robot_id} is OFFLINE",
                    'severity': 'critical'
                }
        
        return None
    
    @staticmethod
    def get_active_alerts(db: Session, robot_id: str = None) -> List[Dict]:
        """Get all active (unacknowledged) alerts"""
        
        query = db.query(Alert).filter_by(is_acknowledged=False).order_by(
            Alert.created_at.desc()
        )
        
        if robot_id:
            query = query.filter_by(robot_id=robot_id)
        
        alerts = query.all()
        
        return [
            {
                'id': alert.id,
                'robot_id': alert.robot_id,
                'alert_type': alert.alert_type,
                'metric_name': alert.metric_name,
                'threshold': alert.threshold,
                'current_value': alert.current_value,
                'severity': alert.severity,
                'message': alert.message,
                'created_at': alert.created_at.isoformat(),
            }
            for alert in alerts
        ]
    
    @staticmethod
    def acknowledge_alert(db: Session, alert_id: int, acknowledged_by: str = 'system'):
        """Acknowledge an alert"""
        
        alert = db.query(Alert).filter_by(id=alert_id).first()
        
        if not alert:
            return False
        
        alert.is_acknowledged = True
        alert.acknowledged_by = acknowledged_by
        alert.acknowledged_at = datetime.utcnow()
        
        db.commit()
        return True
    
    @staticmethod
    def get_alert_history(db: Session, robot_id: str = None, limit: int = 100):
        """Get alert history"""
        
        query = db.query(Alert).order_by(Alert.created_at.desc()).limit(limit)
        
        if robot_id:
            query = query.filter_by(robot_id=robot_id)
        
        alerts = query.all()
        
        return [
            {
                'id': alert.id,
                'robot_id': alert.robot_id,
                'alert_type': alert.alert_type,
                'metric_name': alert.metric_name,
                'severity': alert.severity,
                'message': alert.message,
                'is_acknowledged': alert.is_acknowledged,
                'created_at': alert.created_at.isoformat(),
                'acknowledged_at': alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            }
            for alert in alerts
        ]
    
    @staticmethod
    def create_alert_rule(db: Session, robot_id: str, metric_name: str, 
                          threshold_type: str, threshold_value: float, severity: str):
        """Create a new alert rule"""
        
        rule = AlertRule(
            robot_id=robot_id,
            metric_name=metric_name,
            threshold_type=threshold_type,
            threshold_value=threshold_value,
            severity=severity
        )
        
        db.add(rule)
        db.commit()
        
        return rule
    
    @staticmethod
    def get_alert_rules(db: Session, robot_id: str = None):
        """Get alert rules"""
        
        query = db.query(AlertRule)
        
        if robot_id:
            query = query.filter_by(robot_id=robot_id)
        
        rules = query.all()
        
        return [
            {
                'id': rule.id,
                'robot_id': rule.robot_id,
                'metric_name': rule.metric_name,
                'threshold_type': rule.threshold_type,
                'threshold_value': rule.threshold_value,
                'severity': rule.severity,
                'enabled': rule.enabled,
            }
            for rule in rules
        ]