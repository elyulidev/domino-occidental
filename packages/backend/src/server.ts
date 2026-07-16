import type { SendFn } from "@domino/shared";
import {
	checkTimeout,
	createDeck,
	deal,
	initializeMatch,
	shuffle,
	startHand,
} from "@domino/shared/game";
import { Elysia } from "elysia";
import { authErrorHandler, authGuard } from "./auth/guard";
import { checkAbandonment, disconnectPlayer } from "./game/connection";
import {
	createMatchmakingQueue,
	fetchPlayerProfiles,
	MATCH_FOUND_TIMEOUT_MS,
	processMatchmaking,
	startCleanupScheduler,
} from "./game/matchmaking";
import { createGame, getGame, getPlayerProfiles, removeGame, setPlayerProfiles, updateGame } from "./game/store";
import { matchmakingRoutes } from "./routes/matchmaking";

import { broadcastEvents } from "./ws/broadcaster";
import {
	createConnectionManager,
	createWsPlugin,
	sendToPlayer,
	type WsPlugin,
} from "./ws/connection";
import { matchmakingWsHandler } from "./ws/matchmaking-ws";
import { createTimerManager } from "./ws/timer-manager";
import { createUserChannelManager } from "./ws/user-channel";

const PORT = Number(Bun.env.PORT) || 3001;

const store = { getGame, updateGame };

// ---------------------------------------------------------------------------
// Matchmaking queue + cleanup scheduler
// ---------------------------------------------------------------------------
const matchmakingQueue = createMatchmakingQueue();
const cancelCleanup = startCleanupScheduler(matchmakingQueue);

// ---------------------------------------------------------------------------
// User channel manager (push notifications for matchmaking)
// ---------------------------------------------------------------------------
const userChannelManager = createUserChannelManager();

// ---------------------------------------------------------------------------
// Connection manager + SendFn (shared by WS plugin and TimerManager)
// ---------------------------------------------------------------------------
const connectionManager = createConnectionManager();

const sendFn: SendFn = (playerId, event) =>
	sendToPlayer(connectionManager, playerId, event);

// ---------------------------------------------------------------------------
// Timer manager — handles turn timeout (45s), heartbeat, and abandonment
// ---------------------------------------------------------------------------
const timerManager = createTimerManager({
	store,
	broadcastEvents,
	sendFn,
	checkTimeout,
	disconnectPlayer,
	checkAbandonment,
	getConnectionReadyState: (playerId: string) => {
		const ws = connectionManager.getConnection(playerId);
		if (!ws) return -1;
		try {
			return (ws as unknown as { raw?: { readyState?: number } }).raw
				?.readyState ?? -1;
		} catch {
			return -1;
		}
	},
});

// ---------------------------------------------------------------------------
// WS plugin (game WS)
// ---------------------------------------------------------------------------
const plugin: WsPlugin = createWsPlugin({
	store,
	connectionManager,
	timerManager,
	disconnectPlayer,
});

// ---------------------------------------------------------------------------
// Matchmaker loop — runs every 2s, finds matches, pushes match_found
// ---------------------------------------------------------------------------
const pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const matchmakerInterval = setInterval(() => {
	const matchCreated = processMatchmaking({
		queue: matchmakingQueue,
		store,
		userChannelManager,
	});

	if (!matchCreated) return;

	const { matchId, playerIds } = matchCreated;

	// Fetch player profiles (async, non-blocking — profiles will be available
	// before the match transitions from "waiting" to "in_progress")
	fetchPlayerProfiles(playerIds).then((profiles) => {
		setPlayerProfiles(matchId, profiles);
		// Apply names to the stored match state so sanitizeState includes them
		const match = getGame(matchId);
		if (match) {
			const namedPlayers = match.players.map((p) => ({
				...p,
				name: profiles.get(p.id)?.name ?? undefined,
			})) as typeof match.players;
			match.players = namedPlayers;
			updateGame(matchId, match);
		}
	});

	// Start 30s connection timeout
	const timeout = setTimeout(() => {
		pendingTimeouts.delete(matchId);

		// Check how many players connected to the game WS
		const connected = connectionManager.getPlayerIdsForMatch(matchId);
		if (connected.length >= 4) {
			// All connected — timeout is moot (shouldn't happen, but defensive)
			return;
		}

		// Not enough players — cancel match and re-enqueue
		console.warn(
			`[matchmaker] Match ${matchId} timed out: only ${connected.length}/4 players connected`,
		);

		// Remove match from game store
		removeGame(matchId);

		// Re-enqueue all 4 players (best-effort with default ELO)
		for (const playerId of playerIds) {
			matchmakingQueue.enqueue({
				userId: playerId,
				elo: 1200, // Default ELO — TODO: fetch from profile on re-queue
				joinedAt: Date.now(),
				eloType: "individual",
			});
		}

		// Push match_cancelled event to all players
		for (const playerId of playerIds) {
			userChannelManager.pushToUser(playerId, {
				type: "match_cancelled",
				matchId,
				reason: "connection_timeout",
			});
		}
	}, MATCH_FOUND_TIMEOUT_MS);

	pendingTimeouts.set(matchId, timeout);
}, 2_000);

// ---------------------------------------------------------------------------
// Matchmaking WS handler
// ---------------------------------------------------------------------------
const matchmakingWs = matchmakingWsHandler({ userChannelManager });

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Elysia()
	.onError(authErrorHandler)
	.get("/health", () => ({
		status: "ok",
		timestamp: new Date().toISOString(),
	}))
	// -----------------------------------------------------------------------
	// Dev endpoint: create a match for local testing (no auth, no rate limit)
	// -----------------------------------------------------------------------
	.post("/api/v1/dev/create-match", () => {
		const deck = shuffle(createDeck());
		const { hands, pool } = deal(deck);

		const matchId = crypto.randomUUID();
		let { match } = initializeMatch(matchId, hands, pool);

		// Start the first hand
		const handResult = startHand(match);
		match = handResult.match;

		createGame(matchId, match);

		return { matchId };
	})
	// -----------------------------------------------------------------------
	// Authenticated routes — JWT required
	// -----------------------------------------------------------------------
	.group("/api/v1", (app) =>
		app.use(authGuard()).use(matchmakingRoutes(matchmakingQueue)),
	)
	// Game WS route: playerId comes from path param (dev) or JWT (auth)
	// biome-ignore lint/suspicious/noExplicitAny: Elysia WS handler type mismatch with WsPlugin.ws shape
	.ws("/ws/game/:matchId/:playerId", plugin.ws as any)
	// Matchmaking WS route: lightweight per-user push channel
	// biome-ignore lint/suspicious/noExplicitAny: Elysia WS handler type mismatch
	.ws("/ws/matchmaking/:userId", matchmakingWs as any)
	.listen(PORT);

console.log(
	`[server] Backend running on http://${app.server?.hostname}:${PORT}`,
);

// ---------------------------------------------------------------------------
// Cancel matchmaker timeout when all 4 players connect to game WS
// ---------------------------------------------------------------------------
// Intercept game WS open to check for pending match timeouts
const gameWsOpen = plugin.ws.open;
plugin.ws.open = (ws) => {
	gameWsOpen(ws);

	// After game WS open, check if this completes a match
	const matchId = (ws.data as Record<string, unknown>).matchId as
		| string
		| undefined;
	if (matchId && pendingTimeouts.has(matchId)) {
		const connected = connectionManager.getPlayerIdsForMatch(matchId);
		if (connected.length >= 4) {
			// All 4 connected — cancel the timeout
			const timeout = pendingTimeouts.get(matchId);
			if (timeout) {
				clearTimeout(timeout);
				pendingTimeouts.delete(matchId);
			}
		}
	}
};

// Graceful shutdown — stop matchmaker, cleanup scheduler, and pending timeouts
process.on("SIGINT", () => {
	clearInterval(matchmakerInterval);
	cancelCleanup();
	for (const timeout of pendingTimeouts.values()) {
		clearTimeout(timeout);
	}
	process.exit(0);
});
