import React, { useEffect, useRef } from "react";

interface Props {
  active: boolean;
  onComplete: () => void;
}

const KEYFRAMES = `
@keyframes flicker {
  0%   { transform: scaleY(1)   scaleX(1);   opacity: 1;   }
  25%  { transform: scaleY(1.2) scaleX(0.85); opacity: 0.9; }
  50%  { transform: scaleY(0.9) scaleX(1.1);  opacity: 1;   }
  75%  { transform: scaleY(1.3) scaleX(0.9);  opacity: 0.85;}
  100% { transform: scaleY(1)   scaleX(1);   opacity: 1;   }
}

@keyframes exhaustFade {
  0%   { opacity: 0.5; transform: translateY(0)   scale(1);   }
  100% { opacity: 0;   transform: translateY(30px) scale(1.8); }
}

@keyframes launch {
  0%   { transform: translateX(-50%) translateY(0);       opacity: 1; }
  100% { transform: translateX(-50%) translateY(-110vh);  opacity: 0.4; }
}
`;

const RocketLaunch: React.FC<Props> = ({ active, onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 3500);

    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  const launchAnimation: React.CSSProperties = {
    animation: "launch 2s ease-in forwards",
    animationDelay: "500ms",
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          ...launchAnimation,
        }}
      >
        {/* Exhaust trail circles */}
        <div style={{ position: "relative", width: "60px", height: "0px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                bottom: `-${20 + i * 18}px`,
                left: "50%",
                transform: "translateX(-50%)",
                width: `${14 - i * 3}px`,
                height: `${14 - i * 3}px`,
                borderRadius: "50%",
                background: `rgba(180, 180, 255, ${0.35 - i * 0.1})`,
                animation: `exhaustFade ${0.6 + i * 0.15}s ease-out infinite`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>

        {/* SVG Rocket */}
        <svg
          width="60"
          height="120"
          viewBox="0 0 60 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c8d6e5" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a8b8cc" />
            </linearGradient>
            <linearGradient id="noseGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#d0dce8" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#b0c0d4" />
            </linearGradient>
            <linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="30%" stopColor="#ffdd44" />
              <stop offset="65%" stopColor="#ff6600" />
              <stop offset="100%" stopColor="#cc2200" stopOpacity="0.6" />
            </linearGradient>
            <radialGradient id="windowGrad" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#aaddff" />
              <stop offset="100%" stopColor="#2266aa" />
            </radialGradient>
          </defs>

          {/* Left fin */}
          <polygon
            points="12,90 0,108 18,100"
            fill="#8899bb"
            opacity="0.9"
          />

          {/* Right fin */}
          <polygon
            points="48,90 60,108 42,100"
            fill="#8899bb"
            opacity="0.9"
          />

          {/* Rocket body */}
          <rect
            x="15"
            y="30"
            width="30"
            height="75"
            rx="6"
            ry="6"
            fill="url(#bodyGrad)"
          />

          {/* Body accent stripe */}
          <rect
            x="15"
            y="72"
            width="30"
            height="6"
            rx="1"
            fill="#5577aa"
            opacity="0.4"
          />

          {/* Nose cone */}
          <path
            d="M30 2 L15 30 L45 30 Z"
            fill="url(#noseGrad)"
          />

          {/* Nose cone outline */}
          <path
            d="M30 2 L15 30 L45 30 Z"
            fill="none"
            stroke="#aabbcc"
            strokeWidth="0.5"
            opacity="0.6"
          />

          {/* Window */}
          <circle cx="30" cy="52" r="8" fill="url(#windowGrad)" />
          <circle
            cx="30"
            cy="52"
            r="8"
            fill="none"
            stroke="#99bbdd"
            strokeWidth="1.5"
          />
          {/* Window reflection */}
          <ellipse
            cx="27"
            cy="49"
            rx="3"
            ry="2"
            fill="white"
            opacity="0.35"
            transform="rotate(-20 27 49)"
          />

          {/* Body panel lines */}
          <line
            x1="15"
            y1="62"
            x2="45"
            y2="62"
            stroke="#99aacc"
            strokeWidth="0.5"
            opacity="0.5"
          />
          <line
            x1="15"
            y1="82"
            x2="45"
            y2="82"
            stroke="#99aacc"
            strokeWidth="0.5"
            opacity="0.5"
          />

          {/* Engine nozzle */}
          <rect
            x="20"
            y="103"
            width="20"
            height="6"
            rx="2"
            fill="#556677"
          />

          {/* Flame */}
          <g
            style={{
              transformOrigin: "30px 109px",
              animation: "flicker 0.12s ease-in-out infinite",
            }}
          >
            <polygon
              points="22,109 38,109 30,130"
              fill="url(#flameGrad)"
              opacity="0.95"
            />
            {/* Inner bright flame core */}
            <polygon
              points="26,109 34,109 30,120"
              fill="white"
              opacity="0.7"
            />
          </g>
        </svg>
      </div>
    </>
  );
};

export default RocketLaunch;
