
// Generic product type since columns are dynamic
export interface Product {
  [key: string]: string | number | Record<string, string> | null | undefined;
  id: string; // Generated ID
  _raw: Record<string, string>; // Original raw values
}

// Mapped product with normalized fields for UI
export interface MappedProduct extends Product {
  title: string;
  code: string;     // Added Product Code
  price: number | null;
  image: string;
  category: string;
  description: string;
  brand: string;
  supplier: string;
  matchScore?: number; // Added to track how well this product matched the search term
}

export interface SearchIntent {
  keywords: string[];
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  sentiment?: string;
}

export interface BulkSearchResult {
  term: string;
  originalTerm: string; // The raw input term
  products: MappedProduct[];
  detectedQuantity: number; // Quantity detected from input string
}

// termIndex -> { productId: quantity }
// This allows multiple products to be selected for the same search term
export type QuotationMap = Record<number, Record<string, number>>;

export enum SortOption {
  Relevance = 'relevance',
  PriceLowHigh = 'price_asc',
  PriceHighLow = 'price_desc',
  NameAZ = 'name_asc'
}
