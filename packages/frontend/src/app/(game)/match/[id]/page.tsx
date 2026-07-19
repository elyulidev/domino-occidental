"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { GameBoard } from "@/components/game/game-board";
import { GameStatusOverlay } from "@/components/game/game-status-overlay";
import { HandOverModal } from "@/components/game/hand-over-modal";
import { LeaveMatchConfirmModal } from "@/components/game/leave-match-confirm-modal";
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
	const matchAbandonedBy = useGameStore((s) => s.game.matchAbandonedBy);
	const players = useGameStore((s) => s.game.players);
	const isMatchOver = status === "finished" || status === "abandoned" || matchAbandonedBy !== null;

	// Always call hooks (rules of hooks)
	const wsHook = useWebSocket(params.id ?? "", playerId, false);

	// Leave-match modal state
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
			reset();
		};
	}, [reset]);

	// Navigate to lobby when match is abandoned by any player
	useEffect(() => {
		if (status === "abandoned") {
			// Clear any pending leave timeout
			if (leaveTimeoutRef.current) {
				clearTimeout(leaveTimeoutRef.current);
				leaveTimeoutRef.current = null;
			}
			const timer = setTimeout(() => {
				reset();
				router.push("/lobby");
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [status, reset, router]);

	const handleBackToLobby = useCallback(() => {
		reset();
		router.push("/lobby");
	}, [reset, router]);

	const handleLeaveMatch = useCallback(() => {
		if (isMatchOver) return;
		setShowLeaveModal(true);
	}, [isMatchOver]);

	const handleConfirmLeave = useCallback(() => {
		setShowLeaveModal(false);
		// Guard: don't send leave if match is already over
		if (isMatchOver) return;
		// Send leave message to server via WebSocket
		wsHook.send({ type: "leave" });
		// Timeout fallback: if no match_abandoned event within 5s, navigate to lobby
		leaveTimeoutRef.current = setTimeout(() => {
			const currentStatus = useGameStore.getState().game.status;
			if (currentStatus !== "abandoned") {
				reset();
				router.push("/lobby");
			}
		}, 5_000);
	}, [wsHook, reset, router, isMatchOver]);

	// Resolve the player name who left for the AbandonedScreen
	const abandonedPlayerName = matchAbandonedBy
		? players.find((p) => p.id === matchAbandonedBy)?.name
		: undefined;

	const view = resolvePageView(status);

	// Loading state
	if (view === "loading") {
	return (
		<LoadingScreen wsStatus={wsHook.status} playerId={playerId} />
	);
	}

	// Abandoned state
	if (view === "abandoned") {
		return <AbandonedScreen onBack={handleBackToLobby} abandonedByPlayerName={abandonedPlayerName} />;
	}

	// Ready — render game board
	return (
		<div className='relative min-h-screen bg-domino-950 text-domino-50'>
			{/* Grid: 2 rows × 2 columns */}
			<div className='grid grid-rows-[1fr_auto] grid-cols-1 lg:grid-cols-[280px_1fr] gap-2 p-2 h-screen max-h-screen'>
				{/* Row 1: Board (spans both columns) */}
				<div className='lg:col-span-2 min-h-0'>
					<GameBoard />
				</div>

				{/* Row 2, Col 1: ScorePanel */}
				<div className='hidden lg:block h-full'>
					<ScorePanel />
				</div>

				{/* Row 2, Col 2: PlayerHand */}
				<div className='relative min-h-0' data-hand-area>
					<PlayerHand />

					{/* Leave match button — bottom right, floating over hand */}
					<div className='absolute bottom-2 right-2 z-20'>
						<button
							type='button'
							onClick={handleLeaveMatch}
							disabled={isMatchOver}
							className='rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-500/10 disabled:hover:text-red-400'
						>
							Leave Match
						</button>
					</div>
				</div>
			</div>

			{/* Overlays */}
			<GameStatusOverlay />
			<HandOverModal />
			<LeaveMatchConfirmModal
				isOpen={showLeaveModal}
				onClose={() => setShowLeaveModal(false)}
				onConfirm={handleConfirmLeave}
			/>
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

function AbandonedScreen({
	onBack,
	abandonedByPlayerName,
}: {
	onBack: () => void;
	abandonedByPlayerName?: string;
}) {
	// TODO: All players must have username (not email) for proper display
	const message = abandonedByPlayerName
		? `${abandonedByPlayerName} left the match`
		: "A player left the match";

	return (
		<div className='min-h-screen bg-domino-950 flex items-center justify-center'>
			<div className='bg-domino-900/60 border border-domino-700/50 rounded-2xl p-8 text-center max-w-md'>
				<h2 className='text-2xl font-bold text-domino-50 mb-2'>
					Match Abandoned
				</h2>
				<p className='text-domino-300 mb-6'>
					{message}. ELO penalty has been applied.
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
