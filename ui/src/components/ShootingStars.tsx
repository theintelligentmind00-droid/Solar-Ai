import React from "react";

interface StarConfig {
  top: string;
  left: string;
  width: string;
  opacity: number;
  angle: number;
  duration: string;
  delay: string;
}

const STARS: StarConfig[] = [
  { top: "5%",  left: "10%", width: "140px", opacity: 0.7, angle: -38, duration: "4.5s", delay: "2s"  },
  { top: "15%", left: "55%", width: "90px",  opacity: 0.5, angle: -35, duration: "5.5s", delay: "28s" },
  { top: "30%", left: "25%", width: "160px", opacity: 0.65,angle: -40, duration: "4.0s", delay: "55s" },
  { top: "8%",  left: "75%", width: "110px", opacity: 0.45,angle: -33, duration: "6.0s", delay: "80s" },
  { top: "45%", left: "5%",  width: "130px", opacity: 0.55,angle: -37, duration: "5.0s", delay: "42s" },
  { top: "3%",  left: "88%", width: "80px",  opacity: 0.6, angle: -34, duration: "4.8s", delay: "105s"},
];

const KEYFRAMES = `
@keyframes shootingStar {
  0%   { transform: translateX(-200px) translateY(-200px); opacity: 0; }
  5%   { opacity: 1; }
  80%  { opacity: 0.6; }
  100% { transform: translateX(900px) translateY(900px); opacity: 0; }
}
`;

const ShootingStars: React.FC = () => {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {STARS.map((star, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: star.top,
              left: star.left,
              width: star.width,
              height: "2px",
              background:
                "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)",
              opacity: star.opacity,
              transform: `rotate(${star.angle}deg)`,
              animation: `shootingStar ${star.duration} ease-in infinite`,
              animationDelay: star.delay,
              borderRadius: "1px",
            }}
          />
        ))}
      </div>
    </>
  );
};

export default ShootingStars;
