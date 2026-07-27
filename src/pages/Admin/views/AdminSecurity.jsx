import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Shield, Key, AlertOctagon, Lock, Activity, Users, Settings } from 'lucide-react';

export default function AdminSecurity() {
  const [activeTab, setActiveTab] = useState('ip_blacklist');
  const [blacklistedIps, setBlacklistedIps] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('admin-security')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ip_blacklist' }, () => {
         loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'login_logs' }, () => {
         loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    try {
      const { data: blacklist } = await supabase.from('ip_blacklist').select('*').order('created_at', { ascending: false });
      if (blacklist) setBlacklistedIps(blacklist);

      const { data: logs } = await supabase.from('login_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(50);
      if (logs) setLoginLogs(logs);
    } catch(e) {
        console.error(e);
    }
    setLoading(false);
  }

  async function handleAddIp(e) {
    e.preventDefault();
    if (!newIp) return;
    
    try {
      await supabase.from('ip_blacklist').insert({ ip_address: newIp, reason: newReason });
      setNewIp('');
      setNewReason('');
      loadBlacklist();
    } catch (e) {
      alert("Xatolik yoki IP allaqachon mavjud");
    }
  }

  async function handleRemoveIp(id) {
    await supabase.from('ip_blacklist').delete().eq('id', id);
    loadBlacklist();
  }

  return (
    <div className="admin-section">
      <div className="admin-header">
        <h2>Xavfsizlik (Security)</h2>
        <p>Tizim xavfsizligini ta'minlash, bloklangan IPlar va sessiyalarni boshqarish.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={`admin-tab ${activeTab === 'ip_blacklist' ? 'active' : ''}`} onClick={() => setActiveTab('ip_blacklist')} style={{ padding: '8px 16px', background: activeTab === 'ip_blacklist' ? '#3b82f6' : 'white', color: activeTab === 'ip_blacklist' ? 'white' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertOctagon size={18} /> IP Qora ro'yxat
        </button>
        <button className={`admin-tab ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')} style={{ padding: '8px 16px', background: activeTab === 'sessions' ? '#3b82f6' : 'white', color: activeTab === 'sessions' ? 'white' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} /> Sessiyalar & Loglar
        </button>
        <button className={`admin-tab ${activeTab === 'api_keys' ? 'active' : ''}`} onClick={() => setActiveTab('api_keys')} style={{ padding: '8px 16px', background: activeTab === 'api_keys' ? '#3b82f6' : 'white', color: activeTab === 'api_keys' ? 'white' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key size={18} /> API Kalitlar
        </button>
        <button className={`admin-tab ${activeTab === '2fa' ? 'active' : ''}`} onClick={() => setActiveTab('2fa')} style={{ padding: '8px 16px', background: activeTab === '2fa' ? '#3b82f6' : 'white', color: activeTab === '2fa' ? 'white' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={18} /> 2FA Sozlamalari
        </button>
      </div>

      <div className="admin-card">
        {activeTab === 'ip_blacklist' && (
          <div>
            <h3>Bloklangan IP manzillar</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
              Qora ro'yxatga kiritilgan IP manzillar tizimga kirolmaydi (API Rate limit yoki DDoS xavfi).
            </p>
            
            <form onSubmit={handleAddIp} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <input 
                type="text" 
                placeholder="IP manzil (masalan, 192.168.1.1)" 
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', flex: 1 }}
                required
              />
              <input 
                type="text" 
                placeholder="Bloklash sababi" 
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', flex: 2 }}
              />
              <button type="submit" style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Bloklash
              </button>
            </form>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>IP Manzil</th>
                  <th>Sabab</th>
                  <th>Sana</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {blacklistedIps.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.ip_address}</strong></td>
                    <td>{item.reason}</td>
                    <td>{new Date(item.created_at).toLocaleString('uz-UZ')}</td>
                    <td>
                      <button onClick={() => handleRemoveIp(item.id)} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Olib tashlash
                      </button>
                    </td>
                  </tr>
                ))}
                {blacklistedIps.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>Qora ro'yxat bo'sh</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sessions' && (
           <div>
             <h3>Sessiyalar va Login Loglari</h3>
             <p style={{ color: '#64748b', marginBottom: '16px' }}>Muvaffaqiyatli va muvaffaqiyatsiz kirishlar tarixi.</p>
             
             <div style={{ overflowX: 'auto' }}>
               <table className="admin-table">
                 <thead>
                   <tr>
                     <th>Foydalanuvchi / Email</th>
                     <th>Holat</th>
                     <th>Sana</th>
                     <th>IP Manzil</th>
                     <th>Qurilma / User-Agent</th>
                   </tr>
                 </thead>
                 <tbody>
                   {loginLogs.map(log => (
                     <tr key={log.id}>
                       <td>
                         <strong>{log.profiles?.full_name || 'Noma\'lum'}</strong><br/>
                         <span style={{ fontSize: '12px', color: '#64748b' }}>{log.email}</span>
                       </td>
                       <td>
                         {log.status === 'success' 
                           ? <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '12px' }}>Muvaffaqiyatli</span>
                           : <span style={{ padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '12px' }}>Muvaffaqiyatsiz<br/><small>{log.failed_reason}</small></span>
                         }
                       </td>
                       <td>{new Date(log.created_at).toLocaleString('uz-UZ')}</td>
                       <td>{log.ip_address}</td>
                       <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.device_info}>
                         {log.device_info}
                       </td>
                     </tr>
                   ))}
                   {loginLogs.length === 0 && (
                     <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px' }}>Loglar yo'q</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {activeTab === 'api_keys' && (
           <div>
             <h3>API Kalitlar va Rate Limitlar</h3>
             <p style={{ color: '#64748b' }}>Tashqi tizimlar bilan integratsiya uchun API kalitlarini boshqarish (Tez orada).</p>
           </div>
        )}

        {activeTab === '2fa' && (
           <div>
             <h3>2FA (Ikki bosqichli autentifikatsiya) Sozlamalari</h3>
             <p style={{ color: '#64748b' }}>Adminlar uchun 2FA majburiy qilish yoki foydalanuvchilar uchun yoqish/o'chirish (Tez orada).</p>
           </div>
        )}
      </div>
    </div>
  );
}
