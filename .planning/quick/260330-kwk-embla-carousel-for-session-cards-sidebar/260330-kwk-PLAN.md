---
type: quick
description: Embla carousel for session cards + sidebar redesign with icon navigation
autonomous: true
files_modified:
  - package.json
  - public/vendor/embla-carousel.esm.js
  - public/index.html
  - public/modules/sessions.js
  - public/modules/sidebar.js
  - public/modules/app.js
  - public/css/layout.css
  - public/css/components.css
---

<objective>
Replace the CSS Grid session card layout with an Embla Carousel horizontal strip, redesign the sidebar with multi-section icon navigation (Sessions/Voice/Settings), fix collapsed sidebar to show icons, and replace the sun toggle icon with a proper sidebar panel icon.

Purpose: Session cards in a horizontal carousel give the conversation panel consistent vertical space. The sidebar becomes a real navigation hub instead of a single-purpose voice config panel.
Output: Working carousel with dot indicators, icon-based sidebar with 3 sections, proper collapsed state.
</objective>

<context>
@public/index.html
@public/modules/sessions.js
@public/modules/sidebar.js
@public/modules/app.js
@public/css/layout.css
@public/css/components.css
@public/css/tokens.css

<interfaces>
From public/modules/state.js (used by sessions.js and sidebar.js):
- subscribe(event, callback) — event bus
- setSelectedSession(id) — select a session
- state — global state object with .config, .selectedSessionId, .sessions
- getSession(id) — get session by ID
- setConfig(config) — update config state
- updateSession(session) — upsert session data

From public/modules/sessions.js:
- initSessions() — called by app.js on DOMContentLoaded

From public/modules/sidebar.js:
- initSidebar() — called by app.js on DOMContentLoaded

From public/modules/utils.js:
- escapeHtml(str), formatRelativeTime(ts), statusLabel(status)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Embla and create session carousel</name>
  <files>
    package.json
    public/vendor/embla-carousel.esm.js
    public/index.html
    public/modules/sessions.js
    public/css/layout.css
    public/css/components.css
  </files>
  <action>
1. Install embla-carousel: `pnpm add embla-carousel` (vanilla JS, v8.x)

2. Copy the ESM bundle to public/vendor/:
   `cp node_modules/embla-carousel/embla-carousel.esm.js public/vendor/embla-carousel.esm.js`

3. Update `public/index.html` import map — add entry:
   `"embla-carousel": "./vendor/embla-carousel.esm.js"`
   Also replace the sidebar toggle SVG (sun icon at line 48-51) with a panel/sidebar icon:
   ```
   <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
     <rect x="2" y="3" width="16" height="14" rx="2"/>
     <line x1="8" y1="3" x2="8" y2="17"/>
   </svg>
   ```

4. Rewrite `public/modules/sessions.js`:
   - Import EmblaCarousel from 'embla-carousel'
   - In `initSessions()`, restructure the `#session-grid` container:
     - Create `.embla` wrapper div inside `#session-grid`
     - Create `.embla__container` flex div inside that
     - Each session card becomes an `.embla__slide` child
     - Add `.embla__dots` container after the embla wrapper for dot indicators
   - Initialize Embla with options: `{ align: 'start', containScroll: 'trimSnaps', dragFree: false }`
   - After each render cycle (session:update, session:remove), call `embla.reInit()` to pick up DOM changes
   - Create dot navigation: on `init` and `reInit` events, regenerate dot buttons matching slide count; on `select` event, highlight active dot; clicking dot calls `embla.scrollTo(index)`
   - `renderCard()` — instead of appending to grid directly, append `.embla__slide` divs to `.embla__container`. Each slide wraps a session card. Keep all existing card HTML (header, machine, preview, meta, reply btn).
   - `removeCard()` — remove the `.embla__slide` wrapper, then `embla.reInit()`
   - Export `initSessions` as before

5. Update `public/css/layout.css` `.session-overview` section:
   - Remove the CSS Grid properties (grid-template-columns, auto-fill, etc.)
   - Remove max-height and overflow-y (carousel has fixed height)
   - Set fixed height: `height: 160px` (enough for one row of cards)
   - Keep grid-column: 1 and grid-row: 2, padding

6. Add Embla carousel styles to `public/css/components.css`:
   ```css
   /* === EMBLA CAROUSEL === */
   .embla { overflow: hidden; width: 100%; }
   .embla__container { display: flex; gap: var(--space-lg); }
   .embla__slide { flex: 0 0 calc(25% - 12px); min-width: 280px; }
   .embla__dots { display: flex; justify-content: center; gap: var(--space-sm); margin-top: var(--space-sm); }
   .embla__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-standard); border: none; cursor: pointer; padding: 0; transition: background 0.2s ease; }
   .embla__dot.active { background: var(--accent-primary); }

   @media (max-width: 1200px) { .embla__slide { flex: 0 0 calc(50% - 8px); } }
   @media (max-width: 768px) { .embla__slide { flex: 0 0 100%; } }
   ```

7. Update `.empty-state` in components.css — make it less prominent:
   - Change h3 font-size from 18px to 14px
   - Change h3 color from `var(--text-secondary)` to `var(--text-muted)`
   - Change p font-size from 14px to 13px
   - Remove `justify-content: center` (use `padding-top: var(--space-3xl)` instead)
  </action>
  <verify>
    <automated>cd /home/faxas/workspaces/projects/personal/voice_notifications && node -e "import('embla-carousel').then(m => console.log('embla OK:', typeof m.default))" && test -f public/vendor/embla-carousel.esm.js && echo "vendor file OK"</automated>
  </verify>
  <done>
    - Embla installed and vendor ESM file present
    - Session cards render in horizontal carousel with drag/swipe
    - Dot indicators below carousel, active dot tracks current slide
    - Desktop shows 3-4 cards, tablet 2, mobile 1
    - Carousel has fixed height so conversation panel is stable
    - Sun icon replaced with sidebar panel icon
    - Empty state is subtle (smaller text, muted color)
    - All existing card functionality works (click to select, attention pulse, reply button)
  </done>
</task>

<task type="auto">
  <name>Task 2: Redesign sidebar with multi-section icon navigation</name>
  <files>
    public/modules/sidebar.js
    public/modules/app.js
    public/css/layout.css
    public/css/components.css
    public/index.html
  </files>
  <action>
1. Update `public/index.html` sidebar markup. Replace the current `<aside>` block:
   ```html
   <aside class="sidebar glass-panel" id="sidebar">
     <nav class="sidebar-nav">
       <button class="sidebar-nav-btn active" data-section="sessions" aria-label="Sessions" title="Sessions">
         <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <rect x="2" y="3" width="7" height="6" rx="1"/>
           <rect x="11" y="3" width="7" height="6" rx="1"/>
           <rect x="2" y="11" width="7" height="6" rx="1"/>
           <rect x="11" y="11" width="7" height="6" rx="1"/>
         </svg>
         <span class="sidebar-nav-label">Sessions</span>
       </button>
       <button class="sidebar-nav-btn" data-section="voice" aria-label="Voice" title="Voice">
         <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <rect x="7" y="2" width="6" height="10" rx="3"/>
           <path d="M4 10a6 6 0 0012 0"/>
           <line x1="10" y1="16" x2="10" y2="19"/>
           <line x1="7" y1="19" x2="13" y2="19"/>
         </svg>
         <span class="sidebar-nav-label">Voice</span>
       </button>
       <button class="sidebar-nav-btn" data-section="settings" aria-label="Settings" title="Settings">
         <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <circle cx="10" cy="10" r="3"/>
           <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4"/>
         </svg>
         <span class="sidebar-nav-label">Settings</span>
       </button>
     </nav>
     <div class="sidebar-content">
       <!-- Section content rendered by sidebar.js -->
     </div>
   </aside>
   ```

2. Rewrite `public/modules/sidebar.js`:
   - Keep all existing voice settings logic (VOICES array, loadTab, saveConfig, generateSamples, etc.)
   - Add section management: track `activeSection` ('sessions' | 'voice' | 'settings')
   - `initSidebar()`:
     - Bind nav button clicks → switch active section
     - Default to 'sessions' section on load
     - Render initial section content
     - Subscribe to 'session:update' and 'session:remove' to re-render sessions section stats
   - Section renderers:
     - `renderSessionsSection()`: Show stats — total sessions count, attention count (from state.sessions). Simple stat cards with numbers.
     - `renderVoiceSection()`: Existing voice settings HTML (buildSidebarHTML content). Keep all existing voice functionality intact.
     - `renderSettingsSection()`: Placeholder with "Settings coming soon" text.
   - On section switch: update nav button `.active` class, render new section content into `.sidebar-content`
   - Handle collapsed state: When sidebar has `.collapsed` class, hide `.sidebar-content` and `.sidebar-nav-label` but keep `.sidebar-nav-btn` icons visible. Clicking a nav button when collapsed should expand the sidebar AND switch to that section.

3. Update `public/modules/app.js` sidebar toggle logic:
   - Keep the toggle button click handler
   - When collapsing: just add `.collapsed` class (nav icons stay visible)
   - When expanding via toggle button: remove `.collapsed`, show last active section
   - When expanding via nav button click (handled in sidebar.js): remove `.collapsed` class from sidebar element

4. Update `public/css/layout.css` sidebar section:
   - `.sidebar` — keep grid-column: 2, grid-row: 2 / -1
   - Add `display: flex; flex-direction: column;` to sidebar
   - `.sidebar.collapsed` — width: var(--sidebar-collapsed) (48px), padding: var(--space-sm)
   - Remove the existing `.sidebar.collapsed .sidebar-content` opacity/pointer-events rule

5. Add sidebar nav styles to `public/css/components.css`:
   ```css
   /* === SIDEBAR NAVIGATION === */
   .sidebar-nav {
     display: flex;
     flex-direction: column;
     gap: var(--space-xs);
     padding-bottom: var(--space-lg);
     border-bottom: 1px solid var(--border-thin);
     margin-bottom: var(--space-lg);
     flex-shrink: 0;
   }
   .sidebar-nav-btn {
     display: flex;
     align-items: center;
     gap: var(--space-sm);
     background: none;
     border: none;
     color: var(--text-muted);
     padding: var(--space-sm) var(--space-sm);
     border-radius: var(--radius-sm);
     cursor: pointer;
     font-size: 14px;
     transition: color 0.2s ease, background 0.2s ease;
     white-space: nowrap;
   }
   .sidebar-nav-btn:hover { color: var(--text-secondary); background: var(--bg-surface); }
   .sidebar-nav-btn.active { color: var(--accent-primary); background: rgba(102, 126, 234, 0.1); }
   .sidebar-nav-label { font-weight: 600; }

   /* Collapsed sidebar: hide labels and content, keep icons */
   .sidebar.collapsed .sidebar-nav-label { display: none; }
   .sidebar.collapsed .sidebar-content { display: none; }
   .sidebar.collapsed .sidebar-nav { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
   .sidebar.collapsed .sidebar-nav-btn { justify-content: center; padding: var(--space-sm); }
   ```

6. Add sidebar stat card styles for sessions section:
   ```css
   .sidebar-stats { display: flex; flex-direction: column; gap: var(--space-sm); }
   .sidebar-stat { padding: var(--space-lg); border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--border-thin); }
   .sidebar-stat-value { font-size: 24px; font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
   .sidebar-stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
   ```
  </action>
  <verify>
    <automated>cd /home/faxas/workspaces/projects/personal/voice_notifications && node -e "
      import('./public/modules/sidebar.js').catch(e => {
        // Expected to fail outside browser, just check syntax
        if (e.code === 'ERR_MODULE_NOT_FOUND') console.log('Module syntax OK (expected import error in Node)');
        else throw e;
      });
    " && echo "sidebar.js syntax OK"</automated>
  </verify>
  <done>
    - Sidebar shows 3 icon nav buttons (Sessions, Voice, Settings) in both expanded and collapsed states
    - Collapsed sidebar (48px) shows only icons, not blank strip
    - Clicking icon when collapsed expands sidebar to that section
    - Sessions section shows live session count and attention count
    - Voice section contains all existing voice settings (voices, template, rate, pitch, generate)
    - Settings section shows placeholder
    - Active section highlighted with accent color
    - Smooth 200-300ms transitions between states
    - All existing voice config functionality preserved (save, generate samples, tab switching)
    - Playwright tests still pass: `pnpm test:notifications`
  </done>
</task>

</tasks>

<verification>
1. `pnpm test:notifications` — existing Playwright tests pass
2. Open http://192.168.1.122:3099 in browser — carousel renders session cards horizontally
3. Drag/swipe carousel, dots update
4. Sidebar shows icon nav in both expanded and collapsed states
5. Voice settings work end-to-end (select voice, change template, generate samples)
6. Trigger a notification — toast, audio, session card all work
</verification>

<success_criteria>
- Session cards display in horizontal Embla carousel with dot navigation
- Sidebar has 3-section icon navigation visible in both expanded and collapsed states
- All existing functionality preserved (SSE, toasts, audio, voice config, session selection)
- Playwright notification tests pass
</success_criteria>
