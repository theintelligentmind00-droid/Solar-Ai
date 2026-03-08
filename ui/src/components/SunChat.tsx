import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Message } from "../api/agent";

interface Props {
  planetId: string;
  planetName: string;
}

export function SunChat({ planetId, planetName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { reply } = await api.chat(planetId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError("Failed to reach Solar. Is the agent service running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-8">
            <div className="text-3xl mb-3">☀</div>
            <p>Chat with Solar about <span className="text-yellow-400">{planetName}</span></p>
            <p className="text-xs mt-1 text-slate-600">Solar remembers this conversation across sessions.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs mr-2 mt-1 shrink-0">☀</div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-slate-800 text-slate-100 rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs mr-2 shrink-0">☀</div>
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-xs text-center bg-red-900/30 rounded-lg px-3 py-2">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-yellow-400 max-h-32"
            rows={1}
            placeholder={`Message Solar about ${planetName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black p-2.5 rounded-xl transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-1.5 text-right">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
