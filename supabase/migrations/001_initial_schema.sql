-- EduWallet Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('guardian', 'student')),
    linked_user_id UUID REFERENCES users(id)
);

-- Create auth.users reference (if using Supabase Auth)
-- This links app users to Supabase auth users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('deposit', 'allowance', 'expense')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    category TEXT,
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Allowance configurations table
CREATE TABLE IF NOT EXISTS allowance_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    day_of_week INTEGER DEFAULT 0 CHECK (day_of_week >= 0 AND day_of_week <= 6),
    is_active BOOLEAN DEFAULT TRUE,
    last_allowance_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guardian_id, student_id)
);

-- Spending limits table
CREATE TABLE IF NOT EXISTS spending_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    daily_limit DECIMAL(10, 2) NOT NULL CHECK (daily_limit > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id)
);

-- Savings goals table
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount DECIMAL(10, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(10, 2) DEFAULT 0 CHECK (current_amount >= 0),
    icon_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_student_id ON savings_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_allowance_configs_guardian ON allowance_configs(guardian_id);
CREATE INDEX IF NOT EXISTS idx_allowance_configs_student ON allowance_configs(student_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile and linked profiles"
    ON users FOR SELECT
    USING (
        auth.uid() = auth_user_id OR
        id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = auth_user_id);

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallet and linked user wallets"
    ON wallets FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid() OR 
            id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own wallet"
    ON wallets FOR UPDATE
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert into their own wallet"
    ON wallets FOR INSERT
    WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- RLS Policies for transactions
CREATE POLICY "Users can view transactions they're involved in"
    ON transactions FOR SELECT
    USING (
        from_user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid() OR 
            id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
        ) OR
        to_user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid() OR 
            id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert transactions they're involved in"
    ON transactions FOR INSERT
    WITH CHECK (
        from_user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid() OR 
            id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
        ) OR
        to_user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid() OR 
            id IN (SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid())
        )
    );

-- RLS Policies for allowance configs
CREATE POLICY "Guardians can manage allowance configs"
    ON allowance_configs FOR ALL
    USING (
        guardian_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Students can view their allowance configs"
    ON allowance_configs FOR SELECT
    USING (
        student_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- RLS Policies for spending limits
CREATE POLICY "Guardians can manage student spending limits"
    ON spending_limits FOR ALL
    USING (
        student_id IN (
            SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid() AND role = 'guardian'
        )
    );

CREATE POLICY "Students can view their spending limits"
    ON spending_limits FOR SELECT
    USING (
        student_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

-- RLS Policies for savings goals
CREATE POLICY "Students can manage their own savings goals"
    ON savings_goals FOR ALL
    USING (
        student_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Guardians can view linked student savings goals"
    ON savings_goals FOR SELECT
    USING (
        student_id IN (
            SELECT linked_user_id FROM users WHERE auth_user_id = auth.uid() AND role = 'guardian'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allowance_configs_updated_at
    BEFORE UPDATE ON allowance_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spending_limits_updated_at
    BEFORE UPDATE ON spending_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at
    BEFORE UPDATE ON savings_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert demo data (optional - for testing)
-- Note: You'll need to create actual auth users first or modify this to work without auth

INSERT INTO users (username, display_name, role) VALUES
    ('parent1', 'Maria Santos', 'guardian'),
    ('student1', 'Alex Santos', 'student')
ON CONFLICT (username) DO NOTHING;

-- Link the users (assuming first is guardian, second is student)
UPDATE users SET linked_user_id = (SELECT id FROM users WHERE username = 'student1')
WHERE username = 'parent1';

UPDATE users SET linked_user_id = (SELECT id FROM users WHERE username = 'parent1')
WHERE username = 'student1';

-- Create wallets for demo users
INSERT INTO wallets (user_id, balance)
SELECT id, 0 FROM users
ON CONFLICT (user_id) DO NOTHING;
