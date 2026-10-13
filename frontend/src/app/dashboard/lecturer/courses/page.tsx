"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Users } from 'lucide-react';
import { API_BASE } from '@/lib/config';

type Course = { _id: string; code: string; title: string; credits: number; department: string; semester: string; lecturerId?: { fullName?: string } };
type RosterStudent = { _id: string; fullName: string; email: string; studentId?: string; level?: string; programme?: string };
type RosterEntry = { student: RosterStudent };

const TONE_CLASSES = ['crimson', 'navy', 'forest', 'amber'] as const;

export default function LecturerCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRosterCourse, setSelectedRosterCourse] = useState('');
  const [rosters, setRosters] = useState<Record<string, RosterEntry[]>>({});
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await fetch(`${API_BASE}/portal/courses`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
        });
        if (response.ok) {
          setCourses((await response.json()).courses || []);
        } else {
          throw new Error('Unable to load assigned courses');
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load assigned courses');
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, []);

  async function toggleRoster(courseId: string) {
    if (selectedRosterCourse === courseId) { setSelectedRosterCourse(''); return; }
    setSelectedRosterCourse(courseId);
    if (rosters[courseId]) return;
    setRosterLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/portal/courses/${courseId}/roster`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load class list');
      setRosters((cur) => ({ ...cur, [courseId]: data.roster || [] }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load class list');
    } finally {
      setRosterLoading(false);
    }
  }

  const filtered = courses.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="pg-page">
      {/* Header card */}
      <div className="pg-card">
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="pg-eyebrow">Teaching workspace</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>Assigned courses</h1>
            <p className="pg-page-subtitle">Review your teaching load and course details.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, background: '#fde8ea', borderRadius: 12, padding: '10px 18px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em' }}>Courses</span>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.04em', color: '#a51c30' }}>{courses.length}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f0ebe4' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course code or title…"
            className="pg-input"
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '14px 24px' }}>
            <div className="pg-alert pg-alert-error">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          </div>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 72 }} />)}
          </div>
        )}

        {/* Course rows */}
        {!loading && (
          filtered.length === 0 ? (
            <div className="pg-empty">
              <BookOpen size={36} />
              <p>No matching courses found.</p>
            </div>
          ) : (
            <div>
              {filtered.map((course, idx) => (
                <article key={course._id}>
                  <div className="pg-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                      <div
                        className={`course-art ${TONE_CLASSES[idx % TONE_CLASSES.length]}`}
                        style={{ display: 'grid', width: 44, height: 44, placeItems: 'center', borderRadius: 12, flexShrink: 0, color: 'white' }}
                      >
                        <BookOpen size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pg-row-title">{course.code} — {course.title}</div>
                        <div className="pg-row-sub">{course.department} · {course.semester}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span className="pg-badge pg-badge-crimson">{course.credits} credits</span>
                      <button
                        onClick={() => toggleRoster(course._id)}
                        className="pg-btn pg-btn-ghost pg-btn-sm"
                      >
                        {selectedRosterCourse === course._id ? 'Hide class list' : 'View class list'}
                      </button>
                    </div>
                  </div>

                  {/* Roster panel */}
                  {selectedRosterCourse === course._id && (
                    <div style={{ borderTop: '1px solid #f0ebe4', background: '#faf7f4', padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Users size={16} color="#a51c30" />
                          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#11222d' }}>Approved students</h3>
                        </div>
                        <span className="pg-badge pg-badge-slate">{rosters[course._id]?.length ?? '…'} students</span>
                      </div>
                      {rosterLoading && !rosters[course._id] ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {[1, 2, 3].map(i => <div key={i} className="pg-shimmer" style={{ height: 38 }} />)}
                        </div>
                      ) : rosters[course._id]?.length ? (
                        <div className="pg-table-wrap">
                          <table className="pg-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Student ID</th>
                                <th>Programme / Email</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rosters[course._id].map(({ student }) => (
                                <tr key={student._id}>
                                  <td style={{ fontWeight: 600 }}>{student.fullName}</td>
                                  <td>{student.studentId || '—'}</td>
                                  <td style={{ color: '#64748b' }}>
                                    {student.programme || student.email}
                                    {student.level ? ` · Level ${student.level}` : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>No students have approved registration for this course.</p>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
