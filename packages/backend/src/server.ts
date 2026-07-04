import { Elysia } from "elysia";

import { createGame, getGame, updateGame } from "./game/store";
import { createWsPlugin } from "./ws/connection";
import {
	createDeck,
	deal,
	initializeMatch,
	shuffle,
	startHand,
} from "@domino/shared/game";

const PORT = Number(Bun.env.PORT) || 3001;

const store = { getGame, updateGame };

const app = new Elysia()
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
	// Single WS route: playerId comes from path param (dev) or JWT (auth)
	.ws("/ws/game/:matchId/:playerId", createWsPlugin({ store }).ws as any)
	.listen(PORT);

console.log(
	`[server] Backend running on http://${app.server?.hostname}:${PORT}`,
);
