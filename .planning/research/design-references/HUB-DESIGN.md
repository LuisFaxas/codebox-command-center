# Faxas Hub — Design System Reference

**Source:** /home/faxas/workspaces/projects/personal/faxas_hub
**Audited:** 2026-03-30

## Brand Colors

### Dark Mode (default)
- Background: `#0f0f1e` | Surface: `rgba(255,255,255,0.03)` | Elevated: `rgba(255,255,255,0.06)`
- Text: `#f8fafc` (primary), `#94a3b8` (secondary), `#64748b` (muted)
- Border: `rgba(255,255,255,0.08)` (thin), `rgba(255,255,255,0.10)` (standard)
- Accent: `#667eea` (primary), `#764ba2` (via), `#f093fb` (to)

### Light Mode
- Background: `#e2e8f0` | Surface: `rgba(255,255,255,0.9)` | Elevated: white
- Text: `#0f172a` (primary), `#334155` (secondary), `#475569` (muted)
- Border: `rgba(0,0,0,0.15)` (thin), `rgba(0,0,0,0.22)` (standard)
- Accent: `#4f46e5`

### Status Colors
- Up/Success: `#22c55e` (dark) / `#16a34a` (light)
- Down/Error: `#ef4444` (dark) / `#dc2626` (light)
- Degraded/Warning: `#f59e0b` (dark) / `#b45309` (light)
- Unknown: `#6b7280` (dark) / `#4b5563` (light)

## Typography

- Font: Geist Sans (system), Geist Mono
- Body: 0.875rem (14px) | Small: 0.75rem (12px) | Micro: 0.625rem (10px)
- Weights: medium (500) headings, regular (400) body

## Glassmorphism

- `.glass-surface`: bg var(--color-bg-surface), blur(10px), border 1px, radius 12px
- `.glass-card`: same + hover translateY(-2px) scale(1.015), accent border on hover
- `.glass-panel`: bg elevated, blur(10px), radius 12px
- `.glass-header`: bg elevated, blur(15px), border-bottom only
- `.glass-overlay`: bg elevated, blur(15px), shadow 0 4px 16px

## Layout

- Full-bleed responsive (no fixed max-width on dashboard)
- Grids: 1→2→3→4 cols responsive
- Border radius: 8px (sm), 12px (md/primary), 16px (lg/icon)
- Min touch target: 44px
- Sticky header z-50, mobile search z-40

## Key Patterns

- Dark/light mode via `data-theme` attribute + CSS variables
- Theme in localStorage `faxas-hub-theme`
- Spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` for interactive
- Ops dashboard tone — monitoring, status indicators, metrics
- `tabular-nums` for metric displays
- Reduced motion support via prefers-reduced-motion
