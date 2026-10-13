const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { permissionsForRole, hasPermission, isRoleAtLeast } = require('../utils/permissions');
const { getJwtSecret } = require('../utils/jwtSecret');
const { isDatabaseUnavailable } = require('../utils/databaseStatus');

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) return bearerToken;
  }

  return req.cookies?.token || null;
}

async function protect(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.status !== 'active' || user.sessionVersion !== (decoded.sessionVersion ?? 0)) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.permissions = permissionsForRole(user.role);
    next();
  } catch (error) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name) && isDatabaseUnavailable(error)) {
      return res.status(503).json({ message: 'Authentication service is temporarily unavailable. Please try again.' });
    }
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const hasAccess = roles.some((role) => isRoleAtLeast(req.user.role, role));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to access this resource' });
    }

    next();
  };
}

function authorizePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!hasPermission(req.user.role, permission)) return res.status(403).json({ message: 'You do not have permission to perform this action' });
    next();
  };
}

module.exports = { protect, authorize, authorizePermission };
