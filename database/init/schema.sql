--
-- PostgreSQL database dump
--

\restrict 3ovflBuD2bDyjMHXN5Zmh0WmpDjwUqTc83BhHhchi12ZtnZI4QUePd2d2i8lDSx

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: task_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.task_stage AS ENUM (
    'draft',
    'backlog',
    'doing',
    'review',
    'completed'
);


--
-- Name: notify_data_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_data_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    notification_payload json;
    event_type text;
    related_changed boolean := false;
    dependencies_changed boolean := false;
    parent_id_changed boolean := false;
    added_relationships jsonb;
    removed_relationships jsonb;
    new_parent_id integer := NULL;
    old_parent_id integer := NULL;
BEGIN
    IF TG_OP = 'INSERT' THEN
        event_type = 'created';
        IF NEW.related IS NOT NULL AND jsonb_typeof(NEW.related) = 'array' AND jsonb_array_length(NEW.related) > 0 THEN
            new_parent_id := (NEW.related->0->>'id')::integer;
        END IF;
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE
                WHEN NEW.template_id = 1 THEN 'task'
                WHEN NEW.template_id = 2 THEN 'project'
                WHEN NEW.template_id = 3 THEN 'epic'
                WHEN NEW.template_id = 4 THEN 'rule'
                ELSE 'object'
            END,
            'object_id', NEW.id,
            'template_id', NEW.template_id,
            'parent_id', new_parent_id,
            'stage', NEW.stage,
            'related', NEW.related,
            'dependencies', NEW.dependencies,
            'created_by', NEW.created_by,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    ELSIF TG_OP = 'UPDATE' THEN
        event_type = 'updated';
        IF NEW.related IS NOT NULL AND jsonb_typeof(NEW.related) = 'array' AND jsonb_array_length(NEW.related) > 0 THEN
            new_parent_id := (NEW.related->0->>'id')::integer;
        END IF;
        IF OLD.related IS NOT NULL AND jsonb_typeof(OLD.related) = 'array' AND jsonb_array_length(OLD.related) > 0 THEN
            old_parent_id := (OLD.related->0->>'id')::integer;
        END IF;
        related_changed := (OLD.related IS DISTINCT FROM NEW.related);
        dependencies_changed := (OLD.dependencies IS DISTINCT FROM NEW.dependencies);
        parent_id_changed := (old_parent_id IS DISTINCT FROM new_parent_id);
        IF related_changed THEN
            SELECT COALESCE(jsonb_agg(new_elem), '[]'::jsonb)
            INTO added_relationships
            FROM jsonb_array_elements(NEW.related) AS new_elem
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(OLD.related) AS old_elem
                WHERE old_elem = new_elem
            );
            SELECT COALESCE(jsonb_agg(old_elem), '[]'::jsonb)
            INTO removed_relationships
            FROM jsonb_array_elements(OLD.related) AS old_elem
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(NEW.related) AS new_elem
                WHERE new_elem = old_elem
            );
        END IF;
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE
                WHEN NEW.template_id = 1 THEN 'task'
                WHEN NEW.template_id = 2 THEN 'project'
                WHEN NEW.template_id = 3 THEN 'epic'
                WHEN NEW.template_id = 4 THEN 'rule'
                ELSE 'object'
            END,
            'object_id', NEW.id,
            'template_id', NEW.template_id,
            'parent_id', new_parent_id,
            'stage', NEW.stage,
            'related', NEW.related,
            'dependencies', NEW.dependencies,
            'updated_by', NEW.updated_by,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'changes', json_build_object(
                'related_changed', related_changed,
                'dependencies_changed', dependencies_changed,
                'parent_id_changed', parent_id_changed,
                'added_relationships', COALESCE(added_relationships, '[]'::jsonb),
                'removed_relationships', COALESCE(removed_relationships, '[]'::jsonb)
            )
        );
    ELSE
        event_type = 'deleted';
        IF OLD.related IS NOT NULL AND jsonb_typeof(OLD.related) = 'array' AND jsonb_array_length(OLD.related) > 0 THEN
            old_parent_id := (OLD.related->0->>'id')::integer;
        END IF;
        notification_payload = json_build_object(
            'event_type', event_type,
            'object_type', CASE
                WHEN OLD.template_id = 1 THEN 'task'
                WHEN OLD.template_id = 2 THEN 'project'
                WHEN OLD.template_id = 3 THEN 'epic'
                WHEN OLD.template_id = 4 THEN 'rule'
                ELSE 'object'
            END,
            'object_id', OLD.id,
            'template_id', OLD.template_id,
            'parent_id', old_parent_id,
            'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
    END IF;
    PERFORM pg_notify('data_changed', notification_payload::text);
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;

        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: global_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_state (
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL
);


--
-- Name: object_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.object_properties (
    id integer NOT NULL,
    task_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    content text NOT NULL,
    property_id integer
);


--
-- Name: object_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.object_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: object_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.object_properties_id_seq OWNED BY public.object_properties.id;


--
-- Name: objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objects (
    id integer NOT NULL,
    stage public.task_stage DEFAULT 'draft'::public.task_stage NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    user_id integer,
    template_id integer DEFAULT 1 NOT NULL,
    related jsonb DEFAULT '[]'::jsonb NOT NULL,
    dependencies jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: COLUMN objects.related; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.objects.related IS 'JSONB array of related object references, e.g., [{"id": 123, "type": "task"}]';


--
-- Name: COLUMN objects.dependencies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.objects.dependencies IS 'JSONB array of dependency relationships, e.g., [{"id": 456, "type": "task", "blocking": true}]';


--
-- Name: objects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objects_id_seq OWNED BY public.objects.id;


--
-- Name: template_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_properties (
    id integer NOT NULL,
    template_id integer NOT NULL,
    key text NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    dependencies text[] DEFAULT '{}'::text[],
    execution_order integer DEFAULT 0 NOT NULL,
    fixed boolean DEFAULT false,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    step_type text DEFAULT 'property'::text NOT NULL,
    step_config jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT template_properties_step_type_check CHECK ((step_type = ANY (ARRAY['property'::text, 'call_tool'::text, 'log'::text, 'set_variable'::text, 'conditional'::text, 'return'::text, 'start'::text])))
);


--
-- Name: template_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.template_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: template_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.template_properties_id_seq OWNED BY public.template_properties.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    related_schema jsonb DEFAULT '[]'::jsonb NOT NULL,
    type text DEFAULT 'object'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT templates_type_check CHECK ((type = ANY (ARRAY['object'::text, 'workflow'::text])))
);


--
-- Name: COLUMN templates.related_schema; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.related_schema IS 'JSONB array defining allowed parent relationships for objects using this template. Each entry specifies key, label, allowed_types (array of template IDs), cardinality (single/multiple), required (boolean), and order (number).';


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: object_properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_properties ALTER COLUMN id SET DEFAULT nextval('public.object_properties_id_seq'::regclass);


--
-- Name: objects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objects ALTER COLUMN id SET DEFAULT nextval('public.objects_id_seq'::regclass);


--
-- Name: template_properties id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_properties ALTER COLUMN id SET DEFAULT nextval('public.template_properties_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: object_properties blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: global_state global_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_state
    ADD CONSTRAINT global_state_pkey PRIMARY KEY (key);


--
-- Name: template_properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: objects tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: blocks_task_id_property_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX blocks_task_id_property_id_key ON public.object_properties USING btree (task_id, property_id);


--
-- Name: idx_blocks_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_position ON public.object_properties USING btree (task_id, "position");


--
-- Name: idx_blocks_property_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_property_id ON public.object_properties USING btree (property_id);


--
-- Name: idx_blocks_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocks_task_id ON public.object_properties USING btree (task_id);


--
-- Name: idx_global_state_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_state_key ON public.global_state USING btree (key);


--
-- Name: idx_objects_dependencies; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objects_dependencies ON public.objects USING gin (dependencies);


--
-- Name: idx_objects_related; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objects_related ON public.objects USING gin (related);


--
-- Name: idx_tasks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_id ON public.objects USING btree (user_id);


--
-- Name: idx_template_properties_step_config; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_properties_step_config ON public.template_properties USING gin (step_config);


--
-- Name: idx_template_properties_step_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_properties_step_type ON public.template_properties USING btree (step_type);


--
-- Name: idx_templates_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_metadata ON public.templates USING gin (metadata);


--
-- Name: idx_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_type ON public.templates USING btree (type);


--
-- Name: properties_template_id_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX properties_template_id_key_key ON public.template_properties USING btree (template_id, key);


--
-- Name: objects objects_notify_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER objects_notify_change AFTER INSERT OR DELETE OR UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.notify_data_change();


--
-- Name: object_properties update_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.object_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: global_state update_global_state_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_global_state_updated_at BEFORE UPDATE ON public.global_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: template_properties update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.template_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: objects update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: object_properties blocks_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT blocks_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.template_properties(id) ON DELETE CASCADE;


--
-- Name: object_properties blocks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT blocks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.objects(id) ON DELETE CASCADE;


--
-- Name: template_properties properties_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_properties
    ADD CONSTRAINT properties_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: objects tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 3ovflBuD2bDyjMHXN5Zmh0WmpDjwUqTc83BhHhchi12ZtnZI4QUePd2d2i8lDSx

