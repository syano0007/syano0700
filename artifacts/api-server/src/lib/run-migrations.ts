import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Additive DB migrations run once at server startup.
 * All statements use IF EXISTS / IF NOT EXISTS guards so they are:
 *  - Safe to re-run on existing deployments (idempotent)
 *  - Safe on a fresh database where tables may not exist yet (will
 *    be created by `drizzle-kit push`; these just add extra columns)
 *
 * NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
 * Those statements are run as individual client.query() calls before the
 * main migration block.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // ── Extend role enum with 'courier' ────────────────────────────────────────
    try {
      await client.query(`ALTER TYPE role ADD VALUE IF NOT EXISTS 'courier'`);
    } catch {
      // May already exist
    }

    // ── Extend order_status enum (each must be its own non-transaction call) ──
    const newStatusValues = [
      "confirmed",
      "preparing",
      "ready_for_pickup",
      "courier_assigned",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivery_failed",
      "returned",
    ];
    for (const val of newStatusValues) {
      try {
        await client.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${val}'`);
      } catch {
        // Value may already exist in older PG versions that don't support IF NOT EXISTS
      }
    }

    // ── Extend notification_type enum ─────────────────────────────────────────
    // schema.sql only has 17 of 31 values — these 14 were added after initial
    // schema generation and must be present for courier/delivery/trust features.
    // Each ALTER TYPE must be its own non-transaction call.
    const newNotifValues = [
      "order_confirmed",
      "order_preparing",
      "order_ready",
      "order_courier_assigned",
      "order_picked_up",
      "order_out_for_delivery",
      "order_delivery_failed",
      "order_returned",
      "order_cancelled_by_customer",
      "order_refunded",
      "new_user",
      "courier_applied",
      "courier_approved",
      "courier_rejected",
      "new_seller_review",
      "seller_review_reply",
      "dispatch_alert",
    ];
    for (const val of newNotifValues) {
      try {
        await client.query(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '${val}'`);
      } catch {
        // May already exist
      }
    }

    // ── Extend delivery_mission_status enum (V3.3 states) ─────────────────────
    for (const val of ["SEARCHING", "NO_COURIER_FOUND"]) {
      try {
        await client.query(`ALTER TYPE delivery_mission_status ADD VALUE IF NOT EXISTS '${val}'`);
      } catch {
        // May already exist
      }
    }

    // ── Main migration block (idempotent DDL) ──────────────────────────────────
    await client.query(`
      -- Order tracking fields (added in order-workflow redesign)
      -- Wrapped in DO block so they only run when the table exists
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'orders'
        ) THEN
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_company TEXT;
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number  TEXT;
        END IF;
      END $$;

      -- Permanent audit log for every order status transition
      CREATE TABLE IF NOT EXISTS order_status_history (
        id             SERIAL PRIMARY KEY,
        order_id       INTEGER      NOT NULL,
        from_status    TEXT,
        to_status      TEXT         NOT NULL,
        changed_by     INTEGER,
        changed_by_role TEXT,
        notes          TEXT,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
        ON order_status_history(order_id);

      -- Variant support columns
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items'
        ) THEN
          ALTER TABLE cart_items  ADD COLUMN IF NOT EXISTS variant_id      INTEGER;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items'
        ) THEN
          ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id      INTEGER;
          ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_details TEXT;
        END IF;
        -- product_variants extended pricing/fulfillment columns
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'product_variants'
        ) THEN
          ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price           NUMERIC(10,2);
          ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2);
          ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS barcode         TEXT;
          ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS weight_grams    INTEGER;
          ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS dimensions      TEXT;
        END IF;
      END $$;

      -- Auto-featured products: track delivered sales count per product
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'products'
        ) THEN
          ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER NOT NULL DEFAULT 0;
        END IF;
      END $$;

      -- Account suspension system + password reset OTP
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
        ) THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_hash TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMPTZ;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_attempts INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_locked_until TIMESTAMPTZ;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

      -- Variant images table (per-variant media with optional option-value link)
      CREATE TABLE IF NOT EXISTS variant_images (
        id              SERIAL PRIMARY KEY,
        variant_id      INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        url             TEXT NOT NULL,
        position        INTEGER NOT NULL DEFAULT 0,
        option_value_id INTEGER REFERENCES product_variant_options(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS vi_variant_id_idx      ON variant_images(variant_id);
      CREATE INDEX IF NOT EXISTS vi_option_value_id_idx ON variant_images(option_value_id);

      -- ── Delivery system columns ────────────────────────────────────────────────
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'orders'
        ) THEN
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee        NUMERIC(10,2);
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_id             INTEGER;
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
          ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by        TEXT;
        END IF;
      END $$;

      -- Delivery zones (Syrian governorate taxonomy)
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id         SERIAL PRIMARY KEY,
        name_en    TEXT        NOT NULL,
        name_ar    TEXT        NOT NULL,
        fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
        active     BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Seed Syrian governorates if none exist (idempotent)
      INSERT INTO delivery_zones (id, name_en, name_ar, fee, active) OVERRIDING SYSTEM VALUE
      SELECT id, name_en, name_ar, fee, active FROM (VALUES
        (1,   'Damascus',            'دمشق',                              1.50, TRUE),
        (2,   'Rural Damascus',      'ريف دمشق',                          2.00, TRUE),
        (3,   'Aleppo',              'حلب',                               1.50, TRUE),
        (4,   'Homs',                'حمص',                               2.00, TRUE),
        (5,   'Hama',                'حماة',                              2.00, TRUE),
        (6,   'Latakia',             'اللاذقية',                          2.00, TRUE),
        (7,   'Tartus',              'طرطوس',                             2.00, TRUE),
        (8,   'Idlib',               'إدلب',                              2.50, TRUE),
        (9,   'Deir ez-Zor',         'دير الزور',                         3.00, TRUE),
        (10,  'Raqqa',               'الرقة',                             3.00, TRUE),
        (11,  'Al-Hasakah',          'الحسكة',                            3.00, TRUE),
        (12,  'Daraa',               'درعا',                              2.00, TRUE),
        (13,  'As-Suwayda',          'السويداء',                          2.50, TRUE),
        (14,  'Quneitra',            'القنيطرة',                          2.50, TRUE),
        (999, 'All Syrian Provinces','كافة المحافظات والمناطق السورية',   2.50, TRUE)
      ) AS v(id, name_en, name_ar, fee, active)
      WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE id = v.id);

      -- Ensure sequence is set past 999 so new admin-created zones start at 1000+
      SELECT setval('delivery_zones_id_seq', GREATEST(1000, (SELECT MAX(id) FROM delivery_zones) + 1), false);

      -- Courier profiles table
      CREATE TABLE IF NOT EXISTS couriers (
        id                    SERIAL PRIMARY KEY,
        user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status                TEXT NOT NULL DEFAULT 'pending',
        active                BOOLEAN NOT NULL DEFAULT FALSE,
        city                  TEXT NOT NULL DEFAULT 'Aleppo',
        district              TEXT,
        phone                 TEXT NOT NULL,
        vehicle_type          TEXT NOT NULL DEFAULT 'motorcycle',
        rating                NUMERIC(3,2),
        completed_deliveries  INTEGER NOT NULL DEFAULT 0,
        notes                 TEXT,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON couriers(user_id);
      CREATE INDEX IF NOT EXISTS idx_couriers_status  ON couriers(status);

      -- Courier assignments (one per order)
      CREATE TABLE IF NOT EXISTS courier_assignments (
        id           SERIAL PRIMARY KEY,
        order_id     INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        courier_id   INTEGER NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,
        status       TEXT NOT NULL DEFAULT 'assigned',
        assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accepted_at  TIMESTAMPTZ,
        picked_up_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        notes        TEXT,
        admin_id     INTEGER REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_courier_assignments_order_id   ON courier_assignments(order_id);
      CREATE INDEX IF NOT EXISTS idx_courier_assignments_courier_id ON courier_assignments(courier_id);
      CREATE INDEX IF NOT EXISTS idx_courier_assignments_status     ON courier_assignments(status);

      -- Courier earnings ledger
      CREATE TABLE IF NOT EXISTS courier_wallet_transactions (
        id          SERIAL PRIMARY KEY,
        courier_id  INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
        order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        amount      NUMERIC(10,2) NOT NULL,
        type        TEXT NOT NULL,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_courier_wallet_courier_id ON courier_wallet_transactions(courier_id);

      -- ── Store Settings V2 columns on seller_applications ─────────────────────
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_applications'
        ) THEN
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS shipping_policy   TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS return_policy     TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS warranty_policy   TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS privacy_policy    TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS meta_title        TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS meta_description  TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS seo_image_url     TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS whatsapp          TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS telegram          TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS facebook          TEXT;
          ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS instagram         TEXT;
        END IF;
      END $$;

      -- ── Trust & verification columns on users ──────────────────────────────────
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
        ) THEN
          ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_level     TEXT DEFAULT 'none';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_method    TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by            INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score            INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_level            TEXT DEFAULT 'new';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score_updated_at TIMESTAMPTZ;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_users_verification_level ON users(verification_level);
      CREATE INDEX IF NOT EXISTS idx_users_trust_score        ON users(trust_score);

      -- ── Seller review reply columns ───────────────────────────────────────────
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_reviews'
        ) THEN
          ALTER TABLE seller_reviews ADD COLUMN IF NOT EXISTS seller_reply            TEXT;
          ALTER TABLE seller_reviews ADD COLUMN IF NOT EXISTS seller_reply_at         TIMESTAMP;
          ALTER TABLE seller_reviews ADD COLUMN IF NOT EXISTS seller_reply_updated_at TIMESTAMP;
        END IF;
      END $$;

      -- ── Seller verification audit log (admin approval/rejection history) ────────
      CREATE TABLE IF NOT EXISTS seller_verification_log (
        id          SERIAL PRIMARY KEY,
        seller_id   INTEGER NOT NULL,
        admin_id    INTEGER NOT NULL,
        action      TEXT NOT NULL,
        from_level  TEXT,
        to_level    TEXT,
        method      TEXT,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_seller_verif_log_seller_id ON seller_verification_log(seller_id);
      CREATE INDEX IF NOT EXISTS idx_seller_verif_log_admin_id  ON seller_verification_log(admin_id);

      -- ── Hero Banner System ─────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS hero_banners (
        id                      SERIAL PRIMARY KEY,
        title_ar                TEXT NOT NULL,
        title_en                TEXT NOT NULL,
        subtitle_ar             TEXT,
        subtitle_en             TEXT,
        description_ar          TEXT,
        description_en          TEXT,
        desktop_image           TEXT NOT NULL,
        mobile_image            TEXT,
        cta_label_ar            TEXT,
        cta_label_en            TEXT,
        cta_url                 TEXT,
        cta_label_ar_secondary  TEXT,
        cta_label_en_secondary  TEXT,
        cta_url_secondary       TEXT,
        background_color        TEXT DEFAULT '#0f172a',
        text_color              TEXT DEFAULT '#ffffff',
        active                  BOOLEAN NOT NULL DEFAULT TRUE,
        start_date              TIMESTAMPTZ,
        end_date                TIMESTAMPTZ,
        sort_order              INTEGER NOT NULL DEFAULT 0,
        impressions             INTEGER NOT NULL DEFAULT 0,
        clicks                  INTEGER NOT NULL DEFAULT 0,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS hero_banners_active_idx     ON hero_banners(active);
      CREATE INDEX IF NOT EXISTS hero_banners_sort_order_idx ON hero_banners(sort_order);
      ALTER TABLE hero_banners ADD COLUMN IF NOT EXISTS slot VARCHAR(20) NOT NULL DEFAULT 'main';
      CREATE INDEX IF NOT EXISTS hero_banners_slot_idx ON hero_banners(slot);

      -- ── Wishlists ─────────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS wishlists (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        product_id  INTEGER NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);

      -- ── User Settings Preferences ────────────────────────────────────────────
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_theme    VARCHAR(10) DEFAULT 'dark';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5)  DEFAULT 'ar';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3)  DEFAULT 'SYP';

      -- ── Messaging V2 — additive schema extensions ────────────────────────────
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type     VARCHAR(30) NOT NULL DEFAULT 'customer_seller';
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS muted    BOOLEAN     NOT NULL DEFAULT false;
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS order_id INTEGER;

      ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_id INTEGER;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS message_attachments (
        id              SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        filename        TEXT    NOT NULL,
        mime_type       TEXT    NOT NULL,
        size            INTEGER NOT NULL,
        data            TEXT    NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_msg_attachments_conv_id ON message_attachments(conversation_id);

      -- ── Search Synonyms Table ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS search_synonyms (
        id               SERIAL PRIMARY KEY,
        term             TEXT    NOT NULL,
        synonym          TEXT    NOT NULL,
        language         TEXT    NOT NULL DEFAULT 'ar',
        is_bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_search_synonyms_term_lang    ON search_synonyms(term,    language);
      CREATE INDEX IF NOT EXISTS idx_search_synonyms_synonym_lang ON search_synonyms(synonym, language);

      -- Seed synonym pairs — ON CONFLICT DO NOTHING makes this idempotent
      -- Arabic mobile/phone
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('موبايل','هاتف','ar'),('موبايل','جوال','ar'),('موبايل','تليفون','ar'),('موبايل','بيجر','ar'),
        ('هاتف','جوال','ar'),('هاتف','تليفون','ar')
      ON CONFLICT DO NOTHING;
      -- Arabic clothing
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('شنطة','حقيبة','ar'),('شنطة','كيس','ar'),
        ('بنطلون','بنطال','ar'),('بنطلون','سروال','ar'),
        ('فستان','ثوب','ar'),
        ('جاكيت','جاكتة','ar'),('جاكيت','معطف','ar'),
        ('تيشيرت','قميص','ar'),
        ('حذاء','كندرة','ar'),('حذاء','جزمة','ar')
      ON CONFLICT DO NOTHING;
      -- Arabic electronics
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('تلفزيون','تلفاز','ar'),('تلفزيون','شاشة','ar'),
        ('كمبيوتر','حاسوب','ar'),('كمبيوتر','جهاز','ar'),
        ('لابتوب','حاسوب محمول','ar'),('لابتوب','كمبيوتر محمول','ar'),
        ('سماعة','سماعات','ar'),
        ('شاحن','شارجر','ar')
      ON CONFLICT DO NOTHING;
      -- Arabic home
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('ثلاجة','برادة','ar'),
        ('غسالة','وشاشة','ar'),
        ('مكيف','ايركون','ar'),('مكيف','كيف','ar'),
        ('طباخ','فرن','ar'),('طباخ','بوتاجاز','ar')
      ON CONFLICT DO NOTHING;
      -- English
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('phone','mobile','en'),('phone','smartphone','en'),('phone','handset','en'),
        ('laptop','notebook','en'),('laptop','computer','en'),
        ('tv','television','en'),('tv','screen','en'),
        ('bag','handbag','en'),('bag','purse','en'),
        ('shoes','sneakers','en'),('shoes','footwear','en')
      ON CONFLICT DO NOTHING;
      -- Cross-language
      INSERT INTO search_synonyms (term, synonym, language) VALUES
        ('موبايل','mobile','both'),
        ('لابتوب','laptop','both'),
        ('تيشيرت','t-shirt','both'),
        ('جاكيت','jacket','both'),
        ('شاحن','charger','both'),
        ('سماعة','headphones','both'),
        ('تلفزيون','tv','both')
      ON CONFLICT DO NOTHING;
    `);

    // ── Phase 6: Search Retrieval improvements ─────────────────────────────────
    // Ensure query_logs exists before altering (search-startup creates it, but may not have run yet)
    await client.query(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id           SERIAL PRIMARY KEY,
        query        TEXT NOT NULL,
        lang         VARCHAR(2) DEFAULT 'ar',
        result_count INTEGER,
        clicked      BOOLEAN DEFAULT false,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS fallback_level INTEGER DEFAULT NULL;
    `);

    // Ensure search columns exist before the FTS trigger/backfill (search-startup adds these
    // in runSearchStartup(), but that runs AFTER runMigrations() — guard for fresh DB)
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ar       text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS search_tokens text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS fts_vector    tsvector;
    `);

    // FTS trigger upgrade: description weight D → C, remove 240-char truncation
    await client.query(`
      CREATE OR REPLACE FUNCTION products_fts_rebuild() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        NEW.fts_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.name, '')),          'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.name_ar, '')),       'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.category, '')),      'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.subcategory, '')),   'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.search_tokens, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(NEW.description, '')),   'C');
        RETURN NEW;
      END;
      $fn$;
    `);

    // Backfill products whose fts_vector is NULL (safety net)
    await client.query(`
      UPDATE products
      SET fts_vector =
        setweight(to_tsvector('simple', coalesce(name, '')),          'A') ||
        setweight(to_tsvector('simple', coalesce(name_ar, '')),       'A') ||
        setweight(to_tsvector('simple', coalesce(category, '')),      'B') ||
        setweight(to_tsvector('simple', coalesce(subcategory, '')),   'B') ||
        setweight(to_tsvector('simple', coalesce(search_tokens, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(description, '')),   'C')
      WHERE fts_vector IS NULL;
    `);

    // ── Phase 7: Semantic Search — pgvector extension + embedding columns ──────
    // pgvector is optional; if unavailable we catch the error and continue with FTS-only.
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await client.query(`
        ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding       vector(384);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding_model TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS embedded_at     TIMESTAMPTZ;
      `);
      // IVFFlat index — only create if enough rows exist to make it useful
      await client.query(`
        DO $$
        BEGIN
          IF (SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL) >= 50 THEN
            CREATE INDEX IF NOT EXISTS idx_products_embedding_ivfflat
              ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
          END IF;
        END $$;
      `);
      logger.info("Semantic search: pgvector extension + embedding columns ready");
    } catch (pgvectorErr) {
      logger.warn(
        { err: String(pgvectorErr) },
        "pgvector not available — semantic search disabled (FTS-only mode active)",
      );
    }

    // ── Phase 13: AI Support — support_tickets table ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id   INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
        status            TEXT    NOT NULL DEFAULT 'open',
        category          TEXT    NOT NULL DEFAULT 'general',
        priority          TEXT    NOT NULL DEFAULT 'normal',
        subject           TEXT,
        notes             TEXT,
        assigned_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at       TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id    ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status     ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_priority   ON support_tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
    `);

    // ── Phase 13: preferred_language column on users (safe additive) ──────────
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'ar';
    `);

    // ── Phase 13 V2: source column on support_tickets ────────────────────────
    await client.query(`
      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'page';
    `);

    // ── V3.3: Mission Assignment Foundation columns on delivery_missions ──────
    await client.query(`
      ALTER TABLE delivery_missions ADD COLUMN IF NOT EXISTS assignment_started_at  TIMESTAMPTZ;
      ALTER TABLE delivery_missions ADD COLUMN IF NOT EXISTS assignment_expires_at  TIMESTAMPTZ;
      ALTER TABLE delivery_missions ADD COLUMN IF NOT EXISTS assignment_round       INTEGER DEFAULT 0;
      ALTER TABLE delivery_missions ADD COLUMN IF NOT EXISTS assignment_status      TEXT    DEFAULT 'PENDING';
      CREATE INDEX IF NOT EXISTS idx_delivery_missions_assignment_status ON delivery_missions(assignment_status);
    `);

    // ── V3.3: mission_offer_status enum (create idempotently via DO block) ────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE mission_offer_status AS ENUM (
          'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── V3.3: mission_offers table ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mission_offers (
        id            SERIAL PRIMARY KEY,
        mission_id    INTEGER                NOT NULL REFERENCES delivery_missions(id) ON DELETE CASCADE,
        courier_id    INTEGER                NOT NULL REFERENCES couriers(id)          ON DELETE CASCADE,
        status        mission_offer_status   NOT NULL DEFAULT 'OFFERED',
        round         INTEGER                NOT NULL DEFAULT 1,
        offered_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
        expires_at    TIMESTAMPTZ            NOT NULL,
        responded_at  TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_mission_offers_mission_id  ON mission_offers(mission_id);
      CREATE INDEX IF NOT EXISTS idx_mission_offers_courier_id  ON mission_offers(courier_id);
      CREATE INDEX IF NOT EXISTS idx_mission_offers_status      ON mission_offers(status);
      CREATE INDEX IF NOT EXISTS idx_mission_offers_expires_at  ON mission_offers(expires_at);
    `);

    // ── V3.2: courier availability columns ────────────────────────────────────
    await client.query(`
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'OFFLINE';
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS is_accepting_deliveries BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS last_availability_change_at TIMESTAMPTZ;
    `);

    // ── V3.3: courier lat/lng columns (for Haversine nearest-courier sorting) ──
    await client.query(`
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,7);
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,7);
      CREATE INDEX IF NOT EXISTS idx_couriers_location ON couriers(current_lat, current_lng);
    `);

    // ── V3.3: dispatch_alerts table ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_alerts (
        id             SERIAL PRIMARY KEY,
        mission_id     INTEGER      NOT NULL REFERENCES delivery_missions(id) ON DELETE CASCADE,
        type           TEXT         NOT NULL DEFAULT 'NO_COURIER_FOUND',
        message        TEXT         NOT NULL,
        resolved_at    TIMESTAMPTZ,
        resolved_by_id INTEGER      REFERENCES users(id),
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_mission_id   ON dispatch_alerts(mission_id);
      CREATE INDEX IF NOT EXISTS idx_dispatch_alerts_resolved_at  ON dispatch_alerts(resolved_at);
    `);

    // ── V3.3 A3: Extended GPS telemetry columns on couriers ──────────────────
    await client.query(`
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_heading  NUMERIC(6,2);
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_speed    NUMERIC(8,3);
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS current_accuracy NUMERIC(8,3);
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS last_location_update_at TIMESTAMPTZ;
      ALTER TABLE couriers ADD COLUMN IF NOT EXISTS location_source  TEXT;
      CREATE INDEX IF NOT EXISTS idx_couriers_last_location_update ON couriers(last_location_update_at);
    `);

    // ── V3.3 A4: Real-Time Tracking Pipeline ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id              SERIAL PRIMARY KEY,
        mission_id      INTEGER NOT NULL UNIQUE REFERENCES delivery_missions(id) ON DELETE CASCADE,
        courier_id      INTEGER NOT NULL REFERENCES couriers(id),
        order_id        INTEGER NOT NULL REFERENCES orders(id),
        seller_id       INTEGER NOT NULL REFERENCES users(id),
        customer_id     INTEGER NOT NULL REFERENCES users(id),
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        last_position_at TIMESTAMPTZ,
        end_reason      TEXT,
        position_count  INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_tracking_sessions_mission  ON tracking_sessions(mission_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_sessions_courier  ON tracking_sessions(courier_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_sessions_active   ON tracking_sessions(is_active);

      CREATE TABLE IF NOT EXISTS tracking_positions (
        id          BIGSERIAL PRIMARY KEY,
        session_id  INTEGER NOT NULL REFERENCES tracking_sessions(id) ON DELETE CASCADE,
        mission_id  INTEGER NOT NULL,
        courier_id  INTEGER NOT NULL,
        lat         NUMERIC(10,7) NOT NULL,
        lng         NUMERIC(10,7) NOT NULL,
        heading     NUMERIC(6,2),
        speed       NUMERIC(6,2),
        accuracy    NUMERIC(8,2),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tracking_positions_mission_time ON tracking_positions(mission_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_tracking_positions_session       ON tracking_positions(session_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_positions_courier       ON tracking_positions(courier_id);

      CREATE TABLE IF NOT EXISTS tracking_events (
        id          BIGSERIAL PRIMARY KEY,
        mission_id  INTEGER NOT NULL,
        session_id  INTEGER,
        courier_id  INTEGER,
        event_type  TEXT NOT NULL,
        payload     JSONB,
        actor_id    INTEGER,
        actor_role  TEXT,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tracking_events_mission ON tracking_events(mission_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_events_type    ON tracking_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_tracking_events_time    ON tracking_events(occurred_at);
    `);

    // ── V3.3 A9: Courier Wallet + Payout System ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS courier_wallets (
        id                SERIAL PRIMARY KEY,
        courier_id        INTEGER NOT NULL UNIQUE REFERENCES couriers(id) ON DELETE CASCADE,
        available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        pending_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
        lifetime_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
        lifetime_payouts  NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_courier_wallets_courier_id ON courier_wallets(courier_id);

      CREATE TABLE IF NOT EXISTS courier_payout_requests (
        id               SERIAL PRIMARY KEY,
        courier_id       INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
        amount           NUMERIC(12,2) NOT NULL,
        status           TEXT NOT NULL DEFAULT 'PENDING',
        rejection_reason TEXT,
        approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_at      TIMESTAMPTZ,
        paid_at          TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payout_requests_courier_id ON courier_payout_requests(courier_id);
      CREATE INDEX IF NOT EXISTS idx_payout_requests_status     ON courier_payout_requests(status);

      -- Extend courier_wallet_transactions with audit columns
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'courier_wallet_transactions') THEN
          ALTER TABLE courier_wallet_transactions ADD COLUMN IF NOT EXISTS balance_after  NUMERIC(12,2);
          ALTER TABLE courier_wallet_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;
          ALTER TABLE courier_wallet_transactions ADD COLUMN IF NOT EXISTS description    TEXT;
        END IF;
      END $$;

      -- Facebook auth support
      ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS users_facebook_id_unique
        ON users(facebook_id) WHERE facebook_id IS NOT NULL;
    `);

    logger.info("Migrations complete: delivery system, courier enums, order delivery, user settings, messaging-v2 columns, AI support tickets, V3.3 mission assignment engine (mission_offers + dispatch_alerts + courier lat/lng + A3 GPS telemetry + A4 tracking_sessions + tracking_positions + tracking_events + A9 courier_wallets + courier_payout_requests) ready");
  } catch (err) {
    logger.error({ err }, "Migration error — server cannot start safely");
    throw err;
  } finally {
    client.release();
  }
}
