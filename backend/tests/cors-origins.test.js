const test = require('node:test');
const assert = require('node:assert/strict');
const { getAllowedOrigins } = require('../src/utils/corsOrigins.js');
const { csrfProtection } = require('../src/middleware/csrf.js');

test('production CORS includes configured frontend origins without local origins', () => {
  const origins = getAllowedOrigins({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://portal.onrender.com/',
  });

  assert.deepEqual(origins, ['https://portal.onrender.com']);
});

test('development CORS includes local and configured frontend origins', () => {
  const origins = getAllowedOrigins({
    NODE_ENV: 'development',
    CORS_ORIGIN: 'https://portal.onrender.com',
    CORS_ORIGINS: 'http://localhost:3000, http://localhost:5173/',
  });

  assert.deepEqual(origins, [
    'https://portal.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);
});

test('csrf middleware accepts Render CORS_ORIGINS without requiring CORS_ORIGIN', () => {
  const previous = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGIN = '';
  process.env.CORS_ORIGINS = 'https://portal.onrender.com';

  let called = false;
  const req = {
    method: 'POST',
    path: '/api/v1/auth/login',
    cookies: {},
    get: (name) => (name === 'origin' ? 'https://portal.onrender.com' : undefined),
  };
  const res = { status: () => ({ json: () => ({}) }) };
  const next = () => { called = true; };

  csrfProtection(req, res, next);

  assert.equal(called, true);

  Object.keys(previous).forEach((key) => {
    process.env[key] = previous[key];
  });
  Object.keys(process.env).forEach((key) => {
    if (!(key in previous)) delete process.env[key];
  });
});