import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Clock, Pause } from 'lucide-react';

const ExamTimer = forwardRef(({ 
  initialTimeLeft, 
  durationMinutes, 
  isPaused, 
  submitting, 
  onTimeUp, 
  mode,
  pauseCount,
  pauseTimeLeft,
  onPauseToggle
}, ref) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  useImperativeHandle(ref, () => ({
    getTimeLeft: () => timeLeft,
    setTimeLeft: (t) => setTimeLeft(t)
  }));

  useEffect(() => {
    // If the parent updates initialTimeLeft (e.g. from recovery), sync it
    setTimeLeft(initialTimeLeft);
  }, [initialTimeLeft]);

  useEffect(() => {
    if (isPaused || submitting || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        // Save time to local storage efficiently
        localStorage.setItem('recovered_exam_time', String(next));
        if (next <= 0) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused, submitting, timeLeft, onTimeUp]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerPercent = durationMinutes ? ((timeLeft / (durationMinutes * 60)) * 100) : 100;

  if (mode === 'pdf') {
    return (
      <div style={{ background: '#EFF6FF', padding: '6px 12px', borderRadius: '8px', color: '#2563EB', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={16} />
        {formatTime(timeLeft)}
      </div>
    );
  }

  return (
    <div className="exam-timer-box">
      <div className="timer-label">Qolgan vaqt</div>
      <div className="timer-display">
        <div className="timer-time">{formatTime(timeLeft)}</div>
        <button
          className="timer-pause"
          onClick={onPauseToggle}
          disabled={!isPaused && (pauseCount >= 2 || pauseTimeLeft <= 0)}
          style={{ opacity: (!isPaused && (pauseCount >= 2 || pauseTimeLeft <= 0)) ? 0.5 : 1 }}
          title={`Pauza qolgan: ${2 - pauseCount} marta, ${Math.floor(pauseTimeLeft / 60)} daqiqa`}
        >
          <Pause size={18} fill={isPaused ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="timer-progress">
        <div className="timer-progress-fill" style={{ width: `${timerPercent}%` }}></div>
      </div>
    </div>
  );
});

export default React.memo(ExamTimer);
