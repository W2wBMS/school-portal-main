"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, CircleDollarSign, ArrowUpRight, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { fetchStudentOverview, type FeeLedgerRow } from '@/lib/portal';

function feeStatusBadge(status: string) {
  if (status === 'paid') return 'pg-badge-green';
  if (status === 'partial') return 'pg-badge-amber';
  return 'pg-badge-red';
}

function feeStatusIcon(status: string) {
  if (status === 'paid') return <CheckCircle size={13} />;
  return <Clock size={13} />;
}

export default function StudentFeesPage() {
  const [fees, setFees] = useState<FeeLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const overview = await fetchStudentOverview();
        setFees(overview.feeLedger || []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load fee statement');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const outstanding = fees.reduce((sum, fee) => sum + Number(fee.balance || 0), 0);
  const totalInvoiced = fees.reduce((sum, fee) => sum + Number(fee.amountDue || fee.balance || 0), 0);
  const paidFees = fees.filter(f => f.status === 'paid').length;

  return (
    <div className="pg-page">
      {/* Summary cards */}
      <div className="pg-stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="pg-stat">
          <div className="pg-stat-top">
            <div className="pg-stat-icon gold"><CircleDollarSign size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value" style={{ color: '#8a6a2f' }}>
              {loading ? '—' : `GH¢ ${outstanding.toFixed(2)}`}
            </div>
            <div className="pg-stat-label">Outstanding balance</div>
          </div>
        </div>
        <div className="pg-stat">
          <div className="pg-stat-top">
            <div className="pg-stat-icon green"><CheckCircle size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value">{loading ? '—' : paidFees}</div>
            <div className="pg-stat-label">Invoices cleared</div>
          </div>
        </div>
        <div className="pg-stat">
          <div className="pg-stat-top">
            <div className="pg-stat-icon crimson"><CircleDollarSign size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value">{loading ? '—' : fees.length}</div>
            <div className="pg-stat-label">Total invoices</div>
          </div>
        </div>
      </div>

      {/* Fee list */}
      <div className="pg-card">
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="pg-eyebrow">Finance</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Fee statement</h1>
            <p className="pg-page-subtitle">Review invoices, payments, and current balances.</p>
          </div>
          <Link href="/dashboard/student/payments" className="pg-btn pg-btn-primary" style={{ textDecoration: 'none' }}>
            Make a payment <ArrowUpRight size={15} />
          </Link>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 68 }} />)}
          </div>
        ) : fees.length === 0 ? (
          <div className="pg-empty">
            <CircleDollarSign size={40} />
            <p>No fee records available.</p>
          </div>
        ) : (
          <div>
            {fees.map((row, index) => (
              <div key={`${row.invoiceNumber}-${index}`} className="fee-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'grid', width: 42, height: 42, placeItems: 'center', borderRadius: 11, background: '#fdf3dc', color: '#8a6a2f', flexShrink: 0 }}>
                    <CircleDollarSign size={18} />
                  </div>
                  <div>
                    <div className="fee-label">{row.invoiceNumber}</div>
                    <div className="fee-sub">{row.semester}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="fee-amount">GH¢ {Number(row.balance).toFixed(2)}</div>
                  <div className="fee-status">
                    <span className={`pg-badge ${feeStatusBadge(row.status || 'pending')}`} style={{ gap: 4 }}>
                      {feeStatusIcon(row.status || 'pending')}
                      {(row.status || 'pending').charAt(0).toUpperCase() + (row.status || 'pending').slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total footer */}
        {!loading && outstanding > 0 && (
          <div style={{ padding: '16px 28px', borderTop: '1px solid #f0ebe4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fdf8f5' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Total outstanding</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#8a6a2f' }}>GH¢ {outstanding.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
