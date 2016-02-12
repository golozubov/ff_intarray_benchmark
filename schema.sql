--
-- PostgreSQL database dump
--

-- Dumped from database version 9.5.0
-- Dumped by pg_dump version 9.5.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: frf1; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON DATABASE ff_test_1 IS 'Тестовая база для FreeFeed-а';


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

--
-- Name: comment_created_deleted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION comment_created_deleted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Действия при создании/удалении комментария
declare
	allCommentsFeed integer;
begin
	if TG_OP = 'INSERT' then
		select id into allCommentsFeed from feeds where type = 202 and owner_id = NEW.author_id;
		insert into feed_posts (post_id, feed_id) values (NEW.post_id, allCommentsFeed) on conflict do nothing;
	end if;

	if TG_OP = 'DELETE' then
		if not exists(select 1 from comments where post_id = OLD.post_id and author_id = OLD.author_id) then
			select id into allCommentsFeed from feeds where type = 202 and owner_id = OLD.author_id;
			delete from feed_posts where post_id = OLD.post_id and feed_id = allCommentsFeed;
		end if;
	end if;

	return null;
end;$$;


--
-- Name: feed_posts_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION feed_posts_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Обновление posts.feed_ids при вставке/удалении в таблице feed_posts.
begin
	if TG_OP = 'INSERT' then
		update posts set feed_ids = feed_ids + NEW.feed_id where id = NEW.post_id;
	end if;

	if TG_OP = 'DELETE' then
		update posts set feed_ids = feed_ids - OLD.feed_id where id = OLD.post_id;
	end if;

	return null;
end;
$$;


--
-- Name: FUNCTION feed_posts_changes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION feed_posts_changes() IS 'Обновление posts.feed_ids при вставке/удалении в таблице feed_posts.';


--
-- Name: feed_readers_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION feed_readers_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Обновление users.visible_private_feed_ids при вставке/удалении в таблице feed_readers.
begin
	if TG_OP = 'INSERT' then
		update users set visible_private_feed_ids = visible_private_feed_ids + NEW.feed_id where id = NEW.user_id;
	end if;

	if TG_OP = 'DELETE' then
		update users set visible_private_feed_ids = visible_private_feed_ids - OLD.feed_id where id = OLD.user_id;
	end if;

	return null;
end;
$$;


--
-- Name: FUNCTION feed_readers_changes(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION feed_readers_changes() IS 'Обновление users.visible_private_feed_ids при вставке/удалении в таблице feed_readers.';


--
-- Name: like_created_deleted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION like_created_deleted() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Действия при создании/удалении лайка
declare
	allLikesFeed integer;
begin
	if TG_OP = 'INSERT' then
		select id into allLikesFeed from feeds where type = 203 and owner_id = NEW.user_id;
		insert into feed_posts (post_id, feed_id) values (NEW.post_id, allCommentsFeed) on conflict do nothing;
	end if;

	if TG_OP = 'DELETE' then
		if not exists(select 1 from likes where post_id = OLD.post_id and user_id = OLD.user_id) then
			select id into allLikesFeed from feeds where type = 203 and owner_id = OLD.user_id;
			delete from feed_posts where post_id = OLD.post_id and feed_id = allLikesFeed;
		end if;
	end if;

	return null;
end;$$;


--
-- Name: post_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION post_created() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Действия при создании поста
declare
	allPostsFeed integer;
begin
	select id into allPostsFeed from feeds where type = 201 and owner_id = NEW.author_id;
	insert into feed_posts (post_id, feed_id) values (NEW.id, allPostsFeed);

	return null;
end;$$;


--
-- Name: FUNCTION post_created(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION post_created() IS 'Действия при создании поста';


--
-- Name: user_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION user_created() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
-- Создание фидов для нового пользователя
declare
	directId integer;
begin
	insert into feeds (type, owner_id) values (101, NEW.id);
	if not NEW.is_group then
		insert into feeds (type, owner_id, is_public) values (101, NEW.id, false) returning id into directId;
		insert into feed_readers (feed_id, user_id) values (directId, NEW.id);
		
		insert into feeds (type, owner_id) values (201, NEW.id);
		insert into feeds (type, owner_id) values (202, NEW.id);
		insert into feeds (type, owner_id) values (203, NEW.id);
	end if;

	return null;
end;
$$;


--
-- Name: FUNCTION user_created(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION user_created() IS 'Создание фидов для нового пользователя';


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: aggregates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE aggregates (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    is_primary boolean DEFAULT true NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL
);


--
-- Name: TABLE aggregates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE aggregates IS 'Агрегаторы фидов (френдленты). У одного пользователя их может быть несколько, но только одна первичная.';


--
-- Name: COLUMN aggregates.is_primary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN aggregates.is_primary IS 'Первичная френдлента, есть у пользователя по умолчанию.';


--
-- Name: COLUMN aggregates.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN aggregates.title IS 'Название для удобства пользователя.';


--
-- Name: COLUMN aggregates.feed_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN aggregates.feed_ids IS 'Фиды, на которые подписан агрегатор.';


--
-- Name: aggregates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE aggregates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aggregates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE aggregates_id_seq OWNED BY aggregates.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE comments (
    id integer NOT NULL,
    post_id integer NOT NULL,
    author_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE comments_id_seq OWNED BY comments.id;


--
-- Name: feed_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE feed_posts (
    post_id integer NOT NULL,
    feed_id integer NOT NULL
);


--
-- Name: TABLE feed_posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE feed_posts IS 'Посты в фидах. Эта таблица через триггеры управляет полем posts.feed_ids.';


--
-- Name: feed_readers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE feed_readers (
    feed_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: TABLE feed_readers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE feed_readers IS 'Пользователи, которые имеют право чтения приватных фидов. Эта таблица через триггеры управляет полем users.private_feed_ids.';


--
-- Name: feed_writers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE feed_writers (
    feed_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: TABLE feed_writers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE feed_writers IS 'Пользователи, которые имеют право записи в фиды. Имеет смысл только для фидов групп и директов.';


--
-- Name: feeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE feeds (
    id integer NOT NULL,
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    owner_id integer,
    type integer NOT NULL
);


--
-- Name: COLUMN feeds.uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN feeds.uid IS 'Для совместимости с FreeFeed-ом';


--
-- Name: COLUMN feeds.is_public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN feeds.is_public IS 'Имеет смысл только для базовых фидов.';


--
-- Name: COLUMN feeds.owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN feeds.owner_id IS 'Владелец фида (юзер/группа), null для фильтров.';


--
-- Name: COLUMN feeds.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN feeds.type IS 'Тип фида';


--
-- Name: feeds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE feeds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: feeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE feeds_id_seq OWNED BY feeds.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE files (
    id integer NOT NULL,
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_hash bytea NOT NULL,
    size integer NOT NULL,
    mime_type text NOT NULL,
    media text NOT NULL,
    has_thumbnail boolean NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN files.file_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN files.file_hash IS 'Хэш-сумма файла, для дедубликации.';


--
-- Name: COLUMN files.media; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN files.media IS 'image, audio, other';


--
-- Name: COLUMN files.meta; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN files.meta IS 'Дополнительные параметры, в зависимости от формата: title, artist, width, height, …';


--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE files_id_seq OWNED BY files.id;


--
-- Name: likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE likes (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE likes_id_seq OWNED BY likes.id;


--
-- Name: local_bumps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE local_bumps (
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    bumped_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE local_bumps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE local_bumps IS 'Локальные бампы постов.';


--
-- Name: post_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE post_attachments (
    post_id integer NOT NULL,
    file_id integer NOT NULL,
    file_name text NOT NULL,
    ord integer NOT NULL
);


--
-- Name: post_attachments_ord_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE post_attachments_ord_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: post_attachments_ord_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE post_attachments_ord_seq OWNED BY post_attachments.ord;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE posts (
    id integer NOT NULL,
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id integer NOT NULL,
    body text NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    is_comments_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bumped_at timestamp with time zone DEFAULT now() NOT NULL,
    feed_ids integer[] NOT NULL
);


--
-- Name: COLUMN posts.uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN posts.uid IS 'Для совместимости с FreeFeed-ом';


--
-- Name: COLUMN posts.feed_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN posts.feed_ids IS 'Фиды, в которые опубликован пост.';


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE posts_id_seq OWNED BY posts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE users (
    id integer NOT NULL,
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    screenname text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_group boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    email text,
    pw_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_private_feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    hidden_feed_ids integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    CONSTRAINT users_check CHECK ((is_group = (email IS NULL))),
    CONSTRAINT users_check1 CHECK ((is_group = (pw_hash IS NULL)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE users IS 'Пользователи и группы';


--
-- Name: COLUMN users.uid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.uid IS 'Для совместимости с FreeFeed-ом';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.is_active IS 'Если значение false, то пользователь удалён.';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.email IS 'Null для групп.';


--
-- Name: COLUMN users.pw_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.pw_hash IS 'Хэш пароля, null для групп.';


--
-- Name: COLUMN users.visible_private_feed_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.visible_private_feed_ids IS 'Приватные фиды, которые может читать пользователь.';


--
-- Name: COLUMN users.hidden_feed_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN users.hidden_feed_ids IS 'Фиды, которые пользователь читать не хочет';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE users_id_seq OWNED BY users.id;


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY aggregates ALTER COLUMN id SET DEFAULT nextval('aggregates_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY comments ALTER COLUMN id SET DEFAULT nextval('comments_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY feeds ALTER COLUMN id SET DEFAULT nextval('feeds_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY files ALTER COLUMN id SET DEFAULT nextval('files_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY likes ALTER COLUMN id SET DEFAULT nextval('likes_id_seq'::regclass);


--
-- Name: ord; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY post_attachments ALTER COLUMN ord SET DEFAULT nextval('post_attachments_ord_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY posts ALTER COLUMN id SET DEFAULT nextval('posts_id_seq'::regclass);


--
-- Name: id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY users ALTER COLUMN id SET DEFAULT nextval('users_id_seq'::regclass);


--
-- Name: aggregates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY aggregates
    ADD CONSTRAINT aggregates_pkey PRIMARY KEY (id);


--
-- Name: attachments_file_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY files
    ADD CONSTRAINT attachments_file_hash_key UNIQUE (file_hash);


--
-- Name: attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY files
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: attachments_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY files
    ADD CONSTRAINT attachments_uid_key UNIQUE (uid);


--
-- Name: comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: feed_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (post_id, feed_id);


--
-- Name: feed_readers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_readers
    ADD CONSTRAINT feed_readers_pkey PRIMARY KEY (feed_id, user_id);


--
-- Name: feed_writers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_writers
    ADD CONSTRAINT feed_writers_pkey PRIMARY KEY (feed_id, user_id);


--
-- Name: feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feeds
    ADD CONSTRAINT feeds_pkey PRIMARY KEY (id);


--
-- Name: feeds_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feeds
    ADD CONSTRAINT feeds_uid_key UNIQUE (uid);


--
-- Name: likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: local_bumps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_bumps
    ADD CONSTRAINT local_bumps_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: post_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY post_attachments
    ADD CONSTRAINT post_attachments_pkey PRIMARY KEY (post_id, file_id);


--
-- Name: posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY posts
    ADD CONSTRAINT posts_uid_key UNIQUE (uid);


--
-- Name: users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_uid_key UNIQUE (uid);


--
-- Name: users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: aggregates_feed_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aggregates_feed_ids_idx ON aggregates USING gin (feed_ids);


--
-- Name: comments_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_created_at_idx ON comments USING btree (created_at);


--
-- Name: fki_post_attachments_file_id_fkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fki_post_attachments_file_id_fkey ON post_attachments USING btree (file_id);


--
-- Name: likes_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX likes_created_at_idx ON likes USING btree (created_at);


--
-- Name: posts_bumped_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_bumped_at_idx ON posts USING btree (bumped_at);


--
-- Name: posts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_created_at_idx ON posts USING btree (created_at);


--
-- Name: posts_feed_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_feed_ids_idx ON posts USING gin (feed_ids);


--
-- Name: posts_is_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_is_public_idx ON posts USING btree (is_public);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON users USING btree (email);


--
-- Name: users_hidden_feed_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_hidden_feed_ids_idx ON users USING gin (hidden_feed_ids);


--
-- Name: users_username_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_username_idx ON users USING btree (username);


--
-- Name: users_visible_private_feed_ids_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_visible_private_feed_ids_idx ON users USING gin (visible_private_feed_ids);


--
-- Name: feed_posts_changes_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feed_posts_changes_trg AFTER INSERT OR DELETE ON feed_posts FOR EACH ROW EXECUTE PROCEDURE feed_posts_changes();


--
-- Name: feed_readers_changes_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feed_readers_changes_trg AFTER INSERT OR DELETE ON feed_readers FOR EACH ROW EXECUTE PROCEDURE feed_readers_changes();


--
-- Name: trg_comment_created_deleted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_comment_created_deleted AFTER INSERT OR DELETE ON comments FOR EACH ROW EXECUTE PROCEDURE comment_created_deleted();


--
-- Name: trg_like_created_deleted; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_like_created_deleted AFTER INSERT OR DELETE ON likes FOR EACH ROW EXECUTE PROCEDURE like_created_deleted();


--
-- Name: trg_post_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_post_created AFTER INSERT ON posts FOR EACH ROW EXECUTE PROCEDURE post_created();


--
-- Name: trg_user_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_created AFTER INSERT ON users FOR EACH ROW EXECUTE PROCEDURE user_created();


--
-- Name: aggregates_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY aggregates
    ADD CONSTRAINT aggregates_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_posts_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_posts
    ADD CONSTRAINT feed_posts_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES feeds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_posts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_posts
    ADD CONSTRAINT feed_posts_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_readers_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_readers
    ADD CONSTRAINT feed_readers_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES feeds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_readers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_readers
    ADD CONSTRAINT feed_readers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_writers_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_writers
    ADD CONSTRAINT feed_writers_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES feeds(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_writers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feed_writers
    ADD CONSTRAINT feed_writers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feeds_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY feeds
    ADD CONSTRAINT feeds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY likes
    ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: local_bumps_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_bumps
    ADD CONSTRAINT local_bumps_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: local_bumps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY local_bumps
    ADD CONSTRAINT local_bumps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_attachments_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY post_attachments
    ADD CONSTRAINT post_attachments_file_id_fkey FOREIGN KEY (file_id) REFERENCES files(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_attachments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY post_attachments
    ADD CONSTRAINT post_attachments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: public; Type: ACL; Schema: -; Owner: -
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM vagrant;
GRANT ALL ON SCHEMA public TO vagrant;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

