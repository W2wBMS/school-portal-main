"use client";

import { useEffect, useState } from 'react';
import { AcademicSummary, ResultRow } from '@/lib/portal';

import { API_BASE } from '@/lib/config';
type Student = { fullName?: string; email?: string; studentId?: string; programme?: string; department?: string };

export default function TranscriptPage() {
  const [student, setStudent] = useState<Student>({});
  const [summary, setSummary] = useState<AcademicSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/v1/students/me/transcript`, { credentials: 'include', headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to load transcript'); setStudent(data.student || {}); setSummary(data.academicSummary); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load transcript'));
  }, []);

  if (error) return <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>;
  if (!summary) return <div className="rounded-[28px] bg-[#f8fafc] p-8 text-sm font-semibold text-[#0d5a4d]">Loading transcript...</div>;

  return <div className="transcript-page space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4 print:hidden"><div><p className="muted-kicker">Academic record</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">Official transcript</h2></div><button onClick={() => window.print()} className="rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white">Print transcript</button></div>
    <div className="rounded-[28px] bg-white p-6 ring-1 ring-slate-200 print:rounded-none print:p-0 print:ring-0"><div className="border-b border-slate-200 pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0d5a4d]">Regent University College of Science and Technology</p><h1 className="mt-2 text-3xl font-bold text-[#11222d]">Academic Transcript</h1><div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p><strong>Student:</strong> {student.fullName || '-'}</p><p><strong>Student ID:</strong> {student.studentId || '-'}</p><p><strong>Email:</strong> {student.email || '-'}</p><p><strong>Programme:</strong> {student.programme || '-'}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><div className="rounded-xl bg-[#e5f1ed] px-4 py-3"><span className="block text-xs text-[#4c756c]">Cumulative GPA</span><strong className="text-xl text-[#0d5a4d]">{summary.cgpa.toFixed(2)}</strong></div><div className="rounded-xl bg-slate-50 px-4 py-3"><span className="block text-xs text-slate-500">Credits completed</span><strong className="text-xl text-[#11222d]">{summary.totalCredits}</strong></div></div>{summary.semesters.map((semester) => <section key={`${semester.academicYear}-${semester.level}-${semester.semester}`} className="mt-8 break-inside-avoid"><div className="flex items-end justify-between border-b border-slate-200 pb-2"><h2 className="text-lg font-bold text-[#11222d]">Level {semester.level || '—'} · {semester.academicYear || '—'} · {semester.semester}</h2><span className="text-sm font-semibold text-[#0d5a4d]">GPA {semester.gpa.toFixed(2)} · {semester.credits} credits</span></div><div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Course</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Credits</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Grade</th></tr></thead><tbody>{semester.results.map((result: ResultRow) => <tr key={`${result.courseId?.code}-${result.semester}-${result.level}-${result.academicYear}`} className="border-t border-slate-100"><td className="px-3 py-3 font-semibold">{result.courseId?.code || '-'}</td><td className="px-3 py-3">{result.courseId?.title || '-'}</td><td className="px-3 py-3">{result.courseId?.credits || 0}</td><td className="px-3 py-3">{result.score}%</td><td className="px-3 py-3 font-bold text-[#0d5a4d]">{result.grade}</td></tr>)}</tbody></table></div></section>)}</div>
  </div>;
}