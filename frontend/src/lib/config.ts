export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')
    ? 'https://rucst-student-portal-api.onrender.com/api'
    : process.env.NODE_ENV === 'production'
    ? '/api'
    : 'http://localhost:5000/api');
