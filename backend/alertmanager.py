from database import Alert, AlertRule
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class AlertManager:
    """Manages alert creation, checking, and acknowledgment"""
    
    @staticmethod
    def check_metrics(db: Session, robot_id: str) -> list:
        """
        Check if current metrics violate any alert rules
        
        Args:
            db: Database session
            robot_id: Robot ID to check metrics for
            
        Returns:
            List of triggered alerts
        """
        triggered_alerts = []
        
        try:
            # Get all enabled alert rules for this robot
            rules = db.query(AlertRule).filter(
                AlertRule.robot_id == robot_id,
                AlertRule.enabled == True
            ).all()
            
            # Get latest metrics for this robot
            from database import Metrics
            latest_metrics = db.query(Metrics).filter_by(robot_id=robot_id).order_by(
                Metrics.timestamp.desc()
            ).first()
            
            if not latest_metrics or not rules:
                return triggered_alerts
            
            # Check each rule against the latest metrics
            for rule in rules:
                current_value = None
                
                # Get the current metric value based on metric_name
                if rule.metric_name == "avg_latency":
                    current_value = latest_metrics.avg_latency
                elif rule.metric_name == "min_latency":
                    current_value = latest_metrics.min_latency
                elif rule.metric_name == "max_latency":
                    current_value = latest_metrics.max_latency
                elif rule.metric_name == "pose_message_count":
                    current_value = latest_metrics.pose_message_count
                elif rule.metric_name == "imu_message_count":
                    current_value = latest_metrics.imu_message_count
                
                if current_value is None:
                    continue
                
                # Check if threshold is violated
                threshold_violated = False
                if rule.threshold_type == "greater_than":
                    threshold_violated = current_value > rule.threshold_value
                elif rule.threshold_type == "less_than":
                    threshold_violated = current_value < rule.threshold_value
                
                # Create alert if threshold is violated
                if threshold_violated:
                    alert = Alert(
                        robot_id=robot_id,
                        alert_type="threshold_violation",
                        metric_name=rule.metric_name,
                        threshold=rule.threshold_value,
                        current_value=current_value,
                        severity=rule.severity,
                        message=f"{rule.metric_name} is {current_value} (threshold: {rule.threshold_value})",
                        is_acknowledged=False,
                        created_at=datetime.utcnow()
                    )
                    
                    db.add(alert)
                    db.commit()
                    
                    triggered_alerts.append({
                        "id": alert.id,
                        "robot_id": alert.robot_id,
                        "metric_name": alert.metric_name,
                        "severity": alert.severity,
                        "message": alert.message,
                        "threshold": alert.threshold,
                        "current_value": alert.current_value,
                        "created_at": alert.created_at.isoformat()
                    })
                    
                    logger.warning(f"Alert triggered for {robot_id}: {alert.message}")
        
        except Exception as e:
            logger.error(f"Error checking metrics for alerts: {e}")
        
        return triggered_alerts
    
    
    @staticmethod
    def get_active_alerts(db: Session, robot_id: str = None) -> list:
        """
        Get all active (unacknowledged) alerts
        
        Args:
            db: Database session
            robot_id: Optional robot ID to filter by
            
        Returns:
            List of active alerts
        """
        try:
            query = db.query(Alert).filter_by(is_acknowledged=False)
            
            if robot_id:
                query = query.filter_by(robot_id=robot_id)
            
            alerts = query.order_by(Alert.created_at.desc()).all()
            
            result = []
            for alert in alerts:
                result.append({
                    "id": alert.id,
                    "robot_id": alert.robot_id,
                    "metric_name": alert.metric_name,
                    "severity": alert.severity,
                    "message": alert.message,
                    "threshold": alert.threshold,
                    "current_value": alert.current_value,
                    "created_at": alert.created_at.isoformat()
                })
            
            return result
        
        except Exception as e:
            logger.error(f"Error fetching active alerts: {e}")
            return []
    
    
    @staticmethod
    def get_alert_history(db: Session, robot_id: str = None, limit: int = 100) -> list:
        """
        Get alert history
        
        Args:
            db: Database session
            robot_id: Optional robot ID to filter by
            limit: Maximum number of alerts to return
            
        Returns:
            List of historical alerts
        """
        try:
            query = db.query(Alert)
            
            if robot_id:
                query = query.filter_by(robot_id=robot_id)
            
            alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
            
            result = []
            for alert in alerts:
                result.append({
                    "id": alert.id,
                    "robot_id": alert.robot_id,
                    "metric_name": alert.metric_name,
                    "severity": alert.severity,
                    "message": alert.message,
                    "threshold": alert.threshold,
                    "current_value": alert.current_value,
                    "is_acknowledged": alert.is_acknowledged,
                    "acknowledged_by": alert.acknowledged_by,
                    "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                    "created_at": alert.created_at.isoformat()
                })
            
            return result
        
        except Exception as e:
            logger.error(f"Error fetching alert history: {e}")
            return []
    
    
    @staticmethod
    def acknowledge_alert(db: Session, alert_id: int, email: str) -> bool:
        """
        Acknowledge an alert
        
        Args:
            db: Database session
            alert_id: ID of alert to acknowledge
            email: Email of user acknowledging the alert
            
        Returns:
            True if successful, False otherwise
        """
        try:
            alert = db.query(Alert).filter_by(id=alert_id).first()
            
            if not alert:
                return False
            
            alert.is_acknowledged = True
            alert.acknowledged_by = email
            alert.acknowledged_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Alert {alert_id} acknowledged by {email}")
            
            return True
        
        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            db.rollback()
            return False
    
    
    @staticmethod
    def get_alert_rules(db: Session, robot_id: str = None) -> list:
        """
        Get alert rules
        
        Args:
            db: Database session
            robot_id: Optional robot ID to filter by
            
        Returns:
            List of alert rules
        """
        try:
            query = db.query(AlertRule)
            
            if robot_id:
                query = query.filter_by(robot_id=robot_id)
            
            rules = query.order_by(AlertRule.created_at.desc()).all()
            
            result = []
            for rule in rules:
                result.append({
                    "id": rule.id,
                    "robot_id": rule.robot_id,
                    "metric_name": rule.metric_name,
                    "threshold_type": rule.threshold_type,
                    "threshold_value": rule.threshold_value,
                    "severity": rule.severity,
                    "enabled": rule.enabled,
                    "created_at": rule.created_at.isoformat()
                })
            
            return result
        
        except Exception as e:
            logger.error(f"Error fetching alert rules: {e}")
            return []
    
    
    @staticmethod
    def create_alert_rule(
        db: Session,
        robot_id: str,
        metric_name: str,
        threshold_type: str,
        threshold_value: float,
        severity: str
    ) -> AlertRule:
        """
        Create a new alert rule
        
        Args:
            db: Database session
            robot_id: Robot ID for the rule
            metric_name: Name of metric to monitor
            threshold_type: Type of threshold (greater_than, less_than)
            threshold_value: Threshold value
            severity: Alert severity level (info, warning, critical)
            
        Returns:
            Created AlertRule object
        """
        try:
            rule = AlertRule(
                robot_id=robot_id,
                metric_name=metric_name,
                threshold_type=threshold_type,
                threshold_value=threshold_value,
                severity=severity,
                enabled=True,
                created_at=datetime.utcnow()
            )
            
            db.add(rule)
            db.commit()
            
            logger.info(f"Alert rule created for {robot_id}: {metric_name}")
            
            return rule
        
        except Exception as e:
            logger.error(f"Error creating alert rule: {e}")
            db.rollback()
            raise