"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, BookOpen, ChevronDown, GraduationCap, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { getDashboardPath, type Role } from '@/lib/auth';
import { fetchCsrfToken } from '@/lib/csrf';
import PasswordInput from '@/components/PasswordInput';

import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [claimForm, setClaimForm] = useState({ fullName: '', programme: '', department: '', level: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  useEffect(() => {
    // Pre-warm backend service on mount (Render free-tier cold start mitigation)
    fetchCsrfToken().catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const identifier = loginForm.identifier.trim();
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, credentials: 'include',
        body: JSON.stringify(identifier.includes('@') ? { email: identifier, password: loginForm.password } : { studentId: identifier, password: loginForm.password }),
      });
      const data = await parseJsonResponse(response, 'Login failed');
      localStorage.setItem('portal_user', JSON.stringify(data.user));
      if (data.token) {
        localStorage.setItem('portal_token', data.token);
      }
      router.push(getDashboardPath((data.user.role as Role) || 'student'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  }

  async function handleClaimAccount(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setSuccess(''); setClaiming(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const response = await fetch(`${API_BASE}/v1/auth/claim-account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, credentials: 'include', body: JSON.stringify(claimForm),
      });
      const data = await parseJsonResponse(response, 'Unable to create your account');
      setSuccess(`Your account is ready. Your student ID is ${data.studentId}. You can now sign in.`);
      setLoginForm({ identifier: data.studentId, password: claimForm.password });
      setClaimForm({ fullName: '', programme: '', department: '', level: '', password: '' });
      setClaimOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setClaiming(false); }
  }

  return (
    <main className="login-page min-h-screen px-4 py-4 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      <div className="login-shell mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden lg:min-h-[720px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="login-showcase relative flex flex-col overflow-hidden px-6 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="showcase-orb showcase-orb-one" /><div className="showcase-orb showcase-orb-two" />
          <header className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="brand-mark">R</div>
              <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-white/60">RUCST</p><p className="mt-0.5 text-sm font-semibold text-white">Campus Portal</p></div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Secure access</span>
          </header>

          <div className="relative z-10 my-auto max-w-xl py-12 lg:py-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-100/10 px-3 py-1.5 text-xs font-bold text-amber-100"><Sparkles size={14} /> Academic year 2026 / 27</div>
            <h1 className="text-4xl font-extrabold leading-[1.04] tracking-[-.055em] text-white sm:text-5xl lg:text-6xl">Your campus, <span className="text-amber-200">connected.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/75">Stay on top of your courses, results, finance, and academic progress in one thoughtfully designed space.</p>
            <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
              {[['Academic life', BookOpen], ['Verified records', BadgeCheck], ['Private & secure', ShieldCheck]].map(([label, Icon]) => { const ItemIcon = Icon as typeof BookOpen; return <div key={label as string} className="showcase-feature"><ItemIcon size={18} /><span>{label as string}</span></div>; })}
            </div>
          </div>

          <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/50"><span>Regent University College of Science & Technology</span><span className="hidden font-medium sm:block">Established 1986</span></footer>
        </section>

        <section className="login-form-panel flex items-center px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#125b49]"><GraduationCap size={23} /></div><p className="muted-kicker">Student & staff access</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em] text-slate-900 sm:text-[2.15rem]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sign in to continue to your academic workspace.</p></div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label htmlFor="identifier" className="login-label">Student ID or email</label><input id="identifier" type="text" value={loginForm.identifier} onChange={(event) => setLoginForm({ ...loginForm, identifier: event.target.value })} className="input-field" placeholder="e.g. 10290001" autoComplete="username" required /></div>
              <div><div className="mb-2 flex items-center justify-between"><label className="login-label mb-0">Password</label><Link href="/forgot-password" className="login-help-link">Forgot password?</Link></div><PasswordInput value={loginForm.password} onChange={(password) => setLoginForm({ ...loginForm, password })} className="input-field" placeholder="Enter your password" autoComplete="current-password" required /></div>
              {error && (
                <div role="alert" className="login-alert login-alert-error space-y-2">
                  <p>{error}</p>
                  {(error.includes('waking up') || error.includes('connect')) && (
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e)}
                      disabled={loading}
                      className="mt-1 flex items-center gap-1.5 text-xs font-bold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                      {loading ? 'Waking backend & retrying...' : 'Click to retry connection'}
                    </button>
                  )}
                </div>
              )}
              {success && <div role="status" className="login-alert login-alert-success">{success}</div>}
              <button type="submit" disabled={loading} className="primary-button login-submit w-full">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={18} className="animate-spin" /> Waking portal & signing in...
                  </span>
                ) : (
                  <>Sign in <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <button type="button" onClick={() => setClaimOpen(!claimOpen)} aria-expanded={claimOpen} className="claim-toggle w-full"><span><strong>New student?</strong><small>Claim your portal account</small></span><ChevronDown size={19} className={claimOpen ? 'rotate-180' : ''} /></button>
              {claimOpen && <form onSubmit={handleClaimAccount} className="claim-form mt-5 space-y-3"><p className="text-sm leading-6 text-slate-500">Use the name exactly as it appears on the admitted student list.</p><input type="text" value={claimForm.fullName} onChange={(event) => setClaimForm({ ...claimForm, fullName: event.target.value })} className="input-field" placeholder="Full name" required /><div className="grid gap-3 sm:grid-cols-2"><input type="text" value={claimForm.programme} onChange={(event) => setClaimForm({ ...claimForm, programme: event.target.value })} className="input-field" placeholder="Programme" /><input type="text" value={claimForm.department} onChange={(event) => setClaimForm({ ...claimForm, department: event.target.value })} className="input-field" placeholder="Department" /></div><input type="text" value={claimForm.level} onChange={(event) => setClaimForm({ ...claimForm, level: event.target.value })} className="input-field" placeholder="Level" /><PasswordInput value={claimForm.password} onChange={(password) => setClaimForm({ ...claimForm, password })} className="input-field" placeholder="Create password (8+ characters)" minLength={8} autoComplete="new-password" required /><button type="submit" disabled={claiming} className="secondary-button w-full">{claiming ? 'Verifying admission...' : 'Generate my student ID'}</button></form>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
