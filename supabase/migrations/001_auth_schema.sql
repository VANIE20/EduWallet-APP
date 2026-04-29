-- EduWallet Database Schema with Authentication & Account Linking
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS TABLE ====================
-- Note: Supabase Auth creates auth.users automatically
-- This is our app-level user profile table

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('guardian', 'student'))
);

-- ==================== USER LINKS TABLE ====================
-- Links guardians to students (one guardian can have multiple students)

CREATE TABLE IF NOT EXISTS public.user_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guardian_id, student_id),
    CHECK (guardian_id != student_id)
);

-- ==================== PENDING INVITES TABLE ====================
-- Stores pending link invitations

CREATE TABLE IF NOT EXISTS public.pending_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    guardian_email TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    student_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== WALLETS TABLE ====================

CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ==================== TRANSACTIONS TABLE ====================

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('deposit', 'allowance', 'expense')),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    category TEXT,
    from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ==================== ALLOWANCE CONFIGS TABLE ====================

CREATE TABLE IF NOT EXISTS public.allowance_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    day_of_week INTEGER DEFAULT 0 CHECK (day_of_week >= 0 AND day_of_week <= 6),
    is_active BOOLEAN DEFAULT TRUE,
    last_allowance_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guardian_id, student_id)
);

-- ==================== SPENDING LIMITS TABLE ====================

CREATE TABLE IF NOT EXISTS public.spending_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    daily_limit DECIMAL(10, 2) NOT NULL CHECK (daily_limit > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id)
);

-- ==================== SAVINGS GOALS TABLE ====================

CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount DECIMAL(10, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(10, 2) DEFAULT 0 CHECK (current_amount >= 0),
    icon_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_user_links_guardian ON user_links(guardian_id);
CREATE INDEX IF NOT EXISTS idx_user_links_student ON user_links(student_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_student ON pending_invites(student_email, status);
CREATE INDEX IF NOT EXISTS idx_pending_invites_guardian ON pending_invites(guardian_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_student_id ON savings_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_allowance_configs_guardian ON allowance_configs(guardian_id);
CREATE INDEX IF NOT EXISTS idx_allowance_configs_student ON allowance_configs(student_id);

-- ==================== ROW LEVEL SECURITY (RLS) ====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowance_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can view linked user profiles"
    ON users FOR SELECT
    USING (
        id IN (
            SELECT student_id FROM user_links WHERE guardian_id = auth.uid()
            UNION
            SELECT guardian_id FROM user_links WHERE student_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for user_links table
CREATE POLICY "Users can view their links"
    ON user_links FOR SELECT
    USING (guardian_id = auth.uid() OR student_id = auth.uid());

CREATE POLICY "Guardians can create links"
    ON user_links FOR INSERT
    WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Guardians can delete their links"
    ON user_links FOR DELETE
    USING (guardian_id = auth.uid());

-- RLS Policies for pending_invites table
CREATE POLICY "Guardians can view their sent invites"
    ON pending_invites FOR SELECT
    USING (guardian_id = auth.uid());

CREATE POLICY "Students can view their received invites"
    ON pending_invites FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Guardians can create invites"
    ON pending_invites FOR INSERT
    WITH CHECK (guardian_id = auth.uid());

CREATE POLICY "Students can update invite status"
    ON pending_invites FOR UPDATE
    USING (student_id = auth.uid());

-- RLS Policies for wallets table
CREATE POLICY "Users can view their own wallet"
    ON wallets FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can view linked wallets"
    ON wallets FOR SELECT
    USING (
        user_id IN (
            SELECT student_id FROM user_links WHERE guardian_id = auth.uid()
            UNION
            SELECT guardian_id FROM user_links WHERE student_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own wallet"
    ON wallets FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Guardians can update linked student wallets"
    ON wallets FOR UPDATE
    USING (
        user_id IN (SELECT student_id FROM user_links WHERE guardian_id = auth.uid())
    );

CREATE POLICY "Users can insert their own wallet"
    ON wallets FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for transactions table
CREATE POLICY "Users can view their transactions"
    ON transactions FOR SELECT
    USING (
        from_user_id = auth.uid() OR
        to_user_id = auth.uid() OR
        from_user_id IN (
            SELECT student_id FROM user_links WHERE guardian_id = auth.uid()
            UNION
            SELECT guardian_id FROM user_links WHERE student_id = auth.uid()
        ) OR
        to_user_id IN (
            SELECT student_id FROM user_links WHERE guardian_id = auth.uid()
            UNION
            SELECT guardian_id FROM user_links WHERE student_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transactions they're involved in"
    ON transactions FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid() OR
        to_user_id = auth.uid() OR
        from_user_id IN (SELECT student_id FROM user_links WHERE guardian_id = auth.uid()) OR
        to_user_id IN (SELECT student_id FROM user_links WHERE guardian_id = auth.uid())
    );

-- RLS Policies for allowance_configs table
CREATE POLICY "Guardians can manage allowance configs"
    ON allowance_configs FOR ALL
    USING (guardian_id = auth.uid());

CREATE POLICY "Students can view their allowance configs"
    ON allowance_configs FOR SELECT
    USING (student_id = auth.uid());

-- RLS Policies for spending_limits table
CREATE POLICY "Guardians can manage student spending limits"
    ON spending_limits FOR ALL
    USING (
        student_id IN (SELECT student_id FROM user_links WHERE guardian_id = auth.uid())
    );

CREATE POLICY "Students can view their spending limits"
    ON spending_limits FOR SELECT
    USING (student_id = auth.uid());

-- RLS Policies for savings_goals table
CREATE POLICY "Students can manage their own savings goals"
    ON savings_goals FOR ALL
    USING (student_id = auth.uid());

CREATE POLICY "Guardians can view linked student savings goals"
    ON savings_goals FOR SELECT
    USING (
        student_id IN (SELECT student_id FROM user_links WHERE guardian_id = auth.uid())
    );

-- ==================== FUNCTIONS & TRIGGERS ====================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
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

CREATE TRIGGER update_pending_invites_updated_at
    BEFORE UPDATE ON pending_invites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create wallet when user is created
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (NEW.id, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_new_user();

-- ==================== ENABLE REALTIME (Optional) ====================

-- Enable realtime for pending invites (so students get instant notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE pending_invites;

-- ==================== NOTES ====================

-- This schema supports:
-- 1. Email-based authentication via Supabase Auth
-- 2. Guardian-Student linking (one guardian, multiple students)
-- 3. Invite system via email
-- 4. All existing wallet/transaction features
-- 5. Row Level Security to protect data

-- After running this migration:
-- 1. Enable email auth in Supabase Dashboard → Authentication → Providers
-- 2. Configure email templates for verification
-- 3. Set up email service (Supabase provides default SMTP)
