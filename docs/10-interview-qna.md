# 10. Interview Prep: Core Q&A

Part of the [Interview Prep section](./09-interview-prep.md). This chapter is a set
of questions someone could plausibly ask about this project — either "walk me
through X" questions about how it actually works, or system-design questions about
how you'd change it. Each answer is grounded in the real implementation (with
pointers back to the relevant chapter) rather than generic chat-app theory.

## "Walk me through what happens when I send a message."

Full detail in [Chapter 5](./05-realtime-messaging.md#the-send-pipeline-optimistic-ui-then-reconciliation).
The short version, structured as an answer:

1. The compose box inserts a locally-generated, pending-status message into React
   state immediately — the UI never waits on the network to show what you typed.
2. That message's own row component, on mount, notices its pending status and is
   the thing that actually calls `socket.emit`. This decouples "show it" from
   "send it" — the same code path handles retry-on-remount.
3. The server validates the sender is a member of that chat (an in-memory `Set`
   check, no DB round-trip), persists the message, and broadcasts it to everyone in
   that chat's Socket.IO room.
4. The sender's client reconciles: deletes the optimistic placeholder (keyed by a
   client-generated id) and inserts the confirmed message (keyed by the server's
   `mid`) — a `replace` field carried through the whole round trip is what ties
   those two together.

## "How do you know a user is authenticated on a WebSocket connection? There's no header to check."

The Socket.IO handshake carries the same cookie a normal HTTP request would,
because it's still an HTTP request initially (Socket.IO upgrades from HTTP).
`express-socket.io-session` reuses the *same* `express-session` middleware
instance for both HTTP and the socket handshake, so `socket.handshake.session` ends
up populated exactly the way `req.session` would be — including
`session.passport.user`, which Passport put there at login. There's no separate
socket-auth token or handshake payload; the existing session cookie *is* the
credential. Full detail: [Chapter 4](./04-authentication.md#session-and-socketio-sharing).

## "Why base64 the images through a WebSocket event instead of a normal file upload endpoint?"

This is intentionally a question with a real tradeoff, not a "gotcha" — see
[Chapter 6](./06-file-uploads.md) and [Chapter 12](./12-interview-tradeoffs.md#file-transport-base64-over-websocket-vs-httpmultipart-vs-presigned-direct-upload)
for the full comparison. The honest answer: it reuses the existing authenticated
channel with no extra route or auth logic, at the cost of ~33% wire overhead from
base64 encoding and no streaming (the whole file sits in memory as a
string/Buffer, which is why there's a hard 2 MB cap). If this needed to support
larger files or higher upload volume, the fix is a dedicated upload endpoint (or
presigned direct-to-object-storage), with the socket used only to notify chat
members once the upload lands — separating "durably store the bytes" from "tell
people about it in real time."

## "How did you scope document attachments (PDFs, Office files) without weakening avatar/group-photo uploads?"

Both paths funnel through the same `saveUpload()` helper in
`server/routes/api/socketEvents.js`, which validates against an allow-list of
MIME type → file extension before writing anything to disk. Rather than adding
document types to that one shared allow-list (which would let a document get
uploaded as a profile picture too), `saveUpload()` takes an optional `extraTypes`
argument that's merged onto the base image allow-list only at the call site:

```js
async function saveUpload(base64, mimeType, name, size, extraTypes) {
  const allowList = extraTypes ? { ...allowedTypes, ...extraTypes } : allowedTypes;
  if (!base64 || !allowList[mimeType]) return null;
  // ...
}
```

The message-attachment call site passes `allowedDocTypes` as `extraTypes`; the
avatar and group-photo call sites don't pass anything, so they silently keep the
image-only allow-list. The validation is server-side and MIME-type-based
regardless of what the browser's file picker `accept` attribute allowed
client-side — a client that bypasses the picker (a raw `socket.emit`, a modified
request) still can't smuggle an `.exe` or an oversized payload past this check.
That's the transferable point: **scope a shared validator by composition at the
call site, not by widening the one shared list** — it keeps the two upload
surfaces independently auditable even though they share almost all their code.

## "This works with one server instance. How would you scale it horizontally?"

Two independent bottlenecks, and they need different fixes — the full
capacity-estimation version of this answer, with numbers, is
[Chapter 11](./11-interview-system-design.md#scaling-path-1-instance-%E2%86%92-many):

- **Socket.IO rooms are per-process.** `io.to(chatId).emit(...)` only reaches
  sockets connected to *that* instance. Behind a load balancer with N instances,
  you need a Socket.IO adapter (commonly Redis pub/sub) so an emit on one instance
  fans out to sockets connected to the others.
- **Sessions are already instance-agnostic** — they're stored in MongoDB via
  `connect-mongo`, not in-process memory, so any instance can resolve any session
  cookie. That part scales out for free; it's the room-broadcast piece that
  doesn't, and that distinction (state that's externalized vs. state that's still
  process-local) is exactly the kind of thing worth calling out unprompted.
- **File storage** would also need to move off local disk to something instance-
  agnostic (object storage) for the same reason — see
  [Chapter 6](./06-file-uploads.md#storage-is-local-disk-not-object-storage).

## "How would you add read receipts / delivery status per recipient?"

Today, `Messages.status` is a single enum on the message (`✔` sent, `✔✔` — defined
but not currently driven by any per-recipient signal). Real per-recipient read
state needs a different shape: either an embedded array on the message
(`readBy: [{ user, at }]`), or — better at scale, since editing a giant embedded
array on every read is expensive — a separate `read_receipts` collection keyed by
`(message, user)`, updated via a new socket event (e.g. `markRead`) fired when a
chat's message list scrolls into view, broadcast back to the room so the sender's
UI updates the tick.

## "The chat-history fetch doesn't sort the results or check that I'm a member of the group. Is that actually true, and what would you do about it?"

Yes — and being able to spot and explain this precisely, rather than reciting
"the code has bugs" vaguely, is a good signal. The `messages` socket handler in
`server/routes/api/socketEvents.js` runs this aggregation to load a chat's history:

```js
const obj = { chat: new ObjectID(stream.cid) };
if (!chatSet.has(stream.cid)) obj.type = 'group';
const data = await models.MessagesModel.aggregate([
  { $match: obj },
  { $limit: 30 },
  { $lookup: { from: "messages", localField: "reply_to", foreignField: "_id", as: "replyToMessage" } },
  { $unwind: { path: "$replyToMessage", preserveNullAndEmptyArrays: true } },
]);
```

Two real problems, both worth naming separately because they have different fixes:

1. **No `$sort` before `$limit`.** MongoDB doesn't guarantee a `$match` + `$limit`
   pipeline returns the most *recent* 30 messages — it returns whatever 30 the
   query planner reaches first. In practice, on an unmodified collection, that
   often approximates insertion order, but it's not a guarantee the code makes
   explicit or that survives things like a re-index. The fix is a `{ $sort:
   { createdAt: -1 } }` stage before `$limit`, backed by a compound index (see #3).
2. **`chatSet.has(stream.cid)` gates a `type` filter, not access.** `chatSet` is
   the connected user's own chat-membership set. If the requested `cid` *isn't* in
   it, the code doesn't deny the request — it just adds `type: 'group'` to the
   match and runs the query anyway. That means a socket that knows (or finds
   through search — group names/usernames are text-indexed and searchable) a
   group's ObjectId can pull that group's message history without ever having
   joined it. The fix is straightforward: `if (!chatSet.has(stream.cid)) return;`
   before running the query — membership is already known in memory, so denying
   is a single early return, not a new DB call.
3. **No index backs the hot path.** Neither field in `{ chat, type }` is indexed
   (the only indexes on `Messages` are a text index on `content` and the
   `mongoose-sequence` index on `mid`), so this query — the single most frequently
   run query in the app, since it fires every time a chat is opened — is a
   collection scan. A compound index on `{ chat: 1, createdAt: -1 }` fixes the
   scan *and* makes the sort in fix #1 free.

This exact example — three distinct, fixable problems on one hot-path query
(missing sort, missing authorization check, missing index) — is exactly the kind
of finding a system-design interviewer is hoping you'll surface unprompted when
asked to review a piece of a system. The full write-up, with the fix and the
follow-on pagination design, is in
[Chapter 11](./11-interview-system-design.md#a-concrete-design-review-what-i-d-flag-in-this-codebase-today).

## "There's a `reply_to` field but you mentioned a bug — what was it, concretely?"

A good one to be able to explain precisely, because it's a real bug this project
had, not a hypothetical: the client's message cache is keyed by `mid` (a small
integer) for fast, ordered access, but `reply_to` stores the replied-to message's
Mongo `_id` — a different value in a different key space. Looking a message up in
a `mid`-keyed map using an `_id` silently returns `undefined` — no error, the quote
preview just never renders, even though the relationship was correctly saved server
-side the whole time. The fix was building a second, `_id`-indexed map alongside
the existing `mid`-indexed one. The general lesson — "a collection keyed one way
for one purpose can't be reused as a relational index for a different purpose
without a second index" — is the transferable part. Full writeup:
[Chapter 5](./05-realtime-messaging.md#the-reply-lookup-bug).

## "Why one big React Context instead of Redux/Zustand/etc.?"

At this app's current scope — one open chat, a bounded set of loaded messages, one
user's session — a single Context is simpler and has fewer moving parts than a
dedicated state library, and it keeps "where does this state live" unambiguous.
The real cost, worth naming rather than glossing over: `useContext` doesn't support
selecting a slice, so **every** consumer re-renders on **any** change to the shared
state. That's invisible at today's scale; it stops being invisible if a chat
regularly renders thousands of DOM nodes for messages, at which point you'd either
split into narrower contexts (e.g. separate "active chat" state from "chat list"
state so switching chats doesn't re-render the sidebar) or move to a selector-based
store. Detail: [Chapter 7](./07-frontend-architecture.md#one-context-not-a-state-management-library),
[Chapter 12](./12-interview-tradeoffs.md#client-state-context-api-vs-redux--zustand--jotai).

## "What's missing that you'd flag as gaps before calling this production-ready?"

In rough priority order, being specific rather than saying "more testing":

1. **The chat-history query above is missing an authorization check.** The
   single most concrete, fixable finding in the codebase today — see above.
2. **No rate limiting** on auth endpoints (`/auth/signin`, `/auth/signup`) — a
   password-guessing or OTP-brute-force loop is currently unthrottled beyond the
   existing 3-tries-per-OTP counter.
3. **No horizontal scaling story for Socket.IO or file storage** (see above) —
   fine for one instance, breaks silently past that.
4. **No automated tests.** The app was verified manually (and via live browser
   automation during development) rather than with a test suite — a real next step
   for a codebase at this size.
5. **CSRF protection is CORS/`SameSite`-only**, not token-based (see
   [Chapter 4](./04-authentication.md#security-notes)) — a deliberate choice
   documented as one, but worth re-evaluating if the app's trust boundary changes.
6. **No read receipts, push notifications, message threading, or polls yet** —
   tracked with a full gap analysis and build order in
   [Chapter 15](./15-roadmap.md), since by this point in the project the
   lower-hanging feature gaps (reactions, pinning, typing indicators, block/report)
   have already shipped.

Being able to list *specific, real* gaps like this — rather than either pretending
the project has none, or being vague about "scalability" and "security" as
abstract categories — is usually a stronger signal in an interview than the gaps
themselves.
