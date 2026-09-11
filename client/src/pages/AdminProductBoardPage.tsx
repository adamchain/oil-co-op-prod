import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

const PHASES = [
  { id: "new", label: "New" },
  { id: "in_progress", label: "In-Progress" },
  { id: "testing", label: "Testing" },
  { id: "deployed", label: "Deployed" },
] as const;

type PhaseId = (typeof PHASES)[number]["id"];

type BoardItem = {
  _id: string;
  title: string;
  notes?: string;
  phase: PhaseId;
  sortOrder: number;
  createdByName?: string;
  createdAt?: string;
};

export default function AdminProductBoardPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<BoardItem[]>([]);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeployed, setShowDeployed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const res = await api<{ items: BoardItem[] }>("/api/admin/product-board", { token });
    setItems(res.items || []);
  }

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load board"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visiblePhases = useMemo(
    () => PHASES.filter((p) => p.id !== "deployed" || showDeployed),
    [showDeployed]
  );

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!token || !title.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const res = await api<{ item: BoardItem }>("/api/admin/product-board", {
        method: "POST",
        token,
        body: JSON.stringify({ title: title.trim() }),
      });
      setItems((prev) => [...prev, res.item]);
      setTitle("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not add item");
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(id: string, phase: PhaseId) {
    if (!token) return;
    const prev = items;
    setItems((list) => list.map((it) => (it._id === id ? { ...it, phase } : it)));
    try {
      const res = await api<{ item: BoardItem }>(`/api/admin/product-board/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ phase }),
      });
      setItems((list) => list.map((it) => (it._id === id ? res.item : it)));
    } catch (ex) {
      setItems(prev);
      setErr(ex instanceof Error ? ex.message : "Could not move item");
    }
  }

  return (
    <div className="admin-kanban-page">
      <header className="admin-kanban-head">
        <div>
          <h1>Product fixes &amp; updates</h1>
          <p>Drag cards through New, In-Progress, Testing, then Deployed. Deployed cards stay hidden unless you show them.</p>
        </div>
        <label className="admin-kanban-toggle">
          <input type="checkbox" checked={showDeployed} onChange={(e) => setShowDeployed(e.target.checked)} />
          Show deployed
        </label>
      </header>

      <form className="admin-kanban-add" onSubmit={(e) => void addItem(e)}>
        <input
          className="admin-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a fix or update…"
          maxLength={200}
        />
        <button type="submit" className="admin-btn" disabled={saving || !title.trim()}>
          {saving ? "Adding…" : "Add item"}
        </button>
      </form>
      {err && <p className="admin-meta" style={{ color: "#b91c1c" }}>{err}</p>}

      <div className={`admin-kanban-cols admin-kanban-cols--${visiblePhases.length}`}>
        {visiblePhases.map((phase) => {
          const colItems = items
            .filter((it) => it.phase === phase.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || String(a.createdAt).localeCompare(String(b.createdAt)));
          return (
            <section
              key={phase.id}
              className={`admin-kanban-col${draggingId ? " is-droppable" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                setDraggingId(null);
                if (id) void moveItem(id, phase.id);
              }}
            >
              <h2>
                {phase.label}
                <span>{colItems.length}</span>
              </h2>
              <div className="admin-kanban-list">
                {colItems.map((it) => (
                  <article
                    key={it._id}
                    className={`admin-kanban-card${draggingId === it._id ? " is-dragging" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(it._id);
                      e.dataTransfer.setData("text/plain", it._id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <p className="admin-kanban-card-title">{it.title}</p>
                    {it.createdByName ? <p className="admin-kanban-card-meta">{it.createdByName}</p> : null}
                  </article>
                ))}
                {colItems.length === 0 && <p className="admin-kanban-empty">Drop cards here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
