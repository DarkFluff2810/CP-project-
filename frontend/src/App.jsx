import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/HistoryPage';
import FleetPage from './pages/FleetPage';
import AlertsPage from './pages/AlertsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/fleet" element={<FleetPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}