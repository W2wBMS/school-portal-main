const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
];

function getAllowedOrigins(environment = process.env) {
  const configuredOrigins = [
    environment.CORS_ORIGIN || '',
    ...(environment.CORS_ORIGINS || '').split(','),
  ]
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const developmentOrigins = environment.NODE_ENV === 'production' ? [] : DEVELOPMENT_ORIGINS;

  return [...new Set([...configuredOrigins, ...developmentOrigins])];
}

module.exports = { getAllowedOrigins };
