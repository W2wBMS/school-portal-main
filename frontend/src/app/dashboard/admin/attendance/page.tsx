"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';

export default function AdminAttendancePage() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', courseId: '', percentage: '0', status: 'present' });

  function exportReport() {
    const header = 'Student,Course,Percentage,Status,Date';
    const rows = attendance.map((row) => [row.studentId?.fullName || '', row.courseId?.code || '', row.percentage ?? '', row.status || '', row.date || ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    async function loadAttendance() {
      try {
        const response = await fetch(`${API_BASE}/portal/attendance`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAttendance(data.attendance || []);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadAttendance();
  }, []);

  async function deleteAttendance(id: string) {
    if (!window.confirm('Delete this attendance record?')) return;
    const response = await fetch(`${API_BASE}/portal/attendance/${id}`, { method: 'DELETE', credentials: 'include', headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` } });
    if (response.ok) setAttendance((current) => current.filter((row) => row._id !== id));
  }

  async function createAttendance(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`${API_BASE}/portal/attendance`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }, body: JSON.stringify({ ...form, percentage: Number(form.percentage) }) });
    if (response.ok) { const data = await response.json(); setAttendance((current) => [data.attendance, ...current]); setForm({ studentId: '', courseId: '', percentage: '0', status: 'present' }); setShowForm(false); }
  }

  async function editAttendance(row: any) {
    const percentage = window.prompt('Attendance percentage', String(row.percentage ?? 0));
    if (percentage === null) return;
    const response = await fetch(`${API_BASE}/portal/attendance/${row._id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }, body: JSON.stringify({ percentage: Number(percentage) }) });
    if (response.ok) { const data = await response.json(); setAttendance((current) => current.map((item) => item._id === row._id ? data.attendance : item)); }
  }

  return (
    <div className="rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#11222d]">Attendance oversight</h2>
        <div className="flex flex-wrap gap-2"><button onClick={() => setShowForm((visible) => !visible)} className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Add record</button><button onClick={exportReport} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold sm:w-auto">Export report</button></div>
      </div>

      {showForm && <form onSubmit={createAttendance} className="mb-6 grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4">
        {(['studentId', 'courseId', 'percentage'] as const).map((field) => <input key={field} required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={field} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />)}
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>present</option><option>absent</option><option>late</option></select>
        <button className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white md:col-span-4">Save attendance</button>
      </form>}

      <div className="space-y-3">
        {attendance.length === 0 ? <p className="text-slate-500">No attendance data available.</p> : attendance.map((row) => (
          <div key={row._id} className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-[#11222d]">{row.studentId?.fullName || 'Student'} — {row.courseId?.code || 'Course'}</div>
              <div className="text-sm text-slate-500">{row.courseId?.title || 'Course title'}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-right sm:gap-4">
              <div className="font-bold text-[#0d5a4d]">{row.percentage}%</div>
              <div className="text-sm text-slate-500">{row.presentCount}/{row.totalClasses}</div>
              <button onClick={() => editAttendance(row)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium sm:w-auto">Edit</button><button onClick={() => deleteAttendance(row._id)} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 sm:w-auto">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
