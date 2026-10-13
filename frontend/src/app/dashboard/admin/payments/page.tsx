"use client";

import { useEffect, useMemo, useState } from 'react';

import { API_BASE } from '@/lib/config';

type PaymentRow = {
  _id: string;
  reference: string;
  studentReference?: string;
  paymentMethod?: string;
  amount: number;
  status: string;
  createdAt: string;
  verificationNote?: string;
  studentId?: { fullName?: string; email?: string; studentId?: string };
  feeLedgerId?: { invoiceNumber?: string; semester?: string; balance?: number };
};

const authHeaders = (contentType = false) => ({
  ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
});

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [rejectingReference, setRejectingReference] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyReference, setBusyReference] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadPayments() {
    try {
      const response = await fetch(`${API_BASE}/v1/payments/review`, { credentials: 'include', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load payment submissions.');
      setPayments(data.payments || []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load payment submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function reviewPayment(reference: string, decision: 'approve' | 'reject', note = '') {
    setBusyReference(reference);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/v1/payments/${encodeURIComponent(reference)}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ decision, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to update payment.');
      setPayments((current) => current.map((item) => item.reference === reference ? { ...item, status: data.payment.status, verificationNote: data.payment.verificationNote } : item));
      setMessage(decision === 'approve' ? 'Payment verified and applied to its invoice.' : 'Payment rejected and the student has been notified.');
      setRejectingReference('');
      setRejectionNote('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update payment.');
    } finally {
      setBusyReference('');
    }
  }

  const pendingCount = payments.filter((payment) => payment.status === 'pending').length;
  const visiblePayments = useMemo(() => payments.filter((payment) => {
    const matchesStatus = filter === 'all' || payment.status === filter;
    const searchable = `${payment.reference} ${payment.studentReference || ''} ${payment.studentId?.fullName || ''} ${payment.studentId?.studentId || ''} ${payment.feeLedgerId?.invoiceNumber || ''}`.toLowerCase();
    return matchesStatus && searchable.includes(query.trim().toLowerCase());
  }), [payments, filter, query]);

  return (
    <div className="pg-page">
      {/* ── Main card ── */}
      <div className="pg-card">
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="pg-eyebrow">Finance operations</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Payment verification</h1>
            <p className="pg-page-subtitle">Review submitted transaction references before applying funds to invoices.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fdf3dc', borderRadius: 12, padding: '10px 18px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6a2f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Awaiting review</span>
            <strong style={{ fontSize: 22, fontWeight: 900, color: '#8a6a2f' }}>{pendingCount}</strong>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error">{error}</div>
          </div>
        )}
        {message && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-success">{message}</div>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label="Filter payments by status">
            {['pending', 'successful', 'failed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                aria-pressed={filter === status}
                className={`pg-btn pg-btn-sm ${filter === status ? 'pg-btn-primary' : 'pg-btn-ghost'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {status === 'pending' ? `Pending (${pendingCount})` : status === 'successful' ? 'Verified' : status === 'failed' ? 'Rejected' : 'All'}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search student, invoice or reference…"
            className="pg-input"
            style={{ maxWidth: 320 }}
          />
        </div>

        {/* ── Payment rows ── */}
        <section aria-label="Payment submissions">
          {loading ? (
            <div style={{ padding: 24, display: 'grid', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 120 }} />)}
            </div>
          ) : visiblePayments.length === 0 ? (
            <div className="pg-empty">
              <span style={{ fontSize: 36, opacity: 0.3 }}>₵</span>
              <p>No payment submissions match this view.</p>
            </div>
          ) : visiblePayments.map((payment) => {
            const statusBadge =
              payment.status === 'successful' ? 'pg-badge-green' :
              payment.status === 'pending' ? 'pg-badge-amber' : 'pg-badge-red';
            const statusLabel =
              payment.status === 'successful' ? 'Verified' :
              payment.status === 'failed' ? 'Rejected' : 'Pending review';
            return (
              <article key={payment._id} style={{ padding: '20px 28px', borderBottom: '1px solid #f5f0eb' }}>
                {/* Student header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="user-avatar" style={{ flexShrink: 0 }}>
                      {(payment.studentId?.fullName || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#11222d' }}>{payment.studentId?.fullName || 'Student'}</span>
                        <span className="pg-badge pg-badge-slate" style={{ fontSize: 11 }}>{payment.studentId?.studentId || 'No ID'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{payment.studentId?.email || ''}</div>
                    </div>
                  </div>
                  <span className={`pg-badge ${statusBadge}`}>{statusLabel}</span>
                </div>

                {/* Detail grid */}
                <div style={{ display: 'grid', gap: '8px 24px', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', padding: '14px 0', borderTop: '1px solid #f5f0eb', borderBottom: payment.status === 'pending' ? '1px solid #f5f0eb' : 'none', marginBottom: payment.status === 'pending' ? 14 : 0 }}>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Invoice</div><div style={{ fontSize: 13, fontWeight: 700, color: '#11222d' }}>{payment.feeLedgerId?.invoiceNumber || 'Legacy payment'}</div><div style={{ fontSize: 11, color: '#64748b' }}>{payment.feeLedgerId?.semester || ''}</div></div>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Amount</div><div style={{ fontSize: 15, fontWeight: 900, color: '#15803d' }}>GH¢ {Number(payment.amount).toFixed(2)}</div></div>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Method</div><div style={{ fontSize: 13, color: '#11222d', textTransform: 'capitalize' }}>{payment.paymentMethod?.replace('_', ' ') || 'Not recorded'}</div></div>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Submitted</div><div style={{ fontSize: 12, color: '#11222d' }}>{new Date(payment.createdAt).toLocaleString()}</div></div>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Student reference</div><div style={{ fontSize: 12, fontWeight: 700, color: '#11222d', wordBreak: 'break-all' }}>{payment.studentReference || 'Not provided'}</div></div>
                  <div><div className="pg-label" style={{ marginBottom: 2 }}>Portal reference</div><div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>{payment.reference}</div></div>
                  {payment.verificationNote && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="pg-label" style={{ marginBottom: 2 }}>Staff note</div>
                      <div style={{ fontSize: 13, color: '#475569', padding: '8px 12px', background: '#faf8f5', borderRadius: 8, borderLeft: '3px solid #a51c30' }}>{payment.verificationNote}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {payment.status === 'pending' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <button
                      disabled={busyReference === payment.reference}
                      onClick={() => reviewPayment(payment.reference, 'approve')}
                      className="pg-btn pg-btn-primary hover-lift"
                    >
                      Verify & apply
                    </button>
                    {rejectingReference === payment.reference ? (
                      <form
                        onSubmit={(event) => { event.preventDefault(); reviewPayment(payment.reference, 'reject', rejectionNote); }}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1 }}
                      >
                        <input
                          required
                          maxLength={500}
                          value={rejectionNote}
                          onChange={(event) => setRejectionNote(event.target.value)}
                          placeholder="Reason for rejecting…"
                          className="pg-input"
                          style={{ flex: 1, minWidth: 200 }}
                        />
                        <button disabled={busyReference === payment.reference} className="pg-btn pg-btn-danger">Confirm rejection</button>
                        <button type="button" onClick={() => { setRejectingReference(''); setRejectionNote(''); }} className="pg-btn pg-btn-ghost">Cancel</button>
                      </form>
                    ) : (
                      <button onClick={() => setRejectingReference(payment.reference)} className="pg-btn pg-btn-danger">Reject</button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}