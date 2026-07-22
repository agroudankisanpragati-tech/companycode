import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import Navbar from './components/layout/Navbar';
import LandingPage from './pages/landing/LandingPage';
import SchemesPage from './pages/schemes/SchemesPage';
import SchemeDetailPage from './pages/schemes/SchemeDetailPage';
import AssistantPage from './pages/assistant/AssistantPage';
import ProfilePage from './pages/profile/ProfilePage';
import ApplicationPage from './pages/application/ApplicationPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AdminPage from './pages/admin/AdminPage';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, token } = useAppStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { theme, isLargeText } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('large-text', isLargeText);
  }, [theme, isLargeText]);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/schemes" element={<SchemesPage />} />
        <Route path="/schemes/:id" element={<SchemeDetailPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/apply" element={<ProtectedRoute><ApplicationPage /></ProtectedRoute>} />
        <Route path="/apply/:schemeId" element={<ProtectedRoute><ApplicationPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
