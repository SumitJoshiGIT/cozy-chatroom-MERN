# 8. Deployment

## The two artifacts

`server/` and `client/` are built and deployed completely independently — neither
`npm install` nor `npm run build` in one directory touches the other. That
independence is the whole point of the split described in
[Chapter 2](./02-architecture.md): a platform only needs to be pointed at one
subdirectory and given that subdirectory's own `package.json`.

### `server/`

A plain long-running Node process (`npm start` → `node app.js`). Needs:

- A host that keeps a process alive and reachable on a port — Socket.IO cannot run
  on a request-scoped serverless function (see [Chapter 2](./02-architecture.md)
  for why). Render, Railway, Fly.io, or a plain VM all work; Vercel's serverless
  functions do not — the server has to be deployed somewhere else.
- A MongoDB connection string (`DATABASE`).
- The environment variables listed below.

### `client/`

A static build (`npm run build` → `client/dist/`) deployed to **Vercel**. Point a
Vercel project at the `client/` directory (framework preset: Vite) and set
`VITE_API_ORIGIN` to the server's public URL as a build-time environment variable
— Vercel then runs `npm run build` and serves `client/dist` from its CDN.
`client/vercel.json` adds the one thing Vercel's static file serving doesn't do by
default: rewrite every path to `index.html` so client-side routes like
`/auth/signin` or `/app` survive a hard refresh or a direct link instead of 404ing
(`react-router-dom` then takes over routing in the browser). The same static build
also works on any other static host (S3+CloudFront, etc.), or can be served by the
Node server itself via `express.static` for a simpler single-host setup (which is
what `server/app.js` already does as a fallback, serving `../client/dist` and
falling through to `index.html` for any client-side route — see the
`app.get('*', ...)` handler).

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE` | server | MongoDB connection string |
| `SESSION_SECRET` | server | Required in production; a dev fallback exists but warns loudly |
| `CLIENT_ORIGIN` | server | Exact origin allowed by CORS and Socket.IO's CORS config — must match where the client is actually hosted |
| `PORT` | server | Defaults to 3000; most PaaS hosts inject this |
| `NODE_ENV` | server | Gates secure-cookie / `sameSite=none` behavior |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | server | Must be registered in the Google Cloud Console; the redirect URI has to exactly match what's configured there |
| `EMAIL_USER` / `EMAIL_PASS` | server | Gmail SMTP credentials for OTP delivery (an app password, not the account password) |
| `VITE_API_ORIGIN` | client (build-time) | The server's public URL — baked into the client bundle at build time, since Vite env vars aren't runtime-configurable after the build |

`.env.example` files in both `server/` and `client/` document these without
committing real secrets — the actual `.env` files are git-ignored.

## Cookies and CORS in production

Two settings in `server/app.js` change based on `NODE_ENV`:

```js
cookie: {
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  ...
}
```

`sameSite: 'none'` is required once client and server are on different origins (the
whole point of the split) and the browser needs to send the session cookie along
with a cross-origin request — but `sameSite: 'none'` is only honored by browsers if
`secure: true` is also set, i.e. the server must be served over HTTPS in
production. Locally, both client and server are effectively same-site
(`localhost` on different ports), so `lax` + non-secure is fine and simpler for
local development over plain HTTP.

CORS itself is a strict single-origin allow-list (`origin: clientOrigin,
credentials: true`) rather than a wildcard, specifically because credentialed
requests (cookies) cannot use a wildcard origin per the CORS spec — this is a hard
requirement, not a style choice.

## What a "real" production deploy adds on top of this

This app runs correctly as described above, but a few things named elsewhere in
these docs are the honest gaps between "deployable" and "production-grade at
scale":

- **File storage** is local disk (see [Chapter 6](./06-file-uploads.md)) — doesn't
  survive an ephemeral filesystem redeploy and doesn't work with more than one
  server instance.
- **No horizontal scaling story for Socket.IO.** Running more than one server
  instance requires a Socket.IO adapter (e.g. the Redis adapter) so that
  `io.to(room).emit(...)` reaches sockets connected to a *different* instance than
  the one handling the event — out of the box, rooms are only known to the process
  that created them.
- **No rate limiting** on auth endpoints or message sends.
- **No CDN / caching layer** in front of the static client build if you choose the
  single-VM fallback instead of Vercel — Vercel provides this automatically; a
  plain VM serving `client/dist` directly would not.

These are exactly the kind of gaps worth being able to name proactively in a
system-design interview — see the [Interview Prep section](./09-interview-prep.md),
particularly [Chapter 11](./11-interview-system-design.md).
