# 10. Feature Roadmap: Closing the Gap With the Market

[Chapter 1](./01-overview.md) is an honest snapshot of what Lavender does *today*.
This chapter is the forward-looking counterpart: what the 2026 messaging-app market
actually expects, where Lavender currently stands against that bar, and a concrete
build order — **sequenced by implementation difficulty against this specific
codebase**, not abstract feature importance, so it doubles as a sprint plan.

## What the market expects in 2026

A few consistent signals came out of surveying where WhatsApp, Telegram, Discord,
Signal, and iMessage/Google Messages have converged this year:

- **Reactions, polls, and threading are no longer differentiators — they're table
  stakes.** Every mainstream messenger has emoji reactions and lightweight
  in-chat polls; their absence reads as "unfinished," not "minimal."
- **Ephemerality is expected, not niche.** Disappearing messages and 24-hour
  status/stories updates, once a Snapchat-only idea, are now default features
  across WhatsApp, Telegram, and Instagram-adjacent products.
- **AI is now a baseline chat feature, not an add-on.** Smart replies, thread
  summarization, and translation are shipping natively in iMessage (Apple
  Intelligence), Google Messages (Gemini), WhatsApp (Meta AI), and Teams
  (Copilot) — users increasingly expect *some* AI surface in any chat product.
- **Privacy controls are marketed as headline features**, not buried in settings:
  end-to-end encryption, chat-level locks, and granular disappearing-message
  timers all show up in first-run marketing for Telegram and WhatsApp alike.
- **Communities/channels (one-to-many broadcast) are pulling users away from
  pure group chat** — Telegram's channel model and WhatsApp's "Communities" both
  bet on this, because a flat group chat doesn't scale past a few hundred
  genuinely active members.
- **PWA-grade push notifications matter even for web-based chat apps** — a chat
  product with no way to notify a user whose tab isn't open loses to anything that
  can.

Sources: [Messaging Apps Trends 2026: What Users Expect](https://www.daylox.com/blog/messaging-apps-evolution-2026/), [13 Mobile App UI/UX Design Trends to Watch in 2026](https://www.designstudiouiux.com/blog/mobile-app-ui-ux-design-trends/), [Compare Discord vs. Telegram vs. WhatsApp in 2026](https://slashdot.org/software/comparison/Discord-vs-Telegram-vs-WhatsApp/), [Best Messaging Apps in 2026: WhatsApp vs Signal vs Telegram](https://pickedapps.com/articles/best-messaging-apps-2026), [Discover the Top AI Chat Application Features in 2026](https://www.intelligenthq.com/ai-chat-application/), [Top 10 AI Communication Tools for Businesses](https://emitrr.com/blog/ai-communication-tools/), [Top 10 Chat App Features to Build a Messaging App in 2026](https://primocys.com/blog/top-10-features-your-chat-app-users-will-love/), [Top 9 Upcoming WhatsApp Features 2026](https://admin365.blog/2026/06/07/top-9-upcoming-whatsapp-features-that-will-change-how-you-chat-in-2026/), [Ultimate Guide to PWA Push Notifications](https://appinstitute.com/ultimate-guide-to-pwa-push-notifications/), [Progressive Web Apps Best Practices in 2026](https://demskigroup.com/progressive-web-apps-best-practices-in-2026/)

## Gap analysis

Cross-referencing that list against [Chapter 1's feature table](./01-overview.md#feature-status):

| Market-expected feature | Lavender today |
|---|---|
| Reactions | ✅ implemented |
| Polls | ❌ not implemented |
| Message threading | ⚠️ flat reply-quote only, no true threads |
| Disappearing messages | ❌ not implemented |
| Stories / status updates | ❌ not implemented |
| AI smart replies / summarization | ❌ not implemented |
| Chat-level lock / PIN | ❌ not implemented |
| End-to-end encryption | ❌ not implemented (server can read message content) |
| Communities / broadcast channels | ❌ not implemented (groups only) |
| Push notifications (tab closed) | ❌ not implemented |
| Voice messages | ❌ not implemented |
| Voice / video calls | ❌ not implemented (dead WebRTC stub existed, since removed) |
| Message edit | ✅ implemented |
| Message forward | ✅ implemented |
| Message pinning | ✅ implemented |
| Typing indicators | ✅ implemented |
| Read receipts (per-recipient) | ⚠️ single sent/delivered tick only |
| Block / report | ✅ implemented |
| Delete group (owner) | ✅ implemented |
| Custom theming | ✅ implemented (5 accent presets) |
| Reduced motion | ✅ implemented |
| Dark mode | ✅ implemented |

That's a wide gap, which is normal for a project at this stage — the useful thing
isn't the gap itself, it's sequencing the close.

## How difficulty was scored

For each candidate feature, difficulty is judged against **this specific
codebase** (see [Chapter 2](./02-architecture.md) for the full stack), not the
feature in the abstract:

- Does it need a new schema field, or a new collection?
- Does it need a new Socket.IO event, or can it piggyback on an existing one?
- Does it need new client state, or does it fit the existing `AppScreen` context?
- Does it need infrastructure the app doesn't have at all yet (a job
  scheduler, WebRTC signaling, push subscriptions, encryption key management)?

A feature that only touches the last bullet (genuinely new infrastructure) is
categorically harder than one that's "just" a new field and a new event, even if
the two look similarly complex on a spec sheet.

Ten features that used to head this list have since shipped: **message edit,
message forward, starred/saved messages, chat wallpaper, dark mode, typing
indicators, block/report user, delete chat/group, pin messages, and emoji
reactions.** See the [feature table in Chapter 1](./01-overview.md#feature-status)
for what they do and the chapters they're documented in
([3](./03-data-model.md), [5](./05-realtime-messaging.md#event-catalog),
[7](./07-frontend-architecture.md#theming)). The tiers below have been
renumbered accordingly.

---

## Tier 1 — Medium features (real new subsystems, but bounded ones)

These need either new infrastructure the app doesn't have *any* of yet, or enough
cross-cutting UI that they're a multi-day project even though no single piece is
individually hard.

1. **Voice messages.** The upload pipeline in
    [Chapter 6](./06-file-uploads.md) already handles arbitrary base64 payloads
    end-to-end (validation, disk write, metadata on the message) — voice notes
    are "attachments" with a `.webm`/`.ogg` MIME type and a waveform UI instead
    of a thumbnail. The new work is entirely client-side: `MediaRecorder` API
    integration, a recording UI, and playback controls.
2. **Stickers / GIF picker.** Static sticker packs are a moderate content-
    pipeline problem (asset storage, pack browsing UI); animated GIFs are easier
    if outsourced to a third-party search API (Tenor/Giphy) rather than hosted —
    the attachment-rendering path already built for images handles the display
    side either way.
3. **True message threads.** Distinct from the reply-quote feature already
    shipped ([Chapter 5](./05-realtime-messaging.md)) — this means a collapsible
    "N replies" affordance that opens a filtered sub-view of a chat, which is a
    real new UI surface even though the underlying `reply_to` relationship
    already exists in the schema.
4. **Communities / broadcast channels.** A new `Chats.type` value
    (`"channel"`) where only admins can post and members can only read —
    mechanically an extension of the existing owner/admin permission model in
    [Chapter 3](./03-data-model.md), but it touches the composer, the chat-info
    panel, and the member-list UI all at once.
5. **Push notifications for closed tabs.** Needs infrastructure the app has
    none of: a service worker, a web app manifest, browser Push API
    subscriptions stored per-device, and a server-side push-sending step
    triggered from the existing `sendMessage` handler. Bounded in scope, but
    every piece is new.
6. **Chat-level lock (PIN/biometric).** Mostly a client-side gate (a lock
    screen over a specific chat's view, backed by the WebAuthn API for
    biometrics or a simple PIN in `localStorage`), with an optional
    server-side "hidden chat" flag if the lock should also hide the chat from
    the list rather than just gating access to it.

## Tier 2 — Major undertakings (new architecture, not new features)

These aren't "harder versions" of the features above — they change assumptions
made elsewhere in the system, which is why they're last regardless of how
compelling they are competitively.

7. **Voice / video calling.** The codebase's only prior attempt at this was an
    empty `webRTC.js` stub, removed as dead code during the earlier cleanup
    pass ([Chapter 1](./01-overview.md)). This needs a full WebRTC signaling
    layer (offer/answer/ICE-candidate exchange over Socket.IO, which the app
    *does* already have the transport for), plus a STUN/TURN server for NAT
    traversal in production, plus real call UI (ringing state, in-call
    controls). The signaling half reuses existing infrastructure; the TURN
    server and call UI do not.
8. **Stories / status updates.** A new content type with its own lifecycle
    (auto-expiring after 24 hours — the first *time-based* deletion job this
    app would need, versus everything else being event-driven), a new feed UI
    completely unlike the chat-list/message-list views that exist today, and
    per-viewer tracking (who's seen your story) that has no analog in the
    current data model.
9. **AI features (smart replies, summarization, translation).** Not hard to
    *wire up* (an LLM API call from a new socket event), but hard to do well:
    it introduces an external API dependency with real latency and cost, needs
    a UX for surfacing suggestions without being intrusive, and needs careful
    scoping of what content gets sent to a third-party API given this is
    people's private messages — a product and privacy decision, not just an
    engineering one.
10. **End-to-end encryption.** The biggest architectural undertaking on this
    list, because it inverts a standing assumption the whole backend currently
    relies on: the server can read message content (to sanitize it with `xss`,
    to search it, to store it queryably). Real E2E encryption means the server
    only ever stores ciphertext, which breaks server-side search
    ([Chapter 5](./05-realtime-messaging.md#event-catalog)'s `search` event
    over message content) and requires a client-side key-exchange and
    key-storage system from scratch. Every other feature on this list is
    additive to the current architecture; this one requires redesigning a load-
    bearing piece of it.
11. **Horizontal scaling (Redis adapter, object storage for uploads).** Not a
    user-facing feature at all, but it's the prerequisite for several of the
    above being viable past a single server instance — already flagged as a
    concrete gap in [Chapter 8](./08-deployment.md#what-a-real-production-deploy-adds-on-top-of-this)
    and worth doing before, not after, this app has enough concurrent users for
    push notifications, voice calls, or AI features to generate real load.

## Suggested order

Putting the tiers together into one sequence, front-loaded by both difficulty
*and* how much of the gap-analysis table each closes per unit of effort:

```
1. Voice messages           5. Push notifications      9. AI features
2. Stickers / GIFs          6. Chat lock               10. End-to-end encryption
3. True threads             7. Voice/video calls        11. Horizontal scaling
4. Communities/channels     8. Stories/status
```

Tier 1 is where Lavender would start to feel genuinely competitive with
WhatsApp/Telegram rather than just "a chat app." Tier 2 is where it stops
being a portfolio-scale project and starts requiring the kind of
infrastructure investment a funded product team would make.
