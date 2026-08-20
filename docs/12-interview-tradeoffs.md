# 12. Interview Prep: Tradeoffs & Alternatives

Part of the [Interview Prep section](./09-interview-prep.md). "Why not X instead?"
is the single most common follow-up in a system-design interview — every
consequential decision in this codebase has an alternative that's arguably more
"correct" on paper, and being asked to defend the choice actually made is the
point of the question. Each table below: what Lavender did, the real alternative,
why the current choice made sense *here*, and the concrete signal that would flip
the decision.

## Database: MongoDB vs. a relational database

| | MongoDB (chosen) | PostgreSQL (alternative) |
|---|---|---|
| Why it fit | The data model is naturally document-shaped — a message with an embedded `attachments[]` and `reactions[]` array maps directly to one document, no join needed to render a message row ([Chapter 3](./03-data-model.md)). | Would need `attachments` and `reactions` as separate tables with foreign keys, or JSONB columns that give back most of Mongo's flexibility anyway. |
| What it costs | No cross-document transactions used anywhere in this codebase (e.g. `deleteChat` cascades with multiple sequential writes, not an atomic transaction) — a partial failure mid-cascade is possible today. | Real transactions — a group deletion cascading to messages and member lists could be one atomic statement. |
| I'd switch if | The app needed strong relational integrity guarantees (e.g. financial-grade "this either all happens or none of it does") or heavy ad-hoc joins/reporting across collections. | — |

## File transport: base64-over-WebSocket vs. HTTP/multipart vs. presigned direct upload

| | Base64-over-socket (chosen) | HTTP POST /multipart | Presigned direct-to-object-storage |
|---|---|---|---|
| Auth reuse | Free — same authenticated socket, no separate auth logic ([Chapter 6](./06-file-uploads.md)) | Needs its own session-cookie check on the route | Needs a short-lived server-issued token, then the *upload itself* bypasses the app server entirely |
| Overhead | ~33% larger on the wire (base64 encoding), whole file buffered in memory as a string/Buffer | Streamed, minimal overhead | Streamed straight to storage — the app server's memory and bandwidth are never in the path at all |
| Max practical size | Small — this is exactly why Lavender caps uploads at 2 MB | Large (streams to disk) | Very large — this is the standard answer for "how would you support GB-scale uploads" |
| I'd switch if | — | Attachments needed to exceed a few MB reliably | Upload volume or file size grew enough that app-server bandwidth/memory became the bottleneck — the standard answer once you're past a hobby-scale deployment |

## Client state: Context API vs. Redux / Zustand / Jotai

| | Single Context (chosen) | Redux / Zustand-style store |
|---|---|---|
| Simplicity | One `AppScreen` context, no reducers/actions boilerplate, "where does this state live" is unambiguous ([Chapter 7](./07-frontend-architecture.md)) | More setup, but a real answer to the next row |
| Re-render granularity | **None** — `useContext` can't select a slice, so every consumer re-renders on any change to shared state | Selector-based — a component subscribes to only the slice it reads |
| I'd switch if | — | A chat view regularly rendered thousands of DOM nodes and the whole-context re-render became visible jank — the concrete trigger, not "Context doesn't scale" as an abstract claim |

## Session: server-side cookie session vs. JWT

| | Cookie session (chosen) | Stateless JWT |
|---|---|---|
| Revocation | Instant — delete the session document in MongoDB, the user is logged out everywhere immediately | Hard — a JWT is valid until it expires unless you maintain a blocklist, which reintroduces server-side state anyway |
| Socket.IO fit | Falls out for free — the same session cookie the browser already sends is readable at the Socket.IO handshake via `express-socket.io-session` ([Chapter 4](./04-authentication.md#session-and-socketio-sharing)) | Needs the token to be sent explicitly in the handshake `auth` payload and re-verified there |
| Cross-service use | Requires the session store (MongoDB) to be reachable from every service that needs to authenticate a user | Self-contained — any service with the public key can verify it without a shared store |
| I'd switch if | — | The system split into multiple independently-deployed backend services that all needed to verify identity without a shared session store — not a problem this single-server-plus-socket architecture has today |

## Data shape: embedded array vs. join collection (`blocked`, `starred`, `pinned`, `reactions`)

| | Embedded `ObjectId[]` on the parent doc (chosen for all four) | Separate join collection (e.g. `Reports`-style) |
|---|---|---|
| Why it fit | Each of these is small, bounded, and only ever queried as "give me this user/chat's whole set" — a push/pull on an array is simpler than a dedicated collection for that access pattern ([Chapter 3](./03-data-model.md)) | Needed once the set can grow unboundedly or needs its own metadata per entry |
| Where Lavender *did* use a join-style collection instead | `Reports` — because a report needs its own fields (`reason`, `targetType`) that don't belong embedded on the thing being reported | — |
| I'd switch a given array to a collection if | It needed per-entry metadata (e.g. *when* something was starred, not just *that* it was) or could grow past what's reasonable to load as one document field — e.g. reactions on a message with tens of thousands of participants, which is a real Discord/Slack-scale problem this app doesn't have yet | — |

## Transport: WebSocket (Socket.IO) vs. long-polling vs. Server-Sent Events

| | WebSocket / Socket.IO (chosen) | Long-polling | SSE |
|---|---|---|---|
| Direction | Bidirectional — the client emits `sendMessage`, `typing`, etc. over the same connection it receives on | Bidirectional but simulated (repeated HTTP requests), higher latency and server load | **Server → client only** — a chat app needs the client to send too, so SSE alone can't replace this without a second channel for client → server |
| Why it fit | A chat app is fundamentally bidirectional (sending *and* receiving are both real-time), and Socket.IO adds automatic reconnection/fallback transport handling on top of raw WebSockets | — | — |
| I'd switch if | — | Never, for this use case — long-polling is strictly worse here on every axis | Only for a *different* feature that's genuinely one-directional (e.g. a live "N people online" ticker), potentially alongside the existing socket, not instead of it |

## Deployment topology: monolith vs. microservices

| | One Express+Socket.IO process (chosen) | Split into auth-service / messaging-service / upload-service |
|---|---|---|
| Why it fit | Every request path in this app touches the same session and often the same data — splitting adds network hops and distributed-transaction complexity for no benefit at this scale ([Chapter 2](./02-architecture.md)) | Real benefit once different parts of the system need to scale, deploy, or fail independently |
| What Lavender *did* split | Client (React/Vite) and server (Express/Socket.IO) — into two independently deployable units, for exactly the "different scaling/deploy needs" reason ([Chapter 2](./02-architecture.md#why-client-and-server-are-separate-deployables), [Chapter 8](./08-deployment.md)) | — |
| I'd switch to full microservices if | — | Upload traffic or auth traffic needed to scale independently of message-send traffic, or different teams needed to own and deploy each piece independently — not a problem a single-team project at this size has |

The general pattern across all of these, worth stating explicitly if asked to
summarize your own philosophy: **every one of these choices is a "yes, but here's
the specific signal that would flip it" answer, not a permanent belief.** That's
the actual thing a "why not X" question is trying to surface.
