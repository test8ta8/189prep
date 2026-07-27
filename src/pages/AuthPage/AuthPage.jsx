import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase } from '../../lib/supabase';

export default function AuthPage({ lang = 'uz', onAuthSuccess, onBackToHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!turnstileToken && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError(lang === 'ru' ? 'Пожалуйста, пройдите проверку безопасности' : 'Iltimos, xavfsizlik tekshiruvidan o\'ting');
      return;
    }
    
    // For localhost, bypass Turnstile token
    let finalToken = turnstileToken;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      finalToken = 'dummy_token_for_localhost';
    }

    setLoading(true);

    try {
      // 1. Fetch IP
      let ip = 'Unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP", e);
      }
      
      // 2. Check Blacklist
      if (ip !== 'Unknown') {
        const { data: blacklisted } = await supabase.from('ip_blacklist').select('id').eq('ip_address', ip).single();
        if (blacklisted) {
           throw new Error("Sizning IP manzilingiz bloklangan.");
        }
      }

      const deviceInfo = navigator.userAgent;

      let data, authError;

      if (isResetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setResetSent(true);
        return;
      }

      if (isLoginMode) {
        // Try to sign in
        const response = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: finalToken }
        });
        data = response.data;
        authError = response.error;
        
        if (authError && authError.message.toLowerCase().includes('invalid login credentials')) {
          authError.message = lang === 'ru' ? 'Неверный email или пароль' : 'Email yoki parol noto\'g\'ri';
        }
      } else {
        // Try to sign up
        const response = await supabase.auth.signUp({
          email,
          password,
          options: { captchaToken: finalToken }
        });
        data = response.data;
        authError = response.error;
        
        if (authError && authError.message.toLowerCase().includes('already registered')) {
           authError.message = lang === 'ru' ? 'Этот email уже зарегистрирован' : 'Bu email allaqachon ro\'yxatdan o\'tgan';
        }
      }

      if (authError) {
         // Log failed login
         if (isLoginMode && data?.user) {
            await supabase.from('login_logs').insert({ user_id: data.user.id, email, ip_address: ip, device_info: deviceInfo, status: 'failed', failed_reason: authError.message });
         } else {
            await supabase.from('login_logs').insert({ email, ip_address: ip, device_info: deviceInfo, status: 'failed', failed_reason: authError.message });
         }
         throw authError;
      }

      if (data?.user) {
        // Log successful login
        await supabase.from('login_logs').insert({ user_id: data.user.id, email, ip_address: ip, device_info: deviceInfo, status: 'success' });
        
        onAuthSuccess({ 
          email: data.user.email,
          id: data.user.id
        });
      }
    } catch (err) {
      console.error('Auth error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Back to Home Button */}
      <button
        onClick={() => {
          if (isResetMode) {
            setIsResetMode(false);
            setResetSent(false);
          } else {
            onBackToHome();
          }
        }}
        className="auth-back-btn"
      >
        <ArrowLeft size={16} />
        <span>{lang === 'ru' ? 'Назад' : 'Orqaga'}</span>
      </button>

      <div className="auth-card-minimal">
        {/* Top Logo Badge */}
        <div className="auth-logo-top" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img 
            src="/logo-189.png" 
            alt="189 Logo" 
            style={{ height: '56px', width: 'auto', objectFit: 'contain' }} 
          />
          <span style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.8px', color: '#0F172A' }}>
            prep
          </span>
        </div>

        {/* Custom Toggle Switch for Login/Register (Liquid Glass Style) */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.4)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: '9999px', 
          padding: '6px', 
          marginBottom: '32px',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)'
        }}>
          <button
            type="button"
            className="glass-toggle-btn"
            onClick={() => setIsLoginMode(true)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '9999px',
              border: isLoginMode ? '1px solid rgba(255, 255, 255, 0.9)' : '1px solid transparent',
              background: isLoginMode ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
              boxShadow: isLoginMode ? '0 8px 16px -4px rgba(15, 23, 42, 0.1), inset 0 1px 1px rgba(255, 255, 255, 1)' : 'none',
              color: isLoginMode ? '#0F172A' : 'rgba(15, 23, 42, 0.6)',
              fontWeight: isLoginMode ? '800' : '600',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            {lang === 'ru' ? 'Вход' : 'Kirish'}
          </button>
          <button
            type="button"
            className="glass-toggle-btn"
            onClick={() => setIsLoginMode(false)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '9999px',
              border: !isLoginMode ? '1px solid rgba(255, 255, 255, 0.9)' : '1px solid transparent',
              background: !isLoginMode ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
              boxShadow: !isLoginMode ? '0 8px 16px -4px rgba(15, 23, 42, 0.1), inset 0 1px 1px rgba(255, 255, 255, 1)' : 'none',
              color: !isLoginMode ? '#0F172A' : 'rgba(15, 23, 42, 0.6)',
              fontWeight: !isLoginMode ? '800' : '600',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            {lang === 'ru' ? 'Регистрация' : 'Ro\'yxatdan o\'tish'}
          </button>
        </div>

        <h1 className="auth-title">
          {isResetMode
            ? (lang === 'ru' ? 'Сброс пароля' : 'Parolni tiklash')
            : isLoginMode 
              ? (lang === 'ru' ? 'С возвращением!' : 'Xush kelibsiz!')
              : (lang === 'ru' ? 'Создать аккаунт' : 'Hisob yaratish')}
        </h1>

        <p className="auth-subtitle">
          {isResetMode
            ? (lang === 'ru' ? 'Введите email, и мы отправим вам ссылку для сброса.' : 'Emailingizni kiriting va biz tiklash havolasini yuboramiz.')
            : isLoginMode
              ? (lang === 'ru' ? 'Введите email и пароль для входа.' : 'Kirish uchun email va parolingizni kiriting.')
              : (lang === 'ru' ? 'Введите email и придумайте пароль для регистрации.' : 'Ro\'yxatdan o\'tish uchun email va parol kiriting.')}
        </p>

        {resetSent ? (
          <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ color: '#059669', fontWeight: '600', margin: 0 }}>
              {lang === 'ru' ? 'Ссылка для сброса отправлена на ваш email!' : 'Tiklash havolasi emailingizga yuborildi!'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
          {/* Email Address */}
          <div className="auth-field-group">
            <label className="auth-label">
              {lang === 'ru' ? 'Электронная почта (Email)' : 'Email manzil'}
            </label>
            <div className="auth-input-box">
              <Mail size={18} color="rgba(15, 23, 42, 0.4)" />
              <input
                type="email"
                required
                placeholder={lang === 'ru' ? 'Введите ваш email' : 'sizning.email@domain.uz'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />
            </div>
          </div>

          {/* Password (Hide if Reset Mode) */}
          {!isResetMode && (
            <div className="auth-field-group">
              <label className="auth-label">
                {lang === 'ru' ? 'Пароль' : 'Parol'}
              </label>
              <div className="auth-input-box">
                <Lock size={18} color="rgba(15, 23, 42, 0.4)" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={lang === 'ru' ? 'Введите ваш пароль' : 'Parolingizni kiriting'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-btn"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {isLoginMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsResetMode(true)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
                  >
                    {lang === 'ru' ? 'Забыли пароль?' : 'Parolni unutdingizmi?'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
              <AlertCircle size={18} color="#0F172A" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '13px', color: '#0F172A', margin: 0, lineHeight: '1.4' }}>
                {error}
              </p>
            </div>
          )}

          {/* Real Turnstile Badge - Hidden on localhost */}
          {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px 0' }}>
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAD4qwtEx-Te2xmAn'}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setError(null);
                }}
                onError={() => {
                  setTurnstileToken(null);
                  setError(lang === 'ru' ? 'Ошибка проверки' : 'Tekshiruv xatosi');
                }}
                options={{
                  theme: 'light',
                }}
              />
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" className="btn-auth-primary" disabled={loading}>
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>
                  {isResetMode 
                    ? (lang === 'ru' ? 'Отправить ссылку' : 'Havolani yuborish')
                    : (lang === 'ru' ? 'Продолжить' : 'Davom etish')}
                </span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="btn-auth-google"
        >
          {/* Colorful Google G SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.37 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          <span>
            {lang === 'ru' ? 'Продолжить через Google' : 'Google orqali davom etish'}
          </span>
        </button>

      </div>
    </div>
  );
}
