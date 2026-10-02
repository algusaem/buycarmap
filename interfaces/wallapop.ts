interface WallapopImageUrls {
  small: string;
  medium: string;
  big: string;
}

interface WallapopItemImage {
  id: string;
  average_color: string;
  urls: WallapopImageUrls;
}

interface WallapopItemLocation {
  latitude: number;
  longitude: number;
  postal_code: string;
  city: string;
  region: string;
  country_code: string;
}

interface WallapopItemPrice {
  amount: number;
  currency: string;
}

interface WallapopFlagValue {
  flag: boolean;
}

interface WallapopTypeAttributes {
  brand?: string;
  model?: string;
  year?: number;
  version?: string;
  km?: number;
  engine?: string;
  horsepower?: number;
}

export interface WallapopItem {
  id: string;
  title: string;
  description: string;
  category_id: number;
  price: WallapopItemPrice;
  images: WallapopItemImage[];
  location: WallapopItemLocation;
  reserved: WallapopFlagValue;
  shipping: { item_is_shippable: boolean; user_allows_shipping: boolean };
  favorited: WallapopFlagValue;
  web_slug: string;
  created_at: number;
  modified_at: number;
  type_attributes: WallapopTypeAttributes;
}

interface WallapopSearchSection {
  type: string;
  title: string;
  items: WallapopItem[];
}

interface WallapopSearchData {
  section: WallapopSearchSection;
}

interface WallapopSearchMeta {
  next_page: string | null;
}

export interface WallapopSearchResponse {
  data: WallapopSearchData;
  meta: WallapopSearchMeta;
}

interface WallapopFilterOption {
  id: string;
  title: string;
}

export interface WallapopFilterResponse {
  type: string;
  id: string;
  title: string;
  options: WallapopFilterOption[];
}
