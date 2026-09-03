# CalmKitchen Designer — Devpost submission kit

## One-line pitch

CalmKitchen is an agent-native commercial-kitchen design studio where people set intent and judgment while WebMCP agents read exact geometry, make safe visible edits, compare alternatives, and pressure-test service operations in the same live workspace.

## Short description

Commercial-kitchen planning normally scatters sketches, equipment lists, CAD, operational assumptions, and consultant feedback across disconnected tools. CalmKitchen makes that workflow collaborative: a person can show an agent a sketch or describe a service goal, and the agent can use 26 structured WebMCP tools to inspect the exact millimetre model, create atomic layout changes, focus the shared canvas, run deterministic service simulations, compare alternatives, and return a portable report. Every persistent edit is schema-validated, revision-guarded, visible, undoable, and optionally previewed before commit.

## Why WebMCP is essential

A kitchen layout is too precise for screenshot clicking and too visual for a headless API. WebMCP gives the agent stable component identities, canonical coordinates, strict operations, retained simulation evidence, and direct control of the exact workspace the user is watching. The user contributes goals, reference imagery, constraints, and final judgment; the agent contributes translation, exhaustive checking, fast iteration, and evidence synthesis. Neither side has to maintain a second copy of the design.

## What people and agents can do together

- Translate an attached sketch into explicit room geometry and equipment without uploading that image to CalmKitchen.
- Preview and atomically apply up to 200 operations, or use an idempotent direct batch that cannot accidentally apply twice.
- Navigate Plan, 3D, Walk, Compare, and Simulate; select changed equipment and focus the camera on the discussion point.
- Find boundary, overlap, pillar, clearance, capacity, workflow, and professional-review issues.
- Model weighted menu items as deterministic task chains, then retain and inspect one exact service run instead of recomputing conflicting results.
- Compare layout variants under the same random seed or launch a cancellable, revision-bound auto-layout experiment and adopt only a confirmed finalist.
- Export validated JSON, an equipment CSV, SVG floor plan, or a self-contained HTML planning report; share the exact workspace state with a deep link.

## Implementation summary

CalmKitchen is a React/TypeScript browser application deployed as static assets on Cloudflare Workers. It registers 26 strict-schema tools through `document.modelContext` and falls back to the legacy navigator surface. Tool results use interoperable MCP text and structured content with explicit error flags and a 256 KiB cap. Registration retries transient failures, reconciles unexpected tool removal, and restores across back/forward cache navigation. Project writes pass through the same Zod-validated workspace facade as human edits, use optimistic revision checks, and produce one undo step. Simulation and optimization use deterministic seeds so agents and people see reproducible evidence.

## Three-minute demo script

### 0:00–0:20 — Problem and product

Show the finished 2D/3D workspace. Say: “A kitchen is both a spatial design and a live operating system. Today those decisions are split across sketches, CAD, spreadsheets, and intuition. CalmKitchen lets a person and their agent design and test one exact model together.”

### 0:20–0:45 — Prove WebMCP depth

Open **AI tools**. Show the registered-tool count and live activity. Ask the agent to call `get_workspace_guide`, `get_app_state`, and `get_layout`. Briefly show exact millimetres, stable IDs, current revision, and strict schemas.

### 0:45–1:20 — Shared visible editing

Prompt: “Create a prep table beside the cold line, keep the aisle clear, and show me the change in 3D.” The agent should use placement guidance, preview/apply, selection, and camera focus. Show the selected item, agent intent toast, and one-click Undo. Emphasize that the user never leaves the shared canvas.

### 1:20–1:55 — Operational intelligence

Ask: “Check this plan for a 90-cover dinner and run the service.” Show operational essentials, live Simulate playback, station queues, chef movement, throughput, and warnings. Point out that the exact retained run is available to both UI and agent.

### 1:55–2:25 — Alternatives, not a chatbot answer

Ask the agent to compare the baseline with the candidate under the same seed, or launch auto-layout and poll it. Show ranked evidence and adopt a confirmed finalist. Say: “The agent cannot silently overwrite a changed plan; experiments are revision-bound, cancellable, and adoption is one undoable edit.”

### 2:25–2:50 — Handoff

Ask for a shareable result. Show the deep link and open/download the self-contained HTML report with assumptions, SVG plan, equipment schedule, metrics, and professional disclaimer.

### 2:50–3:00 — Close

Say: “WebMCP turns a complex professional canvas into a trustworthy shared instrument—humans provide judgment, agents provide precision and speed, and every important action stays visible and reversible.”

## Recording checklist

- Record at 1080p or higher with legible browser zoom and audible narration.
- Keep the final public YouTube video below three minutes.
- Demonstrate actual WebMCP calls and visible workspace reactions, not a slide-only explanation.
- Include the deployed URL and public repository URL in the video description.
- Avoid claiming regulatory certification; call simulations planning evidence, not observed facts.

## Submission checklist

- Working public app: <https://planner.kitchen.hotelos.ai/>
- Public source repository: <https://github.com/hotelos-ai/kitchen-planner>
- MIT license visible at repository root and in repository metadata/About.
- Public YouTube demo shorter than three minutes with audio.
- Paste the description above and cover WebMCP fit, user experience, human-agent collaboration, and implementation.
- Verify an anonymous/incognito visitor can open both app and repository.

