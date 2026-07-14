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
import { createGame, getGame, updateGame } from "./game/store";

import { broadcastEvents } from "./ws/broadcaster";
import {
	createConnectionManager,
	createWsPlugin,
	sendToPlayer,
	type WsPlugin,
} from "./ws/connection";
import { createTimerManager } from "./ws/timer-manager";

const PORT = Number(Bun.env.PORT) || 3001;

const store = { getGame, updateGame };

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
// WS plugin
// ---------------------------------------------------------------------------
const plugin: WsPlugin = createWsPlugin({
	store,
	connectionManager,
	timerManager,
	disconnectPlayer,
});

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
	.group("/api/v1", (app) => app.use(authGuard()))
	// Single WS route: playerId comes from path param (dev) or JWT (auth)
	// biome-ignore lint/suspicious/noExplicitAny: Elysia WS handler type mismatch with WsPlugin.ws shape
	.ws("/ws/game/:matchId/:playerId", plugin.ws as any)
	.listen(PORT);

console.log(
	`[server] Backend running on http://${app.server?.hostname}:${PORT}`,
);
