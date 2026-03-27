# Stack Research

**Domain:** Real-time developer dashboard with push notifications and voice TTS — Node.js server
**Researched:** 2026-03-26
**Confidence:** HIGH (core decisions) / MEDIUM (library versions)

## Context: What Already Exists

The server is a vanilla Node.js HTTP server (`server.js`, ~420 lines) with no build system,
no dependencies (only stdlib), and embedded HTML served as a string. Node.js v24.12.0 is
installed. Edge-tts handles voice synthesis. There is no `package.json`.

The goal is to add: SSE push, browser push notifications (Web Push API), visual toast
notifications, a live dashboard, and a polished SPA UI — without changing the fundamental
architecture (Node.js, PM2, edge-tts stay as-is).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js (existing) | v24 LTS | HTTP server, SSE, Web Push sender | Already installed. v24 includes native fetch and crypto; no version change needed. |
| SSE (native, no library) | N/A | Replace 1s polling with push | Server-sent events require zero dependencies — set `Content-Type: text/event-stream` and stream. Browser `EventSource` is built-in. Simpler than WebSocket for one-directional server-to-client push. |
| Web Push API + Service Worker | Browser built-in | Background push notifications when tab is closed | Industry standard. Works on Chrome, Edge, and macOS Safari. Requires VAPID key pair (one-time setup). |
| web-push | 3.6.7 | Send Web Push payloads from Node.js server | The canonical Node.js library for the Web Push protocol. Used by tens of millions of sites. Ships its own VAPID key generator. No alternatives with comparable adoption. |
| Vite | 8.x (latest) | Build/bundle the frontend SPA | Best-in-class DX for vanilla TypeScript SPAs. `vanilla-ts` template works out of box. Enables TypeScript, hot reload in dev, and a minified production bundle. Node.js v24 satisfies its v20.19+ requirement. |
| TypeScript | 5.x (via Vite) | Type-safe frontend code | Caught by Vite automatically. Eliminates the string-concatenated HTML anti-pattern in current code. No separate config needed for Vite's vanilla-ts template. |
| Tailwind CSS v4 | 4.x | Utility-first styling | Install as a Vite plugin (`@tailwindcss/vite`). Zero runtime, purged output. v4 targets modern browsers (Chrome 111+, Safari 16.4+, Firefox 128+) which matches the constraint (Chrome/Edge on developer machines). Avoids writing any custom CSS. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Notyf | 3.10.0 | In-app toast notifications | 3KB gzipped, zero dependencies, framework-free. Use for visual "done" and "question" toasts inside the SPA tab. Simpler than building custom toast from scratch. |
| @types/web-push | latest | TypeScript types for web-push | Only needed in server code if migrating server to TypeScript. Skip if keeping server.js as plain JS. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server | HMR during frontend development | `vite` serves the SPA at localhost with hot reload. Point hooks at the existing server.js backend (port 3099). |
| pnpm | Package management | Matches workspace convention. Use for the new frontend package only. Server stays dependency-free. |
| web-push CLI (bundled) | Generate VAPID keys once | `npx web-push generate-vapid-keys` — run once, store keys in config.json. |

---

## Architecture Decision: Two Packages, One Server

The existing `server.js` has no package.json and no build step. The right approach is:

1. Keep `server.js` as-is (plain Node.js, zero deps) — add SSE and Web Push to it directly
2. Add a `frontend/` Vite package for the new SPA (`pnpm create vite frontend --template vanilla-ts`)
3. Vite builds the SPA to `frontend/dist/` — server.js serves it as static files

This avoids rewriting the working backend and gives a proper build pipeline for the frontend.

---

## Installation

```bash
# Create frontend package
cd /home/faxas/workspaces/projects/personal/voice_notifications
pnpm create vite@latest frontend --template vanilla-ts
cd frontend
pnpm install

# Tailwind CSS v4 Vite plugin
pnpm add -D @tailwindcss/vite

# In-app toasts (frontend only)
pnpm add notyf

# Back in project root — add web-push to server
# First create package.json for the server
cd ..
pnpm init
pnpm add web-push
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SSE (native) | WebSocket (ws library) | Only if bidirectional real-time communication is needed (e.g. user can type commands back to server). This project is server-to-client only. |
| SSE (native) | Long-polling (current) | Never — polling wastes 1 request/second per tab and introduces 0-1s jitter. SSE is strictly better for this use case. |
| Vite + vanilla-ts | React/Vue/Svelte | If the team needs component reactivity at scale. For a single-user developer tool with <10 UI components, a framework adds 40-100KB and complexity for no benefit. |
| Vite + vanilla-ts | Plain HTML string in server.js (current) | Only acceptable for prototypes. Impossible to maintain, no type safety, no HMR. |
| Tailwind CSS v4 (Vite plugin) | Tailwind CDN Play | CDN is explicitly not production-safe per Tailwind's own docs. Ships unprocessed CSS; no purging. |
| Tailwind CSS v4 (Vite plugin) | Plain CSS | Acceptable, but Tailwind v4 via Vite is zero-runtime and produces smaller output than handwritten CSS for a full dashboard. |
| Notyf | Custom toast component | Notyf is 3KB and production-tested. Building custom toast means reinventing animations, positioning, and a11y. |
| Notyf | react-toastify | react-toastify requires React. This project has no framework. |
| web-push (Node.js) | Firebase Cloud Messaging (FCM) | FCM requires a Google account and API key. web-push is self-hosted, free, and uses the open W3C Web Push standard. |
| web-push (Node.js) | Pusher / Ably | Third-party SaaS with cost and privacy implications. No reason to use for a single-user local tool. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| WebSocket (ws library) | Overkill for server-to-client-only push. Adds a library dependency and connection upgrade logic. SSE is built into HTTP and the browser. | Native SSE (`text/event-stream`) |
| Socket.io | Abstracts both WebSocket and polling — too heavy (100KB+) for a problem that SSE solves in 20 lines of native Node.js. | Native SSE |
| React / Vue / Svelte | A full frontend framework for a single-user developer tool with ~5 components adds 40-100KB bundle weight and significant boilerplate. | Vite vanilla-ts |
| Next.js / Nuxt | Server-side rendering framework for a tool that is already a Node.js server. Creates two servers and doubles complexity. | Vite vanilla-ts SPA served from existing server.js |
| Tailwind CDN Play (`@tailwindcss/browser`) | Explicitly documented as "not for production" by Tailwind team. Ships all classes unoptimized. | `@tailwindcss/vite` plugin with build step |
| Pusher / Ably / OneSignal | Paid third-party push services. This system is intentionally self-hosted with no external dependencies. | web-push + VAPID (self-hosted) |
| Long-polling `/check` endpoint (current) | 1 request/second per tab. Non-deterministic timing (up to 1s delay). Wasteful on both server and browser. | SSE EventSource |

---

## Stack Patterns by Variant

**If keeping server.js as a single file (current approach):**
- Add SSE client list to server.js with a `Map` of `res` objects keyed by connection ID
- Add `/events` SSE endpoint, remove `/check` endpoint
- Add `/subscribe` endpoint to store Web Push subscriptions (write to `data/subscriptions.json`)
- Add `/vapid-public-key` endpoint that returns the public key to the frontend
- Serve `frontend/dist/` as static files from the catch-all route

**If splitting into server + frontend (recommended for maintainability):**
- `frontend/` — Vite vanilla-ts package
- `server.js` — stays as plain Node.js, gains `web-push` dependency only
- Build step: `cd frontend && pnpm build` before deploying

**If Safari push is required (iOS):**
- Safari iOS requires the web app to be installed as a Home Screen app
- macOS Safari works with standard VAPID Web Push (Safari 16+ supports it)
- For the current use case (developer machines = Chrome/Edge on Windows + macOS), standard VAPID covers all clients

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| web-push@3.6.7 | Node.js v10+ | Works on Node.js v24. No issues. Last published ~2 years ago but the Web Push protocol is stable. |
| Vite@8.x | Node.js v20.19+, v22.12+ | Node.js v24.12.0 satisfies this. |
| @tailwindcss/vite@4.x | Vite 8.x | Tailwind v4 ships its own Vite plugin. Do not use `autoprefixer` or the old `tailwindcss` PostCSS plugin — they are for v3. |
| Notyf@3.10.0 | Any modern browser | ES module and IIFE builds included. Works with Vite's module bundler. |
| TypeScript@5.x | Vite vanilla-ts template | Bundled by Vite. No separate `ts-node` or esbuild install needed. |

---

## Key Risk: web-push Maintenance Status

**Confidence: MEDIUM.** The `web-push` npm package (v3.6.7) was last published approximately 2 years ago. The Web Push protocol (RFC 8030) is stable and unlikely to change. Browser push endpoints (Google FCM for Chrome, Mozilla for Firefox, Apple for Safari) do update their VAPID requirements over time. The library has 3.5k stars and 317 forks on GitHub.

**Mitigation:** This is a single-user developer tool, not a high-stakes production system. If web-push breaks due to endpoint changes, the fallback is to drop browser push notifications and keep only SSE + in-app toasts (which cover the primary use case of "tab is open"). The in-app experience via SSE is the primary notification path; browser push is a secondary enhancement.

---

## Sources

- [SSE vs WebSocket — RxDB comprehensive comparison](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html) — HIGH confidence, verified multiple sources agree
- [web-push GitHub — web-push-libs/web-push](https://github.com/web-push-libs/web-push) — MEDIUM confidence (version from npm search result, not direct read)
- [Vite Getting Started](https://vite.dev/guide/) — HIGH confidence, directly fetched; v8.0.2, requires Node 20.19+
- [Tailwind CSS v4 Play CDN docs](https://tailwindcss.com/docs/installation/play-cdn) — HIGH confidence, directly fetched; confirms CDN is dev-only
- [Notyf npm — carlosroso1222/notyf](https://github.com/caroso1222/notyf) — MEDIUM confidence; v3.10.0, 2.99KB gzipped
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — HIGH confidence; browser support confirmed
- [web-push npm search result](https://www.npmjs.com/package/web-push) — MEDIUM confidence; v3.6.7 confirmed via search snippet

---
*Stack research for: Voice Notifications — real-time dashboard + push notification milestone*
*Researched: 2026-03-26*
