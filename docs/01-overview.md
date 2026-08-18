# 1. Product Overview

## What it is

Lavender is a real-time, one-on-one and group messaging app — the same product
category as WhatsApp or Telegram. A user signs up with an email/password (verified
by an emailed OTP) or with Google OAuth, and can then:

- start a direct conversation with anyone they've previously messaged (their "contacts"),
- create a named group with a photo and multiple members,
- send text messages, reply to a specific message (with a quoted preview), and
  send image attachments with an inline thumbnail preview,
- see messages arrive live, with delivery/read ticks (`✔` / `✔✔`),
- edit or forward a message they've sent, and star messages to find them later,
- react to a message with an emoji, pin an important message to the top of a
  chat, and see a live "typing…" indicator for the other participant,
- edit their own profile (name, username, bio, avatar),
- manage group membership as an owner/admin (promote, demote, remove members),
  and delete a group entirely as its owner,
- block or report another user, which also stops that user's messages from
  being delivered to them,
- pick an accent color theme, toggle dark mode or reduced motion, and set a
  per-chat wallpaper, from a Settings panel.

## Who it's for

The product itself doesn't target a specific vertical — it's a general-purpose chat
app. Architecturally, it's a good study subject *because* it has to solve the same
handful of hard problems every chat app solves: real-time delivery, optimistic UI,
session-aware WebSockets, and a client that has to work with unreliable connectivity.

## Feature status

Not everything a "final" chat product would have is implemented yet. This table is
the honest state as of this writing — useful both as a feature list and as a map of
what's a good next project if you're extending this codebase:

| Feature | Status |
|---|---|
| Local signup + email OTP verification | ✅ implemented |
| Google OAuth login | ✅ implemented |
| 1:1 direct messages | ✅ implemented |
| Group chats (create, name, photo, members) | ✅ implemented |
| Group roles: owner / admin / member | ✅ implemented |
| Promote / demote / remove members | ✅ implemented |
| Reply-to (with quoted preview) | ✅ implemented |
| Image attachments with thumbnail preview | ✅ implemented |
| Message delete | ✅ implemented |
| Leave chat / delete private chat | ✅ implemented |
| Live profile editing (name, username, bio, avatar) | ✅ implemented |
| Media gallery per chat | ✅ implemented |
| Search (users / messages / chats) | ✅ implemented |
| Accent theming + reduced-motion setting | ✅ implemented |
| Dark mode | ✅ implemented |
| Message edit | ✅ implemented |
| Message forward | ✅ implemented |
| Starred / saved messages | ✅ implemented |
| Per-chat wallpaper | ✅ implemented |
| Message pinning | ✅ implemented |
| Emoji reactions | ✅ implemented |
| Typing indicators | ✅ implemented |
| Block / report user | ✅ implemented |
| Delete group (owner, for everyone) | ✅ implemented |
| Read receipts beyond a static "sent" tick | 🚧 not yet implemented |
| Push notifications | 🚧 not yet implemented |

The next chapter explains *how* the implemented pieces fit together before we go
system-by-system.
