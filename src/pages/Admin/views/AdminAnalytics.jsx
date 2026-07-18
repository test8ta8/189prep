import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { AlertTriangle, TrendingDown, BookOpen, DollarSign, Users, CreditCard, Activity, BarChart2 } from 'lucide-react';

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'qa'
  const [analytics, setAnalytics] = useState([]);
  const [generalStats, setGeneralStats] = useState({
    totalUsers: 0,
    newUsersThisMonth: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
    activeSubs: 0,
    planDistribution: { free: 0, plus: 0, pro: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData(showLoading = true) {
      if (showLoading) setLoading(true);
      try {
        // Load QA Data
        const { data: attemptsData, error } = await supabase
          .from('attempts')
          .select('question_id, is_correct, questions(text, topic, difficulty)');

        if (!error && attemptsData) {
          const stats = {};
          attemptsData.forEach(att => {
            if (!stats[att.question_id]) {
              stats[att.question_id] = {
                id: att.question_id,
                text: att.questions?.text || 'Savol o\'chirilgan',
                topic: att.questions?.topic || 'Umumiy',
                difficulty: att.questions?.difficulty || 'Noma\'lum',
                total: 0,
                correct: 0
              };
            }
            stats[att.question_id].total++;
            if (att.is_correct) stats[att.question_id].correct++;
          });

          const report = Object.values(stats).map(s => {
            const correctRate = (s.correct / s.total) * 100;
            return { ...s, correctRate, isBad: correctRate < 30 && s.total >= 3 };
          });

          report.sort((a, b) => a.correctRate - b.correctRate);
          setAnalytics(report);
        }

        // Load General Stats
        const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, created_at, subscription_tier');
        if (profilesError) console.error("Error fetching profiles:", profilesError);
        
        let txs = [];
        try {
          const { data } = await supabase.from('transactions').select('amount, created_at, status').eq('status', 'paid');
          if (data) txs = data;
        } catch(e) { console.warn("transactions table error", e); }

        if (profiles) {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          
          let newUsersThisMonth = 0;
          const dist = { free: 0, plus: 0, pro: 0 };
          let activeSubsCount = 0;

          profiles.forEach(p => {
            const tier = p.subscription_tier || 'free';
            if (tier === 'free') dist.free++;
            if (tier === 'plus') { dist.plus++; activeSubsCount++; }
            if (tier === 'pro') { dist.pro++; activeSubsCount++; }

            if (new Date(p.created_at) >= startOfMonth) {
              newUsersThisMonth++;
            }
          });

          let totalRevenue = 0;
          let revenueThisMonth = 0;
          txs.forEach(tx => {
            totalRevenue += tx.amount || 0;
            if (new Date(tx.created_at) >= startOfMonth) {
              revenueThisMonth += tx.amount || 0;
            }
          });

          setGeneralStats({
            totalUsers: profiles.length,
            newUsersThisMonth,
            totalRevenue,
            revenueThisMonth,
            activeSubs: activeSubsCount,
            planDistribution: dist
          });
        }
        
      } catch (err) {
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const profilesSub = supabase
      .channel('public:profiles_analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadData(false);
      })
      .subscribe();

    const txsSub = supabase
      .channel('public:txs_analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesSub);
      supabase.removeChannel(txsSub);
    };
  }, []);

  const badQuestionsCount = analytics.filter(a => a.isBad).length;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="admin-view fade-in">
      <header className="admin-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Tahlil va Statistika</h1>
          <p>Tizimning moliyaviy va kontent sifatini chuqur o'rganish</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid rgba(15,23,42,0.1)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('general')}
          style={{ 
            background: activeTab === 'general' ? '#2563EB' : 'transparent', 
            color: activeTab === 'general' ? 'white' : '#64748B', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BarChart2 size={18} /> Umumiy Ko'rsatkichlar
        </button>
        <button 
          onClick={() => setActiveTab('qa')}
          style={{ 
            background: activeTab === 'qa' ? '#2563EB' : 'transparent', 
            color: activeTab === 'qa' ? 'white' : '#64748B', 
            border: 'none', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} /> Kontent Sifati (QA)
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Tahlil qilinmoqda...</div>
      ) : activeTab === 'general' ? (
        <div className="fade-in-up">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Revenue Card */}
            <div className="admin-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Jami Tushum</h3>
                <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#10B981' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                  {formatMoney(generalStats.totalRevenue)}
                </div>
                <div style={{ fontSize: '13px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>+ {formatMoney(generalStats.revenueThisMonth)} bu oyda</span>
                </div>
              </div>
            </div>

            {/* Users Card */}
            <div className="admin-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Jami Foydalanuvchilar</h3>
                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#3B82F6' }}>
                  <Users size={20} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                  {generalStats.totalUsers}
                </div>
                <div style={{ fontSize: '13px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>+ {generalStats.newUsersThisMonth} bu oyda</span>
                </div>
              </div>
            </div>

            {/* Subscriptions Card */}
            <div className="admin-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Faol Obunachilar</h3>
                <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', color: '#F59E0B' }}>
                  <CreditCard size={20} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                  {generalStats.activeSubs}
                </div>
                <div style={{ fontSize: '13px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Aktiv to'lovchilar</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="admin-panel" style={{ padding: '24px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} className="text-muted" /> Ta'riflar taqsimoti
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Pro Tier */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600', color: '#D97706' }}>Pro Ta'rif</span>
                    <span style={{ color: '#475569' }}>{generalStats.planDistribution.pro} ta ( {((generalStats.planDistribution.pro / Math.max(generalStats.totalUsers, 1)) * 100).toFixed(1)}% )</span>
                  </div>
                  <div style={{ width: '100%', background: '#F1F5F9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(generalStats.planDistribution.pro / Math.max(generalStats.totalUsers, 1)) * 100}%`, background: '#F59E0B', height: '100%' }}></div>
                  </div>
                </div>

                {/* Plus Tier */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600', color: '#2563EB' }}>Plus Ta'rif</span>
                    <span style={{ color: '#475569' }}>{generalStats.planDistribution.plus} ta ( {((generalStats.planDistribution.plus / Math.max(generalStats.totalUsers, 1)) * 100).toFixed(1)}% )</span>
                  </div>
                  <div style={{ width: '100%', background: '#F1F5F9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(generalStats.planDistribution.plus / Math.max(generalStats.totalUsers, 1)) * 100}%`, background: '#3B82F6', height: '100%' }}></div>
                  </div>
                </div>

                {/* Free Tier */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ fontWeight: '600', color: '#64748B' }}>Bepul Sinov</span>
                    <span style={{ color: '#475569' }}>{generalStats.planDistribution.free} ta ( {((generalStats.planDistribution.free / Math.max(generalStats.totalUsers, 1)) * 100).toFixed(1)}% )</span>
                  </div>
                  <div style={{ width: '100%', background: '#F1F5F9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(generalStats.planDistribution.free / Math.max(generalStats.totalUsers, 1)) * 100}%`, background: '#CBD5E1', height: '100%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="admin-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '24px', background: '#F8FAFC', borderRadius: '50%', border: '1px dashed #CBD5E1' }}>
                <BarChart2 size={48} color="#94A3B8" />
              </div>
              <p style={{ color: '#64748B', textAlign: 'center', maxWidth: '80%' }}>
                Batafsil grafiklar va kohort tahlillari tez orada qo'shiladi. (V2 update)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="fade-in-up">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="admin-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '12px' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '4px' }}>Qayta ko'rib chiqish kerak</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A' }}>{badQuestionsCount} ta savol</div>
              </div>
            </div>

            <div className="admin-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', borderRadius: '12px' }}>
                <BookOpen size={24} />
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '4px' }}>Umumiy tahlil qilingan</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A' }}>{analytics.length} ta savol</div>
              </div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <TrendingDown size={18} color="#64748B" />
              <h2 style={{ fontSize: '16px', margin: 0, color: '#0F172A' }}>Eng qiyin savollar ro'yxati (To'g'ri ishlash ko'rsatkichi bo'yicha)</h2>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Holat</th>
                  <th>Savol Matni</th>
                  <th>Mavzu</th>
                  <th>Qiyinlik</th>
                  <th>Urinishlar</th>
                  <th>To'g'ri javob %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map(q => (
                  <tr key={q.id} style={{ background: q.isBad ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td>
                      {q.isBad && (
                        <span title="To'g'ri topish darajasi juda past. Xatolik bo'lishi mumkin." style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }}>
                          <AlertTriangle size={16} />
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: q.isBad ? '#64748B' : '#0F172A' }}>
                        {q.text}
                      </div>
                    </td>
                    <td>{q.topic}</td>
                    <td>{q.difficulty}</td>
                    <td>{q.total} marta</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, background: '#E2E8F0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${q.correctRate}%`, background: q.isBad ? '#EF4444' : '#3B82F6', height: '100%' }}></div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: q.isBad ? '#EF4444' : '#3B82F6' }}>
                          {q.correctRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {analytics.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Yetarli ma'lumot yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
