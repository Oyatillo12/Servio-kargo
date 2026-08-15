-- ===========================================================================
-- SERVIO Kargo — realistic demo dataset (pure SQL, one transaction)
--
-- Creates ONE new tenant ("SERVIO Demo Kargo") and fills it with data that
-- looks like a cargo company five months into operation:
--
--   1 tenant           UZS pricing, weekly reminders OFF (see note below)
--   4 tariffs          avto (default), avia, bulk, one retired
--   6 employees        owner / 2 managers / 2 warehouse / 1 pending invite
--   14 batches         3 loading in China, 3 in transit, 8 landed
--   120 customers      Uzbek + Russian speakers, Pareto-skewed order volume
--   ~1500 tracks       status derived from AGE, so the funnel is coherent
--   ~7500 track_events full audit trail with realistic per-leg durations
--   ~270 payments      most customers settled, some partial, some in advance
--   4 broadcasts, 8 landing-page leads, 1 pending panel invite
--
-- Existing data is NOT touched. Re-running the file is safe: it deletes the
-- previous demo tenant (matched on its bot_token) and rebuilds from scratch.
--
-- Run (locally):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f demo-data.sql
-- Run (on the VPS, prod compose reads POSTGRES_USER/POSTGRES_DB from .env):
--   docker compose -f docker-compose.prod.yml exec -T postgres \
--     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < demo-data.sql
--
-- The `\echo` lines at the bottom are psql meta-commands; strip them if you
-- paste this into a GUI client (pgAdmin, DBeaver, TablePlus).
--
-- Panel login after this runs:  +998901112201 / demo1234   (owner)
--                               +998901112202 / demo1234   (manager)
--                               +998901112204 / demo1234   (warehouse)
--
-- NOTES
--  * bot_token is a placeholder, NOT a BotFather token. In webhook mode (prod)
--    bots are resolved lazily per webhook path, so an inert token is never
--    dialled. `settings.reminders.weekly_enabled` is false and every customer
--    tg_user_id is fake, so the reminder sweep will not try to message anyone.
--    Paste a real token into this tenant if you want the demo bot to work.
--  * No track_photos rows are seeded — pointing them at files that do not
--    exist under /data/uploads would render broken thumbnails.
--  * Money is integer tiyin throughout (CLAUDE.md rule 6): 55 000 so'm/kg is
--    5 500 000 tiyin.
-- ===========================================================================

BEGIN;

-- Deterministic: the same seed produces the same dataset on every run.
SELECT setseed(0.42);

-- ---------------------------------------------------------------------------
-- 0. Re-runnable — drop a previous demo tenant (cascades to every child row).
-- ---------------------------------------------------------------------------
DELETE FROM tenants WHERE bot_token = '0000000000:DEMO-SERVIO-KARGO-PLACEHOLDER';

-- ---------------------------------------------------------------------------
-- 1. Fixed ids, so the rest of the script can reference rows without RETURNING
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE d_ids ON COMMIT DROP AS
SELECT
  gen_random_uuid() AS tenant_id,
  gen_random_uuid() AS tariff_avto,
  gen_random_uuid() AS tariff_avia,
  gen_random_uuid() AS tariff_bulk,
  gen_random_uuid() AS tariff_old,
  gen_random_uuid() AS adm_owner,
  gen_random_uuid() AS adm_mgr1,
  gen_random_uuid() AS adm_mgr2,
  gen_random_uuid() AS adm_wh_cn,
  gen_random_uuid() AS adm_wh_tas,
  gen_random_uuid() AS adm_pending;

-- ---------------------------------------------------------------------------
-- 2. Tenant
-- ---------------------------------------------------------------------------
INSERT INTO tenants (
  id, name, code_prefix, bot_token, bot_username, currency, usd_rate_tiyin,
  pickup_address, working_hours, contact_phone, settings, created_at
)
SELECT
  d.tenant_id,
  'SERVIO Demo Kargo',
  'SD',
  '0000000000:DEMO-SERVIO-KARGO-PLACEHOLDER',
  'servio_demo_bot',
  'UZS',
  NULL,
  'Toshkent sh., Chilonzor tumani, Bunyodkor ko''chasi 12, "Servio" ombori',
  'Dushanba–Shanba, 09:00–19:00 / Yakshanba: dam olish',
  '+998901112200',
  jsonb_build_object(
    'demo', true,
    -- Deliberately off: the fake bot token must never reach Telegram.
    'reminders', jsonb_build_object('weekly_enabled', false, 'weekday', 1, 'hour', 10),
    'china_address_template',
      E'收货人: {client_code}\n电话: +86 178 2233 4455\n地址: 广东省广州市白云区石井街道庆丰路 88 号 SERVIO 仓库 {client_code}',
    'info_text',
      E'SERVIO Kargo — Xitoydan O''zbekistonga yuk tashish.\n\n• Avto: 12–18 kun, 55 000 so''m/kg\n• Avia: 4–6 kun, 95 000 so''m/kg\n• 100 kg dan ortiq yuklar uchun chegirmali tarif\n\nOmbor manzilini olish uchun "Xitoy manzili" tugmasini bosing.'
  ),
  now() - interval '186 days'
FROM d_ids d;

-- ---------------------------------------------------------------------------
-- 3. Tariffs — exactly one active default (CLAUDE.md data model)
-- ---------------------------------------------------------------------------
INSERT INTO tariffs (id, tenant_id, name, price_per_kg_minor, is_default, active, sort, created_at)
SELECT d.tariff_avto, d.tenant_id, 'Asosiy (avto)',        5500000, true,  true,  0, now() - interval '186 days' FROM d_ids d
UNION ALL
SELECT d.tariff_avia, d.tenant_id, 'Avia (tez)',           9500000, false, true,  1, now() - interval '186 days' FROM d_ids d
UNION ALL
SELECT d.tariff_bulk, d.tenant_id, 'Yirik yuk (30 kg+)',   4200000, false, true,  2, now() - interval '120 days' FROM d_ids d
UNION ALL
SELECT d.tariff_old,  d.tenant_id, 'Eski tarif (2025)',    4800000, false, false, 3, now() - interval '186 days' FROM d_ids d;

-- ---------------------------------------------------------------------------
-- 4. Employees. Password for every row that has one: demo1234
--    (argon2id hash below — the same params @node-rs/argon2 writes by default)
-- ---------------------------------------------------------------------------
INSERT INTO admin_users (
  id, tenant_id, phone, password_hash, tg_user_id, full_name, role, lang,
  active, session_epoch, last_login_at, created_at
)
SELECT d.adm_owner, d.tenant_id, '+998901112201',
       '$argon2id$v=19$m=19456,t=2,p=1$y6CFQKTxQHYfLa16JHeSdA$+6qyKfFBzbIc+tNSbkxgsIDks9QMyNc3M/66H2EJimM',
       810000001, 'Bahodir Tursunov',   'owner'::admin_role,     'uz'::lang, true, 0, now() - interval '4 hours',  now() - interval '186 days' FROM d_ids d
UNION ALL
SELECT d.adm_mgr1, d.tenant_id, '+998901112202',
       '$argon2id$v=19$m=19456,t=2,p=1$y6CFQKTxQHYfLa16JHeSdA$+6qyKfFBzbIc+tNSbkxgsIDks9QMyNc3M/66H2EJimM',
       810000002, 'Dilorom Saidova',    'manager'::admin_role,   'uz'::lang, true, 0, now() - interval '2 hours',  now() - interval '180 days' FROM d_ids d
UNION ALL
SELECT d.adm_mgr2, d.tenant_id, '+998901112203',
       '$argon2id$v=19$m=19456,t=2,p=1$y6CFQKTxQHYfLa16JHeSdA$+6qyKfFBzbIc+tNSbkxgsIDks9QMyNc3M/66H2EJimM',
       810000003, 'Alina Yefimova',     'manager'::admin_role,   'ru'::lang, true, 0, now() - interval '1 day',    now() - interval '96 days'  FROM d_ids d
UNION ALL
-- Bot-only warehouse hand in Guangzhou: Telegram linked, no panel access yet.
SELECT d.adm_wh_cn, d.tenant_id, NULL, NULL,
       810000004, 'Ombor — Guangzhou',  'warehouse'::admin_role, 'uz'::lang, true, 0, NULL,                        now() - interval '184 days' FROM d_ids d
UNION ALL
SELECT d.adm_wh_tas, d.tenant_id, '+998901112204',
       '$argon2id$v=19$m=19456,t=2,p=1$y6CFQKTxQHYfLa16JHeSdA$+6qyKfFBzbIc+tNSbkxgsIDks9QMyNc3M/66H2EJimM',
       810000005, 'Sherzod Qodirov',    'warehouse'::admin_role, 'uz'::lang, true, 0, now() - interval '6 hours',  now() - interval '150 days' FROM d_ids d
UNION ALL
-- Invited yesterday, has not set a password yet — shows the "pending" state.
SELECT d.adm_pending, d.tenant_id, '+998901112205', NULL,
       NULL,        'Jahongir Egamov',  'manager'::admin_role,   'uz'::lang, true, 0, NULL,                        now() - interval '1 day'    FROM d_ids d;

INSERT INTO admin_invites (tenant_id, admin_user_id, code, expires_at, accepted_at, created_by, created_at)
SELECT d.tenant_id, d.adm_pending, '7KQ4M2', now() + interval '18 hours', NULL, d.adm_owner, now() - interval '6 hours'
FROM d_ids d;

-- ---------------------------------------------------------------------------
-- 5. Batches (Reyslar) — 3 loading in China, 3 in transit, 8 already landed
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE d_batches ON COMMIT DROP AS
WITH raw AS (
  SELECT
    k,
    -- Newest first: k = 0 is the batch currently loading in Guangzhou.
    (now() - (k * 11 + 2) * interval '1 day')::timestamptz AS created_at,
    CASE WHEN k % 3 = 0 THEN 'avia' WHEN k % 3 = 1 THEN 'avto' ELSE 'train' END AS transport,
    CASE WHEN k < 3 THEN 'CHINA_WAREHOUSE'
         WHEN k < 6 THEN 'IN_TRANSIT'
         ELSE 'TASHKENT_WAREHOUSE' END AS status
  FROM generate_series(0, 13) k
)
SELECT
  gen_random_uuid() AS id,
  raw.k,
  upper(raw.transport) || '-' || to_char(raw.created_at, 'MMDD') AS name,
  raw.transport,
  raw.status,
  raw.created_at,
  (raw.created_at + CASE raw.transport
      WHEN 'avia'  THEN interval '5 days'
      WHEN 'avto'  THEN interval '17 days'
      ELSE              interval '13 days' END)::date AS eta_date,
  -- Index within the status group, so tracks can be spread over the batches
  -- of their own stage without a correlated OFFSET.
  (row_number() OVER (PARTITION BY raw.status ORDER BY raw.k) - 1)::int AS grp_idx
FROM raw;

INSERT INTO batches (id, tenant_id, name, transport, eta_date, status, created_at)
SELECT b.id, d.tenant_id, b.name, b.transport::transport, b.eta_date, b.status::track_status, b.created_at
FROM d_batches b CROSS JOIN d_ids d;

-- ---------------------------------------------------------------------------
-- 6. Customers — 120, Uzbek majority with a Russian-speaking minority
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE d_customers ON COMMIT DROP AS
WITH nm AS (
  SELECT
    ARRAY['Alisher','Bekzod','Doniyor','Jasur','Sardor','Otabek','Shohruh','Aziz',
          'Rustam','Farrux','Temur','Ulug''bek','Kamron','Bobur','Javohir','Sanjar',
          'Nodir','Akmal','Islom','Anvar']::text[] AS uz_m,
    ARRAY['Dilnoza','Nilufar','Zilola','Malika','Sevara','Gulnora','Kamola','Nargiza',
          'Shahzoda','Feruza','Madina','Zarina','Umida','Lola','Aziza','Charos',
          'Nodira','Sabina','Mohira','Yulduz']::text[] AS uz_f,
    ARRAY['Karimov','Rahimov','Yusupov','Tursunov','Ergashev','Saidov','Nazarov',
          'Qodirov','Xolmatov','Abdullayev','Sultonov','Mirzayev','Umarov','Ismoilov',
          'Jo''rayev','Hamidov','Sobirov','Nurmatov','Toshpo''latov','Raxmonov']::text[] AS uz_s,
    ARRAY['Sergey Ivanov','Elena Petrova','Dmitriy Kim','Olga Tsoy','Viktor Pak',
          'Natalya Li','Andrey Kuznetsov','Marina Yugay','Igor Volkov','Svetlana Ten',
          'Aleksandr Sokolov','Yuliya Nikolayeva','Pavel Tsay','Irina Morozova']::text[] AS ru_full,
    ARRAY['90','91','93','94','97','98','99','88','33','77']::text[] AS pfx
),
base AS (
  SELECT
    n,
    gen_random_uuid()          AS id,
    (random() < 0.17)          AS is_ru,
    (random() < 0.42)          AS is_female,
    floor(random() * 20)::int  AS i_first,
    floor(random() * 20)::int  AS i_last,
    floor(random() * 14)::int  AS i_ru,
    floor(random() * 10)::int  AS i_pfx,
    (random() < 0.88)          AS has_tg,
    random()                   AS r_lang,
    floor(power(random(), 1.25) * 178)::int AS age_days,
    floor(random() * 20)::int  AS age_hours,
    -- A permutation of 1..120. Phone and Telegram id are derived from THIS
    -- rather than from `n`: a linear function of `n` would be unique but come
    -- out as a visible arithmetic progression once the list is sorted by
    -- client_code. Permuting keeps uniqueness and kills the pattern.
    row_number() OVER (ORDER BY random())::int AS perm
  FROM generate_series(1, 120) n
)
SELECT
  b.id,
  b.n,
  (b.n - 1)::int AS pick_idx,
  CASE
    WHEN b.is_ru THEN nm.ru_full[1 + b.i_ru]
    WHEN b.is_female THEN nm.uz_f[1 + b.i_first] || ' ' || nm.uz_s[1 + b.i_last] || 'a'
    ELSE nm.uz_m[1 + b.i_first] || ' ' || nm.uz_s[1 + b.i_last]
  END AS full_name,
  -- Deterministically unique per row, but not visibly sequential.
  '+998' || nm.pfx[1 + b.i_pfx] || lpad(((b.perm * 74177) % 10000000)::text, 7, '0') AS phone,
  'SD-' || (1000 + b.n)::text AS client_code,
  CASE WHEN b.is_ru THEN (CASE WHEN b.r_lang < 0.85 THEN 'ru' ELSE 'uz' END)
       ELSE               (CASE WHEN b.r_lang < 0.88 THEN 'uz' ELSE 'ru' END) END AS lang,
  -- Telegram ids issued in the last few years sit in the 1–2 billion range.
  CASE WHEN b.has_tg THEN (1000000000 + b.perm * 7919137)::bigint ELSE NULL END AS tg_user_id,
  b.has_tg,
  (now() - b.age_days * interval '1 day' - b.age_hours * interval '1 hour')::timestamptz AS created_at
FROM base b CROSS JOIN nm;

INSERT INTO customers (
  id, tenant_id, tg_user_id, phone, phone_normalized, full_name, client_code,
  lang, created_by, created_at
)
SELECT
  c.id, d.tenant_id, c.tg_user_id, c.phone,
  right(regexp_replace(c.phone, '\D', '', 'g'), 9),
  c.full_name, c.client_code, c.lang::lang,
  -- Bot registrations have no author; hand-entered records name the employee.
  CASE WHEN c.has_tg THEN NULL
       WHEN c.n % 2 = 0 THEN d.adm_mgr1 ELSE d.adm_mgr2 END,
  c.created_at
FROM d_customers c CROSS JOIN d_ids d;

-- ---------------------------------------------------------------------------
-- 7. Tracks
--
-- Status is DERIVED FROM AGE rather than picked at random, so the pipeline
-- reads like a real funnel: nothing created yesterday is already delivered,
-- and nothing from March is still sitting in Guangzhou.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE d_tracks ON COMMIT DROP AS
WITH base AS (
  SELECT
    n,
    gen_random_uuid() AS id,
    floor(power(random(), 1.35) * 152)::int AS age_days,
    floor(random() * 22)::int AS age_hours,
    random() AS r_status,
    random() AS r_side,
    random() AS r_claim,
    random() AS r_cust,
    random() AS r_weight,
    random() AS r_big,
    random() AS r_tariff,
    random() AS r_manual,
    random() AS r_del,
    random() AS r_fmt,
    random() AS r_src,
    random() AS r_nobatch,
    floor(random() * 5)::int AS carrier,
    -- Per-leg durations, in hours (China handling → transit → Tashkent → …).
    (12 + random() * 60)  AS h1,
    (24 + random() * 72)  AS h2,
    (3  + random() * 20)  AS h4,
    (20 + random() * 120) AS h5,
    random() AS r_h3
  FROM generate_series(1, 1500) n
),
staged AS (
  SELECT
    b.*,
    (now() - b.age_days * interval '1 day' - b.age_hours * interval '1 hour')::timestamptz AS created_at,
    (b.r_tariff < 0.22) AS is_avia,
    CASE
      WHEN b.r_side < 0.009 THEN 'LOST'
      WHEN b.r_side < 0.020 THEN 'RETURNED'
      WHEN b.age_days < 3  THEN CASE WHEN b.r_status < 0.45 THEN 'CREATED' ELSE 'CHINA_WAREHOUSE' END
      WHEN b.age_days < 9  THEN CASE WHEN b.r_status < 0.15 THEN 'CREATED'
                                     WHEN b.r_status < 0.75 THEN 'CHINA_WAREHOUSE'
                                     ELSE 'IN_TRANSIT' END
      WHEN b.age_days < 16 THEN CASE WHEN b.r_status < 0.18 THEN 'CHINA_WAREHOUSE'
                                     WHEN b.r_status < 0.80 THEN 'IN_TRANSIT'
                                     ELSE 'TASHKENT_WAREHOUSE' END
      WHEN b.age_days < 25 THEN CASE WHEN b.r_status < 0.18 THEN 'IN_TRANSIT'
                                     WHEN b.r_status < 0.55 THEN 'TASHKENT_WAREHOUSE'
                                     ELSE 'READY_FOR_PICKUP' END
      WHEN b.age_days < 42 THEN CASE WHEN b.r_status < 0.10 THEN 'TASHKENT_WAREHOUSE'
                                     WHEN b.r_status < 0.42 THEN 'READY_FOR_PICKUP'
                                     ELSE 'DELIVERED' END
      ELSE                      CASE WHEN b.r_status < 0.07 THEN 'READY_FOR_PICKUP'
                                     ELSE 'DELIVERED' END
    END AS status
  FROM base b
),
priced AS (
  SELECT
    s.*,
    -- Weight is only known once the parcel is on the Tashkent scales.
    CASE WHEN s.status IN ('TASHKENT_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED')
         THEN (round((CASE WHEN s.r_big < 0.04
                           THEN 30000 + s.r_weight * 52000
                           ELSE 250 + power(s.r_weight, 2.0) * 17500 END) / 10.0) * 10)::int
    END AS weight_grams,
    -- Avia transit is days, road transit is weeks.
    CASE WHEN s.is_avia THEN 60 + s.r_h3 * 48 ELSE 264 + s.r_h3 * 168 END AS h3,
    -- Codes: the five carriers an Uzbek cargo actually sees on the boxes, each
    -- at its real length. The digit body is `n * 99733` offset into a fixed
    -- decade, so every code is unique without a uniqueness check.
    CASE s.carrier
      WHEN 0 THEN 'YT'   || lpad((1000000000000 + s.n * 99733)::text, 13, '0')            -- Yunda:   YT + 13
      WHEN 1 THEN 'SF'   || lpad((s.n * 99733)::text, 12, '0')                            -- SF:      SF + 12
      WHEN 2 THEN 'JDVA' || lpad((s.n * 99733)::text, 12, '0')                            -- JD:      JDVA + 12
      WHEN 3 THEN 'LP'   || lpad((10000000000000 + s.n * 99733)::text, 14, '0')           -- Cainiao: LP + 14
      ELSE        'LX'   || lpad((s.n * 99733)::text, 9, '0') || 'CN'                     -- China Post
    END AS code_clean
  FROM staged s
),
built AS (
  SELECT
    p.*,
    CASE
      WHEN p.weight_grams IS NULL THEN NULL
      WHEN p.weight_grams >= 30000 THEN 4200000
      WHEN p.is_avia THEN 9500000
      ELSE 5500000
    END AS per_kg,
    -- ~28% of code_original arrives lowercased or with separators; the
    -- normalized column is what everything matches on (CLAUDE.md rule 4).
    CASE
      WHEN p.r_fmt < 0.72 THEN p.code_clean
      WHEN p.r_fmt < 0.86 THEN lower(p.code_clean)
      WHEN p.r_fmt < 0.94 THEN regexp_replace(p.code_clean, '(.{4})', '\1 ', 'g')
      ELSE substr(p.code_clean, 1, 2) || '-' || substr(p.code_clean, 3)
    END AS code_original
  FROM priced p
),
final AS (
  SELECT
    b.id,
    b.n,
    b.status,
    b.created_at,
    b.code_original,
    upper(regexp_replace(b.code_original, '[^A-Za-z0-9]', '', 'g')) AS code_normalized,
    b.weight_grams,
    b.per_kg,
    CASE WHEN b.weight_grams IS NULL THEN NULL
         WHEN b.r_manual < 0.04
         -- Hand-typed override: a negotiated, visibly round som figure.
         THEN (round(round((b.weight_grams::numeric * b.per_kg) / 1000.0) / 100000.0) * 100000)::bigint
         ELSE round((b.weight_grams::numeric * b.per_kg) / 1000.0)::bigint END AS price_tiyin,
    (b.weight_grams IS NOT NULL AND b.r_manual < 0.04) AS price_manual,
    b.is_avia,
    b.r_src,
    b.r_nobatch,
    -- Unclaimed codes cluster at the start of the pipeline: the customer has
    -- simply not registered it in the bot yet.
    CASE WHEN (b.status IN ('CREATED', 'CHINA_WAREHOUSE') AND b.r_claim < 0.19)
           OR (b.status NOT IN ('CREATED', 'CHINA_WAREHOUSE') AND b.r_claim < 0.03)
         THEN NULL
         -- Skewed pick: a handful of customers order constantly, most rarely.
         ELSE floor(power(b.r_cust, 1.9) * 120)::int
    END AS cust_idx,
    CASE WHEN b.r_del < 0.012 THEN (b.created_at + interval '3 days')::timestamptz END AS deleted_at,
    -- Audit trail: the statuses this parcel actually passed through …
    CASE b.status
      WHEN 'CREATED'            THEN ARRAY['CREATED']
      WHEN 'CHINA_WAREHOUSE'    THEN ARRAY['CREATED','CHINA_WAREHOUSE']
      WHEN 'IN_TRANSIT'         THEN ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT']
      WHEN 'TASHKENT_WAREHOUSE' THEN ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT','TASHKENT_WAREHOUSE']
      WHEN 'READY_FOR_PICKUP'   THEN ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT','TASHKENT_WAREHOUSE','READY_FOR_PICKUP']
      WHEN 'DELIVERED'          THEN ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT','TASHKENT_WAREHOUSE','READY_FOR_PICKUP','DELIVERED']
      WHEN 'LOST'               THEN ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT','LOST']
      ELSE                           ARRAY['CREATED','CHINA_WAREHOUSE','IN_TRANSIT','TASHKENT_WAREHOUSE','RETURNED']
    END::text[] AS trail,
    -- … and how many hours after creation each of them happened.
    CASE b.status
      WHEN 'CREATED'            THEN ARRAY[0]
      WHEN 'CHINA_WAREHOUSE'    THEN ARRAY[0, b.h1]
      WHEN 'IN_TRANSIT'         THEN ARRAY[0, b.h1, b.h1 + b.h2]
      WHEN 'TASHKENT_WAREHOUSE' THEN ARRAY[0, b.h1, b.h1 + b.h2, b.h1 + b.h2 + b.h3]
      WHEN 'READY_FOR_PICKUP'   THEN ARRAY[0, b.h1, b.h1 + b.h2, b.h1 + b.h2 + b.h3, b.h1 + b.h2 + b.h3 + b.h4]
      WHEN 'DELIVERED'          THEN ARRAY[0, b.h1, b.h1 + b.h2, b.h1 + b.h2 + b.h3, b.h1 + b.h2 + b.h3 + b.h4, b.h1 + b.h2 + b.h3 + b.h4 + b.h5]
      WHEN 'LOST'               THEN ARRAY[0, b.h1, b.h1 + b.h2, b.h1 + b.h2 + b.h3 + 240]
      ELSE                           ARRAY[0, b.h1, b.h1 + b.h2, b.h1 + b.h2 + b.h3, b.h1 + b.h2 + b.h3 + b.h4 + 72]
    END::double precision[] AS off_h
  FROM built b
)
SELECT
  f.*,
  -- Compress the trail if the leg durations would run past "now" (a young
  -- parcel that moved fast), and stop a little short of it either way.
  LEAST(
    1.0,
    0.88 * (extract(epoch FROM (now() - f.created_at)) / 3600.0)
         / GREATEST(f.off_h[cardinality(f.off_h)], 1.0)
  ) AS scale
FROM final f;

INSERT INTO tracks (
  id, tenant_id, customer_id, tariff_id, batch_id, code_normalized, code_original,
  current_status, weight_grams, price_tiyin, price_usd_cents, usd_rate_used,
  price_manual, deleted_at, created_at
)
SELECT
  t.id,
  d.tenant_id,
  c.id,
  CASE WHEN t.weight_grams IS NULL THEN NULL
       WHEN t.per_kg = 4200000 THEN d.tariff_bulk
       WHEN t.per_kg = 9500000 THEN d.tariff_avia
       ELSE d.tariff_avto END,
  b.id,
  t.code_normalized,
  t.code_original,
  t.status::track_status,
  t.weight_grams,
  t.price_tiyin,
  NULL, NULL,                    -- UZS tenant: no USD columns
  t.price_manual,
  t.deleted_at,
  t.created_at
FROM d_tracks t
CROSS JOIN d_ids d
LEFT JOIN d_customers c ON c.pick_idx = t.cust_idx
LEFT JOIN d_batches b
       ON b.status = CASE
            WHEN t.status = 'CHINA_WAREHOUSE' THEN 'CHINA_WAREHOUSE'
            WHEN t.status IN ('IN_TRANSIT', 'LOST') THEN 'IN_TRANSIT'
            WHEN t.status IN ('TASHKENT_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED', 'RETURNED')
                 THEN 'TASHKENT_WAREHOUSE'
          END
      AND b.grp_idx = CASE
            WHEN t.status IN ('CHINA_WAREHOUSE', 'IN_TRANSIT', 'LOST') THEN t.n % 3
            ELSE t.n % 8
          END
      -- ~22% of landed parcels came in loose rather than on a batch manifest.
      AND NOT (t.status IN ('TASHKENT_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED', 'RETURNED')
               AND t.r_nobatch < 0.22);

-- ---------------------------------------------------------------------------
-- 8. track_events — one row per leg, never overwritten (CLAUDE.md rule 7)
--
-- created_by deliberately spans all four actor forms the panel resolves:
-- an admin uuid, `staff:<telegram id>` from the bot's weighing mode,
-- `customer:<telegram id>` for self-registered codes, and `system`.
-- ---------------------------------------------------------------------------
INSERT INTO track_events (track_id, status, meta, created_by, created_at)
SELECT
  t.id,
  s.status::track_status,
  CASE s.status
    WHEN 'CREATED' THEN
      CASE WHEN t.r_src < 0.55 AND c.tg_user_id IS NOT NULL
           THEN '{"source":"bot"}'::jsonb ELSE '{"source":"import"}'::jsonb END
    WHEN 'CHINA_WAREHOUSE'    THEN '{"source":"bot-staff"}'::jsonb
    WHEN 'TASHKENT_WAREHOUSE' THEN '{"source":"bot-staff"}'::jsonb
    ELSE '{"source":"panel"}'::jsonb
  END,
  CASE s.status
    WHEN 'CREATED' THEN
      CASE WHEN t.r_src < 0.55 AND c.tg_user_id IS NOT NULL
           THEN 'customer:' || c.tg_user_id::text
           WHEN t.r_src < 0.80 THEN d.adm_mgr1::text
           ELSE d.adm_mgr2::text END
    WHEN 'CHINA_WAREHOUSE'    THEN 'staff:810000004'
    WHEN 'TASHKENT_WAREHOUSE' THEN d.adm_wh_tas::text
    WHEN 'READY_FOR_PICKUP'   THEN d.adm_wh_tas::text
    WHEN 'IN_TRANSIT'         THEN CASE WHEN t.r_src < 0.5 THEN d.adm_mgr1::text ELSE d.adm_owner::text END
    WHEN 'DELIVERED'          THEN CASE WHEN t.r_src < 0.5 THEN d.adm_mgr1::text ELSE d.adm_mgr2::text END
    ELSE d.adm_owner::text
  END,
  t.created_at + (t.off_h[s.ord] * t.scale) * interval '1 hour'
FROM d_tracks t
CROSS JOIN d_ids d
LEFT JOIN d_customers c ON c.pick_idx = t.cust_idx
CROSS JOIN LATERAL unnest(t.trail) WITH ORDINALITY AS s(status, ord);

-- A customer cannot predate their own first parcel — pull the account
-- creation back where the skewed picks put an old track on a new customer.
UPDATE customers c
SET created_at = t.first_at - interval '1 day'
FROM (
  SELECT customer_id, min(created_at) AS first_at
  FROM tracks
  WHERE tenant_id = (SELECT tenant_id FROM d_ids) AND customer_id IS NOT NULL
  GROUP BY customer_id
) t
WHERE c.id = t.customer_id AND c.created_at > t.first_at;

-- ---------------------------------------------------------------------------
-- 9. Payments
--
-- Built from the real debt each customer accrued (SPEC §7.5: price of tracks
-- in READY_FOR_PICKUP or DELIVERED, soft-deleted excluded), so the debtor list
-- and the dashboard totals are internally consistent instead of arbitrary.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE d_paylan ON COMMIT DROP AS
WITH owed AS (
  SELECT t.customer_id, sum(t.price_tiyin)::bigint AS owed
  FROM tracks t
  WHERE t.tenant_id = (SELECT tenant_id FROM d_ids)
    AND t.customer_id IS NOT NULL
    AND t.deleted_at IS NULL
    AND t.current_status IN ('READY_FOR_PICKUP', 'DELIVERED')
    AND t.price_tiyin IS NOT NULL
  GROUP BY t.customer_id
),
rolled AS (
  SELECT o.customer_id, o.owed, random() AS r, random() AS r2,
         1 + floor(random() * 4)::int AS k,
         random() AS r_when, random() AS r_method, random() AS r_who, random() AS r_note
  FROM owed o
  WHERE o.owed > 0
),
targeted AS (
  SELECT
    r.*,
    CASE
      WHEN r.r < 0.10 THEN 0::bigint                                            -- has not paid at all
      WHEN r.r < 0.34 THEN (round((r.owed * (0.35 + r.r2 * 0.5)) / 100000.0) * 100000)::bigint  -- partial
      WHEN r.r < 0.95 THEN r.owed                                               -- settled in full
      ELSE r.owed + (floor(r.r2 * 12)::bigint + 1) * 100000                     -- paid ahead (Avans)
    END AS target
  FROM rolled r
)
SELECT
  t.customer_id,
  t.target,
  -- Cap the instalment count so no part falls below 2 000 so'm — otherwise a
  -- small debt split four ways rounds the first parts up and drives the
  -- remainder (the last part) negative.
  LEAST(t.k, GREATEST(1, (t.target / 200000)::int)) AS k,
  t.r_when, t.r_method, t.r_who, t.r_note
FROM targeted t
WHERE t.target > 0;

INSERT INTO payments (tenant_id, customer_id, amount_tiyin, method, note, created_by, created_at)
SELECT
  d.tenant_id,
  p.customer_id,
  -- Split into k instalments: equal round parts, the last one carries the
  -- remainder so the sum matches `target` to the tiyin.
  CASE WHEN g.i < p.k
       THEN GREATEST(floor(p.target / p.k / 100000)::bigint * 100000, 100000)
       ELSE p.target - GREATEST(floor(p.target / p.k / 100000)::bigint * 100000, 100000) * (p.k - 1)
  END,
  (CASE WHEN p.r_method < 0.62 THEN 'cash'
        WHEN p.r_method < 0.82 THEN 'click'
        WHEN p.r_method < 0.96 THEN 'payme'
        ELSE 'other' END)::payment_method,
  CASE WHEN p.r_note < 0.55 THEN NULL
       WHEN p.r_note < 0.75 THEN 'Ofisda naqd qabul qilindi'
       WHEN p.r_note < 0.88 THEN 'Qisman to''lov'
       ELSE 'Karta orqali o''tkazma' END,
  CASE WHEN p.r_who < 0.45 THEN d.adm_mgr1
       WHEN p.r_who < 0.75 THEN d.adm_mgr2
       WHEN p.r_who < 0.92 THEN d.adm_wh_tas
       ELSE d.adm_owner END,
  c.created_at
    + (extract(epoch FROM (now() - c.created_at)) * (0.25 + 0.72 * p.r_when * g.i / p.k))
      * interval '1 second'
FROM d_paylan p
CROSS JOIN d_ids d
JOIN customers c ON c.id = p.customer_id
CROSS JOIN LATERAL generate_series(1, p.k) AS g(i);

-- ---------------------------------------------------------------------------
-- 10. Broadcast history
-- ---------------------------------------------------------------------------
INSERT INTO broadcasts (tenant_id, text, sent_count, created_by, created_at)
SELECT d.tenant_id, v.text, v.sent, v.who, now() - v.ago
FROM d_ids d,
LATERAL (VALUES
  (E'Hurmatli mijozlar! AVIA-0712 reysi Toshkentga yetib keldi. Yuklaringizni ish kunlari 09:00–19:00 oralig''ida olib ketishingiz mumkin.',
   101, d.adm_owner, interval '2 days'),
  (E'Diqqat! 1-sentyabrdan avia tarif 95 000 so''m/kg bo''ladi. Avto tarif o''zgarishsiz qoladi — 55 000 so''m/kg.',
   98,  d.adm_owner, interval '11 days'),
  (E'Уважаемые клиенты! Склад в Гуанчжоу работает без выходных. Адрес можно получить в боте — кнопка «Адрес в Китае».',
   94,  d.adm_mgr2,  interval '26 days'),
  (E'Eslatma: yuklaringiz omborda 14 kundan ortiq saqlansa, kunlik saqlash haqi qo''shiladi. Iltimos, o''z vaqtida olib keting.',
   88,  d.adm_mgr1,  interval '45 days')
) AS v(text, sent, who, ago);

-- ---------------------------------------------------------------------------
-- 11. Landing-page leads (platform-level, no tenant_id — kept idempotent
--     by phone since they survive the demo tenant being dropped)
-- ---------------------------------------------------------------------------
INSERT INTO leads (name, phone, company, locale, created_at)
SELECT v.name, v.phone, v.company, v.locale::lang, now() - v.ago
FROM (VALUES
  ('Aziz Rasulov',      '+998901234501', 'Aziz Cargo',        'uz', interval '1 day'),
  ('Nodira Yusupova',   '+998931234502', 'NY Logistics',      'uz', interval '3 days'),
  ('Sergey Volkov',     '+998971234503', 'Volk Trans',        'ru', interval '5 days'),
  ('Jasur Abdullayev',  '+998911234504', NULL,                'uz', interval '9 days'),
  ('Marina Kim',        '+998991234505', 'MK Express',        'ru', interval '14 days'),
  ('Otabek Nazarov',    '+998941234506', 'Silk Way Kargo',    'uz', interval '21 days'),
  ('Feruza Hamidova',   '+998881234507', 'Feruza Trade',      'uz', interval '30 days'),
  ('Dmitriy Pak',       '+998771234508', 'Pak Logistic',      'ru', interval '44 days')
) AS v(name, phone, company, locale, ago)
WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.phone = v.phone);

COMMIT;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== SERVIO Demo Kargo — row counts ==='

SELECT 'tenant'        AS entity, count(*)::text AS n FROM tenants WHERE bot_token = '0000000000:DEMO-SERVIO-KARGO-PLACEHOLDER'
UNION ALL SELECT 'tariffs',      count(*)::text FROM tariffs      WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'admin_users',  count(*)::text FROM admin_users  WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'batches',      count(*)::text FROM batches      WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'customers',    count(*)::text FROM customers    WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'tracks',       count(*)::text FROM tracks       WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'track_events', count(*)::text FROM track_events e JOIN tracks t ON t.id = e.track_id WHERE t.tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'payments',     count(*)::text FROM payments     WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD')
UNION ALL SELECT 'broadcasts',   count(*)::text FROM broadcasts   WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD');

\echo ''
\echo '=== Tracks by status ==='

SELECT current_status, count(*) AS n
FROM tracks
WHERE tenant_id = (SELECT id FROM tenants WHERE code_prefix = 'SD') AND deleted_at IS NULL
GROUP BY current_status
ORDER BY count(*) DESC;

\echo ''
\echo '=== Debt (SPEC 7.5) ==='

WITH t AS (SELECT id FROM tenants WHERE code_prefix = 'SD'),
owed AS (
  SELECT customer_id, sum(price_tiyin) AS owed
  FROM tracks
  WHERE tenant_id = (SELECT id FROM t) AND deleted_at IS NULL
    AND current_status IN ('READY_FOR_PICKUP','DELIVERED') AND customer_id IS NOT NULL
  GROUP BY customer_id
),
paid AS (
  SELECT customer_id, sum(amount_tiyin) AS paid
  FROM payments WHERE tenant_id = (SELECT id FROM t) GROUP BY customer_id
),
bal AS (
  SELECT c.id, coalesce(o.owed,0) - coalesce(p.paid,0) AS debt
  FROM customers c
  LEFT JOIN owed o ON o.customer_id = c.id
  LEFT JOIN paid p ON p.customer_id = c.id
  WHERE c.tenant_id = (SELECT id FROM t)
)
SELECT
  count(*) FILTER (WHERE debt > 0)  AS debtors,
  count(*) FILTER (WHERE debt = 0)  AS settled,
  count(*) FILTER (WHERE debt < 0)  AS in_advance,
  to_char(sum(debt) FILTER (WHERE debt > 0) / 100.0, 'FM999G999G999G999') || ' so''m' AS total_debt,
  to_char((SELECT sum(amount_tiyin) FROM payments WHERE tenant_id = (SELECT id FROM t)) / 100.0, 'FM999G999G999G999') || ' so''m' AS total_collected
FROM bal;

\echo ''
\echo 'Panel login:  +998901112201 / demo1234  (owner: Bahodir Tursunov)'
\echo '              +998901112202 / demo1234  (manager: Dilorom Saidova)'
\echo '              +998901112204 / demo1234  (warehouse: Sherzod Qodirov)'
\echo ''
