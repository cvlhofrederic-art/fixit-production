-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 3 : Fix SECURITY DEFINER + Storage Security
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix SECURITY DEFINER functions with restricted search_path ──────────
-- SECURITY DEFINER functions run with the privileges of the function owner.
-- Without search_path restriction, an attacker could hijack by creating
-- a malicious function in a schema that appears earlier in search_path.

-- Fix pt_fiscal_next_seq : add SECURITY barrier
CREATE OR REPLACE FUNCTION pt_fiscal_next_seq(p_series_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_seq INTEGER;
  v_owner_id UUID;
BEGIN
  -- Verify the calling user owns this series (defense in depth)
  SELECT artisan_id INTO v_owner_id
  FROM pt_fiscal_series
  WHERE id = p_series_id AND is_active = true;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Series not found or inactive: %', p_series_id;
  END IF;

  -- Check ownership: caller must own the series
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: series does not belong to caller';
  END IF;

  UPDATE pt_fiscal_series
  SET current_seq = current_seq + 1,
      updated_at = now()
  WHERE id = p_series_id AND is_active = true
  RETURNING current_seq INTO v_next_seq;

  IF v_next_seq IS NULL THEN
    RAISE EXCEPTION 'Failed to increment sequence for series: %', p_series_id;
  END IF;

  RETURN v_next_seq;
END;
$$;

-- Fix pt_fiscal_previous_hash : add SECURITY barrier
CREATE OR REPLACE FUNCTION pt_fiscal_previous_hash(p_series_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hash TEXT;
  v_owner_id UUID;
BEGIN
  -- Verify ownership
  SELECT artisan_id INTO v_owner_id
  FROM pt_fiscal_series
  WHERE id = p_series_id;

  IF v_owner_id IS NULL THEN
    RETURN '';
  END IF;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: series does not belong to caller';
  END IF;

  SELECT hash INTO v_hash
  FROM pt_fiscal_documents
  WHERE series_id = p_series_id
  ORDER BY seq_number DESC
  LIMIT 1;

  RETURN COALESCE(v_hash, '');
END;
$$;

-- Fix haversine_distance if exists : add search_path
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000; -- Earth radius in meters
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  RETURN R * 2 * atan2(sqrt(a), sqrt(1 - a));
END;
$$;

-- ── 2. Revoke EXECUTE from public on SECURITY DEFINER functions ────────────
-- Only authenticated users should call these
REVOKE ALL ON FUNCTION pt_fiscal_next_seq(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pt_fiscal_next_seq(UUID) TO authenticated;

REVOKE ALL ON FUNCTION pt_fiscal_previous_hash(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pt_fiscal_previous_hash(UUID) TO authenticated;

-- ── 3. Storage bucket security verification ────────────────────────────────
-- Ensure all buckets are PRIVATE (public: false)
-- This is verified at application level in setup-storage route.
-- The following RLS policies protect storage objects:

-- Artisan photos: owner can upload/delete, public can read (for portfolio display)
-- This is acceptable — portfolio photos are meant to be public.
-- Insurance/KBis documents: private bucket, signed URLs only.

-- ── 4. Soft delete verification: ensure deleted_at filter on critical tables ─
-- Already applied via rls_complete_audit.sql:
--   bookings: USING (deleted_at IS NULL AND ...)
--   conversations: USING (deleted_at IS NULL AND ...)
--   booking_messages: USING (deleted_at IS NULL AND ...)
