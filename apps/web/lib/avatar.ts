// Default Instagram-style Profile Picture & Avatar Helper

export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%231F2230'/><circle cx='50' cy='38' r='18' fill='%238F96A6'/><path d='M 18,84 C 18,65 32,58 50,58 C 68,58 82,65 82,84 Z' fill='%238F96A6'/></svg>";

/**
 * Returns a valid user photo URL or the default Instagram-style silhouette avatar if not present.
 */
export function getAvatarUrl(photos?: string[] | string | null): string {
  if (Array.isArray(photos)) {
    if (photos.length > 0 && photos[0] && typeof photos[0] === 'string' && photos[0].trim().length > 0) {
      return photos[0];
    }
  } else if (typeof photos === 'string' && photos.trim().length > 0) {
    return photos;
  }
  return DEFAULT_AVATAR;
}
