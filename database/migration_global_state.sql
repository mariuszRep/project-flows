-- Migration to add global_state table for cross-session state synchronization
-- This table stores global application state that needs to be synchronized across all MCP clients

CREATE TABLE IF NOT EXISTS global_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_by TEXT NOT NULL DEFAULT 'system'
);

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_global_state_updated_at BEFORE UPDATE ON global_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial selected_project_id state (null = no project selected)
INSERT INTO global_state (key, value, created_by, updated_by) 
VALUES ('selected_project_id', 'null', 'system', 'system')
ON CONFLICT (key) DO NOTHING;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_global_state_key ON global_state(key);