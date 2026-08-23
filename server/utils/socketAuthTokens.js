const crypto = require('crypto');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function issueToken(userId) {
  const encoded = Buffer.from(JSON.stringify({ uid: String(userId), exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (!uid || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}

module.exports = { issueToken, verifyToken };
