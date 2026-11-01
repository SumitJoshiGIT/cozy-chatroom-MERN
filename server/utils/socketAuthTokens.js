const crypto = require('crypto');

const TOKEN_TTL_MS = 60 * 60 * 1000;
const MEDIA_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const secret = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function issueToken(userId, { ttlMs = TOKEN_TTL_MS, demo = false } = {}) {
  const encoded = Buffer.from(JSON.stringify({
    uid: String(userId),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    ...(demo ? { demo: true } : {}),
  })).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function verifyTokenPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (!payload.uid || Date.now() > payload.exp) return null;
    return { uid: payload.uid, iat: payload.iat || 0, demo: !!payload.demo };
  } catch {
    return null;
  }
}

function verifyToken(token) {
  const payload = verifyTokenPayload(token);
  return payload ? payload.uid : null;
}

// Media tokens are signed under their own prefix so a URL that leaks (logs,
// browser history) can fetch attachments but can never authenticate a socket.
function issueMediaToken(userId) {
  const encoded = Buffer.from(JSON.stringify({
    uid: String(userId),
    iat: Date.now(),
    exp: Date.now() + MEDIA_TOKEN_TTL_MS,
  })).toString('base64url');
  return `${encoded}.${sign(`media.${encoded}`)}`;
}

function verifyMediaToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`media.${encoded}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return payload.uid && Date.now() <= payload.exp ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { issueToken, verifyToken, verifyTokenPayload, issueMediaToken, verifyMediaToken };
