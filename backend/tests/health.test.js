const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

test('health check reports healthy when MongoDB is connected', async () => {
  const route = app.router.stack.find((layer) => layer.route?.path === '/api/health');
  assert.ok(route, 'health route is registered');

  const handler = route.route.stack[0].handle;
  const originalReadyState = mongoose.connection.readyState;
  const originalDb = mongoose.connection.db;
  const originalCountDocuments = User.countDocuments;
  const originalFindOne = User.findOne;
  let responseStatus;
  let responseBody;
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  try {
    mongoose.connection.readyState = 1;
    mongoose.connection.db = { admin: () => ({ ping: async () => ({ ok: 1 }) }) };
    User.countDocuments = async () => 1;
    User.findOne = async () => ({ _id: 'admin' });

    await handler({}, res);

    assert.equal(responseStatus, 200);
    assert.equal(responseBody.ok, true);
    assert.equal(responseBody.services.database, 'connected');
    assert.equal(responseBody.services.totalUsers, 1);
    assert.equal(responseBody.services.adminReady, true);
  } finally {
    mongoose.connection.readyState = originalReadyState;
    mongoose.connection.db = originalDb;
    User.countDocuments = originalCountDocuments;
    User.findOne = originalFindOne;
  }
});
