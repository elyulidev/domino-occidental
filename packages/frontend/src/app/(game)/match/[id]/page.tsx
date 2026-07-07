"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { GameBoard } from "@/components/game/game-board";
import { GameStatusOverlay } from "@/components/game/game-status-overlay";
import { HandOverModal } from "@/components/game/hand-over-modal";
import { OpponentIndicator } from "@/components/game/opponent-indicator";
import { PlayerHand } from "@/components/game/player-hand";
import { ScorePanel } from "@/components/game/score-panel";
import { TurnTimer } from "@/components/game/turn-timer";
import type { WsStatus } from "@/hooks/use-websocket";
import { useWebSocket } from "@/hooks/use-websocket";
import { useGameStore } from "@/stores/game-store";
import { resolveMatchMode, resolvePageView } from "./page-helpers";

// ---------------------------------------------------------------------------
// Page (Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

export default function MatchPage() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<MatchContent />
		</Suspense>
	);
}

// ---------------------------------------------------------------------------
// Inner component — uses useSearchParams (requires Suspense boundary)
// ---------------------------------------------------------------------------

function MatchContent() {
	const params = useParams<{ id: string }>();
	const searchParams = useSearchParams();
	const router = useRouter();

	const rawPlayerId = searchParams.get("playerId");
	const playerId = rawPlayerId ?? "p0";
	const mode = resolveMatchMode(searchParams.get("mode"), rawPlayerId);

	const initEngine = useGameStore((s) => s.initEngine);
	const reset = useGameStore((s) => s.reset);
	const status = useGameStore((s) => s.game.status);
	const _scores = useGameStore((s) => s.game.scores);
	const _roundNumber = useGameStore((s) => s.game.turn.roundNumber);

	// Always call hooks (rules of hooks), but disable WS in local mode
	const wsHook = useWebSocket(params.id ?? "", playerId, mode !== "online");

	// Online mode: the useWebSocket hook wires the engine and store internally
	// via setEngine + applyWsUpdate on first game_events message.

	// Local mode: initialize engine on mount, clean up on unmount
	useEffect(() => {
		if (mode !== "local" || !params.id) return;

		const matchState = createDealtMatch(params.id);
		initEngine(matchState);

		return () => {
			reset();
		};
	}, [params.id, mode, initEngine, reset]);

	const handleBackToLobby = useCallback(() => {
		reset();
		router.push("/lobby");
	}, [reset, router]);

	const view = resolvePageView(status);

	// Loading state
	if (view === "loading") {
		return (
			<LoadingScreen wsStatus={wsHook.status} mode={mode} playerId={playerId} />
		);
	}

	// Abandoned state
	if (view === "abandoned") {
		return <AbandonedScreen onBack={handleBackToLobby} />;
	}

	// Ready — render game board
	return (
		<div className='relative min-h-screen bg-domino-950 text-domino-50'>
			{/* Player badge — helps identify which player this tab controls */}
			<div className='pointer-events-none absolute top-1 left-1 z-10 flex items-center gap-2'>
				<span className='inline-flex items-center gap-1.5 rounded-full bg-gold-500/10 border border-gold-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-gold-300'>
					<span className='h-1.5 w-1.5 rounded-full bg-gold-400' />
					You: {playerId.toUpperCase()}
				</span>
				<span className='inline-flex items-center gap-1.5 text-[10px] text-domino-500 pointer-events-auto'>
					<span>+ open:</span>
					{["p1", "p2", "p3"].map((id) => (
						<Link
							key={id}
							href={`/match/${params.id}?playerId=${id}${mode === "local" ? "&mode=local" : ""}`}
							target='_blank'
							rel='noopener noreferrer'
							className='rounded bg-domino-800/60 px-1.5 py-0.5 font-mono text-gold-400 transition-colors hover:bg-domino-700 hover:text-gold-300'
						>
							{id}
						</Link>
					))}
				</span>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 p-4 h-screen max-h-screen'>
				{/* Left: Sidebar (ScorePanel + TurnTimer + Opponents) */}
				<div className='hidden lg:flex lg:flex-col lg:gap-3 lg:overflow-y-auto'>
					<ScorePanel />
					<TurnTimer compact />
					<div className='border-t border-domino-700/50' />
					<OpponentIndicator direction='vertical' />
				</div>

				{/* Center: Game Area */}
				<div className='flex flex-col gap-4 min-h-0'>
					{/* Opponents — mobile only */}
					<div className='flex lg:hidden justify-center gap-4'>
						<OpponentIndicator />
					</div>

					{/* Board */}
					<div className='flex-1 min-h-0'>
						<GameBoard />
					</div>

					{/* Hand */}
					<PlayerHand />
				</div>
			</div>

			{/* Overlays */}
			<GameStatusOverlay />
			<HandOverModal />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Loading & Error sub-components
// ---------------------------------------------------------------------------

function LoadingScreen({
	wsStatus,
	mode,
	playerId,
}: {
	wsStatus?: WsStatus;
	mode?: string;
	playerId?: string;
}) {
	return (
		<div className='min-h-screen bg-domino-950 flex items-center justify-center'>
			<div className='text-center max-w-sm'>
				<div className='animate-spin w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4' />
				<p className='text-domino-300 text-lg mb-2'>Starting game...</p>

				{/* Diagnostic info */}
				<div className='mt-6 space-y-1 text-xs font-mono flex flex-col items-center'>
					{wsStatus === "connected" && (
						<span className='inline-flex items-center gap-1.5 text-green-400'>
							<span className='h-2 w-2 rounded-full bg-green-400' />
							WS: connected
						</span>
					)}
					{wsStatus === "connecting" && (
						<span className='inline-flex items-center gap-1.5 text-yellow-400'>
							<span className='h-2 w-2 rounded-full bg-yellow-400' />
							WS: connecting
						</span>
					)}
					{wsStatus === "disconnected" && (
						<span className='inline-flex items-center gap-1.5 text-red-400'>
							<span className='h-2 w-2 rounded-full bg-red-400' />
							WS: disconnected
						</span>
					)}
					{!wsStatus && (
						<span className='inline-flex items-center gap-1.5 text-domino-500'>
							<span className='h-2 w-2 rounded-full bg-domino-500' />
							WS: —
						</span>
					)}
					<span className='text-domino-500'>Mode: {mode ?? "—"}</span>
					<span className='text-domino-500'>Player: {playerId ?? "—"}</span>
				</div>

				{wsStatus === "disconnected" && (
					<p className='mt-4 text-xs text-red-400/80 max-w-xs mx-auto'>
						WebSocket is disconnected. Make sure the backend is running on port
						3001 and refresh the page.
					</p>
				)}

				{wsStatus === "connected" && (
					<p className='mt-4 text-xs text-domino-400 max-w-xs mx-auto'>
						WebSocket connected. Waiting for the game server to send the initial
						state.
					</p>
				)}
			</div>
		</div>
	);
}

function AbandonedScreen({ onBack }: { onBack: () => void }) {
	return (
		<div className='min-h-screen bg-domino-950 flex items-center justify-center'>
			<div className='bg-domino-900/60 border border-domino-700/50 rounded-2xl p-8 text-center max-w-md'>
				<h2 className='text-2xl font-bold text-domino-50 mb-2'>
					Match Abandoned
				</h2>
				<p className='text-domino-300 mb-6'>
					This match has been abandoned. ELO penalty has been applied.
				</p>
				<button
					type='button'
					onClick={onBack}
					className='bg-gold-500 hover:bg-gold-600 text-domino-950 font-bold px-6 py-3 rounded-xl transition-colors'
				>
					Back to Lobby
				</button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Local match state builder (temporary — replaced by server fetch later)
// Generates a proper shuffled deal from a real double-9 deck.
// ---------------------------------------------------------------------------

import type { MatchState } from "@domino/shared";
import {
	createDeck,
	deal,
	initializeMatch,
	shuffle,
	startHand,
} from "@domino/shared/src/game";

function createDealtMatch(matchId: string): MatchState {
	const deck = shuffle(createDeck()); // 55 tiles aleatorios
	const { hands, pool } = deal(deck); // 4×10 + 15 pool
	const { match } = initializeMatch(matchId, hands, pool);
	const { match: withHand } = startHand(match);
	// Mark all players as connected for local play (no WS to auto-set isConnected)
	return {
		...withHand,
		players: withHand.players.map((p) => ({
			...p,
			isConnected: true,
		})) as typeof withHand.players,
	};
}
