import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function FleetPage() {
  const navigate = useNavigate();
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newRobotId, setNewRobotId] = useState('');
  const [newRobotName, setNewRobotName] = useState('');
  const [newRobotLocation, setNewRobotLocation] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  const fetchRobots = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/robots');
      setRobots(res.data.robots);
      setError('');
    } catch (err) {
      setError('Failed to fetch robots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRobots();
  }, []);

  const handleAddRobot = async () => {
    if (!newRobotId || !newRobotName || !newRobotLocation) {
      alert('Please fill all fields');
      return;
    }

    try {
      await api.post('/api/robots', {
        robot_id: newRobotId,
        name: newRobotName,
        location: newRobotLocation,
        status: 'Online',
      });
      alert('✅ Robot added successfully!');
      setNewRobotId('');
      setNewRobotName('');
      setNewRobotLocation('');
      fetchRobots();
    } catch (err) {
      alert('❌ Failed to add robot');
      console.error(err);
    }
  };

  const handleDeleteRobot = async (robotId) => {
    if (!window.confirm(`Delete ${robotId}?`)) return;

    try {
      await api.delete(`/api/robots/${robotId}`);
      alert('✅ Robot deleted!');
      fetchRobots();
    } catch (err) {
      alert('❌ Failed to delete robot');
    }
  };

  const handleSelectRobot = (robotId) => {
    localStorage.setItem('selectedRobot', robotId);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
      {/* Navbar */}
      <nav style={{
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>🚀 Fleet Management</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          Logout
        </button>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '32px' }}>🤖 Robot Fleet ({robots.length})</h2>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#fca5a5',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            {error}
          </div>
        )}

        {/* Add Robot Form */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>➕ Add New Robot</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
          }}>
            <input
              type="text"
              placeholder="Robot ID (e.g., robot-005)"
              value={newRobotId}
              onChange={(e) => setNewRobotId(e.target.value)}
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontSize: '14px',
              }}
            />
            <input
              type="text"
              placeholder="Robot Name (e.g., Optimus)"
              value={newRobotName}
              onChange={(e) => setNewRobotName(e.target.value)}
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontSize: '14px',
              }}
            />
            <input
              type="text"
              placeholder="Location (e.g., Warehouse A)"
              value={newRobotLocation}
              onChange={(e) => setNewRobotLocation(e.target.value)}
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontSize: '14px',
              }}
            />
          </div>
          <button
            onClick={handleAddRobot}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '16px',
            }}
          >
            ➕ Add Robot
          </button>
        </div>

        {/* Robots Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
            ⏳ Loading robots...
          </div>
        ) : robots.length === 0 ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>No robots available. Add one above!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '24px',
          }}>
            {robots.map((robot) => (
              <div
                key={robot.robot_id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '24px',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                    🤖 {robot.name}
                  </h3>
                  <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
                    ID: {robot.robot_id}
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '12px' }}>
                    📍 {robot.location}
                  </p>
                  <div style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: robot.status === 'Online' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: robot.status === 'Online' ? '#4ade80' : '#fca5a5',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}>
                    {robot.status === 'Online' ? '● Online' : '○ Offline'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleSelectRobot(robot.robot_id)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '12px',
                    }}
                  >
                    👁️ Monitor
                  </button>
                  <button
                    onClick={() => handleDeleteRobot(robot.robot_id)}
                    style={{
                      padding: '10px 12px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '12px',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
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
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}