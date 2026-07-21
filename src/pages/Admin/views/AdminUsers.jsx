import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, Trash2, Ban, RefreshCcw, UserCircle, CreditCard, X, BarChart2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Plan change modal state
  const [selectedUserForPlan, setSelectedUserForPlan] = useState(null);
  const [newPlan, setNewPlan] = useState('free');
  const [newPlanExpiry, setNewPlanExpiry] = useState('');

  // Analytics modal state
  const [analyticsModalUser, setAnalyticsModalUser] = useState(null);
  const [userAnalyticsStats, setUserAnalyticsStats] = useState({ totalAttempts: 0, correctAttempts: 0, examsTaken: 0, loading: false });

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (newRole === 'admin' && !window.confirm("Bu foydalanuvchiga ADMIN huquqini bermoqchimisiz?")) return;
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  };

  const toggleSuspend = async (userId, isSuspended) => {
    const action = isSuspended ? "blokdan chiqarish" : "bloklash";
    if (!window.confirm(`Foydalanuvchini ${action}ga ishonchingiz komilmi?`)) return;
    try {
      const { error } = await supabase.from('profiles').update({ is_suspended: !isSuspended }).eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  };

  const resetProgress = async (userId) => {
    if (!window.confirm("DIQQAT: Foydalanuvchining barcha test va amaliyot natijalari o'chiriladi. Davom etasizmi?")) return;
    try {
      const { error: err1 } = await supabase.from('attempts').delete().eq('user_id', userId);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('test_sessions').delete().eq('user_id', userId);
      if (err2) throw err2;
      alert("Natijalar muvaffaqiyatli tozalandi!");
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  };

  const handleChangePlan = async (e) => {
    e.preventDefault();
    if (!selectedUserForPlan) return;
    
    try {
      const updateData = { subscription_tier: newPlan };
      if (newPlan !== 'free') {
        if (newPlanExpiry) {
          updateData.subscription_until = new Date(newPlanExpiry).toISOString();
        } else {
          // If no expiry selected, give 1 month default or leave as is
          const date = new Date();
          date.setMonth(date.getMonth() + 1);
          updateData.subscription_until = date.toISOString();
        }
      } else {
        updateData.subscription_until = null;
      }

      const { error } = await supabase.from('profiles').update(updateData).eq('id', selectedUserForPlan.id);
      if (error) throw error;
      
      alert("Ta'rif muvaffaqiyatli o'zgartirildi!");
      setSelectedUserForPlan(null);
      fetchUsers();
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  };

  const openPlanModal = (user) => {
    setSelectedUserForPlan(user);
    setNewPlan(user.subscription_tier || 'free');
    if (user.subscription_until) {
      setNewPlanExpiry(new Date(user.subscription_until).toISOString().split('T')[0]);
    } else {
      setNewPlanExpiry('');
    }
  };

  const openUserAnalytics = async (user) => {
    setAnalyticsModalUser(user);
    setUserAnalyticsStats({ totalAttempts: 0, correctAttempts: 0, examsTaken: 0, loading: true });
    try {
      const { data: attempts } = await supabase.from('attempts').select('is_correct').eq('user_id', user.id);
      const { data: sessions } = await supabase.from('test_sessions').select('score, mock_tests(question_count)').eq('user_id', user.id);

      let totalAttempts = 0;
      let correctAttempts = 0;
      let examsTaken = 0;

      if (attempts) {
        totalAttempts += attempts.length;
        correctAttempts += attempts.filter(a => a.is_correct).length;
      }

      if (sessions) {
        examsTaken = sessions.length;
        sessions.forEach(s => {
          totalAttempts += (s.mock_tests?.question_count || 0);
          correctAttempts += (s.score || 0);
        });
      }

      setUserAnalyticsStats({ totalAttempts, correctAttempts, examsTaken, loading: false });
    } catch(err) {
      console.error(err);
      setUserAnalyticsStats(prev => ({...prev, loading: false}));
    }
  };

  const filteredUsers = users.filter(u => 
    (u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.role?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.id?.includes(searchTerm))
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getPlanBadgeColor = (plan) => {
    switch (plan) {
      case 'pro': return { bg: '#FEF3C7', color: '#D97706' }; // Yellow
      case 'plus': return { bg: '#DBEAFE', color: '#2563EB' }; // Blue
      default: return { bg: '#F1F5F9', color: '#64748B' }; // Gray (free)
    }
  };

  return (
    <div className="admin-view fade-in">
      <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Foydalanuvchilar</h1>
          <p>Barcha ro'yxatdan o'tgan abituriyentlarni boshqarish</p>
        </div>
        
        <div className="admin-search">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Ism yoki ID bo'yicha qidirish..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="admin-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(15, 23, 42, 0.4)' }}>Yuklanmoqda...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID (UUID)</th>
                <th>To'liq ism / Email</th>
                <th>Ro'yxatdan o'tgan</th>
                <th>Telefon</th>
                <th>Holati</th>
                <th>Ta'rif</th>
                <th>Rol</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(u => {
                const planStyle = getPlanBadgeColor(u.subscription_tier || 'free');
                return (
                <tr key={u.id}>
                  <td className="uuid-cell" title={u.id}>{u.id}</td>
                  <td style={{ fontWeight: 600, color: u.is_suspended ? 'rgba(15, 23, 42, 0.5)' : '#0F172A', textDecoration: u.is_suspended ? 'line-through' : 'none' }}>
                    {u.full_name || 'Kiritilmagan'}
                    <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B', marginTop: '4px' }}>
                      {u.email || 'Email mavjud emas'}
                    </div>
                  </td>
                  <td style={{ fontSize: '14px', color: '#475569' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                  </td>
                  <td>{u.phone || '-'}</td>
                  <td>
                    {u.is_suspended ? (
                      <span style={{ color: '#0F172A', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Ban size={12} /> Bloklangan
                      </span>
                    ) : (
                      <span style={{ color: '#2563EB', fontSize: '12px', fontWeight: 'bold' }}>Faol</span>
                    )}
                  </td>
                  <td>
                    <span 
                      style={{ 
                        background: planStyle.bg, 
                        color: planStyle.color, 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}
                    >
                      {u.subscription_tier === 'free' || !u.subscription_tier ? 'Bepul Sinov' : u.subscription_tier}
                    </span>
                    {u.subscription_until && u.subscription_tier !== 'free' && (
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                        {new Date(u.subscription_until).toLocaleDateString('uz-UZ')} gacha
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}`} style={{ cursor: 'pointer' }} onClick={() => toggleRole(u.id, u.role)} title="Rolni o'zgartirish">
                      {u.role === 'admin' ? <ShieldAlert size={14} /> : <UserCircle size={14} />}
                      {u.role?.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {u.role !== 'admin' && (
                        <>
                          <button 
                            className="icon-btn text-blue" 
                            title="Foydalanuvchi Analitikasi"
                            onClick={() => openUserAnalytics(u)}
                            style={{ color: '#3B82F6' }}
                          >
                            <BarChart2 size={16} />
                          </button>
                          <button 
                            className="icon-btn text-green" 
                            title="Ta'rifni o'zgartirish"
                            onClick={() => openPlanModal(u)}
                            style={{ color: '#10B981' }}
                          >
                            <CreditCard size={16} />
                          </button>
                          <button 
                            className={`icon-btn ${u.is_suspended ? 'text-blue' : 'text-red'}`} 
                            title={u.is_suspended ? "Blokdan chiqarish" : "Bloklash"}
                            onClick={() => toggleSuspend(u.id, u.is_suspended)}
                          >
                            <Ban size={16} />
                          </button>
                          <button 
                            className="icon-btn text-yellow" 
                            title="Natijalarni tozalash"
                            onClick={() => resetProgress(u.id)}
                          >
                            <RefreshCcw size={16} color="#2563EB" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
              
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'rgba(15, 23, 42, 0.5)' }}>
                    Topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '6px 12px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
            >Oldingi</button>
            <span style={{ padding: '6px 12px', color: 'rgba(15, 23, 42, 0.4)' }}>{currentPage} / {totalPages}</span>
            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '6px 12px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
            >Keyingi</button>
          </div>
        )}
      </div>

      {/* Plan Modal */}
      {selectedUserForPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="fade-in-up" style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A' }}>Ta'rifni O'zgartirish</h3>
              <button onClick={() => setSelectedUserForPlan(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleChangePlan}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>Foydalanuvchi</label>
                <div style={{ padding: '10px 12px', background: '#F1F5F9', borderRadius: '8px', fontSize: '14px', color: '#0F172A' }}>
                  {selectedUserForPlan.full_name || selectedUserForPlan.id}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>Yangi Ta'rif</label>
                <select 
                  value={newPlan} 
                  onChange={(e) => setNewPlan(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', outline: 'none' }}
                >
                  <option value="free">Bepul Sinov (Free)</option>
                  <option value="plus">Plus</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              {newPlan !== 'free' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>Amal qilish muddati (ixtiyoriy)</label>
                  <input 
                    type="date" 
                    value={newPlanExpiry}
                    onChange={(e) => setNewPlanExpiry(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>Kiritilmasa, 1 oyga belgilanadi.</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => setSelectedUserForPlan(null)}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                >
                  Bekor qilish
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '10px', background: '#2563EB', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {analyticsModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="fade-in-up" style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={20} color="#2563EB" /> 
                Shaxsiy Analitika
              </h3>
              <button onClick={() => setAnalyticsModalUser(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '20px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.05)' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0F172A' }}>{analyticsModalUser.full_name || analyticsModalUser.id}</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>{analyticsModalUser.phone || 'Telefon kiritilmagan'}</div>
            </div>

            {userAnalyticsStats.loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B' }}>Ma'lumotlar yuklanmoqda...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F1F5F9', borderRadius: '8px' }}>
                  <span style={{ color: '#334155', fontWeight: '500' }}>Jami yechilgan savollar:</span>
                  <span style={{ fontWeight: 'bold', color: '#0F172A' }}>{userAnalyticsStats.totalAttempts}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#ECFDF5', borderRadius: '8px' }}>
                  <span style={{ color: '#065F46', fontWeight: '500' }}>To'g'ri topilgan javoblar:</span>
                  <span style={{ fontWeight: 'bold', color: '#059669' }}>
                    {userAnalyticsStats.correctAttempts} 
                    <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>
                      ({userAnalyticsStats.totalAttempts > 0 ? Math.round((userAnalyticsStats.correctAttempts / userAnalyticsStats.totalAttempts) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#EFF6FF', borderRadius: '8px' }}>
                  <span style={{ color: '#1E40AF', fontWeight: '500' }}>Yechilgan testlar (imtihonlar) soni:</span>
                  <span style={{ fontWeight: 'bold', color: '#2563EB' }}>{userAnalyticsStats.examsTaken}</span>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setAnalyticsModalUser(null)}
              style={{ width: '100%', padding: '12px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '24px', cursor: 'pointer' }}
            >
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
