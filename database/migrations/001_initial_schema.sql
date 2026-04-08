-- Create bunker database (separate from zitadel database)
CREATE DATABASE IF NOT EXISTS bunker;

-- Use bunker database
\c bunker;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(255) PRIMARY KEY,  -- Zitadel user ID
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    profile_id VARCHAR(255) PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_playtime_minutes INTEGER DEFAULT 0,
    bunker_survival_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_history table
CREATE TABLE IF NOT EXISTS game_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(10) NOT NULL,
    profile_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    game_status VARCHAR(20) NOT NULL, -- 'FINISHED', 'ABANDONED', etc.
    was_exiled BOOLEAN DEFAULT false,
    survived BOOLEAN DEFAULT false,
    final_round INTEGER,
    players_count INTEGER NOT NULL,
    bunker_capacity INTEGER NOT NULL,
    catastrophe_id VARCHAR(100),
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_minutes INTEGER
);

-- Create game_participants table for tracking all players in a game
CREATE TABLE IF NOT EXISTS game_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES game_history(id) ON DELETE CASCADE,
    profile_id VARCHAR(255) REFERENCES profiles(id) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    is_host BOOLEAN DEFAULT false,
    final_role VARCHAR(50), -- 'SURVIVOR', 'EXILED', etc.
    traits_revealed INTEGER DEFAULT 0,
    votes_received INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_guest ON profiles(is_guest);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login);
CREATE INDEX IF NOT EXISTS idx_game_history_profile_id ON game_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON game_history(played_at);
CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_game_participants_profile_id ON game_participants(profile_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get or create user stats
CREATE OR REPLACE FUNCTION get_or_create_user_stats(p_profile_id VARCHAR(255))
RETURNS TABLE (
    profile_id VARCHAR(255),
    games_played INTEGER,
    games_won INTEGER,
    total_playtime_minutes INTEGER,
    bunker_survival_rate DECIMAL(5,2)
) AS $$
BEGIN
    -- Try to return existing stats
    RETURN QUERY
    SELECT us.profile_id, us.games_played, us.games_won, 
           us.total_playtime_minutes, us.bunker_survival_rate
    FROM user_stats us
    WHERE us.profile_id = p_profile_id;
    
    -- If no stats exist, create default stats
    IF NOT FOUND THEN
        INSERT INTO user_stats (profile_id)
        VALUES (p_profile_id);
        
        RETURN QUERY
        SELECT us.profile_id, us.games_played, us.games_won, 
               us.total_playtime_minutes, us.bunker_survival_rate
        FROM user_stats us
        WHERE us.profile_id = p_profile_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
