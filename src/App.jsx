import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from './lib/routes';
import './App.css';
import { supabase } from './lib/supabase';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import useDocumentTitle from './hooks/useDocumentTitle';

// Eager imports for layout shell
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Lazy loaded components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage/AuthPage'));
const ResetPasswordView = lazy(() => import('./pages/AuthPage/ResetPasswordView'));
const WorkspaceLayout = lazy(() => import('./pages/Workspace/WorkspaceLayout'));
const AdminLayout = lazy(() => import('./pages/Admin/AdminLayout'));
const ExamLayout = lazy(() => import('./pages/ExamArena/ExamLayout'));
const PracticeLayout = lazy(() => import('./pages/PracticeArena/PracticeLayout'));
const LegalPage = lazy(() => import('./pages/LegalPage/LegalPage'));

// A Loading component for Suspense fallback
const PageLoader = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
    <div className="spinner"></div>
  </div>
);

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const loadState = (key, defaultVal) => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVal;
  };

  const [lang, setLang] = useState(() => loadState('app_lang', 'uz'));
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTestId, setActiveTestId] = useState(() => loadState('app_activeTestId', null));
  const [customTestConfig, setCustomTestConfig] = useState(() => loadState('app_customTestConfig', null));
  const [mistakeRetryIds, setMistakeRetryIds] = useState(() => loadState('app_mistakeRetryIds', null));
  const [isInitializing, setIsInitializing] = useState(true);

  // Persist state across refreshes
  useEffect(() => localStorage.setItem('app_lang', JSON.stringify(lang)), [lang]);
  useEffect(() => localStorage.setItem('app_activeTestId', JSON.stringify(activeTestId)), [activeTestId]);
  useEffect(() => localStorage.setItem('app_customTestConfig', JSON.stringify(customTestConfig)), [customTestConfig]);
  useEffect(() => localStorage.setItem('app_mistakeRetryIds', JSON.stringify(mistakeRetryIds)), [mistakeRetryIds]);

  // Helper to fetch role and profile data
  const fetchProfile = async (userId) => {
    if (!userId) return { isAdmin: false, profile: null };
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    return {
      isAdmin: data?.role === 'admin',
      profile: data
    };
  };

  // Merge auth user with profile data
  const mergeUserWithProfile = (authUser, profile) => {
    if (!authUser) return null;
    return {
      ...authUser,
      full_name: profile?.full_name || null,
      phone: profile?.phone || null,
      subscription_until: profile?.subscription_until || null,
      subscription_tier: profile?.subscription_tier || 'free',
      target_score: profile?.target_score || null,
      target_university: profile?.target_university || null,
    };
  };

  // Process any pending exam submissions from a refresh/unload
  const processPendingExamSubmit = async (userId) => {
    try {
      const pendingStr = localStorage.getItem('pending_exam_submit');
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        if (pending && pending.user_id === userId && pending.test_id) {
          const { error } = await supabase.from('test_sessions').insert([{
            user_id: pending.user_id,
            test_id: pending.test_id,
            score: pending.score,
            completed_at: new Date().toISOString()
          }]);
          if (error) {
            console.error('Pending exam submit failed:', error);
          }
        }
        localStorage.removeItem('pending_exam_submit');
      }
    } catch (e) {
      console.error('Failed to process pending exam submit', e);
      localStorage.removeItem('pending_exam_submit');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Get current session on load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const { isAdmin: adminStatus, profile } = await fetchProfile(session.user.id);
        if (!isMounted) return;
        setUser(mergeUserWithProfile(session.user, profile));
        setIsAdmin(adminStatus);
        await processPendingExamSubmit(session.user.id);
      } else {
        setUser(null);
      }
      if (isMounted) setIsInitializing(false);
    });

    // 2. Listen for auth changes (login, logout, refresh, recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        navigate(ROUTES.RESET_PASSWORD);
      }
      
      if (session?.user) {
        const { isAdmin: adminStatus, profile } = await fetchProfile(session.user.id);
        if (!isMounted) return;
        setUser(mergeUserWithProfile(session.user, profile));
        setIsAdmin(adminStatus);
        await processPendingExamSubmit(session.user.id);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      if (isMounted) setIsInitializing(false);
    });

    // Track online presence
    let globalChannel;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      const userId = session?.user?.id || 'guest-' + Math.random().toString(36).substring(7);
      globalChannel = supabase.channel('global_online', {
        config: {
          presence: { key: userId },
        },
      });
      
      const updatePresence = () => {
        if (!isMounted) return;
        const state = globalChannel.presenceState();
        let count = 0;
        for (const id in state) {
          count += state[id].length;
        }
        window.currentOnlineUsers = count;
        window.dispatchEvent(new CustomEvent('onlineUsersChanged', { detail: count }));
      };

      globalChannel
        .on('presence', { event: 'sync' }, updatePresence)
        .on('presence', { event: 'join' }, updatePresence)
        .on('presence', { event: 'leave' }, updatePresence)
        .subscribe(async (status) => {
          if (!isMounted) {
            supabase.removeChannel(globalChannel);
            return;
          }
          if (status === 'SUBSCRIBED') {
            await globalChannel.track({ online_at: new Date().toISOString() });
          }
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (globalChannel) supabase.removeChannel(globalChannel);
    };
  }, [navigate]);

  useEffect(() => {
    let title = '189Prep';
    const path = location.pathname;
    
    if (path.includes('/dashboard')) title = '189Prep | Dashboard';
    else if (path.includes('/mocks')) title = '189Prep | Mock Exams';
    else if (path.includes('/profile')) title = '189Prep | Profile';
    else if (path.includes('/essay-review')) title = '189Prep | Essay Review';
    else if (path.includes('/progress')) title = '189Prep | Progress';
    else if (path.includes('/ai-tutor')) title = '189Prep | AI Tutor';
    else if (path.includes('/exam')) title = '189Prep | Exam';
    else if (path.includes('/practice')) title = '189Prep | Practice Arena';
    else if (path.includes('/admin')) title = '189Prep | Admin Panel';
    else if (path.includes('/login')) title = '189Prep | Login';
    else if (path.includes('/bookmarks')) title = '189Prep | Bookmarks';
    
    document.title = title;
  }, [location.pathname]);

  const handleStartTestClick = () => {
    navigate(ROUTES.LOGIN);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    const destination = location.state?.from?.pathname || ROUTES.DASHBOARD;
    navigate(destination, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate(ROUTES.HOME);
  };

  if (isInitializing) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route 
          path={ROUTES.HOME} 
          element={
            user ? <Navigate to={ROUTES.DASHBOARD} replace /> : (
              <div className="app-container">
                <Navbar lang={lang} setLang={setLang} onStartTest={handleStartTestClick} />
                <main>
                  <LandingPage lang={lang} onStartTest={handleStartTestClick} />
                </main>
                <Footer lang={lang} />
              </div>
            )
          } 
        />
        
        <Route 
          path={ROUTES.LOGIN} 
          element={
            user ? <Navigate to={ROUTES.DASHBOARD} replace /> : (
              <AuthPage lang={lang} onAuthSuccess={handleAuthSuccess} />
            )
          } 
        />

        <Route 
          path={ROUTES.RESET_PASSWORD} 
          element={<ResetPasswordView lang={lang} onComplete={() => navigate(ROUTES.LOGIN)} />} 
        />
        
        <Route 
          path={ROUTES.LEGAL} 
          element={<LegalPage />} 
        />

        {/* Protected Admin Routes */}
        <Route 
          path={ROUTES.ADMIN} 
          element={
            <AdminRoute user={user} isAdmin={isAdmin} isInitializing={isInitializing}>
              <AdminLayout 
                user={user}
                onLogout={handleLogout}
              />
            </AdminRoute>
          } 
        />

        {/* Protected Exam & Practice Routes */}
        <Route 
          path={ROUTES.EXAM} 
          element={
            <ProtectedRoute user={user} isInitializing={isInitializing}>
              <ExamLayout 
                user={user}
                testId={activeTestId}
                customConfig={customTestConfig}
              />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={`${ROUTES.EXAM}/:id`} 
          element={
            <ProtectedRoute user={user} isInitializing={isInitializing}>
              <ExamLayout 
                user={user}
                testId={activeTestId}
                customConfig={customTestConfig}
              />
            </ProtectedRoute>
          } 
        />

        <Route 
          path={ROUTES.PRACTICE_ARENA} 
          element={
            <ProtectedRoute user={user} isInitializing={isInitializing}>
              <PracticeLayout 
                user={user}
                config={null}
                retryIds={mistakeRetryIds}
              />
            </ProtectedRoute>
          } 
        />

        {/* Protected Workspace Routes (Catch-all for layout) */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute user={user} isInitializing={isInitializing}>
              <WorkspaceLayout 
                user={user} 
                lang={lang} 
                setLang={setLang}
                onLogout={handleLogout} 
                isAdmin={isAdmin}
                onStartExam={(testIdOrConfig) => {
                  if (typeof testIdOrConfig === 'object' && testIdOrConfig.isALevel) {
                    setCustomTestConfig(testIdOrConfig);
                    setActiveTestId(null);
                    navigate(ROUTES.EXAM);
                  } else {
                    setActiveTestId(testIdOrConfig);
                    setCustomTestConfig(null);
                    navigate(`${ROUTES.EXAM}/${testIdOrConfig}`);
                  }
                }}
                onStartMistakeRetry={(ids) => {
                  setMistakeRetryIds(ids);
                  navigate(ROUTES.PRACTICE_ARENA);
                }}
                onStartCustomExam={(config) => {
                  setCustomTestConfig(config);
                  setActiveTestId(null);
                  navigate(ROUTES.EXAM);
                }}
              />
            </ProtectedRoute>
          } 
        />
        
        {/* Fallback 404 Route */}
        <Route path="*" element={<NotFoundPage lang={lang} />} />
      </Routes>
    </Suspense>
  );
}
