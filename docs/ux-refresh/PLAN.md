# Kitchen Designer — UX Refresh Plan

**Goal:** transform a feature-complete but cluttered planning tool into a calm, modern, canvas-first studio where complexity is disclosed progressively and every screen has one obvious primary action.

**Scope of this document:** current-state audit, design direction, information architecture, screen-by-screen specs, mockup index, and phased implementation plan. Mockups live in [`mockups/`](./mockups/README.md) as self-contained HTML files — open them in a browser. Screenshots of the current app that back the audit are in [`audit/`](./audit/).

---

## 1. Current-state audit

Audited via live app (localhost:5173, all stages + overlays), the full stylesheet (`src/app/styles.css`, 530 lines), and component structure. Evidence anchors cited inline.

### 1.1 Chrome overload — 5 stacked bars before any content

| Bar | Height | Contents |
|---|---|---|
| Header row 1 (dark) | 56px | Brand, project menu, 1-2-3 stepper + caption, Plan/3D/Split switcher, Compare, Auto-layout, Save/Open/Export, Help |
| Header row 2 (light) | 44px | Layout tabs, Catalog/Inspector toggles, Check essentials, Undo/Redo, Source reference, Revision history, rotate/resize actions |
| Workspace toolbar | 50px | Variant controls + actions (duplicates row 2 in overlays) |
| Canvas status strip | 34px | Units · Grid · Snap |
| Canvas footer | 34px | Scale, zoom, grid legend, space lock |

**~218px of vertical chrome** on a 900px viewport leaves <70% for the actual plan. Every bar is a full-width solid block — the app reads as "toolbar soup", not as a canvas tool.

### 1.2 Typography is unusably small and shouts in uppercase

Measured from `styles.css`:

- Body/label text at **7px, 8px, 9px, 10px** throughout (`.live-service-hud span` 7px, `.catalog-card p` 7px, `.canvas-status` 8px, `.follow-control` 7px…). Several sizes are below the 9px legibility floor.
- **38+ selectors** use `text-transform: uppercase` with `letter-spacing: .06–.13em` — micro-caps everywhere, so nothing reads as a label because everything does.
- 12px controls, 14px max headings in panels. No type scale — sizes are ad-hoc per component (7/8/9/10/11/12/13/14/15/16/18/19/20/22/27/28px all appear).

### 1.3 Everything visible at once — zero progressive disclosure

- **Plan screen default state:** left catalog (304px, ~90 items in one flat list + 2 filter comboboxes + 3 tabs + search) **and** right inspector (336px, stage overview + checks + diagnostics + settings) **and** center canvas — a permanent 3-column split on a 1440px screen.
- **Issue signaling is fragmented across 6 surfaces simultaneously:** stage pill ("24 issues"), canvas warning badges (15×), per-item check chips on the canvas, "Layout checks — 12 items to inspect" panel, essentials counter button ("Check essentials · 12"), diagnostics list. The same 12 problems are indicated in ~4 places at once.
- **Auto-layout exposes its entire parameter space up front:** 6 fieldsets, 23 lock checkboxes, 9 numeric inputs — all visible before the user has chosen a goal. The one decision that matters first ("what should be prioritized?") is buried mid-form.
- **Simulation setup:** 3 permanent columns (scenario 320px + viewport + results 360px). Six layer toggles + follow select + run button + view switcher + 6-metric HUD + ticket rail + station strip + legend + playback controls can all be on screen at once.

### 1.4 Visual language issues

- **Border addiction:** virtually every element carries a 1px `#d7d0c4` border; cards have border + background + border-left accent. Structure is drawn with lines instead of elevation and spacing.
- **Muddy mid-tones:** sand `#eee9df` / paper `#fbfaf6` / surface `#f7f4ed` are three near-identical warm whites — differentiation fails, so more borders are added to compensate.
- **Inconsistent emphasis:** copper `#d46847` is used for primary actions, active stages, selected items, warnings, error accents and the brand mark simultaneously — the accent color means five things.
- **Mixed light/dark:** dark charcoal header on light body on dark HUD — three lighting zones stacked.

### 1.5 What already works (keep)

- The 3-stage mental model (Space → Equipment → Simulate) with per-stage issue counts.
- Layout variants as tabs; base-space sharing concept.
- Deterministic simulation with playback, follow-cam, and evidence-based findings.
- Keyboard shortcuts, undo/redo everywhere, autosave, validated import/export.
- Catalog data model (categories, capabilities, dimensions) is excellent — presentation is the problem.

---

## 2. Design direction — "Notebook" (CalmKitchen Designer)

The HotelOS brand applied to a planning tool. Tokens are taken directly from calm-kitchen's canonical system (`apps/web/app/globals.css`, sourced from `@hotelos/chrome`): warm paper surfaces, forest-green ink, green-tinted hairline rules, and the CalmKitchen **magenta spot accent**. The canvas is the brightest surface on screen (paper-hi); chrome recedes onto paper. One accent (magenta) reserved for *selection + active state + focus*. Primary buttons are **ink-on-light** (#0c1e03 with paper text), per the brand rule. Lime `#b1d15b` belongs to the HotelOS symbol only. Complexity exists, but it is **summoned, not shown**.

**Branding decisions**

- Product name: **CalmKitchen Designer**. Top-bar lockup: HotelOS lime bracket symbol + "CalmKitchen Designer" wordmark (Bricolage Grotesque). CalmKitchen bowl mark (magenta/rose) becomes the app icon and favicon.
- Projects get neutral default names — **Kitchen 1**, Kitchen 2… The user's own name (e.g. "Beachside Bistro") appears only when they set one.
- Light-first, matching calm-kitchen web and the existing light 3D renderer. A dark theme (deep green-black inversion, lime buttons — the brand's documented dark mode) is a future option, not part of this refresh.

### 2.1 Design principles

1. **Canvas first.** Full-bleed canvas; every panel floats and can dismiss. Chrome ≤ 48px persistent.
2. **One primary action per screen.** Space → "Draw room". Equipment → "Add equipment" / "Fix issues". Simulate → "Run service". Auto-layout → "Generate".
3. **Progressive disclosure, three layers.** Layer 1: always-visible minimal chrome. Layer 2: contextual panels that appear on selection/intent. Layer 3: overlays and dialogs for commitment flows (wizards, compare, settings). Plus a command palette (⌘K) as the universal escape hatch.
4. **Quiet by default, loud on signal.** No permanent warning badges. Issues surface through one entry point (Review) and light up contextually on hover/selection.
5. **Numbers are the product.** All measurements, counts and metrics render in monospace tabular figures — the app feels like a precision instrument.
6. **Motion explains structure** (150–250ms, transform/opacity only, reduced-motion respected). Panels slide from where they belong; nothing decorative.

### 2.2 Color tokens (Notebook theme — mirrors calm-kitchen)

| Token | Value | Use |
|---|---|---|
| `paper` | `#f3f1eb` | App background, topbar, secondary fill |
| `paper-hi` | `#fbfaf5` | Planning canvas (hero surface), panels, cards |
| `bone` | `#e1ded5` | Segmented tracks, recessed fills |
| `ink` | `#0c1e03` | Primary text, primary buttons |
| `ink-2` | `#1b3a36` | Secondary text, wall geometry |
| `ink-3` | `#5e6b5a` | Tertiary text, labels |
| `ink-4` | `#9aa89a` | Disabled / timestamps |
| `rule` | `rgba(17,34,28,.12)` | Hairlines (green-tinted) |
| `rule-2` | `rgba(17,34,28,.22)` | Input/card hairlines |
| `accent` | `#ca4e8e` | CalmKitchen spot accent — selection, active step, focus ring, eyebrows |
| `accent-soft` | `rgba(202,78,142,.12)` | Selected fills |
| `lime` | `#b1d15b` | HotelOS symbol ONLY |
| `ok` | `#2d7c6f` | Pass states (moss) |
| `warn` | `#c2934f` | Attention (ochre) |
| `danger` | `#a32f1d` | Errors / blocked (rust) |
| `sky` | `#4b7ce1` | Cold-zone category |
| `cooking` | `#cb6c55` | Cooking category (ochre-red) |
| `wash` | `#c2934f` | Wash category (ochre gold) |
| `storage` | `#5e6b5a` | Storage category (sage) |

Equipment categories keep their semantic hues but appear **only** as small dots/edge-marks and in the legend — never as fills for whole cards.

### 2.3 Type scale (Geist + Bricolage Grotesque + JetBrains Mono)

Matches calm-kitchen's font stack.

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Display | Bricolage Grotesque | 24–32px / 600 | Overlay titles, brand name |
| Heading | Geist | 16px / 600 | Panel titles |
| Body | Geist | 13px / 400 | Default UI text |
| Body strong | Geist | 13px / 600 | Emphasis |
| Control | Geist | 12.5px / 500 | Buttons, tabs |
| Label | Geist | 11px / 500 | Field labels — **sentence case**, no uppercase transform |
| Caption | Geist | 11px / 400 | Helper text |
| Numeric | JetBrains Mono | tabular | All dimensions, counts, metrics, times |

**Floor: 11px. Nothing smaller exists.** Micro-caps eyebrows are eliminated; hierarchy comes from size/weight/color, not case.

### 2.4 Elevation & shape

- Radius scale: 8 (inputs, chips) / 12 (panels, cards) / 16 (dialogs).
- Panels: `paper-hi` + green hairline + warm ink-tinted shadow `0 10px 30px -12px rgba(28,42,28,.18)`.
- No border-left accent strips. Importance = fill, not stripe.
- Focus: 2px magenta ring (`--color-ring` equivalent), 2px offset — everywhere.

### 2.5 Signature moments

1. **The paper drafting canvas** — paper-hi surface with a fine green-tinted dot grid; room geometry in ink with a magenta selection glow. Feels like a printed plan on a light table.
2. **⌘K command palette** — add equipment, jump stages, toggle layers, run simulation; fzf-style.
3. **Simulation playback** — HUD metrics count in mono; stations pulse ochre→rust as pressure builds; heat trails fade behind staff.

---

## 3. Information architecture

### 3.1 App shell (all stages)

```
┌────────────────────────────────────────────────────────────────┐
│ ◆ Kitchen 1 ▾   ○ Space ─ ● Fit-out ─ ○ Simulate    ⌘K  ⟨view⟩ │  48px
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                        FULL-BLEED CANVAS                       │
│      (floating panels summon by intent — see per screen)       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- **Top bar (48px, `bg-base`):** brand mark → project name menu → stage stepper (named, with completion dots) → spacer → command palette trigger → Plan/3D/Split segmented → Save state (autosave tick, menu for Open/Export/New).
- **Undo/Redo/Help** move into the command palette + a compact history affordance on the project menu (keyboard shortcuts unchanged).
- Layout variant tabs move **onto the canvas** as a floating tab strip (top-left, below top bar) — they are canvas artifacts, not global chrome. Base-space shows as a pinned "Room" tab.
- **Review** (all diagnostics) becomes a single floating status pill, bottom-center: `✓ 84 · ⚠ 12` — click to open the Review drawer.

### 3.2 Progressive disclosure ladder

| Layer | Surfaces | Rule |
|---|---|---|
| L0 persistent | Top bar, canvas, status pill, variant tabs | Never exceeds 48px + floating clusters |
| L1 contextual | Library dock, Inspector, Context toolbar | Appears on intent (selection, add-mode); remembers last state per stage |
| L2 commitment | Wizards (new room, auto-layout), Compare, Essentials, Settings, ⌘K | Full-screen or large dialog; explicit entry/exit |
| L3 transient | Toasts, tooltips, context menus, popovers | ≤ 8s lifetime |

**Complexity budget per screen: max 2 visible panels + canvas.** Today's plan screen shows 5.

---

## 4. Screen-by-screen redesign

Each spec lists: layout, components, what moves/hides, primary action. Wireframes are indicative; the HTML mockups are the visual source of truth.

### 4.1 Space stage — "Draw the room"

**Today:** full editor chrome + catalog + inspector + polygon room editor; "12 issues" pill.
**Primary action: define/verify the room outline.**

New:

- Canvas + floating **Room panel** (right, 320px): room outline editor (vertices list, dimensions, area readout in mono), openings & pillars section (collapsed until tapped), "Trace from drawing" (source reference upload + opacity) behind a button.
- Bottom-center status pill shows room completeness.
- Empty state: centered composition — "Draw your kitchen's outline" with three start options (Draw · Dimensions · Trace sketch) as cards.
- Issues from Space stage (geometry) appear in the same Review drawer, grouped "Room".

### 4.2 Equipment stage — "Fit out the kitchen" (the hero screen)

**Today:** 3 permanent columns, 15 warning badges, duplicate toolbars.
**Primary action: place equipment; secondary: resolve checks.**

New layout (see `mockups/plan-editor.html`):

- **Full-bleed canvas** with dot grid, room, equipment.
- **Library dock (left)** — collapsed to a 44px icon rail by default. Expands (280px) on click/⌘B/"Add equipment" CTA. Inside: search-first (⌘-focused), category chips (Cooking · Cold · Prep · Wash · Storage · Utilities), results as compact rows with category dot, name, size (mono); station templates tab; "Placed" tab with grouped list. No combobox trees — capability filter lives behind "Filter" in search.
- **Context toolbar (top-center, floating pill)** — appears with selection: rotate ⟲ ⟳ · dimensions · duplicate · delete · more (⋮ → note, capabilities, replace). This replaces inspector transform rows.
- **Inspector (right, 320px)** — opens only with selection: identity + position (mono XYZ/rotation), quick configuration, capabilities (collapsed), item note. No selection → no inspector.
- **Status pill** bottom-center → Review drawer: issues grouped by severity with "Show on plan" (badge appears on the offending item only when its issue row is hovered/selected, or when "Reveal all" is toggled).
- **Essentials checker** stays an L2 dialog (it's a checklist flow), reachable from Review drawer and ⌘K.
- Wizard ("New layout") stays a dialog; variant actions live on tab hover (rename/duplicate/compare).

### 4.3 3D & Walk

**Today:** toolbar with 7 buttons + legend strip + 16 floating select buttons over the canvas.
**Primary action: inspect the room in 3D.**

**The 3D renderer stays as-is** — the existing procedural scene already works; only its default backdrop receives light touches (paper-toned environment instead of the current beige, ink-tinted contact shadows) so it sits naturally in the Notebook frame. No renderer rewrite.

New chrome around it (see `mockups/3d-view.html`):

- Full-bleed 3D viewport; **floating view cluster** top-center: Perspective/Top segmented · Fit · a "Layers" popover (clearances, transparent walls, labels).
- **Walk CTA** — prominent pill bottom-right: "Walk the kitchen (W)". In walk mode: HUD minimal — reticle, compact controls card (auto-fade), Esc to exit.
- Equipment selection happens by clicking in 3D (labels on hover, not 16 permanent buttons). Legend collapses into the Layers popover.
- Clean/dirty pass markers persist but styled as canvas annotations (teal/brass), toggleable.

### 4.4 Simulate stage — "Pressure-test service"

**Today:** 3 columns; setup form with 15+ fields; 6 layer toggles; results sidebar with 5 stacked sections.
**Primary action: run the service simulation; secondary: tune scenario.**

New (see `mockups/simulate.html`):

- **Setup state:** centered composition — scenario summary card (name, covers·duration·staff in mono, seed), preset chips (Dinner peak · Lunch rush · Custom), "Tune scenario" opens a right drawer (all current fields, grouped: Demand · Staff · Checks · Timings(adv)), **Run service** primary button. Guidance copy: one sentence.
- **Running state:** viewport (2D/3D/Walk segmented, top-center) + slim **HUD strip** along top (6 metrics, mono, tabular) + **playback bar** bottom-center (play/pause, scrub, speed, time in mono, follow select) + **Findings rail** right (only after first finding; verdict card on top: Ready / Strained / Critical with one-line why; findings grouped; "Show on plan" per finding). Layer toggles move into a Layers popover (top-center cluster).
- Ticket rail & station strip become **optional HUD layers** in the Layers popover (off by default; power users enable).
- Post-run: Results drawer slides up (scorecard, wait distribution, station pressure, assumptions, model confidence) — replaces the permanent sidebar.

### 4.5 Auto-layout — from form to wizard

**Today:** 6 fieldsets + 23 checkboxes at once.
**Primary action: generate alternatives.**

New (see `mockups/autolayout.html`): a 3-step wizard, one decision per step, back/forward, keyboard-navigable:

1. **Goal** — 4 large cards (Shorter staff travel · Higher throughput · Clean/dirty separation · Open workspace) with one-line explanation; "How many alternatives? 1/3" segmented.
2. **Constraints** — "Keep fixed" as visual chips over a miniature plan (walls, windows, pillar, selected equipment — tap to lock/unlock; default: architecture locked, equipment free). Advanced accordion: aisle minimum, no-go zones, P90 target, evaluation budget.
3. **Generate** — progress with live candidate thumbnails; results as ranked cards (goal score, delta vs current in mono, key change summary) with "Open as new layout" / "Compare" actions; nothing overwrites the current layout (preserved behavior).

### 4.6 Compare & Report

- Compare stays an L2 overlay but is restyled to the same language: baseline/candidate previews on elevated cards, metric delta table with signed mono values, findings rail on the right.
- Report view = light "Paper" theme automatically; print stylesheet preserved.

### 4.7 Project start / menu

- Start screen: hero composition with three cards (Example project · Start from dimensions · Trace a sketch) + recent projects list — replaces the current stacked start form. New projects default to neutral names (Kitchen 1, Kitchen 2…) with the CalmKitchen mark.
- Project menu (top-left dropdown): rename, profile, units, save a copy, settings, new — same items, styled to language.

---

## 5. Component system (summary)

| Primitive | Notes |
|---|---|
| `TopBar` | 48px; brand · project · stepper · ⌘K · view switch |
| `StageStepper` | Named steps with status dots (ok/warn/active) |
| `Panel` | Floating, 12px radius, hairline, shadow, optional blur |
| `DockRail` | 44px icon rail; expands to dock panel |
| `ContextBar` | Floating pill toolbar bound to selection |
| `StatusPill` | Bottom-center aggregate status; opens Review |
| `Drawer` | Right slide-over for tuning/inspection lists |
| `Dialog` | L2 centered modal; wizards use `WizardShell` |
| `HUD strip / PlaybackBar` | Mono metrics; simulation only |
| `Chips` | Category + preset + lock chips |
| `Field` | Inputs 32px, labels sentence-case 11px |
| `Toast` | Bottom-right, 5s, single-line + action |

All states (hover/active/focus/disabled/loading/empty/error) specified in `DESIGN.md` at implementation start; primitives land behind a showcase page before product screens.

---

## 6. Implementation phases

| Phase | Deliverable | Risk | Notes |
|---|---|---|---|
| **P0 — Foundation** | `DESIGN.md` + tokens in CSS custom properties (imported from calm-kitchen's canonical `@hotelos/chrome` set) + primitive components + showcase page | Low | No behavior change; new tokens side-by-side with old |
| **P1 — Shell** | New TopBar/StageStepper/variant tabs onto canvas; kill rows 2–5; status pill + Review drawer | Medium | Preserve all `aria-label`s — tests depend on accessible names |
| **P2 — Equipment screen** | Library dock + context toolbar + contextual inspector; badge quieting | Medium | Largest surface; ship behind a flag for one release |
| **P3 — Space + 3D** | Room panel, empty states, 3D floating clusters, walk HUD | Medium | |
| **P4 — Simulate** | Setup composition, HUD, playback, findings rail, results drawer | Medium | Keep engine untouched — presentation only |
| **P5 — Auto-layout wizard + Compare** | 3-step wizard, results cards, compare restyle | Medium | |
| **P6 — Polish** | ⌘K palette, motion pass, light Paper theme, empty/error/loading states audit, a11y pass (contrast ≥4.5 on all text, focus visible) | Low | |

**Migration notes**

- Styling stays plain CSS with custom properties (matches current stack; no framework migration).
- `aria-label` strings are the contract with `*.test.tsx` — the refresh changes classNames freely but keeps accessible names unless a test is updated in the same commit.
- No domain/state/engine changes in any phase. Zustand store, simulation engine, optimizer worker untouched.

---

## 7. Mockups

Self-contained HTML (shared `studio.css` design system). Open `mockups/index.html` first.

| File | Screen | State shown |
|---|---|---|
| `index.html` | Design language | Palette, type, components, principles |
| `plan-editor.html` | Equipment · Plan | Selection active, inspector open, library rail |
| `3d-view.html` | 3D inspect | Floating view cluster, walk CTA |
| `simulate.html` | Simulate · running | HUD, playback, findings rail |
| `autolayout.html` | Auto-layout wizard | Step 2 constraints + results preview |
| `space.html` | Space stage | Room panel + outline editing |
