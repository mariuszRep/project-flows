--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: mcp_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO mcp_user;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: mcp_user
--

COMMENT ON SCHEMA public IS '';


--
-- Name: task_stage; Type: TYPE; Schema: public; Owner: mcp_user
--

CREATE TYPE public.task_stage AS ENUM (
    'draft',
    'backlog',
    'doing',
    'review',
    'completed'
);


ALTER TYPE public.task_stage OWNER TO mcp_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: mcp_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO mcp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: object_properties; Type: TABLE; Schema: public; Owner: mcp_user
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


ALTER TABLE public.object_properties OWNER TO mcp_user;

--
-- Name: object_template_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.object_template_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.object_template_properties_id_seq OWNER TO mcp_user;

--
-- Name: object_template_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.object_template_properties_id_seq OWNED BY public.object_properties.id;


--
-- Name: global_state; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.global_state (
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL
);


ALTER TABLE public.global_state OWNER TO mcp_user;

--
-- Name: template_properties; Type: TABLE; Schema: public; Owner: mcp_user
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.template_properties OWNER TO mcp_user;

--
-- Name: template_properties_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.template_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.template_template_properties_id_seq OWNER TO mcp_user;

--
-- Name: template_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.template_properties_id_seq OWNED BY public.template_properties.id;


--
-- Name: objects; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.objects (
    id integer NOT NULL,
    stage public.task_stage DEFAULT 'draft'::public.task_stage NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    user_id integer,
    parent_id integer,
    template_id integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.objects OWNER TO mcp_user;

--
-- Name: objects_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.objects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.objects_id_seq OWNER TO mcp_user;

--
-- Name: objects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.objects_id_seq OWNED BY public.objects.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL
);


ALTER TABLE public.templates OWNER TO mcp_user;

--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.templates_id_seq OWNER TO mcp_user;

--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: blocks id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.object_properties ALTER COLUMN id SET DEFAULT nextval('public.object_template_properties_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.template_properties ALTER COLUMN id SET DEFAULT nextval('public.template_properties_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.objects ALTER COLUMN id SET DEFAULT nextval('public.objects_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: blocks object_template_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT object_template_properties_pkey PRIMARY KEY (id);


--
-- Name: blocks object_properties_object_id_property_id_key; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT object_properties_object_id_property_id_key UNIQUE (task_id, property_id);


--
-- Name: global_state global_state_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.global_state
    ADD CONSTRAINT global_state_pkey PRIMARY KEY (key);


--
-- Name: properties template_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.template_properties
    ADD CONSTRAINT template_properties_pkey PRIMARY KEY (id);


--
-- Name: properties template_properties_template_id_key_key; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.template_properties
    ADD CONSTRAINT template_properties_template_id_key_key UNIQUE (template_id, key);


--
-- Name: tasks objects_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: idx_object_properties_position; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_object_properties_position ON public.object_properties USING btree (task_id, "position");


--
-- Name: idx_object_properties_property_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_object_properties_property_id ON public.object_properties USING btree (property_id);


--
-- Name: idx_object_properties_object_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_object_properties_object_id ON public.object_properties USING btree (task_id);


--
-- Name: idx_global_state_key; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_global_state_key ON public.global_state USING btree (key);


--
-- Name: idx_objects_parent_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_objects_parent_id ON public.objects USING btree (parent_id);


--
-- Name: idx_objects_user_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_objects_user_id ON public.objects USING btree (user_id);


--
-- Name: blocks update_object_properties_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_object_properties_updated_at BEFORE UPDATE ON public.object_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: global_state update_global_state_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_global_state_updated_at BEFORE UPDATE ON public.global_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: properties update_template_properties_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_template_properties_updated_at BEFORE UPDATE ON public.template_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_objects_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON public.objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: blocks object_properties_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT object_properties_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.template_properties(id) ON DELETE CASCADE;


--
-- Name: blocks object_properties_object_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.object_properties
    ADD CONSTRAINT object_properties_object_id_fkey FOREIGN KEY (task_id) REFERENCES public.objects(id) ON DELETE CASCADE;


--
-- Name: properties template_properties_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.template_properties
    ADD CONSTRAINT template_properties_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: tasks objects_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT objects_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.objects(id) ON DELETE CASCADE;


--
-- Name: tasks objects_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.objects
    ADD CONSTRAINT objects_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: mcp_user
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--