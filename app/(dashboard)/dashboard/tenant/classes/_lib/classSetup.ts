import {
    createCategorySchema,
    createClassSchema,
    createScheduleSchema,
    type ClassSetupResponse,
    type CreateClassWithCategoryInput,
    type ScheduleItemInput,
} from './schema';

export interface ClassSetupDraftInput {
  category: unknown;
  class: unknown;
  schedules?: unknown;
}

export type ClassSetupPayloadResult =
  | { success: true; payload: CreateClassWithCategoryInput }
  | { success: false; message: string; errors?: Record<string, string[]> };

export function buildClassSetupPayload(input: ClassSetupDraftInput): ClassSetupPayloadResult {
  const categoryValidation = createCategorySchema.safeParse(input.category);
  if (!categoryValidation.success) {
    return {
      success: false,
      message: 'Kategori belum valid. Periksa kembali data kategori.',
      errors: categoryValidation.error.flatten().fieldErrors,
    };
  }

  const classValidation = createClassSchema.safeParse({
    category_id: 'pending-category',
    ...(input.class as Record<string, unknown>),
  });
  if (!classValidation.success) {
    return {
      success: false,
      message: 'Detail kelas belum valid. Periksa kembali data kelas.',
      errors: classValidation.error.flatten().fieldErrors,
    };
  }

  const classPayload = {
    name: classValidation.data.name,
    description: classValidation.data.description,
    type: classValidation.data.type,
    price: classValidation.data.price,
    capacity: classValidation.data.capacity,
  } satisfies CreateClassWithCategoryInput['class'];
  const payload: CreateClassWithCategoryInput = {
    category: categoryValidation.data,
    class: classPayload,
  };

  if (classValidation.data.type === 'group') {
    const scheduleValidation = createScheduleSchema.safeParse({
      class_id: 'pending-class',
      schedules: input.schedules || [],
    });
    if (!scheduleValidation.success) {
      return {
        success: false,
        message: 'Jadwal belum valid. Periksa kembali semua slot jadwal.',
        errors: scheduleValidation.error.flatten().fieldErrors,
      };
    }
    payload.schedules = scheduleValidation.data.schedules.map((item: ScheduleItemInput) => ({
      ...item,
      start_time: item.start_time.split(':').length === 2 ? `${item.start_time}:00` : item.start_time,
      end_time: item.end_time.split(':').length === 2 ? `${item.end_time}:00` : item.end_time,
    }));
  }

  return { success: true, payload };
}

export type { ClassSetupResponse };
