"use client";

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/config';
type Fee = { _id: string; invoiceNumber: string; amountDue: number; amountPaid: number; balance: number; status: string; semester: string; studentId?: { fullName?: string; email?: string } };

export default function AdminFeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [form, setForm] = useState({ studentId: '', invoiceNumber: '', amountDue: '', amountPaid: '0', semester: '2025/2026 Academic Year' });
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadFees() {
      try {
        const response = await fetch(`${API_BASE}/portal/fees`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setFees(data.fees || []);
        }
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : 'Unable to load fee records.');
      }
    }

    loadFees();
  }, []);

  async function createFee(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`${API_BASE}/portal/fees`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }, body: JSON.stringify({ ...form, amountDue: Number(form.amountDue), amountPaid: Number(form.amountPaid) }) });
    if (response.ok) {
      const data = await response.json();
      setFees((current) => [data.fee, ...current]);
      setForm({ studentId: '', invoiceNumber: '', amountDue: '', amountPaid: '0', semester: '2025/2026 Academic Year' });
      setShowForm(false);
    }
  }

  async function deleteFee(id: string) {
    if (!window.confirm('Delete this fee record?')) return;
    const response = await fetch(`${API_BASE}/portal/fees/${id}`, { method: 'DELETE', credentials: 'include', headers: { Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` } });
    if (response.ok) setFees((current) => current.filter((fee) => fee._id !== id));
  }

  async function editFee(fee: Fee) {
    const amountPaid = window.prompt('Amount paid', String(fee.amountPaid ?? 0));
    if (amountPaid === null) return;
    const response = await fetch(`${API_BASE}/portal/fees/${fee._id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('portal_token') || ''}` }, body: JSON.stringify({ amountPaid: Number(amountPaid) }) });
    if (response.ok) { const data = await response.json(); setFees((current) => current.map((item) => item._id === fee._id ? data.fee : item)); }
  }

  return (
    <div className="rounded-[28px] bg-[#f8fafc] p-6 ring-1 ring-slate-200">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="muted-kicker">Finance operations</p><h2 className="mt-2 text-2xl font-bold text-[#11222d]">Fee ledger</h2><p className="mt-2 text-sm text-slate-500">Track invoices, payments, and outstanding balances.</p></div>
        <button onClick={() => setShowForm((visible) => !visible)} className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Add ledger entry</button>
      </div>

      {message && <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</div>}
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or invoice" className="input-field mb-5" />

      {showForm && <form onSubmit={createFee} className="mb-6 grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-5">
        {(['studentId', 'invoiceNumber', 'amountDue', 'amountPaid', 'semester'] as const).map((field) => <input key={field} required={field !== 'amountPaid'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={field} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />)}
        <button className="w-full rounded-lg bg-[#0d5a4d] px-4 py-2 text-sm font-semibold text-white md:col-span-5">Save ledger entry</button>
      </form>}

      <div className="space-y-3">
        {fees.filter((fee) => `${fee.invoiceNumber} ${fee.studentId?.fullName || ''} ${fee.studentId?.email || ''}`.toLowerCase().includes(query.toLowerCase())).length === 0 ? <p className="text-slate-500">No matching fee records available.</p> : fees.filter((fee) => `${fee.invoiceNumber} ${fee.studentId?.fullName || ''} ${fee.studentId?.email || ''}`.toLowerCase().includes(query.toLowerCase())).map((fee) => (
          <div key={fee._id} className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-[#11222d]">{fee.studentId?.fullName || 'Student'} — {fee.invoiceNumber}</div>
              <div className="text-sm text-slate-500">{fee.semester}</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-right sm:gap-4">
              <div><div className="font-bold text-[#0d5a4d]">GH¢ {Number(fee.balance || 0).toFixed(2)}</div><div className="text-sm text-slate-500 capitalize">{fee.status}</div></div>
              <button onClick={() => editFee(fee)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium sm:w-auto">Edit</button><button onClick={() => deleteFee(fee._id)} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 sm:w-auto">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
