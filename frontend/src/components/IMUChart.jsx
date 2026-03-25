import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function IMUChart({ imuData }) {
  if (!imuData || imuData.length === 0) return <div style={{ color: 'white' }}>No data</div>;

  const data = {
    labels: imuData.map((_, i) => i),
    datasets: [
      { label: 'Accel X', data: imuData.map(i => i.accel_x), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.4, fill: true, pointRadius: 2 },
      { label: 'Accel Y', data: imuData.map(i => i.accel_y), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true, pointRadius: 2 },
      { label: 'Accel Z', data: imuData.map(i => i.accel_z), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.4, fill: true, pointRadius: 2 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#fff', font: { size: 11 } } },
      title: { display: true, text: 'IMU Acceleration', color: '#fff', font: { size: 14 } },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
    },
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
      <Line data={data} options={options} height={60} />
    </div>
  );
}