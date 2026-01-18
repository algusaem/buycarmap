"use client";

import { useState } from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const stats = [
  { value: "50K+", label: "Active listings" },
  { value: "12", label: "Platforms" },
  { value: "100%", label: "Free to use" },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function HeroContent() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <motion.div
      className="relative z-10 mx-auto max-w-4xl px-4 text-center"
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.1 }}
    >
      {/* Main headline */}
      <motion.h1
        className="mb-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
        variants={fadeInUp}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        Find your next car
        <br />
        <span className="text-primary">on the map</span>
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        variants={fadeInUp}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      >
        Search thousands of second-hand cars from Wallapop, Milanuncios,
        Coches.net and more — all in one place, visualized on an interactive
        map.
      </motion.p>

      {/* Search bar */}
      <motion.div
        className="mx-auto mb-8 max-w-xl"
        variants={fadeInUp}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      >
        <div className="flex gap-2 rounded-xl border border-border/50 bg-card/80 p-2 shadow-lg backdrop-blur-sm transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search make, model, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
            />
          </div>
          <Button size="lg" className="gap-2 px-6">
            <span className="hidden sm:inline">Search</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick filters */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Popular:</span>
          {["Golf", "Seat León", "BMW Serie 3", "Audi A4"].map((term, i) => (
            <motion.button
              key={term}
              onClick={() => setSearchQuery(term)}
              className="rounded-full border border-border/50 bg-card/50 px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {term}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* CTA buttons */}
      <motion.div
        className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
        variants={fadeInUp}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
      >
        <Button variant="outline" size="lg" className="gap-2" asChild>
          <Link href="/map">
            <MapPin className="h-4 w-4" />
            Explore the map
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">or</span>
        <Link
          href="/login"
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Sign in to save searches →
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="flex items-center justify-center gap-8 sm:gap-12"
        variants={fadeInUp}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="font-mono text-2xl font-semibold text-foreground sm:text-3xl">
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
