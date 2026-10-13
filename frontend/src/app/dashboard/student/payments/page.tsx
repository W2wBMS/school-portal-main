"use client";

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CircleDollarSign, Clock } from 'lucide-react';

import { API_BASE } from '@/lib/config';

type Fee = {
  _id: string;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  semester: string;
};

type Payment = {
  _id: string;
  reference: string;
  studentReference?: string;
  paymentMethod?: string;
  status: string;
  amount: number;
  feeLedgerId?: { invoiceNumber?: string } | string;
  createdAt?: string;
  verificationNote?: string;
};

type Notice = { _id: string; title: string; message: string; readAt?: string; createdAt?: string };

function authHeaders(contentType = false) {
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
  };
}

export default function PaymentsPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [studentReference, setStudentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const requestKey = useRef<string | null>(null);

  const outstanding = fees.reduce((sum, fee) => sum + Number(fee.balance || 0), 0);
  const totalPaid = fees.reduce((sum, fee) => sum + Number(fee.amountPaid || 0), 0);
  const selectedFee = fees.find((fee) => fee._id === selectedFeeId);
  const paymentNotices = notices.filter((notice) => notice.title.toLowerCase().includes('payment'));

  useEffect(() => {
    async function loadFinanceData() {
      try {
        const headers = authHeaders();
        const [feesResponse, paymentsResponse, noticesResponse] = await Promise.all([
          fetch(`${API_BASE}/v1/fees`, { credentials: 'include', headers }),
          fetch(`${API_BASE}/v1/payments`, { credentials: 'include', headers }),
          fetch(`${API_BASE}/v1/notifications`, { credentials: 'include', headers }),
        ]);
        if (!feesResponse.ok || !paymentsResponse.ok || !noticesResponse.ok) throw new Error('Unable to load your finance records. Refresh and try again.');
        const [feeData, paymentData, noticeData] = await Promise.all([feesResponse.json(), paymentsResponse.json(), noticesResponse.json()]);
        const loadedFees = feeData.fees || [];
        setFees(loadedFees);
        setPayments(paymentData.payments || []);
        setNotices(noticeData.notifications || []);
        const firstUnpaid = loadedFees.find((fee: Fee) => Number(fee.balance) > 0);
        if (firstUnpaid) {
          setSelectedFeeId(firstUnpaid._id);
          setAmount(String(firstUnpaid.balance));
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load your finance records.');
      } finally {
        setLoading(false);
      }
    }

    loadFinanceData();
  }, []);

  function selectInvoice(invoiceId: string) {
    setSelectedFeeId(invoiceId);
    const fee = fees.find((row) => row._id === invoiceId);
    setAmount(fee ? String(fee.balance) : '');
  }

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!selectedFee || Number(amount) <= 0 || Number(amount) > selectedFee.balance) {
      setError('Enter an amount greater than zero and no higher than the selected invoice balance.');
      return;
    }

    setSubmitting(true);
    try {
      requestKey.current ||= crypto.randomUUID();
      const response = await fetch(`${API_BASE}/v1/payments/initialize`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({
          feeLedgerId: selectedFee._id,
          amount: Number(amount),
          studentReference: studentReference.trim(),
          paymentMethod,
          idempotencyKey: requestKey.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to submit payment for verification.');
      setReference(data.reference);
      setPayments((current) => [data.payment, ...current.filter((item) => item._id !== data.payment._id)]);
      setMessage(`Submitted for staff verification. Your portal reference is ${data.reference}.`);
      setStudentReference('');
      requestKey.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit payment for verification.');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkStatus(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API_BASE}/v1/payments/${encodeURIComponent(reference.trim())}`, { credentials: 'include', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Payment not found.');
      setPayments((current) => [data.payment, ...current.filter((item) => item._id !== data.payment._id)]);
      setMessage(`Payment ${data.payment.status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to check payment status.');
    }
  }

  async function markNoticeRead(notice: Notice) {
    try {
      const response = await fetch(`${API_BASE}/v1/notifications/${notice._id}/read`, { method: 'PATCH', credentials: 'include', headers: authHeaders() });
      if (!response.ok) return;
      setNotices((current) => current.map((item) => item._id === notice._id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch {
      setError('Unable to update notification.');
    }
  }

  return (
    <div className="pg-page">
      {/* ── Stats ── */}
      <div className="pg-stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="pg-stat hover-lift">
          <div className="pg-stat-top"><div className="pg-stat-icon green"><CircleDollarSign size={20} /></div></div>
          <div>
            <div className="pg-stat-value" style={{ color: '#15803d' }}>GH¢ {totalPaid.toFixed(2)}</div>
            <div className="pg-stat-label">Total fees paid</div>
          </div>
        </div>
        <div className="pg-stat hover-lift">
          <div className="pg-stat-top"><div className="pg-stat-icon gold"><CircleDollarSign size={20} /></div></div>
          <div>
            <div className="pg-stat-value" style={{ color: '#8a6a2f' }}>GH¢ {outstanding.toFixed(2)}</div>
            <div className="pg-stat-label">Outstanding balance</div>
          </div>
        </div>
        <div className="pg-stat hover-lift">
          <div className="pg-stat-top"><div className="pg-stat-icon crimson"><Clock size={20} /></div></div>
          <div>
            <div className="pg-stat-value">{payments.filter((item) => item.status === 'pending').length}</div>
            <div className="pg-stat-label">Awaiting review</div>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="pg-card">
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="pg-eyebrow">Finance</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Fees and payments</h1>
            <p className="pg-page-subtitle">Report a payment you have already made and track its staff verification status.</p>
          </div>
          <a href="/dashboard/student/fees" className="pg-btn pg-btn-outline" style={{ textDecoration: 'none' }}>Open fee statement</a>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}
        {message && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-success"><CheckCircle size={15} style={{ flexShrink: 0 }} />{message}</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 0 }}>
          {/* ── Report form ── */}
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #f0ebe4' }}>
            <p className="pg-eyebrow" style={{ marginBottom: 6 }}>Submit a payment</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Submit only after paying through an approved university channel. Finance staff will verify the transaction reference.
            </p>
            <form onSubmit={submitPayment} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label htmlFor="invoice" className="pg-label">Invoice</label>
                <select id="invoice" required value={selectedFeeId} onChange={(event) => selectInvoice(event.target.value)} className="pg-select">
                  <option value="">Select an outstanding invoice</option>
                  {fees.filter((fee) => Number(fee.balance) > 0).map((fee) => (
                    <option key={fee._id} value={fee._id}>{fee.invoiceNumber} · {fee.semester} · GH¢ {Number(fee.balance).toFixed(2)} due</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <div>
                  <label htmlFor="amount" className="pg-label">Amount (GH¢)</label>
                  <input id="amount" required min="0.01" max={selectedFee?.balance} step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="pg-input" />
                </div>
                <div>
                  <label htmlFor="method" className="pg-label">Payment method</label>
                  <select id="method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="pg-select">
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="mobile_money">Mobile money (MTN / Telecel)</option>
                    <option value="cash">Cash at finance office</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="transaction-reference" className="pg-label">Bank / Transaction / Receipt reference</label>
                <input id="transaction-reference" required maxLength={100} value={studentReference} onChange={(event) => setStudentReference(event.target.value)} placeholder="Reference shown on your receipt or bank confirmation" className="pg-input" />
              </div>
              {selectedFee && (
                <div className="pg-alert pg-alert-info" style={{ fontSize: 12 }}>
                  Remaining balance on this invoice: <strong>GH¢ {Number(selectedFee.balance).toFixed(2)}</strong>
                </div>
              )}
              <div>
                <button disabled={submitting || !selectedFee} className="pg-btn pg-btn-primary hover-lift" style={{ minWidth: 200 }}>
                  {submitting ? 'Submitting...' : 'Submit for verification'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Payment history ── */}
          <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
              <div>
                <p className="pg-eyebrow" style={{ marginBottom: 4 }}>Payment history</p>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Track previously submitted payment references.</p>
              </div>
              <form onSubmit={checkStatus} style={{ display: 'flex', gap: 8 }}>
                <input required aria-label="Portal payment reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Portal reference…" className="pg-input" style={{ minWidth: 0, width: 200 }} />
                <button className="pg-btn pg-btn-outline">Check status</button>
              </form>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 88 }} />)}
                </div>
              ) : payments.length === 0 ? (
                <div className="pg-empty">
                  <CircleDollarSign size={36} />
                  <p>No payment submissions yet.</p>
                </div>
              ) : payments.map((item) => {
                const invoiceName = typeof item.feeLedgerId === 'object' ? item.feeLedgerId?.invoiceNumber : undefined;
                const statusBadge =
                  item.status === 'successful' ? 'pg-badge-green' :
                  item.status === 'pending' ? 'pg-badge-amber' : 'pg-badge-red';
                const statusLabel =
                  item.status === 'successful' ? 'Verified' :
                  item.status === 'pending' ? 'Awaiting review' : 'Rejected';
                return (
                  <div key={item._id} style={{ border: '1px solid #f0ebe4', borderRadius: 12, padding: '16px 20px', background: '#fdfcfb', transition: 'background 0.15s' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#11222d' }}>{invoiceName || item.reference}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Portal ref: {item.reference}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                          Submitted ref: {item.studentReference || 'Not provided'} · {item.paymentMethod?.replace('_', ' ') || 'Legacy payment'}
                        </div>
                      </div>
                      <span className={`pg-badge ${statusBadge}`}>{statusLabel}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0ebe4', paddingTop: 12, fontSize: 13 }}>
                      <span style={{ color: '#64748b' }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Payment'}</span>
                      <strong style={{ color: '#15803d', fontSize: 15 }}>GH¢ {Number(item.amount).toFixed(2)}</strong>
                    </div>
                    {item.verificationNote && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#faf8f5', borderRadius: 8, borderLeft: '3px solid #a51c30', fontSize: 13, color: '#475569' }}>
                        Staff note: {item.verificationNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notifications ── */}
      {paymentNotices.length > 0 && (
        <div className="pg-card">
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #f0ebe4' }}>
            <p className="pg-eyebrow">Payment notifications</p>
          </div>
          <div>
            {paymentNotices.slice(0, 8).map((notice) => (
              <div key={notice._id} className="pg-row" style={{ background: notice.readAt ? 'transparent' : '#fffbf5' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#11222d' }}>{notice.title}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{notice.message}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {notice.createdAt ? new Date(notice.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                {!notice.readAt && (
                  <button onClick={() => markNoticeRead(notice)} className="pg-btn pg-btn-ghost pg-btn-sm">Mark read</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

