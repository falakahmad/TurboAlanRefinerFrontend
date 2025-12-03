-- Turbo Alan Refiner Database Schema
-- Run these commands in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    settings JSONB DEFAULT '{
        "openai_api_key": "",
        "openai_model": "gpt-4",
        "target_scanner_risk": 15,
        "min_word_ratio": 0.8
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

-- Create admin table
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Create usage_stats table for tracking OpenAI API usage
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    request_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0.00,
    model VARCHAR(50) DEFAULT 'gpt-4',
    job_id VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create schema_usage_stats table for tracking schema usage per user
CREATE TABLE IF NOT EXISTS schema_usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    schema_id VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, schema_id)
);

-- Create system_logs table for admin monitoring
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date ON usage_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_usage_stats_job ON usage_stats(job_id);
CREATE INDEX IF NOT EXISTS idx_schema_usage_stats_user ON schema_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_schema_usage_stats_schema ON schema_usage_stats(schema_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can only see and update their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Admins can see all users
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- RLS Policies for admins table
CREATE POLICY "Admins can view admin records" ON admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- RLS Policies for usage_stats table
CREATE POLICY "Users can view own usage stats" ON usage_stats
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all usage stats" ON usage_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- RLS Policies for schema_usage_stats table
CREATE POLICY "Users can view own schema usage stats" ON schema_usage_stats
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all schema usage stats" ON schema_usage_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- RLS Policies for system_logs table
CREATE POLICY "Admins can view system logs" ON system_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Insert a default admin user (password: admin123)
-- You should change this password immediately after first login
INSERT INTO users (
    id,
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role,
    settings
) VALUES (
    uuid_generate_v4(),
    'admin@turboalan.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J8K8K8K8K8', -- admin123
    'Admin',
    'User',
    'admin',
    '{
        "openai_api_key": "",
        "openai_model": "gpt-4",
        "target_scanner_risk": 15,
        "min_word_ratio": 0.8
    }'::jsonb
) ON CONFLICT (email) DO NOTHING;

-- Create a function to log user actions
CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_details TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO system_logs (user_id, action, details, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_details, p_ip_address, p_user_agent)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update usage stats
CREATE OR REPLACE FUNCTION update_usage_stats(
    p_user_id UUID,
    p_request_count INTEGER DEFAULT 1,
    p_token_count INTEGER DEFAULT 0,
    p_tokens_in INTEGER DEFAULT 0,
    p_tokens_out INTEGER DEFAULT 0,
    p_cost DECIMAL(10,4) DEFAULT 0.00,
    p_model VARCHAR(50) DEFAULT 'gpt-4',
    p_job_id VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    stats_id UUID;
BEGIN
    INSERT INTO usage_stats (user_id, request_count, token_count, tokens_in, tokens_out, cost, model, job_id, date)
    VALUES (p_user_id, p_request_count, p_token_count, p_tokens_in, p_tokens_out, p_cost, p_model, p_job_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET 
        request_count = usage_stats.request_count + p_request_count,
        token_count = usage_stats.token_count + p_token_count,
        tokens_in = usage_stats.tokens_in + p_tokens_in,
        tokens_out = usage_stats.tokens_out + p_tokens_out,
        cost = usage_stats.cost + p_cost,
        model = COALESCE(p_model, usage_stats.model),
        updated_at = NOW()
    RETURNING id INTO stats_id;
    
    RETURN stats_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update schema usage stats
CREATE OR REPLACE FUNCTION update_schema_usage_stats(
    p_user_id UUID,
    p_schema_id VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
    stats_id UUID;
BEGIN
    INSERT INTO schema_usage_stats (user_id, schema_id, usage_count, last_used_at)
    VALUES (p_user_id, p_schema_id, 1, NOW())
    ON CONFLICT (user_id, schema_id)
    DO UPDATE SET 
        usage_count = schema_usage_stats.usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO stats_id;
    
    RETURN stats_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
