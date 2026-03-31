-- Add id_document_url column to profiles_artisan for KYC document storage
ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS id_document_url TEXT;
