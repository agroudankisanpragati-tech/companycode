export type UserRole = "FARMER" | "PROCUREMENT_OFFICER" | "ADMIN";

export interface DappUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  preferred_language: "en" | "hi";
  role: UserRole;
  is_verified: boolean;
  profile_completed: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FarmerProfile {
  id: string;
  farmer_code: string;
  farmer_name: string;
  email: string;
  phone_number: string | null;
  village: string;
  gram_panchayat: string;
  block: string;
  district: string;
  state: string;
  pincode: string;
  land_area_acres: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export type CenterType = "PACS" | "MANDI" | "WAREHOUSE" | "OTHER";

export interface ProcurementCenter {
  id: string;
  code: string;
  name: string;
  center_type: CenterType;
  center_type_label: string;
  address_line: string;
  village_or_city: string;
  block: string;
  district: string;
  state: string;
  pincode: string;
  contact_phone: string;
  latitude: string | null;
  longitude: string | null;
  daily_capacity_kg: string;
  operating_start_time: string;
  operating_end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CropCategory = "CEREAL" | "PULSE" | "OILSEED" | "MILLET" | "COMMERCIAL" | "OTHER";

export interface CropCatalogueItem {
  id: string;
  code: string;
  name: string;
  name_hi: string;
  category: CropCategory;
  category_label: string;
  unit: "kg";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CropSeason = "KHARIF" | "RABI" | "ZAID" | "PERENNIAL";

export interface FarmerCrop {
  id: string;
  farmer: string;
  farmer_name: string;
  farmer_code: string;
  crop: string;
  crop_name: string;
  crop_name_hi: string;
  crop_code: string;
  season: CropSeason;
  season_label: string;
  harvest_year: number;
  cultivated_area_acres: string;
  estimated_quantity_kg: string;
  available_quantity_kg: string;
  harvest_date: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProcurementRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "RESCHEDULED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "CHECKED_IN"
  | "INSPECTION_PASSED"
  | "INSPECTION_REJECTED"
  | "WEIGHED"
  | "PROCURED"
  | "PROCUREMENT_REJECTED";

export interface RequestStatusEvent {
  id: string;
  from_status: ProcurementRequestStatus | "";
  from_status_label: string;
  to_status: ProcurementRequestStatus;
  to_status_label: string;
  actor_name: string;
  actor_role: UserRole | null;
  note: string;
  created_at: string;
}

export type AppointmentStatus =
  | "SCHEDULED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface ArrivalCheckIn {
  id: string;
  transport_mode: "TRACTOR" | "TRUCK" | "PICKUP" | "OTHER";
  transport_mode_label: string;
  vehicle_number: string;
  arrival_notes: string;
  checked_in_by: string;
  checked_in_by_name: string;
  checked_in_at: string;
}

export interface QualityInspection {
  id: string;
  result: "PASSED" | "REJECTED";
  result_label: string;
  grade: "FAQ" | "GRADE_A" | "GRADE_B" | "OTHER" | "NA";
  grade_label: string;
  moisture_percentage: string | null;
  foreign_matter_percentage: string | null;
  damaged_percentage: string | null;
  sample_reference: string;
  inspection_notes: string;
  rejection_reason: string;
  inspected_by: string;
  inspected_by_name: string;
  inspected_at: string;
}

export interface Weighment {
  id: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  net_weight_kg: string;
  bag_count: number | null;
  weighbridge_reference: string;
  weighment_notes: string;
  weighed_by: string;
  weighed_by_name: string;
  weighed_at: string;
}

export interface AcceptanceDecision {
  id: string;
  outcome: "ACCEPTED" | "PARTIAL" | "REJECTED";
  outcome_label: string;
  accepted_quantity_kg: string;
  rejected_quantity_kg: string;
  decision_reason: string;
  decided_by: string;
  decided_by_name: string;
  decided_at: string;
}

export interface ProcurementReceipt {
  id: string;
  receipt_number: string;
  verification_code: string;
  issued_at: string;
}

export interface ProcurementTransaction {
  id: string;
  transaction_number: string;
  request: string;
  request_number: string;
  appointment: string;
  token_code: string;
  scheduled_date: string;
  farmer: string;
  farmer_name: string;
  farmer_code: string;
  farmer_crop: string;
  crop_name: string;
  crop_code: string;
  procurement_center: string;
  center_code: string;
  center_name: string;
  outcome: "ACCEPTED" | "PARTIAL";
  outcome_label: string;
  net_weight_kg: string;
  accepted_quantity_kg: string;
  rejected_quantity_kg: string;
  rate_per_kg: string;
  total_amount: string;
  acceptance_notes: string;
  recorded_by: string;
  recorded_by_name: string;
  procured_at: string;
  receipt: ProcurementReceipt;
  payment_status: PaymentStatus | "UNINITIATED";
  payment_id: string | null;
}

export type PaymentStatus = "INITIATED" | "PROCESSING" | "SETTLED" | "FAILED";
export type PaymentMethod = "DBT" | "NEFT" | "RTGS" | "OTHER";

export interface PaymentEvent {
  id: string;
  action: "INITIATE" | "START_PROCESSING" | "SETTLE" | "FAIL" | "RETRY";
  action_label: string;
  from_status: PaymentStatus | "";
  to_status: PaymentStatus;
  actor_name: string;
  note: string;
  external_reference: string;
  created_at: string;
}

export interface PaymentSettlementReceipt {
  id: string;
  receipt_number: string;
  verification_code: string;
  issued_at: string;
}

export interface PaymentRecord {
  id: string;
  payment_number: string;
  transaction: string;
  transaction_number: string;
  request_number: string;
  farmer_name: string;
  farmer_code: string;
  crop_name: string;
  center_code: string;
  center_name: string;
  amount: string;
  method: PaymentMethod;
  method_label: string;
  beneficiary_reference: string;
  status: PaymentStatus;
  status_label: string;
  attempt_count: number;
  initiated_at: string;
  processing_at: string | null;
  settled_at: string | null;
  last_failed_at: string | null;
  bank_reference: string;
  last_failure_reason: string;
  events: PaymentEvent[];
  receipt: PaymentSettlementReceipt | null;
  created_at: string;
  updated_at: string;
}

export type NotificationCategory = "APPOINTMENT" | "QUALITY" | "PROCUREMENT" | "PAYMENT" | "GRIEVANCE" | "SYSTEM";

export interface DappNotification {
  id: string;
  category: NotificationCategory;
  category_label: string;
  title: string;
  message: string;
  request: string | null;
  transaction: string | null;
  payment: string | null;
  grievance: string | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

export type GrievanceStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
export type GrievanceCategory = "SCHEDULING" | "QUALITY" | "PROCUREMENT" | "PAYMENT" | "OTHER";

export interface GrievanceEvent {
  id: string;
  action: "CREATED" | "START_REVIEW" | "RESOLVE" | "REJECT";
  action_label: string;
  from_status: GrievanceStatus | "";
  to_status: GrievanceStatus;
  actor_name: string;
  note: string;
  created_at: string;
}

export interface Grievance {
  id: string;
  grievance_number: string;
  farmer: string;
  farmer_name: string;
  category: GrievanceCategory;
  category_label: string;
  subject: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  priority_label: string;
  status: GrievanceStatus;
  status_label: string;
  request: string | null;
  request_number: string | null;
  transaction: string | null;
  transaction_number: string | null;
  payment: string | null;
  payment_number: string | null;
  assigned_to_name: string | null;
  resolution: string;
  resolved_at: string | null;
  events: GrievanceEvent[];
  created_at: string;
  updated_at: string;
}

export interface ProcurementAnalytics {
  filters: { date_from: string; date_to: string; center: string | null; crop: string | null };
  totals: {
    transaction_count: number;
    accepted_quantity_kg: string;
    payable_amount: string;
    settled_amount: string;
    outstanding_amount: string;
    settlement_rate: string;
    acceptance_rate: string;
    open_grievances: number;
    failed_payments: number;
  };
  daily_trend: Array<{
    date: string;
    transactions: number;
    quantity_kg: string;
    payable_amount: string;
    settled_amount: string;
  }>;
  crop_breakdown: Array<{
    crop_code: string;
    crop_name: string;
    transactions: number;
    quantity_kg: string;
    payable_amount: string;
  }>;
  center_breakdown: Array<{
    center_code: string;
    center_name: string;
    transactions: number;
    quantity_kg: string;
    payable_amount: string;
  }>;
  payment_status_breakdown: Array<{ status: PaymentStatus | "UNINITIATED"; count: number }>;
  grievance_status_breakdown: Array<{ status: GrievanceStatus; count: number }>;
}

export interface ProcurementAppointment {
  id: string;
  request: string;
  request_number: string;
  farmer_name: string;
  farmer_code: string;
  crop_name: string;
  crop_code: string;
  procurement_center: string;
  center_code: string;
  center_name: string;
  scheduled_date: string;
  slot_start_time: string;
  slot_end_time: string;
  scheduled_quantity_kg: string;
  queue_number: number;
  token_code: string;
  status: AppointmentStatus;
  status_label: string;
  request_status: ProcurementRequestStatus;
  request_status_label: string;
  reservation_status: "ACTIVE" | "RELEASED" | "CONSUMED";
  reservation_status_label: string;
  processing: {
    check_in: ArrivalCheckIn | null;
    inspection: QualityInspection | null;
    weighment: Weighment | null;
    decision: AcceptanceDecision | null;
    transaction: ProcurementTransaction | null;
    receipt: ProcurementReceipt | null;
  };
  next_action: "WAITING" | "CHECK_IN" | "INSPECT" | "WEIGH" | "DECIDE" | "COMPLETE";
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcurementRequest {
  id: string;
  request_number: string;
  farmer: string;
  farmer_name: string;
  farmer_code: string;
  farmer_crop: string;
  crop_name: string;
  crop_code: string;
  crop_available_quantity_kg: string;
  procurement_center: string;
  center_code: string;
  center_name: string;
  intended_quantity_kg: string;
  preferred_date: string;
  farmer_notes: string;
  status: ProcurementRequestStatus;
  status_label: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string;
  appointment: ProcurementAppointment | null;
  status_events: RequestStatusEvent[];
  can_cancel: boolean;
  can_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface CapacitySnapshot {
  procurement_center: string;
  center_code: string;
  center_name: string;
  date: string;
  daily_capacity_kg: string;
  reserved_quantity_kg: string;
  consumed_quantity_kg: string;
  allocated_quantity_kg: string;
  available_quantity_kg: string;
}

export type DashboardSummary =
  | {
      role: "FARMER";
      profile_completed: boolean;
      farmer_code: string;
      registered_crops: number;
      available_quantity_kg: string | number;
      active_centers: number;
      active_requests: number;
      scheduled_appointments: number;
      reserved_quantity_kg: string | number;
      total_procurements: number;
      procured_quantity_kg: string | number;
      amount_payable: string | number;
      amount_settled: string | number;
      amount_outstanding: string | number;
      unread_notifications: number;
      open_grievances: number;
    }
  | {
      role: "PROCUREMENT_OFFICER";
      center_assigned: boolean;
      assigned_center: ProcurementCenter | null;
      active_catalogue_crops: number;
      pending_requests: number;
      appointments_today: number;
      reserved_today_kg: string | number;
      remaining_capacity_today_kg: string | number;
      processing_arrivals: number;
      procurements_today: number;
      procured_today_kg: string | number;
      amount_recorded_today: string | number;
      unsettled_payments: number;
      open_grievances: number;
      unread_notifications: number;
    }
  | {
      role: "ADMIN";
      registered_farmers: number;
      active_centers: number;
      catalogue_crops: number;
      assigned_officers: number;
      open_requests: number;
      upcoming_appointments: number;
      reserved_today_kg: string | number;
      total_procurements: number;
      procured_today_kg: string | number;
      procured_quantity_kg: string | number;
      amount_recorded_total: string | number;
      amount_settled_total: string | number;
      amount_outstanding_total: string | number;
      failed_payments: number;
      open_grievances: number;
      unread_notifications: number;
    };
