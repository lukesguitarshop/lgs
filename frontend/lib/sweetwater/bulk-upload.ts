import { toCsv, type CsvCell } from './csv';
import { MAX_IMAGES, type ExportRow } from './derive';

/**
 * Column order from Sweetwater's GX_Mass_Upload.csv template. Order is
 * significant -- the importer reads positionally.
 */
export const BULK_UPLOAD_COLUMNS = [
  'title',
  'brand',
  'top_category',
  'sub_category',
  'handedness',
  'condition',
  'decade',
  'year',
  'Item_ID',
  'serial',
  'sku',
  'mpn',
  'description',
  'video',
  'price',
  'offers_enabled',
  'sale_optin',
  'sale_percent',
  'delivery_method',
  'shipping_price',
  ...Array.from({ length: MAX_IMAGES }, (_, i) => `product_image_${i + 1}`),
] as const;

/** Applied to every exported row; adjust here rather than per listing. */
export const ROW_DEFAULTS = {
  offers_enabled: 'TRUE',
  sale_optin: 'FALSE',
  sale_percent: 10,
  delivery_method: 'Shipping and Local Pickup',
  shipping_price: 0,
} as const;

export function buildBulkUploadCsv(rows: ExportRow[]): string {
  const images = (row: ExportRow) =>
    Array.from({ length: MAX_IMAGES }, (_, i) => row.images[i] ?? '');

  const body: CsvCell[][] = rows.map(row => [
    row.title,
    row.brand,
    row.topCategory,
    row.subCategory,
    '', // handedness -- Sweetwater defaults to Right
    row.condition,
    row.decade,
    row.year,
    '', // Item_ID
    '', // serial
    '', // sku
    '', // mpn
    row.description,
    '', // video
    Math.round(row.price),
    ROW_DEFAULTS.offers_enabled,
    ROW_DEFAULTS.sale_optin,
    ROW_DEFAULTS.sale_percent,
    ROW_DEFAULTS.delivery_method,
    ROW_DEFAULTS.shipping_price,
    ...images(row),
  ]);

  return toCsv([[...BULK_UPLOAD_COLUMNS], ...body]);
}
