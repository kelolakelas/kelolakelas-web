export interface ApiEnvelope<T> {
  status: string;
  message?: string;
  data?: T;
}

export interface Pagination {
  page?: number;
  page_size?: number;
  total_items?: number;
  total_pages?: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination?: Pagination;
}

export interface CatalogClass {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category_id: string;
  category_name: string;
  name: string;
  description?: unknown;
  type: 'private' | 'group' | string;
  price: number;
  capacity?: number | null;
  available_slots?: number | null;
  distance_km?: number | null;
  is_enrollable: boolean;
  created_at: string;
  schedules?: CatalogSchedule[];
}

export interface CatalogSchedule {
  id: string;
  class_id?: string;
  day_of_week: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  start_time: string;
  end_time: string;
  capacity: number;
  available_slots: number;
  is_available: boolean;
  location?: string | null;
  tutor_id?: string | null;
}

export interface CatalogListResponse {
  items: CatalogClass[];
  pagination: Pagination;
}

export interface QueryResult<T> {
  data: T;
  pagination?: Pagination;
  error?: string;
  status?: number;
}

export interface AuthData {
  token: string;
  user: User;
}

export interface LoginResponse {
  token: string;
  user: User;
  tenant_id?: string | null;
}

export interface TenantRegistrationResponse {
  token: string;
  tenant: Tenant;
  user: User;
}

export type ParentRegistrationResponse = User;

export interface User {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  is_parent?: boolean | null;
  tenant_id?: string | null;
}

export interface Tenant {
  id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface Permission {
  id: string;
  name: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  is_system_role?: boolean;
  tenant_id?: string | null;
  permissions?: Permission[];
}

export interface Member {
  id?: string;
  user_id?: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  status?: string | null;
  role_id?: string | null;
  role?: Role | null;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
}

export interface ClassEntity {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  type: 'private' | 'group';
  price: number;
  capacity?: number | null;
}

export interface Schedule {
  id: string;
  class_id: string;
  day_of_week: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  start_time: string;
  end_time: string;
  class?: ClassEntity | null;
}

export interface Session {
  id: string;
  class_id: string;
  schedule_id?: string | null;
  enrollment_id?: string | null;
  tutor_id?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  class?: ClassEntity | null;
  enrollment?: Enrollment | null;
}

export interface Enrollment {
  id: string;
  tenant_id?: string;
  class_id: string;
  student_id: string;
  billing_cycle?: 'monthly' | 'quarterly' | 'yearly';
  status: 'pending' | 'active' | 'completed' | 'dropped' | string;
  schedule_id?: string | null;
  joined_at?: string;
  updated_at?: string;
  student?: Student | null;
  class?: ClassEntity | null;
}

export interface PublicEnrollmentRequest {
  student_id: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  schedule_id: string;
}

export interface PublicEnrollmentResponse {
  enrollment: Enrollment;
  payment: {
    transaction_id: string;
    checkout_session_url: string;
    gross_amount: number;
    status: string;
  };
}

export interface Student {
  id: string;
  parent_id: string;
  first_name: string;
  last_name?: string | null;
  nickname?: string | null;
  gender?: 'male' | 'female' | string | null;
  date_of_birth?: string | null;
  created_at?: string;
  updated_at?: string;
  student_notes?: StudentNote[];
}

export interface StudentNote {
  content: string;
  note_type: 'medical' | 'academic' | 'behavioral' | string;
}

export interface Attendance {
  id: string;
  enrollment_id: string;
  session_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | string;
  created_at?: string;
  updated_at?: string;
  enrollment?: Enrollment | null;
  session?: Session | null;
}

export interface Report {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  reporter_id: string;
  title: string;
  evaluation_notes?: string | null;
  score?: number | null;
  created_at?: string;
  updated_at?: string;
  enrollment?: Enrollment | null;
}

export interface BillingTransaction {
  id: string;
  transaction_id?: string;
  merchant_order_id?: string;
  tenant_id?: string;
  parent_id?: string;
  student_id?: string;
  enrollment_id?: string;
  checkout_session_url?: string;
  gross_amount: number;
  subtotal_amount?: number;
  discount_amount?: number;
  payment_gateway_fee?: number;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_intent_id?: string;
  status: string;
  currency?: string;
  created_at?: string;
}