-- Migration: Add LISTEN/NOTIFY triggers for schema changes
-- This enables real-time notifications when properties or templates are modified

-- Function to notify schema changes
CREATE OR REPLACE FUNCTION notify_schema_change() RETURNS trigger AS $$
DECLARE
    notification json;
BEGIN
    -- Build notification payload with relevant information
    notification = json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', CURRENT_TIMESTAMP,
        'template_id', CASE 
            WHEN TG_TABLE_NAME = 'properties' THEN COALESCE(NEW.template_id, OLD.template_id)
            WHEN TG_TABLE_NAME = 'templates' THEN COALESCE(NEW.id, OLD.id)
            ELSE NULL
        END,
        'affected_row', CASE 
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
            ELSE row_to_json(NEW)
        END
    );
    
    -- Send notification
    PERFORM pg_notify('schema_changed', notification::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for properties table
DROP TRIGGER IF EXISTS properties_notify_change ON properties;
CREATE TRIGGER properties_notify_change
    AFTER INSERT OR UPDATE OR DELETE ON properties
    FOR EACH ROW EXECUTE FUNCTION notify_schema_change();

-- Create triggers for templates table
DROP TRIGGER IF EXISTS templates_notify_change ON templates;
CREATE TRIGGER templates_notify_change
    AFTER INSERT OR UPDATE OR DELETE ON templates
    FOR EACH ROW EXECUTE FUNCTION notify_schema_change();

-- Add comments for documentation
COMMENT ON FUNCTION notify_schema_change() IS 'Trigger function that sends PostgreSQL notifications when schema-related tables (properties, templates) are modified. Used for real-time schema cache invalidation.';
COMMENT ON TRIGGER properties_notify_change ON properties IS 'Notifies schema changes when properties are modified';
COMMENT ON TRIGGER templates_notify_change ON templates IS 'Notifies schema changes when templates are modified';