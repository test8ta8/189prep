import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';

export default function ProtectedRoute({ user, isInitializing, children }) {
  const location = useLocation();

  if (isInitializing) {
    return <div style={{ height: '100vh', background: 'var(--bg-page)' }} />;
  }

  if (!user) {
    // Redirect to the login page, but save the current location they were
    // trying to go to if you want to implement redirect-after-login later.
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return children;
}
