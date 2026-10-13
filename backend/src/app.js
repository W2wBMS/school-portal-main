const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { csrfProtection, setCsrfCookie } = require('./middleware/csrf');
const { getDatabaseStatus, isDatabaseUnavailable } = require('./utils/databaseStatus');
const { getAllowedOrigins } = require('./utils/corsOrigins');
const { isMemoryMode } = require('./config/db');

dotenv.config();

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || getAllowedOrigins().includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: setCsrfCookie(res) });
});
app.use(csrfProtection);
app.use(morgan('dev'));

app.get('/api/health', async (req, res) => {
  let database = getDatabaseStatus();
  let usersCount = 0;
  let adminExists = false;
  if (database === 'connected') {
    try {
      await mongoose.connection.db.admin().ping();
      usersCount = await User.countDocuments();
      adminExists = !!(await User.findOne({ email: 'admin@rucst.edu.gh' }));
    } catch {
      database = 'unavailable';
    }
  }
  const persistent = !isMemoryMode();
  res.status(database === 'connected' ? 200 : 503).json({
    ok: database === 'connected',
    message: 'Student Portal API is running',
    services: { database, storage: persistent ? 'atlas (persistent)' : 'in-memory (volatile)', totalUsers: usersCount, adminReady: adminExists },
    version: '1.3.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/roles', (req, res) => {
  res.json({
    roles: [
      'student',
      'lecturer',
      'department_admin',
      'academic_officer',
      'finance_officer',
      'student_affairs',
      'system_admin',
      'super_admin',
    ],
  });
});

app.use((req, res, next) => {
  if (req.path.endsWith('/logout')) return next();
  if (getDatabaseStatus() !== 'connected') {
    return res.status(503).json({ message: 'The database is temporarily unavailable. Please try again.' });
  }
  next();
});

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/users', require('./routes/users'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/v1', require('./routes/v1'));

app.use((err, req, res, next) => {
  console.error(`API error on ${req.method} ${req.path}: ${err.name || 'Error'}`);
  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({ message: 'A required service is temporarily unavailable. Please try again.' });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  return res.status(status).json({ message: status < 500 ? err.message : 'Something went wrong' });
});

module.exports = app;
