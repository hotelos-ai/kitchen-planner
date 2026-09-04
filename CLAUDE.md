# Competition Submission Freeze

The WebMCP Challenge submission freeze begins at **4:00 PM GMT+8 on 4 September 2026** (08:00 UTC / 04:00 EDT), matching the extended [Devpost deadline](https://webmcp.devpost.com/).

Until that time, competition-submission updates may be pushed and deployed when explicitly requested by the repository owner. At and after that time, this repository and the production app at `planner.kitchen.hotelos.ai` are frozen.

## Mandatory restrictions at and after the freeze

- **Never push this repository to GitHub or any other public remote.** Treat `github.com/hotelos-ai/kitchen-planner` and its `origin` remote as read-only.
- **Never deploy, redeploy, roll back, delete, or otherwise modify the Cloudflare Worker named `planner` or the production domain `planner.kitchen.hotelos.ai`.**
- Never run `git push`, create or merge a public pull request, publish a release or tag, trigger a publishing workflow, run `npm run deploy`, or run any mutating Wrangler deployment/version command for this project.
- Local development, local edits, local commits, builds, tests, and read-only inspection are allowed.
- If a task would require a push or production change, stop before the remote action, keep any work local, and report that the competition submission is frozen.

These restrictions take effect at the freeze time above and remain in force until the repository owner deliberately removes or updates the freeze in both `AGENTS.md` and `CLAUDE.md`.
