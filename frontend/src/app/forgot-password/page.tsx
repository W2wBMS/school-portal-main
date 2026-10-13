"use client";

import Link from 'next/link';
import { useState } from 'react';
import { fetchCsrfToken } from '@/lib/csrf';

import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/v1/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, credentials: 'include', body: JSON.stringify({ email }) });
      const data = await parseJsonResponse(response, 'Unable to request reset');
      setMessage(data.message || 'If an account exists, a reset link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request reset');
    }
  }
  return <main className="flex min-h-screen items-center justify-center px-4"><div className="login-frame w-full max-w-md rounded-[28px] p-8 sm:p-10"><p className="muted-kicker">Account recovery</p><h1 className="mt-3 text-3xl font-bold text-black">Reset your password</h1><p className="mt-3 text-sm leading-6 text-black">Enter your institutional email and we will send a one-time reset link.</p><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-semibold text-black">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-2" /></label><button className="primary-button w-full rounded-lg px-4 py-3 font-semibold text-black">Send reset link</button></form>{message && <p className="mt-4 rounded-xl bg-[#e5f1ed] p-3 text-sm text-black">{message}</p>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-black">{error}</p>}<Link href="/login" className="mt-6 block text-center text-sm font-semibold text-black underline-offset-4 hover:underline">Back to login</Link></div></main>;
}
