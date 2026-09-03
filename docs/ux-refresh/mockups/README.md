# CalmKitchen Designer — Notebook mockups

High-fidelity HTML mockups for the CalmKitchen Designer UX refresh, themed with
the HotelOS Notebook design language (tokens from calm-kitchen). Open
`index.html` first — it presents the design language and links every screen.

Serve locally (the pages load Google Fonts, so use http, not file://):

```bash
cd docs/ux-refresh/mockups && python3 -m http.server 4173
# open http://localhost:4173/
```

| File | Screen |
|---|---|
| `index.html` | Design language — palette, type, components, principles |
| `plan-editor.html` | Equipment stage · plan editor (exemplar screen) |
| `3d-view.html` | 3D inspect · floating view cluster, walk CTA |
| `simulate.html` | Simulate · running service, HUD, playback, findings |
| `autolayout.html` | Auto-layout wizard · goal → constraints → results |
| `space.html` | Space stage · room outline editing |
| `compare.html` | Compare overlay · baseline vs candidate |

`studio.css` is the shared design system — every mockup consumes the same
tokens and primitives. Unicode glyphs stand in for icon slots; production
implementation uses an SVG icon set (Phosphor or Lucide).
