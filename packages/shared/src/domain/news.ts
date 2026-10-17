/** Where uploaded news pictures are served from; the id comes from the database (`NewsImage`). */
export const NEWS_IMAGE_PATH = "/api/news/image";

/**
 * A news cover is either a built-in picture from `public/news` or a picture uploaded in the admin area.
 * Nothing else may be referenced.
 */
export const NEWS_COVER_PATTERN = /^(\/news\/[a-z0-9-]+\.(svg|png|jpe?g|webp)|\/api\/news\/image\/[a-z0-9]+)$/;

/** The cover of entries that have none of their own. */
export const DEFAULT_NEWS_COVER = "/news/default.svg";

/** Largest picture the admin area accepts, before it is cropped and compressed. */
export const NEWS_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Size every uploaded cover is brought to (the cards show them at this ratio). */
export const NEWS_IMAGE_SIZE = { width: 1200, height: 630 } as const;
