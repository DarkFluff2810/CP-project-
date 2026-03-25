import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function MessageRateChart({ messageData }) {
  if (!messageData || messageData.length === 0) return <div style={{ color: 'white' }}>No data</div>;

  const data = {
    labels: messageData.map((_, i) => i),
    datasets: [
      { label: 'Pose Rate', data: messageData.map(m => m.pose_rate), backgroundColor: '#3b82f6', borderRadius: 6 },
      { label: 'IMU Rate', data: messageData.map(m => m.imu_rate), backgroundColor: '#8b5cf6', borderRadius: 6 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#fff', font: { size: 11 } } },
      title: { display: true, text: 'Message Rate', color: '#fff', font: { size: 14 } },
    },
    scales: {
      x: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
      y: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
    },
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
      <Bar data={data} options={options} height={60} />
    </div>
  );
}