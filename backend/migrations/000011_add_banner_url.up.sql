-- Add banner_url column for custom profile banners (images/GIFs/videos, max 10MB).
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512) DEFAULT '';
