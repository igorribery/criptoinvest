export const ALLOWED_ASSET_TYPES = ["CRYPTO", "STOCK", "ETF"] as const;

export type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

export type CreatePortfolioEntryType = {
    assetType?: AssetType;
    symbol?: string;
    assetName?: string;
    purchaseDate?: string;
    quantity?: number;
    unitPriceBrl?: number;
    otherCostsBrl?: number;
    totalValueBrl?: number;
  };