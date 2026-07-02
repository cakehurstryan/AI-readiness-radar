# AI Readiness Radar

An interactive diagnostic tool for scoring whether an engineering team's
foundations can support AI-assisted development. AI doesn't fix a
dysfunctional team, it exposes it — this tool helps you find the cracks
before you hand out agents.

Score your team across five signals, see the results on a radar chart,
and compare against common team archetypes.

## Signals

- **Context & understanding** — does the team know what "good enough" means?
- **Codified standards** — is what "good" looks like actually written down?
- **Feedback loops** — does the pipeline catch failures before a customer does?
- **Trusted reviews** — do reviews catch real issues, or are they rubber-stamped?
- **Quality ownership** — is quality a whole-team concern, or thrown over the wall?

Each signal is scored 1–4 (No maturity → Low → Moderate → High), with
detailed descriptions for each band to keep scoring honest and consistent.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://localhost:5173`).

## Scripts

- `npm run dev` — start the local dev server
- `npm run build` — build for production into `dist/`
- `npm run preview` — preview the production build locally

## Stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Recharts](https://recharts.org/) for the radar chart

## Usage

Run it as a team exercise: score each signal individually, plot the
results together, and where scores disagree, go with the lowest one.
This sits underneath frameworks like DORA, TMMi, or Team Topologies —
it's a conversation starter, not a replacement for them.

Framework by Callum Akehurst-Ryan · [cakehurstryan.com](https://cakehurstryan.com)
