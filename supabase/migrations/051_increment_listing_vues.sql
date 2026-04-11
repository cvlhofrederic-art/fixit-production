-- Atomic view counter for marketplace listings (avoids read-modify-write race)
CREATE OR REPLACE FUNCTION increment_listing_vues(listing_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE marketplace_listings SET vues = COALESCE(vues, 0) + 1 WHERE id = listing_id;
$$;
