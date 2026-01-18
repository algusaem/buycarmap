"use client";

import * as motion from "motion/react-client";
import { MapPin } from "lucide-react";

interface BrandHeaderProps {
  tagline?: string;
}

export function BrandHeader({
  tagline = "Find your next car on the map",
}: BrandHeaderProps) {
  return (
    <motion.div
      className="space-y-2 text-center"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="mb-6 flex items-center justify-center gap-3">
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <MapPin className="h-6 w-6 text-primary" />
        </motion.div>
        <motion.h1
          className="text-3xl font-bold tracking-tight text-foreground"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          BuyCarMap
        </motion.h1>
      </div>
      <motion.p
        className="text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        {tagline}
      </motion.p>
    </motion.div>
  );
}
