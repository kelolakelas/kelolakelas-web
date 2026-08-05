import { z } from 'zod';

export const catalogTypeValues = ['private', 'group'] as const;
export const catalogSortValues = ['distance_asc', 'name_asc', 'price_asc', 'price_desc', 'newest'] as const;

const optionalNumber = z.number().finite().optional();

export const catalogFiltersSchema = z.object({
  page: z.number().int().min(1).optional(),
  page_size: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  category_id: z.string().optional(),
  tenant_id: z.string().optional(),
  type: z.enum(catalogTypeValues).optional(),
  min_price: optionalNumber.refine((value) => value === undefined || value >= 0, 'Harga minimum tidak boleh negatif.'),
  max_price: optionalNumber.refine((value) => value === undefined || value >= 0, 'Harga maksimum tidak boleh negatif.'),
  latitude: optionalNumber.refine((value) => value === undefined || (value >= -90 && value <= 90), 'Latitude tidak valid.'),
  longitude: optionalNumber.refine((value) => value === undefined || (value >= -180 && value <= 180), 'Longitude tidak valid.'),
  radius_km: optionalNumber.refine((value) => value === undefined || (value > 0 && value <= 100), 'Radius harus lebih dari 0 dan maksimal 100 km.'),
  sort: z.enum(catalogSortValues).optional(),
}).superRefine((filters, context) => {
  if ((filters.latitude === undefined) !== (filters.longitude === undefined)) {
    context.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude dan longitude harus dikirim bersamaan.' });
  }
  if (filters.min_price !== undefined && filters.max_price !== undefined && filters.min_price > filters.max_price) {
    context.addIssue({ code: 'custom', path: ['min_price'], message: 'Harga minimum tidak boleh lebih besar dari harga maksimum.' });
  }
});

export type CatalogFilters = z.input<typeof catalogFiltersSchema>;

export const enrollmentSchema = z.object({
  class_id: z.string().trim().min(1),
  student_id: z.string().trim().min(1, 'Pilih student terlebih dahulu.'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly']),
});