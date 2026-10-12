import { Footer } from "@/components/Footer";
import { Hero } from "@/components/hero/Hero";

export default function Home() {
  // The footer sits outside <main>: a footer scoped to main is not the page's
  // contentinfo landmark.
  return (
    <>
      <main className="flex flex-1 flex-col">
        <Hero />
      </main>
      <Footer />
    </>
  );
}
