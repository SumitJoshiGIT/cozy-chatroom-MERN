const express = require('express');
require('dotenv').config();
const { createServer } = require('http');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoStore = require('connect-mongo');
const authRouter = require('./routes/auth/auth');
const callsRouter = require('./routes/api/calls');
const mediaRouter = require('./routes/api/media');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { onConnection, authenticateSocket } = require('./routes/api/socketEvents');
const mongoose = require('mongoose');
const { passport } = require('./routes/auth/passportSetup');
const sharedsession = require('express-socket.io-session');
const { cleanupDemoAccounts } = require('./utils/cleanupDemoAccounts');
const { cleanupOrphanAttachments } = require('./utils/cleanupAttachments');
const { UPLOAD_DIR } = require('./utils/uploads');
const { createOriginCheck } = require('./utils/origins');
const { vapidPublicKey } = require('./utils/webPush');

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);

if (!process.env.DATABASE) throw new Error('DATABASE env var is required');
if (!process.env.SESSION_SECRET) {
  if (isProduction) throw new Error('SESSION_SECRET env var is required in production');
  console.warn('SESSION_SECRET not set, using an insecure development default');
}

// Backstop: on current Node, an unhandled rejection anywhere kills the whole
// process by default. Socket handlers already guard against this at the
// registration point (see socketEvents.js), but this catches anything else
// (route handlers, startup code, a future forgotten handler) instead of
// silently taking down every connected user.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const app = express();
if (isProduction) app.set('trust proxy', 1);
const server = createServer(app);
// Attachments are sent base64-encoded over the socket (up to the client's 2MB
// raw-file cap), which inflates to ~2.7MB plus JSON overhead — comfortably
// over socket.io's 1MB default, so raise it or uploads near the cap silently fail.
// The cors option only governs HTTP polling: WebSocket upgrades ignore CORS
// entirely, so without allowRequest any website could open a socket that
// carries a visitor's SameSite=None session cookie.
const allowedOrigin = createOriginCheck(clientOrigins, isProduction);
const corsOrigin = (origin, callback) => callback(null, allowedOrigin(origin));
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
  allowRequest: (req, callback) => callback(null, allowedOrigin(req.headers.origin)),
  maxHttpBufferSize: 5 * 1024 * 1024,
});

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  store: mongoStore.create({ mongoUrl: process.env.DATABASE }),
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 3600000,
  },
});

app.disable('x-powered-by');
app.use(helmet({
  // Uploads are embedded by the client from a different origin.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // PDF previews render in an iframe on the client origin.
  xFrameOptions: false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'data:'],
      connectSrc: ["'self'", 'https:', 'wss:', ...clientOrigins],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'", ...clientOrigins],
    },
  },
}));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: corsOrigin, credentials: true }));
// Cross-site cookies are allowed (the client lives on another origin), so
// state-changing requests have to prove where they came from.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (allowedOrigin(req.get('origin'))) return next();
  return res.status(403).json({ status: false, message: 'Origin not allowed' });
});
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
// Must be explicit: the default still serves files inside a dot-directory,
// which would expose the private attachments folder.
app.use(express.static(UPLOAD_DIR, { dotfiles: 'ignore' }));
app.use(cookieParser());

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

io.use(sharedsession(sessionMiddleware, { autoSave: true }));

app.use(authRouter);
app.use(callsRouter);
app.use(mediaRouter);

app.get('/ping', (req, res) => res.send('pong'));
app.get('/push/vapidPublicKey', (req, res) => res.json({ key: vapidPublicKey }));

app.set('io', io);
io.use(authenticateSocket);
io.on('connection', (socket) => onConnection(socket, io));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: false, message: 'Invalid request' });
  }
  console.error('Request failed:', err);
  return res.status(500).json({ status: false, message: 'Internal server error' });
});

app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).end();
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

mongoose.connect(process.env.DATABASE).then(() => {
  cleanupDemoAccounts().catch((err) => console.error('Initial demo cleanup failed:', err));
  setInterval(() => {
    cleanupDemoAccounts().catch((err) => console.error('Scheduled demo cleanup failed:', err));
    cleanupOrphanAttachments().catch((err) => console.error('Attachment cleanup failed:', err));
  }, 15 * 60 * 1000).unref();
  // A failed bind would otherwise be swallowed by the uncaughtException
  // backstop above, leaving a live process that serves nothing.
  server.once('error', (err) => {
    console.error('failed to start server', err);
    process.exit(1);
  });
  server.listen(PORT, () => console.log(`listening on port ${PORT}`));
}).catch((err) => {
  console.error('failed to connect to database', err);
  process.exit(1);
});
