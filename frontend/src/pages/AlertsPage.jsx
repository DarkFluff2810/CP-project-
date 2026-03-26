import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function AlertsPage() {
  const navigate = useNavigate();
  
  // State management
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [selectedRobot, setSelectedRobot] = useState('');
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewRule, setShowNewRule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('active'); // 'active', 'history', 'rules'
  const [filterSeverity, setFilterSeverity] = useState('all'); // 'all', 'critical', 'warning', 'info'
  
  const [newRule, setNewRule] = useState({
    robot_id: '',
    metric_name: 'avg_latency',
    threshold_type: 'greater_than',
    threshold_value: 80,
    severity: 'warning',
  });

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  // Fetch robots
  useEffect(() => {
    const fetchRobots = async () => {
      try {
        const res = await api.get('/api/robots');
        setRobots(res.data.robots);
        
        if (res.data.robots.length > 0) {
          const saved = localStorage.getItem('selectedRobot');
          const robotToSelect = saved && res.data.robots.some(r => r.robot_id === saved)
            ? saved
            : res.data.robots[0].robot_id;
          
          setSelectedRobot(robotToSelect);
          setNewRule(prev => ({ ...prev, robot_id: robotToSelect }));
        }
      } catch (err) {
        setError('Failed to fetch robots');
        console.error(err);
      }
    };
    
    fetchRobots();
  }, []);

  // Fetch alerts when robot changes
  useEffect(() => {
    if (!selectedRobot) return;

    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError('');
        
        const [activeRes, historyRes, rulesRes] = await Promise.all([
          api.get(`/api/alerts/active?robot_id=${selectedRobot}`),
          api.get(`/api/alerts/history?robot_id=${selectedRobot}&limit=100`),
          api.get(`/api/alert-rules?robot_id=${selectedRobot}`),
        ]);

        setActiveAlerts(activeRes.data.alerts || []);
        setAlertHistory(historyRes.data.history || []);
        setAlertRules(rulesRes.data.rules || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch alerts');
        console.error(err);
        setLoading(false);
      }
    };

    fetchAlerts();
    
    // Auto-refresh active alerts every 5 seconds
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [selectedRobot]);

  // Handle acknowledge alert
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      setRefreshing(true);
      await api.post(`/api/alerts/${alertId}/acknowledge`);
      
      // Remove alert from active list
      setActiveAlerts(activeAlerts.filter(a => a.id !== alertId));
      
      // Show success message
      alert('✅ Alert acknowledged successfully!');
      setRefreshing(false);
    } catch (err) {
      alert('❌ Failed to acknowledge alert');
      console.error(err);
      setRefreshing(false);
    }
  };

  // Handle create rule
  const handleCreateRule = async () => {
    // Validate inputs
    if (!newRule.robot_id) {
      alert('⚠️ Please select a robot');
      return;
    }
    
    if (newRule.threshold_value <= 0) {
      alert('⚠️ Threshold value must be greater than 0');
      return;
    }

    try {
      setRefreshing(true);
      
      await api.post('/api/alert-rules', null, {
        params: newRule,
      });
      
      alert('✅ Alert rule created successfully!');
      setShowNewRule(false);
      
      // Reset form
      setNewRule({
        robot_id: selectedRobot,
        metric_name: 'avg_latency',
        threshold_type: 'greater_than',
        threshold_value: 80,
        severity: 'warning',
      });
      
      // Refresh rules
      const rulesRes = await api.get(`/api/alert-rules?robot_id=${selectedRobot}`);
      setAlertRules(rulesRes.data.rules || []);
      setRefreshing(false);
    } catch (err) {
      alert('❌ Failed to create alert rule');
      console.error(err);
      setRefreshing(false);
    }
  };

  // Handle delete rule
  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      setRefreshing(true);
      await api.delete(`/api/alert-rules/${ruleId}`);
      
      alert('✅ Alert rule deleted successfully!');
      
      // Refresh rules
      const rulesRes = await api.get(`/api/alert-rules?robot_id=${selectedRobot}`);
      setAlertRules(rulesRes.data.rules || []);
      setRefreshing(false);
    } catch (err) {
      alert('❌ Failed to delete alert rule');
      console.error(err);
      setRefreshing(false);
    }
  };

  // Handle acknowledge all alerts
  const handleAcknowledgeAll = async () => {
    if (activeAlerts.length === 0) {
      alert('⚠️ No active alerts to acknowledge');
      return;
    }

    if (!window.confirm(`Acknowledge all ${activeAlerts.length} alerts?`)) return;

    try {
      setRefreshing(true);
      
      // Acknowledge each alert
      const promises = activeAlerts.map(alert =>
        api.post(`/api/alerts/${alert.id}/acknowledge`)
      );
      
      await Promise.all(promises);
      
      setActiveAlerts([]);
      alert(`✅ All ${activeAlerts.length} alerts acknowledged!`);
      setRefreshing(false);
    } catch (err) {
      alert('❌ Failed to acknowledge some alerts');
      console.error(err);
      setRefreshing(false);
    }
  };

  // Handle refresh data
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      
      const [activeRes, historyRes] = await Promise.all([
        api.get(`/api/alerts/active?robot_id=${selectedRobot}`),
        api.get(`/api/alerts/history?robot_id=${selectedRobot}&limit=100`),
      ]);

      setActiveAlerts(activeRes.data.alerts || []);
      setAlertHistory(historyRes.data.history || []);
      setRefreshing(false);
    } catch (err) {
      setError('Failed to refresh alerts');
      setRefreshing(false);
    }
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'rgba(239, 68, 68, 0.2)',
          text: '#fca5a5',
          border: 'rgba(239, 68, 68, 0.5)',
          icon: '🔴',
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.2)',
          text: '#fcd34d',
          border: 'rgba(245, 158, 11, 0.5)',
          icon: '🟡',
        };
      default:
        return {
          bg: 'rgba(59, 130, 246, 0.2)',
          text: '#93c5fd',
          border: 'rgba(59, 130, 246, 0.5)',
          icon: '🔵',
        };
    }
  };

  // Filter alerts by severity
  const filteredAlerts = activeAlerts.filter(alert => {
    if (filterSeverity === 'all') return true;
    return alert.severity === filterSeverity;
  });

  // Get alert statistics
  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;
  const infoCount = activeAlerts.filter(a => a.severity === 'info').length;

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedRobot');
    navigate('/');
  };

  // Styles
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    color: 'white',
  };

  const navStyle = {
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    flexWrap: 'wrap',
    gap: '16px',
  };

  const mainStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '32px',
  };

  const robotSelectorStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  };

  const buttonStyle = {
    padding: '10px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
    fontSize: '14px',
  };

  const buttonDangerStyle = {
    padding: '10px 16px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
    fontSize: '14px',
  };

  const errorStyle = {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    color: '#fca5a5',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  };

  const tabButtonStyle = (isActive) => ({
    padding: '12px 24px',
    background: isActive ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)',
    color: isActive ? '#93c5fd' : 'rgba(255, 255, 255, 0.6)',
    border: isActive ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.3s',
  });

  const statCardStyle = (color) => ({
    background: color.bg,
    border: `1px solid ${color.border}`,
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
  });

  return (
    <div style={containerStyle}>
      {/* Navbar */}
      <nav style={navStyle}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🚨 Alerts Management</h1>
        
        {/* Robot Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
          <label style={{ fontWeight: '600', fontSize: '14px' }}>Robot:</label>
          <select
            value={selectedRobot}
            onChange={(e) => setSelectedRobot(e.target.value)}
            style={robotSelectorStyle}
          >
            {robots.map((robot) => (
              <option key={robot.robot_id} value={robot.robot_id}>
                {robot.name} ({robot.robot_id})
              </option>
            ))}
          </select>
        </div>

        {/* Nav Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={buttonStyle}
            onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
          >
            📊 Dashboard
          </button>
          <button
            onClick={handleLogout}
            style={buttonDangerStyle}
            onMouseEnter={(e) => (e.target.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.target.style.background = '#ef4444')}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={mainStyle}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' }}>
            🚨 Alert Management
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Monitor, manage, and configure alerts for your robots
          </p>
        </div>

        {/* Error Message */}
        {error && <div style={errorStyle}>⚠️ {error}</div>}

        {/* Alert Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          <div style={statCardStyle(getSeverityColor('critical'))}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔴</div>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
              CRITICAL
            </p>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{criticalCount}</p>
          </div>

          <div style={statCardStyle(getSeverityColor('warning'))}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🟡</div>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
              WARNING
            </p>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{warningCount}</p>
          </div>

          <div style={statCardStyle(getSeverityColor('info'))}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔵</div>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
              INFO
            </p>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{infoCount}</p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
              TOTAL
            </p>
            <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{activeAlerts.length}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setSelectedTab('active')}
            style={tabButtonStyle(selectedTab === 'active')}
          >
            🚨 Active Alerts ({activeAlerts.length})
          </button>
          <button
            onClick={() => setSelectedTab('history')}
            style={tabButtonStyle(selectedTab === 'history')}
          >
            📋 History ({alertHistory.length})
          </button>
          <button
            onClick={() => setSelectedTab('rules')}
            style={tabButtonStyle(selectedTab === 'rules')}
          >
            ⚙️ Rules ({alertRules.length})
          </button>
        </div>

        {/* Active Alerts Tab */}
        {selectedTab === 'active' && (
          <div>
            {/* Controls */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterSeverity('all')}
                  style={{
                    padding: '8px 16px',
                    background: filterSeverity === 'all' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterSeverity('critical')}
                  style={{
                    padding: '8px 16px',
                    background: filterSeverity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    color: filterSeverity === 'critical' ? '#fca5a5' : 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                  }}
                >
                  🔴 Critical
                </button>
                <button
                  onClick={() => setFilterSeverity('warning')}
                  style={{
                    padding: '8px 16px',
                    background: filterSeverity === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    color: filterSeverity === 'warning' ? '#fcd34d' : 'white',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                  }}
                >
                  🟡 Warning
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{
                    ...buttonStyle,
                    opacity: refreshing ? 0.6 : 1,
                  }}
                >
                  🔁 Refresh
                </button>
                {activeAlerts.length > 0 && (
                  <button
                    onClick={handleAcknowledgeAll}
                    disabled={refreshing}
                    style={{
                      ...buttonStyle,
                      background: '#10b981',
                      opacity: refreshing ? 0.6 : 1,
                    }}
                  >
                    ✓ Acknowledge All
                  </button>
                )}
              </div>
            </div>

            {/* Active Alerts List */}
            {loading ? (
              <div style={{
                ...cardStyle,
                textAlign: 'center',
                padding: '40px',
              }}>
                <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  ⏳ Loading alerts...
                </p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div style={{
                ...cardStyle,
                textAlign: 'center',
                padding: '40px',
              }}>
                {activeAlerts.length === 0 ? (
                  <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    ✅ No active alerts - Everything is running smoothly!
                  </p>
                ) : (
                  <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    No alerts matching filter
                  </p>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}>
                {filteredAlerts.map(alert => {
                  const colors = getSeverityColor(alert.severity);
                  return (
                    <div
                      key={alert.id}
                      style={{
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '16px',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.bg;
                        e.currentTarget.style.borderColor = colors.text;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = colors.bg;
                        e.currentTarget.style.borderColor = colors.border;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Alert Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <p style={{ color: colors.text, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px', letterSpacing: '0.5px' }}>
                            {colors.icon} {alert.severity.toUpperCase()}
                          </p>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                            {alert.metric_name}
                          </p>
                        </div>
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Alert Message */}
                      <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '12px', lineHeight: '1.4' }}>
                        {alert.message}
                      </p>

                      {/* Alert Details */}
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Current:</span>
                          <span style={{ fontWeight: '600', color: colors.text }}>
                            {alert.current_value.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Threshold:</span>
                          <span style={{ fontWeight: '600', color: 'rgba(255, 255, 255, 0.8)' }}>
                            {alert.threshold.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Acknowledge Button */}
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        disabled={refreshing}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.15)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '12px',
                          transition: 'all 0.3s',
                          opacity: refreshing ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                        }}
                      >
                        ✓ Acknowledge
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Alert History Tab */}
        {selectedTab === 'history' && (
          <div style={cardStyle}>
            {alertHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <p style={{ fontSize: '18px' }}>📋 No alerts in history yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '16px', textAlign: 'left', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                        Time
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                        Metric
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                        Message
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                        Severity
                      </th>
                      <th style={{ padding: '16px', textAlign: 'left', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertHistory.slice(0, 20).map((alert, idx) => {
                      const colors = getSeverityColor(alert.severity);
                      return (
                        <tr
                          key={alert.id}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            {new Date(alert.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            {alert.metric_name}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255, 255, 255, 0.8)' }}>
                            {alert.message.substring(0, 40)}...
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: colors.bg,
                              color: colors.text,
                              fontSize: '11px',
                              fontWeight: '600',
                            }}>
                              {colors.icon} {alert.severity.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: alert.is_acknowledged ? 'rgba(16, 185, 129, 0.9)' : 'rgba(255, 255, 255, 0.6)' }}>
                            {alert.is_acknowledged ? '✓ Acknowledged' : 'Pending'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {alertHistory.length > 20 && (
                  <p style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                    Showing 20 of {alertHistory.length} alerts
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alert Rules Tab */}
        {selectedTab === 'rules' && (
          <div>
            {/* New Rule Form */}
            <div style={{
              ...cardStyle,
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>
                  {showNewRule ? '➕ Create New Rule' : '⚙️ Alert Rules'}
                </h3>
                {!showNewRule && (
                  <button
                    onClick={() => setShowNewRule(true)}
                    style={{
                      padding: '10px 16px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                    }}
                    onMouseEnter={(e) => (e.target.style.background = '#059669')}
                    onMouseLeave={(e) => (e.target.style.background = '#10b981')}
                  >
                    + Add Rule
                  </button>
                )}
              </div>

              {showNewRule && (
                <div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px',
                  }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        Metric Name
                      </label>
                      <select
                        value={newRule.metric_name}
                        onChange={(e) => setNewRule({ ...newRule, metric_name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '12px',
                        }}
                      >
                        <option value="avg_latency">Avg Latency</option>
                        <option value="min_latency">Min Latency</option>
                        <option value="max_latency">Max Latency</option>
                        <option value="pose_message_count">Pose Messages</option>
                        <option value="imu_message_count">IMU Messages</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        Condition Type
                      </label>
                      <select
                        value={newRule.threshold_type}
                        onChange={(e) => setNewRule({ ...newRule, threshold_type: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '12px',
                        }}
                      >
                        <option value="greater_than">Greater Than</option>
                        <option value="less_than">Less Than</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        Threshold Value
                      </label>
                      <input
                        type="number"
                        value={newRule.threshold_value}
                        onChange={(e) => setNewRule({ ...newRule, threshold_value: parseFloat(e.target.value) })}
                        step="0.1"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '12px',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                        Severity Level
                      </label>
                      <select
                        value={newRule.severity}
                        onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          fontSize: '12px',
                        }}
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowNewRule(false)}
                      style={{
                        padding: '10px 16px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                      }}
                    >
                      ✕ Cancel
                    </button>
                    <button
                      onClick={handleCreateRule}
                      disabled={refreshing}
                      style={{
                        padding: '10px 16px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        opacity: refreshing ? 0.6 : 1,
                      }}
                    >
                      ✓ Create Rule
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rules List */}
            {alertRules.length === 0 ? (
              <div style={{
                ...cardStyle,
                textAlign: 'center',
                padding: '40px',
              }}>
                <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '16px' }}>
                  📋 No alert rules defined yet
                </p>
                {!showNewRule && (
                  <button
                    onClick={() => setShowNewRule(true)}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    + Create First Rule
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}>
                {alertRules.map(rule => {
                  const colors = getSeverityColor(rule.severity);
                  return (
                    <div
                      key={rule.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>
                            {rule.metric_name}
                          </p>
                          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                            {rule.threshold_type.replace('_', ' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={refreshing}
                          style={{
                            padding: '6px 10px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '12px',
                            opacity: refreshing ? 0.6 : 1,
                          }}
                        >
                          🗑️
                        </button>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Threshold:</span>
                          <span style={{ fontWeight: '600' }}>{rule.threshold_value}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Status:</span>
                          <span style={{ fontWeight: '600', color: rule.enabled ? '#4ade80' : '#ef4444' }}>
                            {rule.enabled ? '✓ Enabled' : '✕ Disabled'}
                          </span>
                        </div>
                      </div>

                      <p style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: colors.bg,
                        color: colors.text,
                        fontSize: '11px',
                        fontWeight: '600',
                      }}>
                        {colors.icon} {rule.severity.toUpperCase()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Navigation Footer */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 24px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#7c3aed')}
            onMouseLeave={(e) => (e.target.style.background = '#8b5cf6')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}