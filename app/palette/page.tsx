export default function PalettePage() {
  const colors = [
    {
      name: "Background",
      variable: "bg-background",
      hex: "#0F1419",
      description: "Deep ink - app background",
    },
    {
      name: "Card",
      variable: "bg-card",
      hex: "#1C2128",
      description: "Elevated surfaces",
    },
    {
      name: "Popover",
      variable: "bg-popover",
      hex: "#262D36",
      description: "Panels, dropdowns",
    },
    {
      name: "Primary",
      variable: "bg-primary",
      hex: "#E8A849",
      description: "Amber gold - CTAs, highlights",
    },
    {
      name: "Accent",
      variable: "bg-accent",
      hex: "#3B9B6D",
      description: "Eucalyptus - success, available",
    },
    {
      name: "Destructive",
      variable: "bg-destructive",
      hex: "#D94F4F",
      description: "Muted red - alerts, urgency",
    },
    {
      name: "Border",
      variable: "bg-border",
      hex: "#30363D",
      description: "Structure, dividers",
    },
    {
      name: "Muted",
      variable: "bg-muted",
      hex: "#262D36",
      description: "Subtle backgrounds",
    },
  ];

  const textColors = [
    {
      name: "Foreground",
      variable: "text-foreground",
      hex: "#E6EDF3",
      description: "Primary text",
    },
    {
      name: "Muted Foreground",
      variable: "text-muted-foreground",
      hex: "#8B949E",
      description: "Secondary text, metadata",
    },
    {
      name: "Primary Foreground",
      variable: "text-primary-foreground",
      hex: "#0F1419",
      description: "Text on primary",
    },
  ];

  return (
    <div className="flex-1 bg-background p-8 md:p-12">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="space-y-2">
          <h1 className="font-bold text-4xl text-foreground">
            Cartographic Modern
          </h1>
          <p className="text-muted-foreground">
            Color palette for BuyCarMap - inspired by night maps and discovery
          </p>
        </div>

        {/* Main colors */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">
            Surface & Accent Colors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {colors.map((color) => (
              <div
                key={color.name}
                className="overflow-hidden rounded-xl border border-border"
              >
                <div className={`h-24 ${color.variable}`} />
                <div className="space-y-1 bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {color.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {color.hex}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {color.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Text colors */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Text Colors</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {textColors.map((color) => (
              <div
                key={color.name}
                className="overflow-hidden rounded-xl border border-border bg-card p-4"
              >
                <p className={`text-2xl font-medium ${color.variable}`}>Aa</p>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {color.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {color.hex}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {color.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Usage examples */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Usage Examples</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card example */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 ring-1 ring-primary/20" />
                <div>
                  <p className="font-medium text-foreground">Card Title</p>
                  <p className="text-sm text-muted-foreground">
                    Secondary information
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
                  Primary
                </span>
                <span className="rounded-md bg-accent px-3 py-1 text-sm text-accent-foreground">
                  Available
                </span>
                <span className="rounded-md bg-destructive px-3 py-1 text-sm text-white">
                  Alert
                </span>
              </div>
            </div>

            {/* Semantic example */}
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="mb-4 font-medium text-foreground">Semantic Usage</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm text-foreground">
                    Primary: Discovery, value, selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent" />
                  <span className="text-sm text-foreground">
                    Accent: Success, available, positive
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm text-foreground">
                    Destructive: Alerts, price drops
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gradient preview */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Atmosphere</h2>
          <div className="relative h-48 overflow-hidden rounded-xl border border-border bg-background">
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">
                Subtle gradient orbs create depth and atmosphere
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
