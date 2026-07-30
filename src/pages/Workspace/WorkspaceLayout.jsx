import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import { supabase } from '../../lib/supabase';
import './Workspace.css';

// Icons
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Bot, 
  User, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Bookmark,
  ChevronDown,
  Edit3
} from 'lucide-react';

// Flags
const UzFlag = () => (
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }}>
    <rect width="16" height="4" fill="#0099B5"/>
    <rect y="4" width="16" height="4" fill="#FFFFFF"/>
    <rect y="8" width="16" height="4" fill="#1EB53A"/>
    <rect y="3.5" width="16" height="0.5" fill="#CE1126"/>
    <rect y="8" width="16" height="0.5" fill="#CE1126"/>
  </svg>
);

const RuFlag = () => (
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', border: '1px solid rgba(0,0,0,0.1)' }}>
    <rect width="16" height="4" fill="#FFFFFF"/>
    <rect y="4" width="16" height="4" fill="#1C3578"/>
    <rect y="8" width="16" height="4" fill="#E4181C"/>
  </svg>
);

// Lazy Loaded Views
const DashboardView = lazy(() => import('./views/DashboardView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const PricingView = lazy(() => import('./views/PricingView'));
const MocksView = lazy(() => import('./views/MocksView'));
const ProgressView = lazy(() => import('./views/ProgressView'));
const AiTutorView = lazy(() => import('./views/AiTutorView'));
const CustomTestSetupView = lazy(() => import('./views/CustomTestSetupView'));
const MistakesView = lazy(() => import('./views/MistakesView'));
const BookmarksView = lazy(() => import('./views/BookmarksView'));
const EssayReviewView = lazy(() => import('./views/EssayReviewView'));
const NotFoundPage = lazy(() => import('../NotFoundPage/NotFoundPage'));

// Loader
const ViewLoader = () => (
  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner"></div>
  </div>
);

export default function WorkspaceLayout({ 
  user, lang, setLang, onLogout, isAdmin, 
  onStartExam, onStartMistakeRetry, onStartCustomExam 
}) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);
  const [stats, setStats] = useState({ streak: 0, avgScore: 0, totalTests: 0 });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    async function fetchStats() {
      try {
        const { data: sessions } = await supabase
          .from('test_sessions')
          .select('score, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false });

        let avgScore = 0;
        let streak = 0;

        if (sessions && sessions.length > 0) {
          const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
          avgScore = Math.round(totalScore / sessions.length);

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const sessionDates = [...new Set(sessions
            .filter(s => s.completed_at)
            .map(s => {
              const d = new Date(s.completed_at);
              d.setHours(0, 0, 0, 0);
              return d.getTime();
            })
          )].sort((a, b) => b - a);

          if (sessionDates.length > 0) {
            const oneDayMs = 86400000;
            const mostRecent = sessionDates[0];
            if (today.getTime() - mostRecent <= oneDayMs) {
              streak = 1;
              for (let i = 1; i < sessionDates.length; i++) {
                if (sessionDates[i - 1] - sessionDates[i] === oneDayMs) {
                  streak++;
                } else {
                  break;
                }
              }
            }
          }
        }
        setStats({ streak, avgScore, totalTests: sessions?.length || 0 });
      } catch (err) {
        console.error('Error fetching layout stats:', err);
      }
    }
    fetchStats();
  }, [user]);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      onLogout();
    } catch (err) {
      console.error('Error logging out:', err);
      onLogout();
    }
  };

  const navItems = [
    { path: ROUTES.DASHBOARD, icon: LayoutDashboard, labelUz: 'Bosh sahifa', labelRu: 'Главная' },
    { path: ROUTES.MOCKS, icon: FileText, labelUz: 'Mocklar', labelRu: 'Моки' },
    { path: ROUTES.BOOKMARKS, icon: Bookmark, labelUz: 'Eslatmalar', labelRu: 'Закладки' },
    { path: ROUTES.PROGRESS, icon: TrendingUp, labelUz: 'Progress', labelRu: 'Прогресс' },
    { path: ROUTES.AI_TUTOR, icon: Bot, labelUz: 'AI ustoz', labelRu: 'ИИ-репетитор' },
    { path: ROUTES.ESSAY_REVIEW, icon: Edit3, labelUz: 'AI Esse', labelRu: 'ИИ Эссе' }
  ];

  return (
    <div className="workspace-container">
      {/* Mobile Header / Hamburger */}
      <div className="workspace-mobile-header">
        <div 
          className="minimal-brand" 
          style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          onClick={() => { navigate(ROUTES.DASHBOARD); setIsMobileMenuOpen(false); }}
        >
          <img 
            src="/logo-189.png" 
            alt="189 Logo" 
            style={{ height: '38px', width: 'auto', objectFit: 'contain' }} 
          />
          <span style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.8px', color: '#0F172A' }}>
            PREP
          </span>
        </div>
        <button className="btn-icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} color="#0F172A" /> : <Menu size={24} color="#0F172A" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`workspace-sidebar ${isMobileMenuOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <div 
            className="minimal-brand" 
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: isCollapsed ? '0 0 24px 0' : '0 12px 24px 12px', cursor: 'pointer', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            <img 
              src="/logo-189.png" 
              alt="189 Logo" 
              style={{ height: '38px', width: 'auto', objectFit: 'contain' }} 
            />
            {!isCollapsed && (
              <span style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.8px', color: '#0F172A' }}>
                PREP
              </span>
            )}
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                title={isCollapsed ? (lang === 'uz' ? item.labelUz : item.labelRu) : ''}
              >
                <item.icon size={20} className="nav-icon" />
                {!isCollapsed && <span>{lang === 'uz' ? item.labelUz : item.labelRu}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          {/* Profile Button */}
          <NavLink
            to={ROUTES.PROFILE}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) => `sidebar-bottom-item ${isActive ? 'active-bottom' : ''}`}
            style={({ isActive }) => ({
              background: isActive ? '#0F172A' : 'transparent',
              color: isActive ? '#FFFFFF' : '#0F172A',
            })}
            title={isCollapsed ? (lang === 'uz' ? 'Profil' : 'Профиль') : ''}
          >
            {({ isActive }) => (
              <>
                <User size={18} className="nav-icon" style={{ opacity: isActive ? 1 : 0.8 }} />
                {!isCollapsed && <span>{lang === 'uz' ? 'Profil' : 'Профиль'}</span>}
              </>
            )}
          </NavLink>

          {/* Language Switcher */}
          <div ref={langRef} style={{ position: 'relative', width: '100%' }}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="sidebar-bottom-item"
              style={{ width: '100%', justifyContent: isCollapsed ? 'center' : 'space-between' }}
              title={isCollapsed ? (lang === 'uz' ? "O'zbekcha" : "Русский") : ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {lang === 'uz' ? <UzFlag /> : <RuFlag />}
                {!isCollapsed && <span>{lang === 'uz' ? "O'zbekcha" : "Русский"}</span>}
              </div>
              {!isCollapsed && <ChevronDown size={14} color="#0F172A" style={{ opacity: 0.5 }} />}
            </button>
            {isLangOpen && (
              <div style={{ position: 'absolute', bottom: '100%', left: '0', marginBottom: '8px', background: '#FFFFFF', border: '1px solid rgba(15, 23, 42, 0.1)', borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px', zIndex: 50, boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setLang('uz'); setIsLangOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: lang === 'uz' ? 'rgba(15, 23, 42, 0.04)' : 'transparent', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#0F172A', width: '100%', textAlign: 'left' }}
                >
                  <UzFlag /> O'zbekcha
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setLang('ru'); setIsLangOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: lang === 'ru' ? 'rgba(15, 23, 42, 0.04)' : 'transparent', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#0F172A', width: '100%', textAlign: 'left' }}
                >
                  <RuFlag /> Русский
                </button>
              </div>
            )}
          </div>

          {/* Admin Switch Button */}
          {isAdmin && (
            <button 
              onClick={() => navigate(ROUTES.ADMIN)} 
              className="sidebar-bottom-item"
              style={{ color: '#2563eb', marginBottom: '8px' }}
              title={isCollapsed ? "Admin Panel" : ""}
            >
              <ShieldAlert size={18} className="nav-icon" />
              {!isCollapsed && <span>{lang === 'uz' ? 'Admin Panel' : 'Админ Панель'}</span>}
            </button>
          )}

          {/* Logout */}
          <button onClick={handleLogout} className="sidebar-bottom-item" title={isCollapsed ? (lang === 'uz' ? 'Chiqish' : 'Выйти') : ''}>
            <LogOut size={18} className="nav-icon" />
            {!isCollapsed && <span>{lang === 'uz' ? 'Chiqish' : 'Выйти'}</span>}
          </button>

          {/* Collapse Toggle */}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="sidebar-collapse-btn desktop-only">
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="workspace-main">
        <Suspense fallback={<ViewLoader />}>
          <Routes>
            <Route path={ROUTES.DASHBOARD} element={
              <DashboardView lang={lang} user={user} onNavigate={(path) => navigate(`/${path}`)} stats={stats} />
            } />
            <Route path={ROUTES.MOCKS} element={
              <MocksView lang={lang} user={user} onStartExam={onStartExam} onNavigate={(path) => navigate(`/${path}`)} />
            } />
            <Route path={ROUTES.CUSTOM_TEST} element={
              <CustomTestSetupView lang={lang} onStartCustomTest={onStartCustomExam} />
            } />
            <Route path={ROUTES.MISTAKES} element={
              <MistakesView lang={lang} onStartMistakeRetry={onStartMistakeRetry} />
            } />
            <Route path={ROUTES.BOOKMARKS} element={
              <BookmarksView lang={lang} onStartMistakeRetry={onStartMistakeRetry} />
            } />
            <Route path={ROUTES.PROGRESS} element={
              <ProgressView lang={lang} stats={stats} user={user} onNavigate={(path) => navigate(`/${path}`)} />
            } />
            <Route path={ROUTES.AI_TUTOR} element={
              <AiTutorView lang={lang} user={user} stats={stats} onNavigate={(path) => navigate(`/${path}`)} />
            } />
            <Route path={ROUTES.ESSAY_REVIEW} element={
              <EssayReviewView lang={lang} user={user} />
            } />
            <Route path={ROUTES.PRICING} element={
              <PricingView lang={lang} />
            } />
            <Route path={ROUTES.PROFILE} element={
              <ProfileView lang={lang} user={user} isAdmin={isAdmin} />
            } />
            <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            <Route path="*" element={<NotFoundPage lang={lang} />} />
          </Routes>
        </Suspense>
      </main>
      
      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div className="workspace-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
    </div>
  );
}
