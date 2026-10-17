
-- Adds secure password-hash storage for email/password accounts.
-- Apply this migration to the same Cloudflare D1 database bound as DB.
ALTER TABLE users ADD COLUMN password_hash TEXT;
