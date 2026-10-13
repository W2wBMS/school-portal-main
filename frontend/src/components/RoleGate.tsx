"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Role, type UserSession } from '@/lib/auth';

import { API_BASE } from '@/lib/config';

export function RoleGate({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const stored = localStorage.getItem('portal_user');
      if (!stored) {
        router.replace('/login');
        return;
      }

      try {
        const parsed = JSON.parse(stored) as UserSession;
        setUser(parsed);

        const response = await fetch(`${API_BASE}/v1/auth/me`, {
          credentials: 'include',
        });

        if (response.status === 503) return;
        if (!response.ok) {
          localStorage.removeItem('portal_user');
          localStorage.removeItem('portal_token');
          router.replace('/login');
          return;
        }

        const data = await response.json();
        const currentUser = data.user as UserSession;
        setUser(currentUser);

        if (!allowedRoles.includes(currentUser.role as Role)) {
          router.replace('/dashboard/student');
          return;
        }
      } catch {
        // Keep the cached role during a temporary API outage; protected API calls still enforce access.
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [allowedRoles, router]);

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Checking access...</div>;
  }

  if (!user) return null;

  return <>{children}</>;
}
