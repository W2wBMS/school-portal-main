"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight, BookOpen, CalendarCheck2, ClipboardList,
  Users, GraduationCap,
} from 'lucide-react';
import NotificationsPanel from '@/components/NotificationsPanel';
import { API_BASE } from '@/lib/config';

type Course = { _id: string; code: string; title: string; credits: number; semester: string };
type Attendance = { _id: string; percentage: number; studentId?: { fullName?: string }; courseId?: { code?: string } };

const COURSE_TONES = ['crimson', 'navy', 'forest', 'amber'] as const;

export default function LecturerDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      const headers = { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` };
      const [coursesRes, attendanceRes] = await Promise.all([
        fetch(`${API_BASE}/portal/courses`, { credentials: 'include', headers }),
        fetch(`${API_BASE}/portal/attendance`, { credentials: 'include', headers }),
      ]);
      if (!coursesRes.ok || !attendanceRes.ok) throw new Error('Unable to load teaching workspace');
      setCourses((await coursesRes.json()).courses || []);
      setAttendance((await attendanceRes.json()).attendance || []);
      setLoading(false);
    }
    loadDashboard().catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Unable to load teaching workspace');
      setLoading(false);
    });
  }, []);

  const averageAttendance = attendance.length
    ? Math.round(attendance.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / attendance.length)
    : 0;

  const stats = [
    { label: 'Assigned courses', value: loading ? '—' : courses.length, icon: BookOpen, tone: 'crimson', live: true },
    { label: 'Attendance entries', value: loading ? '—' : attendance.length, icon: ClipboardList, tone: 'gold', live: true },
    { label: 'Average attendance', value: loading ? '—' : `${averageAttendance}%`, icon: Users, tone: 'green', live: false },
  ];

  return (
    <div className="pg-page">
      {/* ── Hero ── */}
      <div className="pg-hero">
        <div className="pg-hero-orb pg-hero-orb-1" />
        <div className="pg-hero-orb pg-hero-orb-2" />
        <p className="pg-hero-eyebrow">Lecturer workspace</p>
        <h2>Make every class count.</h2>
        <p>Keep your teaching load, attendance records, and course activity in one calm working view.</p>
        <div className="pg-hero-actions">
          <Link href="/dashboard/lecturer/courses" className="pg-hero-btn-primary">
            View courses <ArrowUpRight size={16} />
          </Link>
          <Link href="/dashboard/lecturer/attendance" className="pg-hero-btn-ghost">
            Record attendance <CalendarCheck2 size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="pg-alert pg-alert-error">{error}</div>
      )}

      {/* ── Stats ── */}
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

      {/* ── Two-column section ── */}
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {/* Course list */}
        <div className="pg-card">
          <div style={{ padding: '22px 24px', borderBottom: '1px solid #f5f0eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="pg-eyebrow">Teaching load</p>
              <h3 style={{ margin: '6px 0 0', fontFamily: 'Georgia, serif', fontSize: 20, letterSpacing: '-.03em', color: '#11222d' }}>
                Your active courses
              </h3>
            </div>
            <div style={{ display: 'grid', width: 38, height: 38, placeItems: 'center', borderRadius: 10, background: '#fde8ea', color: '#a51c30' }}>
              <BookOpen size={19} />
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 24, display: 'grid', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 56 }} />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="pg-empty">
              <GraduationCap size={36} />
              <p>No courses have been assigned yet.</p>
            </div>
          ) : (
            <div>
              {courses.slice(0, 5).map((course, idx) => (
                <div key={course._id} className="pg-row">
                  <div className="pg-row-left">
                    <div className={`pg-row-icon course-art ${COURSE_TONES[idx % COURSE_TONES.length]}`} style={{ color: 'white', width: 40, height: 40 }}>
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <div className="pg-row-title">{course.code}</div>
                      <div className="pg-row-sub">{course.title}</div>
                    </div>
                  </div>
                  <span className="pg-badge pg-badge-crimson">{course.credits} cr</span>
                </div>
              ))}
              {courses.length > 5 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f5f0eb' }}>
                  <Link href="/dashboard/lecturer/courses" className="pg-section-link">
                    View all {courses.length} courses <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick note + attendance link */}
        <div style={{ display: 'grid', gap: 16, gridAutoRows: 'min-content' }}>
          <div className="pg-card" style={{ background: 'linear-gradient(135deg, #11222d 0%, #1e3a5f 100%)', border: 'none', color: '#fff' }}>
            <div style={{ padding: '28px 28px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', margin: '0 0 12px' }}>
                Quick note
              </p>
              <h3 style={{ margin: '0 0 10px', fontFamily: 'Georgia, serif', fontSize: 20, letterSpacing: '-.03em' }}>
                Attendance deserves a rhythm.
              </h3>
              <p style={{ margin: '0 0 22px', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,.68)' }}>
                A timely update gives students a clearer picture of their progress.
              </p>
              <Link href="/dashboard/lecturer/attendance" className="pg-hero-btn-primary" style={{ fontSize: 13 }}>
                Open attendance register <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>

          {/* Results shortcut */}
          <div className="pg-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'grid', width: 52, height: 52, placeItems: 'center', borderRadius: 14, background: '#fdf3dc', color: '#8a6a2f', flexShrink: 0 }}>
              <GraduationCap size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Results</p>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#11222d' }}>Publish student grades</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Upload and review results</div>
            </div>
            <Link href="/dashboard/lecturer/results" style={{ display: 'grid', width: 34, height: 34, placeItems: 'center', borderRadius: 8, background: '#fde8ea', color: '#a51c30', flexShrink: 0 }}>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <NotificationsPanel title="Teaching updates" />
    </div>
  );
}
