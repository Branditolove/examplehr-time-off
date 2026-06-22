# ExampleHR — Time-Off

Time-off requests for ExampleHR, where the HCM (not this app) owns the balances. See
[TRD.md](./TRD.md) for the full reasoning behind every decision below — this README is just
how to run things.

## Stack

Next.js (App Router) · TanStack Query · Zustand (form-draft state only) · Tailwind ·
Storybook · Vitest (+ Testing Library, Playwright)

## Requisitos

- Node.js 18.18+ (Next.js 16 requirement)
- npm

## Instalación

```bash
npm install
```

## Correr la app

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Hay dos vistas:

- `/employee` — balances per-location + formulario de solicitud (employee fijo: `emp-1`, sin auth)
- `/manager` — solicitudes pendientes con aprobar/denegar

El mock HCM vive en `src/app/api/hcm/*` (route handlers reales de Next.js) y persiste su
estado en un archivo local `.hcm-store.json` en la raíz del proyecto (gitignored). Bórralo o
reinicia el server para volver al estado semilla:

| Endpoint | Qué hace |
|---|---|
| `GET /api/hcm/balance?employeeId=&locationId=` | Read real-time de un balance |
| `POST /api/hcm/balance` | Write administrativo de un balance |
| `GET /api/hcm/balances/batch?employeeId=` | Corpus completo (para hidratación inicial) |
| `GET\|POST /api/hcm/request` | Listar pendientes / submit de una solicitud |
| `PATCH /api/hcm/request/:id` | Aprobar o denegar |
| `POST /api/hcm/anniversary` | Trigger manual del bonus de aniversario |

Cualquier endpoint de escritura acepta `force: "insufficient" | "silent-failure" | "none"` en
el body para forzar un escenario específico (usado por los tests de integración). Sin `force`,
hay ~15% de probabilidad de silent-failure real, para explorar el comportamiento a mano desde
el navegador.

## Storybook

```bash
npm run storybook
```

Abre [http://localhost:6006](http://localhost:6006). Cubre los 10 estados UI requeridos:
`loading`, `empty`, `stale`, `optimistic-pending`, `optimistic-rolled-back`, `HCM-rejected`,
`HCM-silently-wrong`, `balance-refreshed-mid-session`, `manager-approval-with-stale-balance`,
`insufficient-balance`.

Build estático (por si se quiere desplegar a Vercel/Chromatic):

```bash
npm run build-storybook
```

## Tests

Tres capas (ver TRD §8 para qué regresión previene cada una):

```bash
npm run test             # component tests + unit tests del store (Vitest + RTL, fetch mockeado)
npm run test:storybook   # interaction tests de Storybook (modo browser, Playwright)
npm run test:all         # las dos suites anteriores
npm run test:coverage    # con reporte de cobertura (v8)
```

Los integration tests (`src/app/api/hcm/integration.test.js`) llaman los route handlers reales
sin mockear nada — corren dentro de `npm run test`.

Cobertura actual (`npm run test:coverage`): ~93% líneas, ~86% statements.

## Build de producción

```bash
npm run build
npm run start
```

## Estructura relevante

```
src/
  app/
    api/hcm/         # mock HCM (route handlers)
    employee/        # vista Employee
    manager/         # vista Manager
  components/
    employee/        # BalanceCard, RequestFeedback, TimeOffRequestForm, ...
    manager/         # BalanceContext, ApproveDenyButtons, RequestRow, ...
  hooks/             # useBalance, useSubmitTimeOffRequest, useDecideRequest, ...
  lib/hcm/           # store.js (mock HCM persistido en disco) + client.js (fetch wrapper)
  store/             # Zustand: form draft + integridad de balance
TRD.md               # documento técnico completo
```

## Notas

- No hay autenticación: `src/lib/currentUser.js` fija un employee de demo (`emp-1`).
- El store del mock HCM persiste en disco (no en memoria) a propósito: Next.js en dev
  (Turbopack) puede compilar cada route handler en un bundle distinto, lo que duplicaría el
  estado en memoria entre rutas. Ver el comentario al inicio de `src/lib/hcm/store.js`.
