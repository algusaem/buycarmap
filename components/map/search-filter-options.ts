export const FUEL_OPTIONS = [
  { value: "gasoline", labelKey: "gasoline" },
  { value: "gasoil", labelKey: "gasoil" },
  { value: "electric-hybrid", labelKey: "electricHybrid" },
  { value: "hybride", labelKey: "hybrid" },
  { value: "hybride_plugin", labelKey: "hybridPlugin" },
  { value: "lpg", labelKey: "lpg" },
  { value: "cng", labelKey: "cng" },
] as const;

export const TRANSMISSION_OPTIONS = [
  { value: "manual", labelKey: "manual" },
  { value: "automatic", labelKey: "automatic" },
  { value: "semiautomatic", labelKey: "semiautomatic" },
] as const;

export const BRANDS = [
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "BMW",
  "Citro\u00ebn",
  "Cupra",
  "Dacia",
  "DS",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Porsche",
  "Renault",
  "Seat",
  "Skoda",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

export const SELECT_ANY = "__any__";

export const TIME_FILTER_OPTIONS = [
  { value: "today", labelKey: "today" },
  { value: "lastWeek", labelKey: "lastWeek" },
  { value: "lastMonth", labelKey: "lastMonth" },
] as const;
