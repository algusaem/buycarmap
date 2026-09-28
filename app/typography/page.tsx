export default function TypographyPage() {
  return (
    <div className="flex-1 bg-background p-8 md:p-12">
      <div className="mx-auto max-w-4xl space-y-16">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Typography System
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground md:text-6xl">
            Plus Jakarta Sans
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A professional, geometric sans-serif that conveys trust and confidence. Clean and modern
            without being cold.
          </p>
        </div>

        {/* Font showcase */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Plus Jakarta Sans */}
          <div className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                Primary Font
              </p>
              <h2 className="text-2xl font-bold text-foreground">Plus Jakarta Sans</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Used for all text — headlines, body copy, UI elements. Weight variations create
              hierarchy without needing multiple font families.
            </p>
            <div className="space-y-3 border-t border-border pt-6">
              <p className="text-4xl font-extrabold text-foreground">BuyCarMap</p>
              <p className="text-2xl font-bold text-foreground">Find Your Next Car</p>
              <p className="text-xl font-semibold text-muted-foreground">Discover deals near you</p>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <span className="rounded bg-secondary px-2 py-1 text-sm font-light">Light 300</span>
              <span className="rounded bg-secondary px-2 py-1 text-sm">Regular 400</span>
              <span className="rounded bg-secondary px-2 py-1 text-sm font-medium">Medium 500</span>
              <span className="rounded bg-secondary px-2 py-1 text-sm font-semibold">
                Semibold 600
              </span>
              <span className="rounded bg-secondary px-2 py-1 text-sm font-bold">Bold 700</span>
              <span className="rounded bg-secondary px-2 py-1 text-sm font-extrabold">
                ExtraBold 800
              </span>
            </div>
          </div>

          {/* JetBrains Mono */}
          <div className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-primary">
                Monospace Font
              </p>
              <h2 className="text-2xl font-bold text-foreground">JetBrains Mono</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Used for prices, mileage, IDs, and other numerical data. Increased height improves
              readability of important figures.
            </p>
            <div className="flex flex-wrap gap-4 border-t border-border pt-6">
              <div className="rounded-lg bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Price</p>
                <p className="font-mono text-2xl font-medium text-primary">€14,500</p>
              </div>
              <div className="rounded-lg bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Mileage</p>
                <p className="font-mono text-2xl font-medium text-foreground">45,230 km</p>
              </div>
              <div className="rounded-lg bg-background p-4">
                <p className="mb-1 text-xs text-muted-foreground">Listing ID</p>
                <p className="font-mono text-lg text-muted-foreground">#WLP-2847291</p>
              </div>
            </div>
          </div>
        </div>

        {/* Type scale */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Type Scale</h2>
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                7xl / 800
              </span>
              <p className="text-7xl font-extrabold tracking-tight text-foreground">Hero</p>
            </div>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                5xl / 800
              </span>
              <p className="text-5xl font-extrabold tracking-tight text-foreground">Page Title</p>
            </div>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                3xl / 700
              </span>
              <p className="text-3xl font-bold text-foreground">Section Heading</p>
            </div>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                xl / 600
              </span>
              <p className="text-xl font-semibold text-foreground">Card Title</p>
            </div>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                base / 400
              </span>
              <p className="text-base text-foreground">Body text for descriptions and content</p>
            </div>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                sm / 400
              </span>
              <p className="text-sm text-muted-foreground">Secondary text, metadata, and labels</p>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                xs / 400
              </span>
              <p className="text-xs text-muted-foreground">Captions, timestamps, fine print</p>
            </div>
          </div>
        </div>

        {/* Example card */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">In Context</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-video bg-linear-to-br from-secondary to-background" />
            <div className="p-6">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">2019 Volkswagen Golf</h3>
                  <p className="text-sm text-muted-foreground">Madrid · Wallapop</p>
                </div>
                <p className="font-mono text-xl font-medium text-primary">€14,500</p>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <span className="font-mono">45,230 km</span>
                <span>·</span>
                <span>Diesel</span>
                <span>·</span>
                <span>Manual</span>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                  Good Price
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Price Dropped
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
