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

CalmKitchen is a React/TypeScript browser application deployed as static assets on Cloudflare Workers. It registers 26 strict-schema tools through `document.modelContext` and falls back to the legacy navigator surface. Tool results use interoperable MCP text and structured content with explicit error flags and a 256 KiB cap. Registration retries transient failures, reconciles unexpected tool removal, and restores across back/forward cache navigation. Project writes pass through the same Zod-validated workspace facade as human edits, use optimistic revision checks, and produce one labeled, undoable history step. High-cover simulation runs move off the UI thread into an abortable Web Worker while preserving the exact deterministic result shared by the app and agent. A stable error taxonomy supplies recovery guidance, and self-contained reports carry assumptions, metrics, station evidence, ranked findings, and the SVG plan.

## Recommended 90-second native-agent demo

Record this in a clean, natively supported ChatGPT Site Tools session or Chrome WebMCP client. Do not use the deterministic Playwright recording harness as evidence of external agent selection.

Use this prompt:

> Use this page's site tools to improve the current commercial kitchen for a 90-cover dinner service. First identify the main bottleneck. Create a safer, faster candidate while preserving aisle clearance. Simulate the baseline and candidate with the same seed, compare them, and show the winning layout in split 2D/3D view. Do not commit a change without previewing it.

### 0:00–0:10 — Outcome first

Show the unobstructed before/after comparison and say: “A browser agent redesigned this 90-cover kitchen and reduced P90 ticket wait from X to Y while preserving a Z millimetre minimum aisle.” Add overlays for P90 wait, staff travel distance, and service-level attainment.

### 0:10–0:18 — Native discovery

Briefly show **Site Tools → Available site tools** in the actual agent client. Keep the prompt and tool-call trace legible.

### 0:18–0:45 — Shared visible editing

Show the natural-language prompt, the agent reading layout state, analyzing the bottleneck, previewing the operation batch, and applying the approved revision. Show the same selected equipment in Plan and 3D, plus the Agent entry in Revision History.

### 0:45–1:05 — Operational evidence

Run baseline and candidate simulations with the same scenario and seed. Show service playback only long enough to establish that it is live, then return to the comparison.

### 1:05–1:22 — Quantified comparison

Close the AI tools drawer. Show both metric columns and the three deltas without obstruction. State one preserved constraint and one operational limitation/assumption.

### 1:22–1:30 — Recovery and close

Show undo or a named checkpoint. Say: “CalmKitchen lets agents inspect, change, simulate, verify, and recover in one shared browser workspace.”

## Recording checklist

- Record at 1080p or higher with legible browser zoom and audible narration.
- Keep the final public YouTube video below three minutes.
- Demonstrate actual WebMCP calls and visible workspace reactions, not a slide-only explanation.
- Include the deployed URL and public repository URL in the video description.
- Avoid claiming regulatory certification; call simulations planning evidence, not observed facts.

## Testing instructions

Open <https://planner.kitchen.hotelos.ai/> in the ChatGPT desktop app's built-in browser with an account that has Site tools access. Approve website access, then use the address-bar arrow to inspect the available tools. Alternatively, for local Chrome development, enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome. Select **Use your AI agent** and verify that the panel says **Agent tools active** with 26 registered tools. Copy its starter prompt, then ask the agent to inspect the workspace and make one previewed change. The deployment deliberately does not ship an Origin-Trial token; ChatGPT desktop is the supported user path and the Chrome flag is the explicit developer test path. The project began on 31 August 2026 during the submission period; the first WebMCP implementation landed in commit `ebd3758`.

## Submission checklist

- Working public app: <https://planner.kitchen.hotelos.ai/>
- Public source repository: <https://github.com/hotelos-ai/kitchen-planner>
- MIT license visible at repository root and in repository metadata/About.
- Public YouTube demo shorter than three minutes with audio.
- Paste the description above and cover WebMCP fit, user experience, human-agent collaboration, and implementation.
- Verify an anonymous/incognito visitor can open both app and repository.
