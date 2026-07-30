import React from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';

export default function AdminRoute({ user, isAdmin, isInitializing, children }) {
  if (isInitializing) {
    return <div style={{ height: '100vh', background: 'var(--bg-page)' }} />;
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return children;
}
