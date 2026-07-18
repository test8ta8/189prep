import React, { useState, useEffect } from 'react';
import { Bookmark, Play } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export default function BookmarksView({ lang, onStartMistakeRetry }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookmarks')
      .select('question_id, created_at, questions(text, topic)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setBookmarks(data);
    }
    setLoading(false);
  }

  const removeBookmark = async (questionId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('bookmarks').delete().match({ user_id: user.id, question_id: questionId });
    setBookmarks(prev => prev.filter(b => b.question_id !== questionId));
  };

  if (loading) {
    return <div style={{ padding: '24px' }}>Yuklanmoqda...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>{lang === 'uz' ? 'Eslatmalar' : 'Закладки'} ({bookmarks.length})</h2>
        {bookmarks.length > 0 && (
          <button 
            onClick={() => onStartMistakeRetry(bookmarks.map(b => b.question_id))}
            style={{ padding: '8px 16px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Play size={16} fill="currentColor" /> Barchasini ishlash
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.1)', color: 'rgba(15, 23, 42, 0.5)' }}>
          <Bookmark size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>Sizda saqlangan savollar yo'q</h3>
          <p>Amaliyot yoki imtihon davomida muhim savollarni saqlab qo'yishingiz mumkin.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {bookmarks.map(b => (
            <div key={b.question_id} style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', background: 'rgba(37, 99, 235, 0.1)', padding: '4px 8px', borderRadius: '4px', color: '#0F172A', marginBottom: '8px', display: 'inline-block' }}>
                  {b.questions?.topic || 'Umumiy'}
                </span>
                <p style={{ margin: 0, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {b.questions?.text}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                <button 
                  onClick={() => removeBookmark(b.question_id)}
                  style={{ padding: '6px 12px', background: 'white', color: '#0F172A', border: '1px solid rgba(15, 23, 42, 0.1)', borderRadius: '6px', cursor: 'pointer' }}
                >
                  O'chirish
                </button>
                <button 
                  onClick={() => onStartMistakeRetry([b.question_id])}
                  style={{ padding: '6px 12px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Ishlash
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
