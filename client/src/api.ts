/** Empty in dev (Vite proxies /api → server). Set VITE_API_URL on the client Railway service to your API public URL. */
const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const { token: _t, ...rest } = opts;
  const res = await fetch(`${base}${path}`, { ...rest, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError((data as { error?: unknown }).error, res.statusText));
  }
  return data as T;
}

/**
 * Turn a server error payload into a readable message. Handles Zod's
 * `flatten()` shape ({ formErrors, fieldErrors }) by collecting unique
 * messages, so a 165-row import doesn't dump the same string 165 times.
 */
function formatApiError(err: unknown, statusText: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    if (e.formErrors || e.fieldErrors) {
      const msgs = new Set<string>();
      for (const m of e.formErrors ?? []) msgs.add(m);
      for (const arr of Object.values(e.fieldErrors ?? {})) for (const m of arr) msgs.add(m);
      if (msgs.size) return Array.from(msgs).join("; ");
    }
  }
  return err != null ? JSON.stringify(err) : statusText;
}
