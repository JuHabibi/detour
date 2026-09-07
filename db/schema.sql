\restrict dbmate

-- Dumped from database version 18.6 (c5250a2)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: event_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_availability (
    event_id text NOT NULL,
    status text NOT NULL,
    provider text NOT NULL,
    provider_event_url text,
    checked_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_availability_status_check CHECK ((status = ANY (ARRAY['available'::text, 'sold_out_online'::text, 'sold_out'::text, 'unknown'::text])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id text NOT NULL,
    adapter_id text NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    venue text,
    city text,
    latitude double precision,
    longitude double precision,
    category text,
    genre text,
    conditions text,
    source text,
    source_url text,
    registration_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: source_syncs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.source_syncs (
    adapter_id text NOT NULL,
    last_attempt_at timestamp with time zone,
    last_success_at timestamp with time zone,
    status text,
    fetched_count integer DEFAULT 0 NOT NULL,
    error_code text,
    error_message_safe text,
    sync_lock_token text,
    sync_locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT source_syncs_check CHECK ((((sync_lock_token IS NULL) AND (sync_locked_until IS NULL)) OR ((sync_lock_token IS NOT NULL) AND (sync_locked_until IS NOT NULL)))),
    CONSTRAINT source_syncs_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'error'::text])))
);


--
-- Name: event_availability event_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_availability
    ADD CONSTRAINT event_availability_pkey PRIMARY KEY (event_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: source_syncs source_syncs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_syncs
    ADD CONSTRAINT source_syncs_pkey PRIMARY KEY (adapter_id);


--
-- Name: event_availability_checked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_availability_checked_at_idx ON public.event_availability USING btree (checked_at);


--
-- Name: events_active_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_active_start_at_idx ON public.events USING btree (start_at) WHERE (is_active = true);


--
-- Name: events_adapter_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_adapter_last_seen_idx ON public.events USING btree (adapter_id, last_seen_at);


--
-- Name: event_availability event_availability_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_availability
    ADD CONSTRAINT event_availability_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260906120000'),
    ('20260907160000');
