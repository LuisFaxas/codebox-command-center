# Faxas Portfolio — Design System Reference

**Source:** /home/faxas/workspaces/projects/personal/faxas-portfolio-app
**Audited:** 2026-03-30

## Brand Colors

- Background: `#0f0f1e` (primary), `#1a1a2e` (alt), `#16213e` (deep)
- Accent gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)`
- Text: `#e2e8f0` (primary), `#94a3b8` (secondary), `#64748b` (muted)
- Success: `#10b981` | Warning: `#f59e0b` | Error: `#ef4444` | Info: `#3b82f6`
- Frosted accent: `rgba(200, 210, 225, 0.50)`

## Typography

- Font: DM Sans (weights 200, 400, 500, 600, 700, 800)
- Mono: JetBrains Mono, Fira Code
- Display: `clamp(2rem, 5vw, 4.5rem)` | H1: `clamp(1.75rem, 4vw, 3.25rem)` | H2: `clamp(1.5rem, 3vw, 2rem)`

## Glassmorphism

- `.glass-subtle`: bg rgba(255,255,255,0.03), blur(12px)
- `.glass-medium`: bg rgba(255,255,255,0.05), blur(16px)
- `.glass-strong`: bg rgba(255,255,255,0.08), blur(24px)
- `.glass-card`: bg rgba(255,255,255,0.05), blur(16px), border 1px solid rgba(255,255,255,0.10), radius 12px
- `.glass-heavy`: bg rgba(255,255,255,0.15), blur(36px)

## Shadows

- sm: `0 2px 8px rgba(0, 0, 0, 0.3)`
- md: `0 4px 16px rgba(0, 0, 0, 0.4)`
- lg: `0 8px 32px rgba(0, 0, 0, 0.5)`
- glow: `0 0 20px rgba(200, 210, 225, 0.15)`

## Key Patterns

- Dark mode only, no light mode
- Frosted gradient text for headings
- Rainbow gradient border on primary buttons
- Max container: 1280px (max-w-7xl)
- Border radius: 8px buttons, 12px cards, full-round badges
- Framer Motion animations (fadeInUp, scaleIn, glass-safe variants)
- Mobile: glass disabled, opaque backgrounds
