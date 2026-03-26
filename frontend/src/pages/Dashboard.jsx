import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCharts from '../components/DashboardCharts';
import api from '../services/api';
import wsManager from '../services/websocket';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // ==================== STATE MANAGEMENT ====================
  
  // Robot Management
  const [selectedRobot, setSelectedRobot] = useState('robot-001');
  const [robots, setRobots] = useState([]);
  const [robotStats, setRobotStats] = useState(null);
  
  // Metrics Data
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [positionData, setPositionData] = useState([]);
  const [imuData, setImuData] = useState([]);
  const [messageData, setMessageData] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [useWebSocket, setUseWebSocket] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dataPointsCount, setDataPointsCount] = useState(0);
  const [showStats, setShowStats] = useState(false);

  // ==================== VERIFY TOKEN ====================
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    } else if (useWebSocket) {
      // Connect to WebSocket
      wsManager.connect(token);
    }

    return () => {
      if (useWebSocket) {
        wsManager.disconnect();
      }
    };
  }, [navigate, useWebSocket]);

  // ==================== FETCH ROBOTS ====================
  useEffect(() => {
    const fetchRobots = async () => {
      try {
        const res = await api.get('/api/robots');
        setRobots(res.data.robots);
        
        // Set selected robot from localStorage or first robot
        const saved = localStorage.getItem('selectedRobot');
        if (saved && res.data.robots.some(r => r.robot_id === saved)) {
          setSelectedRobot(saved);
        } else if (res.data.robots.length > 0) {
          setSelectedRobot(res.data.robots[0].robot_id);
        }
      } catch (err) {
        console.error('Failed to fetch robots:', err);
        setError('Failed to load robots');
      }
    };

    fetchRobots();
  }, []);

  // ==================== FETCH ROBOT STATS ====================
  useEffect(() => {
    if (!selectedRobot) return;

    const fetchRobotStats = async () => {
      try {
        const res = await api.get(`/api/stats/robot/${selectedRobot}`);
        setRobotStats(res.data);
      } catch (err) {
        console.error('Failed to fetch robot stats:', err);
      }
    };

    fetchRobotStats();
  }, [selectedRobot]);

  // ==================== WEBSOCKET LISTENERS ====================
  useEffect(() => {
    if (!useWebSocket) return;

    const handleMetricsUpdate = (message) => {
      setMetrics({
        avg_latency: message.metrics.avg_latency,
        min_latency: message.metrics.min_latency,
        max_latency: message.metrics.max_latency,
        pose_message_count: message.metrics.pose_message_count,
        imu_message_count: message.metrics.imu_message_count,
      });

      setHealth({
        status: message.health.status,
        uptime_hours: message.health.uptime_hours,
      });

      setPositionData((prev) => [
        ...prev.slice(-9),
        { x: message.position.x, y: message.position.y },
      ]);

      setImuData((prev) => [
        ...prev.slice(-9),
        {
          accel_x: message.imu.accel_x,
          accel_y: message.imu.accel_y,
          accel_z: message.imu.accel_z,
        },
      ]);

      setMessageData((prev) => [
        ...prev.slice(-9),
        {
          pose_rate: Math.random() * 50 + 30,
          imu_rate: Math.random() * 100 + 80,
        },
      ]);

      setLoading(false);
      setError('');
      setLastUpdate(new Date());
      setDataPointsCount(prev => prev + 1);
    };

    const handleConnected = () => {
      setWsConnected(true);
      setError('');
    };

    const handleDisconnected = () => {
      setWsConnected(false);
    };

    const handleError = (err) => {
      setError('WebSocket connection error. Check if backend is running.');
    };

    wsManager.on('metricsUpdate', handleMetricsUpdate);
    wsManager.on('connected', handleConnected);
    wsManager.on('disconnected', handleDisconnected);
    wsManager.on('error', handleError);

    return () => {
      wsManager.off('metricsUpdate', handleMetricsUpdate);
      wsManager.off('connected', handleConnected);
      wsManager.off('disconnected', handleDisconnected);
      wsManager.off('error', handleError);
    };
  }, [useWebSocket]);

  // ==================== POLLING FALLBACK ====================
  useEffect(() => {
    if (useWebSocket || !autoRefresh) return;

    const fetchData = async () => {
      try {
        setError('');
        const [healthRes, metricsRes, poseRes, imuRes] = await Promise.all([
          api.get('/api/metrics/health', { params: { robot_id: selectedRobot } }),
          api.get('/api/metrics/latency', { params: { robot_id: selectedRobot } }),
          api.get(`/api/robot/${selectedRobot}/pose`),
          api.get(`/api/robot/${selectedRobot}/imu`),
        ]);

        setHealth(healthRes.data);
        setMetrics(metricsRes.data);
        setPositionData((prev) => [
          ...prev.slice(-9),
          { x: poseRes.data.x, y: poseRes.data.y },
        ]);
        setImuData((prev) => [
          ...prev.slice(-9),
          {
            accel_x: imuRes.data.accel_x,
            accel_y: imuRes.data.accel_y,
            accel_z: imuRes.data.accel_z,
          },
        ]);
        setMessageData((prev) => [
          ...prev.slice(-9),
          {
            pose_rate: Math.random() * 50 + 30,
            imu_rate: Math.random() * 100 + 80,
          },
        ]);
        setLoading(false);
        setLastUpdate(new Date());
        setDataPointsCount(prev => prev + 1);
      } catch (err) {
        setError('Failed to fetch data. Check if backend is running.');
        console.error(err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [useWebSocket, autoRefresh, refreshInterval, selectedRobot]);

  // ==================== INITIAL REST FETCH ====================
  useEffect(() => {
    if (useWebSocket) return;

    const fetchData = async () => {
      try {
        const [healthRes, metricsRes, poseRes, imuRes] = await Promise.all([
          api.get('/api/metrics/health', { params: { robot_id: selectedRobot } }),
          api.get('/api/metrics/latency', { params: { robot_id: selectedRobot } }),
          api.get(`/api/robot/${selectedRobot}/pose`),
          api.get(`/api/robot/${selectedRobot}/imu`),
        ]);

        setHealth(healthRes.data);
        setMetrics(metricsRes.data);
        setPositionData([{ x: poseRes.data.x, y: poseRes.data.y }]);
        setImuData([
          {
            accel_x: imuRes.data.accel_x,
            accel_y: imuRes.data.accel_y,
            accel_z: imuRes.data.accel_z,
          },
        ]);
        setLoading(false);
        setLastUpdate(new Date());
      } catch (err) {
        setError('Failed to fetch data');
      }
    };

    fetchData();
  }, [useWebSocket, selectedRobot]);

  // ==================== EVENT HANDLERS ====================

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('selectedRobot');
    wsManager.disconnect();
    navigate('/');
  };

  const handleSaveData = async () => {
    try {
      const res = await api.post('/api/data/save', null, {
        params: { robot_id: selectedRobot },
      });
      
      if (res.data.alerts_triggered > 0) {
        alert(`✅ Data saved! ⚠️ ${res.data.alerts_triggered} alert(s) triggered`);
      } else {
        alert('✅ Data saved successfully!');
      }
    } catch (err) {
      alert('❌ Failed to save data');
      console.error(err);
    }
  };

  const handleSelectRobot = (robotId) => {
    setSelectedRobot(robotId);
    localStorage.setItem('selectedRobot', robotId);
    setPositionData([]);
    setImuData([]);
    setMessageData([]);
    setLoading(true);
    setDataPointsCount(0);
  };

  const handleRefresh = () => {
    setPositionData([]);
    setImuData([]);
    setMessageData([]);
    setLoading(true);
    setDataPointsCount(0);
    window.location.reload();
  };

  const handleConnectionModeChange = (mode) => {
    setUseWebSocket(mode === 'websocket');
    setLoading(true);
  };

  // ==================== STYLES ====================

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    color: 'white',
  };

  const navStyle = {
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    flexWrap: 'wrap',
    gap: '16px',
  };

  const navTitleStyle = {
    fontSize: '20px',
    fontWeight: 'bold',
    flex: 1,
    minWidth: '200px',
  };

  const navButtonsStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  };

  const mainStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '32px',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px',
  };

  const titleStyle = {
    fontSize: '36px',
    fontWeight: 'bold',
  };

  const statusBadgeStyle = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const statusBadgeConnectedStyle = {
    ...statusBadgeStyle,
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#4ade80',
    border: '1px solid rgba(16, 185, 129, 0.5)',
  };

  const statusBadgeDisconnectedStyle = {
    ...statusBadgeStyle,
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.5)',
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

  const buttonSuccessStyle = {
    padding: '10px 16px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
    fontSize: '14px',
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

  const controlsPanelStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  };

  const selectStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    fontWeight: '600',
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

  const robotStatusCardStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  };

  const metricsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  };

  const metricCardStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    transition: 'all 0.3s',
    cursor: 'pointer',
  };

  const statsBoxStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
  };

  // ==================== RENDER ====================

  return (
    <div style={containerStyle}>
      {/* ==================== NAVBAR ==================== */}
      <nav style={navStyle}>
        <h1 style={navTitleStyle}>🤖 Robot Monitoring</h1>
        
        {/* Robot Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
          <label style={{ fontWeight: '600', fontSize: '14px' }}>Robot:</label>
          <select
            value={selectedRobot}
            onChange={(e) => handleSelectRobot(e.target.value)}
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
        <div style={navButtonsStyle}>
          <div style={useWebSocket ? statusBadgeConnectedStyle : statusBadgeDisconnectedStyle}>
            <span style={{ fontSize: '12px' }}>{useWebSocket ? '●' : '○'}</span>
            {useWebSocket
              ? wsConnected
                ? '🔗 Live'
                : '⏳ Connecting...'
              : '📡 Polling'}
          </div>
          <button
            onClick={() => navigate('/fleet')}
            style={buttonStyle}
            onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
            title="Manage robot fleet"
          >
            🚀 Fleet
          </button>
          <button
            onClick={() => navigate('/history')}
            style={buttonStyle}
            onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
            title="View historical data"
          >
            📊 History
          </button>
          <button
            onClick={() => navigate('/alerts')}
            style={buttonStyle}
            onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
            title="Manage alerts"
          >
            🚨 Alerts
          </button>
          <button
            onClick={handleLogout}
            style={buttonDangerStyle}
            onMouseEnter={(e) => (e.target.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.target.style.background = '#ef4444')}
            title="Logout"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ==================== MAIN CONTENT ==================== */}
      <main style={mainStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>📈 Live Monitoring</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginTop: '4px' }}>
              Monitoring: <strong>{robots.find(r => r.robot_id === selectedRobot)?.name || selectedRobot}</strong>
            </p>
          </div>
          {loading && (
            <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
              ⏳ Loading...
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && <div style={errorStyle}>⚠️ {error}</div>}

        {/* Controls Panel */}
        <div style={controlsPanelStyle}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: '600', fontSize: '14px' }}>🔄 Connection Mode:</label>
            <select
              value={useWebSocket ? 'websocket' : 'polling'}
              onChange={(e) => handleConnectionModeChange(e.target.value)}
              style={selectStyle}
            >
              <option value="websocket">🔗 WebSocket (Real-time)</option>
              <option value="polling">📡 Polling</option>
            </select>
          </div>

          {!useWebSocket && (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: '600', fontSize: '14px' }}>📊 Auto-Refresh:</label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
              />
              {autoRefresh && (
                <>
                  <label style={{ fontWeight: '600', fontSize: '14px' }}>Interval:</label>
                  <select value={refreshInterval} onChange={(e) => setRefreshInterval(parseInt(e.target.value))} style={selectStyle}>
                    <option value={1}>1 second</option>
                    <option value={2}>2 seconds</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                  </select>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={handleRefresh}
              style={buttonStyle}
              onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
              onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
              title="Refresh dashboard"
            >
              🔁 Refresh
            </button>
            <button
              onClick={handleSaveData}
              style={buttonSuccessStyle}
              onMouseEnter={(e) => (e.target.style.background = '#059669')}
              onMouseLeave={(e) => (e.target.style.background = '#10b981')}
              title="Save current metrics to database"
            >
              💾 Save Data
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              style={{
                ...buttonStyle,
                background: showStats ? '#8b5cf6' : '#3b82f6'
              }}
              onMouseEnter={(e) => (e.target.style.background = showStats ? '#7c3aed' : '#2563eb')}
              onMouseLeave={(e) => (e.target.style.background = showStats ? '#8b5cf6' : '#3b82f6')}
              title="Toggle statistics"
            >
              📈 Stats
            </button>
          </div>
        </div>

        {/* Robot Status Card */}
        {health && (
          <div style={robotStatusCardStyle}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              🤖 Robot Status
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background:
                    health.status === 'Online' ? '#4ade80' : '#ef4444',
                  animation:
                    health.status === 'Online' ? 'pulse 2s infinite' : 'none',
                }}
              ></div>
              <div>
                <p
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color:
                      health.status === 'Online' ? '#4ade80' : '#ef4444',
                  }}
                >
                  {health.status}
                </p>
                <p
                  style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    marginTop: '4px',
                  }}
                >
                  ⏱️ Uptime: {health.uptime_hours.toFixed(1)} hours
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        {showStats && robotStats && (
          <div style={statsBoxStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
              📊 Robot Statistics
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
              }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Metrics (24h)</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{robotStats.metrics_recorded_24h}</p>
              </div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
              }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Avg Latency (24h)</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{robotStats.average_latency_24h.toFixed(1)}ms</p>
              </div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
              }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>Total Alerts</p>
                <p style={{ fontSize: '18px', fontWeight: 'bold', color: robotStats.total_alerts > 0 ? '#fca5a5' : '#4ade80' }}>
                  {robotStats.total_alerts}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        {metrics && (
          <div style={metricsGridStyle}>
            {[
              {
                label: 'Avg Latency',
                value: metrics.avg_latency,
                unit: 'ms',
                icon: '⚡',
                color: '#3b82f6',
              },
              {
                label: 'Min Latency',
                value: metrics.min_latency,
                unit: 'ms',
                icon: '⬇️',
                color: '#10b981',
              },
              {
                label: 'Max Latency',
                value: metrics.max_latency,
                unit: 'ms',
                icon: '⬆️',
                color: '#ef4444',
              },
              {
                label: 'Pose Msgs',
                value: metrics.pose_message_count,
                unit: 'msgs',
                icon: '📍',
                color: '#8b5cf6',
              },
              {
                label: 'IMU Msgs',
                value: metrics.imu_message_count,
                unit: 'msgs',
                icon: '📡',
                color: '#f59e0b',
              },
            ].map((card, idx) => (
              <div
                key={idx}
                style={metricCardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title={`${card.label}: ${card.value} ${card.unit}`}
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                  {card.icon}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    letterSpacing: '0.5px',
                    fontWeight: '600',
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: card.color,
                    marginBottom: '4px',
                  }}
                >
                  {card.value.toFixed(1)}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {card.unit}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Section */}
        {positionData.length > 0 &&
        imuData.length > 0 &&
        messageData.length > 0 ? (
          <div>
            <h3
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '24px',
                marginTop: '32px',
              }}
            >
              📊 Real-Time Charts
            </h3>
            <DashboardCharts
              positionData={positionData}
              imuData={imuData}
              messageData={messageData}
            />
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              marginTop: '32px',
            }}
          >
            <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
              ⏳ Collecting data... Charts will appear shortly.
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '40px',
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '12px',
            paddingBottom: '32px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '32px',
          }}
        >
          <p>
            {useWebSocket
              ? '🔗 Real-time WebSocket connection'
              : `📡 Polling mode (${refreshInterval}s interval)`}{' '}
            • 📊 {dataPointsCount} data points collected
          </p>
          <p>Last update: {lastUpdate.toLocaleTimeString()}</p>
        </div>
      </main>

      {/* ==================== ANIMATIONS ==================== */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}