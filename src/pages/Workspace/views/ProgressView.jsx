import React, { useEffect, useState } from 'react';
import { Lock, TrendingUp, ArrowRight, ArrowLeft, Award, Calendar, Activity, Sparkles, BrainCircuit, Target, BookOpen } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';

export default function ProgressView({ lang, user, stats, onNavigate }) {
  const isUz = lang === 'uz';
  const hasPremium = user?.subscription_until && new Date(user.subscription_until) > new Date() && user.subscription_tier !== 'free';
  
  const [testHistory, setTestHistory] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!hasPremium) return;
    
    async function fetchData() {
      const { data, error } = await supabase
        .from('test_sessions')
        .select('id, score, completed_at, test_id, mock_tests(subject, exam_system)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: true }); // chronological

      if (error) {
        console.error('Error fetching test sessions:', error);
      }

      if (!error && data) {
        setTestHistory(data);
        if (data.length > 0) {
          fetchAiAnalysis(data.slice(-10)); // send last 10 tests to AI
        }
      }
    }
    
    fetchData();
  }, [hasPremium, user.id]);

  const fetchAiAnalysis = async (history) => {
    if (!history || history.length === 0) return;
    const cacheKey = `189prep_progress_analysis_${user.id}_len_${history.length}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      setAiAnalysis(cached);
      return;
    }

    setIsAnalyzing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/analyze-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testHistory: history, lang })
      });
      const data = await response.json();
      setAiAnalysis(data.analysis);
      localStorage.setItem(cacheKey, data.analysis);
    } catch (e) {
      console.error(e);
      setAiAnalysis(isUz ? "Tahlil qilishda xatolik yuz berdi." : "Произошла ошибка при анализе.");
    } finally {
      setIsAnalyzing(false);
    }
  };

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
              ? 'Batafsil statistika, AI tahlili va o\'sish grafigini ko\'rish uchun Pro tarifiga obuna bo\'lishingiz kerak.'
              : 'Для просмотра детальной статистики, ИИ-анализа и графиков вам необходим тариф Pro.'}
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

  // Format data for charts
  const chartData = testHistory.map((t, index) => {
    return {
      name: isUz ? `Test ${index + 1}` : `Тест ${index + 1}`,
      score: t.score || 0,
    };
  });

  const highestScore = testHistory.length > 0 ? Math.max(...testHistory.map(t => t.score || 0)) : 0;
  const latestScore = testHistory.length > 0 ? (testHistory[testHistory.length - 1].score || 0) : 0;

  // Calculate subject stats
  const subjectStats = {};
  testHistory.forEach(t => {
    const subj = t.mock_tests?.subject || 'Unknown';
    if (!subjectStats[subj]) subjectStats[subj] = { totalScore: 0, count: 0 };
    subjectStats[subj].totalScore += t.score || 0;
    subjectStats[subj].count += 1;
  });
  
  const subjectAverages = Object.entries(subjectStats)
    .filter(([subj]) => subj !== 'Unknown' && subj !== 'unknown')
    .map(([subj, data]) => ({
      subject: subj,
      avg: Math.round(data.totalScore / data.count)
    })).sort((a,b) => b.avg - a.avg);

  const bestSubject = subjectAverages.length > 0 ? subjectAverages[0].subject : '-';
  const worstSubject = subjectAverages.length > 0 ? subjectAverages[subjectAverages.length - 1].subject : '-';

  // Calculate exam stats
  const examStats = {};
  testHistory.forEach(t => {
    const exam = t.mock_tests?.exam_system || 'Unknown';
    if (!examStats[exam]) examStats[exam] = { totalScore: 0, count: 0 };
    examStats[exam].totalScore += t.score || 0;
    examStats[exam].count += 1;
  });

  const examAverages = Object.entries(examStats)
    .filter(([exam]) => exam !== 'Unknown' && exam !== 'unknown')
    .map(([exam, data]) => ({
      exam: exam.toUpperCase(),
      avg: Math.round(data.totalScore / data.count)
    })).sort((a,b) => b.avg - a.avg);

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)' }}>
          <TrendingUp size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px' }}>{isUz ? 'Progress va Analitika' : 'Прогресс и Аналитика'}</h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '15px', marginTop: '4px' }}>{isUz ? "Sizning o'qish tarixingiz va AI tahlili" : "История вашего обучения и ИИ-анализ"}</p>
        </div>
      </header>

      {/* AI Analysis Card */}
      <div style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', padding: '24px', borderRadius: '24px', border: '1px solid #BFDBFE', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
        <Sparkles size={120} color="#3B82F6" style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#3B82F6', color: 'white', padding: '8px', borderRadius: '10px' }}>
            <BrainCircuit size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1E3A8A' }}>
            {isUz ? 'AI Tahlil va Maslahatlar' : 'ИИ-Анализ и Советы'}
          </h2>
        </div>
        <div style={{ fontSize: '15px', color: '#1E40AF', lineHeight: '1.6', position: 'relative', zIndex: 2 }}>
          {isAnalyzing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="spin-anim"><Sparkles size={16} /></div>
              {isUz ? 'Natijalaringiz tahlil qilinmoqda...' : 'Анализ ваших результатов...'}
            </div>
          ) : (
            <div className="markdown-body" style={{ background: 'transparent' }}>
              {aiAnalysis ? <ReactMarkdown>{aiAnalysis}</ReactMarkdown> : <p style={{ margin: 0 }}>{isUz ? 'Hozircha tahlil uchun yetarli test yechilmagan.' : 'Пока недостаточно тестов для анализа.'}</p>}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Stat Cards */}
        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#EFF6FF', padding: '10px', borderRadius: '12px', color: '#3B82F6' }}>
              <Activity size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600' }}>{isUz ? 'O\'rtacha ball' : 'Средний балл'}</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A' }}>{stats?.avgScore || 0}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#F0FDF4', padding: '10px', borderRadius: '12px', color: '#22C55E' }}>
              <TrendingUp size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600' }}>{isUz ? 'Eng yuqori ball' : 'Высший балл'}</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A' }}>{highestScore}</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#FFF7ED', padding: '10px', borderRadius: '12px', color: '#F97316' }}>
              <Target size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600' }}>{isUz ? 'So\'nggi natija' : 'Последний рез.'}</h3>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A' }}>{latestScore}</div>
        </div>
        
        {subjectAverages.length > 0 && (
          <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#ECFEFF', padding: '10px', borderRadius: '12px', color: '#06B6D4' }}>
                <BookOpen size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600' }}>{isUz ? 'Eng yaxshi fan' : 'Лучший предмет'}</h3>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bestSubject}</div>
          </div>
        )}
      </div>
      
      {/* Charts Section */}
      {chartData.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
            {isUz ? 'Ballar dinamikasi' : 'Динамика баллов'}
          </h2>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="score" name={isUz ? "Ball" : "Балл"} stroke="#2563EB" strokeWidth={4} dot={{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Subject Stats Chart */}
      {subjectAverages.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '32px' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
            {isUz ? "Fanlar bo'yicha o'rtacha ballar" : "Средние баллы по предметам"}
          </h2>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectAverages} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Bar dataKey="avg" name={isUz ? "O'rtacha Ball" : "Средний балл"} fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Exam Type Stats Chart */}
      {examAverages.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '32px' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
            {isUz ? "Imtihon turlari bo'yicha o'rtacha ballar" : "Средние баллы по типам экзаменов"}
          </h2>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={examAverages} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="exam" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Bar dataKey="avg" name={isUz ? "O'rtacha Ball" : "Средний балл"} fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Test History Table */}
      {testHistory.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '32px' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>
            {isUz ? "Yechilgan testlar tarixi" : "История пройденных тестов"}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '14px' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>{isUz ? "Sana" : "Дата"}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>{isUz ? "Fan" : "Предмет"}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>{isUz ? "Imtihon" : "Экзамен"}</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>{isUz ? "Ball" : "Балл"}</th>
                </tr>
              </thead>
              <tbody>
                {[...testHistory].reverse().map((t, idx) => (
                  <tr key={t.id || idx} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#0F172A' }}>
                      {new Date(t.completed_at).toLocaleString(isUz ? 'uz-UZ' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#3B82F6', fontWeight: '600' }}>{t.mock_tests?.subject || '-'}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#64748B' }}>
                      <span style={{ padding: '4px 8px', background: '#F1F5F9', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                        {t.mock_tests?.exam_system ? t.mock_tests.exam_system.toUpperCase() : '-'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '15px', fontWeight: '800', color: '#10B981' }}>{t.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
