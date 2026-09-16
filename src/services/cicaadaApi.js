import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3002';

export async function startAudit(url) {
  const res = await fetch(`${API_BASE}/api/audits/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start audit');
  }
  
  return res.json();
}

export async function fetchAudit(id) {
  const res = await fetch(`${API_BASE}/api/audits/${id}`);
  if (!res.ok) throw new Error('Audit not found');
  return res.json();
}

export async function startMultilingualAudit(parentAuditId, languages) {
  const res = await fetch(`${API_BASE}/api/audits/${parentAuditId}/multilingual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ languages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start multilingual audit');
  }

  return res.json();
}

export async function fetchMultilingualAudit(parentAuditId) {
  const res = await fetch(`${API_BASE}/api/audits/${parentAuditId}/multilingual`);
  if (!res.ok) throw new Error('Failed to fetch multilingual audit details');
  return res.json();
}

export function connectAuditSocket(auditId, onProgress, onComplete, onError) {
  if (!auditId) return null;

  const socket = io(API_BASE, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    socket.emit('join:audit', auditId);
  });

  socket.on('audit:progress', ({ progress }) => {
    if (onProgress) onProgress(progress);
  });

  socket.on('audit:complete', () => {
    if (onComplete) onComplete();
  });

  socket.on('audit:error', ({ error }) => {
    if (onError) onError(error);
  });

  return {
    disconnect: () => {
      socket.emit('leave:audit', auditId);
      socket.disconnect();
    }
  };
}
