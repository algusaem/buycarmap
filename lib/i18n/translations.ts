export type { Translations } from "./types";

import { en } from "./locales/en";
import { es } from "./locales/es";

export const translations = { en, es } as const;
