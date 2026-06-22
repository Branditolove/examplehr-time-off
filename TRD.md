# Technical Requirements Document — ExampleHR Time-Off Module

## 1. Resumen del problema

ExampleHR es un wrapper de experiencia sobre un HCM externo (tipo Workday/SAP) que actúa como **Source of Truth** para balances de time-off. Esto define la restricción central del proyecto: **ExampleHR nunca posee los números, solo los refleja**. Cualquier balance mostrado en pantalla es una copia desincronizable por definición, no un valor autoritativo.

Esto importa porque cambia el problema de "cómo mostrar datos" a "cómo mostrar datos que pueden estar mal, sabiendo que pueden estar mal, sin mentirle al usuario".

Tres consecuencias de diseño se derivan directamente de esta restricción:

- **No hay tal cosa como "el balance correcto en cliente".** Solo hay "el balance que el HCM reportó la última vez que preguntamos", con un timestamp de confianza decreciente.
- **Las escrituras (requests, approvals) son siempre provisionales hasta que el HCM confirma**, porque el HCM puede rechazar por una condición que el cliente no podía conocer (otra request concurrente, ajuste manual de HR, etc.).
- **El sistema debe asumir que el HCM puede mentir (success con datos incorrectos)** sin que eso se note hasta una verificación posterior. Esto descarta cualquier arquitectura que confíe ciegamente en la respuesta inmediata de un write.

Modelo de datos: balances son filas `(employeeId, locationId) -> { balance, asOf }`. Un employee puede tener N filas (una por ubicación con time-off policy propia). Esto importa para cache keys: la granularidad de cache/invalidation es por par `(employeeId, locationId)`, no por employee.

Dos personas con necesidades opuestas sobre la misma data:

| | Employee | Manager |
|---|---|---|
| Quiere | feedback instantáneo al pedir time-off | certeza de que el balance es válido al momento de decidir |
| Tolerancia a optimismo | alta (es su propio balance, quiere fluidez) | baja (decide sobre el balance de otra persona, un error es difícil de revertir socialmente) |

Esta tabla es la raíz de por qué Employee y Manager usan estrategias de fetching distintas (sección 3).

## 2. Decisiones técnicas justificadas

### 2.1 State management: TanStack Query (sin Zustand/Redux)

Evaluados: Zustand, Redux Toolkit, TanStack Query standalone.

El problema de este proyecto **no es state management genérico**, es **server state con TTL, invalidación, optimistic updates y reconciliación**. Eso es exactamente el dominio que TanStack Query resuelve out-of-the-box: cache por key, `staleTime`/`gcTime`, `invalidateQueries`, `onMutate`/`onError`/`onSettled` para optimistic + rollback, refetch en background, dedupe de requests in-flight.

- **Zustand**: excelente para client state (UI state, form drafts, modal open/close), pero no tiene noción de staleness, cache keys ni invalidación — habría que reconstruir manualmente toda la lógica de TTL y reconciliación que Query ya da. Se usa aquí, pero solo para estado puramente de cliente (ver 2.1.1).
- **Redux Toolkit (incluyendo RTK Query)**: RTK Query cubre el mismo terreno que TanStack Query pero con más boilerplate conceptual (slices, normalización manual si se quiere). Para un proyecto de este tamaño, sin necesidad de un store Redux normalizado preexistente, es complejidad sin beneficio adicional sobre TanStack Query.
- **TanStack Query standalone**: gana porque el problema central (sección 4 y 5) es 100% cache de server state con invalidación condicional, que es su propósito explícito.

**2.1.1 Client state remanente:** el form draft de la request (días seleccionados, location elegida antes de submit) y notificaciones de "tu balance cambió" son client state efímero. Para esto se usa **Zustand**, un store minúsculo, no porque Query no pueda guardar nada de UI, sino porque mezclar form-draft transitorio dentro de query cache es forzar la herramienta. Es la única pieza de "state management" tradicional en el proyecto.

### 2.2 Next.js App Router (no Pages Router)

- **Route Handlers** (`app/api/.../route.js`) son el lugar natural para el mock HCM — misma sintaxis que se usaría para hablar con el HCM real en producción, lo cual hace el mock representativo en vez de un atajo descartable.
- **Server Components** para el shell de cada vista (layout, nav, datos no sensibles a reconciliación en vivo) reducen JS enviado al cliente; los componentes que sí necesitan reactividad en tiempo real (balance widget, request form, approval list) son Client Components explícitos. Esta separación es además el primer nivel de "mapeo de responsabilidades" pedido en la sección 7: estático vs vivo, no widget por widget.
- Pages Router no aporta nada aquí — App Router es el default actual de Next.js y Route Handlers son superiores a `pages/api` para definir contratos de request/response explícitos por método HTTP.

## 3. Estrategia de Optimistic Updates

**Regla general: optimistic donde el daño de estar mal por unos segundos es bajo y reversible; pessimistic donde la decisión es difícil de deshacer o afecta a un tercero.**

### 3.1 Cuándo SÍ — Employee submit de time-off request

Al submitir, la UI:
1. Resta inmediatamente del balance local en cache (optimistic) y muestra la request como `pending`.
2. Dispara `POST /api/hcm/request` en background.
3. Si el HCM confirma → se reconcilia con el valor real devuelto (no se asume que el optimistic fue exacto, ver 3.3).
4. Si el HCM rechaza (balance insuficiente detectado en servidor) → rollback exacto al snapshot pre-mutación vía `onError` de TanStack Query, y se muestra el estado `HCM-rejected`.

Por qué aquí sí: la pérdida de fluidez de esperar un roundtrip completo para una acción que casi siempre tiene éxito (el balance local ya filtró la mayoría de los casos imposibles) es peor que el costo de revertir visualmente una request que falló. El usuario no tomó una decisión irreversible — solo vio un número que se corrige solo.

### 3.2 Cuándo NO — Manager approval/denial

La aprobación de un manager es pessimistic: el botón de "Aprobar" queda en estado de carga, no se asume éxito, y solo se refleja la decisión en la UI tras confirmación del HCM.

Por qué: aprobar una request basada en un balance optimista que resulta estar mal tiene un costo social y administrativo (el manager "autorizó" algo inválido) mucho mayor que un segundo de spinner. Además, justo antes de aprobar se fuerza un **revalidate del balance real** (no del cache batch, ver 4.3) — el manager nunca decide sobre un número que no se confirmó como fresco en los últimos segundos.

### 3.3 Rollback ante rechazo tardío

El rollback no es "restaurar el valor anterior a ciegas": es restaurar el **snapshot capturado en `onMutate`** (TanStack Query guarda el cache previo antes de aplicar el optimistic patch) y luego invalidar la query de balance para forzar un refetch real. Esto cubre el caso "el balance cambió por OTRA razón mientras la request estaba in-flight" — no queremos volver a un valor optimista viejo, queremos la verdad actual del HCM.

## 4. Cache Invalidation Strategy

### 4.1 TTL de balances

`staleTime: 30s` para queries de balance individual (`/api/hcm/balance`). Es una elección deliberada de "lo suficientemente fresco para no parecer mentiroso, lo suficientemente largo para no flood-ear el mock HCM con reads". No hay un número correcto objetivo aquí — 30s es el punto donde un humano interactuando con un form no nota staleness, pero el sistema sigue revalidando con frecuencia razonable.

Tras ese TTL, la query pasa a `stale` (estado UI explícito pedido en Storybook) y se revalida en background al siguiente render/foco de ventana (`refetchOnWindowFocus`, default de Query), sin bloquear la UI.

### 4.2 Background refresh vs bloquear al usuario

Regla: **un refetch en background nunca interrumpe una acción del usuario en curso.** Si el usuario está completando el form de request y llega un refresh de balance (por TTL, por foco de ventana, o por el bonus de aniversario), el número se actualiza de forma no disruptiva (ver sección 5 para el patrón visual), pero el form no se resetea ni se bloquea. Solo al momento de **submit** se vuelve a validar contra el valor más reciente conocido — si quedó obsoleto, el servidor (no el cliente) es quien decide y responde con `insufficient-balance` si corresponde.

Bloqueo activo de UI solo ocurre en un caso: la decisión del manager (3.2), porque ahí el costo de actuar sobre dato viejo supera el costo de esperar 1 refetch.

### 4.3 Batch endpoint vs real-time endpoint

`GET /api/hcm/balances/batch` es costoso y se usa **solo para hidratación inicial** (primer load de la vista, antes de que el usuario haya interactuado con ningún balance puntual). Se cachea con un `staleTime` largo (ej. 5 min) porque su propósito es poblar la UI rápido, no ser la fuente de verdad para decisiones puntuales.

En el momento en que el usuario interactúa con un balance específico (abre el form para una location, o el manager va a aprobar una request específica), se dispara el endpoint real-time `GET /api/hcm/balance?employeeId&locationId` para ese par puntual, que sobreescribe (vía `setQueryData` / cache key compartida) la entrada correspondiente del batch en cache. Así el batch nunca "gana" sobre un read puntual más fresco — la cache key es la misma (`['balance', employeeId, locationId]`) sin importar si el dato llegó por batch o por punto, así que el último write (por timestamp `asOf`) gana naturalmente.

## 5. Reconciliación mid-session

### 5.1 Polling, no WebSocket/SSE

Se elige **polling con `refetchInterval`** de TanStack Query (ej. cada 60s para queries de balance activas en pantalla) sobre WebSocket o SSE.

Justificación: el mock HCM (y por extensión, un HCM real tipo Workday/SAP) es un sistema de polling — estos sistemas legacy no exponen push en tiempo real, exponen APIs REST/SOAP de consulta. Modelar el cliente como si tuviera un canal push cuando el backend real no lo tiene sería construir para una capacidad que no existe. Polling es además la opción de menor complejidad operativa (sin gestión de conexión persistente, reconexión, fallback) — ningún rung de la escalera de complejidad pide más que esto para el problema dado.

El trigger de work-anniversary bonus (timer/endpoint manual) se descubre en el siguiente ciclo de poll, no instantáneamente — esto es aceptable porque el bonus no es una acción que el usuario esté esperando ver en tiempo real, es information eventual.

### 5.2 Notificar sin interrumpir

Cuando un poll detecta que el balance cambió respecto al valor mostrado (comparando `asOf` o el número mismo) **mientras hay una interacción en curso** (form abierto, valores seleccionados), no se reemplaza el número en silencio ni se interrumpe con un modal. Se muestra un indicador inline no bloqueante junto al balance (estado `balance-refreshed-mid-session`) — algo como un badge "Actualizado" con el nuevo valor, dejando que el usuario decida cuándo aceptar el nuevo número (o se aplica automáticamente si el form no tiene days seleccionados aún, ya que ahí no hay nada que perder). Si el usuario ya tenía days seleccionados que ahora exceden el nuevo balance, se marca el form como inválido de forma visible pero no se borra su input.

## 6. Manejo de silent failures

### 6.1 El problema

El HCM puede responder `200 OK` a un write con datos que luego resultan incorrectos (ej. el balance no se descontó realmente, o se descontó el doble). Esto es indetectable en el momento del response — solo se nota por contradicción posterior.

### 6.2 Estrategia de verificación post-submit

Tras cualquier write exitoso (`POST /api/hcm/request` o `/api/hcm/balance`), se programa una **revalidación de verificación** (un refetch forzado del balance real, no del cache) a un delay corto (ej. 3-5s después del success). Se compara el balance resultante contra el balance esperado calculado localmente (balance-anterior menos lo solicitado). Si no coincide dentro de un margen, se marca la entrada como `HCM-silently-wrong`.

Esto es deliberadamente una heurística, no una garantía — no hay forma de que el cliente sepa con certeza que el HCM mintió sin un canal de verdad independiente. La verificación por contradicción aritmética es el mecanismo más barato disponible y cubre el caso descrito en el spec.

### 6.3 UX para contradicción detectada tarde

No se revierte silenciosamente el optimistic update ni se oculta el problema: se muestra un banner de advertencia no bloqueante en el balance afectado ("Este balance no coincide con lo esperado, verificando con HCM") y se dispara un refetch adicional. Si persiste la discrepancia tras el segundo intento, se deja el balance marcado como `stale`/sospechoso indefinidamente hasta que un refetch lo resuelva — nunca se le permite al usuario actuar (submit otra request) sobre un balance marcado como contradictorio sin una advertencia explícita primero.

### 6.4 Conflict responses (distinto de insufficient-balance)

`insufficient_balance` es un rechazo determinístico: el HCM, con el balance real y actual, ve que `days > balance`. `conflict` es un rechazo distinto — el balance que el cliente vio (su `asOf`) ya no es el que el HCM tiene en este momento, porque algo lo movió entre la lectura y el submit (una aprobación/denegación de otra request, un bonus de aniversario). El cliente manda el `asOf` de su última lectura junto con el submit; el mock HCM compara contra el `asOf` actual y, si difieren, responde 409 `conflict` con el balance real — incluso si, coincidentemente, `days` seguiría siendo válido contra ese balance real. La distinción importa para el copy: "tu balance cambió, revisa el número actualizado" es una historia distinta de "no te alcanzan los días", y conflarlas confunde al usuario sobre qué pasó.

### 6.5 Anniversary bonus: trigger periódico

El bonus de aniversario corre como un `setInterval` a nivel de módulo en el store del mock HCM (cada 45s, sobre un par employee/location fijo), además del endpoint manual. Esto hace que el escenario "balance-refreshed-mid-session" sea observable en la app real sin acción manual, no solo en Storybook (donde el estado se simula vía props). Ponytail: es un timer de proceso único, fijo a un par; no sobrevive un despliegue serverless/multi-instancia — un cron real lo reemplazaría en producción.

## 7. Component tree y mapeo de responsabilidades

```
app/
  employee/page.js                 (Server Component — shell, no data viva)
    <EmployeeBalancesList>         (Client — owns: query de balances por location)
      <BalanceCard locationId>     (dumb — recibe balance + status como props)
    <TimeOffRequestForm>           (Client — owns: form draft (Zustand), mutation de submit)
      <LocationSelect>             (dumb)
      <DateRangePicker>            (dumb)
      <SubmitButton>               (dumb — refleja estado de la mutation)
    <MyRequestsList>               (Client — owns: query de requests del employee, polling para reflejar decisiones del manager)

  manager/page.js                  (Server Component — shell)
    <PendingRequestsList>          (Client — owns: query de requests pendientes)
      <RequestRow requestId>       (Client — owns: revalidación de balance al expandir + mutation de approve/deny)
        <BalanceContext>           (dumb — muestra balance fresco + staleness)
        <ApproveDenyButtons>       (dumb — refleja estado de la mutation, deshabilitado mientras revalida)
```

**Regla de separación (UI layer vs data layer):** ningún componente "dumb" (`BalanceCard`, `LocationSelect`, `ApproveDenyButtons`, etc.) llama a TanStack Query ni sabe de cache keys — reciben datos y callbacks por props. Toda la lógica de fetching/mutación/optimistic vive en un puñado de **custom hooks** (`useEmployeeBalances`, `useSubmitTimeOffRequest`, `usePendingRequests`, `useApproveRequest`) que envuelven `useQuery`/`useMutation`, y son los únicos consumidores directos de TanStack Query. Los componentes "owns" en el árbol son los que llaman a estos hooks; todo lo demás es presentacional puro.

Esta separación es la que hace testeable cada capa de forma independiente (sección 8): los hooks se testean contra el mock HCM, los componentes dumb se testean en Storybook con props fijas, sin necesidad de mockear la red en cada story.

## 8. Estrategia de testing

| Tipo | Qué cubre | Qué regresión previene |
|---|---|---|
| **Storybook interaction tests** | Comportamiento de componentes dumb/contenedores ante cada estado UI (loading, empty, stale, optimistic-pending, optimistic-rolled-back, HCM-rejected, HCM-silently-wrong, balance-refreshed-mid-session, manager-approval-with-stale-balance, insufficient-balance) — clicks, inputs, transiciones visuales | Regresiones visuales/de interacción: un estado que deja de renderizarse correctamente, un botón que no se deshabilita durante loading, un badge que no aparece |
| **Component tests** (Vitest + React Testing Library) | Lógica de los custom hooks (`useSubmitTimeOffRequest`, etc.) aislada con mocks de fetch — rollback en `onError`, que `onMutate` aplica el patch correcto, que invalidation se dispara con las keys correctas | Regresiones de lógica: un cambio futuro que rompe el cálculo de rollback, una invalidation key mal escrita que deja de refrescar el balance correcto |
| **Integration tests contra mock HCM** | Flujos completos extremo a extremo contra los route handlers reales (no mockeados): submit con balance insuficiente, rechazo tardío, silent failure detectado por verificación post-submit, bonus de aniversario actualizando balance mid-session, approval con balance revalidado | Regresiones de contrato: que el route handler y el cliente sigan acordando en formato y timing de respuestas; son las únicas que detectan si alguien rompe el mock HCM de forma que el resto del sistema no compense |

Justificación de la triple capa: cada nivel prueba algo que los otros dos no pueden. Storybook prueba *percepción* (¿se ve bien el estado?), component tests prueban *lógica* (¿el cálculo es correcto, aislado de la red?), integration tests prueban *contrato* (¿el cliente y el mock HCM siguen entendiéndose end-to-end?). Quitar cualquiera de las tres deja un tipo de regresión sin red de seguridad.

## 9. Alternativas consideradas y descartadas

- **Redux Toolkit + RTK Query** (descartado, 2.1): mismo poder que TanStack Query para este dominio, con más boilerplate conceptual sin beneficio adicional para el tamaño del proyecto.
- **Zustand como única solución de state** (descartado, 2.1): no modela TTL/invalidación nativamente; habría que reimplementar a mano lo que TanStack Query ya resuelve.
- **WebSocket/SSE para reconciliación mid-session** (descartado, 5.1): asume una capacidad de push que un HCM legacy tipo Workday/SAP no expone realísticamente; complejidad operativa innecesaria para un evento (bonus de aniversario) que tolera latencia de polling.
- **Optimistic update también para manager approval** (descartado, 3.2): el costo de revertir una decisión visualmente "tomada" sobre el balance de un tercero es mayor que el costo de un spinner — la asimetría entre las dos personas justifica tratarlas distinto en vez de aplicar una sola estrategia global.
- **Confiar ciegamente en el response de un write como verdad final** (descartado, 6): el spec exige tolerar silent failures explícitamente; cualquier diseño que no verifique post-submit viola ese requisito por construcción.
- **Pages Router** (descartado, 2.2): sin ventaja sobre App Router para este caso, y Route Handlers son el patrón más directo para modelar el mock HCM como si fuera la integración real.
