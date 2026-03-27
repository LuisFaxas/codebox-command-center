# Feature Research

**Domain:** Developer notification dashboard + real-time multi-session monitoring for AI coding assistants
**Researched:** 2026-03-26
**Confidence:** HIGH (domain is well-understood; project has specific context from PROJECT.md)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Voice notification on Claude stop/done | Core value prop — the whole reason the system exists | LOW | Already partially implemented; needs reliability fix |
| Voice notification on Claude question/attention | Without this half the value is missing — "done" without "needs you" is incomplete | LOW | AskUserQuestion hook not firing reliably; must fix |
| Push notification when tab is in background | Tab is almost always in background during actual work; foreground-only is useless | MEDIUM | Web Push API requires VAPID key setup; service worker required |
| Visual toast notification in-app | Immediate visible confirmation without alt-tabbing | LOW | Standard UI pattern; libraries like Sonner handle this trivially |
| Project name in every notification | 5+ concurrent sessions are indistinguishable without project context | LOW | Folder basename strategy; already planned but unreliable |
| Real-time connection (SSE or WebSocket) | 1-second polling causes missed events and is wasteful | MEDIUM | SSE is simpler than WS for this unidirectional use case; verified by research |
| Works from remote machine (Tailscale) | User works from Lenovo and Mac; CodeBox-only defeats the purpose | LOW | Server already on Tailscale; client is just a browser URL |
| Status per session: working / done / needs attention | Without status differentiation, the dashboard is just a list of names | MEDIUM | Three states minimum; color-coded visual badges standard pattern |
| Voice configuration panel | Different events warrant different voices or rates; no config = no customization | MEDIUM | Voice selection, rate/pitch per event type (stop vs question) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-machine session aggregation | No other tool shows Claude Code sessions from CodeBox + Lenovo + Mac in one view | HIGH | Requires heartbeat/reporting protocol from each machine; the killer feature for this workflow |
| Live activity feed across all projects | Chronological event stream shows the full picture — not just current state | MEDIUM | Time-ordered list: "[project] finished", "[project] needs you at 14:32"; replaces context-switching |
| Per-event notification type config | "Done" gets a calm voice; "question" gets urgent voice + different sound | MEDIUM | Maps event type → voice profile; increases useful signal vs noise |
| Notification template editor | `{project} is done` → customizable copy per event type | LOW | UI for template strings; edge-tts already parameterized |
| Session duration / time tracking | "project-x has been working for 47 minutes" adds urgency awareness | MEDIUM | Track start time per session; display elapsed time |
| Snooze / mute per project | Working on project-x yourself; don't want notifications from it for 30 mins | MEDIUM | Per-project mute state stored server-side; toggle in UI |
| Notification history / log | Review what happened while you were away; persistent event store | MEDIUM | SQLite or JSON log; queryable by project/type/time |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email / Slack / SMS notifications | "What if I'm not at my desk?" | Defeats the single-user, always-near-browser premise; adds external service dependencies that violate the lean constraint | Browser push works when away from desk; phone has browser |
| Real-time code diff viewer in dashboard | Sounds useful — see what Claude changed | Massive complexity (file watching, diffing, rendering); outside the "notification" scope entirely | Open the IDE; dashboard is status awareness, not code review |
| Session control (pause/stop Claude) | "While I'm here, let me stop that session" | Claude Code's control plane is not exposed via HTTP; creating a control API is a separate project | Keep dashboard read-only; control happens in terminal |
| Multi-user / team support | "Could others see my sessions?" | Single-user system by design; auth complexity for marginal benefit | Out of scope per PROJECT.md |
| Mobile app (native) | Better push on mobile | Browser push works fine; native app is a separate project lifecycle | Progressive Web App (PWA) manifest if mobile push needed |
| Non-English / multi-voice languages | "Could you add Spanish voices?" | Scope creep; en-US neural voices cover the use case | Add other languages only if project evolves beyond personal use |
| AI-generated notification summaries | "Summarize what Claude did" | Requires calling another LLM API; latency, cost, dependency — overkill for a status ping | Hook payload already contains enough context (project + event type) |
| Persistent per-project settings in cloud | "Sync my voice settings across machines" | CodeBox is the hub; settings live on CodeBox; no cloud sync needed | Server-side config file is the single source of truth |

## Feature Dependencies

```
[Voice notification (stop)]
    └──requires──> [Reliable hook firing (Stop event)]
                       └──requires──> [Project name resolution]

[Voice notification (question)]
    └──requires──> [Reliable hook firing (AskUserQuestion)]
                       └──requires──> [Project name resolution]

[Push notification]
    └──requires──> [Service worker registration]
                       └──requires──> [VAPID key generation]
                       └──requires──> [User permission grant]

[Visual toast]
    └──requires──> [SSE/WebSocket real-time connection]

[Live dashboard (session status)]
    └──requires──> [SSE/WebSocket real-time connection]
    └──requires──> [Project name resolution]

[Multi-machine session aggregation]
    └──requires──> [Live dashboard (session status)]
    └──requires──> [Heartbeat/reporting protocol from remote machines]
                       └──requires──> [Remote hook scripts (Lenovo, Mac)]

[Activity feed]
    └──requires──> [SSE/WebSocket real-time connection]
    └──enhances──> [Notification history / log]

[Notification history / log]
    └──enhances──> [Activity feed]

[Per-event notification config]
    └──enhances──> [Voice notification (stop)]
    └──enhances──> [Voice notification (question)]

[Snooze / mute per project]
    └──requires──> [Live dashboard (session status)]
```

### Dependency Notes

- **Voice notifications require reliable hook firing:** The current system fires randomly. Until hook reliability is fixed, no other feature matters — everything downstream depends on events arriving correctly.
- **Project name resolution is a prerequisite for almost everything:** Sessions, toasts, push, and voice all need project identity. Fix this early.
- **SSE/WebSocket is the backbone:** Toast, live dashboard, and activity feed all require a real-time server push connection. Replace polling before building any UI features.
- **Push notifications require service worker + VAPID:** This is a one-time setup cost, not incremental. Must be done as a unit.
- **Multi-machine aggregation is independent of local features:** Remote machines push events to CodeBox; CodeBox aggregates. Local CodeBox notifications can work before multi-machine is complete.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to deliver the core value reliably.

- [ ] Reliable hook firing for Stop and AskUserQuestion events — without this nothing works
- [ ] Project name from folder basename — every notification must be identifiable
- [ ] Voice notification on stop + question, differentiated by type — the primary value
- [ ] SSE real-time connection replacing polling — eliminates timing bugs
- [ ] Visual toast in-app for active tab — immediate visual confirmation
- [ ] Browser push notification for background tab — must work when tab is hidden
- [ ] Session status display: working / done / needs attention per project — awareness dashboard

### Add After Validation (v1.x)

Features to add once core is working and reliable.

- [ ] Activity feed (chronological event log) — add once events are reliably captured
- [ ] Multi-machine session aggregation (Lenovo + Mac) — add once CodeBox local is solid
- [ ] Per-event voice configuration (rate, pitch per event type) — polish layer
- [ ] Notification template editor — low-hanging UX improvement
- [ ] Snooze / mute per project — quality-of-life once notification volume is understood

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Notification history / persistent log — useful but adds storage layer complexity
- [ ] Session duration tracking — nice context but not core to awareness
- [ ] PWA manifest for mobile push — defer unless mobile use case emerges

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Reliable hook firing (Stop + AskUserQuestion) | HIGH | MEDIUM | P1 |
| Project name resolution | HIGH | LOW | P1 |
| Voice notification (stop + question) | HIGH | LOW | P1 |
| SSE real-time connection | HIGH | MEDIUM | P1 |
| Visual toast in-app | HIGH | LOW | P1 |
| Browser push notification | HIGH | MEDIUM | P1 |
| Session status dashboard (working/done/needs attention) | HIGH | MEDIUM | P1 |
| Activity feed | MEDIUM | MEDIUM | P2 |
| Multi-machine session aggregation | HIGH | HIGH | P2 |
| Per-event voice configuration | MEDIUM | LOW | P2 |
| Notification template editor | MEDIUM | LOW | P2 |
| Snooze / mute per project | MEDIUM | MEDIUM | P2 |
| Notification history / log | LOW | MEDIUM | P3 |
| Session duration tracking | LOW | LOW | P3 |
| PWA manifest | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — system is broken or incomplete without it
- P2: Should have — meaningfully improves the tool after core works
- P3: Nice to have — future consideration once use is established

## Competitor Feature Analysis

No direct competitors exist for Claude Code-specific multi-session voice dashboards. The closest analogues are:

| Feature | alexop.dev hook setup | ksred.com session dashboard | Our Approach |
|---------|----------------------|----------------------------|--------------|
| Voice TTS | System macOS voice | None | Edge-TTS neural voices (higher quality) |
| Multi-machine | No | No (reads local ~/.claude only) | Yes — CodeBox as central hub, remote machines push events |
| Browser push | No | No | Yes — Web Push API |
| Session status | No | Yes (token usage, cost, active status) | Yes — working/done/needs attention with project name |
| Real-time transport | Not applicable | WebSocket (Go backend) | SSE (simpler, sufficient for unidirectional) |
| Notification config | No | No | Yes — per-event type voice/template |
| Dashboard UI | Terminal only | Separate app | Single polished SPA (same server) |

Key differentiator: the only system combining voice notifications + browser push + visual dashboard + multi-machine awareness in a single app with no external service dependencies.

## Sources

- [alexop.dev — Claude Code Notification Hooks](https://alexop.dev/posts/claude-code-notification-hooks/)
- [stacktoheap.com — Having Fun with Claude Code Hooks (voice notifications)](https://stacktoheap.com/blog/2025/08/03/having-fun-with-claude-code-hooks/)
- [ksred.com — Managing Multiple Claude Code Sessions: Building a Real-Time Dashboard](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/)
- [notilayer.com — SSE vs WebSockets for SaaS Notifications](https://www.notilayer.com/blog/sse-vs-websockets-notifications)
- [courier.com — How to Build a Notification Center for Web and Mobile Apps](https://www.courier.com/blog/how-to-build-a-notification-center-for-web-and-mobile-apps)
- [knock.app — Top 5 Real-Time Notification Services](https://knock.app/blog/the-top-real-time-notification-services-for-building-in-app-notifications)
- [patternfly.org — Notification Drawer Design Guidelines](https://www.patternfly.org/components/notification-drawer/design-guidelines/)
- [rxdb.info — WebSockets vs SSE vs Long-Polling comparison](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [code.claude.com — Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide)

---
*Feature research for: Developer voice notification system + coding dashboard (Claude Code)*
*Researched: 2026-03-26*
