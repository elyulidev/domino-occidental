"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect } from "react";
import { GameBoard } from "@/components/game/game-board";
import { GameStatusOverlay } from "@/components/game/game-status-overlay";
import { HandOverModal } from "@/components/game/hand-over-modal";
import { PlayerHand } from "@/components/game/player-hand";
import { ScorePanel } from "@/components/game/score-panel";
import type { WsStatus } from "@/hooks/use-websocket";
import { useWebSocket } from "@/hooks/use-websocket";
import { useGameStore } from "@/stores/game-store";
import { resolvePageView } from "./page-helpers";

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

	const reset = useGameStore((s) => s.reset);
	const status = useGameStore((s) => s.game.status);

	// Always call hooks (rules of hooks)
	const wsHook = useWebSocket(params.id ?? "", playerId, false);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			reset();
		};
	}, [reset]);

	const handleBackToLobby = useCallback(() => {
		reset();
		router.push("/lobby");
	}, [reset, router]);

	const handleLeaveMatch = useCallback(() => {
		// Close WebSocket connection
		if (wsHook.engine) {
			wsHook.engine.destroy();
		}
		// Notify server of forfeit (best-effort, non-blocking)
		if (params.id) {
			fetch(`/api/v1/matches/${params.id}/forfeit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}).catch(() => {
				// Ignore errors — server will detect disconnection anyway
			});
		}
		reset();
		router.push("/lobby");
	}, [wsHook.engine, params.id, reset, router]);

	const view = resolvePageView(status);

	// Loading state
	if (view === "loading") {
	return (
		<LoadingScreen wsStatus={wsHook.status} playerId={playerId} />
	);
	}

	// Abandoned state
	if (view === "abandoned") {
		return <AbandonedScreen onBack={handleBackToLobby} />;
	}

	// Ready — render game board
	return (
		<div className='relative min-h-screen bg-domino-950 text-domino-50'>
			{/* Leave match button — top right */}
			<div className='absolute top-2 right-2 z-20'>
				<button
					type='button'
					onClick={handleLeaveMatch}
					className='rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300'
				>
					Leave Match
				</button>
			</div>

			{/* Grid: 2 rows × 2 columns */}
			<div className='grid grid-rows-[1fr_auto] grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 p-2 h-screen max-h-screen'>
				{/* Row 1: Board (spans both columns) */}
				<div className='lg:col-span-2 min-h-0'>
					<GameBoard />
				</div>

				{/* Row 2, Col 1: ScorePanel */}
				<div className='hidden lg:block'>
					<ScorePanel />
				</div>

				{/* Row 2, Col 2: PlayerHand */}
				<div className='min-h-0'>
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
	playerId,
}: {
	wsStatus?: WsStatus;
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
