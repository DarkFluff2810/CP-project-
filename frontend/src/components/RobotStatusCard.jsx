export default function RobotStatusCard({ status, uptime }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>🤖 Robot Status</h3>
      <p style={{ fontSize: '18px', fontWeight: '600', color: status === 'Online' ? '#4ade80' : '#ef4444' }}>{status}</p>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '12px' }}>⏱️ Uptime: {uptime?.toFixed(1) || 0} hours</p>
    </div>
  );
}