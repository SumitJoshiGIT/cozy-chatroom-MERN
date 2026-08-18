const express = require('express');
const { createServer } = require('http');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoStore = require('connect-mongo');
const authRouter = require('./routes/auth/auth');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const { Server } = require('socket.io');
const { onConnection, onDisconnection } = require('./routes/api/socketEvents');
const mongoose = require('mongoose');
const { passport } = require('./routes/auth/passportSetup');
const sharedsession = require('express-socket.io-session');

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.DATABASE) throw new Error('DATABASE env var is required');
if (!process.env.SESSION_SECRET) {
  if (isProduction) throw new Error('SESSION_SECRET env var is required in production');
  console.warn('SESSION_SECRET not set, using an insecure development default');
}

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: clientOrigin, credentials: true } });

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: true,
  store: mongoStore.create({ mongoUrl: process.env.DATABASE }),
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 3600000,
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

io.use(sharedsession(sessionMiddleware, { autoSave: true }));

app.use(authRouter);

app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => onConnection(socket, io));
io.on('disconnect', onDisconnection);

app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).end();
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

mongoose.connect(process.env.DATABASE).then(() => {
  server.listen(PORT, () => console.log(`listening on port ${PORT}`));
}).catch((err) => {
  console.error('failed to connect to database', err);
  process.exit(1);
});
