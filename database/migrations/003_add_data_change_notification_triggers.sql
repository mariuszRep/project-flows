-- Migration: Add LISTEN/NOTIFY triggers for data changes (task/project creation and updates)
-- This enables real-time notifications when tasks or projects are created or modified

-- Function to notify data changes
CREATE OR REPLACE FUNCTION notify_data_change() RETURNS trigger AS $$
DECLARE
    notification_payload json;
    event_type text;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        event_type = 'created';
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE 
                WHEN NEW.template_id = 1 THEN 'task'
                WHEN NEW.template_id = 2 THEN 'project'
                ELSE 'object'
            END,
            'object_id', NEW.id,
            'template_id', NEW.template_id,
            'parent_id', NEW.parent_id,
            'stage', NEW.stage,
            'created_by', NEW.created_by,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    ELSIF TG_OP = 'UPDATE' THEN
        event_type = 'updated';
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE 
                WHEN NEW.template_id = 1 THEN 'task'
                WHEN NEW.template_id = 2 THEN 'project'
                ELSE 'object'
            END,
            'object_id', NEW.id,
            'template_id', NEW.template_id,
            'parent_id', NEW.parent_id,
            'stage', NEW.stage,
            'updated_by', NEW.updated_by,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    ELSE
        event_type = 'deleted';
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE 
                WHEN OLD.template_id = 1 THEN 'task'
                WHEN OLD.template_id = 2 THEN 'project'
                ELSE 'object'
            END,
            'object_id', OLD.id,
            'template_id', OLD.template_id,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    END IF;

    -- Send notification on appropriate channel
    PERFORM pg_notify('data_changed', notification_payload::text);
    
    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for objects table (tasks and projects)
DROP TRIGGER IF EXISTS objects_notify_change ON objects;
CREATE TRIGGER objects_notify_change
    AFTER INSERT OR UPDATE OR DELETE ON objects
    FOR EACH ROW EXECUTE FUNCTION notify_data_change();

-- Add comments for documentation
COMMENT ON FUNCTION notify_data_change() IS 'Trigger function that sends PostgreSQL notifications when objects (tasks/projects) are created, updated, or deleted. Used for real-time UI updates.';
COMMENT ON TRIGGER objects_notify_change ON objects IS 'Notifies data changes when tasks or projects are modified';