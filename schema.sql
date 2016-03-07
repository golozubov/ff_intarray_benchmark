SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

CREATE EXTENSION IF NOT EXISTS intarray WITH SCHEMA public;
COMMENT ON EXTENSION intarray IS 'intarray functions';

SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: feeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE feeds (
    id integer NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    type character varying(255) NOT NULL
);

CREATE SEQUENCE feeds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE feeds_id_seq OWNED BY feeds.id;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE posts (
    id integer NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL
);

CREATE SEQUENCE posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE posts_id_seq OWNED BY posts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE users (
    id integer NOT NULL,
    is_group boolean DEFAULT false NOT NULL,
    hidden_feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    subscr_feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL
);

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE users_id_seq OWNED BY users.id;

ALTER TABLE ONLY feeds ALTER COLUMN id SET DEFAULT nextval('feeds_id_seq'::regclass);
ALTER TABLE ONLY posts ALTER COLUMN id SET DEFAULT nextval('posts_id_seq'::regclass);
ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


ALTER TABLE ONLY feeds
    ADD CONSTRAINT feeds_pkey PRIMARY KEY (id);

ALTER TABLE ONLY posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--CREATE INDEX posts_feed_ids_idx ON posts USING gin (feed_ids);
--CREATE INDEX posts_is_public_idx ON posts USING btree (is_public);
--CREATE INDEX users_private_feed_ids_idx ON users USING gin (private_feed_ids);

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM vagrant;
GRANT ALL ON SCHEMA public TO vagrant;
GRANT ALL ON SCHEMA public TO PUBLIC;
