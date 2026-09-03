# WebMCP agent-readiness plan

> **Superseded in priority by the sprint below.** The audit findings remain accurate; the phased plan after the sprint is post-judging work (after 21 September 2026).

Audit target: working tree at `a8b0365`, 2026-09-03. Baseline: 556 unit tests passing, 11 registered tools, 22 workspace operation types.

Goal: a user drives CalmKitchen Designer entirely through their own agent (ChatGPT, Claude, or any WebMCP client), sees every change live, and can reach every capability the app has.


## HACKATHON SPRINT — The WebMCP Challenge (webmcp.devpost.com)

**Deadline: Thursday 3 September 2026, 13:00 PDT = 20:00 UTC = 04:00 WITA Friday.** Judging 4–21 Sep. Judges may evaluate from the video and description alone — the video is the product.

Judging criteria (equal weight): WebMCP leverage · Execution · Potential impact · Creativity & ambition.

Hard submission gates — status at audit time:
- [ ] **Public repo** — `hotelos-ai/kitchen-planner` returns 404 unauthenticated (private). Make public or mirror to a personal public repo.
- [ ] **Open-source LICENSE file** — none exists; `package.json` says `UNLICENSED`. Add MIT/Apache-2.0 and update package.json.
- [x] Live URL — https://planner.kitchen.hotelos.ai returns 200 and the bundle contains the WebMCP layer.
- [ ] Commit the 24 dirty files, push, `npm run deploy` — the judged URL must match the judged repo.
- [ ] YouTube video, public, < 3 min, with audio.
- [ ] Devpost description covering the four required points (drafted in the artifact).
- [ ] Testing-instructions note: project began 31 Aug; WebMCP landed in `58c4861`.
- [ ] Keep the site free/unrestricted through 21 Sep; no risky deploys during judging.

Not needed for judging (cut): Chrome origin trial token — judges use the ChatGPT desktop browser (Site tools on by default) or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`. Correction to P0.1 below: ChatGPT Site tools docs show `execute` returning plain objects, so bare-object results likely already work; **verify on the real ChatGPT browser first, wrap only if it fails.**

### Hour plan

1. **Gates (30 min):** LICENSE + package.json; repo public; commit/push/deploy; open live URL in ChatGPT desktop browser → confirm "Available site tools" lists 11 → ask it to move one item. Make-or-break test before any more code.
2. **Agent operates the app (3 h):**
   - Minimal `src/state/app-state-store.ts` with `stage`, `view`, `overlay`, `requestedRun`. `App.tsx` reads from it (setters already exist as props).
   - `get_app_state`, `set_app_view` (stage/view/overlay only).
   - `select_components` over existing `selectItems`/`clearSelection`.
   - `run_simulation` sets `requestedRun` + `stage:'simulate'`; `SimulationWorkspace` observes and calls `session.startRun()`.
   - `check_operational_essentials` → facade `getLayoutRequirements` (already wired).
   - Persist `intent` on apply; toast with Undo.
3. **Reads as finished (1.5 h):** rewrite starter prompt; README "WebMCP" section listing every tool + contracts + image-privacy stance; update `public/llms.txt`; redeploy; retest.
4. **Video (1.5 h):** one take in the ChatGPT browser on the live URL; show the Site tools menu early; upload public; check in incognito. Script in the artifact.
5. **Submit by 12:00 PDT (1 h buffer):** paste description, testing instructions, screenshots.

Cut to post-judging: menu model / schema v4, auto-layout tools, `import_project`, `share_results`, real report generator, simulation Web Worker, granular opening ops, conformance suite, origin trial.

---

## Verdict

Five structural blockers:

1. **Tool results are not in WebMCP shape.** Every `execute` returns a bare object. Chrome expects a string or MCP content blocks; the spec defines `executeTool()` as resolving to a `DOMString`. Tests call `execute` directly and never cross the protocol boundary, so this is invisible to CI.
2. **Real visitors never see the tools.** No origin-trial token in `index.html` or Worker headers (WebMCP is an origin trial from Chrome 149). Registration is attempted once on mount with no retry, so a late-injected `modelContext` is permanently missed.
3. **The agent can edit the document but cannot operate the app.** Stage, view, overlay, panels, selection, walk mode, camera, and simulation playback are all React `useState` in `App.tsx` / `SceneWorkspace.tsx` / `SimulationWorkspace.tsx`. No tool reaches any of them.
4. **`run_simulation` shows the user nothing.** The tool computes in-place and returns numbers; the UI result lives in `useSimulationSession` local state. Auto-layout has facade methods (`runAutoLayout`, `cancelRun`) and no tool at all.
5. **Menu items are a facade.** `SimulationSetup.tsx` holds `DEFAULT_GENERATED_MENU` in `useState`. Not in the schema, not in the project, not read by the engine — `generateServiceTaskDemand` gives every order the same 5-stage chain.

Known defect: `intent` is stored on the preview candidate and discarded on apply. Nothing persists it; `RevisionHistory` never shows it. The tool description claims it is "recorded in history".

## Phase 1 — Protocol conformance (2d, blocks everything)

- [ ] Add `src/webmcp/tool-result.ts` with `toolResult(payload)` returning `{ content: [{type:'text', text: JSON.stringify(payload)}], structuredContent, isError: payload.ok === false }` and a 262_144-byte cap that degrades to a `result-too-large` envelope.
- [ ] Apply it in the `webmcp-controller.ts` wrapper **after** the activity log reads the payload (otherwise every entry records `ok: undefined`).
- [ ] Register the origin trial for `https://planner.kitchen.hotelos.ai`; add `<meta http-equiv="origin-trial">` to `index.html` **and** `public/_headers` with `Origin-Trial:` + `Permissions-Policy: tools=(self)`. Record the expiry date in-repo.
- [ ] Rewrite `register()`: retry detection on `0/250/750/2000/5000ms` backoff; re-register on `pageshow` when `event.persisted`; listen for `toolchange`; add a "Retry registration" button to `AgentToolsPanel` and show the verbatim detection reason.
- [ ] Drop `destructiveHint`/`openWorldHint` from `model-context.ts` (spec has only `readOnlyHint` and `untrustedContentHint`). Set `untrustedContentHint: true` on `get_layout`, `get_component_catalog`, `export_project`, `import_project`.
- [ ] Thread `execute`'s second-arg `AbortSignal` into `run_simulation` and the auto-layout tools; return `{ ok:false, code:'cancelled' }`.
- [ ] Test: each description < 500 chars, whole manifest < 8KB. Move long prose into `get_workspace_guide`. `get_layout` and `preview_layout_changes` are over budget today.

## Phase 2 — App state store + app tools (3d)

- [ ] New `src/state/app-state-store.ts` (Zustand, **not** persisted, **not** undoable, **not** in exported JSON). Lift `stage`, `view`, `overlay`, `catalogOpen`, `inspectorOpen`, `essentialsOpen`, `revisionsOpen`, `showReference` out of `App.tsx`; `walkMode`, `walkView`, `cameraMode`, `showClearances`, `wallsTransparent`, `showLabels` out of `SceneWorkspace.tsx`; `view` out of `SimulationWorkspace.tsx`.
- [ ] New `src/webmcp/webmcp-app-tools.ts`:
  - `get_app_state` (read) → `{ stage, view, overlay, walkMode, cameraMode, simulationView, panels, selectedIds, hasSimulationResult, canUndo, canRedo }`
  - `set_app_view` (write) → all fields optional: `{ stage?, view?, overlay?, walkMode?, simulationView?, panels?, showReference? }`. Does not touch revision.
  - `select_components` (write) → `{ componentIds, mode: 'replace'|'add'|'toggle'|'clear', reveal?: 'plan'|'scene'|'both' }`
  - `focus_camera` (write) → `{ target: 'fit'|'component'|'point', componentId?, point?, cameraMode? }`
- [ ] Sync selection between the Konva plan canvas and the Three scene.

## Phase 3 — Simulation + auto-layout as agent surfaces (4d, parallel with 4)

- [ ] New `src/state/simulation-run-store.ts`, keyed `${variantId}:${scenarioId}` → `{ result, seed, ranAtRevision, ranAt }`. LRU of 3; drop `frames` for non-active runs.
- [ ] Refactor `useSimulationSession` to read from it rather than own `result`.
- [ ] Move the engine call to a Web Worker above ~100 covers (copy the `optimizer.worker.ts` pattern). Measured cost: 158ms @45 covers, 240ms @120, 1201ms @300 — currently synchronous on the main thread.
- [ ] Rewrite `run_simulation`: add `{ playback?: 'play'|'pause'|'none', navigateTo?: boolean }`, write into the run store, optionally move the user to the Simulate stage.
- [ ] New `get_simulation_result` (read) → `{ include?: 'metrics'|'findings'|'stations'|'orders' }`, reports `staleAtRevision`.
- [ ] New `check_operational_essentials` (read) → wraps the facade's existing `getLayoutRequirements` / `evaluateOperationalRequirements`. Pure exposure, no domain work.
- [ ] New `compare_layouts` (read) → `{ baselineVariantId, candidateVariantId, scenarioId?, openOverlay? }` returning deltas + findings from `simulation/recommendations`.
- [ ] New `run_auto_layout` (write) → `{ variantId, objectives?, maxCandidates?, seed? }` returns `{ runId }` immediately and opens the overlay; `get_auto_layout_run` (read) polls `{ status, progressPct, candidates }`; `cancel_auto_layout_run` (write). Adoption goes through the existing `adopt_auto_layout_result` operation.

## Phase 4 — Menu model (3d, deepest change)

- [ ] `project-schema.ts`: bump `schemaVersion` 3 → 4; add optional `menuItems` to `SimulationScenario`:
      `{ id, name, sharePct 0-100, source: 'user-provided'|'imported'|'template-estimate'|'system-inferred', steps: [{ label, capability, activeSeconds, passiveSeconds? }] (1-24) }`, max 200.
- [ ] Migration is a no-op (field optional) — add a round-trip test loading a v3 fixture and asserting byte-identical simulation output for a fixed seed.
- [ ] `simulation/tasks.ts`: `generateServiceTaskDemand` draws a dish per order by `sharePct`-weighted deterministic selection from the seeded RNG and builds that chain. **When `menuItems` is absent, keep today's hardcoded chain exactly** — preserves determinism for existing seeds.
- [ ] Add `menuItems` to `scenarioPatchSchema` in `workspace-operation.ts` so agents edit it via `update_scenario`.
- [ ] Extend `get_simulation_guide` to return the current menu, editable fields, and per-item provenance.
- [ ] Rewire `SimulationSetup.tsx` to read/write the scenario instead of `useState`, so human and agent edit the same object. The current on-screen claim that the menu drives the model is false until this lands.

## Phase 5 — Project lifecycle and sharing (2d)

- [ ] New `import_project` (write) → `{ projectJson, mode: 'replace'|'add-as-variant', expectedRevision }` via `importProject`, one undo step, `untrustedContentHint: true`, never auto-runs anything after import.
- [ ] Extend `export_project` → `{ format: 'project-json'|'equipment-schedule-csv'|'report-html'|'plan-svg', download?: boolean }`; `download: true` triggers a real browser download.
- [ ] New `manage_checkpoints` (write) → `{ action: 'list'|'create'|'restore', label?, checkpointId?, variantId? }` over existing store methods.
- [ ] New `src/features/compare/build-report-html.ts`: self-contained HTML with plan SVG, scenario assumptions, metric table, ranked findings with evidence, station utilisation, disclaimer. Point the Export menu, `ReportView` print, and `share_results` at it. Today's `exportReport` writes a title and two counts.
- [ ] New `share_results` (write) → `{ include: [...], variantIds?, scenarioId? }` → downloads the report and returns a compressed deep link.
- [ ] "Export current view as image" currently calls `window.print()` — implement against Konva `toDataURL` + the Three canvas, or remove it.
- [ ] Granular ops in `workspace-operation.ts`: `add_opening` / `update_opening` / `remove_opening`, same trio for pillars and storage zones. Whole-array replacement stays for wholesale redraws.
- [ ] Extend `apply_layout_changes` to accept **either** `{ previewToken }` **or** `{ expectedRevision, operations, intent, idempotencyKey? }` — halves round-trips, keeps atomicity and the revision guard.

## Phase 6 — Agent experience and trust (2d)

- [ ] Fix `intent`: persist onto the history entry on commit; render in `RevisionHistory` and in the undo toast.
- [ ] "Agent is working" header indicator naming the tool in plain language while a call is in flight.
- [ ] Per-batch toast carrying `intent` + a single Undo (already one history step).
- [ ] Brief outline on agent-touched components in both the plan and the 3D scene.
- [ ] Rewrite the starter prompt in `webmcp-controller.ts` around the new surface (it currently teaches only preview/apply).
- [ ] Deep links: `#/stage/fit-out?view=split&select=fryer-1`.
- [ ] Extend `public/llms.txt` with the full tool list and a worked example.
- [ ] Publish the complete error-code taxonomy with a recovery string per code in `get_workspace_guide` (only 3 codes have hints today, in `applyRecoveryHint`).

## Phase 7 — Verification (2d)

- [ ] **Conformance suite (new):** every tool returns `{content:[{type:'text',text}]}` with parseable JSON + `structuredContent` + correct `isError`; every `inputSchema` is valid JSON Schema with `additionalProperties:false` and complete `required`; annotation keys ⊆ `{readOnlyHint, untrustedContentHint}`; description/manifest byte budgets; fuzz every schema and assert no tool throws; no `readOnlyHint` tool changes the revision.
- [ ] **Agent journey test (new):** fake `document.modelContext` driven through guide → catalog → draw 4×6m room → place 8 items → analyze → fix → essentials → 5-item menu → run simulation → compare → export. Assert final project **and** app state, and **assert the journey completes in ≤15 tool calls** (the metric to optimise).
- [ ] **E2E (`e2e/webmcp.spec.ts`):** assert the UI reflects each agent action (`data-app-stage`, active 3D surface, inspector selection, playback running); a mid-simulation cancellation test; a stale-revision test that mutates through the UI between preview and apply.
- [ ] **Manual:** real Chrome 149+ with the live token on the production domain, two different agent clients, a project built from scratch (not the seed). Record it.

## Effort

18 working days, phases 3 and 4 overlapping. Phases 1–2 alone (one week) move the project from "will not work in a real browser" to "an agent can genuinely drive the app".

## Risks

| Risk | Mitigation |
| --- | --- |
| Origin-trial token expires mid-judging | Track expiry in-repo; panel distinguishes "token expired" from "browser unsupported" |
| Result-shape contract shifts (structured output is still unresolved in the spec) | Return string content **and** `structuredContent`; conversion lives in one function |
| Schema v4 breaks saved projects | Optional field + no-op migration + v3 fixture round-trip test with fixed seed |
| Simulation results leak memory | One run per key or LRU of 3; drop `frames` for non-active runs |
| 24 tools degrade agent tool selection | Consolidate optional fields onto fewer tools; enforce description budget; track tool-call count on the canonical journey as a regression metric |
| Prompt injection via imported project labels/notes | `untrustedContentHint` on every tool echoing project text; all mutations stay behind the revision guard as visible, undoable batches |
