# Lavender

A real-time, one-on-one and group messaging app in the same product category as
WhatsApp or Telegram — built with React + Vite on the client and Express +
Socket.IO on the server, backed by MongoDB.

**📖 Full architecture & implementation docs:** https://sumitjoshigit.github.io/cozy-chatroom-MERN/

The docs are a chapter-by-chapter walkthrough of how the system actually works —
data model, auth, the real-time messaging pipeline, file uploads, deployment, and
an honest feature-status/roadmap breakdown. This README is just the quickstart.

## Features

- Local signup with email OTP verification, plus Google OAuth login
- 1:1 direct messages and group chats (create, name, photo, members)
- Group roles — owner / admin / member, with promote / demote / remove
- Reply-to with a quoted preview, message edit, message forward
- Image and document attachments (PDF, Word/Excel/PowerPoint, text, CSV, zip)
- Emoji reactions, message pinning, starred/saved messages
- Typing indicators, delivery ticks
- Block / report a user, delete a chat or group
- Live profile editing, per-chat wallpaper, dark mode, accent theming
- One-to-one and group audio/video calls via LiveKit

See the [feature status table](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/01-overview) for what's shipped vs. still on the [roadmap](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/15-roadmap).

## Modern chat expectations vs. current gaps

A modern messaging app is expected to do more than send text and media. The
market in 2026 expects chat products to feel polished across trust, speed, and
multi-device reliability, including:

- private-by-default messaging with stronger security controls and disappearing-message options
- AI-assisted experiences such as summaries, smart replies, translation, and moderation
- richer composition workflows like polls, voice notes, reactions, and threaded discussions
- channel/community models for large audiences, not only flat group threads
- background notifications and app-like mobile/web reliability when the user is not actively on the screen
- cross-device sync, moderation tools, and deep personalization without breaking the core chat experience

Lavender already covers the baseline: real-time 1:1 and group chat, attachments,
profile editing, reactions, typing indicators, call scaffolding, and permissions.
The current gaps are also visible and honest: no end-to-end encryption, no
true disappearing messages, no polls/threads/channels, no push notifications for
closed tabs, and no AI features or voice-note workflow yet. Those omissions are
normal for a working MVP-level chat app, but they are exactly the areas a modern
chat product needs to close before it feels "finished" to users.

Prepping for a system-design interview around this project? The docs have a
dedicated [Interview Prep section](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/09-interview-prep) —
grounded Q&A, a full capacity-estimation and scaling deep dive, tradeoff
breakdowns, and a worked mock-interview transcript, all built around this
specific codebase rather than generic chat-app theory.

## Tech stack

| | |
|---|---|
| Client | React 18, Vite, React Router, Tailwind CSS, Socket.IO client, IndexedDB (offline-first cache) |
| Server | Express 4, Socket.IO 4, Passport.js (local + OTP + Google OAuth2), Mongoose |
| Database | MongoDB, sessions shared between REST and WebSocket via `express-socket.io-session` |
| Calls | LiveKit SFU, invited through Socket.IO and authorized by the Express server |

`client/` and `server/` are independently deployable — see
[Chapter 8](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/08-deployment) for why.

## Quickstart

Prerequisites: Node.js 18+, a running MongoDB instance (local or Atlas).

```bash
git clone https://github.com/SumitJoshiGIT/cozy-chatroom-MERN.git
cd cozy-chatroom-MERN
```

**Server:**

```bash
cd server
npm install
cp .env.example .env   # fill in DATABASE, SESSION_SECRET, etc. — see below
npm run dev             # nodemon, http://localhost:3000
```

**Client** (in a second terminal):

```bash
cd client
npm install
cp .env.example .env   # VITE_API_ORIGIN=http://localhost:3000
npm run dev              # http://localhost:5173
```

Optional: `npm run seed` in `server/` populates the database with fake users/chats/messages (via `@faker-js/faker`) for local testing.

To create reusable local sign-in accounts without clearing existing data:

```bash
cd server
npm run seed:local-users
```

The idempotent script creates five users in the configured MongoDB database and
writes their credentials to `server/local-demo-users.txt`. Existing users with
the same test emails are not modified. The credentials file is Git-ignored and
should remain local.

## Docker Compose

The repository includes a production-shaped local Compose setup with:

- MongoDB 7 and a persistent `mongo-data` volume
- The Express + Socket.IO server on `http://localhost:3000`
- The built React SPA behind Nginx on `http://localhost:5173`
- A persistent bind mount for uploaded files in `server/public/`

Start the full stack:

```bash
docker compose up --build
```

Open <http://localhost:5173>. The server connects to MongoDB through the
internal Compose hostname `mongo`; the browser-facing `VITE_API_ORIGIN` must
remain `http://localhost:3000` because requests originate in the browser, not
inside the client container.

MongoDB is also published on `localhost:27017`, so you can run the Node server
and Vite client directly on the host while MongoDB runs in Docker:

```bash
docker compose up -d mongo

# server/.env
DATABASE=mongodb://localhost:27017/Lavendar

cd server
npm run dev

# in another terminal
cd client
npm run dev
```

Do not run a separate host MongoDB on the same port while the Compose MongoDB
service is running. Use `docker compose down` when finished.

Compose reads optional values from the shell environment. For demo accounts:

```bash
DEMO_ENABLED=true VITE_DEMO_ENABLED=true docker compose up --build
```

For persistent local settings, create a root `.env` file (it is ignored by
Git), for example:

```env
SESSION_SECRET=replace-this-for-local-use
DEMO_ENABLED=true
VITE_DEMO_ENABLED=true
DEMO_TTL_HOURS=24
```

Stop the services without deleting MongoDB data:

```bash
docker compose down
```

Delete the MongoDB volume as well only when intentionally resetting local data:

```bash
docker compose down -v
```

The client image is built with Vite environment variables, so rebuild it after
changing any `VITE_*` value.

## Environment variables

**`server/.env`**

| Variable | Notes |
|---|---|
| `DATABASE` | MongoDB connection string |
| `SESSION_SECRET` | Required in production |
| `CLIENT_ORIGIN` | Exact origin allowed by CORS / Socket.IO — must match where the client is hosted |
| `PORT` | Defaults to 3000 |
| `NODE_ENV` | Gates secure-cookie / `sameSite=none` behavior |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth — register in Google Cloud Console |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail SMTP for OTP delivery (use an app password) |
| `DEMO_ENABLED` | Enables temporary anonymous demo accounts when set to `true` |
| `DEMO_TTL_HOURS` | Demo account lifetime in hours; defaults to `24` |

**`client/.env`**

| Variable | Notes |
|---|---|
| `VITE_API_ORIGIN` | The server's public URL — baked into the client bundle at build time |
| `VITE_LIVEKIT_URL` | Optional LiveKit WebSocket URL for the client build |
| `VITE_DEMO_ENABLED` | Shows the temporary demo-account action when set to `true` |

For calls, also configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` in `server/.env`. See
[Chapter 16](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/16-video-calls)
for the call flow and deployment requirements.

To enable temporary trial accounts, set `DEMO_ENABLED=true` and optionally
`DEMO_TTL_HOURS=24` on the server, plus `VITE_DEMO_ENABLED=true` on the client.
See [Chapter 4](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/04-authentication)
for the token and cleanup behavior.

## Deployment

- **Client → [Vercel](https://vercel.com).** Point a Vercel project at `client/`
  (framework preset: Vite), set `VITE_API_ORIGIN` as a build-time env var.
  `client/vercel.json` handles the SPA rewrite so client-side routes survive a
  hard refresh.
- **Server → Render, Railway, Fly.io, or any host that keeps a long-running
  process alive.** Socket.IO needs a persistent process — it cannot run as a
  serverless/edge function.

Full details, including cookie/CORS behavior in production and the honest gaps
between "deployable" and "production-grade at scale," are in
[Chapter 8 of the docs](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/08-deployment).

## Project structure

```
client/   React + Vite SPA
server/   Express + Socket.IO API
docs/     Architecture walkthrough, published to GitHub Pages via docsify
```
