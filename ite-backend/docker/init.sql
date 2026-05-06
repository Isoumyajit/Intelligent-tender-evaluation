-- Schema matches app/models.py. Runs once on first Postgres boot via
-- docker-entrypoint-initdb.d. Wipe the Docker volume to re-apply.

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

-- ── tenders ────────────────────────────────────────────────────────────
-- Primary key is a UUID (globally unique, stable across shards).
-- `reference` carries the human-readable code clerks see in the UI
-- (e.g. "ITE/2026/041") — uniquely indexed so we can look up by it.
CREATE TABLE IF NOT EXISTS tenders (
    tender_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_name      VARCHAR(512) NOT NULL,
    reference        VARCHAR(128) NOT NULL UNIQUE,
    authority        VARCHAR(256) NOT NULL DEFAULT '—',
    description      TEXT         NOT NULL DEFAULT '',
    status           VARCHAR(64)  NOT NULL DEFAULT 'Pending Review',
    estimated_value  VARCHAR(64)  NOT NULL DEFAULT '—',
    closing_date     DATE,
    uploaded_date    DATE,
    bidders_count    INTEGER      NOT NULL DEFAULT 0,
    document_name    VARCHAR(512) NOT NULL DEFAULT '',
    document_size    VARCHAR(32)  NOT NULL DEFAULT '',
    tender_ref       UUID REFERENCES attachments(attachment_ref_id) ON DELETE SET NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_tenders_status ON tenders(status);

-- ── bids (= bidders for a tender) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
    bid_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_id         UUID         NOT NULL REFERENCES tenders(tender_id) ON DELETE CASCADE,
    bidder_name       VARCHAR(512) NOT NULL,
    registration_no   VARCHAR(128) NOT NULL DEFAULT '',
    submitted_on      DATE,
    documents_count   INTEGER      NOT NULL DEFAULT 0,
    total_size        VARCHAR(32)  NOT NULL DEFAULT '—',
    confidence_score  INTEGER      NOT NULL DEFAULT 0,
    rank              INTEGER      NOT NULL DEFAULT 0,
    overall_status    VARCHAR(32)  NOT NULL DEFAULT 'Under Review',
    technical_score   INTEGER      NOT NULL DEFAULT 0,
    financial_score   INTEGER      NOT NULL DEFAULT 0,
    compliance_score  INTEGER      NOT NULL DEFAULT 0,
    bid_amount        VARCHAR(32)  NOT NULL DEFAULT '—',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bids_tender ON bids(tender_id);
CREATE INDEX IF NOT EXISTS ix_bids_rank   ON bids(tender_id, rank);

-- ── bid_attachments: join row between bid and blob ───────────────────
CREATE TABLE IF NOT EXISTS bid_attachments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id             UUID NOT NULL REFERENCES bids(bid_id) ON DELETE CASCADE,
    attachment_ref_id  UUID NOT NULL REFERENCES attachments(attachment_ref_id) ON DELETE CASCADE,
    category           VARCHAR(32),
    description        VARCHAR(512),
    page_count         INTEGER
);

CREATE INDEX IF NOT EXISTS ix_bid_attachments_bid ON bid_attachments(bid_id);
