"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useEffect } from 'react';
import { fetchCsrfToken } from '@/lib/csrf';
import PasswordInput from '@/components/PasswordInput';

import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/v1/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, credentials: 'include', body: JSON.stringify({ token, password }) });
      const data = await parseJsonResponse(response, 'Unable to reset password');
      setMessage(data.message || 'Password updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password');
    }
  }
  return <main className="flex min-h-screen items-center justify-center px-4"><div className="login-frame w-full max-w-md rounded-[28px] p-8 sm:p-10"><p className="muted-kicker">Account recovery</p><h1 className="mt-3 text-3xl font-bold text-black">Choose a new password</h1><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-semibold text-black">New password<PasswordInput required minLength={8} value={password} onChange={setPassword} className="input-field mt-2" autoComplete="new-password" /></label><button className="primary-button w-full rounded-lg px-4 py-3 font-semibold text-black">Update password</button></form>{message && <p className="mt-4 rounded-xl bg-[#e5f1ed] p-3 text-sm text-black">{message}</p>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-black">{error}</p>}<Link href="/login" className="mt-6 block text-center text-sm font-semibold text-black underline-offset-4 hover:underline">Back to login</Link></div></main>;
}
