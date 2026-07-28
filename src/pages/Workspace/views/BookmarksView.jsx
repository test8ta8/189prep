import React, { useState, useEffect } from 'react';
import { Bookmark, Play, Edit3, Save, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import MathText from '../../../components/MathText';

export default function BookmarksView({ lang, onStartMistakeRetry }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [noteValue, setNoteValue] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  async function loadBookmarks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('bookmarks')
      .select('question_id, created_at, note_text, questions(text, topic, mock_tests(title))')
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

  const saveNote = async (questionId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('bookmarks')
      .update({ note_text: noteValue })
      .match({ user_id: user.id, question_id: questionId });

    if (!error) {
      setBookmarks(prev => prev.map(b => 
        b.question_id === questionId ? { ...b, note_text: noteValue } : b
      ));
      setEditingNote(null);
    } else {
      alert(lang === 'uz' ? 'Eslatmani saqlashda xatolik yuz berdi.' : 'Ошибка при сохранении заметки.');
    }
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
            <div key={b.question_id} style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '12px', background: 'rgba(37, 99, 235, 0.1)', padding: '4px 8px', borderRadius: '4px', color: '#0F172A', marginBottom: '8px', display: 'inline-block' }}>
                    {b.questions?.mock_tests?.title ? b.questions.mock_tests.title : (b.questions?.topic || 'Umumiy')}
                  </span>
                  <div style={{ margin: 0, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    <MathText>{b.questions?.text}</MathText>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
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

              {/* Notes Section */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(15, 23, 42, 0.05)' }}>
                {editingNote === b.question_id ? (
                  <div>
                    <textarea
                      autoFocus
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      placeholder={lang === 'uz' ? 'Eslatma matnini kiriting...' : 'Введите текст заметки...'}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #2563EB', outline: 'none', resize: 'vertical', minHeight: '60px', marginBottom: '8px', fontSize: '14px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => saveNote(b.question_id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <Save size={14} /> {lang === 'uz' ? 'Saqlash' : 'Сохранить'}
                      </button>
                      <button onClick={() => setEditingNote(null)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'rgba(15, 23, 42, 0.05)', color: '#0F172A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <X size={14} /> {lang === 'uz' ? 'Bekor qilish' : 'Отмена'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {b.note_text ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(245, 158, 11, 0.05)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #F59E0B' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#0F172A', whiteSpace: 'pre-wrap' }}>{b.note_text}</p>
                        <button onClick={() => { setEditingNote(b.question_id); setNoteValue(b.note_text); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#F59E0B', padding: '4px' }}>
                          <Edit3 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setEditingNote(b.question_id); setNoteValue(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#64748B', fontSize: '13px', cursor: 'pointer', padding: 0 }}
                      >
                        <Edit3 size={14} /> {lang === 'uz' ? 'Eslatma qo\'shish' : 'Добавить заметку'}
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
