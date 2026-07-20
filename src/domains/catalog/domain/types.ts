export const CATALOG_CHANNELS = ["pos", "kiosk", "preorder"] as const;
export type CatalogChannel = (typeof CATALOG_CHANNELS)[number];
export type ProductStatus = "draft" | "published" | "inactive";

export type Category = Readonly<{
  categoryId: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type ProductDraft = Readonly<{
  displayName: string | null;
  posName: string | null;
  sellingPrice: number | null;
  description: string | null;
  channels: readonly CatalogChannel[];
  updatedAt: string;
}>;

export type ProductVersion = Readonly<{
  productVersionId: string;
  versionNumber: number;
  displayName: string;
  posName: string;
  sellingPrice: number;
  description: string | null;
  publishedAt: string | null;
  channels: readonly CatalogChannel[];
}>;

export type CatalogProduct = Readonly<{
  productId: string;
  internalName: string;
  categoryId: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  draft: ProductDraft;
  versions: readonly ProductVersion[];
}>;
