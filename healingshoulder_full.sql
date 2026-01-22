


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


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."call_status" AS ENUM (
    'pending',
    'active',
    'ended',
    'cancelled'
);


ALTER TYPE "public"."call_status" OWNER TO "postgres";


CREATE TYPE "public"."grief_type" AS ENUM (
    'parent',
    'child',
    'spouse',
    'sibling',
    'friend',
    'pet',
    'miscarriage',
    'caregiver',
    'suicide',
    'other'
);


ALTER TYPE "public"."grief_type" OWNER TO "postgres";


CREATE TYPE "public"."resource_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."resource_status" OWNER TO "postgres";


CREATE TYPE "public"."resource_type" AS ENUM (
    'Story',
    'Guide',
    'Tool',
    'Video',
    'Book'
);


ALTER TYPE "public"."resource_type" OWNER TO "postgres";


CREATE TYPE "public"."session_type" AS ENUM (
    'one_on_one',
    'group'
);


ALTER TYPE "public"."session_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_targeted_notifications"("req_type" "text", "req_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_request RECORD;
  v_message TEXT;
  v_link TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate input
  IF req_type NOT IN ('one_on_one', 'group') THEN
    RAISE EXCEPTION 'Invalid request type: %', req_type;
  END IF;

  -- Fetch the request and prepare message, link, and expiration
  IF req_type = 'one_on_one' THEN
    SELECT id, user_id, context INTO v_request
    FROM quick_connect_requests
    WHERE id = req_id AND status = 'available';
    
    IF NOT FOUND THEN RETURN; END IF;
    
    v_message := COALESCE(v_request.context, 'I need someone to talk to right now.');
    v_link := '/connect';
    v_expires_at := NOW() + INTERVAL '10 minutes';

  ELSIF req_type = 'group' THEN
    SELECT id, user_id, context INTO v_request
    FROM quick_group_requests
    WHERE id = req_id AND status = 'available';
    
    IF NOT FOUND THEN RETURN; END IF;
    
    v_message := COALESCE(v_request.context, 'Join my group support call — all are welcome.');
    v_link := '/connect';
    v_expires_at := NOW() + INTERVAL '10 minutes';
  END IF;

  -- Insert notifications for all eligible users (except requester)
  INSERT INTO notifications (
    user_id,
    sender_id,
    message,
    link,
    read,
    type,
    source_id,
    expires_at
  )
  SELECT
    p.id,
    v_request.user_id,  -- 👈 sender = requester
    v_message,
    v_link,
    false,
    CASE 
      WHEN req_type = 'one_on_one' THEN 'one_on_one_request'
      ELSE 'group_request'
    END,
    req_id,
    v_expires_at
  FROM profiles p
  WHERE p.id != v_request.user_id
    AND (p.accepts_calls IS NULL OR p.accepts_calls = true);

END;
$$;


ALTER FUNCTION "public"."create_targeted_notifications"("req_type" "text", "req_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_comment_likes"("comment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.comments 
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) 
  WHERE id = comment_id;
END;
$$;


ALTER FUNCTION "public"."decrement_comment_likes"("comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_call_report_details"("report_id" "uuid") RETURNS TABLE("call_id" "uuid", "call_type" "text", "host_id" "uuid", "participants" "text"[], "duration" interval, "reported_user_id" "uuid", "reporter_id" "uuid", "reason" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.target_id AS call_id,
    r.context->>'call_type' AS call_type,
    qcr.user_id AS host_id,
    ARRAY_AGG(rp.user_id::TEXT) FILTER (WHERE rp.user_id IS NOT NULL) AS participants,
    MAKE_INTERVAL(secs := (r.context->>'call_duration')::INT) AS duration,
    (r.context->>'reported_user_id')::UUID AS reported_user_id,
    r.reporter_id,
    r.reason,
    r.created_at
  FROM reports r
  LEFT JOIN quick_connect_requests qcr ON qcr.room_id = r.target_id::text  -- ✅ cast to text
  LEFT JOIN room_participants rp ON rp.room_id = r.target_id::text         -- ✅ cast to text
  WHERE r.id = report_id AND r.target_type = 'call'
  GROUP BY r.id, qcr.user_id;
END;
$$;


ALTER FUNCTION "public"."get_call_report_details"("report_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "replying_to_id" "uuid",
    "reply_to" "uuid",
    "file_url" "text",
    "file_type" "text",
    "deleted_for" "text"[],
    "deleted_for_uuid" "uuid"[] DEFAULT '{}'::"uuid"[],
    "deleted_for_everyone" boolean DEFAULT false,
    "reactions" "jsonb" DEFAULT '{}'::"jsonb",
    "receiver_id" "uuid",
    "deleted_for_me" "uuid"[]
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_conversation_messages"("target_user_id" "uuid", "target_conversation_id" "uuid") RETURNS SETOF "public"."messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select *
  from messages
  where 
    conversation_id = target_conversation_id
    and (
      deleted_for is null 
      or array_length(deleted_for, 1) is null  -- handles empty array
      or not (target_user_id::text = any(deleted_for))
    )
  order by created_at asc;
end;
$$;


ALTER FUNCTION "public"."get_conversation_messages"("target_user_id" "uuid", "target_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_for_user"("conv_id" "uuid", "viewer_id" "uuid") RETURNS SETOF "public"."messages"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT *
  FROM messages
  WHERE conversation_id = conv_id
    AND (deleted_for_uuid IS NULL OR NOT (deleted_for_uuid @> ARRAY[viewer_id]));
$$;


ALTER FUNCTION "public"."get_messages_for_user"("conv_id" "uuid", "viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_unread_messages"("target_user_id" "uuid") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COALESCE(SUM(unread_count), 0)::BIGINT
  FROM get_user_conversations(target_user_id);
$$;


ALTER FUNCTION "public"."get_total_unread_messages"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_conversations_with_unread"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "other_user_id" "uuid", "other_user_full_name" "text", "other_user_avatar_url" "text", "last_message" "text", "last_message_at" timestamp with time zone, "other_user_last_seen" timestamp with time zone, "other_user_is_online" boolean, "unread_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT
      c.id,
      CASE 
        WHEN c.user1_id = p_user_id THEN c.user2_id
        ELSE c.user1_id 
      END AS other_user_id,
      MAX(m.created_at) AS last_message_at
    FROM conversations c
    LEFT JOIN messages m 
      ON m.conversation_id = c.id 
      AND (m.deleted_for_me IS NULL OR NOT (p_user_id = ANY(m.deleted_for_me)))
      AND NOT m.deleted_for_everyone
    WHERE (c.user1_id = p_user_id OR c.user2_id = p_user_id)
    GROUP BY c.id, other_user_id
  )
  SELECT
    uc.id,
    uc.other_user_id,
    p.full_name,
    p.avatar_url,
    (
      SELECT m.content 
      FROM messages m
      WHERE m.conversation_id = uc.id 
        AND (m.deleted_for_me IS NULL OR NOT (p_user_id = ANY(m.deleted_for_me)))
        AND NOT m.deleted_for_everyone
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message,
    uc.last_message_at,
    p.last_seen,
    p.is_online,
    COUNT(*) FILTER (
      WHERE 
        m.created_at > cp.last_read_at 
        AND m.sender_id != p_user_id
        AND (m.deleted_for_me IS NULL OR NOT (p_user_id = ANY(m.deleted_for_me)))
        AND NOT m.deleted_for_everyone
    ) AS unread_count
  FROM user_conversations uc
  JOIN profiles p ON p.id = uc.other_user_id
  LEFT JOIN messages m 
    ON m.conversation_id = uc.id
    AND (m.deleted_for_me IS NULL OR NOT (p_user_id = ANY(m.deleted_for_me)))
    AND NOT m.deleted_for_everyone
  LEFT JOIN conversation_participants cp 
    ON cp.conversation_id = uc.id AND cp.user_id = p_user_id
  GROUP BY uc.id, uc.other_user_id, p.full_name, p.avatar_url, 
           uc.last_message_at, p.last_seen, p.is_online, cp.last_read_at
  ORDER BY uc.last_message_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_user_conversations_with_unread"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_visible_messages"("conv_id" "uuid") RETURNS TABLE("id" "uuid", "conversation_id" "uuid", "sender_id" "uuid", "content" "text", "created_at" timestamp with time zone, "reply_to" "uuid", "file_url" "text", "file_type" "text", "sender" json)
    LANGUAGE "sql"
    AS $$
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.created_at,
    m.reply_to,
    m.file_url,
    m.file_type,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ) AS sender
  FROM messages m
  JOIN profiles p ON m.sender_id = p.id
  LEFT JOIN message_deletions md 
    ON m.id = md.message_id 
    AND md.user_id = auth.uid()
  WHERE m.conversation_id = conv_id
    AND md.message_id IS NULL
  ORDER BY m.created_at ASC;
$$;


ALTER FUNCTION "public"."get_visible_messages"("conv_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_comment_likes"("comment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE public.comments 
  SET likes_count = COALESCE(likes_count, 0) + 1 
  WHERE id = comment_id
  RETURNING likes_count INTO new_count;

  RETURN new_count;
END;
$$;


ALTER FUNCTION "public"."increment_comment_likes"("comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_resource_vote"("resource_id" "uuid", "vote_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF vote_type = 'helpful' THEN
    UPDATE resources SET helpful_count = COALESCE(helpful_count, 0) + 1 WHERE id = resource_id;
  ELSIF vote_type = 'unhelpful' THEN
    UPDATE resources SET unhelpful_count = COALESCE(unhelpful_count, 0) + 1 WHERE id = resource_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."increment_resource_vote"("resource_id" "uuid", "vote_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_deleted_for_user"("conv_id" "uuid", "user_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE messages
  SET deleted_for_me = ARRAY(
    SELECT DISTINCT UNNEST(
      ARRAY_APPEND(
        COALESCE(deleted_for_me, ARRAY[]::TEXT[]),
        user_id
      )
    )
    ORDER BY 1
  )
  WHERE conversation_id = conv_id
    AND (deleted_for_me IS NULL OR NOT (user_id = ANY(deleted_for_me)));
END;
$$;


ALTER FUNCTION "public"."mark_conversation_deleted_for_user"("conv_id" "uuid", "user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_read"("p_conv_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO conversation_participants (conversation_id, user_id, last_read_at)
  VALUES (p_conv_id, p_user_id, NOW())
  ON CONFLICT (conversation_id, user_id) 
  DO UPDATE SET 
    last_read_at = NOW(),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."mark_conversation_read"("p_conv_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_community_on_new_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  community_name TEXT;
  author_name TEXT;
  member_record RECORD;
BEGIN
  -- Get community name
  SELECT name INTO community_name
  FROM communities
  WHERE id = NEW.community_id;

  -- Get author's display name
  SELECT COALESCE(p.full_name, 'A member') INTO author_name
  FROM profiles p
  WHERE p.id = NEW.user_id;

  IF author_name IS NULL THEN
    author_name := 'A member';
  END IF;

  -- Insert notification for each member (except poster)
  FOR member_record IN
    SELECT user_id
    FROM community_members
    WHERE community_id = NEW.community_id
      AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, sender_id, type, message, link, read)
    VALUES (
      member_record.user_id,
      NEW.user_id,  -- sender_id
      'community_post',
      author_name || ' shared a new post in ' || community_name,
      '/communities/' || NEW.community_id || '?postId=' || NEW.id,  -- ✅ Now includes postId
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_community_on_new_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_call_started_at"("room_id" "text", "table_name" "text") RETURNS TABLE("call_started_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  start_time TIMESTAMPTZ;
BEGIN
  -- Only set if currently NULL
  EXECUTE format(
    'UPDATE %I 
     SET call_started_at = COALESCE(call_started_at, NOW()) 
     WHERE room_id = $1 
     RETURNING call_started_at',
    table_name
  ) USING room_id INTO start_time;
  
  -- Return the current value (whether we set it or not)
  RETURN QUERY EXECUTE format(
    'SELECT call_started_at FROM %I WHERE room_id = $1',
    table_name
  ) USING room_id;
END;
$_$;


ALTER FUNCTION "public"."set_call_started_at"("room_id" "text", "table_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update messages
  set deleted_for = array_append(
    coalesce(deleted_for, '{}'::text[]),
    auth.uid()::text  -- cast to text!
  )
  where id = msg_id
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    );
end;
$$;


ALTER FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE messages
  SET deleted_for_uuid = ARRAY(
    SELECT DISTINCT UNNEST(
      array_append(deleted_for_uuid, user_id)
    )
  )
  WHERE id = msg_id
    AND NOT (deleted_for_uuid @> ARRAY[user_id]);
END;
$$;


ALTER FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_post_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts 
    SET likes_count = COALESCE(likes_count, 0) + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts 
    SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_post_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_read_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.read_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_read_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_resource_vote_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Handle both INSERT/UPDATE and DELETE
  IF (TG_OP = 'DELETE') THEN
    UPDATE resources
    SET
      helpful_count = (
        SELECT COUNT(*) FROM resource_votes
        WHERE resource_id = OLD.resource_id AND vote_type = 'helpful'
      ),
      unhelpful_count = (
        SELECT COUNT(*) FROM resource_votes
        WHERE resource_id = OLD.resource_id AND vote_type = 'unhelpful'
      )
    WHERE id = OLD.resource_id;
  ELSE
    UPDATE resources
    SET
      helpful_count = (
        SELECT COUNT(*) FROM resource_votes
        WHERE resource_id = NEW.resource_id AND vote_type = 'helpful'
      ),
      unhelpful_count = (
        SELECT COUNT(*) FROM resource_votes
        WHERE resource_id = NEW.resource_id AND vote_type = 'unhelpful'
      )
    WHERE id = NEW.resource_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_resource_vote_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."angel_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "angel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "angel_comments_content_check" CHECK (("char_length"("content") <= 500))
);


ALTER TABLE "public"."angel_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."angel_hearts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "angel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."angel_hearts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."angel_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "angel_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."angel_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."angel_moments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "angel_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "media_urls" "text"[],
    "occurred_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_private" boolean DEFAULT false,
    "allow_comments" boolean DEFAULT true,
    "hearts_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."angel_moments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."angels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "relationship" "text",
    "photo_url" "text",
    "birth_date" "date",
    "death_date" "date",
    "tribute" "text",
    "grief_type" "text" NOT NULL,
    "is_private" boolean DEFAULT false,
    "allow_comments" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sunrise" "date",
    "sunset" "date",
    "other_loss_description" "text",
    CONSTRAINT "angels_grief_type_check" CHECK (("grief_type" = ANY (ARRAY['parent'::"text", 'child'::"text", 'spouse'::"text", 'sibling'::"text", 'friend'::"text", 'pet'::"text", 'miscarriage'::"text", 'caregiver'::"text", 'suicide'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."angels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caller_id" "uuid" NOT NULL,
    "caller_name" "text" NOT NULL,
    "room_name" "text",
    "status" "text" NOT NULL,
    "acceptor_id" "uuid",
    "acceptor_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "callee_id" "uuid",
    CONSTRAINT "calls_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "parent_type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "author_name" "text" NOT NULL,
    "author_avatar_url" "text",
    "content" "text" NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "parent_comment_id" "uuid",
    "replies_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "comments_content_check" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 10000))),
    CONSTRAINT "comments_likes_count_check" CHECK (("likes_count" >= 0)),
    CONSTRAINT "comments_parent_type_check" CHECK (("parent_type" = ANY (ARRAY['post'::"text", 'story'::"text", 'memory'::"text"])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communities" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "member_count" integer DEFAULT 0,
    "online_count" integer DEFAULT 0,
    "grief_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cover_photo_url" "text",
    "id_new" "uuid" DEFAULT "gen_random_uuid"(),
    "other_loss_description" "text"
);


ALTER TABLE "public"."communities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_members" (
    "community_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_admin" boolean DEFAULT false,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    CONSTRAINT "valid_role" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."community_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "cover_photo_url" "text",
    "grief_types" "text"[],
    "grief_detail" "text",
    "accepts_calls" boolean DEFAULT true,
    "accept_from_genders" "text"[],
    "accept_from_countries" "text"[],
    "accept_from_languages" "text"[],
    "is_anonymous" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepts_video_calls" boolean DEFAULT false,
    "last_online" timestamp with time zone,
    "username" "text",
    "email" "text",
    "last_seen" timestamp with time zone,
    "avatar_rate" "text",
    "is_online" boolean DEFAULT false,
    "country" "text",
    "about" "text",
    "other_loss_description" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."communities_with_counts" AS
 SELECT "c"."id",
    "c"."name",
    "c"."description",
    "c"."grief_type",
    "c"."created_at",
    "c"."cover_photo_url",
    (COALESCE("m"."member_count", (0)::bigint))::integer AS "member_count",
    (COALESCE("o"."online_count", (0)::bigint))::integer AS "online_count"
   FROM (("public"."communities" "c"
     LEFT JOIN ( SELECT "community_members"."community_id",
            "count"(*) AS "member_count"
           FROM "public"."community_members"
          GROUP BY "community_members"."community_id") "m" ON (("m"."community_id" = "c"."id")))
     LEFT JOIN ( SELECT "cm"."community_id",
            "count"(*) AS "online_count"
           FROM ("public"."community_members" "cm"
             JOIN "public"."profiles" "p" ON (("cm"."user_id" = "p"."id")))
          WHERE ("p"."last_online" > ("now"() - '00:01:00'::interval))
          GROUP BY "cm"."community_id") "o" ON (("o"."community_id" = "c"."id")));


ALTER VIEW "public"."communities_with_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."community_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_id" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text",
    "file_url" "text",
    "file_type" "text",
    "reply_to" "uuid",
    "reactions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_messages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."community_online_counts" AS
 SELECT "cm"."community_id",
    "count"(*) FILTER (WHERE ("p"."last_seen" > ("now"() - '00:05:00'::interval))) AS "online_count"
   FROM ("public"."community_members" "cm"
     JOIN "public"."profiles" "p" ON (("cm"."user_id" = "p"."id")))
  GROUP BY "cm"."community_id";


ALTER VIEW "public"."community_online_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."community_online_members" AS
 SELECT "cm"."community_id",
    "cm"."user_id",
    "p"."id" AS "profile_id",
    "p"."full_name",
    "p"."avatar_url",
    "p"."last_online"
   FROM ("public"."community_members" "cm"
     JOIN "public"."profiles" "p" ON (("cm"."user_id" = "p"."id")))
  WHERE ("p"."last_online" > ("now"() - '00:05:00'::interval));


ALTER VIEW "public"."community_online_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_post_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_comment_id" "uuid"
);


ALTER TABLE "public"."community_post_comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."community_post_comments_with_profiles" AS
 SELECT "c"."id",
    "c"."post_id",
    "c"."user_id",
    "c"."content",
    "c"."created_at",
    "c"."updated_at",
    "c"."parent_comment_id",
    "p"."full_name" AS "username",
    "p"."avatar_url",
    "p"."is_anonymous"
   FROM ("public"."community_post_comments" "c"
     JOIN "public"."profiles" "p" ON (("c"."user_id" = "p"."id")));


ALTER VIEW "public"."community_post_comments_with_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_post_likes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."community_post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "community_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "media_url" "text",
    "media_urls" "text"[],
    CONSTRAINT "community_posts_content_check" CHECK (("char_length"("content") <= 1000))
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_user_views" (
    "user_id" "uuid" NOT NULL,
    "community_id" "text" NOT NULL,
    "last_feed_view" timestamp with time zone,
    "last_chat_view" timestamp with time zone
);


ALTER TABLE "public"."community_user_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_for_user" "text"[]
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deleted_conversations" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deleted_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "host_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "duration" integer NOT NULL,
    "max_attendees" integer DEFAULT 20,
    "grief_types" "text"[],
    "is_recurring" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "host_name" "text",
    "image_url" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."events_with_attendee_count" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "title",
    NULL::"text" AS "description",
    NULL::timestamp with time zone AS "start_time",
    NULL::integer AS "duration",
    NULL::"text" AS "host_name",
    NULL::"text" AS "image_url",
    NULL::"text"[] AS "grief_types",
    NULL::boolean AS "is_recurring",
    NULL::timestamp with time zone AS "created_at",
    NULL::integer AS "attendee_count";


ALTER VIEW "public"."events_with_attendee_count" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "current_players" integer DEFAULT 0,
    "max_players" integer DEFAULT 20,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."help_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "accepted_by" "uuid",
    "room_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "help_requests_message_check" CHECK ((("char_length"("message") >= 10) AND ("char_length"("message") <= 500))),
    CONSTRAINT "help_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'accepted'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."help_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "likes_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'community_post'::"text", 'story'::"text", 'memory'::"text"])))
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "memory_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memory_comments_content_check" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 500)))
);


ALTER TABLE "public"."memory_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_garden_flowers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "message" "text",
    "x" real NOT NULL,
    "y" real NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memory_garden_flowers_message_check" CHECK (("char_length"("message") <= 120)),
    CONSTRAINT "memory_garden_flowers_name_check" CHECK (("char_length"("name") > 0)),
    CONSTRAINT "memory_garden_flowers_x_check" CHECK ((("x" >= (0)::double precision) AND ("x" <= (1)::double precision))),
    CONSTRAINT "memory_garden_flowers_y_check" CHECK ((("y" >= (0)::double precision) AND ("y" <= (1)::double precision)))
);


ALTER TABLE "public"."memory_garden_flowers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_hearts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "memory_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."memory_hearts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_deletions" (
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."message_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source_id" "uuid",
    "expires_at" timestamp with time zone,
    "one_on_one_request_id" "uuid",
    "group_request_id" "uuid",
    "community_post_id" "uuid",
    "resource_id" "uuid",
    "post_id" "uuid",
    "community_id" "text",
    "sender_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['community_post'::"text", 'comment'::"text", 'like'::"text", 'one_on_one_request'::"text", 'group_request'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."post_comments_with_profiles" AS
 SELECT "pc"."id",
    "pc"."post_id",
    "pc"."user_id",
    "pc"."content",
    "pc"."parent_comment_id",
    "pc"."created_at",
    "p"."full_name" AS "username",
    "p"."avatar_url",
    "p"."is_anonymous"
   FROM ("public"."post_comments" "pc"
     LEFT JOIN "public"."profiles" "p" ON (("pc"."user_id" = "p"."id")));


ALTER VIEW "public"."post_comments_with_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "text" "text" NOT NULL,
    "media_urls" "text"[],
    "grief_types" "text"[],
    "is_anonymous" boolean DEFAULT true,
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "community_id" "text",
    "comments_count" integer DEFAULT 0
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_post_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_post_comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."profile_post_comments_with_profiles" AS
 SELECT "c"."id",
    "c"."post_id",
    "c"."user_id",
    "c"."content",
    "c"."parent_comment_id",
    "c"."created_at",
    "p"."full_name" AS "username",
    "p"."avatar_url",
    "p"."is_anonymous"
   FROM ("public"."profile_post_comments" "c"
     JOIN "public"."profiles" "p" ON (("c"."user_id" = "p"."id")));


ALTER VIEW "public"."profile_post_comments_with_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_connect_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:10:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "room_id" "text",
    "acceptor_id" "uuid",
    "call_started_at" timestamp with time zone,
    "context" "text",
    CONSTRAINT "quick_connect_requests_context_check" CHECK (("char_length"("context") <= 280)),
    CONSTRAINT "quick_connect_requests_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'matched'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."quick_connect_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_group_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "room_id" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "call_started_at" timestamp with time zone,
    "context" "text",
    CONSTRAINT "quick_group_requests_context_check" CHECK (("char_length"("context") <= 280)),
    CONSTRAINT "quick_group_requests_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'matched'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."quick_group_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "moderator_id" "uuid",
    "resolution_notes" "text",
    "resolved_at" timestamp with time zone,
    "context" "jsonb",
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['call'::"text", 'comment'::"text", 'post'::"text", 'user'::"text", 'community'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_votes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "resource_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "vote_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "resource_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['helpful'::"text", 'unhelpful'::"text"])))
);


ALTER TABLE "public"."resource_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."resource_status" DEFAULT 'pending'::"public"."resource_status" NOT NULL,
    "is_curated" boolean DEFAULT false NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text" NOT NULL,
    "type" "public"."resource_type" NOT NULL,
    "category" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "book_author" "text",
    "book_quote" "text",
    "external_url" "text",
    "content_warnings" "text"[] DEFAULT '{}'::"text"[],
    "community_source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "video_type" "text",
    "video_url" "text",
    "book_cover_url" "text",
    "helpful_count" integer DEFAULT 0,
    "unhelpful_count" integer DEFAULT 0,
    CONSTRAINT "resources_category_check" CHECK (("category" = ANY (ARRAY['Personal Stories'::"text", 'Guidance'::"text", 'Tools'::"text", 'Videos'::"text", 'Books'::"text"])))
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "text" NOT NULL,
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    "role" "text" DEFAULT 'participant'::"text" NOT NULL,
    "active" boolean DEFAULT true,
    CONSTRAINT "room_participants_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'participant'::"text", 'moderator'::"text"])))
);


ALTER TABLE "public"."room_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_participants" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    "is_host" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."session_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "grief_types" "text"[] NOT NULL,
    "host_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "participant_limit" integer DEFAULT 8 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "mode" "text" DEFAULT 'audio'::"text",
    CONSTRAINT "sessions_mode_check" CHECK (("mode" = ANY (ARRAY['audio'::"text", 'video'::"text"]))),
    CONSTRAINT "sessions_participant_limit_check" CHECK (("participant_limit" > 0)),
    CONSTRAINT "sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['one_on_one'::"text", 'group'::"text"]))),
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggestions" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "category" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "suggestions_category_check" CHECK (("category" = ANY (ARRAY['bug'::"text", 'feature'::"text", 'general'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."suggestions" OWNER TO "postgres";


ALTER TABLE "public"."suggestions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."suggestions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."support_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "grief_type" "text",
    "request_type" "text",
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "matched_at" timestamp with time zone,
    "session_id" "uuid",
    "requester_id" "uuid",
    "responder_id" "uuid",
    "accepted_by" "uuid",
    CONSTRAINT "support_requests_grief_type_check" CHECK (("grief_type" = ANY (ARRAY['parent'::"text", 'child'::"text", 'spouse'::"text", 'sibling'::"text", 'friend'::"text", 'pet'::"text", 'miscarriage'::"text", 'caregiver'::"text", 'suicide'::"text", 'other'::"text"]))),
    CONSTRAINT "support_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['one_on_one'::"text", 'group'::"text"]))),
    CONSTRAINT "support_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."support_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_presence" AS
 SELECT "id" AS "user_id",
    "last_seen",
    ("last_seen" > ("now"() - '00:01:00'::interval)) AS "is_online"
   FROM "public"."profiles";


ALTER VIEW "public"."user_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "last_online" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."angel_comments"
    ADD CONSTRAINT "angel_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."angel_hearts"
    ADD CONSTRAINT "angel_hearts_angel_id_user_id_key" UNIQUE ("angel_id", "user_id");



ALTER TABLE ONLY "public"."angel_hearts"
    ADD CONSTRAINT "angel_hearts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."angel_memories"
    ADD CONSTRAINT "angel_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."angel_moments"
    ADD CONSTRAINT "angel_moments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."angels"
    ADD CONSTRAINT "angels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_room_name_key" UNIQUE ("room_name");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communities"
    ADD CONSTRAINT "communities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_likes"
    ADD CONSTRAINT "community_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_pkey" PRIMARY KEY ("community_id", "user_id");



ALTER TABLE ONLY "public"."community_messages"
    ADD CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_user_views"
    ADD CONSTRAINT "community_user_views_pkey" PRIMARY KEY ("user_id", "community_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_user2_id_key" UNIQUE ("user1_id", "user2_id");



ALTER TABLE ONLY "public"."deleted_conversations"
    ADD CONSTRAINT "deleted_conversations_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_chat_messages"
    ADD CONSTRAINT "event_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_comments"
    ADD CONSTRAINT "memory_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_garden_flowers"
    ADD CONSTRAINT "memory_garden_flowers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_hearts"
    ADD CONSTRAINT "memory_hearts_memory_id_user_id_key" UNIQUE ("memory_id", "user_id");



ALTER TABLE ONLY "public"."memory_hearts"
    ADD CONSTRAINT "memory_hearts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_deletions"
    ADD CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_pkey" PRIMARY KEY ("message_id", "user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_post_comments"
    ADD CONSTRAINT "profile_post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_connect_requests"
    ADD CONSTRAINT "quick_connect_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_group_requests"
    ADD CONSTRAINT "quick_group_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_votes"
    ADD CONSTRAINT "resource_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_votes"
    ADD CONSTRAINT "resource_votes_resource_id_user_id_key" UNIQUE ("resource_id", "user_id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_participants"
    ADD CONSTRAINT "room_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_participants"
    ADD CONSTRAINT "room_participants_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."session_participants"
    ADD CONSTRAINT "session_participants_pkey" PRIMARY KEY ("session_id", "user_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggestions"
    ADD CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "angel_moments_angel_id_idx" ON "public"."angel_moments" USING "btree" ("angel_id");



CREATE INDEX "angel_moments_profile_id_idx" ON "public"."angel_moments" USING "btree" ("profile_id");



CREATE INDEX "angels_profile_id_idx" ON "public"."angels" USING "btree" ("profile_id");



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE UNIQUE INDEX "idx_comment_likes_unique" ON "public"."comment_likes" USING "btree" ("comment_id", "user_id");



CREATE INDEX "idx_comment_likes_user_id" ON "public"."comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_comments_active" ON "public"."comments" USING "btree" ("parent_id", "created_at" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_comments_created" ON "public"."comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comments_likes" ON "public"."comments" USING "btree" ("likes_count" DESC);



CREATE INDEX "idx_comments_parent" ON "public"."comments" USING "btree" ("parent_id", "parent_type", "created_at" DESC);



CREATE INDEX "idx_comments_user" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_community_likes_post" ON "public"."community_likes" USING "btree" ("post_id");



CREATE INDEX "idx_community_likes_user" ON "public"."community_likes" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user1" ON "public"."conversations" USING "btree" ("user1_id");



CREATE INDEX "idx_conversations_user2" ON "public"."conversations" USING "btree" ("user2_id");



CREATE INDEX "idx_event_attendees_event_id" ON "public"."event_attendees" USING "btree" ("event_id");



CREATE INDEX "idx_event_chat_messages_created_at" ON "public"."event_chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_event_chat_messages_event_id" ON "public"."event_chat_messages" USING "btree" ("event_id");



CREATE INDEX "idx_message_deletions_user" ON "public"."message_deletions" USING "btree" ("user_id");



CREATE INDEX "idx_message_reads_message" ON "public"."message_reads" USING "btree" ("message_id");



CREATE INDEX "idx_message_reads_user_message" ON "public"."message_reads" USING "btree" ("user_id", "message_id");



CREATE INDEX "idx_messages_deleted_for_me" ON "public"."messages" USING "gin" ("deleted_for_me");



CREATE INDEX "idx_messages_receiver_id" ON "public"."messages" USING "btree" ("receiver_id");



CREATE INDEX "idx_messages_reply_to" ON "public"."messages" USING "btree" ("reply_to");



CREATE INDEX "idx_notifications_expires" ON "public"."notifications" USING "btree" ("expires_at");



CREATE INDEX "idx_notifications_source" ON "public"."notifications" USING "btree" ("source_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_profiles_last_seen" ON "public"."profiles" USING "btree" ("last_seen" DESC);



CREATE INDEX "idx_qc_room_id" ON "public"."quick_connect_requests" USING "btree" ("room_id");



CREATE INDEX "idx_qg_room_id" ON "public"."quick_group_requests" USING "btree" ("room_id");



CREATE INDEX "idx_quick_group_requests_expires_at" ON "public"."quick_group_requests" USING "btree" ("expires_at");



CREATE INDEX "idx_quick_group_requests_status" ON "public"."quick_group_requests" USING "btree" ("status");



CREATE INDEX "idx_quick_group_requests_status_expires" ON "public"."quick_group_requests" USING "btree" ("status", "expires_at");



CREATE INDEX "idx_quick_group_requests_user_id" ON "public"."quick_group_requests" USING "btree" ("user_id");



CREATE INDEX "idx_reports_call_context" ON "public"."reports" USING "gin" ("context");



CREATE INDEX "idx_reports_created_at" ON "public"."reports" USING "btree" ("created_at");



CREATE INDEX "idx_reports_reporter" ON "public"."reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_reports_status" ON "public"."reports" USING "btree" ("status");



CREATE INDEX "idx_reports_target" ON "public"."reports" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_rp_room_id" ON "public"."room_participants" USING "btree" ("room_id");



CREATE INDEX "idx_session_participants_session" ON "public"."session_participants" USING "btree" ("session_id");



CREATE INDEX "idx_session_participants_user" ON "public"."session_participants" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_status_type_grief" ON "public"."sessions" USING "btree" ("status", "session_type") WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE UNIQUE INDEX "idx_unique_user_target" ON "public"."likes" USING "btree" ("user_id", "target_type", "target_id");



CREATE INDEX "resources_created_at_idx" ON "public"."resources" USING "btree" ("created_at" DESC);



CREATE INDEX "resources_status_idx" ON "public"."resources" USING "btree" ("status");



CREATE INDEX "resources_tags_idx" ON "public"."resources" USING "gin" ("tags");



CREATE INDEX "resources_type_idx" ON "public"."resources" USING "btree" ("type");



CREATE INDEX "resources_user_id_idx" ON "public"."resources" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "public"."events_with_attendee_count" AS
 SELECT "e"."id",
    "e"."title",
    "e"."description",
    "e"."start_time",
    "e"."duration",
    "e"."host_name",
    "e"."image_url",
    "e"."grief_types",
    "e"."is_recurring",
    "e"."created_at",
    ("count"("ea"."user_id"))::integer AS "attendee_count"
   FROM ("public"."events" "e"
     LEFT JOIN "public"."event_attendees" "ea" ON (("e"."id" = "ea"."event_id")))
  GROUP BY "e"."id";



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "trigger_notify_on_new_community_post" AFTER INSERT ON "public"."community_posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_community_on_new_post"();



CREATE OR REPLACE TRIGGER "trigger_update_post_comments_count" AFTER INSERT OR DELETE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_post_likes_count" AFTER INSERT OR DELETE ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_likes_count"();



CREATE OR REPLACE TRIGGER "trigger_update_vote_counts" AFTER INSERT OR DELETE OR UPDATE ON "public"."resource_votes" FOR EACH ROW EXECUTE FUNCTION "public"."update_resource_vote_counts"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_read_timestamp_trigger" BEFORE INSERT OR UPDATE ON "public"."message_reads" FOR EACH ROW EXECUTE FUNCTION "public"."update_read_timestamp"();



ALTER TABLE ONLY "public"."angel_comments"
    ADD CONSTRAINT "angel_comments_angel_id_fkey" FOREIGN KEY ("angel_id") REFERENCES "public"."angels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angel_comments"
    ADD CONSTRAINT "angel_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angel_hearts"
    ADD CONSTRAINT "angel_hearts_angel_id_fkey" FOREIGN KEY ("angel_id") REFERENCES "public"."angels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angel_hearts"
    ADD CONSTRAINT "angel_hearts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angel_memories"
    ADD CONSTRAINT "angel_memories_angel_id_fkey" FOREIGN KEY ("angel_id") REFERENCES "public"."angels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angel_moments"
    ADD CONSTRAINT "angel_moments_angel_id_fkey" FOREIGN KEY ("angel_id") REFERENCES "public"."angels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."angels"
    ADD CONSTRAINT "angels_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_acceptor_id_fkey" FOREIGN KEY ("acceptor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_likes"
    ADD CONSTRAINT "community_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_likes"
    ADD CONSTRAINT "community_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_messages"
    ADD CONSTRAINT "community_messages_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_messages"
    ADD CONSTRAINT "community_messages_reply_to_fkey" FOREIGN KEY ("reply_to") REFERENCES "public"."community_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_messages"
    ADD CONSTRAINT "community_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."community_post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_comments"
    ADD CONSTRAINT "community_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_post_likes"
    ADD CONSTRAINT "community_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_user_views"
    ADD CONSTRAINT "community_user_views_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_user_views"
    ADD CONSTRAINT "community_user_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deleted_conversations"
    ADD CONSTRAINT "deleted_conversations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deleted_conversations"
    ADD CONSTRAINT "deleted_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendees"
    ADD CONSTRAINT "event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "fk_acceptor" FOREIGN KEY ("acceptor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "fk_callee" FOREIGN KEY ("callee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "fk_caller" FOREIGN KEY ("caller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_members"
    ADD CONSTRAINT "fk_community_members_user_id" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_comments"
    ADD CONSTRAINT "fk_memory_comments_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_hearts"
    ADD CONSTRAINT "fk_memory_hearts_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."help_requests"
    ADD CONSTRAINT "help_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."memory_comments"
    ADD CONSTRAINT "memory_comments_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "public"."angel_memories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_comments"
    ADD CONSTRAINT "memory_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_hearts"
    ADD CONSTRAINT "memory_hearts_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "public"."angel_memories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_hearts"
    ADD CONSTRAINT "memory_hearts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_deletions"
    ADD CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_deletions"
    ADD CONSTRAINT "message_deletions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_fkey" FOREIGN KEY ("reply_to") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_replying_to_id_fkey" FOREIGN KEY ("replying_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_community_post_id_fkey" FOREIGN KEY ("community_post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_group_request_id_fkey" FOREIGN KEY ("group_request_id") REFERENCES "public"."quick_group_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_one_on_one_request_id_fkey" FOREIGN KEY ("one_on_one_request_id") REFERENCES "public"."quick_connect_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_post_comments"
    ADD CONSTRAINT "profile_post_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."profile_post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_post_comments"
    ADD CONSTRAINT "profile_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_post_comments"
    ADD CONSTRAINT "profile_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_connect_requests"
    ADD CONSTRAINT "quick_connect_requests_acceptor_id_fkey" FOREIGN KEY ("acceptor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."quick_connect_requests"
    ADD CONSTRAINT "quick_connect_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_group_requests"
    ADD CONSTRAINT "quick_group_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_votes"
    ADD CONSTRAINT "resource_votes_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_participants"
    ADD CONSTRAINT "room_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participants"
    ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_participants"
    ADD CONSTRAINT "session_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suggestions"
    ADD CONSTRAINT "suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_requests"
    ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update member roles" ON "public"."community_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."community_members" "cm"
  WHERE (("cm"."community_id" = "community_members"."community_id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"text"))))) WITH CHECK (true);



CREATE POLICY "Allow admins and moderators to update community" ON "public"."communities" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."community_members"
  WHERE (("community_members"."community_id" = "communities"."id") AND ("community_members"."user_id" = "auth"."uid"()) AND ("community_members"."role" = ANY (ARRAY['admin'::"text", 'moderator'::"text"]))))));



CREATE POLICY "Allow admins to update community" ON "public"."communities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."community_members" "cm"
  WHERE (("cm"."community_id" = "communities"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"text")))));



CREATE POLICY "Allow authenticated users to accept help requests" ON "public"."help_requests" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to create help requests" ON "public"."help_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow authenticated users to create sessions" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "host_id"));



CREATE POLICY "Allow authenticated users to insert session participants" ON "public"."session_participants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow insert for authenticated users" ON "public"."session_participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow members to update community" ON "public"."communities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."community_members" "cm"
  WHERE (("cm"."community_id" = "communities"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = 'admin'::"text")))));



CREATE POLICY "Allow only admins to delete community" ON "public"."communities" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."community_members"
  WHERE (("community_members"."community_id" = "communities"."id") AND ("community_members"."user_id" = "auth"."uid"()) AND ("community_members"."role" = 'admin'::"text")))));



CREATE POLICY "Allow public read access for member count" ON "public"."community_members" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Allow read all support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow users to join sessions" ON "public"."session_participants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_participants"."session_id") AND (("s"."host_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."support_requests" "sr"
          WHERE (("sr"."session_id" = "s"."id") AND ("sr"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Any authenticated user can read pending support requests" ON "public"."support_requests" FOR SELECT TO "authenticated" USING (("status" = 'pending'::"text"));



CREATE POLICY "Anyone can plant a flower" ON "public"."memory_garden_flowers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated can comment" ON "public"."profile_post_comments" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can create communities" ON "public"."communities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can create help requests" ON "public"."help_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can update their own help requests" ON "public"."help_requests" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "accepted_by"))) WITH CHECK ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "accepted_by")));



CREATE POLICY "Comments are readable by everyone" ON "public"."memory_comments" FOR SELECT USING (true);



CREATE POLICY "Communities are public" ON "public"."communities" FOR SELECT USING (true);



CREATE POLICY "Enable public read access on resource_votes" ON "public"."resource_votes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Enable read access for all authenticated users" ON "public"."resource_votes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Events are public" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Everyone can view comments" ON "public"."community_post_comments" FOR SELECT USING (true);



CREATE POLICY "Flowers are viewable by everyone" ON "public"."memory_garden_flowers" FOR SELECT USING (true);



CREATE POLICY "Games are public" ON "public"."games" FOR SELECT USING (true);



CREATE POLICY "Hearts are public" ON "public"."post_likes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Hearts are readable by everyone" ON "public"."memory_hearts" FOR SELECT USING (true);



CREATE POLICY "Helpers can accept requests" ON "public"."help_requests" FOR UPDATE USING (("status" = 'open'::"text")) WITH CHECK ((("auth"."uid"() = "accepted_by") AND ("status" = 'accepted'::"text")));



CREATE POLICY "Hosts can create their own sessions" ON "public"."sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "host_id"));



CREATE POLICY "Hosts can delete their own sessions" ON "public"."sessions" FOR DELETE USING (("auth"."uid"() = "host_id"));



CREATE POLICY "Hosts can update their own sessions" ON "public"."sessions" FOR UPDATE USING (("auth"."uid"() = "host_id"));



CREATE POLICY "Likes are publicly readable" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Likes are publicly readable" ON "public"."community_likes" FOR SELECT USING (true);



CREATE POLICY "Likes are viewable by all" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Members can create posts" ON "public"."community_posts" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."community_members"
  WHERE (("community_members"."community_id" = "community_posts"."community_id") AND ("community_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Members can view their communities" ON "public"."community_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Moderators can approve/reject pending resources" ON "public"."resources" FOR UPDATE TO "authenticated" USING (("status" = 'pending'::"public"."resource_status")) WITH CHECK (("status" = ANY (ARRAY['approved'::"public"."resource_status", 'rejected'::"public"."resource_status"])));



CREATE POLICY "Owners can delete comments" ON "public"."profile_post_comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = ( SELECT "posts"."user_id"
   FROM "public"."posts"
  WHERE ("posts"."id" = "profile_post_comments"."post_id")))));



CREATE POLICY "Posts are viewable by everyone" ON "public"."community_posts" FOR SELECT USING (true);



CREATE POLICY "Public comments readable" ON "public"."profile_post_comments" FOR SELECT USING (true);



CREATE POLICY "Public posts are viewable by all authenticated users" ON "public"."posts" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Public profiles readable by all authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read access for sessions" ON "public"."sessions" FOR SELECT USING (true);



CREATE POLICY "Reporters can manage their own reports" ON "public"."reports" TO "authenticated" USING (("reporter_id" = "auth"."uid"())) WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "User can manage own notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User can read messages in their conversations" ON "public"."messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"()))))) AND (("deleted_for" IS NULL) OR (NOT (("auth"."uid"())::"text" = ANY ("deleted_for"))))));



CREATE POLICY "Users can RSVP to events" ON "public"."event_attendees" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can accept others' requests" ON "public"."quick_connect_requests" FOR UPDATE TO "authenticated" USING ((("status" = 'available'::"text") AND ("user_id" <> "auth"."uid"()))) WITH CHECK ((("status" = 'matched'::"text") AND ("room_id" IS NOT NULL)));



CREATE POLICY "Users can create calls" ON "public"."calls" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create requests" ON "public"."help_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own group requests" ON "public"."quick_group_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own requests" ON "public"."quick_connect_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own resources" ON "public"."resources" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comment" ON "public"."memory_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."community_post_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own group requests" ON "public"."quick_group_requests" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own heart" ON "public"."memory_hearts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own messages" ON "public"."messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own posts" ON "public"."community_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert messages in their conversations" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."user1_id" = "auth"."uid"()) OR ("conversations"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert their own comment" ON "public"."memory_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own comments" ON "public"."community_post_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own heart" ON "public"."memory_hearts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can join communities" ON "public"."community_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can leave communities" ON "public"."community_members" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like and unlike posts" ON "public"."community_post_likes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like comments" ON "public"."comment_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like posts" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like/unlike posts" ON "public"."community_likes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their own message deletions" ON "public"."message_deletions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own message reads" ON "public"."message_reads" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own votes" ON "public"."resource_votes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark messages as read" ON "public"."message_reads" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can register for events" ON "public"."event_registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can report content" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("reporter_id" = "auth"."uid"()) AND ("target_type" = ANY (ARRAY['call'::"text", 'comment'::"text", 'post'::"text", 'user'::"text", 'community'::"text"]))));



CREATE POLICY "Users can soft-delete messages they participate in" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND (("c"."user1_id" = "auth"."uid"()) OR ("c"."user2_id" = "auth"."uid"())))))) WITH CHECK (true);



CREATE POLICY "Users can submit suggestions" ON "public"."suggestions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can unlike comments" ON "public"."comment_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike posts" ON "public"."community_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike posts" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their calls" ON "public"."calls" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "acceptor_id"))) WITH CHECK ((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "acceptor_id")));



CREATE POLICY "Users can update their own available group requests" ON "public"."quick_group_requests" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND ("status" = 'available'::"text"))) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own comments" ON "public"."community_post_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversations" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("user1_id" = "auth"."uid"()) OR ("user2_id" = "auth"."uid"())));



CREATE POLICY "Users can update their own pending resources" ON "public"."resources" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"public"."resource_status")));



CREATE POLICY "Users can update their own posts" ON "public"."community_posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own requests" ON "public"."help_requests" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own requests" ON "public"."quick_connect_requests" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view approved or their own resources" ON "public"."resources" FOR SELECT USING ((("status" = 'approved'::"public"."resource_status") OR (("auth"."uid"() = "user_id") AND ("status" = 'pending'::"public"."resource_status"))));



CREATE POLICY "Users can view available group requests" ON "public"."quick_group_requests" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("status" = 'available'::"text") AND ("expires_at" > "now"()) AND ("user_id" <> "auth"."uid"()))));



CREATE POLICY "Users can view available requests" ON "public"."quick_connect_requests" FOR SELECT TO "authenticated" USING ((("status" = 'available'::"text") AND ("expires_at" > "now"())));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."user1_id" = "auth"."uid"()) OR ("conversations"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view open requests" ON "public"."help_requests" FOR SELECT USING (("status" = 'open'::"text"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view relevant calls" ON "public"."calls" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "acceptor_id") OR ("status" = 'pending'::"text")));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("user1_id" = "auth"."uid"()) OR ("user2_id" = "auth"."uid"())));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "session_participants"."session_id"
   FROM "public"."session_participants"
  WHERE ("session_participants"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users manage own deletions" ON "public"."message_deletions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "auth.role() = 'authenticated'" ON "public"."support_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_garden_flowers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_hearts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_deletions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calls";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."create_targeted_notifications"("req_type" "text", "req_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_targeted_notifications"("req_type" "text", "req_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_targeted_notifications"("req_type" "text", "req_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_comment_likes"("comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_comment_likes"("comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_comment_likes"("comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_call_report_details"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_call_report_details"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_call_report_details"("report_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_conversation_messages"("target_user_id" "uuid", "target_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("target_user_id" "uuid", "target_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversation_messages"("target_user_id" "uuid", "target_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_for_user"("conv_id" "uuid", "viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_for_user"("conv_id" "uuid", "viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_for_user"("conv_id" "uuid", "viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_unread_messages"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_conversations_with_unread"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_conversations_with_unread"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_conversations_with_unread"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_visible_messages"("conv_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_visible_messages"("conv_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_visible_messages"("conv_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_comment_likes"("comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_comment_likes"("comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_comment_likes"("comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_resource_vote"("resource_id" "uuid", "vote_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_resource_vote"("resource_id" "uuid", "vote_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_resource_vote"("resource_id" "uuid", "vote_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_deleted_for_user"("conv_id" "uuid", "user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_deleted_for_user"("conv_id" "uuid", "user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_deleted_for_user"("conv_id" "uuid", "user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conv_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conv_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conv_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_community_on_new_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_community_on_new_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_community_on_new_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_call_started_at"("room_id" "text", "table_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_call_started_at"("room_id" "text", "table_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_call_started_at"("room_id" "text", "table_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_message_for_me"("msg_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_read_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_read_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_read_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_resource_vote_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_resource_vote_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_resource_vote_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."angel_comments" TO "anon";
GRANT ALL ON TABLE "public"."angel_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."angel_comments" TO "service_role";



GRANT ALL ON TABLE "public"."angel_hearts" TO "anon";
GRANT ALL ON TABLE "public"."angel_hearts" TO "authenticated";
GRANT ALL ON TABLE "public"."angel_hearts" TO "service_role";



GRANT ALL ON TABLE "public"."angel_memories" TO "anon";
GRANT ALL ON TABLE "public"."angel_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."angel_memories" TO "service_role";



GRANT ALL ON TABLE "public"."angel_moments" TO "anon";
GRANT ALL ON TABLE "public"."angel_moments" TO "authenticated";
GRANT ALL ON TABLE "public"."angel_moments" TO "service_role";



GRANT ALL ON TABLE "public"."angels" TO "anon";
GRANT ALL ON TABLE "public"."angels" TO "authenticated";
GRANT ALL ON TABLE "public"."angels" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT ALL ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."communities" TO "anon";
GRANT ALL ON TABLE "public"."communities" TO "authenticated";
GRANT ALL ON TABLE "public"."communities" TO "service_role";



GRANT ALL ON TABLE "public"."community_members" TO "anon";
GRANT ALL ON TABLE "public"."community_members" TO "authenticated";
GRANT ALL ON TABLE "public"."community_members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."communities_with_counts" TO "anon";
GRANT ALL ON TABLE "public"."communities_with_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."communities_with_counts" TO "service_role";



GRANT ALL ON TABLE "public"."community_likes" TO "anon";
GRANT ALL ON TABLE "public"."community_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."community_likes" TO "service_role";



GRANT ALL ON TABLE "public"."community_messages" TO "anon";
GRANT ALL ON TABLE "public"."community_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."community_messages" TO "service_role";



GRANT ALL ON TABLE "public"."community_online_counts" TO "anon";
GRANT ALL ON TABLE "public"."community_online_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_online_counts" TO "service_role";



GRANT ALL ON TABLE "public"."community_online_members" TO "anon";
GRANT ALL ON TABLE "public"."community_online_members" TO "authenticated";
GRANT ALL ON TABLE "public"."community_online_members" TO "service_role";



GRANT ALL ON TABLE "public"."community_post_comments" TO "anon";
GRANT ALL ON TABLE "public"."community_post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."community_post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."community_post_comments_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."community_post_comments_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."community_post_comments_with_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."community_post_likes" TO "anon";
GRANT ALL ON TABLE "public"."community_post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."community_post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."community_posts" TO "anon";
GRANT ALL ON TABLE "public"."community_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."community_posts" TO "service_role";



GRANT ALL ON TABLE "public"."community_user_views" TO "anon";
GRANT ALL ON TABLE "public"."community_user_views" TO "authenticated";
GRANT ALL ON TABLE "public"."community_user_views" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."deleted_conversations" TO "anon";
GRANT ALL ON TABLE "public"."deleted_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."deleted_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."event_attendees" TO "anon";
GRANT ALL ON TABLE "public"."event_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."event_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."event_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."event_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_with_attendee_count" TO "anon";
GRANT ALL ON TABLE "public"."events_with_attendee_count" TO "authenticated";
GRANT ALL ON TABLE "public"."events_with_attendee_count" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."help_requests" TO "anon";
GRANT ALL ON TABLE "public"."help_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."help_requests" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."memory_comments" TO "anon";
GRANT ALL ON TABLE "public"."memory_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_comments" TO "service_role";



GRANT ALL ON TABLE "public"."memory_garden_flowers" TO "anon";
GRANT ALL ON TABLE "public"."memory_garden_flowers" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_garden_flowers" TO "service_role";



GRANT ALL ON TABLE "public"."memory_hearts" TO "anon";
GRANT ALL ON TABLE "public"."memory_hearts" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_hearts" TO "service_role";



GRANT ALL ON TABLE "public"."message_deletions" TO "anon";
GRANT ALL ON TABLE "public"."message_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."message_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."message_reads" TO "anon";
GRANT ALL ON TABLE "public"."message_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reads" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."post_comments_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments_with_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profile_post_comments" TO "anon";
GRANT ALL ON TABLE "public"."profile_post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."profile_post_comments_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."profile_post_comments_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_post_comments_with_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quick_connect_requests" TO "anon";
GRANT ALL ON TABLE "public"."quick_connect_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_connect_requests" TO "service_role";



GRANT ALL ON TABLE "public"."quick_group_requests" TO "anon";
GRANT ALL ON TABLE "public"."quick_group_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_group_requests" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."resource_votes" TO "anon";
GRANT ALL ON TABLE "public"."resource_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_votes" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON TABLE "public"."room_participants" TO "anon";
GRANT ALL ON TABLE "public"."room_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."room_participants" TO "service_role";



GRANT ALL ON TABLE "public"."session_participants" TO "anon";
GRANT ALL ON TABLE "public"."session_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."session_participants" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."suggestions" TO "anon";
GRANT ALL ON TABLE "public"."suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."suggestions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."support_requests" TO "anon";
GRANT ALL ON TABLE "public"."support_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."support_requests" TO "service_role";



GRANT ALL ON TABLE "public"."user_presence" TO "anon";
GRANT ALL ON TABLE "public"."user_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."user_presence" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































