CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE TABLE IF NOT EXISTS attachments (
    attachment_ref_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name          VARCHAR(512) NOT NULL,
    content_type       VARCHAR(255) NOT NULL,
    data               BYTEA NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenders (
    tender_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_name  VARCHAR(512) NOT NULL,
    tender_ref   UUID NOT NULL REFERENCES attachments(attachment_ref_id) ON DELETE CASCADE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
