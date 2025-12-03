# Frontend (Next.js)

Production-ready Next.js 14 app for real-time multi-pass text refinement, results, diffing, batch results, and analytics.

## Stack
- Next.js 14 (App Router)
- React, TypeScript
- shadcn/ui

## Environment
- `NEXT_PUBLIC_REFINER_BACKEND_URL` (e.g., `http://localhost:8000`)
- `NEXT_PUBLIC_REFINER_BACKEND_WS_URL` (optional WebSocket base, e.g., `ws://localhost:8000`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (optional; Stripe init is guarded)

## Install & Run
```bash
pnpm install   # or npm install
yarn dev || pnpm dev || npm run dev
```
Open `http://localhost:3000`.

## Build & Start
```bash
pnpm build
pnpm start
```

## Streaming (SSE)
- All refinement is streamed via SSE through the Next.js route: `app/api/refine/run/route.ts`.
- Required headers set: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- Runtime flags: `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'` to prevent buffering.
- The client (`lib/refiner-client.ts`) parses SSE, handles terminal markers, and strips any accidental double `data:` prefix.

## Key Commands
- Start refinement: UI in `components/processing-controls.tsx` → calls `refinerClient.startRefinement()`
- Download: `components/results-viewer.tsx` → `/api/files/download`
- Diff: `components/diff-viewer.tsx` uses `refinerClient.getDiff()`

## Contexts
- `contexts/ProcessingContext.tsx` — global processing state & event log
- `contexts/SchemaContext.tsx` — schema levels across UI
- `contexts/AnalyticsContext.tsx` — analytics fetch and memoized presentation

## Important Components
- `processing-controls.tsx` — start/stop, schema integration
- `results-viewer.tsx` — real-time results, download, metrics
- `diff-viewer.tsx` — choose file/passes, fetch and show diffs
- `batch-results.tsx` — merges API job data with event stream
- `progress-tracker.tsx` — per-pass stage progression

## API Proxy
- All backend calls route through `/api/*` Next routes to avoid CORS and preserve headers.

## Security/Privacy
- Verbose console logs removed in production code to avoid leaking sensitive data.

## Troubleshooting
- Only `stream_end` arrives: verify proxy headers/runtime; ensure `X-Accel-Buffering: no` set.
- Missing `pass_complete`: ensure backend yields per-pass events; confirm client doesn’t early-return on terminal markers.
- Double `data:`: proxy should not wrap; client strips defensively.

## Testing
- Use browser DevTools to confirm SSE frames under Network → refine/run → EventStream.
