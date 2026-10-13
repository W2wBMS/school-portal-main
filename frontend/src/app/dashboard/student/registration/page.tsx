"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/config';

type Course = { _id: string; code: string; title: string; credits: number; semester: string };
type Registration = { _id: string; status: string; courseIds: Course[] } | null;

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`, ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const TONE_CLASSES = ['crimson', 'navy', 'forest', 'amber'] as const;

function statusLabel(status: string | undefined) {
  if (!status || status === 'draft') return { label: 'Draft', badge: 'pg-badge-slate' };
  if (status === 'submitted') return { label: 'Submitted', badge: 'pg-badge-amber' };
  if (status === 'approved') return { label: 'Approved', badge: 'pg-badge-green' };
  if (status === 'rejected') return { label: 'Rejected', badge: 'pg-badge-red' };
  return { label: status, badge: 'pg-badge-slate' };
}

export default function RegistrationPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [registration, setRegistration] = useState<Registration>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api('/portal/courses'), api('/v1/registrations/current')])
      .then(([courseData, registrationData]) => {
        setCourses(courseData.courses || []);
        const current = registrationData.registration || null;
        setRegistration(current);
        setSelected((current?.courseIds || []).map((c: Course) => c._id));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load registration'));
  }, []);

  async function save(submit: boolean) {
    setError('');
    setSaving(true);
    try {
      let current = registration;
      if (!current) {
        const data = await api('/v1/registrations', { method: 'POST', body: JSON.stringify({ courseIds: selected }) });
        current = data.registration;
        setRegistration(current);
      } else {
        const data = await api(`/v1/registrations/${current._id}`, { method: 'PUT', body: JSON.stringify({ courseIds: selected }) });
        current = data.registration;
        setRegistration(current);
      }
      if (submit && current) {
        const data = await api(`/v1/registrations/${current._id}/submit`, { method: 'POST' });
        setRegistration(data.registration);
      }
      setMessage(submit ? 'Registration submitted for approval.' : 'Draft saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save registration');
    } finally {
      setSaving(false);
    }
  }

  const locked = registration?.status === 'submitted' || registration?.status === 'approved';
  const { label: statusText, badge: statusBadge } = statusLabel(registration?.status);
  const totalCredits = courses.filter(c => selected.includes(c._id)).reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="pg-page">
      {/* Header */}
      <div className="pg-card">
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="pg-eyebrow">Academic services</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Course registration</h1>
            <p className="pg-page-subtitle">Select courses for the current semester, save a draft, then submit for approval.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`pg-badge ${statusBadge}`} style={{ fontSize: 13, padding: '6px 14px' }}>{statusText}</span>
            {selected.length > 0 && (
              <span className="pg-badge pg-badge-slate" style={{ fontSize: 13, padding: '6px 14px' }}>
                {selected.length} courses · {totalCredits} credits
              </span>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}
        {message && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-success"><CheckCircle2 size={15} style={{ flexShrink: 0 }} />{message}</div>
          </div>
        )}

        {/* Locked notice */}
        {locked && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-info">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              Your registration has been {registration?.status}. Contact the registrar&apos;s office to make changes.
            </div>
          </div>
        )}

        {/* Course list */}
        {courses.length === 0 ? (
          <div className="pg-empty">
            <BookOpen size={40} />
            <p>No courses available for registration.</p>
          </div>
        ) : (
          <div>
            {courses.map((course, idx) => {
              const isSelected = selected.includes(course._id);
              return (
                <label
                  key={course._id}
                  htmlFor={`course-${course._id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                    borderBottom: '1px solid #f5f0eb', cursor: locked ? 'default' : 'pointer',
                    background: isSelected ? '#fdf8f5' : 'transparent',
                    transition: 'background .15s',
                    opacity: locked ? .75 : 1,
                  }}
                  onMouseEnter={e => { if (!locked) e.currentTarget.style.background = '#faf7f4'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#fdf8f5' : ''; }}
                >
                  <input
                    id={`course-${course._id}`}
                    type="checkbox"
                    disabled={locked}
                    checked={isSelected}
                    onChange={() =>
                      setSelected((items) =>
                        items.includes(course._id) ? items.filter(id => id !== course._id) : [...items, course._id]
                      )
                    }
                    style={{ width: 18, height: 18, accentColor: '#a51c30', flexShrink: 0, cursor: locked ? 'default' : 'pointer' }}
                  />
                  <div
                    className={`course-art ${TONE_CLASSES[idx % TONE_CLASSES.length]}`}
                    style={{ display: 'grid', width: 42, height: 42, placeItems: 'center', borderRadius: 10, flexShrink: 0, color: 'white' }}
                  >
                    <BookOpen size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#11222d' }}>
                      {course.code} — {course.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{course.semester}</div>
                  </div>
                  <span className="pg-badge pg-badge-crimson" style={{ flexShrink: 0 }}>{course.credits} credits</span>
                </label>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        {!locked && (
          <div style={{ padding: '18px 24px', borderTop: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button onClick={() => save(false)} disabled={saving} className="pg-btn pg-btn-ghost">
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Save draft
            </button>
            <button onClick={() => save(true)} disabled={saving || selected.length === 0} className="pg-btn pg-btn-primary">
              {saving ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Submit registration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
