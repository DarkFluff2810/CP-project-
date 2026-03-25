import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardCharts({ positionData, imuData, messageData }) {
  // Position Chart
  const positionChart = {
    labels: positionData.map((_, i) => i),
    datasets: [
      {
        label: 'X Position',
        data: positionData.map(p => p.x),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
      },
      {
        label: 'Y Position',
        data: positionData.map(p => p.y),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#8b5cf6',
      },
    ],
  };

  // IMU Chart
  const imuChart = {
    labels: imuData.map((_, i) => i),
    datasets: [
      {
        label: 'Accel X',
        data: imuData.map(i => i.accel_x),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
      },
      {
        label: 'Accel Y',
        data: imuData.map(i => i.accel_y),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
      },
      {
        label: 'Accel Z',
        data: imuData.map(i => i.accel_z),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 2,
      },
    ],
  };

  // Message Rate Chart
  const messageChart = {
    labels: messageData.map((_, i) => i),
    datasets: [
      {
        label: 'Pose Rate (msgs/sec)',
        data: messageData.map(m => m.pose_rate),
        backgroundColor: '#3b82f6',
        borderRadius: 6,
      },
      {
        label: 'IMU Rate (msgs/sec)',
        data: messageData.map(m => m.imu_rate),
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: '#fff', font: { size: 11 } },
      },
      title: {
        color: '#fff',
        font: { size: 14, weight: 'bold' },
      },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  const chartContainerStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
      {/* Position Chart */}
      <div style={chartContainerStyle}>
        <Line
          data={positionChart}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, display: true, text: 'Robot Position (X-Y)' } },
          }}
          height={60}
        />
      </div>

      {/* IMU Chart */}
      <div style={chartContainerStyle}>
        <Line
          data={imuChart}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, display: true, text: 'IMU Acceleration' } },
          }}
          height={60}
        />
      </div>

      {/* Message Rate Chart */}
      <div style={{ ...chartContainerStyle, gridColumn: '1 / -1' }}>
        <Bar
          data={messageChart}
          options={{
            ...chartOptions,
            plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, display: true, text: 'Message Rate' } },
          }}
          height={40}
        />
      </div>
    </div>
  );
}