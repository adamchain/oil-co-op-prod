import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../authContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ConversationRun = {
  id: string;
  title: string;
  timestamp: Date;
  preview: string;
};

const suggestedPrompts = [
  "What tasks need my attention?",
  "Show me upcoming renewals",
  "How many active members do we have?",
  "Who needs oil company assignment?",
  "Give me a system status overview",
  "Show recent payment activity",
];

export default function AdminAgentsPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentRuns, setRecentRuns] = useState<ConversationRun[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load recent runs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("agentRecentRuns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecentRuns(parsed.map((r: ConversationRun) => ({ ...r, timestamp: new Date(r.timestamp) })));
      } catch {
        // ignore
      }
    }
  }, []);

  function saveRun(firstMessage: string, response: string) {
    const run: ConversationRun = {
      id: `run-${Date.now()}`,
      title: firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : ""),
      timestamp: new Date(),
      preview: response.slice(0, 60) + "...",
    };
    const updated = [run, ...recentRuns].slice(0, 10);
    setRecentRuns(updated);
    localStorage.setItem("agentRecentRuns", JSON.stringify(updated));
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const isFirstMessage = messages.length === 0;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api<{ response: string; data?: Record<string, unknown> }>(
        "/api/admin/assistant",
        {
          method: "POST",
          token,
          body: JSON.stringify({ message: text.trim() }),
        }
      );

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (isFirstMessage) {
        saveRun(text.trim(), res.response);
      }
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function startNewChat() {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  }

  function formatMessage(text: string) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />");
  }

  function formatTime(date: Date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  const showWelcome = messages.length === 0;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", gap: "0" }}>
      {/* Left Sidebar - Recent Runs */}
      <div
        style={{
          width: "280px",
          borderRight: "1px solid #e7e5e4",
          display: "flex",
          flexDirection: "column",
          background: "#fafaf9",
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid #e7e5e4" }}>
          <button
            type="button"
            onClick={startNewChat}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "#c2410c",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#9a3412")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#c2410c")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div style={{ padding: "8px 12px", fontSize: "0.75rem", fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent Runs
          </div>
          {recentRuns.length === 0 ? (
            <div style={{ padding: "16px", color: "#a8a29e", fontSize: "0.875rem", textAlign: "center" }}>
              No recent conversations
            </div>
          ) : (
            recentRuns.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginBottom: "4px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#1c1917", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {run.title}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#78716c" }}>
                  {formatTime(run.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: "16px", borderTop: "1px solid #e7e5e4" }}>
          <Link
            to="/admin/my-agents"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "#f5f5f4",
              color: "#57534e",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "0.875rem",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#e7e5e4";
              e.currentTarget.style.color = "#1c1917";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f5f5f4";
              e.currentTarget.style.color = "#57534e";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
            </svg>
            My Agents
          </Link>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#ffffff" }}>
        {showWelcome ? (
          /* Welcome State */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                boxShadow: "0 8px 24px rgba(194, 65, 12, 0.25)",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2" />
                <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2" />
              </svg>
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 600, color: "#1c1917", marginBottom: "8px" }}>
              Oil Co-op Assistant
            </h1>
            <p style={{ color: "#78716c", fontSize: "1rem", marginBottom: "32px", textAlign: "center", maxWidth: "400px" }}>
              Ask me anything about your members, payments, renewals, or tasks. I have access to your live data.
            </p>

            <div style={{ width: "100%", maxWidth: "600px", marginBottom: "24px" }}>
              <form onSubmit={handleSubmit}>
                <div style={{ position: "relative" }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    style={{
                      width: "100%",
                      padding: "16px 56px 16px 20px",
                      border: "2px solid #e7e5e4",
                      borderRadius: "16px",
                      fontSize: "1rem",
                      outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#c2410c";
                      e.target.style.boxShadow = "0 4px 12px rgba(194, 65, 12, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e7e5e4";
                      e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: input.trim() ? "#c2410c" : "#e7e5e4",
                      border: "none",
                      cursor: input.trim() ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.15s",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "white" : "#a8a29e"} strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", maxWidth: "600px" }}>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: "8px 16px",
                    background: "#fafaf9",
                    border: "1px solid #e7e5e4",
                    borderRadius: "999px",
                    fontSize: "0.875rem",
                    color: "#57534e",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fff7ed";
                    e.currentTarget.style.borderColor = "#c2410c";
                    e.currentTarget.style.color = "#c2410c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fafaf9";
                    e.currentTarget.style.borderColor = "#e7e5e4";
                    e.currentTarget.style.color = "#57534e";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat State */
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    gap: "12px",
                  }}
                >
                  {msg.role === "assistant" && (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "14px 18px",
                      borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                      background: msg.role === "user" ? "#c2410c" : "#f5f5f4",
                      color: msg.role === "user" ? "white" : "#1c1917",
                      fontSize: "0.9375rem",
                      lineHeight: 1.6,
                    }}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #c2410c 0%, #ea580c 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </div>
                  <div
                    style={{
                      padding: "14px 18px",
                      borderRadius: "20px 20px 20px 4px",
                      background: "#f5f5f4",
                      color: "#78716c",
                    }}
                  >
                    <span className="typing-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e7e5e4", background: "#fafaf9" }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: "12px" }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "14px 20px",
                    border: "1px solid #e7e5e4",
                    borderRadius: "12px",
                    fontSize: "0.9375rem",
                    outline: "none",
                    background: "white",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#c2410c")}
                  onBlur={(e) => (e.target.style.borderColor = "#e7e5e4")}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  style={{
                    padding: "14px 24px",
                    background: loading || !input.trim() ? "#e7e5e4" : "#c2410c",
                    color: loading || !input.trim() ? "#a8a29e" : "white",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 600,
                    cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <style>{`
        .typing-dots span {
          animation: blink 1.4s infinite both;
          font-size: 1.5rem;
          line-height: 0.5;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
