"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDashboardPath, type Role } from '@/lib/auth';
import { fetchCsrfToken } from '@/lib/csrf';
import PasswordInput from '@/components/PasswordInput';

import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    studentId: '',
    programme: '',
    department: '',
    level: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await parseJsonResponse(response, 'Registration failed');

      const user = data.user;
      localStorage.setItem('portal_user', JSON.stringify(user));
      if (data.token) {
        localStorage.setItem('portal_token', data.token);
      }
      router.push(getDashboardPath((user.role as Role) || 'student'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-6 sm:px-6 lg:px-8">
      <div className="panel-shell w-full max-w-5xl overflow-hidden rounded-[24px] p-4 sm:p-8 lg:p-10">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="muted-kicker">Create account</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#11222d]">Register new portal user</h1>
          </div>
          <Link href="/login" className="inline-flex items-center rounded-full border border-[#dbe7e1] bg-[#f4f8f6] px-4 py-2 text-sm font-semibold text-[#0d5a4d] transition hover:border-[#c2d7cf] hover:bg-[#edf4f2]">
            Back to login
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-[#334155]">Full name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              className="input-field"
              placeholder="Kwame Nkrumah Mensah"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="input-field"
              placeholder="name@rucst.edu.gh"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">Password</label>
            <PasswordInput
              value={form.password}
              onChange={(password) => setForm({ ...form, password })}
              className="input-field"
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="md:col-span-2 rounded-2xl border border-[#dfe8e3] bg-[#f4f8f6] px-4 py-3 text-sm text-[#1a3d35]">
            Student index number will be generated automatically in the format 1029XXXX.
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
              className="input-field"
              placeholder="Agronomy"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">Programme</label>
            <input
              type="text"
              value={form.programme}
              onChange={(event) => setForm({ ...form, programme: event.target.value })}
              className="input-field"
              placeholder="Diploma in Agronomy"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#334155]">Level</label>
            <input
              type="text"
              value={form.level}
              onChange={(event) => setForm({ ...form, level: event.target.value })}
              className="input-field"
              placeholder="200 (Year 2)"
            />
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="primary-button md:col-span-2 w-full rounded-2xl px-5 py-3.5 text-base font-semibold shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}
