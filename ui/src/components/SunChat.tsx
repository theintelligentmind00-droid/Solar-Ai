import { Send, Sparkles, Paperclip, Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, BASE_URL, type Message } from "../api/agent";

interface ImageAttachment {
  data: string;       // base64 (no prefix)
  media_type: string;  // image/jpeg, image/png, etc.
  preview: string;     // data URL for display
}

interface MessageWithTime extends Message {
  time: string;
  images?: ImageAttachment[];
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt.endsWith("Z") ? createdAt : createdAt + "Z");
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  planetId: string;
  planetName: string;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: "0 0 8px 0", lineHeight: "1.7" }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ color: "white", fontWeight: 600 }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ color: "rgba(255,255,255,0.85)" }}>{children}</em>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "4px 0 8px 0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "4px 0 8px 0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "3px" }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ color: "rgba(255,255,255,0.85)", lineHeight: "1.6" }}>{children}</li>
        ),
        h1: ({ children }) => (
          <h1 style={{ fontSize: "15px", fontWeight: 700, color: "white", margin: "12px 0 6px", letterSpacing: "0.01em" }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.92)", margin: "10px 0 5px" }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.88)", margin: "8px 0 4px" }}>{children}</h3>
        ),
        code: ({ children, className }) => {
          const isBlock = !!className?.includes("language-");
          return isBlock ? (
            <code style={{
              display: "block",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(167,139,250,0.18)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "11.5px",
              fontFamily: "monospace",
              color: "#a78bfa",
              margin: "8px 0",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}>{children}</code>
          ) : (
            <code style={{
              background: "rgba(167,139,250,0.14)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "11.5px",
              fontFamily: "monospace",
              color: "#c4b5fd",
            }}>{children}</code>
          );
        },
        pre: ({ children }) => <pre style={{ margin: "4px 0", background: "none" }}>{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: "3px solid rgba(245,158,11,0.5)",
            margin: "6px 0",
            paddingLeft: "12px",
            color: "rgba(255,255,255,0.65)",
            fontStyle: "italic",
          }}>{children}</blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#a78bfa", textDecoration: "underline" }}>{children}</a>
        ),
        hr: () => (
          <hr style={{ border: "none", borderTop: "1px solid rgba(167,139,250,0.15)", margin: "10px 0" }} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const QUICK_PROMPTS = [
  { label: "Summarize my emails", icon: "📬" },
  { label: "What's on my calendar?", icon: "📅" },
  { label: "Search the web for ideas", icon: "🔍" },
  { label: "What should I focus on?", icon: "🎯" },
];

function getToolLabel(toolName: string): string {
  if (["get_gmail_summary", "get_unread_emails", "get_email_body"].includes(toolName)) {
    return "Reading your inbox...";
  }
  if (["search_web", "fetch_url"].includes(toolName)) {
    return "Searching the web...";
  }
  if (
    ["get_upcoming_events", "get_todays_events", "get_calendar_events", "create_calendar_event"].includes(
      toolName
    )
  ) {
    return "Checking your calendar...";
  }
  if (toolName === "read_file") return "Reading file...";
  if (toolName === "run_shell_command") return "Running command...";
  return "Thinking...";
}

export function SunChat({ planetId, planetName }: Props) {
  const [messages, setMessages]               = useState<MessageWithTime[]>([]);
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [greetingLoading, setGreetingLoading] = useState(true);
  const [focused, setFocused]                 = useState(false);
  const [streamingText, setStreamingText]     = useState("");
  const [toolActivity, setToolActivity]       = useState<string | null>(null);
  const [attachedImages, setAttachedImages]   = useState<ImageAttachment[]>([]);
  const bottomRef                             = useRef<HTMLDivElement>(null);
  const textareaRef                           = useRef<HTMLTextAreaElement>(null);
  const fileInputRef                          = useRef<HTMLInputElement>(null);
  const cameraInputRef                        = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const remaining = 5 - attachedImages.length;

    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!allowed.includes(file.type)) return;
      if (file.size > maxSize) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        setAttachedImages((prev) => [
          ...prev,
          { data: base64, media_type: file.type, preview: dataUrl },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    setGreetingLoading(true);
    // Load persisted history first; fall back to greeting if none exists
    api
      .getChatHistory(planetId, 50)
      .then((history) => {
        if (history && history.length > 0) {
          setMessages(
            history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              time: m.created_at ? formatCreatedAt(m.created_at) : "",
            }))
          );
          setGreetingLoading(false);
        } else {
          // No history — show greeting
          return api.getGreeting(planetId).then(({ greeting }) => {
            if (greeting) setMessages([{ role: "assistant", content: greeting, time: nowTime() }]);
          });
        }
      })
      .catch(() => {
        api.getGreeting(planetId).then(({ greeting }) => {
          if (greeting) setMessages([{ role: "assistant", content: greeting, time: nowTime() }]);
        }).catch(() => undefined);
      })
      .finally(() => setGreetingLoading(false));
  }, [planetId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, streamingText, toolActivity]);

  const send = async () => {
    const text = input.trim();
    const images = [...attachedImages];
    if ((!text && images.length === 0) || loading) return;
    setInput("");
    setAttachedImages([]);
    setError(null);
    setStreamingText("");
    setToolActivity(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    const displayText = images.length > 0 && text
      ? text
      : images.length > 0
        ? `[${images.length} image${images.length > 1 ? "s" : ""} attached]`
        : text;
    setMessages((prev) => [...prev, { role: "user", content: displayText, time: nowTime(), images }]);
    setLoading(true);

    try {
      const apiKey = sessionStorage.getItem("solar_api_key") ?? "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-Api-Key"] = apiKey;

      const payload: Record<string, unknown> = { planet_id: planetId, message: text };
      if (images.length > 0) {
        payload.images = images.map((img) => ({ data: img.data, media_type: img.media_type }));
      }

      const response = await fetch(`${BASE_URL}/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(errText.replace(/^\d{3}:\s*/, "") || "Failed to reach Solar.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; content?: string; name?: string; planet_id?: string; message?: string };
          try {
            event = JSON.parse(raw) as typeof event;
          } catch {
            continue;
          }

          if (event.type === "text") {
            accumulated += event.content ?? "";
            setStreamingText(accumulated);
          } else if (event.type === "tool_start") {
            setToolActivity(getToolLabel(event.name ?? ""));
          } else if (event.type === "tool_end") {
            setToolActivity(null);
          } else if (event.type === "done") {
            const finalText = accumulated;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalText, time: nowTime() },
            ]);
            setStreamingText("");
            setToolActivity(null);
            setLoading(false);
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Streaming error");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.replace(/^\d{3}:\s*/, "") || "Failed to reach Solar. Is the agent service running?");
      setStreamingText("");
      setToolActivity(null);
      setLoading(false);
    }
  };

  const hasContent = messages.length > 0 || loading;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
    >

      {/* ── Messages area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 18px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          // Subtle gradient fade at top
          maskImage: "linear-gradient(to bottom, transparent 0%, black 40px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40px)",
        }}
      >
        {/* Empty state — shown only after greeting resolves with no messages */}
        {!hasContent && !greetingLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: "20px",
              paddingTop: "20px",
            }}
          >
            {/* Solar avatar — large */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #fff9c4, #f59e0b 55%, #d06010)",
                boxShadow: "0 0 28px rgba(245,158,11,0.55), 0 0 60px rgba(245,158,11,0.2)",
                animation: "float 4s ease-in-out infinite",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              ☀
            </div>

            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", margin: "0 0 4px", fontWeight: 500 }}>
                Chat with Solar
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", margin: 0, letterSpacing: "0.04em" }}>
                about{" "}
                <span style={{ color: "var(--sun-color)", fontWeight: 500 }}>{planetName}</span>
              </p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", margin: "6px 0 0", letterSpacing: "0.08em" }}>
                REMEMBERS EVERYTHING ACROSS SESSIONS
              </p>
            </div>

            {/* Quick prompt chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                width: "100%",
                maxWidth: "280px",
              }}
            >
              {QUICK_PROMPTS.map(({ label, icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setInput(label);
                    textareaRef.current?.focus();
                  }}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(167,139,250,0.14)",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    fontSize: "11.5px",
                    lineHeight: "1.4",
                    transition: "all 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.borderColor = "rgba(245,158,11,0.3)";
                    b.style.background = "rgba(245,158,11,0.04)";
                    b.style.color = "rgba(255,255,255,0.85)";
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.borderColor = "rgba(167,139,250,0.14)";
                    b.style.background = "rgba(255,255,255,0.03)";
                    b.style.color = "var(--text-muted)";
                  }}
                >
                  <span style={{ fontSize: "15px" }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton while greeting fetches */}
        {greetingLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              paddingTop: "12px",
            }}
          >
            <SolarAvatar pulse />
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(12,10,26,0.6)",
                borderRadius: "4px 16px 16px 16px",
                border: "1px solid rgba(167,139,250,0.08)",
                display: "flex",
                gap: "5px",
                alignItems: "center",
              }}
            >
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.5)",
                    display: "inline-block",
                    animation: `dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </div>
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
              gap: "3px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                maxWidth: msg.role === "user" ? "80%" : "94%",
              }}
            >
              {msg.role === "assistant" && <SolarAvatar />}

              {/* Bubble */}
              <div
                style={
                  msg.role === "user"
                    ? {
                        padding: "10px 14px",
                        fontSize: "13.5px",
                        lineHeight: "1.6",
                        background: "linear-gradient(135deg, rgba(79,70,229,0.45), rgba(67,56,202,0.38))",
                        borderRadius: "18px 4px 18px 18px",
                        border: "1px solid rgba(99,102,241,0.25)",
                        color: "#e8e9ff",
                        backdropFilter: "blur(8px)",
                        boxShadow: "0 2px 12px rgba(67,56,202,0.2)",
                      }
                    : {
                        padding: "12px 14px 8px",
                        fontSize: "13.5px",
                        lineHeight: "1.6",
                        background: "rgba(10,8,24,0.75)",
                        borderRadius: "4px 18px 18px 18px",
                        border: "1px solid rgba(167,139,250,0.12)",
                        color: "rgba(255,255,255,0.88)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
                      }
                }
              >
                {/* Image thumbnails */}
                {msg.images && msg.images.length > 0 && (
                  <div style={{
                    display: "flex", gap: "6px", flexWrap: "wrap",
                    marginBottom: msg.content && !msg.content.startsWith("[") ? "8px" : "0",
                  }}>
                    {msg.images.map((img, j) => (
                      <img
                        key={j}
                        src={img.preview}
                        alt="attachment"
                        style={{
                          maxWidth: "180px", maxHeight: "140px",
                          borderRadius: "10px",
                          border: "1px solid rgba(99,102,241,0.25)",
                          objectFit: "cover",
                        }}
                      />
                    ))}
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <AssistantMarkdown content={msg.content} />
                ) : (
                  (!msg.images || msg.content !== `[${msg.images.length} image${msg.images.length > 1 ? "s" : ""} attached]`)
                    ? msg.content
                    : null
                )}
              </div>
            </div>

            {/* Timestamp */}
            <div
              style={{
                fontSize: "9px",
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.06em",
                paddingLeft: msg.role === "assistant" ? "42px" : "0",
                paddingRight: msg.role === "user" ? "2px" : "0",
              }}
            >
              {msg.role === "assistant" ? "SOLAR" : "YOU"} · {msg.time}
            </div>
          </div>
        ))}

        {/* Streaming assistant message */}
        {loading && streamingText && (
          <div
            className="msg-enter"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "3px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", maxWidth: "94%" }}>
              <SolarAvatar pulse />
              <div
                style={{
                  padding: "12px 14px 8px",
                  fontSize: "13.5px",
                  lineHeight: "1.6",
                  background: "rgba(10,8,24,0.75)",
                  borderRadius: "4px 18px 18px 18px",
                  border: "1px solid rgba(167,139,250,0.12)",
                  color: "rgba(255,255,255,0.88)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
                }}
              >
                <AssistantMarkdown content={streamingText} />
              </div>
            </div>
          </div>
        )}

        {/* Tool activity indicator */}
        {loading && toolActivity && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <SolarAvatar pulse />
            <div
              style={{
                padding: "8px 14px",
                background: "rgba(10,8,24,0.75)",
                borderRadius: "4px 18px 18px 18px",
                border: "1px solid rgba(167,139,250,0.1)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: "rgba(245,158,11,0.6)",
                      display: "inline-block",
                      animation: `dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
                    }}
                  />
                ))}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(245,158,11,0.7)", letterSpacing: "0.04em" }}>
                {toolActivity}
              </span>
            </div>
          </div>
        )}

        {/* Typing indicator — shown only when loading with no streaming text yet */}
        {loading && !streamingText && !toolActivity && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <SolarAvatar pulse />
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(10,8,24,0.75)",
                borderRadius: "4px 18px 18px 18px",
                border: "1px solid rgba(167,139,250,0.1)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
              }}
            >
              <span style={{ display: "inline-flex", gap: "5px", alignItems: "center" }}>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "rgba(245,158,11,0.6)",
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
            style={{
              textAlign: "center",
              padding: "8px 16px",
              borderRadius: "10px",
              fontSize: "11px",
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

      {/* ── Quick prompts row (persistent when there are messages) ── */}
      {hasContent && !loading && (
        <div
          style={{
            padding: "8px 16px 4px",
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            scrollbarWidth: "none",
            flexShrink: 0,
          }}
        >
          {QUICK_PROMPTS.map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => {
                setInput(label);
                textareaRef.current?.focus();
              }}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(167,139,250,0.12)",
                borderRadius: "20px",
                padding: "4px 10px",
                color: "rgba(255,255,255,0.35)",
                cursor: "pointer",
                fontSize: "10.5px",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "rgba(245,158,11,0.3)";
                b.style.color = "rgba(255,255,255,0.7)";
                b.style.background = "rgba(245,158,11,0.04)";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "rgba(167,139,250,0.12)";
                b.style.color = "rgba(255,255,255,0.35)";
                b.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div
        style={{
          padding: "10px 14px 14px",
          borderTop: "1px solid rgba(167,139,250,0.07)",
          background: "linear-gradient(180deg, rgba(6,4,16,0.5) 0%, rgba(8,5,22,0.95) 100%)",
          backdropFilter: "blur(24px)",
          flexShrink: 0,
        }}
      >
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />

        {/* Image preview strip */}
        {attachedImages.length > 0 && (
          <div style={{
            display: "flex", gap: "8px", padding: "0 0 8px", overflowX: "auto",
            scrollbarWidth: "none",
          }}>
            {attachedImages.map((img, i) => (
              <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={img.preview}
                  alt="preview"
                  style={{
                    width: "64px", height: "64px", objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid rgba(167,139,250,0.2)",
                  }}
                />
                <button
                  onClick={() => removeImage(i)}
                  style={{
                    position: "absolute", top: "-6px", right: "-6px",
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: "rgba(239,68,68,0.9)", border: "none",
                    color: "white", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            position: "relative",
            borderRadius: "18px",
            padding: "1px",
            background: focused || input.trim()
              ? "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(167,139,250,0.2))"
              : "linear-gradient(135deg, rgba(167,139,250,0.1), rgba(167,139,250,0.05))",
            transition: "background 0.25s",
            boxShadow: focused && input.trim()
              ? "0 0 20px rgba(245,158,11,0.12)"
              : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              background: "rgba(8,5,22,0.96)",
              borderRadius: "17px",
              overflow: "hidden",
            }}
          >
            {/* Action icons — upload, camera, sparkle */}
            <div
              style={{
                padding: "8px 2px 8px 8px",
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                flexShrink: 0,
                paddingBottom: "10px",
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: attachedImages.length > 0 ? "rgba(245,158,11,0.6)" : "rgba(167,139,250,0.3)",
                  padding: "3px", display: "flex", transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(245,158,11,0.7)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = attachedImages.length > 0 ? "rgba(245,158,11,0.6)" : "rgba(167,139,250,0.3)"; }}
              >
                <Paperclip size={14} />
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                title="Take photo"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(167,139,250,0.3)",
                  padding: "3px", display: "flex", transition: "color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(245,158,11,0.7)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(167,139,250,0.3)"; }}
              >
                <Camera size={14} />
              </button>
              <div style={{
                color: input.trim() ? "rgba(245,158,11,0.5)" : "rgba(167,139,250,0.25)",
                padding: "3px", display: "flex", transition: "color 0.2s",
              }}>
                <Sparkles size={13} />
              </div>
            </div>

            <textarea
              ref={textareaRef}
              style={{
                flex: 1,
                color: "white",
                background: "transparent",
                border: "none",
                padding: "11px 8px 11px 6px",
                fontSize: "13.5px",
                lineHeight: "1.55",
                resize: "none",
                maxHeight: "8rem",
                outline: "none",
                fontFamily: "inherit",
              }}
              rows={1}
              placeholder={`Ask Solar about ${planetName}…`}
              value={input}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
              }}
              onPaste={(e) => {
                const items = e.clipboardData.items;
                const imageFiles: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith("image/")) {
                    const file = items[i].getAsFile();
                    if (file) imageFiles.push(file);
                  }
                }
                if (imageFiles.length > 0) {
                  e.preventDefault();
                  const dt = new DataTransfer();
                  imageFiles.forEach((f) => dt.items.add(f));
                  handleFiles(dt.files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={send}
              disabled={(!input.trim() && attachedImages.length === 0) || loading}
              style={{
                background: (input.trim() || attachedImages.length > 0) && !loading
                  ? "linear-gradient(135deg, #f59e0b, #f97316)"
                  : "transparent",
                border: "none",
                borderRadius: "14px",
                margin: "6px",
                padding: "8px 10px",
                cursor: (input.trim() || attachedImages.length > 0) && !loading ? "pointer" : "not-allowed",
                color: (input.trim() || attachedImages.length > 0) && !loading ? "#0a0508" : "rgba(245,158,11,0.2)",
                transition: "all 0.2s",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: (input.trim() || attachedImages.length > 0) && !loading
                  ? "0 0 16px rgba(245,158,11,0.45)"
                  : "none",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <p
          style={{
            fontSize: "9px",
            color: "rgba(255,255,255,0.12)",
            textAlign: "center",
            marginTop: "7px",
            letterSpacing: "0.06em",
          }}
        >
          ENTER TO SEND · SHIFT+ENTER FOR NEWLINE · 📎 UP TO 5 IMAGES
        </p>
      </div>
    </div>
  );
}

// ── Solar avatar component ──────────────────────────────────────
function SolarAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 32%, #fff9c4, #f59e0b 55%, #d06010)",
        boxShadow: `0 0 ${pulse ? "18px" : "10px"} rgba(245,158,11,${pulse ? "0.55" : "0.38"}), 0 0 ${pulse ? "32px" : "18px"} rgba(245,158,11,${pulse ? "0.22" : "0.12"})`,
        flexShrink: 0,
        marginTop: "2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        animation: pulse ? "sun-pulse 2s ease-in-out infinite" : undefined,
      }}
    >
      ☀
    </div>
  );
}
