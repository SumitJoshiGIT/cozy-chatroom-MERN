# 9. Interview Prep

This is a four-chapter section written for one specific goal: preparing you to
talk about *this project* in a system-design interview, or in a "walk me through
something you built" conversation. It isn't generic chat-app theory — every claim
in these four chapters is grounded in what Lavender's code actually does, with a
file/line pointer back to the earlier chapters wherever it matters, because "I
built this, and here's specifically what I'd change" is a stronger answer than
reciting facts about WebSockets in the abstract.

The four chapters cover different interview *shapes*, because "system design
interview" isn't one format:

| Chapter | Interview shape it prepares you for |
|---|---|
| [10. Core Q&A](./10-interview-qna.md) | "Walk me through X" and "why did you do Y" — the questions about how the system works today. |
| [11. System Design Deep Dive](./11-interview-system-design.md) | "Design a chat app" from a blank whiteboard — requirements, capacity estimation, component breakdown, and a from-scratch scaling path — using Lavender's real numbers and real (including unfixed) gaps as the worked example. |
| [12. Tradeoffs & Alternatives](./12-interview-tradeoffs.md) | "Why not X instead?" — head-to-head comparisons for every consequential decision in the codebase, framed as decision tables you can defend or attack. |
| [13. Mock Interview & Practice](./13-interview-practice.md) | A full worked mock-interview transcript, plus unanswered practice prompts by category (design, data modeling, scaling, security, behavioral) for you to rehearse against before the real thing. |

## How to use this section

**If you have an hour:** read Chapter 10 in full — it's the highest density of
"question you'll actually get asked" per minute, because it's phrased as direct
Q&A rather than exposition.

**If you have an afternoon:** add Chapter 11. It's the one that trains the skill
interviewers are actually scoring in a system-design round — not "do you know what
a message queue is," but "can you take a system this size and reason about where
it breaks first, with real numbers." The capacity-estimation and gap-analysis
sections there use figures pulled directly from this codebase's schema and code,
not textbook placeholders.

**The night before:** skim Chapter 12 for the tradeoff tables (they're built to
be re-skimmed fast — decision, reasoning, "I'd switch if…") and run through
Chapter 13's mock transcript once, out loud if you can. Rehearsing the *shape* of
a full answer once is worth more the night before than reading new material.

## A note on honesty

The instinct in interview prep is to over-polish — to make the system sound more
finished than it is. These chapters do the opposite on purpose. Lavender has real,
specific, sometimes uncomfortable gaps (an authorization check that's missing on
one query, a chat-history fetch with no explicit sort, no index backing the
hottest read path in the system — see [Chapter 11](./11-interview-system-design.md#a-concrete-design-review-what-i-d-flag-in-this-codebase-today)).
Naming those precisely, unprompted, and explaining exactly how you'd fix them is a
far stronger interview signal than claiming the system has no weaknesses — an
interviewer who has shipped production systems has never seen one that didn't, and
knows a candidate who claims otherwise either hasn't looked closely or isn't being
straight with them.
