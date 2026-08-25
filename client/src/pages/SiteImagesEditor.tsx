import { useEffect, useRef, useState } from "react";
import { api, siteImageUrl } from "../api";
import { useAuth } from "../authContext";

/** One replaceable image slot, mirrored from the server registry. */
type SiteImage = {
  path: string;
  label: string;
  customized: boolean;
  updatedAt: number | null;
};

const MAX_BYTES = 8 * 1024 * 1024;

/** Read a File into a base64 data URL for the JSON upload. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Admin → Site Content → Images tab. Lists the fixed marketing-site photos and
 * logo and lets staff replace any of them by uploading a new file. Uploads
 * overwrite the served image at its existing path, so nothing else on the page
 * has to change — the public site picks the new image up immediately.
 */
export default function SiteImagesEditor() {
  const { token } = useAuth();
  const [images, setImages] = useState<SiteImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    api<{ images: SiteImage[] }>("/api/admin/site-images", { token })
      .then((data) => {
        if (active) setImages(data.images ?? []);
      })
      .catch((err) => {
        if (active) setMsg(err instanceof Error ? err.message : "Failed to load images");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function replace(path: string, file: File) {
    setMsg("");
    if (!file.type.startsWith("image/")) {
      setMsg("Please choose an image file (PNG, JPG, WEBP, GIF, or SVG).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setMsg("That image is too large — keep it under 8 MB.");
      return;
    }
    setBusyPath(path);
    try {
      const dataUrl = await readAsDataUrl(file);
      const data = await api<{ images: SiteImage[] }>("/api/admin/site-images", {
        method: "PUT",
        token,
        body: JSON.stringify({ path, dataUrl }),
      });
      setImages(data.images ?? []);
      setMsg("Saved. The new image is live on the public site.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyPath(null);
    }
  }

  async function reset(path: string) {
    setMsg("");
    setBusyPath(path);
    try {
      const data = await api<{ images: SiteImage[] }>("/api/admin/site-images/reset", {
        method: "POST",
        token,
        body: JSON.stringify({ path }),
      });
      setImages(data.images ?? []);
      setMsg("Restored the original image.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyPath(null);
    }
  }

  if (loading) return <p style={{ color: "#64748b" }}>Loading…</p>;

  return (
    <>
      {msg && (
        <p
          style={{
            margin: "0 0 1rem",
            color: msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("large") ? "#b91c1c" : "#0e763c",
            fontSize: "0.9rem",
          }}
        >
          {msg}
        </p>
      )}
      <section className="admin-card">
        <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))" }}>
          {images.map((img) => {
            const busy = busyPath === img.path;
            // Cache-bust the preview so a just-replaced image shows immediately.
            const previewSrc = siteImageUrl(img.path, img.updatedAt ?? "original");
            return (
              <div key={img.path} style={{ display: "grid", gap: "0.5rem" }}>
                <div
                  style={{
                    aspectRatio: "3 / 2",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                    background: "#f8fafc center / cover no-repeat",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={previewSrc}
                    alt={img.label}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  {img.label}
                  {img.customized && <span style={{ color: "#0e763c", fontWeight: 400 }}> · replaced</span>}
                </span>
                <code style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{img.path}</code>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    ref={(el) => {
                      inputs.current[img.path] = el;
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void replace(img.path, file);
                    }}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    disabled={busy}
                    onClick={() => inputs.current[img.path]?.click()}
                  >
                    {busy ? "Uploading…" : img.customized ? "Replace again" : "Replace image"}
                  </button>
                  {img.customized && (
                    <button type="button" className="admin-btn admin-btn-ghost" disabled={busy} onClick={() => void reset(img.path)}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
