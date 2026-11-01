// Regression tests for access control. Boots the real server against
// TEST_DATABASE, which is wiped: it must never point at real data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const DATABASE = process.env.TEST_DATABASE;
if (!DATABASE) throw new Error('Set TEST_DATABASE to a disposable database to run these tests');
process.env.SESSION_SECRET = 'test-only-secret';
process.env.DATABASE = DATABASE;

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { io } = require('socket.io-client');
const { issueToken, issueMediaToken } = require('../utils/socketAuthTokens');
const models = require('../models/exports');

const PORT = 3000 + crypto.randomInt(20000, 30000);
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lavender-test-'));
let server;
let sockets = [];
let alice, bob, mallory, dm, secret;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const once = (socket, event, ms = 1000) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
});

function connect(user, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      transports: ['websocket'], forceNew: true, reconnection: false,
      auth: user ? { token: issueToken(user._id) } : {}, ...options,
    });
    sockets.push(socket);
    socket.log = [];
    socket.onAny((event, ...args) => socket.log.push([event, ...args]));
    socket.once('auth', (profile) => { socket.profile = profile; resolve(socket); });
    socket.once('connect_error', reject);
  });
}

const seedUser = (name, password) => models.UsersModel.create({ name, email: `${name}@test.invalid`, password });
const ensureAttachmentDir = () => fs.mkdirSync(path.join(UPLOAD_DIR, '.attachments'), { recursive: true });
const fresh = (user) => models.UsersModel.findById(user._id);

test.before(async () => {
  await mongoose.connect(DATABASE);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((model) => model.init()));
  server = spawn(process.execPath, ['app.js'], {
    cwd: path.join(__dirname, '..'),
    // Google's strategy throws at startup without these, and CI has no .env.
    env: {
      ...process.env, PORT, NODE_ENV: 'development', CLIENT_ORIGIN: ORIGIN, UPLOAD_DIR, AUTH_RATE_LIMIT: '1000', DEMO_ENABLED: 'true', CALL_RING_MS: '700', CALL_RECONNECT_GRACE_MS: '200',
      LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'test-secret-test-secret-test-secret',
      GOOGLE_CLIENT_ID: 'test-client-id', GOOGLE_CLIENT_SECRET: 'test-client-secret', GOOGLE_REDIRECT_URI: `${BASE}/auth/google/oauth/callback`,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${BASE}/ping`).then((r) => r.ok, () => false)) return;
    await wait(100);
  }
  throw new Error('The server did not start');
});

test.beforeEach(async () => {
  fs.rmSync(path.join(UPLOAD_DIR, '.attachments'), { recursive: true, force: true });
  ensureAttachmentDir();
  await Promise.all([models.UsersModel, models.ChatsModel, models.MessagesModel, models.ReadPositionsModel].map((m) => m.deleteMany({})));
  const password = await bcrypt.hash('Password123', 4);
  [alice, bob, mallory] = await Promise.all(['alice', 'bob', 'mallory'].map((name) => seedUser(name, password)));
  dm = await models.ChatsModel.create({ type: 'private', users: [alice._id, bob._id] });
  await models.UsersModel.updateMany(
    { _id: { $in: [alice._id, bob._id] } },
    { $push: { Chats: dm._id }, $addToSet: { contacts: { $each: [alice._id, bob._id] } } }
  );
  secret = await models.MessagesModel.create({ chat: dm._id, uid: alice._id, content: 'secret' });
});

test.afterEach(() => {
  sockets.forEach((socket) => socket.disconnect());
  sockets = [];
});

test.after(async () => {
  server.kill();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

test('auth payload and getProfile never expose credentials', async () => {
  const m = await connect(await fresh(mallory));
  assert.equal(m.profile.password, undefined);
  m.emit('getProfile', { uid: String(alice._id) });
  const profile = await once(m, 'profile');
  assert.equal(profile.name, 'alice');
  for (const field of ['password', 'email', 'Chats', 'blocked', 'starred', 'contacts']) {
    assert.equal(profile[field], undefined, field);
  }
});

test('search results expose only public fields', async () => {
  const m = await connect(await fresh(mallory));
  m.emit('search', { query: 'alice', target: 1, reqId: 1 });
  const { results } = await once(m, 'searchResults');
  assert.equal(results.length, 1);
  assert.equal(results[0].password, undefined);
  assert.equal(results[0].email, undefined);
  assert.equal(results[0].Chats, undefined);
});

test('private chats cannot be joined', async () => {
  const m = await connect(await fresh(mallory));
  m.emit('join', [String(dm._id)]);
  m.emit('joinByInvite', { code: String(dm._id) });
  assert.match((await once(m, 'chatError')).message, /invalid/);
  assert.equal((await models.ChatsModel.findById(dm._id)).users.length, 2);
  m.emit('messages', { cid: String(dm._id), mode: 'before' });
  assert.equal(await once(m, 'messages', 300), null);
});

test('query operators in ids are rejected', async () => {
  const m = await connect(await fresh(mallory));
  m.emit('getProfile', { uid: { $ne: null } });
  m.emit('join', [{ $ne: null }]);
  assert.equal(await once(m, 'profile', 300), null);
  assert.equal(await models.ChatsModel.countDocuments({ users: mallory._id }), 0);
});

test('starring cannot read a message from another chat', async () => {
  const m = await connect(await fresh(mallory));
  m.emit('toggleStar', { id: String(secret._id) });
  await wait(200);
  await models.UsersModel.findByIdAndUpdate(mallory._id, { $push: { starred: secret._id } });
  const m2 = await connect(await fresh(mallory));
  m2.emit('getStarred');
  assert.deepEqual(await once(m2, 'starredMessages'), []);
});

test('reply_to cannot pull a message from another chat', async () => {
  const group = await models.ChatsModel.create({ type: 'group', name: 'g', users: [mallory._id], owner: mallory._id, admins: [mallory._id] });
  await models.UsersModel.findByIdAndUpdate(mallory._id, { $push: { Chats: group._id } });
  const m = await connect(await fresh(mallory));
  m.emit('sendMessage', { cid: String(group._id), content: 'x', reply_to: String(secret._id) });
  await once(m, 'messages');
  m.emit('messages', { cid: String(group._id), mode: 'before' });
  const { data } = await once(m, 'messages');
  assert.equal(data[0].reply_to, null);
  assert.equal(data[0].replyToMessage, undefined);
});

test('only the author can delete a DM message, and everyone sees it go', async () => {
  const b = await connect(await fresh(bob));
  b.emit('deleteMessage', [secret.mid, String(secret._id), String(dm._id)]);
  const denied = await once(b, 'messageError');
  assert.equal(denied.event, 'deleteMessage');
  assert.ok(await models.MessagesModel.findById(secret._id));

  const a = await connect(await fresh(alice));
  const seen = once(b, 'deleteMessage');
  a.emit('deleteMessage', [secret.mid, String(secret._id), String(dm._id)]);
  assert.deepEqual(await seen, [String(secret._id), secret.mid, String(dm._id)]);
  assert.equal(await models.MessagesModel.findById(secret._id), null);
});

test('a first DM reaches an online recipient and survives reconnect', async () => {
  const carol = await seedUser('carol', 'x');
  const c = await connect(await fresh(carol));
  const a = await connect(await fresh(alice));
  const live = once(c, 'messages');
  a.emit('createChatPrivate', { cid: String(carol._id), content: 'hi', replace: 'p1' });
  assert.equal((await live).data[0].content, 'hi');
  const c2 = await connect(await fresh(carol));
  c2.emit('chats', { type: 'sync', known: {} });
  assert.equal((await once(c2, 'chat')).changed.length, 1);
});

test('messaging yourself never lands in an existing DM', async () => {
  const a = await connect(await fresh(alice));
  const reply = once(a, 'messages');
  a.emit('createChatPrivate', { cid: String(alice._id), content: 'note', replace: 'p1' });
  const { id } = await reply;
  assert.notEqual(id, String(dm._id));
  const chat = await models.ChatsModel.findById(id);
  assert.deepEqual(chat.users.map(String), [String(alice._id), String(alice._id)]);
});

test('group invites and removals apply to live sockets', async () => {
  const b = await connect(await fresh(bob));
  const a = await connect(await fresh(alice));
  const created = once(b, 'chat');
  a.emit('createChat', { name: 'g', members: [String(bob._id), String(mallory._id)] });
  const { chats: [group] } = await created;
  assert.deepEqual(group.users.sort(), [String(alice._id), String(bob._id)].sort(), 'non-contact was added');

  const left = once(b, 'leaveChat');
  a.emit('removeUser', { chatID: group._id, userID: String(bob._id) });
  assert.deepEqual(await left, [group._id, false]);
  b.emit('sendMessage', { cid: group._id, content: 'still here' });
  await wait(200);
  assert.equal(await models.MessagesModel.countDocuments({ chat: group._id }), 0);
});

test('admins cannot remove the owner or each other', async () => {
  const group = await models.ChatsModel.create({
    type: 'group', name: 'g', owner: alice._id,
    users: [alice._id, bob._id, mallory._id], admins: [alice._id, bob._id, mallory._id],
  });
  await models.UsersModel.updateMany({}, { $push: { Chats: group._id } });
  const b = await connect(await fresh(bob));
  b.emit('removeUser', { chatID: String(group._id), userID: String(alice._id) });
  b.emit('removeUser', { chatID: String(group._id), userID: String(mallory._id) });
  await wait(200);
  assert.equal((await models.ChatsModel.findById(group._id)).users.length, 3);
});

test('leaving a group hands ownership on; leaving a DM keeps it for the other person', async () => {
  const group = await models.ChatsModel.create({ type: 'group', name: 'g', owner: alice._id, users: [alice._id, bob._id], admins: [alice._id] });
  await models.UsersModel.findByIdAndUpdate(alice._id, { $push: { Chats: group._id } });
  await models.UsersModel.findByIdAndUpdate(bob._id, { $push: { Chats: group._id } });
  const a = await connect(await fresh(alice));
  a.emit('leaveChat', { id: String(group._id) });
  await once(a, 'leaveChat');
  assert.equal(String((await models.ChatsModel.findById(group._id)).owner), String(bob._id));

  a.emit('leaveChat', { id: String(dm._id) });
  await once(a, 'leaveChat');
  assert.ok(await models.ChatsModel.findById(dm._id));
  assert.ok(await models.MessagesModel.findById(secret._id));
});

test('unread counts one chat only, despite the shared mid sequence', async () => {
  await models.ReadPositionsModel.create({ user: bob._id, chat: dm._id, lastReadMid: secret.mid });
  const other = await models.ChatsModel.create({ type: 'group', name: 'noise' });
  for (let i = 0; i < 10; i++) await models.MessagesModel.create({ chat: other._id, uid: alice._id, content: 'n' });
  const a = await connect(await fresh(alice));
  a.emit('sendMessage', { cid: String(dm._id), content: 'one' });
  await once(a, 'messages');
  const b = await connect(await fresh(bob));
  b.emit('chats', { type: 'sync', known: {} });
  const { changed } = await once(b, 'chat');
  assert.equal(changed[0].unreadCount, 1);
});

test('uploads must match their declared type', async () => {
  const a = await connect(await fresh(alice));
  a.emit('sendMessage', {
    cid: String(dm._id), content: '', replace: 'p1',
    attachments: [{ file: Buffer.from('<script>alert(1)</script>').toString('base64'), type: 'image/png', name: 'x.png' }],
  });
  const error = await once(a, 'messageError');
  assert.match(error.message, /couldn't be sent/);
  assert.deepEqual(fs.readdirSync(UPLOAD_DIR).filter((name) => name !== '.attachments'), []);
  assert.equal(fs.readdirSync(path.join(UPLOAD_DIR, '.attachments')).length, 0);
});

test('sockets and POSTs from an unlisted origin are refused', async () => {
  const signin = await fetch(`${BASE}/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email: 'alice@test.invalid', password: 'Password123' }),
  });
  assert.equal(signin.status, 200);
  const cookie = signin.headers.get('set-cookie').split(';')[0];
  const good = await connect(null, { extraHeaders: { Cookie: cookie, Origin: ORIGIN } });
  assert.equal(good.profile.name, 'alice');
  await assert.rejects(connect(null, { extraHeaders: { Cookie: cookie, Origin: 'https://evil.example' } }));
  const forged = await fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://evil.example' } });
  assert.equal(forged.status, 403);
});

test('origin rule: production is exact, development also allows local addresses', () => {
  const { createOriginCheck } = require('../utils/origins');
  const dev = createOriginCheck([ORIGIN], false);
  const prod = createOriginCheck(['https://app.example'], true);
  for (const local of ['http://localhost:5174', 'http://127.0.0.1:5173', 'http://192.168.1.20:5173', 'http://[::1]:5173']) {
    assert.equal(dev(local), true, local);
    assert.equal(prod(local), false, local);
  }
  for (const hostile of ['https://evil.example', 'http://localhost.evil.example', 'http://192.168.1.1.evil.example', 'http://172.32.0.1']) {
    assert.equal(dev(hostile), false, hostile);
  }
  assert.equal(prod('https://app.example'), true);
});

test('try-the-demo works from another local port', async () => {
  const res = await fetch(`${BASE}/auth/demo`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:5174' }, body: '{}',
  });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5174');
  assert.equal((await res.json()).status, true);
});

test('sign-in does not reveal whether an account exists', async () => {
  const attempt = async (email) => {
    const res = await fetch(`${BASE}/auth/signin`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password: 'WrongPass123' }),
    });
    return (await res.json()).message;
  };
  assert.equal(await attempt('alice@test.invalid'), await attempt('nobody@test.invalid'));
});

test('logout revokes bearer tokens', async () => {
  const token = issueToken(alice._id);
  await wait(5);
  const res = await fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN } });
  assert.equal(res.status, 200);
  const socket = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token } });
  sockets.push(socket);
  assert.equal(await once(socket, 'auth'), null);
});

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex').toString('base64');

async function sendAttachment(socket, cid) {
  const reply = once(socket, 'messages');
  socket.emit('sendMessage', { cid, content: '', replace: 'p1', attachments: [{ file: PNG, type: 'image/png', name: 'a.png' }] });
  return (await reply).data[0].attachments[0].src;
}

test('attachments are private: members only, and only while members', async () => {
  const a = await connect(await fresh(alice));
  const src = await sendAttachment(a, String(dm._id));
  assert.match(src, /^media\//);
  const url = (user, token = issueMediaToken(user._id)) => fetch(`${BASE}/${src}?mt=${encodeURIComponent(token)}`).then((r) => r.status);

  assert.equal(await fetch(`${BASE}/${src}`).then((r) => r.status), 404, 'no token');
  assert.equal(await url(alice), 200);
  assert.equal(await url(bob), 200);
  assert.equal(await url(mallory), 404, 'non-member');
  assert.equal(await fetch(`${BASE}/.attachments/${src.slice(6)}`).then((r) => r.status), 404, 'static bypass');
  assert.equal(await url(bob, issueToken(bob._id)), 404, 'socket token is not a media token');

  const b = await connect(await fresh(bob));
  b.emit('leaveChat', { id: String(dm._id) });
  await once(b, 'leaveChat');
  assert.equal(await url(bob), 404, 'after leaving');
});

test('a media token cannot authenticate a socket', async () => {
  const socket = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token: issueMediaToken(alice._id) } });
  sockets.push(socket);
  assert.equal(await once(socket, 'auth'), null);
});

test('invites: secret, admin-only, revocable, hidden from members', async () => {
  const group = await models.ChatsModel.create({ type: 'group', name: 'club', owner: alice._id, admins: [alice._id], users: [alice._id, bob._id] });
  await models.UsersModel.updateMany({ _id: { $in: [alice._id, bob._id] } }, { $push: { Chats: group._id } });
  const cid = String(group._id);
  const a = await connect(await fresh(alice));
  const b = await connect(await fresh(bob));

  b.emit('getInviteCode', { cid });
  assert.equal(await once(b, 'inviteCode', 300), null, 'member got a code');
  a.emit('getInviteCode', { cid });
  const { code } = await once(a, 'inviteCode');

  b.emit('chats', { type: 'list' });
  assert.equal((await once(b, 'chat')).chats.some((chat) => chat.inviteCode), false);
  b.emit('search', { query: 'club', target: 3, reqId: 1 });
  assert.equal((await once(b, 'searchResults')).results[0].inviteCode, undefined);

  const m = await connect(await fresh(mallory));
  m.emit('joinByInvite', { code: cid });
  assert.match((await once(m, 'chatError')).message, /invalid/, 'chat id must not work');
  const joined = once(m, 'inviteJoined');
  const seen = once(b, 'chat');
  m.emit('joinByInvite', { code });
  assert.equal((await joined).cid, cid);
  assert.equal((await seen).chats[0].users.length, 3);

  a.emit('resetInviteCode', { cid });
  const rotated = await once(a, 'inviteCode');
  assert.notEqual(rotated.code, code);
  const carol = await seedUser('carol', 'x');
  const c = await connect(await fresh(carol));
  c.emit('joinByInvite', { code });
  assert.match((await once(c, 'chatError')).message, /invalid/, 'old code still works');
});

const signIn = async () => {
  const res = await fetch(`${BASE}/auth/signin`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email: 'alice@test.invalid', password: 'Password123' }),
  });
  return res.headers.get('set-cookie').split(';')[0];
};

test('logout closes this device only; logout everywhere closes all and ends sessions', async () => {
  const [one, two] = [await signIn(), await signIn()];
  const options = (cookie) => ({ extraHeaders: { Cookie: cookie, Origin: ORIGIN } });
  const first = await connect(null, options(one));
  const second = await connect(null, options(two));
  const firstOut = once(first, 'loggedOut');
  await fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { Cookie: one, Origin: ORIGIN } });
  assert.notEqual(await firstOut, null, 'own socket stayed open');
  await wait(100);
  assert.equal(second.connected, true, 'other device was closed by a plain logout');

  const secondOut = once(second, 'loggedOut');
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST', headers: { Cookie: two, Origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ everywhere: true }),
  });
  assert.notEqual(await secondOut, null);

  const three = await signIn();
  const third = await connect(null, options(three));
  const thirdOut = once(third, 'loggedOut');
  const four = await signIn();
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST', headers: { Cookie: four, Origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ everywhere: true }),
  });
  assert.notEqual(await thirdOut, null);
  const dead = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { Cookie: three, Origin: ORIGIN } });
  sockets.push(dead);
  assert.equal(await once(dead, 'auth'), null, 'old session still authenticates');
});

const emitAck = (socket, event, data) => new Promise((resolve) => socket.timeout(2000).emit(event, data, (err, res) => resolve(err ? null : res)));
const callToken = (user, cid) => fetch(`${BASE}/calls/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Authorization: `Bearer ${issueToken(user._id)}` },
  body: JSON.stringify({ cid, roomName: `lavender-${cid}` }),
}).then((r) => r.status);

test('a ringing call needs answering; busy users, decline and missed calls behave', async () => {
  const [aliceSocket, bobSocket, carolSocket] = await Promise.all([connect(alice), connect(bob), connect(mallory)]);
  const cid = String(dm._id);
  const other = await models.ChatsModel.create({ type: 'private', users: [mallory._id, bob._id] });
  await models.UsersModel.updateMany({ _id: { $in: [mallory._id, bob._id] } }, { $addToSet: { Chats: other._id } });
  const lateCarol = await connect(mallory);

  const ringing = once(bobSocket, 'incomingCall');
  assert.equal((await emitAck(aliceSocket, 'startCall', { cid, kind: 'audio' })).ok, true);
  assert.ok(await ringing);

  assert.equal((await emitAck(bobSocket, 'startCall', { cid, kind: 'audio' })).ok, false, 'calling back must not join');
  assert.equal(await callToken(bob, cid), 403, 'no room token before answering');
  const busy = await emitAck(lateCarol, 'startCall', { cid: String(other._id), kind: 'audio' });
  assert.match(busy.message, /another call/);

  const declined = once(aliceSocket, 'callEnded');
  bobSocket.emit('declineCall', { cid });
  assert.equal((await declined).reason, 'declined');
  await wait(150);
  assert.ok(await models.MessagesModel.findOne({ chat: dm._id, type: 'call', content: 'Declined voice call' }));

  await emitAck(aliceSocket, 'startCall', { cid, kind: 'video' });
  const answered = once(aliceSocket, 'callAnswered');
  assert.equal((await emitAck(bobSocket, 'answerCall', { cid })).ok, true);
  assert.ok(await answered);
  assert.notEqual(await callToken(bob, cid), 403, 'answering grants a token');
  const ended = once(bobSocket, 'callEnded');
  aliceSocket.emit('endCall', { cid });
  assert.equal((await ended).reason, 'ended');

  await emitAck(aliceSocket, 'startCall', { cid, kind: 'video' });
  const missed = once(aliceSocket, 'callEnded', 1500);
  assert.equal((await missed).reason, 'missed');
  await wait(150);
  assert.ok(await models.MessagesModel.findOne({ chat: dm._id, type: 'call', content: 'Missed video call' }));
  assert.equal((await emitAck(bobSocket, 'startCall', { cid, kind: 'audio' })).ok, true, 'ended calls free both users');
  bobSocket.emit('endCall', { cid });
  carolSocket.disconnect();
});

test('dropping off a call ends it after the grace period', async () => {
  const [aliceSocket, bobSocket] = await Promise.all([connect(alice), connect(bob)]);
  const cid = String(dm._id);
  await emitAck(aliceSocket, 'startCall', { cid, kind: 'audio' });
  await emitAck(bobSocket, 'answerCall', { cid });
  const ended = once(bobSocket, 'callEnded', 1500);
  aliceSocket.disconnect();
  assert.equal((await ended).reason, 'ended');
});

const envelope = () => ({
  v: 1, spk: Buffer.alloc(65, 1).toString('base64'), iv: Buffer.alloc(12, 2).toString('base64'), ct: Buffer.from('ciphertext').toString('base64'),
  keys: { [String(alice._id)]: { iv: Buffer.alloc(12, 3).toString('base64'), k: Buffer.alloc(48, 4).toString('base64') } },
});

test('encrypted messages keep nothing readable on the server', async () => {
  const [aliceSocket, bobSocket] = await Promise.all([connect(alice), connect(bob)]);
  const cid = String(dm._id);
  const seen = once(bobSocket, 'messages');
  aliceSocket.emit('sendMessage', { cid, content: 'must not be stored', e2ee: envelope(), attachments: [{ file: Buffer.from('opaque').toString('base64') }] });
  const { data: [message] } = await seen;
  assert.equal(message.content, '');
  assert.equal(message.e2ee.ct, envelope().ct);
  const stored = await models.MessagesModel.findById(message._id).lean();
  const chat = await models.ChatsModel.findById(cid).lean();
  assert.equal(stored.content, '');
  assert.equal(stored.attachments[0].name, 'encrypted');
  assert.equal(stored.attachments[0].contentType, 'application/octet-stream');
  assert.doesNotMatch(JSON.stringify([stored, chat]), /must not be stored/);
  assert.equal(chat.lastMessage.e2ee.ct, envelope().ct);

  const failed = once(aliceSocket, 'messageError');
  aliceSocket.emit('sendMessage', { cid, e2ee: { ...envelope(), keys: { nonsense: {} } } });
  assert.match((await failed).message, /not valid/);
  const refused = once(aliceSocket, 'messageError');
  aliceSocket.emit('sendMessage', { cid, attachments: [{ file: Buffer.from('opaque').toString('base64') }] });
  assert.ok(await refused, 'an unsealed upload still needs a real file type');
});

test('encrypted edits stay sealed; key backups are only given to their owner', async () => {
  const [aliceSocket, bobSocket] = await Promise.all([connect(alice), connect(bob)]);
  const cid = String(dm._id);
  const message = await models.MessagesModel.create({ chat: dm._id, uid: alice._id, content: '', e2ee: envelope(), type: 'text' });
  const edited = once(bobSocket, 'editMessage');
  aliceSocket.emit('editMessage', { id: String(message._id), cid, content: 'leak', e2ee: { ...envelope(), ct: 'bmV3' } });
  const update = await edited;
  assert.equal(update.content, '');
  assert.equal((await models.MessagesModel.findById(message._id).lean()).e2ee.ct, 'bmV3');

  const publicKey = Buffer.alloc(65, 9).toString('base64');
  const backup = { ct: 'YWJj', iv: 'YWJj', salt: 'YWJj', iterations: 600000 };
  assert.equal((await emitAck(aliceSocket, 'e2eeSetKey', { publicKey, backup })).ok, true);
  assert.equal((await emitAck(aliceSocket, 'e2eeSetKey', { publicKey, backup: { ...backup, iterations: 1 } })).ok, false);
  assert.deepEqual(await emitAck(bobSocket, 'e2eeKeys', { uids: [String(alice._id)] }), { [String(alice._id)]: publicKey });
  assert.equal((await emitAck(bobSocket, 'e2eeGetBackup', {})).backup, null);
  assert.equal((await emitAck(aliceSocket, 'e2eeGetBackup', {})).backup.ct, 'YWJj');
  const reconnected = await connect(alice);
  assert.equal(reconnected.profile.e2eePublicKey, publicKey);
  assert.equal(reconnected.profile.e2eeBackup, undefined);
});

test('crypto: only recipients read, tampering and forged senders fail', async () => {
  const crypto = await import('../../client/src/e2ee/crypto.js');
  const [a, b, c] = await Promise.all(['alice pass', 'bob pass', 'carol pass'].map((p) => crypto.createIdentity(p)));
  const recipients = { alice: a.publicKey, bob: b.publicKey };
  const sealed = await crypto.seal({ t: 'hello' }, { senderId: 'alice', privateKey: a.privateKey, publicKey: a.publicKey, recipients });
  assert.doesNotMatch(JSON.stringify(sealed), /hello/);
  const asBob = { senderId: 'alice', recipientId: 'bob', privateKey: b.privateKey };
  assert.equal((await crypto.open(sealed, asBob)).t, 'hello');
  assert.equal((await crypto.open(sealed, { ...asBob, recipientId: 'alice', privateKey: a.privateKey })).t, 'hello');

  await assert.rejects(crypto.open(sealed, { ...asBob, recipientId: 'carol', privateKey: c.privateKey }), 'non-recipient');
  await assert.rejects(crypto.open(sealed, { ...asBob, privateKey: c.privateKey }), 'wrong key');
  await assert.rejects(crypto.open(sealed, { ...asBob, senderId: 'carol' }), 'relabelled sender');
  const flipped = sealed.ct[0] === 'A' ? `B${sealed.ct.slice(1)}` : `A${sealed.ct.slice(1)}`;
  await assert.rejects(crypto.open({ ...sealed, ct: flipped }, asBob), 'tampered text');
  const { bob: _, ...withoutBob } = sealed.keys;
  await assert.rejects(crypto.open({ ...sealed, keys: { ...withoutBob, bob: sealed.keys.alice } }, asBob), 'swapped key entry');

  const forged = await crypto.seal({ t: 'forged' }, { senderId: 'alice', privateKey: c.privateKey, publicKey: c.publicKey, recipients });
  await assert.rejects(crypto.open({ ...forged, spk: a.publicKey }, asBob), 'cannot pose as alice');

  const privateKey = await crypto.restoreIdentity(a.backup, 'alice pass');
  assert.equal((await crypto.open(sealed, { senderId: 'alice', recipientId: 'alice', privateKey })).t, 'hello');
  await assert.rejects(crypto.restoreIdentity(a.backup, 'wrong pass'), 'wrong passphrase');

  const data = new TextEncoder().encode('file bytes');
  const file = await crypto.encryptBytes(data);
  assert.equal(new TextDecoder().decode(await crypto.decryptBytes(file.ct, file)), 'file bytes');
  assert.equal(await crypto.safetyNumber(a.publicKey, b.publicKey), await crypto.safetyNumber(b.publicKey, a.publicKey));
});

test('orphaned attachments are removed; referenced and fresh ones stay', async () => {
  const a = await connect(await fresh(alice));
  const kept = (await sendAttachment(a, String(dm._id))).slice(6);
  const dir = path.join(UPLOAD_DIR, '.attachments');
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  fs.writeFileSync(path.join(dir, 'orphan.png'), 'x');
  fs.writeFileSync(path.join(dir, 'fresh.png'), 'x');
  fs.utimesSync(path.join(dir, 'orphan.png'), old, old);
  fs.utimesSync(path.join(dir, kept), old, old);
  process.env.UPLOAD_DIR = UPLOAD_DIR;
  delete require.cache[require.resolve('../utils/uploads')];
  delete require.cache[require.resolve('../utils/cleanupAttachments')];
  const { cleanupOrphanAttachments } = require('../utils/cleanupAttachments');
  assert.equal(await cleanupOrphanAttachments(), 1);
  assert.deepEqual(fs.readdirSync(dir).sort(), [kept, 'fresh.png'].sort());
});

test('legacy migration moves attachments and decodes escaped text, and is idempotent', async () => {
  fs.writeFileSync(path.join(UPLOAD_DIR, 'old.png'), 'x');
  const old = await models.MessagesModel.create({
    chat: dm._id, uid: alice._id, content: 'I &lt;3 you &amp; a &gt; b',
    attachments: [{ src: 'old.png', name: 'old.png', contentType: 'image/png' }],
  });
  await models.ChatsModel.findByIdAndUpdate(dm._id, { lastMessage: { _id: old._id, mid: old.mid, uid: alice._id, type: 'text', content: '1 &lt; 2' } });
  const migrate = (...args) => new Promise((resolve, reject) => {
    spawn(process.execPath, ['migrateLegacyData.js', ...args], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, UPLOAD_DIR }, stdio: 'ignore',
    }).on('exit', (code) => (code ? reject(new Error(`exit ${code}`)) : resolve()));
  });
  await migrate();
  assert.equal((await models.MessagesModel.findById(old._id)).attachments[0].src, 'old.png', 'report mode changed data');
  await migrate('--apply');
  await migrate('--apply');
  const moved = await models.MessagesModel.findById(old._id);
  assert.equal(moved.attachments[0].src, 'media/old.png');
  assert.equal(moved.content, 'I <3 you &amp; a > b');
  assert.equal((await models.ChatsModel.findById(dm._id)).lastMessage.content, '1 < 2');
  assert.ok(fs.existsSync(path.join(UPLOAD_DIR, '.attachments', 'old.png')));
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, 'old.png')), false);
});

test('OTP: expiry, attempt cap, and resend keeps the attempt count', async () => {
  process.env.GOOGLE_CLIENT_ID ||= 'test';
  process.env.GOOGLE_CLIENT_SECRET ||= 'test';
  process.env.GOOGLE_REDIRECT_URI ||= 'http://localhost/cb';
  const { ValidateOtp, resendOTP } = require('../routes/auth/passportSetup');
  const hash = await bcrypt.hash('123456', 4);
  const run = (session, otp) => new Promise((resolve) => ValidateOtp({ session, body: { otp } }, (err, user, info) => resolve({ user, info })));

  const expired = await run({ otp: { email: 'n@test.invalid', hash, tries: 0, time: Date.now() - 11 * 60 * 1000 } }, '123456');
  assert.equal(expired.info.message, 'OTP has expired');

  const session = { otp: { email: 'n@test.invalid', hash, tries: 0, time: Date.now() } };
  for (let i = 0; i < 5; i++) assert.equal((await run(session, '000000')).info.message, 'OTP is incorrect');
  assert.equal((await run(session, '123456')).info.message, 'Tries exhausted');

  let status = null;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  await resendOTP({ session }, res);
  assert.equal(status, 429, 'resend inside the cooldown is refused');
  assert.equal(session.otp.tries, 5);
});
