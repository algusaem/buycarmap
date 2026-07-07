export interface CochesNetImage {
  type: string;
  url: string;
}

export interface CochesNetLocation {
  provinceIds: number[];
  regionId: number;
  regionLiteral: string;
  mainProvince: string;
  mainProvinceId: number;
  cityId: number;
  cityLiteral: string;
}

export interface CochesNetPrice {
  amount: number;
  hasTaxes: boolean;
}

export interface CochesNetItem {
  id: string;
  title: string;
  url: string;
  price: CochesNetPrice;
  km: number;
  year: number;
  hp: number;
  make: string;
  makeId: number;
  model: string;
  modelId: number;
  fuelType: string;
  fuelTypeId: number;
  transmissionTypeId: number;
  resources: CochesNetImage[];
  location: CochesNetLocation;
  isProfessional: boolean;
}

export interface CochesNetMeta {
  totalPages: number;
  totalResults: number;
}

export interface CochesNetSearchResponse {
  items: CochesNetItem[];
  paidItems: CochesNetItem[];
  meta: CochesNetMeta;
}

export interface CochesNetTaxonomyOption {
  id: number;
  label: string;
}

export interface CochesNetTaxonomyResponse {
  items: CochesNetTaxonomyOption[];
}
