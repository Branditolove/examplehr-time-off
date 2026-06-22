# ExampleHR — Time-Off

Time-off requests for ExampleHR, where the HCM (not this app) owns the balances. See
[TRD.md](./TRD.md) for the full reasoning behind every decision below — this README is just
how to run things.

## Stack

Next.js (App Router) · TanStack Query · Zustand (form-draft state only) · Tailwind ·
Storybook · Vitest (+ Testing Library, Playwright)

## Requirements

- Node.js 18.18+ (Next.js 16 requirement)
- npm

## Installation

```bash
npm install
```

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Two views are available:

- `/employee` — per-location balances + time-off request form (fixed employee: `emp-1`, no auth)
- `/manager` — pending requests with approve/deny actions

The mock HCM lives in `src/app/api/hcm/*` (real Next.js route handlers) and persists its
state in a local `.hcm-store.json` file at the project root (gitignored). Delete it or restart
the server to reset to the seeded state:

| Endpoint | What it does |
|---|---|
| `GET /api/hcm/balance?employeeId=&locationId=` | Real-time read of a single balance |
| `POST /api/hcm/balance` | Admin write of a balance |
| `GET /api/hcm/balances/batch?employeeId=` | Full corpus (for initial hydration) |
| `GET\|POST /api/hcm/request` | List requests / submit a time-off request |
| `PATCH /api/hcm/request/:id` | Approve or deny |
| `POST /api/hcm/anniversary` | Manual trigger for the anniversary bonus |

Any write endpoint accepts `force: "insufficient" | "silent-failure" | "none"` in the request
body to force a specific scenario (used by integration tests). Without `force`, there is a ~15%
chance of a real silent failure, so the behavior can be explored manually from the browser.

## Storybook

```bash
npm run storybook
```

Opens [http://localhost:6006](http://localhost:6006). Covers all 10 required UI states:
`loading`, `empty`, `stale`, `optimistic-pending`, `optimistic-rolled-back`, `HCM-rejected`,
`HCM-silently-wrong`, `balance-refreshed-mid-session`, `manager-approval-with-stale-balance`,
`insufficient-balance`.

Static build (for deploying to Vercel/Chromatic):

```bash
npm run build-storybook
```

## Tests

Three layers (see TRD §8 for what regression each one prevents):

```bash
npm run test             # component tests + store unit tests (Vitest + RTL, fetch mocked)
npm run test:storybook   # Storybook interaction tests (browser mode, Playwright)
npm run test:all         # both suites above
npm run test:coverage    # with coverage report (v8)
```

Integration tests (`src/app/api/hcm/integration.test.js`) call the real route handlers
with nothing mocked — they run inside `npm run test`.

Current coverage (`npm run test:coverage`): ~93% lines, ~86% statements.

## Production build

```bash
npm run build
npm run start
```

## Relevant structure

```
src/
  app/
    api/hcm/         # mock HCM (route handlers)
    employee/        # Employee view
    manager/         # Manager view
  components/
    employee/        # BalanceCard, RequestFeedback, TimeOffRequestForm, ...
    manager/         # BalanceContext, ApproveDenyButtons, RequestRow, ...
  hooks/             # useBalance, useSubmitTimeOffRequest, useDecideRequest, ...
  lib/hcm/           # store.js (disk-persisted mock HCM) + client.js (fetch wrapper)
  store/             # Zustand: form draft + balance integrity
TRD.md               # full technical requirements document
```

## Notes

- No authentication: `src/lib/currentUser.js` fixes a demo employee (`emp-1`).
- The mock HCM store persists to disk (not memory) intentionally: Next.js in dev
  (Turbopack) may compile each route handler into a separate bundle, which would duplicate
  in-memory state across routes. See the comment at the top of `src/lib/hcm/store.js`.
