import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type Partner = {
  _id: string;
  name: string;
  shortName?: string;
  blurb?: string;
  websiteUrl?: string;
  imageUrl?: string;
  logoUrl?: string;
  sortOrder?: number;
  active?: boolean;
};

type CommunityEvent = {
  _id: string;
  title: string;
  eventDate?: string;
  location?: string;
  blurb?: string;
  imageUrl?: string;
  kind: "upcoming" | "recent";
  sortOrder?: number;
  active?: boolean;
};

type PartnerDraft = {
  name: string;
  shortName: string;
  blurb: string;
  websiteUrl: string;
  imageUrl: string;
  logoUrl: string;
  sortOrder: string;
  active: boolean;
};

type EventDraft = {
  title: string;
  eventDate: string;
  location: string;
  blurb: string;
  imageUrl: string;
  kind: "upcoming" | "recent";
  sortOrder: string;
  active: boolean;
};

const emptyPartner = (): PartnerDraft => ({
  name: "",
  shortName: "",
  blurb: "",
  websiteUrl: "",
  imageUrl: "",
  logoUrl: "",
  sortOrder: "0",
  active: true,
});

const emptyEvent = (): EventDraft => ({
  title: "",
  eventDate: "",
  location: "",
  blurb: "",
  imageUrl: "",
  kind: "upcoming",
  sortOrder: "0",
  active: true,
});

function toPartnerDraft(p: Partner): PartnerDraft {
  return {
    name: p.name || "",
    shortName: p.shortName || "",
    blurb: p.blurb || "",
    websiteUrl: p.websiteUrl || "",
    imageUrl: p.imageUrl || "",
    logoUrl: p.logoUrl || "",
    sortOrder: String(p.sortOrder ?? 0),
    active: p.active !== false,
  };
}

function toEventDraft(e: CommunityEvent): EventDraft {
  return {
    title: e.title || "",
    eventDate: e.eventDate || "",
    location: e.location || "",
    blurb: e.blurb || "",
    imageUrl: e.imageUrl || "",
    kind: e.kind || "upcoming",
    sortOrder: String(e.sortOrder ?? 0),
    active: e.active !== false,
  };
}

function partnerBody(d: PartnerDraft) {
  if (!d.name.trim()) throw new Error("Partner name is required");
  return {
    name: d.name.trim(),
    shortName: d.shortName.trim(),
    blurb: d.blurb,
    websiteUrl: d.websiteUrl.trim(),
    imageUrl: d.imageUrl.trim(),
    logoUrl: d.logoUrl.trim(),
    sortOrder: Number(d.sortOrder) || 0,
    active: d.active,
  };
}

function eventBody(d: EventDraft) {
  if (!d.title.trim()) throw new Error("Event title is required");
  return {
    title: d.title.trim(),
    eventDate: d.eventDate.trim(),
    location: d.location.trim(),
    blurb: d.blurb,
    imageUrl: d.imageUrl.trim(),
    kind: d.kind,
    sortOrder: Number(d.sortOrder) || 0,
    active: d.active,
  };
}

export default function AdminCommunityPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"partners" | "events">("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [partnerEdit, setPartnerEdit] = useState<PartnerDraft>(emptyPartner());
  const [eventEdit, setEventEdit] = useState<EventDraft>(emptyEvent());
  const [newPartner, setNewPartner] = useState<PartnerDraft>(emptyPartner());
  const [newEvent, setNewEvent] = useState<EventDraft>(emptyEvent());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    if (!token) return;
    const [p, e] = await Promise.all([
      api<{ partners: Partner[] }>("/api/admin/community/partners", { token }),
      api<{ events: CommunityEvent[] }>("/api/admin/community/events", { token }),
    ]);
    setPartners(p.partners || []);
    setEvents(e.events || []);
  }

  useEffect(() => {
    void load().catch((err) => setMsg(err instanceof Error ? err.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createPartner() {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      await api("/api/admin/community/partners", {
        method: "POST",
        token,
        body: JSON.stringify(partnerBody(newPartner)),
      });
      setNewPartner(emptyPartner());
      await load();
      setMsg("Partner added. It will show on the Community Partnerships page.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePartner(id: string) {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/community/partners/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(partnerBody(partnerEdit)),
      });
      setEditingPartnerId(null);
      await load();
      setMsg("Partner updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deletePartner(id: string) {
    if (!token || !window.confirm("Delete this community partner?")) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/community/partners/${id}`, { method: "DELETE", token });
      setEditingPartnerId(null);
      await load();
      setMsg("Partner deleted.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function createEvent() {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      await api("/api/admin/community/events", {
        method: "POST",
        token,
        body: JSON.stringify(eventBody(newEvent)),
      });
      setNewEvent(emptyEvent());
      await load();
      setMsg("Event added.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent(id: string) {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/community/events/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(eventBody(eventEdit)),
      });
      setEditingEventId(null);
      await load();
      setMsg("Event updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!token || !window.confirm("Delete this event?")) return;
    setSaving(true);
    setMsg("");
    try {
      await api(`/api/admin/community/events/${id}`, { method: "DELETE", token });
      setEditingEventId(null);
      await load();
      setMsg("Event deleted.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.35rem" }}>Community</h1>
      <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.92rem", maxWidth: "42rem" }}>
        Manage partners and events on the public Community Partnerships page. Image fields accept a path like{" "}
        <code>/site/family.jpg</code> or a full URL. Uncheck Active to hide without deleting.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className={`admin-btn${tab === "partners" ? " admin-btn-primary" : " admin-btn-ghost"}`}
          onClick={() => setTab("partners")}
        >
          Partners ({partners.length})
        </button>
        <button
          type="button"
          className={`admin-btn${tab === "events" ? " admin-btn-primary" : " admin-btn-ghost"}`}
          onClick={() => setTab("events")}
        >
          Events ({events.length})
        </button>
      </div>

      {msg && (
        <p style={{ marginBottom: "0.75rem", color: msg.toLowerCase().includes("fail") ? "#b91c1c" : "#0e763c" }}>
          {msg}
        </p>
      )}

      {tab === "partners" && (
        <>
          <PartnerForm draft={newPartner} setDraft={setNewPartner} />
          <button type="button" className="admin-btn" disabled={saving} onClick={() => void createPartner()} style={{ marginBottom: "1rem" }}>
            Add partner
          </button>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Short</th>
                  <th>Order</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) =>
                  editingPartnerId === p._id ? (
                    <tr key={p._id}>
                      <td colSpan={5}>
                        <PartnerForm draft={partnerEdit} setDraft={setPartnerEdit} />
                        <div style={{ marginTop: "0.5rem" }}>
                          <button type="button" className="admin-btn" disabled={saving} onClick={() => void savePartner(p._id)}>
                            Save
                          </button>{" "}
                          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingPartnerId(null)}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p._id}>
                      <td>
                        <strong>{p.name}</strong>
                        {p.websiteUrl ? (
                          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{p.websiteUrl}</div>
                        ) : null}
                      </td>
                      <td>{p.shortName || "—"}</td>
                      <td>{p.sortOrder ?? 0}</td>
                      <td>{p.active === false ? "No" : "Yes"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => {
                            setEditingPartnerId(p._id);
                            setPartnerEdit(toPartnerDraft(p));
                          }}
                        >
                          Edit
                        </button>{" "}
                        <button type="button" className="admin-btn admin-btn-ghost" disabled={saving} onClick={() => void deletePartner(p._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "events" && (
        <>
          <EventForm draft={newEvent} setDraft={setNewEvent} />
          <button type="button" className="admin-btn" disabled={saving} onClick={() => void createEvent()} style={{ marginBottom: "1rem" }}>
            Add event
          </button>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Kind</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) =>
                  editingEventId === e._id ? (
                    <tr key={e._id}>
                      <td colSpan={5}>
                        <EventForm draft={eventEdit} setDraft={setEventEdit} />
                        <div style={{ marginTop: "0.5rem" }}>
                          <button type="button" className="admin-btn" disabled={saving} onClick={() => void saveEvent(e._id)}>
                            Save
                          </button>{" "}
                          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingEventId(null)}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={e._id}>
                      <td>
                        <strong>{e.title}</strong>
                        {e.location ? <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{e.location}</div> : null}
                      </td>
                      <td>{e.eventDate || "—"}</td>
                      <td>{e.kind}</td>
                      <td>{e.active === false ? "No" : "Yes"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() => {
                            setEditingEventId(e._id);
                            setEventEdit(toEventDraft(e));
                          }}
                        >
                          Edit
                        </button>{" "}
                        <button type="button" className="admin-btn admin-btn-ghost" disabled={saving} onClick={() => void deleteEvent(e._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function PartnerForm({
  draft,
  setDraft,
}: {
  draft: PartnerDraft;
  setDraft: (d: PartnerDraft | ((prev: PartnerDraft) => PartnerDraft)) => void;
}) {
  const field = (key: keyof PartnerDraft, label: string, multiline = false) => (
    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
      <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>{label}</span>
      {multiline ? (
        <textarea
          value={String(draft[key])}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          rows={3}
          style={{ width: "100%", padding: "0.4rem 0.55rem" }}
        />
      ) : (
        <input
          value={String(draft[key])}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          style={{ width: "100%", padding: "0.4rem 0.55rem" }}
        />
      )}
    </label>
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        padding: "0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        marginBottom: "0.75rem",
        background: "#f8fafc",
      }}
    >
      {field("name", "Name")}
      {field("shortName", "Short name (card title)")}
      <div style={{ gridColumn: "1 / -1" }}>{field("blurb", "Blurb", true)}</div>
      {field("websiteUrl", "Website URL")}
      {field("imageUrl", "Photo URL (e.g. /site/family.jpg)")}
      {field("logoUrl", "Logo URL (optional)")}
      {field("sortOrder", "Sort order")}
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
        Active on public site
      </label>
    </div>
  );
}

function EventForm({
  draft,
  setDraft,
}: {
  draft: EventDraft;
  setDraft: (d: EventDraft | ((prev: EventDraft) => EventDraft)) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        padding: "0.85rem",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        marginBottom: "0.75rem",
        background: "#f8fafc",
      }}
    >
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Title</span>
        <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
      </label>
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Date</span>
        <input type="date" value={draft.eventDate} onChange={(e) => setDraft((d) => ({ ...d, eventDate: e.target.value }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
      </label>
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Location</span>
        <input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
      </label>
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Kind</span>
        <select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as "upcoming" | "recent" }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }}>
          <option value="upcoming">Upcoming</option>
          <option value="recent">Recent</option>
        </select>
      </label>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={{ display: "block", fontSize: "0.85rem" }}>
          <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Blurb</span>
          <textarea value={draft.blurb} onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))} rows={2} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
        </label>
      </div>
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Photo URL (recent events)</span>
        <input value={draft.imageUrl} onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
      </label>
      <label style={{ display: "block", fontSize: "0.85rem" }}>
        <span style={{ display: "block", marginBottom: "0.2rem", color: "#64748b" }}>Sort order</span>
        <input value={draft.sortOrder} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} style={{ width: "100%", padding: "0.4rem 0.55rem" }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
        Active on public site
      </label>
    </div>
  );
}
