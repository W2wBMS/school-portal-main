const crypto = require('crypto');

let developmentSecret;

function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  const isPlaceholder = !configuredSecret || /replace_with|change_this|<[^>]+>/i.test(configuredSecret);
  if (!isPlaceholder && configuredSecret.length >= 32) return configuredSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
  }

  if (configuredSecret && !isPlaceholder) {
    console.warn('JWT_SECRET is shorter than recommended; set at least 32 random characters before deployment.');
    return configuredSecret;
  }

  if (!developmentSecret) {
    developmentSecret = crypto.randomBytes(32).toString('hex');
    console.warn('JWT_SECRET is missing or too short; using a temporary development-only secret. Sessions will expire when the API restarts.');
  }
  return developmentSecret;
}

module.exports = { getJwtSecret };
