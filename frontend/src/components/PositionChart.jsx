import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function PositionChart({ positionData }) {
  if (!positionData || positionData.length === 0) return <div style={{ color: 'white' }}>No data</div>;

  const data = {
    labels: positionData.map((_, i) => i),
    datasets: [
      {
        label: 'X Position',
        data: positionData.map(p => p.x),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
      },
      {
        label: 'Y Position',
        data: positionData.map(p => p.y),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { color: '#fff', font: { size: 11 } } },
      title: { display: true, text: 'Robot Position', color: '#fff', font: { size: 14 } },
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