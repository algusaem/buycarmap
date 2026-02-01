import { HeroBackground } from "./HeroBackground";
import { HeroContent } from "./HeroContent";

export function Hero() {
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <HeroBackground />

      {/* Main content - centered */}
      <div className="relative flex flex-1 items-center justify-center py-20">
        <HeroContent />
      </div>

      {/* Bottom fade to next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-card to-transparent" />
    </section>
  );
}
