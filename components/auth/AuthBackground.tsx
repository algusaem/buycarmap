import { MapPin, Car } from "lucide-react";

export function AuthBackground() {
  return (
    <>
      {/* Topographic grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
            <pattern
              id="grid-large"
              width="200"
              height="200"
              patternUnits="userSpaceOnUse"
            >
              <rect width="200" height="200" fill="url(#grid)" />
              <path
                d="M 200 0 L 0 0 0 200"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-large)" />
        </svg>
      </div>

      {/* Gradient orbs */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />

      {/* Floating decorative markers */}
      <div className="absolute left-[10%] top-[20%] animate-pulse opacity-20">
        <MapPin className="h-8 w-8 text-primary" />
      </div>
      <div
        className="absolute right-[15%] top-[30%] animate-pulse opacity-15"
        style={{ animationDelay: "0.5s" }}
      >
        <MapPin className="h-6 w-6 text-accent" />
      </div>
      <div
        className="absolute bottom-[25%] left-[20%] animate-pulse opacity-10"
        style={{ animationDelay: "1s" }}
      >
        <Car className="h-10 w-10 text-muted-foreground" />
      </div>
    </>
  );
}
