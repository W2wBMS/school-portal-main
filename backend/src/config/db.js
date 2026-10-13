const mongoose = require('mongoose');

let listenersAttached = false;
let usingInMemory = false;

function attachConnectionLogging() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('connected', () => console.log('MongoDB connection established'));
  mongoose.connection.on('disconnected', () => console.error('MongoDB connection lost; the driver will attempt to reconnect'));
  mongoose.connection.on('error', (error) => console.error(`MongoDB connection error: ${error.name}`));
}

function isMemoryMode() {
  return usingInMemory;
}

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  const isProd = process.env.NODE_ENV === 'production';

  // ── Production: MONGO_URI is mandatory, no fallback allowed ──
  if (isProd) {
    if (!mongoUri) {
      throw new Error(
        'MONGO_URI is not set. Your data WILL BE LOST without a persistent database. ' +
        'Set MONGO_URI in your Render Environment variables.'
      );
    }

    attachConnectionLogging();
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    });
    console.log('✅ Connected to persistent MongoDB Atlas (production)');
    usingInMemory = false;
    return true;
  }

  // ── Development: try Atlas first, fall back to in-memory with a loud warning ──
  if (mongoUri) {
    try {
      attachConnectionLogging();
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      });
      console.log('✅ Connected to persistent MongoDB Atlas (development)');
      usingInMemory = false;
      return true;
    } catch (error) {
      console.warn(
        `\n⚠️  WARNING: Could not connect to MongoDB Atlas (${error.message}).\n` +
        '   Falling back to in-memory database.\n' +
        '   ⛔ ALL DATA WILL BE LOST when the server stops.\n' +
        '   Fix: Check your MONGO_URI and MongoDB Atlas Network Access (allow 0.0.0.0/0).\n'
      );
    }
  } else {
    console.warn(
      '\n⚠️  WARNING: No MONGO_URI configured.\n' +
      '   Starting with in-memory database.\n' +
      '   ⛔ ALL DATA WILL BE LOST when the server stops.\n' +
      '   Fix: Create backend/.env with your MONGO_URI.\n'
    );
  }

  // In-memory fallback (development only)
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const memoryServer = await MongoMemoryServer.create();
  const memUri = memoryServer.getUri();
  attachConnectionLogging();
  await mongoose.connect(memUri);
  usingInMemory = true;
  console.log(`🧪 Connected to IN-MEMORY MongoDB at ${memUri} (data is temporary!)`);
  return true;
}

module.exports = { connectDB, isMemoryMode };
