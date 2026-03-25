import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCharts from '../components/DashboardCharts';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [positionData, setPositionData] = useState([]);
  const [imuData, setImuData] = useState([]);
  const [messageData, setMessageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  // Fetch data from API
  const fetchData = async () => {
    try {
      setError('');
      const [healthRes, metricsRes, poseRes, imuRes] = await Promise.all([
        api.get('/api/metrics/health'),
        api.get('/api/metrics/latency'),
        api.get('/api/robot/robot-001/pose'),
        api.get('/api/robot/robot-001/imu'),
      ]);

      setHealth(healthRes.data);
      setMetrics(metricsRes.data);

      // Update position data (keep last 10)
      setPositionData((prev) => [...prev.slice(-9), { x: poseRes.data.x, y: poseRes.data.y }]);

      // Update IMU data (keep last 10)
      setImuData((prev) => [
        ...prev.slice(-9),
        {
          accel_x: imuRes.data.accel_x,
          accel_y: imuRes.data.accel_y,
          accel_z: imuRes.data.accel_z,
        },
      ]);

      // Update message rate data
      setMessageData((prev) => [
        ...prev.slice(-9),
        {
          pose_rate: Math.random() * 50 + 30,
          imu_rate: Math.random() * 100 + 80,
        },
      ]);

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data. Check if backend is running.');
      console.error('Fetch error:', err);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleSaveData = async () => {
    try {
      const res = await api.post('/api/data/save');
      alert('✅ Data saved to database!');
      console.log(res.data);
    } catch (err) {
      alert('❌ Failed to save data');
      console.error(err);
    }
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
  };

  const navTitleStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
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

  const chartsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
    gap: '24px',
    marginTop: '24px',
  };

  const buttonStyle = {
    padding: '10px 20px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
    marginRight: '8px',
  };

  const buttonDangerStyle = {
    padding: '10px 20px',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
  };

  const buttonSuccessStyle = {
    padding: '10px 20px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.3s',
    marginRight: '8px',
  };

  const errorStyle = {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    color: '#fca5a5',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
  };

  const controlsPanelStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  };

  return (
    <div style={containerStyle}>
      {/* Navbar */}
      <nav style={navStyle}>
        <h1 style={navTitleStyle}>🤖 Robot Monitoring Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/history')}
            style={buttonStyle}
            onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
          >
            📊 History
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
        <div style={headerStyle}>
          <h2 style={titleStyle}>📈 Live Monitoring</h2>
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
            <label style={{ fontWeight: '600' }}>🔄 Auto-Refresh:</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <label style={{ fontWeight: '600' }}>Interval (sec):</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              style={selectStyle}
              disabled={!autoRefresh}
            >
              <option value={1}>1 second</option>
              <option value={2}>2 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchData}
              style={buttonStyle}
              onMouseEnter={(e) => (e.target.style.background = '#2563eb')}
              onMouseLeave={(e) => (e.target.style.background = '#3b82f6')}
            >
              🔁 Refresh Now
            </button>
            <button
              onClick={handleSaveData}
              style={buttonSuccessStyle}
              onMouseEnter={(e) => (e.target.style.background = '#059669')}
              onMouseLeave={(e) => (e.target.style.background = '#10b981')}
            >
              💾 Save Data
            </button>
          </div>
        </div>

        {/* Robot Status Card */}
        {health && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>🤖 Robot Status</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: health.status === 'Online' ? '#4ade80' : '#ef4444',
                  animation: health.status === 'Online' ? 'pulse 2s infinite' : 'none',
                }}
              ></div>
              <div>
                <p
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: health.status === 'Online' ? '#4ade80' : '#ef4444',
                  }}
                >
                  {health.status}
                </p>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', marginTop: '4px' }}>
                  ⏱️ Uptime: {health.uptime_hours.toFixed(1)} hours
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Cards */}
        {metrics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {[
              { label: 'Avg Latency', value: metrics.avg_latency, unit: 'ms', icon: '⚡', color: '#3b82f6' },
              { label: 'Min Latency', value: metrics.min_latency, unit: 'ms', icon: '⬇️', color: '#10b981' },
              { label: 'Max Latency', value: metrics.max_latency, unit: 'ms', icon: '⬆️', color: '#ef4444' },
              { label: 'Pose Msgs', value: metrics.pose_message_count, unit: 'msgs', icon: '📍', color: '#8b5cf6' },
              { label: 'IMU Msgs', value: metrics.imu_message_count, unit: 'msgs', icon: '📡', color: '#f59e0b' },
            ].map((card, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
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
              >
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: card.color, marginBottom: '4px' }}>
                  {card.value.toFixed(1)}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>{card.unit}</div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Section */}
        {positionData.length > 0 && imuData.length > 0 && messageData.length > 0 ? (
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', marginTop: '32px' }}>📊 Real-Time Charts</h3>
            <DashboardCharts positionData={positionData} imuData={imuData} messageData={messageData} />
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
        <div style={{ marginTop: '40px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px', paddingBottom: '32px' }}>
          <p>
            🔄 Auto-refreshing every {refreshInterval} seconds • 📊 {positionData.length} data points collected
          </p>
          <p>Last update: {new Date().toLocaleTimeString()}</p>
        </div>
      </main>

      {/* Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}