import { SiteImage } from "../models/SiteImage.js";

/**
 * The fixed set of marketing-site images an admin is allowed to replace. These
 * are the hard-coded `<img src="…">` paths used across the public pages. The
 * list is both the allowlist (so uploads can only target a known slot) and the
 * source of the labels shown in the admin editor.
 */
export const EDITABLE_IMAGES = [
  { path: "/site/house.jpg", label: "House photo (Home hero, Community)" },
  { path: "/site/family.jpg", label: "Family photo (Home, Services hero)" },
  { path: "/site/truck.jpg", label: "Delivery truck photo (Home hero)" },
  { path: "/coop-logo.png", label: "Co-op logo (header & footer)" },
] as const;

const EDITABLE_SET = new Set<string>(EDITABLE_IMAGES.map((i) => i.path));

/** The paths the interception middleware should watch. */
export const EDITABLE_IMAGE_PATHS: string[] = EDITABLE_IMAGES.map((i) => i.path);

export function isEditableImagePath(path: string): boolean {
  return EDITABLE_SET.has(path);
}

type Override = { contentType: string; data: Buffer; updatedAt: number };

// Overrides are served from memory so we never touch Mongo on the static-asset
// hot path. The cache is loaded once at startup and kept in sync on every write.
const cache = new Map<string, Override>();

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  // A lean() read can hand back a BSON Binary wrapper instead of a Node Buffer.
  const inner = (data as { buffer?: unknown })?.buffer;
  if (Buffer.isBuffer(inner)) return inner;
  return Buffer.from(data as ArrayLike<number>);
}

/** Load every stored override into memory. Call once after the DB connects. */
export async function loadSiteImageCache(): Promise<void> {
  const docs = await SiteImage.find({}).lean();
  cache.clear();
  for (const doc of docs as Array<Record<string, unknown>>) {
    const path = doc.path as string;
    if (!path) continue;
    cache.set(path, {
      contentType: String(doc.contentType ?? "application/octet-stream"),
      data: toBuffer(doc.data),
      updatedAt: new Date((doc.updatedAt as string) ?? 0).getTime(),
    });
  }
}

/** In-memory override for a path, if one exists. Used by the serving middleware. */
export function getSiteImageOverride(path: string): Override | undefined {
  return cache.get(path);
}

/** Persist a replacement image and refresh the in-memory cache. */
export async function saveSiteImage(path: string, contentType: string, data: Buffer): Promise<void> {
  await SiteImage.findOneAndUpdate(
    { path },
    { $set: { contentType, data } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  cache.set(path, { contentType, data, updatedAt: Date.now() });
}

/** Drop a replacement so the original build asset is served again. */
export async function resetSiteImage(path: string): Promise<void> {
  await SiteImage.deleteOne({ path });
  cache.delete(path);
}

/** Metadata for the admin editor: every slot plus whether it's been replaced. */
export function listSiteImageStatus() {
  return EDITABLE_IMAGES.map((img) => {
    const override = cache.get(img.path);
    return {
      path: img.path,
      label: img.label,
      customized: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
    };
  });
}
