import {
  WallapopItem,
  WallapopSearchResponse,
} from "@/interfaces/wallapop";

// A fully-populated, non-reserved Wallapop car item. Tests override only the
// fields they care about so each fixture reads as "the normal case, except…".
export function makeWallapopItem(
  overrides: Partial<WallapopItem> = {},
): WallapopItem {
  return {
    id: "abc123",
    title: "Audi A3 2.0 TDI",
    description: "Great condition, full service history, one owner from new",
    category_id: 100,
    price: { amount: 14500, currency: "EUR" },
    images: [
      {
        id: "img1",
        average_color: "#333",
        urls: {
          small: "https://cdn.wallapop.com/img1-small.jpg",
          medium: "https://cdn.wallapop.com/img1-medium.jpg",
          big: "https://cdn.wallapop.com/img1-big.jpg",
        },
      },
    ],
    location: {
      latitude: 40.4168,
      longitude: -3.7038,
      postal_code: "28001",
      city: "Madrid",
      region: "Madrid",
      country_code: "ES",
    },
    reserved: { flag: false },
    shipping: { item_is_shippable: false, user_allows_shipping: false },
    favorited: { flag: false },
    web_slug: "audi-a3-2-0-tdi-abc123",
    created_at: 1_700_000_000_000,
    modified_at: 1_700_000_000_000,
    type_attributes: {
      brand: "Audi",
      model: "A3",
      year: 2018,
      version: "2.0 TDI",
      km: 95_000,
      engine: "gasoil",
      horsepower: 150,
    },
    ...overrides,
  };
}

export function makeWallapopResponse(
  items: WallapopItem[],
  nextPage: string | null = null,
): WallapopSearchResponse {
  return {
    data: { section: { type: "cars", title: "Cars", items } },
    meta: { next_page: nextPage },
  };
}
