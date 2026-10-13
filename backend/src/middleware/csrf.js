const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');
const { getAllowedOrigins } = require('../utils/corsOrigins');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function setCsrfCookie(res) {
  const token = crypto.randomBytes(24).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('csrf_token', token, {
    httpOnly: false,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24,
  });
  return token;
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method) || req.path === '/api/v1/payments/webhook') return next();

  const allowedOrigins = new Set(getAllowedOrigins());
  const originHeader = req.get('origin');
  if (originHeader && allowedOrigins.has(originHeader)) return next();

  const authorization = req.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    const bearerToken = authorization.slice(7).trim();
    if (bearerToken) {
      try {
        jwt.verify(bearerToken, getJwtSecret());
        return next();
      } catch {}
    }
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) return res.status(403).json({ message: 'CSRF validation failed' });
  next();
}

module.exports = { csrfProtection, setCsrfCookie };
