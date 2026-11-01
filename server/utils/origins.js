const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

// Production accepts only the configured origins. Development also accepts
// local addresses, because Vite moves to the next free port and people open
// the app on 127.0.0.1 or a LAN IP, none of which match CLIENT_ORIGIN exactly.
// A request with no Origin header is not from a browser page.
function createOriginCheck(clientOrigins, isProduction) {
  return (origin) => !origin || clientOrigins.includes(origin) || (!isProduction && LOCAL_ORIGIN_RE.test(origin));
}

module.exports = { createOriginCheck };
