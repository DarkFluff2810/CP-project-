export default function MetricsCards({ metrics }) {
  if (!metrics) return null;
  
  const cards = [
    { label: 'Avg Latency', value: metrics.avg_latency, unit: 'ms', icon: '⚡' },
    { label: 'Min Latency', value: metrics.min_latency, unit: 'ms', icon: '⬇️' },
    { label: 'Max Latency', value: metrics.max_latency, unit: 'ms', icon: '⬆️' },
    { label: 'Pose Msgs', value: metrics.pose_message_count, unit: 'msgs', icon: '📍' },
    { label: 'IMU Msgs', value: metrics.imu_message_count, unit: 'msgs', icon: '📡' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {cards.map((card, idx) => (
        <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>{card.label}</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{card.value?.toFixed(1) || 0}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{card.unit}</div>
        </div>
      ))}
    </div>
  );
}