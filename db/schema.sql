\restrict dbmate

-- Dumped from database version 18.6 (2078fcb)
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
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


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
    last_seen_at timestamp with time zone NOT NULL,
    product_category text,
    city_key text,
    all_day boolean DEFAULT false NOT NULL,
    image_credit text,
    image_license text,
    image_source_url text,
    CONSTRAINT events_product_category_check CHECK (((product_category IS NULL) OR (product_category = ANY (ARRAY['Musique'::text, 'Spectacle'::text, 'Exposition'::text, 'Atelier'::text, 'Jeune public'::text, 'Rencontre'::text, 'Visite'::text, 'Fête / salon / marché'::text, 'Loisirs culturels'::text, 'Autre'::text]))))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL
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
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


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
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: source_syncs source_syncs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.source_syncs
    ADD CONSTRAINT source_syncs_pkey PRIMARY KEY (adapter_id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: account_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "account_userId_idx" ON public.account USING btree ("userId");


--
-- Name: event_availability_checked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_availability_checked_at_idx ON public.event_availability USING btree (checked_at);


--
-- Name: events_active_city_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_active_city_key_idx ON public.events USING btree (city_key) WHERE (is_active = true);


--
-- Name: events_active_product_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_active_product_category_idx ON public.events USING btree (product_category) WHERE (is_active = true);


--
-- Name: events_active_start_at_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_active_start_at_id_idx ON public.events USING btree (start_at, id) WHERE (is_active = true);


--
-- Name: events_active_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_active_start_at_idx ON public.events USING btree (start_at) WHERE (is_active = true);


--
-- Name: events_adapter_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_adapter_last_seen_idx ON public.events USING btree (adapter_id, last_seen_at);


--
-- Name: session_token_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX session_token_uidx ON public.session USING btree (token);


--
-- Name: session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "session_userId_idx" ON public.session USING btree ("userId");


--
-- Name: user_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_email_uidx ON public."user" USING btree (email);


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_identifier_idx ON public.verification USING btree (identifier);


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: event_availability event_availability_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_availability
    ADD CONSTRAINT event_availability_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20260906120000'),
    ('20260907160000'),
    ('20260907220000'),
    ('20260908120000'),
    ('20260912150000'),
    ('20260914190000');
