export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-background">
      {/* Headlight beam 1 - main amber sweep from bottom left */}
      <div
        className="absolute -bottom-[30%] -left-[20%] h-[140%] w-[80%] opacity-[0.07]"
        style={{
          background:
            "conic-gradient(from 45deg at 0% 100%, transparent 0deg, oklch(0.75 0.14 75) 15deg, transparent 35deg)",
          filter: "blur(80px)",
        }}
      />

      {/* Headlight beam 2 - secondary amber from bottom right */}
      <div
        className="absolute -bottom-[20%] -right-[15%] h-[120%] w-[70%] opacity-[0.05]"
        style={{
          background:
            "conic-gradient(from 135deg at 100% 100%, transparent 0deg, oklch(0.75 0.14 75) 12deg, transparent 30deg)",
          filter: "blur(100px)",
        }}
      />

      {/* Subtle accent glow - eucalyptus hint top right */}
      <div
        className="absolute -right-[10%] -top-[20%] h-[50%] w-[40%] opacity-[0.04]"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.62 0.12 160), transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Horizontal scan lines texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
          backgroundSize: "100% 8px",
        }}
      />

      {/* Perspective grid lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1400 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Converging perspective lines */}
        <g className="stroke-foreground/3" fill="none" strokeWidth="1">
          <line x1="700" y1="400" x2="-200" y2="900" />
          <line x1="700" y1="400" x2="100" y2="900" />
          <line x1="700" y1="400" x2="400" y2="900" />
          <line x1="700" y1="400" x2="700" y2="900" />
          <line x1="700" y1="400" x2="1000" y2="900" />
          <line x1="700" y1="400" x2="1300" y2="900" />
          <line x1="700" y1="400" x2="1600" y2="900" />
        </g>

        {/* Horizontal depth lines */}
        <g className="stroke-foreground/2" fill="none" strokeWidth="1">
          <line x1="0" y1="550" x2="1400" y2="550" />
          <line x1="0" y1="650" x2="1400" y2="650" />
          <line x1="0" y1="720" x2="1400" y2="720" />
          <line x1="0" y1="780" x2="1400" y2="780" />
          <line x1="0" y1="830" x2="1400" y2="830" />
          <line x1="0" y1="870" x2="1400" y2="870" />
        </g>
      </svg>

      {/* Horizon line glow */}
      <div
        className="absolute bottom-[15%] left-0 right-0 h-0.5 opacity-[0.06]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, oklch(0.75 0.14 75) 30%, oklch(0.75 0.14 75) 70%, transparent 100%)",
          filter: "blur(8px)",
        }}
      />

      {/* Grain texture */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.025]">
        <filter id="hero-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 0%, var(--background) 100%)",
        }}
      />

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-card to-transparent" />
    </div>
  );
}
