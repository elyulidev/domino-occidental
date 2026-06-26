# Exploration: tile-deck

**Date**: 2026-06-25  
**Change**: tile-deck  
**Status**: success

---

## Executive Summary

The codebase is a fresh Next.js 16 project with no existing game logic, tile types, or deck implementations. The only reference to game types is a canonical `Tile` interface in AGENTS.md (section 3) intended for `src/game/types.ts`, but that file doesn't exist yet. This is a greenfield implementation opportunity with no conflicts or migration concerns.

---

## Findings

### Existing Structure

| Aspect | Finding |
|--------|---------|
| **src/ structure** | Minimal — only `src/app/` exists (Next.js App Router boilerplate) |
| **Game types** | None exist. `Tile` interface defined only as documentation in AGENTS.md §3 |
| **Test files** | Zero test files exist. No `*.test.ts` or `*.spec.ts` found anywhere |
| **Package manager** | Bun (via `bun.lock`). **Never use npm/npx** |
| **Test runner** | `bun test` (Bun's built-in test runner, using `bun:test`) — configured in OpenSpec but no tests written yet |
| **Linter/Formatter** | Biome 2.2.0 — space indent, width 2, recommended rules + organize imports |
| **TypeScript** | Strict mode, ES2017 target, bundler module resolution, `@/*` → `src/*` path alias |
| **Path alias** | `@/*` maps to `./src/*` — new files should use this convention |

### Canonical Tile Type (from AGENTS.md §3)

```typescript
// Intended location: src/game/types.ts
interface Tile { top: number; bottom: number; id: string }
```

This is the **only existing type definition** to align with. The exploration confirms this file does NOT yet exist.

### Recommended Approach

**Modular — separate type definitions from pure functions.**

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **Single file** (`src/game/tile-deck.ts`) | Simple, everything in one place | Grows unwieldy; harder to tree-shake; mixes concerns | Low |
| **Modular** (`src/game/types.ts` + `src/game/deck.ts`) | Clean separation; matches AGENTS.md canonical location; testable independently; aligns with future `GameState` structure | Slightly more files | Low |

**Recommendation: Modular approach.** Reasons:

1. AGENTS.md already specifies `src/game/types.ts` as the canonical location for game types — we should honor that from day one
2. `Deck` (creation, shuffle, deal) is logically separate from `Tile` (the data structure)
3. Pure TypeScript functions are trivially testable in isolation
4. Future `GameState` will import from `types.ts` — establishing the pattern now avoids refactoring

### File Locations

```
src/
├── game/
│   ├── types.ts          ← Tile interface + related type exports
│   ├── deck.ts           ← Deck factory, shuffle(), deal()
│   └── __tests__/
│       ├── types.test.ts ← (optional, types are compile-time only)
│       └── deck.test.ts  ← Core test file: deck creation, shuffle, deal
```

**Path alias usage**: All imports use `@/game/types`, `@/game/deck` etc.

### Conventions to Follow

| Convention | Value | Source |
|------------|-------|--------|
| Indent | 2 spaces | `biome.json` |
| Module type | ESM (`import`/`export`) | `tsconfig.json` module: esnext |
| Type exports | `interface` (not `type`) for objects | AGENTS.md pattern |
| Test framework | `bun:test` (`describe`, `it`, `expect`) | OpenSpec config |
| Test location | Co-located `__tests__/` or `*.test.ts` alongside source | Bun convention |
| Run command | `bun test` | package.json scripts + OpenSpec |
| Strict mode | Yes | tsconfig.json strict: true |

### Risks

1. **No existing test infrastructure** — `bun test` works out of the box with Bun, but no test script is defined in `package.json`. The `scripts` section only has `dev`, `build`, `start`, `lint`, `format`. Need to add `"test": "bun test"` to package.json.
2. **No `src/game/` directory exists yet** — must be created.
3. **Fisher-Yates shuffle correctness** — must ensure unbiased shuffle. Easy to get wrong.
4. **Double-9 tile set completeness** — 55 tiles (0-0 through 9-9). Must verify the combinatorial generation is correct: `n*(n+1)/2` where n=10 (values 0-9) = 55 ✓.

---

## Decision Matrix: Key Design Choices

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| **Tile: interface vs type** | `interface Tile { ... }` | `type Tile = { ... }` | `interface` — matches AGENTS.md convention |
| **Tile ID: string vs number** | `string` (UUID/cuid) | `number` (sequential) | `string` — matches AGENTS.md `{ id: string }`, enables future DB integration |
| **Deck: class vs factory function** | `class Deck { ... }` | `function createDeck(): Tile[]` | Factory function — simpler, composable, no `this` binding issues |
| **Shuffle: in-place vs pure** | Mutates input array | Returns new array | Pure — immutability avoids bugs in concurrent game state |
| **Deal: returns object vs tuple** | `{ hands: Tile[][], pool: Tile[] }` | `[Tile[][], Tile[]]` | Object — named properties are self-documenting |
| **Tile values: 0-9 or 1-10** | 0 through 9 (standard domino) | 1 through 10 | 0-9 — standard domino notation, matches AGENTS.md double-9 |

---

## Ready for Proposal

**Yes** — the exploration is complete and the path is clear. The orchestrator should:

1. Confirm the modular approach (types.ts + deck.ts)
2. Proceed to `sdd-propose` to formalize scope and approach
3. No blockers, no ambiguities requiring user clarification
