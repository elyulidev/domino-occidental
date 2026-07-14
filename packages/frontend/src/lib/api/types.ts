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
