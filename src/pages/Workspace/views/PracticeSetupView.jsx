import React, { useState, useEffect } from 'react';
import { Play, Filter } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export default function PracticeSetupView({ lang, onStartPractice }) {
  const [subject, setSubject] = useState('Matematika');
  const [difficulty, setDifficulty] = useState([]);
  const [count, setCount] = useState(10);
  const [matchingCount, setMatchingCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      let testIds = [];
      let queryTests = supabase.from('mock_tests').select('id').eq('is_premium', false);
      if (subject) {
        queryTests = queryTests.ilike('subject', `%${subject}%`);
      }
      
      const { data: testData } = await queryTests;
      if (testData && testData.length > 0) {
        testIds = testData.map(t => t.id);
      }

      let query = supabase.from('questions').select('*', { count: 'exact', head: true });
      
      if (testIds.length > 0) {
        query = query.in('test_id', testIds);
      } else {
        // No tests found for this subject
        setMatchingCount(0);
        return;
      }

      if (difficulty.length > 0) {
        query = query.in('difficulty', difficulty);
      }
      
      const { count: dbCount } = await query;
      setMatchingCount(dbCount || 0);
    }
    fetchCount();
  }, [subject, difficulty]);

  const toggleDifficulty = (level) => {
    setDifficulty(prev => 
      prev.includes(level) ? prev.filter(d => d !== level) : [...prev, level]
    );
  };

  return (
    <div className="practice-setup-container" style={{ padding: '24px' }}>
      <h2>{lang === 'uz' ? 'Amaliyot rejimi' : 'Режим практики'}</h2>
      <p style={{ color: 'rgba(15, 23, 42, 0.5)', marginBottom: '24px' }}>Savollarni mavzu va qiyinlik darajasi bo'yicha filtrlang.</p>
      
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.1)', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={18} /> Filtrlar
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Fan</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.15)' }}>
            <option value="Matematika">Matematika</option>
            <option value="Fizika">Fizika</option>
            <option value="Ona tili va adabiyot">Ona tili va adabiyot</option>
            <option value="Kimyo">Kimyo</option>
            <option value="Biologiya">Biologiya</option>
            <option value="Tarix">Tarix</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Qiyinlik darajasi</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['easy', 'medium', 'hard'].map(level => (
              <button 
                key={level}
                onClick={() => toggleDifficulty(level)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${difficulty.includes(level) ? '#2563EB' : 'rgba(15, 23, 42, 0.1)'}`,
                  background: difficulty.includes(level) ? 'rgba(37, 99, 235, 0.08)' : 'white',
                  color: difficulty.includes(level) ? '#2563EB' : 'rgba(15, 23, 42, 0.6)',
                  cursor: 'pointer'
                }}
              >
                {level === 'easy' ? 'Oson' : level === 'medium' ? 'O\'rtacha' : 'Qiyin'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Savollar soni: {count}</label>
          <input 
            type="range" 
            min="5" 
            max="50" 
            step="5" 
            value={count} 
            onChange={(e) => setCount(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A' }}>{matchingCount}</span>
            <span style={{ color: 'rgba(15, 23, 42, 0.5)', marginLeft: '8px' }}>ta savol topildi</span>
          </div>
          <button 
            onClick={() => onStartPractice({ subject, difficulty, count })}
            disabled={matchingCount === 0}
            style={{
              padding: '12px 24px',
              background: matchingCount === 0 ? 'rgba(15, 23, 42, 0.4)' : '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: matchingCount === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={18} fill="currentColor" /> Boshlash
          </button>
        </div>
      </div>
    </div>
  );
}
