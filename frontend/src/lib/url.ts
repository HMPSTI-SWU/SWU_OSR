/**
 * Resolves an upload path (e.g., "/uploads/banners/abc.jpg") to a full URL
 * that the browser can access.
 *
 * Upload files (banners, etc.) are served by nginx on the same origin as the
 * frontend — NOT by the backend API server. So we must never resolve upload
 * paths against NEXT_PUBLIC_API_URL (which points to the backend).
 *
 * - In production (behind nginx): relative paths work because nginx serves
 *   /uploads/* directly on the same origin.
 * - In development (docker-compose): nginx is exposed on port 3000 and serves
 *   both the frontend AND /uploads/*, so relative paths also work.
 * - If NEXT_PUBLIC_UPLOADS_URL is set, use it as the base for upload paths
 *   (useful for CDN or custom domain setups).
 */
export function resolveUploadUrl(path: string | undefined | null): string {
  if (!path) return '';

  // Already a full URL (e.g., https://...)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // If a dedicated uploads URL is configured (e.g., CDN), use it
  const uploadsUrl = process.env.NEXT_PUBLIC_UPLOADS_URL || '';
  if (uploadsUrl) {
    // Remove trailing slash from base, path already starts with /
    return `${uploadsUrl.replace(/\/$/, '')}${path}`;
  }

  // Default: return relative path as-is.
  // Nginx serves /uploads/* on the same origin as the frontend,
  // so the browser resolves this correctly in all environments.
  return path;
}

/**
 * Sanitizes a URL by ensuring it uses a safe protocol.
 * This prevents XSS attacks via javascript: or vbscript: URIs.
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, 'http://localhost');
    if (['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol)) {
      return url;
    }
    return '';
  } catch {
    return '';
  }
}
