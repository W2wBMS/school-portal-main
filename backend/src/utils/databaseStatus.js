const mongoose = require('mongoose');

function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'unavailable';
}

function isDatabaseUnavailable(error) {
  const details = `${error?.name || ''} ${error?.message || ''}`;
  return mongoose.connection.readyState !== 1 || /Mongo(ServerSelection|Network|NotConnected)|buffering timed out/i.test(details);
}

module.exports = { getDatabaseStatus, isDatabaseUnavailable };
