# DESIGN.md — CalmKitchen Designer

The HotelOS "Notebook" design language applied to the kitchen planning tool.
Canonical token source: `calm-kitchen` `apps/web/app/globals.css` (`@hotelos/chrome`).
Mockups + rationale: [`docs/ux-refresh/PLAN.md`](docs/ux-refresh/PLAN.md) and [`docs/ux-refresh/mockups/`](docs/ux-refresh/mockups/).

## 1. Brand

- Product name: **CalmKitchen Designer**. Top-bar lockup: HotelOS lime bracket symbol (`#b1d15b`) + "CalmKitchen Designer" wordmark in Bricolage Grotesque.
- CalmKitchen bowl mark (rose `#e38dbe` / magenta `#ca4e8e`) is the favicon and app icon.
- Projects default to neutral names: **Kitchen 1**, Kitchen 2… User-chosen names (e.g. "Beachside Bistro") only when set.
- Lime `#b1d15b` belongs to the HotelOS symbol ONLY. Never a UI state color.

## 2. Color tokens

Light-first. Never pure `#ffffff` surfaces.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f3f1eb` | App background, topbar, secondary fills |
| `--paper-hi` | `#fbfaf5` | Canvas (hero surface), panels, cards |
| `--bone` | `#e1ded5` | Segmented tracks, recessed fills |
| `--ink` | `#0c1e03` | Primary text, primary buttons, walls |
| `--ink-2` | `#1b3a36` | Secondary text, emphasis |
| `--ink-3` | `#5e6b5a` | Tertiary text, labels |
| `--ink-4` | `#9aa89a` | Disabled, timestamps |
| `--rule` | `rgba(17,34,28,.12)` | Hairlines (green-tinted) |
| `--rule-2` | `rgba(17,34,28,.22)` | Inputs, card borders |
| `--accent` | `#ca4e8e` | Spot accent: selection, active state, focus ring, eyebrows |
| `--accent-soft` | `rgba(202,78,142,.12)` | Selected fills |
| `--ok` | `#2d7c6f` (+ soft) | Pass (moss) |
| `--warn` | `#c2934f` / deep `#a47932` | Attention (ochre) |
| `--danger` | `#a32f1d` (+ soft) | Errors (rust) |
| `--sky` | `#4b7ce1` | Cold category, info |
| Categories | cooking `#cb6c55` · cold `#4b7ce1` · prep `#2d7c6f` · wash `#c2934f` · storage `#5e6b5a` · util `#9aa89a` | Dots/edge-marks/legend only |

Primary buttons: **ink-on-light** (`--ink` bg, paper text). Hover `#1b3a36`.
Dark mode: out of scope for this refresh (brand's documented dark theme is deep green-black + lime buttons).

## 3. Typography

Geist (UI) · Bricolage Grotesque (display) · JetBrains Mono (all measurements, counts, metrics — tabular).

| Role | Font | Size / weight |
|---|---|---|
| Display | Bricolage Grotesque | 19–32px / 600, tracking -0.015em |
| Heading | Geist | 14–16px / 600 |
| Body | Geist | 13px / 400–510 |
| Control | Geist | 12–12.5px / 510 |
| Label / caption | Geist | 11px / 400–510 — **sentence case** |
| Numeric | JetBrains Mono | 10.5–16px, tabular-nums |

**Floor: 11px. Nothing smaller ships.** No uppercase micro-labels except magenta dialog eyebrows.

## 4. Space, shape, depth

- Radius: 8 (inputs, chips) / 12 (panels, cards) / 16 (dialogs).
- Shadows warm ink-tinted: `0 1px 0 rgba(17,34,28,.04), 0 10px 30px -12px rgba(28,42,28,.18)`; popovers stronger.
- No border-left accent strips; importance = fill, not stripe.
- Focus: 2px `--accent` ring, 2px offset, everywhere.

## 5. Primitives

TopBar (48px) · StageStepper (named steps, status dots: active=magenta, done=moss, warn=ochre) · Seg (Plan/3D/Split) · Panel (paper-hi, hairline, shadow) · CanvasToolbar (floating translucent strip over canvas) · LayoutTabs · StatusPill · Chips · Rows · Field · Verdict · HUD cells · Playback · Toast (ink stamp) · Dialog/wizard.

States: every interactive element has hover (ink 5%), active (ink 9%), focus-visible (magenta ring), disabled (`--ink-4`, 45% opacity).

## 6. Motion

150–250ms, `transform`/`opacity` only; reduced-motion respected app-wide (existing global rule stays).

## 7. Accessibility constraints

- Text contrast ≥ 4.5:1 on paper (ink tokens guarantee; never `--ink-4` below 12px for essential info).
- Focus visible on all controls; keyboard paths unchanged (1/2/3, arrows, ⌘Z, ⌘D, [, ], Delete, Esc).
- Accessible names are the test contract — rename only with a same-commit test update.

## 8. Accepted debt (this pass)

- Catalog keeps combobox filters (chip-first search is the next iteration; mockup `plan-editor.html` shows the target).
- Simulation setup keeps its form structure; restyled only (composition screen is next iteration).
- ⌘K command palette not yet implemented (trigger absent; Help popover remains).
- Unicode glyphs stand in for icons in some toolbars; production icon set (Phosphor) lands with the catalog iteration.

## 9. Reference fidelity

`docs/ux-refresh/mockups/index.html` is the visual contract for this language; per-screen mockups show target states for editor, 3D, simulate, auto-layout, space, compare.
