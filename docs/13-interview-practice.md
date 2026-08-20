# 13. Interview Prep: Mock Interview & Practice

Part of the [Interview Prep section](./09-interview-prep.md). A worked mock
transcript first, then a bank of practice prompts by category to rehearse on your
own — each with a pointer to the relevant chapter, not a full answer, because the
point of a practice prompt is to make you produce the answer yourself.

## Mock transcript: "Design a WhatsApp-like chat application"

This is written as a full 40-ish-minute system-design round, condensed. Read it
once for the *shape* of a full answer — how much time goes to requirements vs.
architecture vs. deep-dive vs. scaling — then use it as a template.

> **Interviewer:** Design a chat application like WhatsApp. Where do you want to
> start?
>
> **Candidate:** I'd like to nail down requirements first. Functionally: 1:1 and
> group messaging, media attachments, some kind of presence signal like typing
> indicators, and delivery status. Non-functionally, the two I care most about are
> latency — messages should feel instant — and durability, messages can't be lost.
> I'll treat massive scale and strict multi-device sync as explicitly out of scope
> unless you want me to go there, and I'll come back to why.
>
> **Interviewer:** That's fine, keep going.
>
> **Candidate:** For capacity, let me put rough numbers on it. Say 100K daily
> active users, 40 messages per user per day — that's 4 million messages a day,
> about 46 a second on average, call it 230 at peak. Each message document is
> small, maybe 350 bytes, so that's under 2GB a day of message storage — not the
> bottleneck. The real capacity problem is attachments: if 15% of messages carry
> one, at maybe 300KB average, that's closer to 180GB a day. So whatever I design,
> attachment storage needs to be the thing that scales independently, not an
> afterthought bolted onto the message path.
>
> **Interviewer:** Good. Walk me through the architecture.
>
> **Candidate:** Six components. A connection layer holding persistent
> client connections — I'd use WebSockets specifically because this is
> bidirectional, both sending and receiving need to be real-time, so
> long-polling or SSE alone don't fit. A fan-out layer that routes a message to
> everyone currently connected to that conversation — I'd model that as one
> "room" per chat. Durable storage for messages and users — I'd lean document
> store here, since a message with its attachments and reactions is naturally
> one object, not a five-table join. A session store that both the HTTP and
> WebSocket sides can read, so a user doesn't need to re-authenticate for the
> socket. Object storage for attachment bytes, kept separate from the message
> documents themselves. And an auth layer in front of all of it.
>
> **Interviewer:** How does a client know it's authenticated on a WebSocket?
> There's no header there the way there is on HTTP.
>
> **Candidate:** The WebSocket handshake is still an HTTP request before the
> upgrade, so it carries the same session cookie a normal request would. If the
> session store is shared — the same middleware instance handling both — the
> socket handshake gets access to the same session data as a regular request,
> including who's logged in. No separate token needed.
>
> **Interviewer:** What happens if the sender and recipient are connected to
> different server instances?
>
> **Candidate:** That's the sharpest edge in this design, and I want to flag it
> before you ask. Rooms as I've described them are per-process — if I emit to a
> room on instance A, only sockets connected to instance A get it. Two users in
> the same chat on different instances would silently stop seeing each other.
> The fix is a pub/sub layer — Redis is the standard choice — that every instance
> subscribes to, so an emit on A gets published and every instance re-emits to
> its own local sockets in that room. I'd put that in *before* I ever put a load
> balancer in front of multiple instances, not after, because multiple instances
> without it is actively broken, not just unscaled.
>
> **Interviewer:** What guarantee do you have that a message isn't lost?
>
> **Candidate:** I'd be precise about what guarantee I'm actually giving. I'd
> write the message to durable storage *before* broadcasting it — so a crash
> right after send doesn't lose data that was already shown to the sender. Live
> delivery to a connected recipient is at-most-once per socket — if they're
> offline, I'm not holding a queue with a retry policy, I'm relying on them
> pulling the last N messages from durable storage when they reconnect. That's a
> real design choice, not a shortcut — it avoids needing per-recipient offset
> tracking or a message queue, and for a chat app, "catch up from history" is a
> perfectly good substitute for guaranteed queued redelivery. I'd only reach for
> a real queue if there were requirements this doesn't have — guaranteed
> ordering across a fan-out to thousands of recipients, for instance.
>
> **Interviewer:** Say this ships and one server isn't enough anymore. Walk me
> through scaling it.
>
> **Candidate:** In order: object storage and a CDN for attachments first, since
> the capacity numbers say that's the fastest-growing resource and it's also a
> prerequisite for running multiple instances at all — local disk under a load
> balancer doesn't work. Then the pub/sub fan-out layer I mentioned. Then the
> load balancer and multiple stateless instances — "stateless" doing real work
> there, since the session store already isn't process-local if it's backed by
> the database rather than in-memory. Then a database replica set for read
> scaling and failover. I'd defer sharding the message store until a single
> well-provisioned replica set actually can't keep up — it's the most expensive
> step on this list, because it changes how every query into that collection has
> to be written, and I don't want to pay that cost before the numbers say I need to.
>
> **Interviewer:** Anything you'd flag as a weakness in your own design if we had
> more time?
>
> **Candidate:** Two, concretely. First, the history-fetch query — I'd want an
> explicit sort and a compound index on `{conversation, timestamp}` backing it;
> "match plus limit with no sort" doesn't guarantee the most recent messages come
> back, it's whatever the query planner reaches first. Second, I'd double check
> that the same query enforces membership — a filter that changes *what* gets
> matched isn't the same thing as a check that *denies* the request outright when
> the caller isn't authorized, and that's an easy place for a real access-control
> bug to hide.

That last exchange isn't hypothetical — it's [the actual bug in Lavender's own
`messages` handler](./11-interview-system-design.md#a-concrete-design-review-what-i-d-flag-in-this-codebase-today).
Having a real, previously-shipped example of exactly that failure mode is a
better answer than describing the risk abstractly.

## Practice prompts

Work through these without looking at the linked chapter first — write or say a
full answer, *then* check it against the grounded version.

**Core system design**
- Design the "typing indicator" feature from scratch: what event fires it, how
  often, and how do you avoid flooding every other participant's client on every
  keystroke? (Check against [Chapter 5](./05-realtime-messaging.md#event-catalog).)
- Design message search across a user's entire chat history. What has to be
  indexed, and what's the tradeoff of doing it in the primary database vs. a
  dedicated search engine? (Check: `Messages.index({content:'text'})` in
  [Chapter 3](./03-data-model.md) — and consider what that text index doesn't
  give you at real scale.)
- A user sends a message while offline (dead socket, phone in a tunnel). Design
  what happens client-side and server-side. (Check against the optimistic-UI
  pipeline in [Chapter 5](./05-realtime-messaging.md#the-send-pipeline-optimistic-ui-then-reconciliation)
  — then note honestly what it does *not* yet handle.)

**Data modeling**
- Would you model group membership as an array on the group document, an array
  on the user document, or a separate join collection? Justify it against write
  and read frequency. (Check against [Chapter 3](./03-data-model.md#chats-servermodelschatsjs).)
- Design a schema for message reactions that scales to a channel with 50,000
  members, where a popular message might get thousands of reactions. Does
  Lavender's current embedded-array design hold up? (Check against
  [Chapter 12](./12-interview-tradeoffs.md#data-shape-embedded-array-vs-join-collection-blocked-starred-pinned-reactions).)

**Scaling & infrastructure**
- Given the capacity numbers in [Chapter 11 §2](./11-interview-system-design.md#2-capacity-estimation-with-real-numbers),
  at what daily active user count would you expect local-disk attachment storage
  to become the top operational risk, and what's the first metric you'd alert on
  before it becomes an outage?
- Walk through what changes (and what doesn't) in the session/auth layer when
  going from one server instance to ten. (Check against
  [Chapter 4](./04-authentication.md#session-and-socketio-sharing) and
  [Chapter 11 §5](./11-interview-system-design.md#5-scaling-path-1-instance--many).)

**Security**
- Find the authorization gap in the chat-history fetch yourself before reading
  the answer — what would you test to catch it in code review? (Answer:
  [Chapter 10](./10-interview-qna.md#the-chat-history-fetch-doesnt-sort-the-results-or-check-that-im-a-member-of-the-group-is-that-actually-true-and-what-would-you-do-about-it).)
- This app uses CORS + `SameSite` cookies instead of CSRF tokens. Under what
  changed threat model would that stop being sufficient? (Check against
  [Chapter 4](./04-authentication.md#security-notes).)

**Behavioral ("tell me about a bug you found/fixed")**
- Describe the `reply_to` lookup bug — what made it hard to notice, and what
  made it easy to fix once found? (Check against
  [Chapter 5](./05-realtime-messaging.md#the-reply-lookup-bug).)
- Describe the chat-history query's three stacked issues (sort, index,
  authorization) as if you'd just found them in a code review — practice
  presenting correctness, performance, and security findings about the *same*
  piece of code without conflating them into one vague complaint.

## Before you go in: a self-check

- Can you state Lavender's actual delivery guarantee in one precise sentence,
  without saying "exactly-once" if it isn't? ([§4](./11-interview-system-design.md#4-delivery-guarantees-and-consistency-be-precise-here))
- Can you name three real, specific gaps in this codebase without checking notes?
- Can you justify one tradeoff you'd *keep* even though a "more correct" 
  alternative exists, and name the concrete signal that would make you switch?
- Can you draw the scaling path from one instance to many from memory, in the
  right order, and explain why the order matters?

If all four are yes, you're ready.
