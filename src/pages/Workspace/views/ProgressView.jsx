import React from 'react';
import { Lock, TrendingUp, ArrowRight, ArrowLeft, Target, Award, Calendar, Activity } from 'lucide-react';

export default function ProgressView({ lang, user, stats, onNavigate }) {
  const isUz = lang === 'uz';
  const hasPremium = user?.subscription_until && new Date(user.subscription_until) > new Date() && user.subscription_tier !== 'free';

  if (!hasPremium) {
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
              ? 'Batafsil statistika va o\'sish grafigini ko\'rish uchun Pro tarifiga obuna bo\'lishingiz kerak. Natijalaringizni chuqur tahlil qiling!'
              : 'Для просмотра детальной статистики и графиков прогресса вам необходим тариф Pro. Анализируйте свои результаты глубже!'}
          </p>

          <button onClick={() => onNavigate('pricing')} style={{ width: '100%', padding: '16px', background: '#0F172A', color: '#FFFFFF', borderRadius: '16px', border: 'none', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 8px 16px -4px rgba(15, 23, 42, 0.2)' }}>
            <TrendingUp size={20} />
            <span>{isUz ? "Ta'riflarni ko'rish" : "Посмотреть тарифы"}</span>
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

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)' }}>
          <TrendingUp size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>{isUz ? 'Progress va Analitika' : 'Прогресс и Аналитика'}</h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '15px', marginTop: '4px' }}>{isUz ? "Sizning o'qish tarixingiz va yutuqlaringiz" : "История вашего обучения и достижения"}</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Stat Cards */}
        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#EFF6FF', padding: '10px', borderRadius: '12px', color: '#3B82F6' }}>
              <Activity size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#475569', fontWeight: '600' }}>{isUz ? 'O\'rtacha ball' : 'Средний балл'}</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A' }}>{stats?.avgScore || 0}</div>
          <p style={{ margin: 0, fontSize: '13px', color: '#10B981', marginTop: '8px', fontWeight: '500' }}>189 maksimal balldan</p>
        </div>

        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#FEF2F2', padding: '10px', borderRadius: '12px', color: '#EF4444' }}>
              <Calendar size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#475569', fontWeight: '600' }}>{isUz ? 'Ketma-ketlik (Streak)' : 'Дни подряд (Streak)'}</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A' }}>{stats?.streak || 0}</div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B', marginTop: '8px', fontWeight: '500' }}>kun tanaffussiz</p>
        </div>

        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#F5F3FF', padding: '10px', borderRadius: '12px', color: '#8B5CF6' }}>
              <Award size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#475569', fontWeight: '600' }}>{isUz ? 'Yechilgan testlar' : 'Пройдено тестов'}</h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A' }}>{stats?.totalTests || 0}</div>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B', marginTop: '8px', fontWeight: '500' }}>jami mock imtihonlar</p>
        </div>
      </div>
      
      <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>{isUz ? 'Kelgusi yangilanishda...' : 'В следующем обновлении...'}</h2>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <Target size={48} color="#CBD5E1" style={{ margin: '0 auto 16px auto' }} />
          <p style={{ fontSize: '16px', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
            {isUz 
              ? "Tez orada bu yerda batafsil grafiklar, zaif fanlaringiz tahlili va reytingingiz paydo bo'ladi." 
              : "Скоро здесь появятся подробные графики, анализ слабых предметов и ваш рейтинг."}
          </p>
        </div>
      </div>
    </div>
  );
}
