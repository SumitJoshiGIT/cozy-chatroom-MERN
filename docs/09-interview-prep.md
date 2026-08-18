# 9. Interview Prep: Q&A

This chapter is written as a set of questions someone could plausibly ask about
this project — either "walk me through X" questions about how it actually works,
or system-design questions about how you'd change it. Each answer is grounded in
the real implementation (with pointers back to the relevant chapter) rather than
generic chat-app theory, because "I built this and here's specifically what I'd do
differently" is a much stronger interview answer than reciting facts about
WebSockets in the abstract.

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
[Chapter 6](./06-file-uploads.md) in full. The honest answer: it reuses the
existing authenticated channel with no extra route or auth logic, at the cost of
~33% wire overhead from base64 encoding and no streaming (the whole file sits in
memory as a string/Buffer, which is why there's a hard 2 MB cap). If this needed to
support larger files or higher upload volume, the fix is a dedicated upload
endpoint (or presigned direct-to-object-storage), with the socket used only to
notify chat members once the upload lands — separating "durably store the bytes"
from "tell people about it in real time."

## "This works with one server instance. How would you scale it horizontally?"

Two independent bottlenecks, and they need different fixes:

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
store. Detail: [Chapter 7](./07-frontend-architecture.md#one-context-not-a-state-management-library).

## "What's missing that you'd flag as gaps before calling this production-ready?"

In rough priority order, being specific rather than saying "more testing":

1. **No rate limiting** on auth endpoints (`/auth/signin`, `/auth/signup`) — a
   password-guessing or OTP-brute-force loop is currently unthrottled beyond the
   existing 3-tries-per-OTP counter.
2. **No horizontal scaling story for Socket.IO or file storage** (see above) —
   fine for one instance, breaks silently past that.
3. **No automated tests.** The app was verified manually (and via live browser
   automation during development) rather than with a test suite — a real next step
   for a codebase at this size.
4. **CSRF protection is CORS/`SameSite`-only**, not token-based (see
   [Chapter 4](./04-authentication.md#security-notes)) — a deliberate choice
   documented as one, but worth re-evaluating if the app's trust boundary changes.
5. **Feature gaps** relative to the product's WhatsApp/Telegram inspiration: no
   emoji reactions, message pinning, typing indicators, block/report, or push
   notifications yet (tracked in [Chapter 1](./01-overview.md#feature-status)).

Being able to list *specific, real* gaps like this — rather than either pretending
the project has none, or being vague about "scalability" and "security" as
abstract categories — is usually a stronger signal in an interview than the gaps
themselves.
