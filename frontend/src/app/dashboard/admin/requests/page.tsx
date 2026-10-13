"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, MessageSquare, Clock, User } from 'lucide-react';
import { API_BASE } from '@/lib/config';

type RequestItem = {
  _id: string;
  subject: string;
  description: string;
  status: string;
  response?: string;
  studentId?: { fullName?: string; email?: string };
  createdAt?: string;
};

function statusBadgeClass(status: string) {
  if (status === 'resolved') return 'pg-badge-green';
  if (status === 'pending') return 'pg-badge-amber';
  return 'pg-badge-slate';
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/v1/requests`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        setItems(data.requests || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load requests'));
  }, []);

  async function update(item: RequestItem) {
    const responseText = window.prompt('Response to student', item.response || '');
    if (responseText === null) return;
    const response = await fetch(`${API_BASE}/v1/requests/${item._id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
      body: JSON.stringify({ response: responseText, status: 'resolved' }),
    });
    if (response.ok) {
      const data = await response.json();
      setItems((cur) => cur.map((e) => e._id === item._id ? data.request : e));
      setSuccess('Request resolved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    }
  }

  const pending = items.filter(i => i.status !== 'resolved').length;
  const resolved = items.filter(i => i.status === 'resolved').length;

  return (
    <div className="pg-page">
      {/* Header */}
      <div className="pg-card">
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="pg-eyebrow">Student services</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Service requests</h1>
            <p className="pg-page-subtitle">Review and respond to student queries and service requests.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ textAlign: 'center', background: '#fdf3dc', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pending</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309' }}>{pending}</div>
            </div>
            <div style={{ textAlign: 'center', background: '#e8f7ef', borderRadius: 10, padding: '10px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Resolved</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a6641' }}>{resolved}</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-success"><CheckCircle2 size={15} style={{ flexShrink: 0 }} />{success}</div>
          </div>
        )}

        {/* Requests */}
        {items.length === 0 ? (
          <div className="pg-empty">
            <ClipboardList size={40} />
            <p>No service requests at this time.</p>
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div key={item._id} className="req-card">
                <div className="req-card-head">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 className="req-card-title">{item.subject}</h3>
                      <span className={`pg-badge ${statusBadgeClass(item.status)}`}>{formatStatus(item.status)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} className="req-card-meta">
                        <User size={12} />
                        {item.studentId?.fullName || 'Student'}
                      </div>
                      {item.studentId?.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} className="req-card-meta">
                          <MessageSquare size={12} />
                          {item.studentId.email}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.status !== 'resolved' && (
                    <button onClick={() => update(item)} className="pg-btn pg-btn-primary pg-btn-sm" style={{ flexShrink: 0 }}>
                      Resolve
                    </button>
                  )}
                </div>
                <p className="req-card-body">{item.description}</p>
                {item.response && (
                  <div className="req-response">
                    <strong style={{ color: '#a51c30', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Response:</strong>
                    <br />
                    {item.response}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
