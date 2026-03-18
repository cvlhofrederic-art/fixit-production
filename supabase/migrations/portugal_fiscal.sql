-- ══════════════════════════════════════════════════════════════════════════════
-- Portugal Fiscal Tables — AT (Autoridade Tributária) Compliance
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this migration in Supabase SQL Editor to create the fiscal tables.
--
-- Tables:
--   pt_fiscal_series     — Document series registered with AT
--   pt_fiscal_documents  — Document chain (hashes, ATCUD, sequential numbers)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── Document Series ─────────────────────────────────────────────────────────
-- Each artisan has one or more document series, each registered with AT.
-- AT assigns a validation_code per series (used for ATCUD generation).

CREATE TABLE IF NOT EXISTS pt_fiscal_series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Series identification
  series_prefix VARCHAR(10) NOT NULL,        -- e.g., "VTF" (Vitfix)
  doc_type VARCHAR(5) NOT NULL,              -- "FT", "FR", "FS", "NC", "ND", "OR"

  -- AT-assigned validation code (obtained when registering series with AT)
  validation_code VARCHAR(50) NOT NULL,      -- Used for ATCUD generation

  -- Sequential counter (atomically incremented)
  current_seq INTEGER NOT NULL DEFAULT 0,    -- Last used sequential number

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  fiscal_year INTEGER NOT NULL,              -- e.g., 2026
  fiscal_space VARCHAR(5) NOT NULL DEFAULT 'PT', -- "PT", "PT-AC", "PT-MA"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique series per artisan per doc type per year
  CONSTRAINT unique_series UNIQUE (artisan_id, series_prefix, doc_type, fiscal_year)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pt_fiscal_series_artisan
  ON pt_fiscal_series(artisan_id, doc_type, fiscal_year, is_active);


-- ─── Fiscal Documents ────────────────────────────────────────────────────────
-- Every invoice/quote is recorded here with its hash chain data.
-- This is the authoritative record for SAF-T PT export and AT audit.

CREATE TABLE IF NOT EXISTS pt_fiscal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES pt_fiscal_series(id),

  -- Document identification
  doc_type VARCHAR(5) NOT NULL,              -- "FT", "FR", "FS", "NC", "ND", "OR"
  doc_number VARCHAR(50) NOT NULL,           -- "FT VTF/1" (SAF-T format)
  seq_number INTEGER NOT NULL,               -- Sequential number within series

  -- ATCUD
  atcud VARCHAR(100) NOT NULL,               -- "{ValidationCode}-{SeqNumber}"

  -- Hash chain (Portaria n.º 363/2010)
  hash TEXT NOT NULL,                        -- Full Base64 RSA-SHA1 hash
  hash_control VARCHAR(1) NOT NULL DEFAULT '1', -- "1" if hash present
  previous_hash TEXT,                        -- Hash of previous document in series

  -- Status
  status VARCHAR(1) NOT NULL DEFAULT 'N',    -- N=Normal, A=Anulado, F=Faturado

  -- Dates
  issue_date DATE NOT NULL,                  -- Document date (YYYY-MM-DD)
  system_entry_date TIMESTAMPTZ NOT NULL DEFAULT now(), -- System registration time

  -- Issuer (artisan)
  issuer_nif VARCHAR(20) NOT NULL,           -- NIF do emitente
  issuer_name VARCHAR(200) NOT NULL,
  issuer_address TEXT,
  issuer_city VARCHAR(100),
  issuer_postal_code VARCHAR(20),

  -- Client
  client_nif VARCHAR(20) DEFAULT '999999990', -- NIF do cliente (consumidor final)
  client_name VARCHAR(200),
  client_address TEXT,
  client_city VARCHAR(100),
  client_postal_code VARCHAR(20),
  client_country VARCHAR(2) DEFAULT 'PT',

  -- Amounts
  net_total NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Total sem IVA
  tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Total IVA
  gross_total NUMERIC(12,2) NOT NULL DEFAULT 0,  -- Total com IVA

  -- Tax breakdown by rate
  tax_exempt_base NUMERIC(12,2) DEFAULT 0,
  reduced_rate_base NUMERIC(12,2) DEFAULT 0,
  reduced_rate_tax NUMERIC(12,2) DEFAULT 0,
  intermediate_rate_base NUMERIC(12,2) DEFAULT 0,
  intermediate_rate_tax NUMERIC(12,2) DEFAULT 0,
  normal_rate_base NUMERIC(12,2) DEFAULT 0,
  normal_rate_tax NUMERIC(12,2) DEFAULT 0,

  -- QR Code
  qr_code_string TEXT NOT NULL,              -- Full QR code data string

  -- Fiscal space
  fiscal_space VARCHAR(5) NOT NULL DEFAULT 'PT',

  -- Line items (JSONB for flexibility, also used in SAF-T export)
  lines JSONB NOT NULL DEFAULT '[]',
  -- Each line: { line_number, product_code, description, quantity, unit,
  --              unit_price, tax_rate, line_total, tax_exemption_reason? }

  -- Reference to source document (for credit notes / invoices from quotes)
  source_doc_id UUID REFERENCES pt_fiscal_documents(id),
  source_doc_number VARCHAR(50),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique document numbers
  CONSTRAINT unique_doc_number UNIQUE (artisan_id, doc_number)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pt_fiscal_docs_artisan
  ON pt_fiscal_documents(artisan_id, doc_type, issue_date);

CREATE INDEX IF NOT EXISTS idx_pt_fiscal_docs_series
  ON pt_fiscal_documents(series_id, seq_number);

CREATE INDEX IF NOT EXISTS idx_pt_fiscal_docs_date
  ON pt_fiscal_documents(issue_date, doc_type);

CREATE INDEX IF NOT EXISTS idx_pt_fiscal_docs_nif
  ON pt_fiscal_documents(issuer_nif, issue_date);


-- ─── RLS Policies ────────────────────────────────────────────────────────────
-- Each artisan can only see/manage their own fiscal data.

ALTER TABLE pt_fiscal_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_fiscal_documents ENABLE ROW LEVEL SECURITY;

-- Series policies
CREATE POLICY "Artisans can view their own series"
  ON pt_fiscal_series FOR SELECT
  USING (auth.uid() = artisan_id);

CREATE POLICY "Artisans can insert their own series"
  ON pt_fiscal_series FOR INSERT
  WITH CHECK (auth.uid() = artisan_id);

CREATE POLICY "Artisans can update their own series"
  ON pt_fiscal_series FOR UPDATE
  USING (auth.uid() = artisan_id);

-- Documents policies
CREATE POLICY "Artisans can view their own documents"
  ON pt_fiscal_documents FOR SELECT
  USING (auth.uid() = artisan_id);

CREATE POLICY "Artisans can insert their own documents"
  ON pt_fiscal_documents FOR INSERT
  WITH CHECK (auth.uid() = artisan_id);

-- Documents can be updated (status change to Anulado) but NOT deleted
CREATE POLICY "Artisans can update status of their own documents"
  ON pt_fiscal_documents FOR UPDATE
  USING (auth.uid() = artisan_id);

-- NO DELETE policy — fiscal documents must never be deleted (AT requirement)


-- ─── Function: Atomic Sequential Number ──────────────────────────────────────
-- Atomically increments the sequential counter and returns the new value.
-- This prevents race conditions when multiple invoices are created simultaneously.

CREATE OR REPLACE FUNCTION pt_fiscal_next_seq(p_series_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_seq INTEGER;
BEGIN
  UPDATE pt_fiscal_series
  SET current_seq = current_seq + 1,
      updated_at = now()
  WHERE id = p_series_id AND is_active = true
  RETURNING current_seq INTO v_next_seq;

  IF v_next_seq IS NULL THEN
    RAISE EXCEPTION 'Series not found or inactive: %', p_series_id;
  END IF;

  RETURN v_next_seq;
END;
$$;


-- ─── Function: Get Previous Hash ─────────────────────────────────────────────
-- Returns the hash of the most recent document in a series.
-- Used to build the hash chain.

CREATE OR REPLACE FUNCTION pt_fiscal_previous_hash(p_series_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT hash INTO v_hash
  FROM pt_fiscal_documents
  WHERE series_id = p_series_id
  ORDER BY seq_number DESC
  LIMIT 1;

  RETURN COALESCE(v_hash, '');
END;
$$;


-- ─── Trigger: Prevent Document Deletion ──────────────────────────────────────
-- AT requires that fiscal documents are NEVER deleted, only cancelled (status='A').

CREATE OR REPLACE FUNCTION pt_fiscal_prevent_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Fiscal documents cannot be deleted. Use status=A to cancel.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_prevent_fiscal_doc_delete
  BEFORE DELETE ON pt_fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION pt_fiscal_prevent_delete();


-- ─── Trigger: Prevent Hash Modification ──────────────────────────────────────
-- Once a document is created, its hash, doc_number, and ATCUD cannot change.

CREATE OR REPLACE FUNCTION pt_fiscal_protect_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.hash IS DISTINCT FROM NEW.hash THEN
    RAISE EXCEPTION 'Cannot modify hash of fiscal document';
  END IF;
  IF OLD.doc_number IS DISTINCT FROM NEW.doc_number THEN
    RAISE EXCEPTION 'Cannot modify doc_number of fiscal document';
  END IF;
  IF OLD.atcud IS DISTINCT FROM NEW.atcud THEN
    RAISE EXCEPTION 'Cannot modify ATCUD of fiscal document';
  END IF;
  IF OLD.seq_number IS DISTINCT FROM NEW.seq_number THEN
    RAISE EXCEPTION 'Cannot modify seq_number of fiscal document';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_protect_fiscal_immutable
  BEFORE UPDATE ON pt_fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION pt_fiscal_protect_immutable();
