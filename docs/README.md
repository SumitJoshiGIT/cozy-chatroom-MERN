# Lavender — Architecture & Implementation Guide

This is a chapter-by-chapter walkthrough of Lavender, a WhatsApp/Telegram-inspired
real-time chat application, written for someone trying to **learn the system** —
whether that's a new contributor, a student studying full-stack architecture, or
someone prepping for a system-design interview and wants a real (imperfect, evolving)
codebase to reason about instead of a textbook example.

Each chapter is self-contained but builds on the ones before it. If you're prepping
for an interview and short on time, read 01, 02, 04, 05, then the whole
[Interview Prep section](./09-interview-prep.md) (chapters 9–14) — that covers the
architecture, the two hardest subsystems (auth, real-time messaging), and a full
system-design-interview workup built specifically around this project.

## Chapters

1. [Product Overview](./01-overview.md) — what Lavender does, who it's for, the feature list as it stands today.
2. [High-Level Architecture](./02-architecture.md) — the two-service topology, tech stack, and how a request flows through the system.
3. [Data Model](./03-data-model.md) — the MongoDB/Mongoose schemas and the relationships between them.
4. [Authentication & Sessions](./04-authentication.md) — local signup/OTP, Google OAuth, and how Socket.IO shares an Express session.
5. [Real-Time Messaging](./05-realtime-messaging.md) — the Socket.IO event catalog, the optimistic-UI send pipeline, and the client-side cache.
6. [File & Image Uploads](./06-file-uploads.md) — how attachments and avatars move through the system, and the tradeoffs of that design.
7. [Frontend Architecture](./07-frontend-architecture.md) — the single-Context state model, routing, the UI component system, and theming.
8. [Deployment](./08-deployment.md) — how the two services are packaged and run independently, and what a production deploy needs.

### Interview Prep

9. [Overview](./09-interview-prep.md) — how to use this section, and a study plan by however much time you have.
10. [Core Q&A](./10-interview-qna.md) — "walk me through X" and "why did you do Y," grounded in the real implementation.
11. [System Design Deep Dive](./11-interview-system-design.md) — requirements, real capacity-estimation numbers, a component breakdown, and a from-scratch scaling path, using this codebase as the worked example.
12. [Tradeoffs & Alternatives](./12-interview-tradeoffs.md) — every consequential decision in the codebase, head-to-head against its real alternative.
13. [Mock Interview & Practice](./13-interview-practice.md) — a full worked mock-interview transcript plus practice prompts by category.
14. [An Ideal, Web-Scale Design](./14-interview-ideal-design.md) — a greenfield architecture for a WhatsApp/Discord-scale version of this app, and a mapping back to Lavender's real components.

15. [Feature Roadmap](./15-roadmap.md) — where the 2026 messaging-app market has moved, the resulting gap analysis, and a build order sequenced by implementation difficulty against this codebase.

## A note on accuracy

Chapters 1–13 aren't marketing copy for an idealized version of the app — they
describe the system as it actually exists in this repository right now, including
the corners that were cut and the things that are still on the roadmap (called out
explicitly in each chapter, and summarized in [Chapter 9](./09-interview-prep.md)).
Where a design decision looks unusual, the docs try to say *why*, and whether it's
a deliberate tradeoff or a known piece of debt. [Chapter 14](./14-interview-ideal-design.md)
and [Chapter 15](./15-roadmap.md) are the two forward-looking exceptions — both are
explicitly proposals (a greenfield thought exercise and a build roadmap,
respectively), not descriptions of what's built.
