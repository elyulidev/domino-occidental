-- Add elo and coins columns to profiles.
-- Default ELO: 1200 (starting rating). Default coins: 250 (initial balance).
-- Rollback: ALTER TABLE profiles DROP COLUMN elo, DROP COLUMN coins;

ALTER TABLE profiles ADD COLUMN elo INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE profiles ADD COLUMN coins INTEGER NOT NULL DEFAULT 250;

COMMENT ON COLUMN profiles.elo IS 'ELO rating for matchmaking. Starts at 1200.';
COMMENT ON COLUMN profiles.coins IS 'Virtual coin balance for shop and tournaments. Starts at 250.';
