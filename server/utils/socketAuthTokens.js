const crypto = require('crypto');

const TOKEN_TTL_MS = 60 * 1000;
const tokens = new Map();

function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { userId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function consumeToken(token) {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

module.exports = { issueToken, consumeToken };
