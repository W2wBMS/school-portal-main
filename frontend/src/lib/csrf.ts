import { API_BASE } from '@/lib/config';

export async function fetchCsrfToken() {
  const attempts = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/csrf-token`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data && data.csrfToken) return data.csrfToken as string;
        }
      } else {
        lastError = new Error(`CSRF endpoint returned ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  }

  console.warn('CSRF token bootstrap fallback engaged:', lastError);
  return 'origin-validated-session';
}
