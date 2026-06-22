# Technical Requirements Document — ExampleHR Time-Off Module

## 1. Problem Summary

ExampleHR is an experience wrapper over an external HCM (Workday/SAP-like) that acts as the **Source of Truth** for time-off balances. This defines the central constraint of the project: **ExampleHR never owns the numbers, it only reflects them**. Any balance shown on screen is a copy that can become desynchronized by definition — not an authoritative value.

This matters because it reframes the problem from "how to display data" to "how to display data that may be wrong, knowing it may be wrong, without lying to the user."

Three design consequences follow directly from this constraint:

- **There is no such thing as "the correct balance on the client."** There is only "the balance the HCM reported the last time we asked," with a decreasing confidence timestamp.
- **Writes (requests, approvals) are always provisional until the HCM confirms**, because the HCM can reject based on a condition the client could not have known about (a concurrent request, a manual HR adjustment, etc.).
- **The system must assume the HCM can lie (success response with incorrect data)** without that being detectable until a later verification. This rules out any architecture that blindly trusts the immediate response of a write.

Data model: balances are rows `(employeeId, locationId) -> { balance, asOf }`. An employee can have N rows (one per location with its own time-off policy). This matters for cache keys: cache/invalidation granularity is per `(employeeId, locationId)` pair, not per employee.

Two personas with opposing needs over the same data:

| | Employee | Manager |
|---|---|---|
| Wants | instant feedback when requesting time-off | certainty that the balance is valid at decision time |
| Tolerance for optimism | high (it's their own balance, they want fluidity) | low (deciding on someone else's balance — a mistake is socially hard to undo) |

This table is the root of why Employee and Manager use different fetching strategies (section 3).

## 2. Justified Technical Decisions

### 2.1 State management: TanStack Query (not Zustand/Redux)

Evaluated: Zustand, Redux Toolkit, TanStack Query standalone.

The problem here **is not generic state management** — it is **server state with TTL, invalidation, optimistic updates, and reconciliation**. That is exactly the domain TanStack Query solves out-of-the-box: cache by key, `staleTime`/`gcTime`, `invalidateQueries`, `onMutate`/`onError`/`onSettled` for optimistic + rollback, background refetch, deduplication of in-flight requests.

- **Zustand**: excellent for client state (UI state, form drafts, modal open/close), but has no notion of staleness, cache keys, or invalidation — the entire TTL and reconciliation logic that Query provides would have to be rebuilt manually. It is used here, but only for purely client-side state (see 2.1.1).
- **Redux Toolkit (including RTK Query)**: RTK Query covers the same ground as TanStack Query but with more conceptual boilerplate (slices, manual normalization if desired). For a project of this size, with no need for a pre-existing normalized Redux store, it is complexity without additional benefit over TanStack Query.
- **TanStack Query standalone**: wins because the central problem (sections 4 and 5) is 100% server state cache with conditional invalidation — its explicit purpose.

**2.1.1 Remaining client state:** the request form draft (selected days, chosen location before submit) and "your balance changed" notifications are ephemeral client state. **Zustand** is used for this — a tiny store — not because Query can't hold any UI state, but because mixing transient form drafts into query cache forces the wrong tool. It is the only piece of traditional "state management" in the project.

### 2.2 Next.js App Router (not Pages Router)

- **Route Handlers** (`app/api/.../route.js`) are the natural home for the mock HCM — same syntax that would be used to talk to the real HCM in production, making the mock representative rather than a throwaway shortcut.
- **Server Components** for the shell of each view (layout, nav, data not sensitive to live reconciliation) reduce JS sent to the client; components that need real-time reactivity (balance widget, request form, approval list) are explicit Client Components. This separation is also the first level of the "responsibility mapping" requested in section 7: static vs. live, not widget by widget.
- Pages Router adds nothing here — App Router is the current Next.js default and Route Handlers are superior to `pages/api` for defining explicit request/response contracts per HTTP method.

## 3. Optimistic Update Strategy

**General rule: optimistic where the cost of being wrong for a few seconds is low and reversible; pessimistic where the decision is hard to undo or affects a third party.**

### 3.1 When YES — Employee time-off request submit

On submit, the UI:
1. Immediately subtracts from the local cache balance (optimistic) and shows the request as `pending`.
2. Fires `POST /api/hcm/request` in the background.
3. If the HCM confirms → reconciles with the real value returned (does not assume the optimistic was accurate, see 3.3).
4. If the HCM rejects (insufficient balance detected server-side) → exact rollback to the pre-mutation snapshot via TanStack Query's `onError`, and the `HCM-rejected` state is shown.

Why yes here: the loss of fluidity from waiting a full round-trip for an action that almost always succeeds (the local balance already filtered out most impossible cases) is worse than the cost of visually reverting a failed request. The user did not take an irreversible action — they just saw a number that corrects itself.

### 3.2 When NO — Manager approval/denial

Manager approval is pessimistic: the "Approve" button enters a loading state, success is not assumed, and the decision is only reflected in the UI after HCM confirmation.

Why: approving a request based on an optimistic balance that turns out to be wrong has a social and administrative cost (the manager "authorized" something invalid) far greater than a one-second spinner. Moreover, just before approving, a **real-time balance revalidation** is forced (not from the batch cache, see 4.3) — the manager never decides on a number that was not confirmed fresh within the last few seconds.

### 3.3 Rollback on late rejection

The rollback is not "blindly restore the previous value": it restores the **snapshot captured in `onMutate`** (TanStack Query saves the prior cache before applying the optimistic patch) and then invalidates the balance query to force a real refetch. This covers the case "the balance changed for ANOTHER reason while the request was in-flight" — we don't want to go back to a stale optimistic value, we want the current truth from the HCM.

## 4. Cache Invalidation Strategy

### 4.1 Balance TTL

`staleTime: 30s` for individual balance queries (`/api/hcm/balance`). This is a deliberate choice of "fresh enough not to seem dishonest, long enough not to flood the mock HCM with reads." There is no objectively correct number — 30s is the point where a human interacting with a form does not notice staleness, but the system still revalidates with reasonable frequency.

After that TTL, the query becomes `stale` (an explicit UI state requested in Storybook) and revalidates in the background on the next render/window focus (`refetchOnWindowFocus`, Query's default), without blocking the UI.

### 4.2 Background refresh vs. blocking the user

Rule: **a background refetch never interrupts a user action in progress.** If the user is filling out the request form and a balance refresh arrives (from TTL, window focus, or the anniversary bonus), the number updates non-disruptively (see section 5 for the visual pattern), but the form is not reset or blocked. Only at **submit time** is the value re-validated against the most recently known value — if it became stale, the server (not the client) decides and responds with `insufficient-balance` if applicable.

Active UI blocking only occurs in one case: the manager's decision (3.2), because there the cost of acting on stale data exceeds the cost of waiting for one refetch.

### 4.3 Batch endpoint vs. real-time endpoint

`GET /api/hcm/balances/batch` is expensive and is used **only for initial hydration** (first load of the view, before the user has interacted with any specific balance). It is cached with a long `staleTime` (e.g. 5 min) because its purpose is to populate the UI quickly, not to be the source of truth for point-in-time decisions.

When the user interacts with a specific balance (opens the form for a location, or the manager is about to approve a specific request), the real-time endpoint `GET /api/hcm/balance?employeeId&locationId` is fired for that specific pair, overwriting (via `setQueryData` / shared cache key) the corresponding batch entry in cache. This way the batch never "wins" over a fresher point read — the cache key is the same (`['balance', employeeId, locationId]`) regardless of whether the data arrived via batch or point read, so the latest write (by `asOf` timestamp) wins naturally.

## 5. Mid-session Reconciliation

### 5.1 Polling, not WebSocket/SSE

**Polling with TanStack Query's `refetchInterval`** (e.g. every 60s for balance queries active on screen) is chosen over WebSocket or SSE.

Rationale: the mock HCM (and by extension, a real HCM like Workday/SAP) is a polling system — these legacy systems do not expose real-time push; they expose REST/SOAP query APIs. Modeling the client as if it had a push channel when the real backend does not would be building for a capability that does not exist. Polling also carries the lowest operational complexity (no persistent connection management, reconnection, or fallback) — no rung on the complexity ladder demands more than this for the given problem.

The work-anniversary bonus trigger (timer/manual endpoint) is discovered on the next poll cycle, not instantaneously — this is acceptable because the bonus is not an action the user is waiting to see in real time; it is eventual information.

### 5.2 Notify without interrupting

When a poll detects that the balance changed relative to the displayed value (by comparing `asOf` or the number itself) **while an interaction is in progress** (form open, values selected), the number is not silently replaced nor is the user interrupted with a modal. A non-blocking inline indicator is shown next to the balance (`balance-refreshed-mid-session` state) — something like an "Updated" badge with the new value, letting the user decide when to accept the new number (or it is applied automatically if the form has no days selected yet, since there is nothing to lose). If the user already had days selected that now exceed the new balance, the form is visibly marked invalid but their input is not cleared.

## 6. Silent Failure Handling

### 6.1 The problem

The HCM can respond `200 OK` to a write with data that later turns out to be incorrect (e.g. the balance was not actually deducted, or was deducted twice). This is undetectable at response time — it only surfaces through a later contradiction.

### 6.2 Post-submit verification strategy

After any successful write (`POST /api/hcm/request` or `/api/hcm/balance`), a **verification revalidation** is scheduled (a forced real balance refetch, not from cache) after a short delay (e.g. 3–5s after success). The resulting balance is compared against the locally computed expected balance (prior balance minus days requested). If they do not match within a margin, the entry is flagged as `HCM-silently-wrong`.

This is deliberately a heuristic, not a guarantee — there is no way for the client to know with certainty that the HCM lied without an independent source of truth. Arithmetic contradiction verification is the cheapest available mechanism and covers the case described in the spec.

### 6.3 UX for late-detected contradiction

The optimistic update is not silently reverted nor the problem hidden: a non-blocking warning banner is shown on the affected balance ("This balance does not match what was expected, verifying with HCM") and an additional refetch is fired. If the discrepancy persists after the second attempt, the balance is left marked as `stale`/suspect indefinitely until a refetch resolves it — the user is never allowed to act (submit another request) on a balance marked as contradictory without an explicit warning first.

### 6.4 Conflict responses (distinct from insufficient-balance)

`insufficient_balance` is a deterministic rejection: the HCM, with the real and current balance, sees that `days > balance`. `conflict` is a different rejection — the balance the client saw (its `asOf`) is no longer what the HCM has at this moment, because something moved it between the read and the submit (an approval/denial of another request, an anniversary bonus). The client sends the `asOf` of its last read along with the submit; the mock HCM compares against the current `asOf` and, if they differ, responds 409 `conflict` with the real balance — even if, coincidentally, `days` would still be valid against that real balance. The distinction matters for the copy: "your balance changed, check the updated number" is a different story from "you don't have enough days," and conflating them confuses the user about what happened.

### 6.5 Anniversary bonus: periodic trigger

The anniversary bonus runs as a module-level `setInterval` in the mock HCM store (every 45s, on a fixed employee/location pair), in addition to the manual endpoint. This makes the "balance-refreshed-mid-session" scenario observable in the real app without manual intervention, not only in Storybook (where the state is simulated via props). Note: it is a single-process, fixed-pair timer; it would not survive a serverless/multi-instance deployment — a real cron/scheduler would replace it in production.

## 7. Component Tree and Responsibility Mapping

```
app/
  employee/page.js                 (Server Component — shell, no live data)
    <EmployeeBalancesList>         (Client — owns: balance query per location)
      <BalanceCard locationId>     (dumb — receives balance + status as props)
    <TimeOffRequestForm>           (Client — owns: form draft (Zustand), submit mutation)
      <LocationSelect>             (dumb)
      <DateRangePicker>            (dumb)
      <SubmitButton>               (dumb — reflects mutation state)
    <MyRequestsList>               (Client — owns: employee request query, polling to reflect manager decisions)

  manager/page.js                  (Server Component — shell)
    <PendingRequestsList>          (Client — owns: pending requests query)
      <RequestRow requestId>       (Client — owns: balance revalidation on expand + approve/deny mutation)
        <BalanceContext>           (dumb — displays fresh balance + staleness)
        <ApproveDenyButtons>       (dumb — reflects mutation state, disabled while revalidating)
```

**Separation rule (UI layer vs. data layer):** no "dumb" component (`BalanceCard`, `LocationSelect`, `ApproveDenyButtons`, etc.) calls TanStack Query or knows about cache keys — they receive data and callbacks via props. All fetching/mutation/optimistic logic lives in a handful of **custom hooks** (`useEmployeeBalances`, `useSubmitTimeOffRequest`, `usePendingRequests`, `useApproveRequest`) that wrap `useQuery`/`useMutation`, and are the only direct consumers of TanStack Query. The "owns" components in the tree are the ones that call these hooks; everything else is purely presentational.

This separation is what makes each layer independently testable (section 8): hooks are tested against the mock HCM, dumb components are tested in Storybook with fixed props, with no need to mock the network in each story.

## 8. Testing Strategy

| Type | What it covers | What regression it prevents |
|---|---|---|
| **Storybook interaction tests** | Behavior of dumb/container components in each UI state (loading, empty, stale, optimistic-pending, optimistic-rolled-back, HCM-rejected, HCM-silently-wrong, balance-refreshed-mid-session, manager-approval-with-stale-balance, insufficient-balance) — clicks, inputs, visual transitions | Visual/interaction regressions: a state that stops rendering correctly, a button that fails to disable during loading, a badge that doesn't appear |
| **Component tests** (Vitest + React Testing Library) | Custom hook logic (`useSubmitTimeOffRequest`, etc.) isolated with fetch mocks — rollback in `onError`, that `onMutate` applies the correct patch, that invalidation fires with the correct keys | Logic regressions: a future change that breaks the rollback calculation, a misspelled invalidation key that stops refreshing the correct balance |
| **Integration tests against mock HCM** | Complete end-to-end flows against real route handlers (not mocked): submit with insufficient balance, late rejection, silent failure detected by post-submit verification, anniversary bonus updating balance mid-session, approval with revalidated balance | Contract regressions: that the route handler and the client still agree on response format and timing; these are the only tests that detect if someone breaks the mock HCM in a way the rest of the system does not compensate for |

Rationale for the three-layer approach: each level tests something the other two cannot. Storybook tests *perception* (does the state look right?), component tests test *logic* (is the calculation correct, isolated from the network?), integration tests test *contract* (do the client and the mock HCM still understand each other end-to-end?). Removing any of the three leaves one type of regression without a safety net.

## 9. Considered and Discarded Alternatives

- **Redux Toolkit + RTK Query** (discarded, 2.1): same power as TanStack Query for this domain, with more conceptual boilerplate and no additional benefit for the project's size.
- **Zustand as the sole state solution** (discarded, 2.1): does not model TTL/invalidation natively; the entire logic that TanStack Query already solves would have to be reimplemented by hand.
- **WebSocket/SSE for mid-session reconciliation** (discarded, 5.1): assumes a push capability that a legacy HCM like Workday/SAP does not realistically expose; unnecessary operational complexity for an event (anniversary bonus) that tolerates polling latency.
- **Optimistic update for manager approval as well** (discarded, 3.2): the cost of visually "undoing" a decision taken on someone else's balance is greater than the cost of a spinner — the asymmetry between the two personas justifies treating them differently rather than applying a single global strategy.
- **Blindly trusting a write response as the final truth** (discarded, 6): the spec explicitly requires tolerating silent failures; any design that does not verify post-submit violates that requirement by construction.
- **Pages Router** (discarded, 2.2): no advantage over App Router for this case, and Route Handlers are the most direct pattern for modeling the mock HCM as if it were the real integration.
