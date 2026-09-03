# Submission demo

`calmkitchen-webmcp-demo.mp4` is an 83-second, narrated 1440×900 walkthrough recorded against the production app. It shows real WebMCP registration and calls for discovery, preview/apply, shared 2D/3D selection, simulation, comparison, and sharing.

Devpost-ready stills are included alongside it:

- `01-agent-tools.jpg` — live 26-tool WebMCP registry
- `02-agent-revision.jpg` — shared selected component in Plan and 3D
- `03-simulation.jpg` — retained deterministic service playback
- `04-comparison.jpg` — same-scenario layout comparison and handoff

## Suggested YouTube metadata

**Title:** CalmKitchen Designer — Human + AI commercial kitchen design with WebMCP

**Description:**

> CalmKitchen Designer turns a professional spatial canvas into a shared instrument for people and AI agents. Its 26 typed WebMCP tools expose exact geometry, atomic revision-guarded edits, retained deterministic simulation, layout comparison, and portable handoff—all visibly and reversibly.
>
> Live app: https://planner.kitchen.hotelos.ai/
> Source: https://github.com/hotelos-ai/kitchen-planner

Set visibility to **Public**, confirm narration is audible, and verify the final runtime remains below three minutes before adding the YouTube URL to Devpost.

## Regenerate

```bash
node scripts/record-submission-demo.mjs
say -v Samantha -r 160 -f artifacts/demo/narration.txt -o artifacts/demo/narration.aiff
ffmpeg -y \
  -i artifacts/demo/calmkitchen-webmcp-demo.webm \
  -i artifacts/demo/narration.aiff \
  -filter:a "atempo=1.14,afade=t=in:st=0:d=0.4,afade=t=out:st=81.8:d=1.2" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  artifacts/demo/calmkitchen-webmcp-demo.mp4
```
