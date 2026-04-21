import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../authContext";

type TemplateKey =
  | "welcome"
  | "renewalReminder"
  | "paymentSuccess"
  | "paymentFailed"
  | "paymentLink"
  | "oilCompanyAssigned";

interface TemplateInfo {
  _id: string;
  key: TemplateKey;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
}

const sampleData = {
  firstName: "John",
  lastName: "Smith",
  memberNumber: "M-2024-0042",
  nextBillingDate: "June 1, 2025",
  daysUntil: 7,
  billingDate: "June 1, 2025",
  amount: "$120.00",
  isAutoRenew: true,
  cardLast4: "4242",
  transactionId: "TXN-123456789",
  billingYear: 2025,
  reason: "Card declined - insufficient funds",
  paymentUrl: "https://oilcoop.example.com/pay/abc123xyz",
  expiresAt: "May 15, 2025",
  companyName: "ABC Heating Oil Co.",
  companyPhone: "(555) 123-4567",
};

const templateOrder: TemplateKey[] = [
  "welcome",
  "renewalReminder",
  "paymentSuccess",
  "paymentFailed",
  "paymentLink",
  "oilCompanyAssigned",
];

function applyVariables(template: string): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, variableName: string) => {
    const value = sampleData[variableName as keyof typeof sampleData];
    return value === undefined || value === null ? "" : String(value);
  });
}

export default function AdminEmailTemplatesPage() {
  const { token, member } = useAuth();
  const [templates, setTemplates] = useState<Record<TemplateKey, TemplateInfo> | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("welcome");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    api<{ templates: TemplateInfo[] }>("/api/admin/email-templates", { token })
      .then((res) => {
        const byKey = res.templates.reduce((acc, t) => {
          acc[t.key] = t;
          return acc;
        }, {} as Record<TemplateKey, TemplateInfo>);
        setTemplates(byKey);
      })
      .catch((e: unknown) => setStatus(e instanceof Error ? e.message : "Failed to load templates"));
  }, [token]);

  const currentTemplate = templates?.[selectedTemplate];

  useEffect(() => {
    if (!currentTemplate) return;
    setSubject(currentTemplate.subject || "");
    setHtml(currentTemplate.html || "");
    setText(currentTemplate.text || "");
  }, [currentTemplate]);

  useEffect(() => {
    if (!member?.email) return;
    setTestEmail(member.email);
  }, [member?.email]);

  const previewHtml = useMemo(() => applyVariables(html || ""), [html]);

  async function saveTemplate() {
    if (!token || !currentTemplate) return;
    setSaving(true);
    setStatus("");
    try {
      const res = await api<{ template: TemplateInfo }>(`/api/admin/email-templates/${currentTemplate.key}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ subject, html, text }),
      });
      setTemplates((prev) =>
        prev ? { ...prev, [res.template.key]: res.template } : prev
      );
      setStatus("Saved");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!token || !currentTemplate) return;
    setSendingTest(true);
    setStatus("");
    try {
      await api<{ ok: boolean }>(`/api/admin/email-templates/${currentTemplate.key}/test`, {
        method: "POST",
        token,
        body: JSON.stringify({ to: testEmail, subject, html, text }),
      });
      setStatus(`Test email sent to ${testEmail}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="admin-page">
      <h2>Email Templates</h2>
      <p style={{ color: "#78716c", marginBottom: "1.5rem" }}>
        Preview and reference for all automated email notifications sent by the system.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem" }}>
        {/* Template List */}
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #e7e5e4", background: "#fafaf9" }}>
            <strong>Templates</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {templateOrder.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTemplate(key)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.75rem 1rem",
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #e7e5e4",
                  background: selectedTemplate === key ? "#fff7ed" : "transparent",
                  borderLeft: selectedTemplate === key ? "3px solid #c2410c" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontWeight: 500, color: selectedTemplate === key ? "#c2410c" : "#1c1917" }}>
                  {templates?.[key]?.name || key}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#78716c", marginTop: "0.25rem" }}>
                  {templates?.[key]?.description || ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template Preview */}
        <div>
          {/* Template Info */}
          <div className="admin-card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ margin: "0 0 0.5rem" }}>{currentTemplate?.name || "Loading..."}</h3>
            <p style={{ color: "#78716c", margin: "0 0 1rem" }}>{currentTemplate?.description || ""}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Subject Line
                </label>
                <div style={{ marginTop: "0.25rem", padding: "0.5rem 0.75rem", background: "#fafaf9", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.875rem" }}>
                  {subject}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Variables Used
                </label>
                <div style={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {(currentTemplate?.variables || []).map((v) => (
                    <span
                      key={v}
                      style={{
                        padding: "0.125rem 0.5rem",
                        background: "#e7e5e4",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              <input
                className="admin-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject template"
              />
              <textarea
                className="admin-input"
                style={{ minHeight: "180px", fontFamily: "monospace", fontSize: "0.85rem" }}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="HTML template"
              />
              <textarea
                className="admin-input"
                style={{ minHeight: "100px", fontFamily: "monospace", fontSize: "0.85rem" }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Plain text template"
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button type="button" className="admin-btn" onClick={saveTemplate} disabled={saving || !currentTemplate}>
                  {saving ? "Saving..." : "Save Template"}
                </button>
                <input
                  className="admin-input"
                  style={{ minWidth: "240px" }}
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@yourdomain.com"
                />
                <button
                  type="button"
                  className="admin-btn"
                  onClick={sendTestEmail}
                  disabled={sendingTest || !currentTemplate || !testEmail.trim()}
                >
                  {sendingTest ? "Sending..." : "Send Test Email"}
                </button>
                {status && <span style={{ fontSize: "0.875rem", color: "#78716c" }}>{status}</span>}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e7e5e4", background: "#fafaf9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong>Preview</strong>
              <span style={{ fontSize: "0.75rem", color: "#78716c" }}>Sample data shown</span>
            </div>
            <div
              style={{ maxHeight: "600px", overflow: "auto" }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
