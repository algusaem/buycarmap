import { HeroBackground } from "./HeroBackground";
import { HeroContent } from "./HeroContent";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      <HeroBackground />

      {/* Main content - centered */}
      <div className="relative flex min-h-screen items-center justify-center py-20">
        <HeroContent />
      </div>

      {/* Bottom fade to next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-card to-transparent" />
    </section>
  );
}
