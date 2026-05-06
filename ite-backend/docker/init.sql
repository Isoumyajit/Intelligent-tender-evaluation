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

CREATE INDEX IF NOT EXISTS ix_tenders_reference ON tenders(reference);
CREATE INDEX IF NOT EXISTS ix_tenders_status    ON tenders(status);

-- ── bidders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bidders (
    bidder_id         VARCHAR(64)  PRIMARY KEY,
    tender_id         VARCHAR(64)  NOT NULL REFERENCES tenders(tender_id) ON DELETE CASCADE,
    name              VARCHAR(256) NOT NULL,
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
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bidders_tender  ON bidders(tender_id);
CREATE INDEX IF NOT EXISTS ix_bidders_rank    ON bidders(tender_id, rank);

-- ── evaluation criteria ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluation_criteria (
    criterion_id  VARCHAR(80)  PRIMARY KEY,
    bidder_id     VARCHAR(64)  NOT NULL REFERENCES bidders(bidder_id) ON DELETE CASCADE,
    category      VARCHAR(32)  NOT NULL,
    title         VARCHAR(256) NOT NULL,
    requirement   TEXT         NOT NULL,
    status        VARCHAR(16)  NOT NULL,
    weight        INTEGER      NOT NULL DEFAULT 0,
    score         INTEGER      NOT NULL DEFAULT 0,
    notes         TEXT,
    ordinal       INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_criteria_bidder ON evaluation_criteria(bidder_id);

-- ── criterion evidence (multiple rows per criterion) ─────────────────
CREATE TABLE IF NOT EXISTS criterion_evidence (
    evidence_id      SERIAL PRIMARY KEY,
    criterion_id     VARCHAR(80)  NOT NULL REFERENCES evaluation_criteria(criterion_id) ON DELETE CASCADE,
    document_name    VARCHAR(512) NOT NULL,
    page_or_section  VARCHAR(256) NOT NULL,
    excerpt          TEXT         NOT NULL,
    extracted_value  VARCHAR(512),
    confidence       INTEGER      NOT NULL DEFAULT 0,
    ordinal          INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_evidence_criterion ON criterion_evidence(criterion_id);

-- ── bidder documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bidder_documents (
    document_id   VARCHAR(96)  PRIMARY KEY,
    bidder_id     VARCHAR(64)  NOT NULL REFERENCES bidders(bidder_id) ON DELETE CASCADE,
    tender_id     VARCHAR(64)  NOT NULL,
    file_name     VARCHAR(512) NOT NULL,
    mime_type     VARCHAR(128) NOT NULL,
    size_bytes    INTEGER      NOT NULL DEFAULT 0,
    uploaded_on   DATE,
    page_count    INTEGER,
    category      VARCHAR(32)  NOT NULL,
    description   VARCHAR(512),
    blob_ref      UUID REFERENCES attachments(attachment_ref_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_documents_bidder ON bidder_documents(bidder_id);
CREATE INDEX IF NOT EXISTS ix_documents_tender ON bidder_documents(tender_id);
