// Live call state. Held in memory because a call cannot outlive the connected
// sockets that run it, and the server runs as a single process.
const RING_MS = Number(process.env.CALL_RING_MS) || 30000;

const calls = new Map(); // cid -> call
const userCalls = new Map(); // uid -> cid, covers both ringing and joined users

const get = (cid) => calls.get(cid);
const isBusy = (uid) => userCalls.has(uid);
const forUser = (uid) => calls.get(userCalls.get(uid));
const canJoin = (cid, uid) => !!calls.get(cid)?.joined.has(uid);

function release(call, uid) {
  if (userCalls.get(uid) === call.cid) userCalls.delete(uid);
}

function create({ cid, callerId, socketId, kind, group, members, ringing, onTimeout }) {
  const call = {
    cid, callerId, kind, group,
    state: 'ringing',
    members: new Set(members),
    ringing: new Set(ringing),
    joined: new Map([[callerId, socketId]]),
  };
  calls.set(cid, call);
  userCalls.set(callerId, cid);
  ringing.forEach((uid) => userCalls.set(uid, cid));
  call.timer = setTimeout(() => onTimeout(call), RING_MS);
  call.timer.unref?.();
  return call;
}

function end(call) {
  clearTimeout(call.timer);
  [...call.joined.keys(), ...call.ringing].forEach((uid) => release(call, uid));
  calls.delete(call.cid);
}

function answer(call, uid, socketId) {
  call.ringing.delete(uid);
  call.joined.set(uid, socketId);
  call.state = 'active';
}

function join(call, uid, socketId) {
  call.joined.set(uid, socketId);
  userCalls.set(uid, call.cid);
}

// Stops ringing one user. True when nobody is left to answer.
function decline(call, uid) {
  call.ringing.delete(uid);
  release(call, uid);
  return call.state === 'ringing' && (!call.group || call.ringing.size === 0);
}

// True when the call cannot continue without this user.
function leave(call, uid) {
  call.joined.delete(uid);
  release(call, uid);
  return call.state === 'ringing' ? uid === call.callerId : call.joined.size < 2;
}

function stopRinging(call) {
  const stopped = [...call.ringing];
  stopped.forEach((uid) => release(call, uid));
  call.ringing.clear();
  return stopped;
}

module.exports = { get, isBusy, forUser, canJoin, create, end, answer, join, decline, leave, stopRinging };
