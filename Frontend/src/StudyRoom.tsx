import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock3, Pause, Play, RotateCcw } from 'lucide-react';
import { apiRequest } from './lib/api';

type StudySession = { id: string; created_at: string };

export default function StudyRoom({ token }: { token: string }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const cache = useQueryClient();
  const start = useMutation({
    mutationFn: () => apiRequest<{ session: StudySession }>('/api/study-sessions', token, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: ({ session }) => { setSessionId(session.id); setSeconds(0); setRunning(true); setMessage(''); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not start this session.'),
  });
  const finish = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/study-sessions/${id}/finish`, token, { method: 'PATCH' }),
    onSuccess: () => { setRunning(false); setSessionId(null); setMessage('Study time saved to your account.'); cache.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (error) => { setRunning(false); setSessionId(null); setMessage(error instanceof Error ? error.message : 'Could not save this session. Apply the latest database migration and try again.'); },
  });
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  function stopAndSave() { if (sessionId) finish.mutate(sessionId); }
  const isSaving = start.isPending || finish.isPending;
  return <div className="section-view"><div className="section-overline">FOCUS MODE</div><div className="section-view-head"><div><h1>Study room</h1><p>Track focused study time. Saved sessions update your dashboard hours.</p></div></div><section className="admin-panel focus-panel"><div className="focus-icon"><Clock3 size={20}/></div><div className="focus-clock" aria-live="polite">{time}</div><p>{running ? 'Focus session in progress' : 'Ready when you are'}</p><div className="focus-actions">{running ? <button className="primary-button" disabled={isSaving} onClick={stopAndSave}><Pause size={15}/> Finish and save</button> : <button className="primary-button" disabled={isSaving} onClick={() => start.mutate()}><Play size={15}/> Start focus session</button>}<button className="secondary-button" disabled={running || seconds === 0 || isSaving} onClick={() => { setSeconds(0); setMessage(''); }}><RotateCcw size={14}/> Reset</button></div>{isSaving && <div className="admin-empty">{start.isPending ? 'Starting session…' : 'Saving session…'}</div>}{message && <div className={start.isError || finish.isError ? 'auth-message' : 'admin-success'}>{message}</div>}</section></div>;
}