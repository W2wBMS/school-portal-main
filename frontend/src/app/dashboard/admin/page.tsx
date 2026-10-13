"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, BookOpen, CircleDollarSign, ClipboardList, RotateCw, ShieldCheck, Users, CalendarCheck2, CalendarDays, TrendingUp, Activity } from 'lucide-react';
import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('portal_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const [usersRes, coursesRes, feesRes] = await Promise.all([
        fetch(`${API_BASE}/users`, { credentials: 'include', headers }),
        fetch(`${API_BASE}/portal/courses`, { credentials: 'include', headers }),
        fetch(`${API_BASE}/portal/fees`, { credentials: 'include', headers }),
      ]);

      const [usersData, coursesData, feesData] = await Promise.all([
        parseJsonResponse<{ users: any[] }>(usersRes, 'Unable to load users directory').catch(() => ({ users: [] })),
        parseJsonResponse<{ courses: any[] }>(coursesRes, 'Unable to load courses').catch(() => ({ courses: [] })),
        parseJsonResponse<{ fees: any[] }>(feesRes, 'Unable to load fees').catch(() => ({ fees: [] })),
      ]);

      setUsers(usersData.users || []);
      setCourses(coursesData.courses || []);
      setFees(feesData.fees || []);

      if (!usersRes.ok && usersRes.status === 401) {
        setError('Your session has expired. Please sign out and sign back in to refresh live operational data.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to live service.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const outstanding = fees.reduce((sum, fee) => sum + Number(fee.balance || 0), 0);
  const students = users.filter(u => u.role === 'student').length;
  const lecturers = users.filter(u => u.role === 'lecturer').length;

  const stats = [
    { label: 'Total users', value: loading ? '—' : users.length, icon: Users, tone: 'crimson', live: true },
    { label: 'Active courses', value: loading ? '—' : courses.length, icon: BookOpen, tone: 'gold', live: true },
    { label: 'Students enrolled', value: loading ? '—' : students, icon: TrendingUp, tone: 'green', live: false },
    { label: 'Outstanding fees', value: loading ? '—' : `GH¢ ${outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: CircleDollarSign, tone: 'slate', live: true },
  ];

  const quickLinks = [
    { label: 'User directory', desc: 'Manage accounts & roles', href: '/dashboard/admin/users', icon: Users },
    { label: 'Attendance', desc: 'Review class records', href: '/dashboard/admin/attendance', icon: CalendarCheck2 },
    { label: 'Fee management', desc: 'Track balances & ledger', href: '/dashboard/admin/fees', icon: CircleDollarSign },
    { label: 'Timetable', desc: 'Schedule & sessions', href: '/dashboard/admin/timetable', icon: CalendarDays },
    { label: 'Course catalogue', desc: 'Browse all courses', href: '/dashboard/admin/courses', icon: BookOpen },
    { label: 'Service requests', desc: 'Pending student queries', href: '/dashboard/admin/requests', icon: ClipboardList },
  ];

  return (
    <div className="pg-page">
      {/* ── Hero ── */}
      <div className="pg-hero">
        <div className="pg-hero-orb pg-hero-orb-1" />
        <div className="pg-hero-orb pg-hero-orb-2" />
        <p className="pg-hero-eyebrow">Operations console</p>
        <h2>A clearer view of the institution.</h2>
        <p>Monitor people, learning, and financial operations from one dependable control surface.</p>
        <div className="pg-hero-actions">
          <Link href="/dashboard/admin/users" className="pg-hero-btn-primary">
            Manage users <ArrowUpRight size={16} />
          </Link>
          <Link href="/dashboard/admin/courses" className="pg-hero-btn-ghost">
            Course catalogue <BookOpen size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 20 }}>
          <div className="pg-alert pg-alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboard()}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff',
                border: '1px solid #dcd7cf',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} /> Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="pg-stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {stats.map((s) => (
          <div key={s.label} className="pg-stat">
            <div className="pg-stat-top">
              <div className={`pg-stat-icon ${s.tone}`}><s.icon size={20} /></div>
              {s.live && <span className="pg-stat-live">Live</span>}
            </div>
            <div>
              <div className="pg-stat-value">{s.value}</div>
              <div className="pg-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column lower section ── */}
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {/* Quick links */}
        <div className="pg-card">
          <div className="pg-form-section" style={{ borderBottom: '1px solid #f0ebe4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p className="pg-eyebrow">Control centre</p>
                <h3 style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 20, letterSpacing: '-.03em', color: '#11222d' }}>
                  Daily operations
                </h3>
              </div>
              <ShieldCheck size={22} color="#a51c30" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 0 }}>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 20px',
                  borderBottom: '1px solid #f5f0eb', borderRight: '1px solid #f5f0eb',
                  color: 'inherit', textDecoration: 'none', transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#faf7f4')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ display: 'grid', width: 36, height: 36, placeItems: 'center', borderRadius: 9, background: '#fde8ea', color: '#a51c30' }}>
                  <link.icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#11222d' }}>{link.label}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{link.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* System status */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Status card */}
          <div className="pg-card" style={{ background: 'linear-gradient(135deg, #11222d 0%, #1e3a5f 100%)', border: 'none', color: '#fff' }}>
            <div style={{ padding: '28px 28px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', margin: '0 0 12px' }}>
                System pulse
              </p>
              <h3 style={{ margin: '0 0 10px', fontFamily: 'Georgia, serif', fontSize: 22, letterSpacing: '-.03em' }}>
                Everything in one place.
              </h3>
              <p style={{ margin: '0 0 22px', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,.68)' }}>
                Academic and administrative records — close, current, and easy to act on.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#d7bd82' }}>
                <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,.2)' }} />
                All services operational
              </div>
            </div>
          </div>

          {/* Lecturers stat */}
          <div className="pg-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'grid', width: 52, height: 52, placeItems: 'center', borderRadius: 14, background: '#fde8ea', color: '#a51c30', flexShrink: 0 }}>
              <Activity size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Faculty</p>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.04em', color: '#11222d' }}>
                {loading ? '—' : lecturers}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Lecturers registered</div>
            </div>
            <Link href="/dashboard/admin/users" style={{ display: 'grid', width: 34, height: 34, placeItems: 'center', borderRadius: 8, background: '#fde8ea', color: '#a51c30', flexShrink: 0 }}>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
