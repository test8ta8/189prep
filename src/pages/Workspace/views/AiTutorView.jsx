import React from 'react';
import { Lock, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AiTutorView({ lang, onNavigate }) {
  const isUz = lang === 'uz';

  return (
    <div className="fade-in" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(8px)' }}>
      
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '48px', background: '#FFFFFF', borderRadius: '32px', border: '1px solid rgba(15, 23, 42, 0.1)', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.1)' }}>
        <div style={{ width: '88px', height: '88px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px auto' }}>
          <Lock size={40} color="#2563EB" />
        </div>
        
        <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A', marginBottom: '16px', letterSpacing: '-0.5px' }}>
          {isUz ? 'Pro tarifiga o\'ting' : 'Перейдите на тариф Pro'}
        </h2>
        
        <p style={{ fontSize: '16px', color: 'rgba(15, 23, 42, 0.6)', marginBottom: '36px', lineHeight: '1.6' }}>
          {isUz 
            ? 'AI Ustoz xizmatidan foydalanish uchun Pro tarifiga obuna bo\'lishingiz kerak. Eng yaxshi natijalarga erishish uchun hoziroq obuna bo\'ling!'
            : 'Для доступа к ИИ-наставнику вам необходим тариф Pro. Оформите подписку прямо сейчас для достижения лучших результатов!'}
        </p>

        <button onClick={() => onNavigate('pricing')} style={{ width: '100%', padding: '16px', background: '#0F172A', color: '#FFFFFF', borderRadius: '16px', border: 'none', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 8px 16px -4px rgba(15, 23, 42, 0.2)' }}>
          <Sparkles size={20} />
          <span>{isUz ? "Pro tarifini sotib olish" : "Купить тариф Pro"}</span>
          <ArrowRight size={20} />
        </button>

        <button 
          onClick={() => onNavigate('dashboard')}
          style={{ width: '100%', padding: '16px', background: 'transparent', color: 'rgba(15, 23, 42, 0.5)', borderRadius: '16px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', marginTop: '12px' }}
        >
          <ArrowLeft size={18} />
          <span>{isUz ? 'Bosh sahifaga qaytish' : 'Вернуться на главную'}</span>
        </button>
      </div>
    </div>
  );
}
