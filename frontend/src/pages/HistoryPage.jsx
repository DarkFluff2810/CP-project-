import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/api/metrics/history?hours=${hours}`);
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch historical data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [hours]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '24px' }}>📊 Loading historical data...</div>
      </div>
    );
  }

  if (!data || data.record_count === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '32px' }}>
        <nav style={{ background: 'rgba(0,0,0,0.4)', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderRadius: '12px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📊 Historical Data</h1>
          <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Logout
          </button>
        </nav>
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>No historical data available. Save some data first!</p>
          <button onClick={() => navigate('/dashboard')} style={{ marginTop: '24px', padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.timestamps.map(ts => new Date(ts).toLocaleTimeString()),
    datasets: [
      {
        label: 'Avg Latency (ms)',
        data: data.avg_latency,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
      },
      {
        label: 'Min Latency (ms)',
        data: data.min_latency,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
      },
      {
        label: 'Max Latency (ms)',
        data: data.max_latency,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#fff', font: { size: 12 } } },
      title: { display: true, text: 'Latency History', color: '#fff', font: { size: 16, weight: 'bold' } },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.1)' } },
    },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '32px' }}>
      {/* Navbar */}
      <nav style={{ background: 'rgba(0,0,0,0.4)', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderRadius: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📊 Historical Data</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          Logout
        </button>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            {error}
          </div>
        )}

        {/* Time Filter */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <label style={{ marginRight: '16px', fontWeight: '600' }}>📅 Show last:</label>
          <select
            value={hours}
            onChange={(e) => setHours(parseInt(e.target.value))}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={24}>24 hours</option>
            <option value={168}>7 days</option>
          </select>
          <span style={{ marginLeft: '24px', color: 'rgba(255,255,255,0.6)' }}>
            📈 {data.record_count} data points
          </span>
        </div>

        {/* Chart */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px' }}>
          <Line data={chartData} options={chartOptions} height={80} />
        </div>

        {/* Navigation */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}