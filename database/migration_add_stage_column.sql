-- Migration script to add stage column to tasks table

-- Create enum type for task stages
CREATE TYPE IF NOT EXISTS task_stage AS ENUM ('draft', 'backlog', 'doing', 'review', 'completed');

-- Add stage column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stage task_stage NOT NULL DEFAULT 'draft';

-- Add comment for documentation
COMMENT ON COLUMN tasks.stage IS 'Current stage of the task in the workflow';

-- Create index for stage column for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage);

-- Update existing tasks to have proper stage if needed
-- (This is safe because we set a default value)