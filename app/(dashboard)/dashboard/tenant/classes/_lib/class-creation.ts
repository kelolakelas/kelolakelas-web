import { z } from 'zod';
import {
  categoryIdSchema,
  createCategorySchema,
  createClassSchema,
  scheduleItemSchema,
  type ClassEntity,
} from './schema';

export const classCreationSchema = z
  .object({
    category_id: categoryIdSchema.optional(),
    category: createCategorySchema.optional(),
    class: createClassSchema.omit({ category_id: true }).extend({
      price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }),
    teacher_ids: z
      .array(z.string().uuid())
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length),
    schedules: z.array(scheduleItemSchema).max(366),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.category_id) === Boolean(value.category))
      ctx.addIssue({
        code: 'custom',
        path: ['category'],
        message: 'Choose exactly one category.',
      });
    if (
      value.class.type === 'private'
        ? value.schedules.length > 0
        : value.schedules.length === 0
    )
      ctx.addIssue({
        code: 'custom',
        path: ['schedules'],
        message:
          'Group classes require slots; private classes schedule after enrollment.',
      });
    if (
      value.schedules.some(
        (slot) =>
          slot.enrollment_id ||
          (slot.tutor_id && !value.teacher_ids.includes(slot.tutor_id)),
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['schedules'],
        message: 'Select an assigned teacher for these group slots.',
      });
  });

export type ClassCreationInput = z.infer<typeof classCreationSchema>;
export interface ClassCreationResult {
  class: ClassEntity;
  schedules?: unknown[];
  sessions?: unknown[];
}
