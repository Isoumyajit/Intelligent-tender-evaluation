-- Schema matches app/models.py. Run once on first Postgres boot via
-- docker-compose (the container loads everything under /docker-entrypoint-initdb.d).
-- The /api/* routes serve from in-memory fixtures today; this schema is
-- here so the migration to DB-backed reads is a routing change only.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── legacy items scaffold ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO items (name, description) VALUES
    ('Sample Item 1', 'This is the first sample item'),
    ('Sample Item 2', 'This is the second sample item');

-- ── attachments: raw file blobs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
    attachment_ref_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name          VARCHAR(512) NOT NULL,
    content_type       VARCHAR(255) NOT NULL,
    data               BYTEA NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── tenders (widened to match ProcessedTender) ───────────────────────
CREATE TABLE IF NOT EXISTS tenders (
    tender_id        VARCHAR(64)  PRIMARY KEY,
    tender_name      VARCHAR(512) NOT NULL,
    reference        VARCHAR(128) NOT NULL,
    authority        VARCHAR(256) NOT NULL,
    description      TEXT         NOT NULL DEFAULT '',
    status           VARCHAR(64)  NOT NULL DEFAULT 'Pending Review',
    estimated_value  VARCHAR(64)  NOT NULL DEFAULT '',
    closing_date     DATE,
    uploaded_date    DATE,
    bidders_count    INTEGER      NOT NULL DEFAULT 0,
    document_name    VARCHAR(512) NOT NULL DEFAULT '',
    document_size    VARCHAR(32)  NOT NULL DEFAULT '',
    tender_ref       UUID REFERENCES attachments(attachment_ref_id) ON DELETE SET NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
    bid_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id   UUID NOT NULL REFERENCES tenders(tender_id) ON DELETE CASCADE,
    bidder_name VARCHAR(512) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bid_attachments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id             UUID NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    attachment_ref_id  UUID NOT NULL REFERENCES attachments(attachment_ref_id) ON DELETE CASCADE
);
