# WebMCP Spatial Agent Tools Design

**Date:** 2026-09-01  
**Status:** Approved

## Purpose

Add WebMCP site tools to the spatial-layout application so a person can give an image, written instruction, or other reference material to their own compatible AI agent and have that agent construct, inspect, and repeatedly refine the shared canvas. Follow-up requests such as "move the fryer beside the range," "make this counter 20 cm deeper," or "try the alternative with a wider aisle" must translate into validated changes on the live drawing. The application does not ingest, upload, store, or interpret reference images or natural-language instructions. The external agent performs that interpretation. This application supplies the live spatial document, component catalog, validated editing operations, diagnostics, 3D/first-person environment, and configurable operational simulation.

The first product remains Manta Raja Kitchen Lab, but the WebMCP boundary must describe generic spatial components and capabilities. Kitchen equipment, commercial-kitchen diagnostics, and service simulation are domain modules behind that boundary rather than assumptions embedded in the protocol adapter.

## User Experience

The application adds an **AI tools** entry in the top-level interface. Its panel explains whether WebMCP is available in the current browser, what the site exposes, how reference images are handled, and how to start.

The panel contains a copyable starter prompt along these lines:

> Inspect my attached reference image. Use this page's site tools to understand its coordinate system and component catalog. Read the current layout before editing. Translate visible measurements and objects into spatial components, preview the complete change set, apply it, then inspect diagnostics and the updated page. Ask me about dimensions you cannot infer safely. The site does not receive or process the image; you do.

The panel also shows the registered tool names and a small recent-activity feed. Activity entries show the tool, status, time, resulting revision, and a concise human-readable result without exposing hidden agent reasoning or sensitive arguments.

When site tools are unavailable, the application stays fully usable and presents concise setup guidance instead of treating the missing experimental API as an error.

## Agent Workflow

The intended workflow is:

1. The user opens the live application in a compatible browser and attaches a reference image to their AI conversation.
2. The agent calls `get_workspace_guide` to learn the coordinate system, units, revision rules, supported workflow, and application limitations.
3. The agent calls `get_component_catalog` and `get_layout` to understand available component types and current state.
4. The agent converts its own interpretation of the image into explicit millimetre coordinates, dimensions, rotations, and stable component identifiers.
5. The agent calls `preview_layout_changes` with the current revision and a complete batch.
6. If validation succeeds, the agent calls `apply_layout_changes` with the preview token.
7. The shared canvas updates immediately. The agent calls `analyze_layout` and inspects the page to verify the result.
8. Whenever the user asks for another drawing change, the agent rereads the current revision, previews the requested delta, applies it, and verifies the affected components. It does not need to reconstruct the whole project.
9. If operational questions matter, the agent reads `get_simulation_guide`, previews and applies any requested scenario-parameter changes, runs the scenario, and reports assumptions and results separately from measured geometry.

The guide tells agents not to invent exact measurements when a reference has no trustworthy scale. An agent should preserve uncertainty in component metadata and ask the user when an ambiguity materially affects the layout.

## Architecture

### Layers

The implementation has four layers:

1. **Spatial core:** existing serializable spatial types, command schemas, queries, revisions, diagnostics, persistence, and simulation services.
2. **Agent application facade:** domain-neutral workflow operations for reading capabilities, previewing atomic batches, applying a reviewed batch, analyzing a layout, and running simulations.
3. **WebMCP adapter:** feature detection, JSON Schema tool definitions, top-level tool registration, structured tool results, lifecycle cleanup, and activity events.
4. **React presentation:** the AI tools panel and a small provider component that connects the browser adapter to the application facade.

The WebMCP adapter does not import React, Zustand, Konva, React Three Fiber, or Three.js. It receives a facade through dependency injection. The React provider performs the composition at the application edge.

### Shared state

Human gestures and WebMCP calls use the same application service and project store. Tool-driven changes therefore participate in validation, persistence, history, revision tracking, diagnostics, and incremental 2D/3D rendering. WebMCP never modifies canvas nodes or scene meshes directly.

Each applied batch creates one history entry and one new revision. Unchanged item identities remain stable, so a tool-driven move updates the relevant component without remounting the renderer or resetting the 3D camera.

### Domain capability manifest

A capability manifest supplies:

- workspace kind and display name;
- coordinate and unit conventions;
- component catalog entries;
- supported categories and capabilities;
- domain-specific guide text;
- diagnostic capabilities;
- simulation capabilities and assumptions.

The initial manifest describes commercial-kitchen components. Future environments can supply a different manifest and spatial adapter without changing tool registration or workflow schemas.

## WebMCP Tool Contract

Tools are registered from the top-level page with `document.modelContext.registerTool`. Registration is conditional and does not affect browsers without WebMCP. Tool input schemas are strict JSON Schema objects with `additionalProperties: false` at every controlled boundary.

### `get_workspace_guide`

Read-only. Returns:

- workspace identity and domain;
- current document revision;
- coordinate origin and axis directions;
- canonical storage unit and supported display units;
- room boundary summary;
- reference-image responsibility statement;
- recommended read, preview, apply, verify sequence;
- uncertainty and measurement guidance;
- available tool names and operation kinds;
- WebMCP and simulation limitations.

### `get_layout`

Read-only. Accepts an optional view (`summary`, `architecture`, `components`, `full`), optional component IDs, category, and tag filters. Returns the requested cloned data, active variant, revision, and relevant uncertainty metadata. It never returns mutable store references.

### `get_component_catalog`

Read-only. Accepts optional category and capability filters. Returns catalog entries with stable type identifiers, labels, categories, default/minimum dimensions, supported capabilities, suggested clearances, and the input fields required to add an instance. Custom components remain available through an explicit generic catalog entry.

### `analyze_layout`

Read-only. Returns structured boundary, overlap, clearance, circulation, and domain findings for the current revision. Findings contain stable codes, severity, affected IDs, evidence, and remediation text. It does not claim regulatory certification.

### `preview_layout_changes`

Read-only from the page-state perspective. Accepts:

- `expectedRevision`;
- a non-empty ordered array of supported layout operations;
- an optional human-readable intent.

The facade executes the full batch against an isolated working document. If any operation fails, the whole preview fails with an operation index, stable error code, current revision, and no persisted mutation. A successful result returns:

- normalized operations;
- changed IDs;
- warnings and diagnostics delta;
- a concise before/after summary;
- the unchanged current revision;
- a short-lived, single-use preview token bound to the exact normalized batch and revision.

Preview tokens live only in page memory, expire after ten minutes, and are invalidated when the document revision changes. Tokens are opaque and generated with browser cryptographic randomness.

### `apply_layout_changes`

Mutating. Accepts a valid preview token only. It revalidates the token, revision, and normalized operations, then commits the complete batch as one transaction, one undo step, and one revision increment. It returns the new revision, changed IDs, warnings, diagnostics delta, and a verification summary. The token is consumed on success.

This preview requirement applies to every batch, keeping a single predictable workflow for creation, movement, resizing, metadata changes, deletion, and architecture changes. Common changes still feel immediate because preview and apply are consecutive agent calls.

Project replacement is not exposed in the first WebMCP contract. An agent constructs or revises a document through explicit spatial operations, avoiding a broad overwrite primitive.

### `get_simulation_guide`

Read-only. Returns available scenarios, the active scenario and current revision, editable parameter schemas, staff roles, station capabilities, result definitions, and a reminder that simulated values are assumptions rather than observed service data.

Editable scenario parameters include:

- name;
- covers;
- duration in minutes;
- arrival pattern (`seating-wave`, `steady`, or `two-waves`);
- cook-to-order ratio;
- deterministic random seed;
- staff counts by supported role;
- collision, door-swing, and dirty/clean-crossing checks;
- per-capability task-duration ranges;
- per-station capacities.

### `preview_simulation_changes`

Read-only from the page-state perspective. Accepts a scenario ID, current expected revision, and a strict partial parameter patch. It validates the complete resulting scenario, including cross-field constraints such as task-duration minimums not exceeding maximums. A successful preview returns the normalized scenario, changed parameter names, warnings, an assumptions delta, the unchanged revision, and a short-lived preview token bound to that scenario and revision.

### `apply_simulation_changes`

Mutating. Accepts a valid simulation preview token. It rechecks the token and revision, then commits the normalized scenario as one history entry and one revision increment. The result includes the new revision, changed parameters, normalized assumptions, and a warning that any result from an older layout or scenario revision is stale. The token is single-use and follows the same expiry and invalidation rules as a layout preview token.

### `run_simulation`

Computational but non-mutating for document revision. Accepts a scenario ID, current expected revision, an optional elapsed-time snapshot, and a presentation mode:

- `results-only` runs deterministically and returns the report without changing the current workspace view;
- `open-live-simulation` also opens the shared simulation workspace, loads the run at time zero, and starts visible playback using an optional validated playback speed.

The result returns scenario assumptions, aggregate metrics, queues, backlog, throughput, wait times, warnings, and recommendations. It identifies the exact layout and scenario revision used so agents cannot present stale results as current. An agent-triggered live run uses the same simulation session and chef animation as a human-triggered run; it does not create a second hidden simulation engine.

## Spatial Operations

The batch facade accepts a discriminated union based on the existing command surface:

- add a catalog or custom component;
- move one or more components to an absolute anchor;
- nudge one or more components by a delta;
- rotate one or more components;
- resize one component;
- update safe component metadata and capabilities;
- duplicate a component;
- remove exact component IDs;
- set display unit or snap interval;
- update validated architecture fields;
- create, duplicate, activate, rename, or remove variants.

Agent-friendly add operations accept a catalog type plus placement and overrides. The domain manifest resolves that request to a complete validated spatial item with a stable generated ID. The adapter never accepts executable code, DOM selectors, arbitrary property paths, or unbounded merge patches.

Dimensions and coordinates are canonical millimetres at the tool boundary. Display units are metadata for people; agents may read conversion guidance but do not send locale-formatted length strings.

## Atomic Batch Execution

The existing pure command executor remains the primitive. A new batch executor applies ordered commands to an isolated project envelope, feeding each successful result into the next operation. It accumulates changed IDs and warnings while retaining the original input document.

On failure it returns the original envelope and exact failing operation. On success it produces a candidate project but does not assign multiple revisions. Preview returns the candidate summary without persistence. Apply commits the candidate once through a dedicated store transaction, producing one revision and one undo checkpoint.

Catalog adds are normalized before execution so preview and apply use identical component IDs and payloads. The preview token binds to this normalized form.

## Browser Registration Lifecycle

The adapter augments local TypeScript declarations for the proposed browser API instead of adding a runtime polyfill. It:

1. checks that `document.modelContext.registerTool` is callable;
2. registers all supported tools from a declarative definition array;
3. records registration success or failure per tool;
4. unregisters tools during teardown when the browser API provides an unregister mechanism;
5. tolerates React Strict Mode's development mount cycle without duplicate active registrations;
6. converts thrown errors into stable JSON-safe error results;
7. emits activity events for the UI without logging full sensitive inputs.

Tools are not registered in iframes. The application does not add a network MCP server, API key, model dependency, image endpoint, or AI inference dependency.

## Error Handling and Concurrency

Every result is JSON-safe and includes `ok` and `revision`. Failures also include a stable `code`, concise `message`, and structured details when useful.

Important errors include:

- `webmcp-unavailable`;
- `invalid-input`;
- `stale-revision`;
- `missing-component`;
- `locked-component`;
- `outside-boundary`;
- `invalid-preview-token`;
- `expired-preview-token`;
- `preview-revision-changed`;
- `batch-operation-failed`;
- `missing-scenario`;
- `stale-simulation`.

Expected revisions make concurrent human and agent edits explicit. An agent receiving `stale-revision` must read the current layout again and recompute its intended change instead of retrying blindly.

Conversational instructions never bypass this rule. The external agent translates each user request into explicit operations or parameter patches, and the application reports exactly what changed. The agent must not treat a prior natural-language instruction as authority to overwrite newer human edits.

## Security and Privacy

- Reference images stay with the user's chosen agent and are never accepted by these tools.
- Existing application validation and permissions remain authoritative.
- Tool descriptions state side effects accurately and use read-only annotations where applicable.
- The adapter returns only data from the open page's project and never requests unrelated conversation, browser, or file data.
- Activity records omit complete arguments and expire with the page session.
- Preview tokens are scoped to one live page, revision, and normalized batch.
- Unsupported or malicious fields fail closed.
- WebMCP registration adds no server endpoint and does not make the application remotely controllable when its page is closed.

## React Components

### `WebMcpProvider`

Mounted once near the application root. It creates the application facade, registers site tools, owns the registration lifecycle, and publishes lightweight status/activity state through a focused context. It does not subscribe the full application tree to project changes.

Tool handlers read the current store state at invocation time. This prevents stale React closures and avoids re-registering tools after every edit.

### `AgentToolsPanel`

Opened from the top bar. It renders:

- available/unavailable/partial registration status;
- the reference-image responsibility statement;
- copyable starter prompt;
- coordinate and unit summary;
- registered tool list with read/write labels;
- explicit examples of conversational drawing edits and simulation-parameter changes;
- recent activity;
- troubleshooting guidance for unsupported browsers.

The panel is keyboard accessible, works without WebGL, and does not block the existing editor or simulation views.

## Testing Strategy

### Unit and contract tests

- JSON Schemas reject extra or malformed fields.
- Tool definitions have unique stable names, descriptions, annotations, and callable handlers.
- The workspace guide accurately describes coordinates, units, tools, image responsibility, and workflow.
- Catalog filters and add normalization are deterministic.
- Multi-operation previews are atomic and leave the store unchanged.
- Applies require a matching live token and create one revision and one undo entry.
- Tokens are single-use, revision-bound, batch-bound, and time-limited.
- Batch failure reports the failing index and preserves original state.
- Follow-up drawing requests modify only the targeted components and retain unrelated stable IDs.
- Simulation patches validate every supported parameter, preview without mutation, and apply as one undoable revision.
- Applying scenario parameters invalidates older simulation results.
- Agent-triggered runs use the updated scenario and can publish the same live playback session used by the simulation workspace.
- Query results are cloned and JSON-safe.
- Unsupported browser detection is a normal state.
- Strict Mode registration does not leave duplicate tools.

### Integration tests

A fake `document.modelContext` captures registrations and invokes handlers against a real application store. Tests prove that agent operations and UI operations produce equivalent validated documents, persistence-compatible state, diagnostics, and simulation inputs.

### Browser tests

Playwright injects a WebMCP shim before application startup and verifies:

- all tools are discoverable on the top-level page;
- the AI tools panel reports availability and copies usable guidance;
- an agent can read the workspace, preview a multi-component layout, apply it, and read the new revision;
- an agent can respond to a follow-up user instruction by moving, resizing, rotating, adding, updating, or removing exact components without rebuilding unrelated drawing state;
- the 2D canvas updates without a reload;
- the persistent 3D renderer and camera survive tool-driven component edits;
- an agent can preview and apply simulation parameters, run the revised scenario, and open visible chef playback in the shared simulation workspace;
- stale writes and replayed preview tokens fail visibly and safely;
- a browser without WebMCP retains the complete human interface.

The final verification gate runs unit tests, lint, production build, and the full browser suite.

## Acceptance Criteria

1. Compatible agents can discover the WebMCP tools from the open top-level page.
2. The app clearly tells agents and people that the external agent—not this application—processes reference images.
3. An agent can learn the coordinate system and catalog, read the current layout, translate both initial and follow-up user instructions into exact drawing changes, preview and apply those changes atomically, and verify diagnostics.
4. Tool-driven edits update the existing live 2D, 3D, walk, and simulation environment through the shared store without page reloads or renderer resets.
5. Every mutation is validated, revision-safe, previewed, one-step undoable, and returns enough structured information to verify the outcome.
6. An agent can read, preview, and update validated simulation parameters; run the resulting current-revision scenario; receive assumptions, queues, backlog, throughput, and wait-time results; and optionally open the shared animated simulation for the user.
7. Browsers without WebMCP remain fully functional and receive useful setup guidance.
8. The browser adapter and tool schemas are domain-neutral; kitchen behavior is supplied through a replaceable capability manifest.
9. No image-processing service, model call, API key, server-side MCP endpoint, or hidden remote control channel is introduced.
10. Automated tests cover discovery, schemas, atomicity, concurrency, conversational follow-up edits, canvas synchronization, 3D persistence, simulation parameter updates, agent-triggered live playback, fallback, and accessibility-relevant panel behavior.

## Source Guidance

The implementation follows OpenAI's current Site Tools documentation: register JavaScript tools in the top-level page, feature-detect `document.modelContext`, keep inputs narrow, describe side effects, return verifiable results, and preserve the ordinary interface for unsupported browsers. Current built-in-browser support does not discover declarative form tools or tools inside iframes, so neither mechanism is used.
