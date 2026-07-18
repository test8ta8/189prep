import React, { useState } from 'react';
import { PenTool, CheckCircle, AlertTriangle, Sparkles, Send, RefreshCw, Crown, Lock } from 'lucide-react';

export default function EssayReviewView({ lang }) {
  const isUz = lang === 'uz';
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const wordCount = essay.trim().split(/\s+/).filter(word => word.length > 0).length;

  const handleCheck = () => {
    if (wordCount < 50) {
      alert(isUz ? "Iltimos, kamida 50 ta so'z yozing." : "Пожалуйста, напишите минимум 50 слов.");
      return;
    }
    
    setIsChecking(true);
    
    // Simulate AI checking delay before hitting the paywall
    setTimeout(() => {
      setIsChecking(false);
      setShowUpgrade(true);
    }, 1500);
  };

  const handleReset = () => {
    setShowUpgrade(false);
    setEssay('');
    setTopic('');
  };

  return (
    <div className="essay-review-wrapper fade-in">
      <header className="dashboard-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="dashboard-title" style={{ margin: 0 }}>
              {isUz ? 'AI Esse Tekshiruvi' : 'ИИ-проверка Эссе'}
            </h1>
            <div className="plus-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}>
              <Crown size={14} />
              <span>Plus Plan</span>
            </div>
          </div>
          <p className="dashboard-subtitle">
            {isUz 
              ? "Essengizni yozing va sun'iy intellekt orqali darhol baholating" 
              : "Напишите свое эссе и получите мгновенную оценку от ИИ"}
          </p>
        </div>
      </header>

      <div className="essay-layout">
        {/* Editor Side */}
        <div className="essay-editor-panel glass-panel-padded">
          <div className="editor-group" style={{ marginBottom: '16px' }}>
            <label className="editor-label" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#0F172A', marginBottom: '8px' }}>
              {isUz ? 'Esse mavzusi (ixtiyoriy)' : 'Тема эссе (необязательно)'}
            </label>
            <input 
              type="text" 
              className="essay-input"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: '15px', outline: 'none', background: '#F8FAFC' }}
              placeholder={isUz ? "Masalan: Do you agree or disagree..." : "Например: Согласны ли вы..."}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isChecking || showUpgrade}
            />
          </div>

          <div className="editor-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="editor-label" style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
                {isUz ? 'Esse matni' : 'Текст эссе'}
              </label>
              <span className={`word-count ${wordCount < 50 ? 'text-orange' : 'text-green'}`} style={{ fontSize: '12px', fontWeight: '600' }}>
                {wordCount} {isUz ? "so'z" : "слов"}
              </span>
            </div>
            <textarea 
              className="essay-textarea"
              style={{ flex: 1, width: '100%', minHeight: '300px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.1)', fontSize: '15px', lineHeight: '1.6', outline: 'none', resize: 'vertical', background: '#F8FAFC' }}
              placeholder={isUz ? "O'z essengizni shu yerga yozing yoki nusxalab tashlang..." : "Напишите или вставьте свое эссе здесь..."}
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              disabled={isChecking || showUpgrade}
            ></textarea>
          </div>

          <div className="editor-actions">
            {!showUpgrade ? (
              <button 
                className={`btn-primary-workspace ${isChecking ? 'checking' : ''}`}
                onClick={handleCheck}
                disabled={isChecking || wordCount === 0}
                style={{ width: '100%', padding: '16px', fontSize: '16px', justifyContent: 'center', opacity: isChecking || wordCount === 0 ? 0.7 : 1 }}
              >
                {isChecking ? (
                  <>
                    <RefreshCw size={20} className="spin-anim" />
                    <span>{isUz ? 'Tekshirilmoqda...' : 'Проверка...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>{isUz ? 'AIning fikrini olish' : 'Получить отзыв от ИИ'}</span>
                  </>
                )}
              </button>
            ) : (
              <button 
                className="btn-outline-workspace"
                onClick={handleReset}
                style={{ width: '100%', padding: '16px', fontSize: '16px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid rgba(15, 23, 42, 0.2)', borderRadius: '12px', color: '#0F172A', fontWeight: '600', cursor: 'pointer' }}
              >
                <RefreshCw size={20} />
                <span>{isUz ? 'Qayta urinib ko\'rish' : 'Попробовать снова'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Side */}
        <div className="essay-feedback-panel glass-panel-padded" style={{ position: 'relative', overflow: 'hidden' }}>
          
          {/* UPGRADE PAYWALL OVERLAY */}
          {showUpgrade && (
            <div className="upgrade-overlay fade-in" style={{ position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '32px', textAlign: 'center' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(59, 130, 246, 0.1))', padding: '24px', borderRadius: '50%', marginBottom: '24px' }}>
                <Lock size={48} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', marginBottom: '12px', letterSpacing: '-0.5px' }}>
                {isUz ? 'Plus ta\'rifiga o\'ting' : 'Перейдите на тариф Plus'}
              </h3>
              <p style={{ color: 'rgba(15, 23, 42, 0.6)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px', maxWidth: '320px' }}>
                {isUz 
                  ? "AI orqali insholarni tekshirish, IELTS darajasidagi ball va xatolarni tahlil qilish faqat Plus ta'rifida mavjud." 
                  : "Проверка эссе с помощью ИИ, оценка уровня IELTS и анализ ошибок доступны только в тарифе Plus."}
              </p>
              <button 
                className="btn-primary-workspace" 
                style={{ width: '100%', maxWidth: '300px', padding: '16px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563EB, #3B82F6)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)' }}
                onClick={() => {
                  // Simulate navigating to Pricing by dispatching a custom event or just showing an alert for now if no router
                  alert(isUz ? "Ta'riflar sahifasiga yo'naltirilmoqda..." : "Перенаправление на страницу тарифов...");
                }}
              >
                <Crown size={20} />
                <span>{isUz ? "Ta'riflarni ko'rish" : "Посмотреть тарифы"}</span>
              </button>
            </div>
          )}

          {!isChecking ? (
            <div className="feedback-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px' }}>
              <div className="feedback-empty-icon" style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '24px', borderRadius: '50%' }}>
                <PenTool size={48} color="#2563EB" opacity={0.5} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '24px', marginBottom: '8px' }}>
                {isUz ? 'AI tekshiruvini boshlang' : 'Начните проверку ИИ'}
              </h3>
              <p style={{ color: 'rgba(15, 23, 42, 0.5)', fontSize: '15px', lineHeight: '1.6', maxWidth: '300px' }}>
                {isUz 
                  ? "Essengizni yuboring va darhol IELTS darajasidagi ball, grammatik xatolar tahlili hamda maslahatlar oling."
                  : "Отправьте свое эссе и мгновенно получите оценку уровня IELTS, анализ ошибок и советы."}
              </p>
            </div>
          ) : (
            <div className="feedback-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px' }}>
              <div className="ai-scanning-anim" style={{ animation: 'pulse 1.5s infinite' }}>
                <Sparkles size={56} color="#2563EB" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '24px', marginBottom: '8px' }}>
                {isUz ? "Sun'iy intellekt tahlil qilmoqda..." : "ИИ анализирует..."}
              </h3>
              <p style={{ color: 'rgba(15, 23, 42, 0.5)', fontSize: '15px' }}>
                {isUz ? "Grammatika, mantiq va tuzilish tekshirilmoqda" : "Проверка грамматики, логики и структуры"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
