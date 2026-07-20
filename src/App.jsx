import React, { useState, useEffect } from 'react';
import './App.css';
import Navbar from './components/layout/Navbar';
import LandingPage from './pages/LandingPage/LandingPage';
import ScoreReportModal from './components/exam/ScoreReportModal';
import Footer from './components/layout/Footer';
import AuthPage from './pages/AuthPage/AuthPage';
import WorkspaceLayout from './pages/Workspace/WorkspaceLayout';
import AdminLayout from './pages/Admin/AdminLayout';
import ExamLayout from './pages/ExamArena/ExamLayout';
import PracticeLayout from './pages/PracticeArena/PracticeLayout';
import LegalPage from './pages/LegalPage/LegalPage';
import { supabase } from './lib/supabase';

export default function App() {
  const loadState = (key, defaultVal) => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultVal;
  };

  const [lang, setLang] = useState(() => loadState('app_lang', 'uz'));
  const [authView, setAuthView] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState(() => loadState('app_viewMode', 'workspace'));
  const [activeTestId, setActiveTestId] = useState(() => loadState('app_activeTestId', null));
  const [customTestConfig, setCustomTestConfig] = useState(() => loadState('app_customTestConfig', null));
  const [practiceConfig, setPracticeConfig] = useState(() => loadState('app_practiceConfig', null));
  const [mistakeRetryIds, setMistakeRetryIds] = useState(() => loadState('app_mistakeRetryIds', null));
  const [pendingSubject, setPendingSubject] = useState('uzbek');
  const [isInitializing, setIsInitializing] = useState(true);
  const [legalPage, setLegalPage] = useState(null);

  // Persist routing state across refreshes
  useEffect(() => localStorage.setItem('app_lang', JSON.stringify(lang)), [lang]);
  useEffect(() => localStorage.setItem('app_viewMode', JSON.stringify(viewMode)), [viewMode]);
  useEffect(() => localStorage.setItem('app_activeTestId', JSON.stringify(activeTestId)), [activeTestId]);
  useEffect(() => localStorage.setItem('app_customTestConfig', JSON.stringify(customTestConfig)), [customTestConfig]);
  useEffect(() => localStorage.setItem('app_practiceConfig', JSON.stringify(practiceConfig)), [practiceConfig]);
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
          await supabase.from('test_sessions').insert([{
            user_id: pending.user_id,
            test_id: pending.test_id,
            score: pending.score,
            completed_at: new Date().toISOString()
          }]);
        }
        localStorage.removeItem('pending_exam_submit');
      }
    } catch (e) {
      console.error('Failed to process pending exam submit', e);
      localStorage.removeItem('pending_exam_submit');
    }
  };

  useEffect(() => {
    // 1. Get current session on load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { isAdmin: adminStatus, profile } = await fetchProfile(session.user.id);
        setUser(mergeUserWithProfile(session.user, profile));
        setIsAdmin(adminStatus);
        await processPendingExamSubmit(session.user.id);
      } else {
        setUser(null);
      }
      setIsInitializing(false);
    });

    // 2. Listen for auth changes (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { isAdmin: adminStatus, profile } = await fetchProfile(session.user.id);
        setUser(mergeUserWithProfile(session.user, profile));
        setIsAdmin(adminStatus);
        await processPendingExamSubmit(session.user.id);
      } else {
        setUser(null);
        setIsAdmin(false);
        setViewMode('workspace');
      }
      setIsInitializing(false);
    });

    // 3. Track online presence
    let globalChannel;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id || 'guest-' + Math.random().toString(36).substring(7);
      globalChannel = supabase.channel('global_online', {
        config: {
          presence: { key: userId },
        },
      });
      
      const updatePresence = () => {
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
          if (status === 'SUBSCRIBED') {
            await globalChannel.track({ online_at: new Date().toISOString() });
          }
        });
    });

    return () => {
      subscription.unsubscribe();
      if (globalChannel) supabase.removeChannel(globalChannel);
    };
  }, []);

  // Clicking "Testni Boshlash" navigates to Login / Register page
  const handleStartTestClick = (subjectId = 'uzbek') => {
    setPendingSubject(subjectId);
    setAuthView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // After successful Auth, go to Workspace
  const handleAuthSuccess = (userData) => {
    setAuthView(false);
    setUser(userData);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // 0. Show empty screen while checking session to prevent flicker
  if (isInitializing) {
    return <div style={{ height: '100vh', background: 'var(--bg-page)' }} />;
  }

  // 1. If user is logged in, show Workspace or Admin
  if (user) {
    if (isAdmin && viewMode === 'admin') {
      return (
        <AdminLayout 
          user={user}
          onLogout={handleLogout}
          onExitAdmin={() => setViewMode('workspace')}
        />
      );
    }

    if (legalPage) {
      return <LegalPage type={legalPage} onBack={() => setLegalPage(null)} />;
    }

    if (viewMode === 'exam') {
      return (
        <ExamLayout 
          user={user}
          testId={activeTestId}
          customConfig={customTestConfig}
          onExit={() => setViewMode('workspace')}
        />
      );
    }

    if (viewMode === 'practice-arena') {
      return (
        <PracticeLayout 
          user={user}
          config={practiceConfig}
          retryIds={mistakeRetryIds}
          onExit={() => setViewMode('workspace')}
        />
      );
    }

    return (
      <WorkspaceLayout 
        user={user} 
        lang={lang} 
        setLang={setLang}
        onLogout={handleLogout} 
        isAdmin={isAdmin}
        onEnterAdmin={() => setViewMode('admin')}
        onStartExam={(testIdOrConfig) => {
          if (typeof testIdOrConfig === 'object' && testIdOrConfig.isALevel) {
            setCustomTestConfig(testIdOrConfig);
            setActiveTestId(null);
          } else {
            setActiveTestId(testIdOrConfig);
            setCustomTestConfig(null);
          }
          setViewMode('exam');
        }}
        onStartPractice={(config) => {
          setPracticeConfig(config);
          setMistakeRetryIds(null);
          setViewMode('practice-arena');
        }}
        onStartMistakeRetry={(ids) => {
          setMistakeRetryIds(ids);
          setPracticeConfig(null);
          setViewMode('practice-arena');
        }}
        onStartCustomExam={(config) => {
          setCustomTestConfig(config);
          setActiveTestId(null);
          setViewMode('exam');
        }}
      />
    );
  }

  // 2. If currently on Login / Register screen
  if (authView) {
    return (
      <AuthPage
        lang={lang}
        onAuthSuccess={handleAuthSuccess}
        onBackToHome={() => setAuthView(false)}
      />
    );
  }

  // 3. Landing Page View (unauthenticated)

  if (legalPage) {
    return <LegalPage type={legalPage} onBack={() => setLegalPage(null)} />;
  }

  return (
    <div className="app-container">
      <div>
        <Navbar
          lang={lang}
          setLang={setLang}
          onStartTest={() => handleStartTestClick('uzbek')}
        />

        <main>
          <LandingPage
            lang={lang}
            onStartTest={handleStartTestClick}
          />
        </main>
      </div>

      <Footer lang={lang} onOpenLegal={(type) => setLegalPage(type)} />
    </div>
  );
}
