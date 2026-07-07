"use client";

import type { Tile } from "@domino/shared";
import { useGameStore } from "@/stores/game-store";
import { DominoTile } from "./domino-tile";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute opponent display data for the three non-human players.
 *
 * Player indices: human=0, opponents=1,2,3.
 * Pair assignment: Pair 0 = P0+P2, Pair 1 = P1+P3.
 */
export interface OpponentInfo {
	label: string;
	index: number;
	handSize: number;
	isConnected: boolean;
	pairLabel: string;
}

export function computeOpponents(
	players: Array<{ id: string; handSize: number; isConnected: boolean }>,
	_boardTileCount: number,
	playerIndex: number = 0,
): OpponentInfo[] {
	// Show the 3 players that are NOT the human player
	const indices = [0, 1, 2, 3].filter((i) => i !== playerIndex);
	return indices.map((i) => {
		const player = players[i] ?? { handSize: 10, isConnected: true };
		const pairLabel = i % 2 === 0 ? "Pair 0" : "Pair 1";
		return {
			label: player.id ? player.id.toUpperCase() : `P${i + 1}`,
			index: i,
			handSize: player.handSize,
			isConnected: player.isConnected,
			pairLabel,
		};
	});
}

/** Position class for the opponent card based on index. */
export function opponentPositionClass(index: number): string {
	const positions = [
		"justify-self-start", // p1 — left
		"justify-self-center", // p2 — center
		"justify-self-end", // p3 — right
	];
	return positions[index - 1] ?? "justify-self-center";
}

/** Player color dot class (green = connected, red = disconnected). */
export function connectionDotClass(isConnected: boolean): string {
	return isConnected ? "bg-green-500" : "bg-red-500";
}

/** Resolve the outer container class based on direction prop. */
export function resolveOpponentContainerClass(
	direction: "horizontal" | "vertical" = "horizontal",
): string {
	if (direction === "vertical") {
		return "flex flex-col items-stretch gap-2";
	}
	return "flex flex-row items-start justify-between gap-4";
}

/** Resolve individual card class based on active state and direction. */
export function resolveOpponentCardClass(
	isActive: boolean,
	direction: "horizontal" | "vertical" = "horizontal",
): string {
	if (direction === "vertical") {
		const activeClass = isActive
			? "border-gold-500/60 bg-domino-800/80 ring-1 ring-gold-500/30"
			: "bg-domino-900/60";
		return `flex flex-row items-center gap-0.5 rounded-xl transition-all p-2 ${activeClass}`;
	}

	const activeClass = isActive
		? "border-gold-500/60 bg-domino-800/80 ring-1 ring-gold-500/30"
		: "border-domino-700/50 bg-domino-900/60";
	return `flex flex-col items-center rounded-xl border p-4 transition-all ${activeClass}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BACK_TILE: Tile = { id: "back", top: 0, bottom: 0 };

export function OpponentIndicator({
	direction = "horizontal",
}: {
	direction?: "horizontal" | "vertical";
} = {}) {
	const players = useGameStore((s) => s.game.players);
	const boardTileCount = useGameStore((s) => s.game.board.tiles.length);
	const currentTurn = useGameStore((s) => s.game.turn.currentTurn);
	const playerIndex = useGameStore((s) => s.game.playerIndex);

	const opponents = computeOpponents(players, boardTileCount, playerIndex);
	const containerClass = resolveOpponentContainerClass(direction);

	return (
		<div className={containerClass}>
			{opponents.map((opp) => {
				const isActive = currentTurn === opp.index;
				const cardClass = resolveOpponentCardClass(isActive, direction);

				return (
					<div key={opp.index} className={cardClass}>
						{/* Face-down domino tile */}
						<DominoTile tile={BACK_TILE} faceDown size='sm' />

						{/* Label + hand size */}
						<div
							className={
								direction === "vertical"
									? "flex flex-col items-start"
									: "flex flex-col items-center"
							}
						>
							<span className='mt-2 text-xs font-semibold text-domino-50'>
								{opp.label}
							</span>
							<span className='mt-0.5 text-[11px] text-domino-400'>
								{opp.handSize} tiles
							</span>
							<span className='mt-1.5 flex items-center gap-1.5'>
								<span
									className={`inline-block h-1.5 w-1.5 rounded-full ${connectionDotClass(opp.isConnected)}`}
								/>
								<span className='text-[10px] text-domino-400'>
									{opp.isConnected ? "Online" : "Offline"}
								</span>
							</span>
						</div>

						{/* Connection dot — hidden in vertical mode for compactness */}
						{/* {direction === "horizontal" && (
							<span className='mt-1.5 flex items-center gap-1.5'>
								<span
									className={`inline-block h-1.5 w-1.5 rounded-full ${connectionDotClass(opp.isConnected)}`}
								/>
								<span className='text-[10px] text-domino-400'>
									{opp.isConnected ? "Online" : "Offline"}
								</span>
							</span>
						)} */}
					</div>
				);
			})}
		</div>
	);
}
