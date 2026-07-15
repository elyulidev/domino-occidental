export interface ProfileResponse {
  id: string;
  username: string;
  avatar_url: string | null;
  elo: number;
  coins: number;
  country: string | null;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  elo: number;
  avatar_url: string | null;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  totalPages: number;
}

/** Friend with profile data, queried from friendships + profiles join */
export interface FriendEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  elo: number;
  status: string;
  /** TODO: wire to Realtime presence */
  online_status?: string;
}

/** Tournament from the tournaments table */
export interface TournamentEntry {
  id: string;
  name: string;
  status: string;
  bracket_type: string;
  entry_fee: number | null;
  starts_at: string | null;
  /** Derived for display */
  pairs_count: number;
  prize_display: string;
  phase_display: string;
}

/** Lobby data bundle — fetched in parallel */
export interface LobbyData {
  profile: ProfileResponse | null;
  leaderboard: LeaderboardEntry[];
  friends: FriendEntry[];
  tournaments: TournamentEntry[];
}

// ---------------------------------------------------------------------------
// Matchmaking (re-exported from @domino/shared for convenience)
// ---------------------------------------------------------------------------

export type {
  MatchFoundPayload,
  MatchmakingStatusResponse,
} from "@domino/shared";
