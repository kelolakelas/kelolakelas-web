import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const studentFormSchema = z.object({
  first_name: z.string().trim().min(1, 'Nama depan wajib diisi').max(255, 'Nama depan maksimal 255 karakter'),
  last_name: z.string().trim().max(255, 'Nama belakang maksimal 255 karakter').optional(),
  nickname: z.string().trim().max(100, 'Nama panggilan maksimal 100 karakter').optional(),
  gender: z.enum(['male', 'female']).optional(),
  date_of_birth: z
    .string()
    .trim()
    .refine(validDate, 'Tanggal lahir harus berupa tanggal yang valid dengan format YYYY-MM-DD'),
});

export type StudentFormInput = z.infer<typeof studentFormSchema>;

export interface Student {
  id: string;
  parent_id: string;
  first_name: string;
  last_name?: string | null;
  /** Kept for compatibility with the current academic service response typo. */
  ['lastå_name']?: string | null;
  nickname?: string | null;
  gender?: 'male' | 'female' | null;
  date_of_birth?: string | null;
}

export interface StudentListData {
  items: Student[];
  pagination?: {
    page?: number;
    page_size?: number;
    total_items?: number;
    total_pages?: number;
  };
}

export type StudentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export function studentPayload(input: StudentFormInput, parentId?: string) {
  return {
    ...(parentId ? { parent_id: parentId } : {}),
    first_name: input.first_name,
    ...(input.last_name ? { last_name: input.last_name } : {}),
    ...(input.nickname ? { nickname: input.nickname } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    date_of_birth: input.date_of_birth,
  };
}

export function studentLastName(student: Student) {
  return student.last_name ?? student['lastå_name'] ?? '';
}

export function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function normalizeStudentList(value: unknown): StudentListData {
  if (!value || typeof value !== 'object') return { items: [] };
  const candidate = value as { items?: unknown; pagination?: StudentListData['pagination'] };
  return {
    items: Array.isArray(candidate.items) ? (candidate.items as Student[]) : [],
    pagination: candidate.pagination,
  };
}
