# Proposal: Game State Store

## Intent

In-memory registry for active domino matches. The game engine (modules 1-7) is pure — it takes `MatchState` in and returns `MatchState` out. Something must **hold** that state between WS messages. This module is that something.

## Scope

### In Scope
- Module-level `Map<string, MatchState>` singleton
- 8 exported functions: `createGame`, `getGame`, `updateGame`, `removeGame`, `hasGame`, `getActiveCount`, `cleanup`, `getAllActive`
- Immutable update pattern (read → engine → write)
- `cleanup()` safety net for abandoned matches past age threshold

### Out of Scope
- Database persistence (module 13+)
- Game logic or validation (modules 1-7)
- ORM, caching layer, or distributed state

## Capabilities

### New Capabilities
- `game-state-store`: In-memory registry of active match states with CRUD, cleanup, and iteration for timer workers

### Modified Capabilities
- None

## Approach

Module-level `Map<string, MatchState>` singleton in `src/game/store.ts`. Exported functions close over the Map via closure — no class, no global. All sync, no async, no framework dependency. `updateGame` replaces the entire entry (immutable pattern). `cleanup` iterates and removes entries where `Date.now() - lastActionAt > thresholdAge`. `getAllActive` returns `[matchId, MatchState][]` for timer workers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/game/store.ts` | New | The store module — singleton Map + 8 wrapper functions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Memory leak (zombie matches) | Low | `cleanup()` safety net + `removeGame` on match end |
| Stale state after server crash | High | Expected — in-memory only. Persistence is separate module |
| Unbounded Map growth | Low | Active game cap per server ~100s, negligible footprint |

## Rollback Plan

Drop the import and instantiate the Map locally in the WS handler. Zero data to migrate — pure memory, no schema.

## Dependencies

- `src/game/types.ts` (`MatchState` type)

## Success Criteria

- [ ] All 8 functions work as specified with isolated unit tests
- [ ] `cleanup()` correctly removes entries past the age threshold
- [ ] No module-level mutable state leaked outside the closed-over Map
- [ ] Tests pass without Elysia, Supabase, or any framework
