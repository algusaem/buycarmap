import { z } from "zod";

export const searchSchema = z.object({
  keywords: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  distanceInKm: z.number().positive().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  minYear: z.number().int().min(1900).optional(),
  maxYear: z.number().int().optional(),
  minKm: z.number().nonnegative().optional(),
  maxKm: z.number().positive().optional(),
  engine: z.string().optional(),
  gearbox: z.string().optional(),
});

export type SearchInput = z.infer<typeof searchSchema>;
