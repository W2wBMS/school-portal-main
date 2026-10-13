"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck2 } from 'lucide-react';
import { fetchStudentOverview, type AttendanceRow } from '@/lib/portal';

function pctClass(pct: number) {
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'warn';
  return 'danger';
}

function pctBarClass(pct: number) {
  if (pct >= 75) return 'green';
  if (pct >= 60) return 'warning';
  return '';
}

export default function StudentAttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const overview = await fetchStudentOverview();
        setAttendance(overview.attendance || []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load attendance');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const avg = attendance.length
    ? Math.round(attendance.reduce((sum, r) => sum + Number(r.percentage || 0), 0) / attendance.length)
    : 0;

  const atRisk = attendance.filter(r => Number(r.percentage) < 75).length;

  return (
    <div className="pg-page">
      {/* Summary */}
      <div className="pg-stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="pg-stat">
          <div className="pg-stat-top">
            <div className="pg-stat-icon crimson"><CalendarCheck2 size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value">{loading ? '—' : `${avg}%`}</div>
            <div className="pg-stat-label">Overall average</div>
          </div>
        </div>
        <div className="pg-stat">
          <div className="pg-stat-top">
            <div className="pg-stat-icon green"><CalendarCheck2 size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value">{loading ? '—' : attendance.length}</div>
            <div className="pg-stat-label">Courses tracked</div>
          </div>
        </div>
        {atRisk > 0 && (
          <div className="pg-stat" style={{ border: '1px solid #fecaca' }}>
            <div className="pg-stat-top">
              <div className="pg-stat-icon" style={{ background: '#fff1f2', color: '#be123c' }}><AlertCircle size={20} /></div>
            </div>
            <div>
              <div className="pg-stat-value" style={{ color: '#be123c' }}>{atRisk}</div>
              <div className="pg-stat-label" style={{ color: '#be123c' }}>Courses at risk (&lt;75%)</div>
            </div>
          </div>
        )}
      </div>

      {/* Course attendance table */}
      <div className="pg-card">
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #f0ebe4' }}>
          <p className="pg-eyebrow">Academic progress</p>
          <h1 className="pg-page-title" style={{ marginTop: 6 }}>Attendance record</h1>
          <p className="pg-page-subtitle">Your attendance by course. A minimum of 75% is required to sit exams.</p>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="pg-shimmer" style={{ height: 72 }} />)}
          </div>
        ) : attendance.length === 0 ? (
          <div className="pg-empty">
            <CalendarCheck2 size={40} />
            <p>No attendance data available yet.</p>
          </div>
        ) : (
          <div>
            {attendance.map((row, index) => {
              const pct = Number(row.percentage || 0);
              const cls = pctClass(pct);
              const barCls = pctBarClass(pct);
              return (
                <div key={`${row.courseId?.code || 'att'}-${index}`} className="att-bar-row">
                  <div className="att-bar-top">
                    <div style={{ minWidth: 0 }}>
                      <div className="att-bar-course">
                        {row.courseId?.code || 'Course'} — {row.courseId?.title || 'Attendance'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span className={`att-bar-pct ${cls}`}>{pct}%</span>
                      {cls === 'danger' && <span className="pg-badge pg-badge-red">At risk</span>}
                      {cls === 'warn' && <span className="pg-badge pg-badge-amber">Low</span>}
                      {cls === 'good' && <span className="pg-badge pg-badge-green">Good</span>}
                    </div>
                  </div>
                  <div className="pg-progress">
                    <div className={`pg-progress-fill ${barCls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
