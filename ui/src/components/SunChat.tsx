import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Message } from "../api/agent";

interface MessageWithTime extends Message {
  time: string;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  planetId: string;
  planetName: string;
}

export function SunChat({ planetId, planetName }: Props) {
  const [messages, setMessages] = useState<MessageWithTime[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // Fetch session greeting on mount
  useEffect(() => {
    api.getGreeting(planetId).then(({ greeting }) => {
      if (greeting) setMessages([{ role: "assistant", content: greeting, time: nowTime() }]);
    }).catch(() => undefined);
  }, [planetId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text, time: nowTime() }]);
    setLoading(true);
    try {
      const { reply } = await api.chat(planetId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, time: nowTime() }]);
    } catch {
      setError("Failed to reach Solar. Is the agent service running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Messages ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-6" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: "10px",
              paddingTop: "40px",
            }}
          >
            <div
              style={{
                fontSize: "2.4rem",
                filter: "drop-shadow(0 0 18px rgba(245,158,11,0.6))",
                animation: "float 4s ease-in-out infinite",
              }}
            >
              ☀
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
              Chat with Solar about{" "}
              <span style={{ color: "var(--sun-color)", fontWeight: 500 }}>{planetName}</span>
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-dim)", margin: 0, letterSpacing: "0.04em" }}>
              Remembers everything across sessions
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className="msg-enter"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>

              {/* Solar avatar */}
              {msg.role === "assistant" && (
                <div
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    flexShrink: 0,
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.22)",
                  }}
                >
                  ☀
                </div>
              )}

              {/* Bubble */}
              <div
                style={
                  msg.role === "user"
                    ? {
                        maxWidth: "72%",
                        padding: "10px 14px",
                        fontSize: "13.5px",
                        lineHeight: "1.55",
                        background: "rgba(67, 56, 202, 0.38)",
                        borderRadius: "16px 4px 16px 16px",
                        border: "1px solid rgba(99, 102, 241, 0.22)",
                        backdropFilter: "blur(10px)",
                        color: "#dde0ff",
                      }
                    : {
                        maxWidth: "82%",
                        padding: "10px 14px",
                        fontSize: "13.5px",
                        lineHeight: "1.55",
                        background: "rgba(12, 10, 26, 0.6)",
                        borderRadius: "4px 16px 16px 16px",
                        border: "1px solid rgba(167, 139, 250, 0.09)",
                        backdropFilter: "blur(10px)",
                        color: "var(--text)",
                      }
                }
              >
                {msg.content}
              </div>
            </div>

            {/* Timestamp */}
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-dim)",
                letterSpacing: "0.04em",
                paddingLeft: msg.role === "assistant" ? "34px" : "0",
                paddingRight: msg.role === "user" ? "2px" : "0",
              }}
            >
              {msg.time}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm mr-2.5 shrink-0"
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.28)",
              }}
            >
              ☀
            </div>
            <div
              className="px-4 py-3"
              style={{
                background: "rgba(13, 11, 28, 0.65)",
                borderRadius: "4px 18px 18px 18px",
                border: "1px solid rgba(167, 139, 250, 0.1)",
              }}
            >
              <span className="inline-flex gap-1.5 items-center">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "rgba(245,158,11,0.55)",
                      display: "inline-block",
                      animation: `dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="text-xs text-center px-3 py-2 rounded-lg"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────── */}
      <div
        style={{
          padding: "14px 18px 16px",
          borderTop: "1px solid rgba(167,139,250,0.07)",
          background: "rgba(6, 4, 16, 0.75)",
          backdropFilter: "blur(20px)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <textarea
            style={{
              flex: 1,
              color: "white",
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(167,139,250,0.15)",
              borderRadius: "14px",
              padding: "10px 14px",
              fontSize: "13.5px",
              lineHeight: "1.5",
              resize: "none",
              maxHeight: "7rem",
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.2s",
            }}
            rows={1}
            placeholder={`Message Solar about ${planetName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={(e)  => (e.target.style.borderColor = "rgba(245,158,11,0.4)")}
            onBlur={(e)   => (e.target.style.borderColor = "rgba(167,139,250,0.15)")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? "var(--sun-color)" : "rgba(245,158,11,0.25)",
              border: "none",
              borderRadius: "12px",
              padding: "10px",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              color: input.trim() && !loading ? "#0a0508" : "rgba(245,158,11,0.5)",
              transition: "all 0.2s",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={14} />
          </button>
        </div>
        <p
          style={{
            fontSize: "10px",
            color: "var(--text-dim)",
            textAlign: "right",
            marginTop: "7px",
            letterSpacing: "0.03em",
          }}
        >
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
