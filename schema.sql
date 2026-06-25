--
-- PostgreSQL database dump
--

\restrict sY3ihOzvZfigNrisEpSpmsl8pO5Jh0xFnI2TCftjUcoZwtJx6JOrj8Bs3wZPtFB

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'new_order',
    'order_placed',
    'order_processing',
    'order_shipped',
    'order_delivered',
    'order_cancelled',
    'low_stock',
    'seller_applied',
    'seller_approved',
    'seller_rejected',
    'product_submitted',
    'product_approved',
    'product_rejected',
    'new_follower',
    'store_new_product',
    'new_seller_review',
    'new_message'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role AS ENUM (
    'customer',
    'seller',
    'admin'
);


ALTER TYPE public.role OWNER TO postgres;

--
-- Name: normalize_ar(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_ar(input text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
        SELECT
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(input),
                  '[\u064B-\u065F\u0670\u0640]', '', 'g'
                ),
                '[\u0622\u0623\u0625\u0671]', '\u0627', 'g'
              ),
              '\u0649', '\u064A', 'g'
            ),
            '\u0629', '\u0647', 'g'
          )
      $$;


ALTER FUNCTION public.normalize_ar(input text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_log (
    id integer NOT NULL,
    actor_id integer NOT NULL,
    actor_name text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_audit_log OWNER TO postgres;

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_audit_log_id_seq OWNER TO postgres;

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    variant_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cart_items OWNER TO postgres;

--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cart_items_id_seq OWNER TO postgres;

--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    seller_id integer NOT NULL,
    product_id integer,
    status text DEFAULT 'active'::text NOT NULL,
    last_message_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender_id integer NOT NULL,
    body text NOT NULL,
    read_at timestamp without time zone,
    flagged boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    order_id integer,
    priority text DEFAULT 'normal'::text NOT NULL,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    seller_id integer NOT NULL,
    variant_id integer,
    variant_details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    from_status text,
    to_status text NOT NULL,
    changed_by integer,
    changed_by_role text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_status_history OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_status_history_id_seq OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    total numeric(10,2) NOT NULL,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    shipping_address text NOT NULL,
    customer_phone text,
    city text,
    delivery_notes text,
    notes text,
    estimated_delivery text,
    shipping_company text,
    tracking_number text,
    shipped_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: product_variant_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variant_groups (
    id integer NOT NULL,
    product_id integer NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.product_variant_groups OWNER TO postgres;

--
-- Name: product_variant_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variant_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variant_groups_id_seq OWNER TO postgres;

--
-- Name: product_variant_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variant_groups_id_seq OWNED BY public.product_variant_groups.id;


--
-- Name: product_variant_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variant_options (
    id integer NOT NULL,
    group_id integer NOT NULL,
    value text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.product_variant_options OWNER TO postgres;

--
-- Name: product_variant_options_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variant_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variant_options_id_seq OWNER TO postgres;

--
-- Name: product_variant_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variant_options_id_seq OWNED BY public.product_variant_options.id;


--
-- Name: product_variant_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variant_values (
    variant_id integer NOT NULL,
    option_id integer NOT NULL
);


ALTER TABLE public.product_variant_values OWNER TO postgres;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id integer NOT NULL,
    product_id integer NOT NULL,
    sku text,
    price_adjustment numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    image_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_variants_id_seq OWNER TO postgres;

--
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    discount_percent numeric(5,2),
    category text NOT NULL,
    subcategory text,
    stock integer DEFAULT 0 NOT NULL,
    image_url text,
    image_urls text[],
    featured boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name_ar text,
    search_tokens text,
    view_count integer DEFAULT 0 NOT NULL,
    sales_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.push_subscriptions OWNER TO postgres;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.push_subscriptions_id_seq OWNER TO postgres;

--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    product_id integer NOT NULL,
    user_id integer NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reviews_id_seq OWNER TO postgres;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: seller_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    store_name text NOT NULL,
    store_name_ar text,
    phone text NOT NULL,
    contact_phone text,
    contact_email text,
    city text NOT NULL,
    address text,
    category text NOT NULL,
    categories text[],
    description text NOT NULL,
    description_ar text,
    social_links text,
    website text,
    accent_color text,
    business_info text,
    id_image_url text,
    store_logo text,
    store_banner text,
    store_slug text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_notes text,
    rejection_reason text,
    reviewed_at timestamp without time zone,
    reviewed_by_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_applications OWNER TO postgres;

--
-- Name: seller_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seller_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seller_applications_id_seq OWNER TO postgres;

--
-- Name: seller_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seller_applications_id_seq OWNED BY public.seller_applications.id;


--
-- Name: seller_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_reviews (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    customer_id integer NOT NULL,
    order_id integer,
    communication_rating integer NOT NULL,
    shipping_rating integer NOT NULL,
    professionalism_rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_reviews OWNER TO postgres;

--
-- Name: seller_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.seller_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.seller_reviews_id_seq OWNER TO postgres;

--
-- Name: seller_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.seller_reviews_id_seq OWNED BY public.seller_reviews.id;


--
-- Name: store_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_follows (
    id integer NOT NULL,
    follower_id integer NOT NULL,
    seller_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.store_follows OWNER TO postgres;

--
-- Name: store_follows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.store_follows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.store_follows_id_seq OWNER TO postgres;

--
-- Name: store_follows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.store_follows_id_seq OWNED BY public.store_follows.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text,
    phone text,
    password_hash text NOT NULL,
    name text NOT NULL,
    role public.role DEFAULT 'customer'::public.role NOT NULL,
    seller_status text,
    trust_level text,
    is_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp without time zone,
    verification_method text,
    otp_hash text,
    otp_expires_at timestamp without time zone,
    otp_attempts integer DEFAULT 0 NOT NULL,
    otp_locked_until timestamp without time zone,
    otp_request_count integer DEFAULT 0 NOT NULL,
    otp_request_window_start timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    account_status text DEFAULT 'active'::text NOT NULL,
    suspended_reason text,
    suspended_by integer,
    suspended_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: verification_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_audit_log (
    id integer NOT NULL,
    user_id integer NOT NULL,
    event text NOT NULL,
    method text,
    ip_address text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.verification_audit_log OWNER TO postgres;

--
-- Name: verification_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.verification_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.verification_audit_log_id_seq OWNER TO postgres;

--
-- Name: verification_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.verification_audit_log_id_seq OWNED BY public.verification_audit_log.id;


--
-- Name: admin_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: product_variant_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_groups ALTER COLUMN id SET DEFAULT nextval('public.product_variant_groups_id_seq'::regclass);


--
-- Name: product_variant_options id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_options ALTER COLUMN id SET DEFAULT nextval('public.product_variant_options_id_seq'::regclass);


--
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: seller_applications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_applications ALTER COLUMN id SET DEFAULT nextval('public.seller_applications_id_seq'::regclass);


--
-- Name: seller_reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews ALTER COLUMN id SET DEFAULT nextval('public.seller_reviews_id_seq'::regclass);


--
-- Name: store_follows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_follows ALTER COLUMN id SET DEFAULT nextval('public.store_follows_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verification_audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_audit_log ALTER COLUMN id SET DEFAULT nextval('public.verification_audit_log_id_seq'::regclass);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: product_variant_groups product_variant_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_groups
    ADD CONSTRAINT product_variant_groups_pkey PRIMARY KEY (id);


--
-- Name: product_variant_options product_variant_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_options
    ADD CONSTRAINT product_variant_options_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_product_user_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_user_unique UNIQUE (product_id, user_id);


--
-- Name: seller_applications seller_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_pkey PRIMARY KEY (id);


--
-- Name: seller_reviews seller_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_pkey PRIMARY KEY (id);


--
-- Name: seller_reviews seller_reviews_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_unique UNIQUE (seller_id, customer_id);


--
-- Name: store_follows store_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_follows
    ADD CONSTRAINT store_follows_pkey PRIMARY KEY (id);


--
-- Name: store_follows store_follows_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_follows
    ADD CONSTRAINT store_follows_unique UNIQUE (follower_id, seller_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_audit_log verification_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_audit_log
    ADD CONSTRAINT verification_audit_log_pkey PRIMARY KEY (id);


--
-- Name: idx_cart_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cart_items_product_id ON public.cart_items USING btree (product_id);


--
-- Name: idx_cart_items_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cart_items_user_id ON public.cart_items USING btree (user_id);


--
-- Name: idx_conversations_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_customer_id ON public.conversations USING btree (customer_id);


--
-- Name: idx_conversations_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_last_message ON public.conversations USING btree (seller_id, last_message_at);


--
-- Name: idx_conversations_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_seller_id ON public.conversations USING btree (seller_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_seller_id ON public.order_items USING btree (seller_id);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_reviews_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_product_id ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (user_id);


--
-- Name: idx_seller_reviews_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_reviews_customer_id ON public.seller_reviews USING btree (customer_id);


--
-- Name: idx_seller_reviews_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_reviews_seller_id ON public.seller_reviews USING btree (seller_id);


--
-- Name: idx_store_follows_follower_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_follows_follower_id ON public.store_follows USING btree (follower_id);


--
-- Name: idx_store_follows_seller_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_store_follows_seller_id ON public.store_follows USING btree (seller_id);


--
-- Name: idx_users_account_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_account_status ON public.users USING btree (account_status);


--
-- Name: products_cat_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_cat_trgm ON public.products USING gin (category public.gin_trgm_ops);


--
-- Name: products_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_idx ON public.products USING btree (category);


--
-- Name: products_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_created_at_idx ON public.products USING btree (created_at);


--
-- Name: products_featured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_featured_idx ON public.products USING btree (featured);


--
-- Name: products_namar_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_namar_trgm ON public.products USING gin (name_ar public.gin_trgm_ops);


--
-- Name: products_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_trgm ON public.products USING gin (name public.gin_trgm_ops);


--
-- Name: products_seller_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_seller_id_idx ON public.products USING btree (seller_id);


--
-- Name: products_stock_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_stock_idx ON public.products USING btree (stock);


--
-- Name: products_tokens_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_tokens_trgm ON public.products USING gin (search_tokens public.gin_trgm_ops);


--
-- Name: pv_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pv_product_id_idx ON public.product_variants USING btree (product_id);


--
-- Name: pvg_product_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX pvg_product_id_idx ON public.product_variant_groups USING btree (product_id);


--
-- Name: cart_items cart_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: cart_items cart_items_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: conversations conversations_customer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_status_history order_status_history_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_customer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id);


--
-- Name: product_variant_groups product_variant_groups_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_groups
    ADD CONSTRAINT product_variant_groups_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_variant_options product_variant_options_group_id_product_variant_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_options
    ADD CONSTRAINT product_variant_options_group_id_product_variant_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.product_variant_groups(id) ON DELETE CASCADE;


--
-- Name: product_variant_values product_variant_values_option_id_product_variant_options_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_values
    ADD CONSTRAINT product_variant_values_option_id_product_variant_options_id_fk FOREIGN KEY (option_id) REFERENCES public.product_variant_options(id) ON DELETE CASCADE;


--
-- Name: product_variant_values product_variant_values_variant_id_product_variants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variant_values
    ADD CONSTRAINT product_variant_values_variant_id_product_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_applications seller_applications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_reviews seller_reviews_customer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_customer_id_users_id_fk FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_reviews seller_reviews_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: seller_reviews seller_reviews_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_reviews
    ADD CONSTRAINT seller_reviews_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: store_follows store_follows_follower_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_follows
    ADD CONSTRAINT store_follows_follower_id_users_id_fk FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: store_follows store_follows_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_follows
    ADD CONSTRAINT store_follows_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: delivery_mission_status; Type: TYPE; Schema: public; Owner: postgres
--

DO $$ BEGIN
  CREATE TYPE public.delivery_mission_status AS ENUM (
    'PENDING','ASSIGNED','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','FAILED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


--
-- Name: delivery_size; Type: TYPE; Schema: public; Owner: postgres
--

DO $$ BEGIN
  CREATE TYPE public.delivery_size AS ENUM ('SMALL','MEDIUM','LARGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


--
-- Name: delivery_missions; Type: TABLE; Schema: public; Owner: postgres
-- NOTE: courier_id FK to couriers table is added by run-migrations.ts (couriers table created there)
--

CREATE TABLE IF NOT EXISTS public.delivery_missions (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER      NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id        INTEGER      NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  customer_id      INTEGER      NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  courier_id       INTEGER,
  status           public.delivery_mission_status NOT NULL DEFAULT 'PENDING',
  delivery_fee     NUMERIC(10,2),
  delivery_size    public.delivery_size NOT NULL DEFAULT 'MEDIUM',
  pickup_address   TEXT         NOT NULL,
  dropoff_address  TEXT         NOT NULL,
  pickup_lat       NUMERIC(10,7),
  pickup_lng       NUMERIC(10,7),
  dropoff_lat      NUMERIC(10,7),
  dropoff_lng      NUMERIC(10,7),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_delivery_missions_order_id    ON public.delivery_missions(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_seller_id   ON public.delivery_missions(seller_id);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_customer_id ON public.delivery_missions(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_status      ON public.delivery_missions(status);
CREATE INDEX IF NOT EXISTS idx_delivery_missions_created_at  ON public.delivery_missions(created_at);


--
-- PostgreSQL database dump complete
--

\unrestrict sY3ihOzvZfigNrisEpSpmsl8pO5Jh0xFnI2TCftjUcoZwtJx6JOrj8Bs3wZPtFB

