import { z } from 'zod';

const uuid = z.string().uuid();
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid saved date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

export const savedClassSchema = z.object({
  id: uuid, tenant_id: uuid, category_id: uuid, name: z.string(),
  type: z.enum(['group', 'private']), price: z.number().int().nonnegative(),
  created_at: date, teacher_ids: z.array(uuid).optional(),
  is_published: z.boolean(), enrollment_status: z.enum(['open', 'closed', 'full', 'archived']),
}).passthrough();

export const savedScheduleSchema = z.object({
  id: uuid, class_id: uuid, day_of_week: z.number().int().min(1).max(7),
  start_time: time, end_time: time, capacity: z.number().int().positive(),
  tutor_id: uuid.optional(), enrollment_id: uuid.optional(), location: z.string().optional(),
  valid_from: date.optional(), valid_until: date.optional(),
}).passthrough();

export const savedCategorySchema = z.object({
  id: uuid, tenant_id: uuid, name: z.string(), created_at: date,
}).passthrough();

/** Unlike display-only legacy lists, editor reads must prove completeness. */
export function savedPage<T>(value: unknown, schema: z.ZodType<T>, page: number) {
  const parsed = z.object({
    items: z.array(schema),
    pagination: z.object({
      page: z.number().int().positive(), page_size: z.number().int().positive(),
      total_items: z.number().int().nonnegative(), total_pages: z.number().int().nonnegative(),
    }),
  }).parse(value);
  const p = parsed.pagination;
  if (p.page !== page || p.page_size !== 100 || p.total_pages !== Math.ceil(p.total_items / 100) ||
      parsed.items.length !== Math.max(0, Math.min(100, p.total_items - (page - 1) * 100))) {
    throw new Error('Incomplete saved configuration page');
  }
  return parsed;
}
