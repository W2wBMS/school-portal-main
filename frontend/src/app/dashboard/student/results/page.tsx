"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Printer, FileText, GraduationCap, BookOpen, Calculator, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { fetchStudentOverview, type AcademicSummary, type ResultRow } from '@/lib/portal';

function getLatestSemesterName(semesters: AcademicSummary['semesters']) {
  if (!semesters.length) return 'all';
  const yearValue = (v?: string) => { const m = String(v || '').match(/(\d{4})/); return m ? Number(m[1]) : 0; };
  const levelValue = (v?: string) => { const m = String(v || '').match(/(\d+)/); return m ? Number(m[1]) : 0; };
  const semValue = (v?: string) => { const m = String(v || '').match(/(\d+)/); return m ? Number(m[1]) : 0; };
  return [...semesters].sort((l, r) => {
    const yd = yearValue(r.academicYear) - yearValue(l.academicYear);
    if (yd !== 0) return yd;
    const ld = levelValue(r.level) - levelValue(l.level);
    if (ld !== 0) return ld;
    return semValue(r.semester) - semValue(l.semester);
  })[0]?.semester || 'all';
}

function gradeBg(grade: string) {
  if (!grade) return 'pg-badge-slate';
  if (['A+', 'A', 'A-'].includes(grade)) return 'pg-badge-green';
  if (['B+', 'B', 'B-'].includes(grade)) return 'pg-badge-crimson';
  if (['C+', 'C', 'C-'].includes(grade)) return 'pg-badge-amber';
  return 'pg-badge-red';
}

export default function StudentResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState('all');
  const [level, setLevel] = useState('all');
  const [academicYear, setAcademicYear] = useState('all');
  const [summary, setSummary] = useState<AcademicSummary | null>(null);
  const [profile, setProfile] = useState<{
    fullName?: string; studentId?: string; email?: string;
    programme?: string; department?: string; level?: string;
  } | null>(null);

  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simScore1, setSimScore1] = useState(85);
  const [simScore2, setSimScore2] = useState(90);
  const [simScore3, setSimScore3] = useState(88);

  const printableSemester = semester === 'all' ? summary?.semesters[0]?.semester ?? 'Semester 1' : semester;
  const printableRows = results.filter(r => r.semester === printableSemester);
  const printableSummary = summary?.semesters.find(i => i.semester === printableSemester) ?? null;

  const handlePrint = () => {
    const rows = printableRows.length
      ? printableRows.map(r => `<tr><td>${r.courseId?.code || 'Course'}</td><td>${r.courseId?.title || ''}</td><td>${r.courseId?.credits || 0}</td><td>${r.score}%</td><td>${r.grade}</td></tr>`).join('')
      : '<tr><td colspan="5">No results found for this semester.</td></tr>';
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { window.alert('Please allow pop-ups and try again.'); return; }
    w.document.write(`<html><head><title>Semester Result</title><style>body{font-family:Arial,sans-serif;color:#11222d;margin:24px}.kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#a51c30;font-weight:700}h1{margin:12px 0 0;font-size:28px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 16px;margin-top:16px;font-size:14px}.pill{padding:12px 16px;background:#fde8ea;border-radius:8px;display:inline-block;margin:4px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #e2e8f0;font-size:14px}th{background:#faf7f4;text-transform:uppercase;letter-spacing:.08em;color:#64748b}</style></head><body><div class="kicker">Regent University College of Science and Technology</div><h1>Semester Result</h1><div class="meta"><div><strong>Student:</strong> ${profile?.fullName || '—'}</div><div><strong>ID:</strong> ${profile?.studentId || '—'}</div><div><strong>Programme:</strong> ${profile?.programme || '—'}</div><div><strong>Semester:</strong> ${printableSemester}</div></div><div style="margin:20px 0"><div class="pill"><strong>Semester GPA:</strong> ${printableSummary?.gpa.toFixed(2) || '0.00'}</div><div class="pill"><strong>Credits:</strong> ${printableSummary?.credits || 0}</div></div><table><thead><tr><th>Course</th><th>Title</th><th>Credits</th><th>Score</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 250);
    setTimeout(() => w.close(), 1000);
  };

  useEffect(() => {
    async function load() {
      try {
        const overview = await fetchStudentOverview();
        setResults(overview.results || []);
        setSummary(overview.academicSummary);
        setProfile(overview.profile || null);
        const latest = getLatestSemesterName(overview.academicSummary?.semesters || []);
        if (latest !== 'all') setSemester(latest);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load results');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = results.filter(r =>
    `${r.courseId?.code || ''} ${r.courseId?.title || ''}`.toLowerCase().includes(query.toLowerCase()) &&
    (academicYear === 'all' || r.academicYear === academicYear) &&
    (level === 'all' || r.level === level) &&
    (semester === 'all' || r.semester === semester)
  );

  // Calculate simulated CGPA
  const currentCgpa = summary?.cgpa || 3.72;
  const simulatedGpa = Math.min(4.0, Math.max(2.0, (currentCgpa * 0.7) + ((simScore1 + simScore2 + simScore3) / 300 * 4.0 * 0.3))).toFixed(2);

  return (
    <div className="pg-page">
      {/* CGPA + action banner */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        <div className="pg-stat hover-lift" style={{ gridColumn: 'span 1' }}>
          <div className="pg-stat-top">
            <div className="pg-stat-icon crimson"><GraduationCap size={20} /></div>
            <button onClick={() => setSimModalOpen(true)} style={{ background: '#fdf2f2', color: '#a51c30', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Calculator size={13} /> Simulate
            </button>
          </div>
          <div>
            <div className="pg-stat-value" style={{ color: '#a51c30' }}>{summary?.cgpa.toFixed(2) || '3.72'}</div>
            <div className="pg-stat-label">Cumulative GPA (CGPA)</div>
          </div>
        </div>
        <div className="pg-stat hover-lift">
          <div className="pg-stat-top">
            <div className="pg-stat-icon green"><BookOpen size={20} /></div>
          </div>
          <div>
            <div className="pg-stat-value">{summary?.totalCredits || 72}</div>
            <div className="pg-stat-label">Total Credits Earned</div>
          </div>
        </div>
        {summary?.semesters.slice(0, 2).map(s => (
          <div key={s.semester} className="pg-stat hover-lift">
            <div className="pg-stat-top">
              <div className="pg-stat-icon gold"><GraduationCap size={20} /></div>
            </div>
            <div>
              <div className="pg-stat-value">{s.gpa.toFixed(2)}</div>
              <div className="pg-stat-label">{s.semester} GPA</div>
            </div>
          </div>
        ))}
      </div>

      {/* Results card */}
      <div className="pg-card print:hidden">
        <div style={{ padding: '22px 28px', borderBottom: '1px solid #f0ebe4', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="pg-eyebrow">Academic record</p>
            <h1 className="pg-page-title" style={{ marginTop: 6 }}>My Academic Results</h1>
            <p className="pg-page-subtitle">Your published grades and performance metrics across semesters.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setSimModalOpen(true)} className="pg-btn pg-btn-primary hover-lift">
              <Sparkles size={15} /> CGPA Calculator
            </button>
            <button onClick={handlePrint} className="pg-btn pg-btn-outline">
              <Printer size={15} /> Print result
            </button>
            <Link href="/dashboard/student/transcript" className="pg-btn pg-btn-ghost" style={{ textDecoration: 'none' }}>
              <FileText size={15} /> Official Transcript
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ebe4' }}>
            <div className="pg-alert pg-alert-error"><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
          </div>
        )}

        {/* Filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0ebe4', display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search course by code/title…" className="pg-input" />
          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="pg-select">
            <option value="all">All academic years</option>
            {Array.from(new Set(results.map(r => r.academicYear).filter(Boolean))).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value)} className="pg-select">
            <option value="all">All levels</option>
            {Array.from(new Set(results.map(r => r.level).filter(Boolean))).map(l => (
              <option key={l} value={l}>Level {l}</option>
            ))}
          </select>
          <select value={semester} onChange={e => setSemester(e.target.value)} className="pg-select">
            <option value="all">All semesters</option>
            {Array.from(new Set(results.map(r => r.semester))).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Result rows */}
        {loading ? (
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="pg-shimmer" style={{ height: 68 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="pg-empty">
            <GraduationCap size={40} />
            <p>No matching results found for selected filters.</p>
          </div>
        ) : (
          <div>
            {filtered.map((row, index) => (
              <div key={`${row.courseId?.code || 'c'}-${index}`} className="pg-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'grid', width: 40, height: 40, placeItems: 'center', borderRadius: 10, background: '#fde8ea', color: '#a51c30', flexShrink: 0 }}>
                    <BookOpen size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="pg-row-title">
                      {row.courseId?.code || 'Course'} <span style={{ fontWeight: 400, color: '#94a3b8' }}>/</span> {row.courseId?.title || 'Result'}
                    </div>
                    <div className="pg-row-sub">
                      Level {row.level || '—'} · {row.academicYear || '—'} · {row.semester} · {row.courseId?.credits || 0} credits
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`pg-badge ${gradeBg(row.grade)}`} style={{ fontSize: 14, padding: '5px 12px' }}>{row.grade}</span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 700 }}>{row.score}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CGPA Simulator Modal */}
      {simModalOpen && (
        <div className="pg-modal-overlay">
          <div className="pg-modal-card">
            <div className="pg-modal-header">
              <div className="pg-modal-title"><Calculator size={18} /> Target CGPA Simulator</div>
              <button className="pg-modal-close" onClick={() => setSimModalOpen(false)}><X size={16} /></button>
            </div>
            <div className="pg-modal-body">
              <div className="cgpa-sim-box">
                <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85, fontWeight: 700 }}>Projected Target CGPA</div>
                <div className="cgpa-sim-val">{simulatedGpa}</div>
                <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.9 }}>
                  Based on current CGPA ({currentCgpa.toFixed(2)}) + 3 upcoming course estimates.
                </div>
              </div>

              <div className="cgpa-slider-group" style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    <span>CS 301 Database Systems Estimate</span>
                    <span style={{ color: "#a51c30" }}>{simScore1}%</span>
                  </div>
                  <input type="range" min="50" max="100" value={simScore1} onChange={(e) => setSimScore1(Number(e.target.value))} style={{ accentColor: "#a51c30", cursor: "pointer" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    <span>CS 315 Software Engineering Estimate</span>
                    <span style={{ color: "#a51c30" }}>{simScore2}%</span>
                  </div>
                  <input type="range" min="50" max="100" value={simScore2} onChange={(e) => setSimScore2(Number(e.target.value))} style={{ accentColor: "#a51c30", cursor: "pointer" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    <span>MATH 241 Discrete Mathematics Estimate</span>
                    <span style={{ color: "#a51c30" }}>{simScore3}%</span>
                  </div>
                  <input type="range" min="50" max="100" value={simScore3} onChange={(e) => setSimScore3(Number(e.target.value))} style={{ accentColor: "#a51c30", cursor: "pointer" }} />
                </div>
              </div>
            </div>
            <div className="pg-modal-footer">
              <button className="pg-btn pg-btn-primary" onClick={() => setSimModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Print-only block */}
      <div className="hidden print:block">
        <div className="pg-card" style={{ padding: 32 }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: '#a51c30' }}>
              Regent University College of Science and Technology
            </p>
            <h2 style={{ margin: '10px 0 0', fontSize: 24, fontWeight: 800 }}>Semester Result</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px 16px', marginTop: 14, fontSize: 14 }}>
              <p><strong>Semester:</strong> {printableSemester}</p>
              <p><strong>Academic year:</strong> {summary?.semesters.find(i => i.semester === printableSemester)?.academicYear || '—'}</p>
            </div>
          </div>
          <table className="pg-table">
            <thead>
              <tr><th>Course</th><th>Title</th><th>Credits</th><th>Score</th><th>Grade</th></tr>
            </thead>
            <tbody>
              {printableRows.length === 0
                ? <tr><td colSpan={5} style={{ color: '#94a3b8' }}>No results found.</td></tr>
                : printableRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{row.courseId?.code || 'Course'}</td>
                    <td>{row.courseId?.title || ''}</td>
                    <td>{row.courseId?.credits || 0}</td>
                    <td>{row.score}%</td>
                    <td style={{ fontWeight: 700, color: '#a51c30' }}>{row.grade}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

