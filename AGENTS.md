# AGENTS.md — Dominó Occidental v2.0

Guía de referencia para agentes de IA (Claude Code, Cursor, Copilot, etc.) que trabajen en este
repositorio. Leer este archivo **completo** antes de tocar cualquier código.

---

## 1. Visión General del Proyecto

**Dominó Occidental** es una plataforma web multijugador para jugar dominó por parejas con el
conjunto doble-9 (55 fichas). Cuatro jugadores reciben 10 fichas cada uno; las 15 restantes quedan
en el pozo (solo el servidor conoce su contenido). El juego es por parejas: P1+P3 vs P2+P4.

**Objetivo de negocio:** juego en tiempo real + capa social (amigos, parejas, torneos, ranking ELO)
+ monetización (monedas virtuales, suscripción Premium, publicidad, torneos de pago).

---

## 2. Stack Tecnológico

| Capa            | Tecnología                       | Notas                                           |
|-----------------|----------------------------------|-------------------------------------------------|
| Runtime         | **Bun**                          | No usar Node directamente                       |
| Backend         | **Elysia** (dentro de Nextjs)    | REST + WebSocket, tipado end-to-end             |
| Base de datos   | **PostgreSQL / Supabase**        | RLS habilitado en todas las tablas              |
| Auth            | **Supabase Auth**                | JWT, OAuth, integración con RLS                 |
| Tiempo real     | **Supabase Realtime**            | Presencia, notificaciones, canales pub/sub      |
| Frontend        | **Next.js 16** (App Router)      | SSR/SSG, desplegado en Vercel                   |
| Estado global   | **Zustand**                      | Sesión, estado de juego y UI                    |
| Pagos           | **Stripe** + monedas virtuales   | Suscripciones + pagos únicos + webhooks         |
| Linting/Formato | **Biome**                        | Reemplaza ESLint + Prettier; nativo con Bun     |
| Monitorización  | **Sentry** + Supabase logs       | Errores y rendimiento en producción             |

### Comandos esenciales

```bash
bun install                    # instalar dependencias
bun run dev                    # servidor de desarrollo
bun test                       # ejecutar tests unitarios
bun test --coverage            # con cobertura (objetivo: >80% unitario)
bun run biome:check            # lint + formato (ejecutar antes de todo commit)
bun run build                  # build de producción
supabase db push --linked      # aplicar migraciones a Supabase
```

> **Nunca usar `npm` ni `npx` en este proyecto.** Todo pasa por `bun`.

---

## 3. Arquitectura del Sistema

```
Next.js 16 (App Router)
    │  REST /api/v1
    │  WebSocket ws://game/:id
    ▼
Elysia + Bun (REST + WebSocket)
    │  SQL + service_role
    ▼
Supabase (DB + Auth + Realtime)
```

### Estado efímero en memoria

El `GameState` de las partidas activas reside en un `Map` en memoria del servidor Elysia
(no en base de datos) para minimizar latencia. Al finalizar la partida, el estado se persiste.

```typescript
// src/game/types.ts — tipos canónicos
interface Tile { top: number; bottom: number; id: string }

interface PlayerState {
  id: string
  hand: Tile[]
  consecutivePasses: number
  isConnected: boolean
  lastActionAt: Date
  blockedTileIds: string[]   // fichas bloqueadas por timeout (se resetean en cada mano)
}

interface BoardState {
  leftEnd: number | null
  rightEnd: number | null
  tiles: Array<{ tile: Tile; side: 'left' | 'right'; playerId: string }>
}

interface GameState {
  matchId: string
  players: [PlayerState, PlayerState, PlayerState, PlayerState]
  board: BoardState
  currentTurn: 0 | 1 | 2 | 3
  scores: [number, number]         // [pareja1, pareja2]
  roundNumber: number
  turnDeadline: Date               // para timeout de turno
  consecutiveNullRounds: number    // manos anuladas seguidas
  poolCount: number                // fichas restantes en pozo (solo conteo, nunca contenido)
  status: 'waiting' | 'in_progress' | 'finished' | 'abandoned'
}
```

### Parámetros de tiempo (configuración fija)

| Parámetro               | Valor |
|-------------------------|-------|
| Heartbeat               | 5 s   |
| Ventana de reconexión   | 30 s  |
| Timeout de turno        | 45 s  |
| Período de abandono     | 60 s  |

---

## 4. Modelo de Datos — Esquema Completo v2.0

### 4.1 Inventario de tablas (15 en total)

| Tabla                     | Estado              | Descripción                                          |
|---------------------------|---------------------|------------------------------------------------------|
| `profiles`                | Existente + FIX     | Extiende `auth.users`. Campos nuevos: `status`, `country` |
| `pairs`                   | Existente + FIX     | Parejas estables. Campos nuevos: `status`, `invited_by`, `accepted_at` |
| `tournaments`             | Existente + FIX     | Torneos. Campos nuevos: `bracket_type`, `winner_pair_id` |
| `tournament_registrations`| Existente           | Relación N:M torneo-pareja                           |
| `matches`                 | Existente + FIX     | Encuentros. Campo nuevo: `tournament_round`          |
| `rounds`                  | Existente           | Manos individuales con resultado y puntos            |
| `elo_history`             | Existente + FIX     | Auditoría ELO. Campos nuevos: `k_factor`, `is_tournament` |
| `coin_transactions`       | Existente + FIX     | Libro contable. Campos nuevos: `related_entity_id`, `related_entity_type` |
| `friendships`             | **NUEVA**           | Solicitudes y amistades entre usuarios               |
| `notifications`           | **NUEVA**           | Notificaciones persistidas por usuario               |
| `match_moves`             | **NUEVA**           | Historial de cada jugada/paso para replay y auditoría |
| `achievements`            | **NUEVA**           | Catálogo de logros                                   |
| `user_achievements`       | **NUEVA**           | Logros desbloqueados por usuario                     |
| `ads_views`               | **NUEVA**           | Registro de anuncios recompensados (anti-abuso)      |
| `player_stats`            | **NUEVA (vista mat.)**| Estadísticas agregadas por jugador                 |

### 4.2 Campos críticos a recordar

```sql
-- profiles
status TEXT CHECK (status IN ('online','in_game','offline')) DEFAULT 'offline'
country CHAR(2)  -- ISO 3166-1 alpha-2

-- pairs
status TEXT CHECK (status IN ('pending','active','dissolved')) DEFAULT 'active'
invited_by UUID REFERENCES profiles(id)
accepted_at TIMESTAMPTZ

-- tournaments
bracket_type TEXT CHECK (bracket_type IN
  ('single_elimination','double_elimination','round_robin'))
  DEFAULT 'single_elimination'
winner_pair_id UUID REFERENCES pairs(id)

-- matches
tournament_round TEXT CHECK (tournament_round IN
  ('round_of_32','round_of_16','quarterfinal','semifinal','third_place','final'))

-- elo_history
k_factor SMALLINT NOT NULL DEFAULT 32
is_tournament BOOLEAN NOT NULL DEFAULT false

-- coin_transactions
related_entity_type TEXT CHECK (related_entity_type IN
  ('tournament','match','stripe_payment'))
related_entity_id UUID

-- match_moves (regla de integridad crítica)
CHECK ((is_pass = true AND tile_top IS NULL)
    OR (is_pass = false AND tile_top IS NOT NULL))

-- ads_views (anti-abuso: una fila por usuario por día)
UNIQUE (user_id, date_bucket)
views_count SMALLINT CHECK (views_count <= 5)

-- friendships
status TEXT CHECK (status IN ('pending','accepted','blocked','declined'))
UNIQUE (requester_id, addressee_id)
CHECK (requester_id <> addressee_id)

-- notifications
type TEXT CHECK (type IN (
  'match_invite','tournament_start','friend_request',
  'elo_change','tournament_result','system'))
```

### 4.3 Seguridad en base de datos

- **RLS habilitado en todas las tablas sin excepción.**
- El servidor Elysia usa `service_role` para operaciones privilegiadas.
- El cliente Next.js **nunca** recibe ni usa `service_role`. Solo `anon` / tokens de usuario.
- El contenido del pozo nunca se envía al cliente; solo `poolCount` (entero).

---

## 5. Reglas del Juego — Lógica del Servidor

> Toda la validación ocurre en Elysia. El cliente solo envía intenciones; el servidor es la única
> fuente de verdad.

### Reglas fundamentales

- **Fichas:** doble-9, 55 en total. Cada jugador recibe 10; 15 en el pozo.
- **Orden de turno:** P1 → P2 → P3 → P4 → P1 (horario). Parejas: P1+P3 vs P2+P4.
- **Primera mano:** empieza quien tenga la mula más alta; sin mulas → mayor suma.
- **Manos siguientes:** empieza el ganador de la mano anterior.
- **Puntos de mano:** suma de fichas de los 3 jugadores no ganadores.
- **Bloqueo:** gana la pareja con menor suma individual. Si hay empate exacto, la mano se anula.
- **Manos anuladas consecutivas:** máximo 3. A la cuarta se aplica la regla de menor suma global
  entre los 4 jugadores.
- **Target de partida:** 200 puntos por defecto. Si las dos parejas lo superan simultáneamente,
  gana la de mayor puntuación; si hay empate → manos de desempate.
- **Bloqueo por timeout:** si el timeout fuerza un pase teniendo el jugador fichas jugables, esas
  fichas se marcan como `blockedTileIds` y no pueden jugarse por el resto de la mano. Se resetean
  al repartir una nueva mano. Las fichas bloqueadas siguen contando para la suma al cierre.

### Posicionamiento de fichas — Tablero 16×N

#### Geometría del Tablero

1. **Grilla fija de 16 columnas** (C0 a C15). Las filas crecen dinámicamente arriba (F1, F2…) y abajo (F-1, F-2…). No se pre-reservan filas.
2. **Cada celda = media ficha** (head o tail), 48×48px. Una ficha normal = 2 celdas contiguas. Un doble = 1 celda de ancho por tres o dos de alto dependiendo el caso (se explica en detalle abajo).
3. **Dirección de las filas (serpenteo):**
   - Filas pares (F0, F2, F-2, F4, F-4…) → van hacia la **DERECHA** (→)
   - Filas impares (F1, F-1, F3, F-3…) → van hacia la **IZQUIERDA** (←)

#### Colocación de Fichas

4. Una ficha **NUNCA** comparte celda con otra. Dos fichas se conectan cuando ocupan celdas adyacentes con el mismo valor.
5. **No hay T-junctions ni ramificaciones desde dobles.** Los dobles son verticales de 1 celda de ancho × 3 de alto y conectan por adyacencia lateral.

   Normal: `[9|9]` ocupa tres celdas.
   ```
              9
   …   5   9   9   9   8   …
              9
   ```

   **Excepciones:**
   - **Comienza una nueva fila:** `[9|9]` se coloca de forma horizontal.
     ```
     Nueva fila   9   9   …
     Nueva fila   9
     Fila vieja   2   1   2
     ```
   - **Sirve de conexión de una fila con otra:** `[9|9]` se coloca de forma vertical y ocupa sólo dos celdas.
     ```
     Nueva fila   9   3   …
     Nueva fila   9
     Fila vieja   9   9   2
     ```

6. El servidor valida toda jugada. El cliente solo envía intenciones. Si la ficha ya se jugó o no conecta con ningún extremo, se rechaza.

#### El Algoritmo — 3 Casos + Dobles

Dado un extremo abierto (valor, fila, columna, dirección) y una ficha `[A|B]` donde A o B == extremo.valor:

**Paso 1** — Calcular espacio: celdas libres desde la posición actual hasta el borde de la mesa, en la dirección del extremo.

**Paso 2** — Elegir caso:

| Espacio | Caso | Qué hace |
|---------|------|----------|
| ≥ 2 | **Misma fila (horizontal)** | Coloca las 2 mitades en las 2 celdas siguientes en la misma fila. El nuevo extremo es el valor libre en la última celda. |
| = 1 | **Giro Mixto Vertical** | La conexión va en la última celda libre de la fila actual (celda borde C0 o C15). El valor libre cae verticalmente a la nueva fila o fila existente pero esa celda está vacía en la misma columna. El nuevo extremo espera que la nueva ficha se conecte desde arriba, no de forma adyacente. |
| = 0 | **L-Corner Puro** | El valor conexión YA está en la celda borde. Se crean dos filas nuevas (si existiera ya alguna creada, con esa celda vacía se crearía una sola entonces) en la misma columna con los valores de conexión y el otro queda libre para ser la conexión de una nueva fila. El nuevo extremo espera que la nueva ficha se conecte desde arriba, no de forma adyacente. |

#### Dobles (A == B)

- Ocupan 1 celda en la fila media + 2 filas float (superior e inferior) con el mismo valor.
- Si **espacio ≥ 1**: se colocan en la celda siguiente normal, con los floats arriba/abajo.
- Si **espacio == 0**: L-corner de doble — ocupa dos celdas verticales como una ficha normal, no se generan floats.
- **Primera ficha en una nueva fila:** se coloca de manera horizontal de la misma forma que una ficha normal, sin floats.

#### Reglas de Juego para Contexto

7. **Primera mano:** la apertura es siempre en F0:C7. Puede abrirse juego con cualquier ficha. En caso de ser doble se colocan sus floats en F-1 y F1.
8. **Órdenes de dirección en la práctica:**
   - Extremo derecho → ficha se coloca derecha-a-izquierda
   - Extremo izquierdo → ficha se coloca izquierda-a-derecha
   - (En nueva fila, la dirección sigue el serpenteo de esa fila)
9. **Dobles como spinner:** se puede seguir jugando desde ambos lados del doble (← y →) después de colocado, siempre que haya celdas libres adyacentes.
10. **Las decisiones de qué camino seguir para ARRIBA o para ABAJO** depende de:
    1. Primeramente, del usuario. El usuario decide en qué extremo se coloca la ficha (DERECHA o IZQUIERDA).
    2. Si ninguno de los extremos de F0 ha tomado esa decisión, puede SUBIR o BAJAR aleatoriamente.
    3. Si alguno de los extremos de F0 ya decidió su camino, entonces es siempre al contrario para evitar colisiones.

### Timeout de turno (45 s + bloqueo de fichas)

```typescript
// Al asignar turno (turn.ts):
state.turnDeadline = calculateDeadline(player.isConnected
  ? TURN_TIMEOUT_CONNECTED_MS   // 45_000
  : TURN_TIMEOUT_DISCONNECTED_MS // 15_000
)

// Worker interno (setInterval cada 2s) en timer-manager.ts:
// 1. Si Date.now() > state.turnDeadline → paso forzado
// 2. Se identifican las fichas jugables del jugador en ese momento
// 3. Se agregan a player.blockedTileIds
// 4. Se emite turn_timeout + player_tiles_blocked
// 5. Se avanza el turno (sin cambiar el deadline del nuevo turno)

// En validateAction (playTile):
// Si tileId está en player.blockedTileIds → error TILE_BLOCKED
// La ficha no puede jugarse por el resto de la mano.

// Al repartir nueva mano (startHand/redealHand):
// player.blockedTileIds = [] (se resetea)

// Las fichas bloqueadas SÍ cuentan para la suma al cierre de mano.
```

### Política de desconexión

| Evento                  | Acción del servidor                              | Efecto en partida                          |
|-------------------------|--------------------------------------------------|--------------------------------------------|
| Desconexión (heartbeat) | `player.isConnected = false`; emite `player_disconnected` | Continúa con pasos forzados si es su turno |
| Reconexión < 30 s       | Reenvía `GameState` completo                     | Continúa sin penalización                  |
| Sin reconexión 30–60 s  | Emite `reconnection_window_expiring`             | Los demás son avisados                     |
| Sin reconexión > 60 s   | `match.status = 'abandoned'`; penalización ELO  | Partida finaliza                           |
| Forfeit voluntario      | Mismo flujo que timeout > 60 s                  | Penalización ELO + flag `forfeit`          |

---

## 6. Sistema de Emparejamiento y ELO

### Cola de Quick Match (ventana deslizante)

| Tiempo en cola | Rango ELO aceptado |
|----------------|--------------------|
| 0 – 10 s       | ± 200 puntos       |
| 10 – 30 s      | ± 400 puntos       |
| 30 – 60 s      | ± 600 (cualquiera) |
| > 60 s         | Notificar, devolver al lobby |

### Fórmula ELO

```typescript
// Fórmula estándar
const E_A = 1 / (1 + Math.pow(10, (R_B - R_A) / 400))
const delta = K * (S_A - E_A)   // S_A: 1 = victoria, 0 = derrota

// Tabla de K
// K = 32  → partidas casuales (Quick Match)
// K = 48  → torneos (mayor impacto en ranking oficial)
// K = 16  → jugadores con ELO > 2000 (estabilización)

// CASO 1: ELO inicial de pareja nueva
pair.elo_pair = Math.round((player1.elo_individual + player2.elo_individual) / 2)

// CASO 2: Abandono / forfeit
const delta_abandon = Math.floor(K * (0 - E_A) * 1.5)  // penalización extra 50%
// Se aplica al ELO individual Y al ELO de pareja

// CASO 3: ELO de pareja vs individual
// Se actualizan simultáneamente al finalizar la partida,
// con registros independientes en elo_history
// (entity_type = 'individual' | 'pair')
```

---

## 7. API REST — Endpoints Completos

Prefijo: `/api/v1`

### Auth y Perfil

| Método | Ruta                         | Descripción                              |
|--------|------------------------------|------------------------------------------|
| POST   | `/auth/register`             | Registro delegado a Supabase Auth        |
| GET    | `/profile`                   | Datos del usuario autenticado            |
| PUT    | `/profile`                   | Actualizar nombre, avatar, preferencias  |
| GET    | `/users/search?q=`           | Buscar usuarios por username             |
| GET    | `/profile/:username/stats`   | Estadísticas públicas desde `player_stats` |

### Sistema Social

| Método | Ruta                         | Descripción                              |
|--------|------------------------------|------------------------------------------|
| POST   | `/friends/request`           | Enviar solicitud de amistad              |
| GET    | `/friends`                   | Listar amigos aceptados y pendientes     |
| PUT    | `/friends/:id/accept`        | Aceptar solicitud                        |
| PUT    | `/friends/:id/block`         | Bloquear usuario                         |
| DELETE | `/friends/:id`               | Eliminar amistad / rechazar solicitud    |
| GET    | `/notifications`             | Listar notificaciones (paginadas)        |
| PUT    | `/notifications/:id/read`    | Marcar como leída                        |
| PUT    | `/notifications/read-all`    | Marcar todas como leídas                 |

### Parejas y Partidas

| Método | Ruta                         | Descripción                              |
|--------|------------------------------|------------------------------------------|
| POST   | `/pairs`                     | Crear pareja (invitar a otro usuario)    |
| GET    | `/pairs/mine`                | Listar mis parejas con status            |
| DELETE | `/pairs/:id`                 | Disolver pareja                          |
| POST   | `/matchmaking/quick`         | Cola de emparejamiento rápido            |
| POST   | `/matches/:id/forfeit`       | Rendirse en una partida activa           |
| GET    | `/matches/:id`               | Historial detallado de partida           |
| GET    | `/matches/:id/moves`         | Jugadas de una partida para replay       |
| POST   | `/reports`                   | Reportar jugador por conducta tóxica     |

### Torneos y Leaderboard

| Método | Ruta                              | Descripción                         |
|--------|-----------------------------------|-------------------------------------|
| POST   | `/tournaments`                    | Crear torneo                        |
| GET    | `/tournaments`                    | Listar torneos abiertos/próximos    |
| POST   | `/tournaments/:id/register`       | Inscribir pareja                    |
| POST   | `/admin/tournaments/:id/start`    | Cerrar inscripciones y generar bracket |
| GET    | `/leaderboard/individual`         | Ranking ELO individual              |
| GET    | `/leaderboard/pairs`              | Ranking ELO por parejas             |

### Monetización

| Método | Ruta                | Descripción                                        |
|--------|---------------------|----------------------------------------------------|
| POST   | `/shop/coins`       | Comprar monedas vía Stripe (crea Payment Intent)   |
| POST   | `/webhooks/stripe`  | Recibir eventos Stripe (pago, chargeback, renovación) |
| POST   | `/ads/reward`       | Registrar anuncio visto y acreditar monedas        |

### Webhook de Stripe — Manejo obligatorio

```typescript
// Eventos que el webhook DEBE procesar:
// 'checkout.session.completed' → acreditar monedas
// 'invoice.payment_succeeded'  → renovar suscripción Premium
// 'charge.dispute.created'     → freeze_account() + evento Sentry
```

> **CRÍTICO:** verificar siempre la firma HMAC con `STRIPE_WEBHOOK_SECRET` antes de procesar
> cualquier evento de Stripe.

---

## 8. WebSocket — Mensajes del Juego

El canal WS es `ws://game/:matchId`. El token JWT se valida en el handshake inicial.

### Mensajes bidireccionales (existentes + nuevos v2.0)

| Mensaje                      | Dirección | Payload                                   | Descripción                          |
|------------------------------|-----------|-------------------------------------------|--------------------------------------|
| `game_state`                 | S → C     | `GameState` completo                      | Estado inicial al unirse             |
| `play_tile`                  | C → S     | `{ tileId, side }`                        | El jugador coloca una ficha          |
| `pass`                       | C → S     | `{}`                                      | El jugador pasa                      |
| `turn_timeout`               | S → C     | `{ playerId, forced: 'pass' }`            | Paso forzado por timeout             |
| `player_disconnected`        | S → C     | `{ playerId, reconnectWindowMs }`         | Jugador perdió la conexión           |
| `reconnecting`               | C → S     | `{ matchId, token }`                      | Solicitud de reconexión              |
| `reconnection_ok`            | S → C     | `GameState` completo                      | Reconexión confirmada                |
| `reconnection_window_expiring`| S → C    | `{ secondsLeft: 10 }`                     | Aviso de ventana casi expirada       |
| `match_abandoned`            | S → C     | `{ disconnectedPlayerId }`                | Partida cancelada por abandono       |
| `leave`                      | C → S     | `{}`                                      | Forfeit voluntario                   |

**Rate limit WS:** 10 mensajes/segundo por conexión.

---

## 9. Frontend — Rutas (App Router)

```
/
├── (auth)/
│   ├── login          → Inicio de sesión (email + OAuth)
│   └── register       → Registro de nuevo usuario
├── (dashboard)/
│   ├── lobby          → Partidas rápidas, torneos, presencia de amigos
│   ├── profile/[username] → Perfil público: ELO, stats, logros, historial
│   ├── users/search   → Buscar jugadores para invitar
│   ├── friends        → Gestión de amigos y solicitudes pendientes
│   ├── notifications  → Centro de notificaciones con filtro unread
│   ├── pairs          → Crear/gestionar parejas
│   ├── tournaments/
│   │   ├── [id]       → Detalle + bracket en vivo
│   │   └── create     → Formulario de creación
│   ├── shop           → Compra de monedas y suscripción Premium
│   ├── match/[id]     → Sala de juego en tiempo real
│   └── match/[id]/replay → Reproducción de partida histórica
├── admin/
│   ├── tournaments    → Gestionar torneos: crear, iniciar, cancelar
│   ├── users          → Gestión de usuarios: baneos, reportes
│   └── reports        → Revisar reportes de conducta
└── leaderboard        → Rankings ELO individual y por parejas
```

### Reconexión — UI obligatoria

Al detectar pérdida de conexión WS, `useGameSocket` debe mostrar un overlay modal con:
- Contador regresivo de 30 s.
- Indicador de reconexión automática (backoff exponencial: 1 s → 2 s → 4 s…).
- Botón manual "Reconectar ahora".
- Si llega a 0 sin éxito: "Partida abandonada. Penalización ELO aplicada." + botón al lobby.

---

## 10. Torneos

### Ciclo de vida

| Estado        | Transición                    | Descripción                                    |
|---------------|-------------------------------|------------------------------------------------|
| `upcoming`    | Admin crea torneo             | Visible en lobby. Inscripciones cerradas.      |
| `registration`| Admin abre inscripciones      | Parejas pagan `entry_fee` y se registran.      |
| `in_progress` | `POST /admin/.../start`       | Bracket generado. Partidas creadas.            |
| `finished`    | Última partida finaliza       | Premios acreditados automáticamente.           |
| `cancelled`   | Admin cancela                 | Entry fees devueltos íntegramente.             |

### Byes (bracket no potencia de 2)

- Si el número de parejas inscritas no es potencia de 2, se asignan byes a las parejas de mayor ELO.
- Un bye: `match` con `pair2_id = NULL` y `winner_pair_id = pair1_id` (victoria automática).

### Distribución de premios

| Posición       | % del Pozo | Nota                              |
|----------------|------------|-----------------------------------|
| 1.er lugar     | 54%        | Plataforma ya descontó 10%        |
| 2.do lugar     | 27%        |                                   |
| 3.er–4.to lugar| 9% (4,5% c/u) | Solo en torneos ≥ 16 parejas  |
| Plataforma     | 10%        | Comisión retenida antes de repartir|
| Cancelación    | 100% devuelto | Si el torneo se cancela antes de iniciar |

---

## 11. Monetización

### Modelo de ingresos

| Fuente               | Modelo                | Precio / Condición                                    |
|----------------------|-----------------------|-------------------------------------------------------|
| Monedas (Fichas)     | Compra directa IAP    | 100 = 0,99 € · 550 = 4,99 € · 1200 = 9,99 €         |
| Bono diario          | Retención gratuita    | 10 monedas al iniciar sesión por día                  |
| Anuncio recompensado | Ad revenue            | +15 monedas/anuncio · máx. 5 por día (en `ads_views`)|
| Premium mensual      | Suscripción Stripe    | 4,99 €/mes · sin anuncios + torneos exclusivos + badge|
| Torneos de pago      | Entry fee en monedas  | 10% del pozo como comisión de plataforma              |
| Anuncios display     | CPM                   | Banner lobby + vídeo intersticial post-partida (usuarios free) |

### Anti-abuso de anuncios

El contador de anuncios se persiste en `ads_views` (una fila por usuario por día) usando upsert.
Si `views_count >= 5` → HTTP 429. El incremento y acreditación de monedas se hacen
atómicamente mediante `supabase.rpc('increment_ad_view_and_credit', ...)`.

### Política de reembolsos

| Escenario                      | Política                                    |
|--------------------------------|---------------------------------------------|
| Compra de monedas < 14 días    | Reembolso completo si monedas no usadas     |
| Compra de monedas > 14 días    | Sin reembolso (especificado en ToS)         |
| Chargeback por banco           | `freeze_account()` hasta resolución (60 d)  |
| Suscripción Premium cancelada  | Acceso hasta fin del período pagado         |
| Entry fee de torneo cancelado  | Reembolso automático en monedas virtuales   |

Las monedas **no caducan** en condiciones normales. En cuentas baneadas permanentemente,
no son reembolsables ni transferibles.

---

## 12. Seguridad

| Área               | Medida                                                                         |
|--------------------|--------------------------------------------------------------------------------|
| Validación         | Toda la lógica del juego en Elysia. El cliente solo envía intenciones.         |
| RLS                | Políticas en todas las tablas. `service_role` solo en servidor, nunca en cliente. |
| Rate Limiting REST | 100 req/min por IP                                                             |
| Rate Limiting WS   | 10 mensajes/segundo por conexión                                               |
| Stripe Webhook     | Solo desde IPs de Stripe; verificar firma HMAC siempre                         |
| Anti-trampas       | Validar fichas en mano del servidor; detectar tiempos < 200 ms (posible bot)   |
| JWT                | Expiración 1 h con refresh tokens de rotación; WS valida token en handshake    |

### Moderación de usuarios

| Acción             | Trigger                   | Efecto                                              |
|--------------------|---------------------------|-----------------------------------------------------|
| Reporte            | `POST /reports`           | Tabla `reports`. 3 reportes en 7 días → revisión manual |
| Mute temporal (24h)| Admin panel               | `profiles.status = 'muted'`                         |
| Suspensión temporal| Admin panel               | `profiles.banned_until = fecha`                     |
| Ban permanente     | Admin panel               | `is_banned = true`. Monedas no reembolsables.       |
| Chargeback         | Webhook Stripe            | `freeze_account()` hasta resolución                 |

---

## 13. Plan de Testing

| Nivel       | Herramienta       | Cobertura objetivo | Escenarios clave                                          |
|-------------|-------------------|--------------------|-----------------------------------------------------------|
| Unitario    | `bun test`        | > 80%              | Jugadas válidas/inválidas, bloqueo, puntuación, timeout de turno, ELO (todos los casos borde) |
| Integración | Bun + Supabase CLI| > 70%              | Auth, CRUD parejas, torneos, `ads_views` anti-abuso, Stripe webhook mock |
| E2E         | Cypress           | Flujos críticos    | Registro → lobby → match completo · Desconexión/reconexión · Replay |
| Carga WS    | k6                | 500 matches        | WebSockets masivos, timeouts bajo carga, memory leaks en `GameState` Map |
| Visual      | Playwright        | Componentes UI     | GameBoard, overlay reconexión, bracket en vivo, notificaciones |

### Tests críticos de referencia

```typescript
// Timeout de turno forzado
it('fuerza paso si el jugador supera 45s sin jugar', async () => {
  const engine = new GameEngine({ matchId: 'test-timeout' })
  engine.initRound()
  const currentTurn = engine.state.currentTurn
  vi.setSystemTime(Date.now() + 46_000)
  await engine.checkTurnTimeout()
  expect(engine.state.currentTurn).not.toBe(currentTurn)
  expect(engine.lastForcedPass).toBeDefined()
})

// ads_views: límite diario persiste entre sesiones
it('rechaza más de 5 anuncios en el mismo día', async () => {
  await seedAdsViews({ userId: 'u1', views_count: 5 })
  const res = await app.request('/api/v1/ads/reward', {
    method: 'POST',
    headers: { Authorization: 'Bearer <token-u1>' }
  })
  expect(res.status).toBe(429)
})

// ELO inicial de pareja nueva
it('calcula ELO inicial como promedio de ELOs individuales', () => {
  expect(computeInitialPairElo({ elo_individual: 1400 }, { elo_individual: 1200 })).toBe(1300)
})
```

---

## 14. CI/CD y Despliegue

```yaml
# .github/workflows/main.yml
on: [push, pull_request]
jobs:
  quality:
    steps:
      - bun install
      - bun run biome:check      # lint y formato PRIMERO
      - bun test --coverage      # tests con cobertura
      - bun run build
  deploy:                        # solo en main
    steps:
      - vercel --prod
      - fly deploy
      - supabase db push --linked
```

| Componente         | Plataforma         | Detalles                                               |
|--------------------|--------------------|--------------------------------------------------------|
| Frontend (Next.js) | Vercel             | Dominio personalizado, CDN global, preview por PR      |
| Base de datos      | Supabase Pro       | Backups diarios, RLS, réplicas de lectura              |
| Cron jobs          | Supabase pg_cron   | `REFRESH MATERIALIZED VIEW player_stats` cada 15 min  |
| DNS / WAF          | Cloudflare         | DDoS protection, TLS automático, rate limiting CDN     |
| Monitorización     | Sentry + Grafana   | Errores, latencia WS p95/p99, tasa de timeouts         |

---

## 15. Fases de Desarrollo

| Fase | Nombre                        | Duración | Entregables clave                                                    |
|------|-------------------------------|----------|----------------------------------------------------------------------|
| 1    | MVP — Núcleo del Juego        | 8 sem    | Auth, GameState, WS + timeouts, `match_moves`, pruebas locales 4 jugadores |
| 2    | Social y Emparejamiento       | 6 sem    | `friendships`, `notifications`, presencia, matchmaking ELO, leaderboards |
| 3    | Torneos                       | 6 sem    | CRUD torneos, bracket con byes, panel `/admin`, logros               |
| 4    | Monetización                  | 4 sem    | Stripe + webhook, `ads_views` anti-abuso, política de reembolsos     |
| 5    | Pulido y Lanzamiento          | 4 sem    | Replay, E2E Cypress, k6 carga, PWA, GDPR, Sentry producción         |

**Total estimado: 28 semanas.**

---

## 16. Variables de Entorno Requeridas

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo servidor Elysia, nunca cliente

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PREMIUM=

# App
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
JWT_SECRET=

# Sentry
SENTRY_DSN=
```

---

## 17. Prioridades de Implementación

| Prioridad | Gap                                 | Riesgo si se omite                                  |
|-----------|-------------------------------------|-----------------------------------------------------|
| CRÍTICA   | Webhook Stripe                      | Pagos no confirmados, saldo incorrecto, chargebacks sin gestionar |
| CRÍTICA   | `ads_views` + anti-abuso            | Recompensa de anuncios ilimitada explotable          |
| CRÍTICA   | Timeout de turno (45 s)             | Partidas colgadas indefinidamente si hay AFK         |
| ALTA      | Política de desconexión completa    | ELO inconsistente, experiencia degradada            |
| ALTA      | `match_moves`                       | Sin replay ni auditoría anti-trampas efectiva        |
| ALTA      | `friendships` + búsqueda de usuarios| El flujo de creación de pareja no funciona sin búsqueda |
| MEDIA     | `notifications` persistidas         | Notificaciones perdidas al recargar la página        |
| MEDIA     | ELO casos borde (abandono, pareja nueva) | ELO inconsistente en situaciones frecuentes     |
| MEDIA     | `achievements`                      | Impacta negativamente la retención                  |
| BAJA      | `player_stats` (vista mat.)         | Perfiles sin estadísticas                           |
| BAJA      | Panel `/admin`                      | Moderación manual hasta tener el panel              |

---

*Documento generado desde el Architecture & Construction Document v2.0 de Dominó Occidental.*
