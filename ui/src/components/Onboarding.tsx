import { useEffect, useState } from "react";
import { BASE_URL } from "../api/agent";

interface Props {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const SUN_STYLE: React.CSSProperties = {
  fontSize: "4rem",
  filter: "drop-shadow(0 0 24px rgba(245,158,11,0.7)) drop-shadow(0 0 60px rgba(245,158,11,0.3))",
  animation: "sun-pulse 3s ease-in-out infinite",
  display: "block",
  textAlign: "center",
  lineHeight: 1,
};

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "#07070f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const CARD_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  background: "rgba(12, 10, 24, 0.97)",
  border: "1px solid rgba(167,139,250,0.14)",
  borderRadius: "20px",
  padding: "48px 40px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0px",
  boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.04)",
  position: "relative",
  overflow: "hidden",
};

const HEADLINE_STYLE: React.CSSProperties = {
  color: "white",
  fontSize: "22px",
  fontWeight: 700,
  textAlign: "center",
  margin: "0",
  letterSpacing: "-0.01em",
};

const SUBTITLE_STYLE: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "13px",
  textAlign: "center",
  margin: "0",
  lineHeight: "1.6",
};

const PRIMARY_BTN_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "13px 24px",
  background: "linear-gradient(135deg, rgba(167,139,250,0.9) 0%, rgba(139,92,246,0.9) 100%)",
  border: "1px solid rgba(167,139,250,0.4)",
  borderRadius: "12px",
  color: "white",
  fontSize: "14px",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  letterSpacing: "0.01em",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
};

const PRIMARY_BTN_DISABLED_STYLE: React.CSSProperties = {
  ...PRIMARY_BTN_STYLE,
  opacity: 0.35,
  cursor: "not-allowed",
  boxShadow: "none",
};

const STEP_DOT_STYLE = (active: boolean): React.CSSProperties => ({
  width: active ? "20px" : "6px",
  height: "6px",
  borderRadius: "3px",
  background: active ? "var(--violet)" : "rgba(167,139,250,0.25)",
  transition: "all 0.3s ease",
});

function StepDots({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "center", marginBottom: "36px" }}>
      {([1, 2, 3] as Step[]).map((s) => (
        <div key={s} style={STEP_DOT_STYLE(s === current)} />
      ))}
    </div>
  );
}

function FadeStep({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

async function saveApiKeyToBackend(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/setup/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [visible, setVisible] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [keyValid, setKeyValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Validate key on change
  useEffect(() => {
    setKeyValid(apiKey.startsWith("sk-ant-") && apiKey.length > 20);
  }, [apiKey]);

  function transitionTo(next: Step) {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 300);
  }

  async function handleSaveKey() {
    if (!keyValid) return;
    setSaving(true);
    setSaveError(null);
    // Persist to backend first — key stays off disk until confirmed
    const saved = await saveApiKeyToBackend(apiKey);
    if (!saved) {
      setSaving(false);
      setSaveError("Could not reach the agent service. Make sure it is running and try again.");
      return;
    }
    // Verify the key actually works by hitting /health with it in the header
    try {
      const r = await fetch(`${BASE_URL}/health`, { headers: { "X-Api-Key": apiKey } });
      if (r.status === 401) {
        setSaving(false);
        setSaveError("The API key was rejected. Please check it and try again.");
        return;
      }
    } catch {
      // If /health is unreachable we already confirmed the key saved — proceed
    }
    // Only persist to sessionStorage after backend confirms the key
    sessionStorage.setItem("solar_api_key", apiKey);
    setSaving(false);
    transitionTo(3);
  }

  function handleComplete() {
    localStorage.setItem("solar_onboarded", "true");
    onComplete();
  }

  return (
    <div style={OVERLAY_STYLE}>
      {/* Background nebula glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(167,139,250,0.06) 0%, transparent 70%), " +
            "radial-gradient(ellipse 40% 60% at 20% 20%, rgba(245,158,11,0.03) 0%, transparent 70%)",
        }}
      />

      <div style={CARD_STYLE}>
        {/* Subtle top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)",
          }}
        />

        <StepDots current={step} />

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <FadeStep visible={visible}>
            <span style={SUN_STYLE}>☀</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", textAlign: "center", marginTop: "8px" }}>
              <h1 style={HEADLINE_STYLE}>Welcome to Solar AI OS</h1>
              <p style={SUBTITLE_STYLE}>Your personal AI, at the center of everything.</p>
            </div>
            <div style={{ width: "100%", marginTop: "12px" }}>
              <button
                style={PRIMARY_BTN_STYLE}
                onClick={() => transitionTo(2)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(139,92,246,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(139,92,246,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                Get Started →
              </button>
            </div>
          </FadeStep>
        )}

        {/* Step 2 — API Key Setup */}
        {step === 2 && (
          <FadeStep visible={visible}>
            <span style={{ fontSize: "2.4rem", filter: "drop-shadow(0 0 14px rgba(167,139,250,0.6))" }}>🔑</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", textAlign: "center", marginTop: "4px" }}>
              <h2 style={{ ...HEADLINE_STYLE, fontSize: "19px" }}>Connect Your AI Brain</h2>
              <p style={{ ...SUBTITLE_STYLE, fontSize: "12px" }}>
                Solar AI uses Claude by Anthropic. You'll need an API key — it takes 30 seconds to get one.
              </p>
            </div>

            {/* URL hint */}
            <div
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.14)",
                borderRadius: "10px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Get your free API key at{" "}
                <span
                  style={{
                    color: "var(--violet)",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    userSelect: "all",
                  }}
                >
                  console.anthropic.com
                </span>
              </p>
            </div>

            {/* Input */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Anthropic API Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  autoFocus
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && keyValid) void handleSaveKey();
                  }}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${
                      apiKey.length > 0
                        ? keyValid
                          ? "rgba(34,197,94,0.5)"
                          : "rgba(239,68,68,0.4)"
                        : "rgba(167,139,250,0.2)"
                    }`,
                    borderRadius: "10px",
                    padding: "11px 40px 11px 14px",
                    color: "white",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                />
                {/* Checkmark indicator */}
                {keyValid && (
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#4ade80",
                      fontSize: "14px",
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                )}
                {apiKey.length > 0 && !keyValid && (
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#f87171",
                      fontSize: "14px",
                      lineHeight: 1,
                    }}
                  >
                    ✗
                  </span>
                )}
              </div>
              {apiKey.length > 0 && !keyValid && (
                <p style={{ margin: 0, fontSize: "11px", color: "#fca5a5" }}>
                  Key must start with "sk-ant-" and be longer than 20 characters
                </p>
              )}
            </div>

            <div style={{ width: "100%", marginTop: "4px" }}>
              <button
                style={keyValid && !saving ? PRIMARY_BTN_STYLE : PRIMARY_BTN_DISABLED_STYLE}
                disabled={!keyValid || saving}
                onClick={() => void handleSaveKey()}
                onMouseEnter={(e) => {
                  if (!keyValid || saving) return;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(139,92,246,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(139,92,246,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                {saving ? "Verifying…" : "Save & Continue →"}
              </button>
              {saveError && (
                <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#fca5a5", textAlign: "center" }}>
                  {saveError}
                </p>
              )}
            </div>
          </FadeStep>
        )}

        {/* Step 3 — You're Ready */}
        {step === 3 && (
          <FadeStep visible={visible}>
            <span style={{ ...SUN_STYLE, fontSize: "5rem" }}>☀</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", textAlign: "center", marginTop: "8px" }}>
              <h2 style={HEADLINE_STYLE}>Your Solar System is Ready</h2>
              <p style={{ ...SUBTITLE_STYLE, fontSize: "12px" }}>
                Create your first planet to get started. Each planet is a project or life area — give it a name and start chatting with your AI.
              </p>
            </div>
            <div style={{ width: "100%", marginTop: "12px" }}>
              <button
                style={PRIMARY_BTN_STYLE}
                onClick={handleComplete}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(139,92,246,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(139,92,246,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                Launch Solar AI OS →
              </button>
            </div>
          </FadeStep>
        )}
      </div>
    </div>
  );
}
