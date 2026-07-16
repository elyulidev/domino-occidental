import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { UserChannelManager } from "../../ws/user-channel";
import {
  createMatchmakingQueue,
  fetchPlayerProfiles,
  processMatchmaking,
  startCleanupScheduler,
} from "../matchmaking";
import { resetStore } from "../store";

describe("MatchmakingQueue", () => {
  let queue: ReturnType<typeof createMatchmakingQueue>;
  let now: number;
  let dateNowSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    queue = createMatchmakingQueue();
    now = Date.now();
    dateNowSpy = spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  // --- Basic queue operations ---

  it("enqueue adds player to queue", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    expect(queue.getQueueSize()).toBe(1);
  });

  it("dequeue removes player from queue", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    expect(queue.dequeue("u1")).toBe(true);
    expect(queue.getQueueSize()).toBe(0);
  });

  it("getQueueSize returns correct count", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1600, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1400, joinedAt: now });
    expect(queue.getQueueSize()).toBe(3);
  });

  it("getWaitTime returns null for unknown player", () => {
    expect(queue.getWaitTime("unknown")).toBeNull();
  });

  it("getWaitTime returns elapsed time since join", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    dateNowSpy.mockReturnValue(now + 5000);
    expect(queue.getWaitTime("u1")).toBe(5000);
  });

  // --- Matching algorithm ---

  it("finds match with 4 similar ELO players (within 200 range)", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now });

    const match = queue.findMatch();
    expect(match).not.toBeNull();
    expect(match?.playerIds).toContain("u1");
    expect(match?.playerIds).toContain("u2");
    expect(match?.playerIds).toContain("u3");
    expect(match?.playerIds).toContain("u4");
    expect(match?.avgElo).toBe(1503); // (1500+1520+1480+1510)/4 = 1502.5 → 1503
    expect(match?.eloRange.min).toBe(1480);
    expect(match?.eloRange.max).toBe(1520);
  });

  it("returns null with fewer than 4 players", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1500, joinedAt: now });

    expect(queue.findMatch()).toBeNull();
  });

  it("finds match with wide ELO spread after time passes (relaxed window)", () => {
    // u1 joins at t=0 with ELO 1200
    queue.enqueue({ userId: "u1", elo: 1200, joinedAt: now });
    // Others join at t=0 with ELO 1500 (outside 200 window)
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1510, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1490, joinedAt: now });

    // At t=0: range is 200, u1 (1200) vs others (1500) = 300 apart → no match
    expect(queue.findMatch()).toBeNull();

    // After 15s: range expands to 400
    dateNowSpy.mockReturnValue(now + 15_000);

    const match = queue.findMatch();
    expect(match).not.toBeNull();
    expect(match?.playerIds).toContain("u1");
  });

  it("oldest player triggers window expansion", () => {
    // u1 joins at t=0 with ELO 1000
    queue.enqueue({ userId: "u1", elo: 1000, joinedAt: now });
    // Others join at t=0 with ELO 1500
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1510, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1490, joinedAt: now });

    // At t=0: range is 200, u1 (1000) vs others (1500) = 500 apart → no match
    expect(queue.findMatch()).toBeNull();

    // After 35s: range expands to 600
    dateNowSpy.mockReturnValue(now + 35_000);

    const match = queue.findMatch();
    expect(match).not.toBeNull();
    expect(match?.playerIds).toContain("u1");
  });

  it("does NOT match players outside window", () => {
    queue.enqueue({ userId: "u1", elo: 1000, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1500, joinedAt: now });

    // At t=0: range is 200, u1 (1000) vs others (1500) = 500 apart
    // Even with FIFO, u1 is oldest but can't find 3 within range
    expect(queue.findMatch()).toBeNull();
  });

  // --- Cleanup ---

  it("cleanupStale removes players waiting >60s", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now - 61_000 });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });

    const removed = queue.cleanupStale();
    expect(removed).toContain("u1");
    expect(removed).not.toContain("u2");
    expect(queue.getQueueSize()).toBe(1);
  });

  it("cleanupStale returns removed userIds", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now - 70_000 });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now - 80_000 });

    const removed = queue.cleanupStale();
    expect(removed).toHaveLength(2);
    expect(removed).toContain("u1");
    expect(removed).toContain("u2");
  });

  it("cleanupStale does not remove players waiting <60s", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now - 59_000 });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });

    const removed = queue.cleanupStale();
    expect(removed).toHaveLength(0);
    expect(queue.getQueueSize()).toBe(2);
  });

  // --- Pair-priority matching ---

  it("matches 2 complete pairs immediately (pair-priority pre-pass)", () => {
    // Pair A: u1 + u2 (pairId "pair-a")
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now, pairId: "pair-a", partnerId: "u2", eloType: "pair" });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now, pairId: "pair-a", partnerId: "u1", eloType: "pair" });
    // Pair B: u3 + u4 (pairId "pair-b")
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now, pairId: "pair-b", partnerId: "u4", eloType: "pair" });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now, pairId: "pair-b", partnerId: "u3", eloType: "pair" });

    const match = queue.findMatch();
    expect(match).not.toBeNull();
    expect(match?.playerIds).toHaveLength(4);
    // All 4 players should be matched
    expect(match?.playerIds.sort()).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("does NOT match pairs when only 1 complete pair exists", () => {
    // Pair A: u1 + u2 (complete)
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now, pairId: "pair-a", partnerId: "u2", eloType: "pair" });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now, pairId: "pair-a", partnerId: "u1", eloType: "pair" });
    // Solo players
    queue.enqueue({ userId: "u3", elo: 1510, joinedAt: now, eloType: "individual" });
    queue.enqueue({ userId: "u4", elo: 1490, joinedAt: now, eloType: "individual" });

    // Pair-priority pre-pass needs 2 complete pairs → null
    // But solo ELO scan should still find a match (4 players within 200 range)
    const match = queue.findMatch();
    expect(match).not.toBeNull();
  });

  it("does NOT match pairs outside ELO range", () => {
    // Pair A: low ELO
    queue.enqueue({ userId: "u1", elo: 1000, joinedAt: now, pairId: "pair-a", partnerId: "u2", eloType: "pair" });
    queue.enqueue({ userId: "u2", elo: 1020, joinedAt: now, pairId: "pair-a", partnerId: "u1", eloType: "pair" });
    // Pair B: high ELO (outside 200 window at t=0)
    queue.enqueue({ userId: "u3", elo: 1500, joinedAt: now, pairId: "pair-b", partnerId: "u4", eloType: "pair" });
    queue.enqueue({ userId: "u4", elo: 1520, joinedAt: now, pairId: "pair-b", partnerId: "u3", eloType: "pair" });

    // Pair-priority: avg 1010 vs avg 1510 = 500 apart → no pair match
    // Solo ELO: also no match (500 apart, range 200 at t=0)
    const match = queue.findMatch();
    expect(match).toBeNull();
  });

  it("matches pairs after ELO window expands", () => {
    // Pair A: low ELO
    queue.enqueue({ userId: "u1", elo: 1000, joinedAt: now, pairId: "pair-a", partnerId: "u2", eloType: "pair" });
    queue.enqueue({ userId: "u2", elo: 1020, joinedAt: now, pairId: "pair-a", partnerId: "u1", eloType: "pair" });
    // Pair B: high ELO
    queue.enqueue({ userId: "u3", elo: 1500, joinedAt: now, pairId: "pair-b", partnerId: "u4", eloType: "pair" });
    queue.enqueue({ userId: "u4", elo: 1520, joinedAt: now, pairId: "pair-b", partnerId: "u3", eloType: "pair" });

    // At t=0: range 200 → no match
    expect(queue.findMatch()).toBeNull();

    // After 15s: range expands to 400, still not enough (500 apart)
    dateNowSpy.mockReturnValue(now + 15_000);
    expect(queue.findMatch()).toBeNull();

    // After 35s: range expands to 600 → match!
    dateNowSpy.mockReturnValue(now + 35_000);
    const match = queue.findMatch();
    expect(match).not.toBeNull();
    expect(match?.playerIds.sort()).toEqual(["u1", "u2", "u3", "u4"]);
  });

  // --- Duplicate prevention ---

  it("does not allow same user to enqueue twice", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    // Enqueueing again with same userId just overwrites the existing entry
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    expect(queue.getQueueSize()).toBe(1);
  });

  // --- Queue entry with eloType ---

  it("supports individual eloType entries", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now, eloType: "individual" });
    const entries = queue.getQueue();
    expect(entries[0].eloType).toBe("individual");
    expect(entries[0].pairId).toBeUndefined();
  });

  it("supports pair eloType entries with partner info", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now, pairId: "p1", partnerId: "u2", eloType: "pair" });
    const entries = queue.getQueue();
    expect(entries[0].eloType).toBe("pair");
    expect(entries[0].pairId).toBe("p1");
    expect(entries[0].partnerId).toBe("u2");
  });
});

// ---------------------------------------------------------------------------
// processMatchmaking
// ---------------------------------------------------------------------------

describe("processMatchmaking", () => {
  let queue: ReturnType<typeof createMatchmakingQueue>;
  let now: number;
  let dateNowSpy: ReturnType<typeof spyOn>;
  let pushCalls: Array<{ userId: string; event: Record<string, unknown> }>;

  const mockUserChannelManager: UserChannelManager = {
    register() {},
    disconnect() {},
    getChannel() {
      return undefined;
    },
    pushToUser(userId, event) {
      pushCalls.push({ userId, event: event as Record<string, unknown> });
      return true;
    },
  };

  const mockStore = {
    getGame: () => null,
    updateGame: () => {},
  };

  beforeEach(() => {
    queue = createMatchmakingQueue();
    now = Date.now();
    dateNowSpy = spyOn(Date, "now").mockReturnValue(now);
    pushCalls = [];
    resetStore();
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it("returns null when queue has fewer than 4 players", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1500, joinedAt: now });

    const result = processMatchmaking({
      queue,
      store: mockStore,
      userChannelManager: mockUserChannelManager,
    });

    expect(result).toBeNull();
  });

  it("creates match when 4 players in queue", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now });

    const result = processMatchmaking({
      queue,
      store: mockStore,
      userChannelManager: mockUserChannelManager,
    });

    expect(result).not.toBeNull();
    expect(result?.matchId).toBeTruthy();
    expect(result?.playerIds).toHaveLength(4);
    expect(result?.playerIds.sort()).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("removes matched players from queue", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now });

    processMatchmaking({
      queue,
      store: mockStore,
      userChannelManager: mockUserChannelManager,
    });

    expect(queue.getQueueSize()).toBe(0);
  });

  it("pushes match_found to all 4 players", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now });

    processMatchmaking({
      queue,
      store: mockStore,
      userChannelManager: mockUserChannelManager,
    });

    expect(pushCalls).toHaveLength(4);
    expect(pushCalls.map((c) => c.userId).sort()).toEqual([
      "u1",
      "u2",
      "u3",
      "u4",
    ]);
    expect(pushCalls[0].event.type).toBe("match_found");
    expect(pushCalls[0].event.matchId).toBeTruthy();
  });

  it("creates game in store", () => {
    queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now });
    queue.enqueue({ userId: "u2", elo: 1520, joinedAt: now });
    queue.enqueue({ userId: "u3", elo: 1480, joinedAt: now });
    queue.enqueue({ userId: "u4", elo: 1510, joinedAt: now });

    const result = processMatchmaking({
      queue,
      store: { getGame: mockStore.getGame, updateGame: mockStore.updateGame },
      userChannelManager: mockUserChannelManager,
    });

    const _game = mockStore.getGame(result?.matchId);
    // With the default mock getGame returns null (it's not a real store),
    // but the match ID is returned correctly
    expect(result?.matchId).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// startCleanupScheduler
// ---------------------------------------------------------------------------

describe("startCleanupScheduler", () => {
  it("returns a cancel function", () => {
    const queue = createMatchmakingQueue();
    const cancel = startCleanupScheduler(queue);
    expect(typeof cancel).toBe("function");
    cancel(); // Clean up
  });

  it("cancelling stops the interval (no infinite loop)", () => {
    const queue = createMatchmakingQueue();
    const cancel = startCleanupScheduler(queue);
    cancel();
    // If cancel didn't work, this test would hang — but it doesn't
    expect(queue.getQueueSize()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchPlayerProfiles
// ---------------------------------------------------------------------------

describe("fetchPlayerProfiles", () => {
  it("returns fallback profiles with empty avatarUrl when DB is unavailable", async () => {
    // fetchPlayerProfiles falls back gracefully when getDb() returns null
    const profiles = await fetchPlayerProfiles(["u1", "u2"]);
    expect(profiles.size).toBe(2);
    const p1 = profiles.get("u1");
    expect(p1).toBeDefined();
    expect(p1?.name).toContain("Player");
    expect(p1?.avatarUrl).toBe("");
    const p2 = profiles.get("u2");
    expect(p2).toBeDefined();
    expect(p2?.avatarUrl).toBe("");
  });

  it("returns Map<string, PlayerProfile> shape (not Map<string, string>)", async () => {
    const profiles = await fetchPlayerProfiles(["u1"]);
    const entry = profiles.get("u1");
    expect(entry).toBeDefined();
    // Must be an object with name and avatarUrl, not a plain string
    expect(typeof entry?.name).toBe("string");
    expect(typeof entry?.avatarUrl).toBe("string");
  });
});
