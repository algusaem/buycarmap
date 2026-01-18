import { MapPin } from "lucide-react";

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-background to-card" />

      {/* Minimalist street map pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Street grid pattern */}
          <pattern
            id="streets"
            width="200"
            height="200"
            patternUnits="userSpaceOnUse"
          >
            {/* Main roads */}
            <line
              x1="100"
              y1="0"
              x2="100"
              y2="200"
              stroke="currentColor"
              strokeWidth="3"
            />
            <line
              x1="0"
              y1="100"
              x2="200"
              y2="100"
              stroke="currentColor"
              strokeWidth="3"
            />

            {/* Secondary roads */}
            <line
              x1="50"
              y1="0"
              x2="50"
              y2="200"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="150"
              y1="0"
              x2="150"
              y2="200"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="50"
              x2="200"
              y2="50"
              stroke="currentColor"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="150"
              x2="200"
              y2="150"
              stroke="currentColor"
              strokeWidth="1"
            />

            {/* Diagonal avenue */}
            <line
              x1="0"
              y1="0"
              x2="200"
              y2="200"
              stroke="currentColor"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#streets)" />
      </svg>

      {/* Subtle location markers */}
      <div className="absolute left-[20%] top-[30%] text-primary/25">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="absolute left-[70%] top-[25%] text-primary/20">
        <MapPin className="h-3 w-3" />
      </div>
      <div className="absolute left-[35%] top-[65%] text-accent/20">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="absolute left-[80%] top-[55%] text-primary/15">
        <MapPin className="h-3 w-3" />
      </div>
      <div className="absolute left-[15%] top-[70%] text-accent/15">
        <MapPin className="h-3 w-3" />
      </div>

      {/* Gradient orbs for warmth */}
      <div className="absolute -left-40 top-20 h-125 w-125 rounded-full bg-primary/4 blur-[120px]" />
      <div className="absolute -right-40 bottom-20 h-100 w-100 rounded-full bg-accent/3 blur-[100px]" />
    </div>
  );
}
