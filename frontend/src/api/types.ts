export type UserRole = "super_admin" | "committee" | "operator" | "resident";

export interface User {
  id: number;
  society_id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

export type AssetType =
  | "STP" | "BOREWELL" | "SUMP" | "OHT" | "DG" | "LIFT"
  | "FIRE" | "PUMP" | "TRANSFORMER" | "SOLAR" | "WATER_METER" | "OTHER";

export interface Asset {
  id: number;
  society_id: number;
  type: AssetType;
  name: string;
  make: string | null;
  model: string | null;
  capacity_value: number | null;
  capacity_unit: string | null;
  install_date: string | null;
  warranty_expiry: string | null;
  amc_vendor: string | null;
  amc_expiry: string | null;
  qr_token: string;
  location: string | null;
  is_active: boolean;
  notes: string | null;
}

export type Shift = "AM" | "PM" | "NIGHT";

export interface STPLog {
  id: number;
  society_id: number;
  asset_id: number;
  client_uuid: string | null;
  logged_at: string;
  shift: Shift | null;
  ph: number | null;
  mlss: number | null;
  chlorine_dosing: number | null;
  blower_run_hours: number | null;
  inlet_flow: number | null;
  outlet_flow: number | null;
  tank_level: number | null;
  backwash_done: boolean;
  sludge_removed: boolean;
  power_hours: number | null;
  operator_id: number | null;
  notes: string | null;
  photo_url: string | null;
}

export interface WaterLog {
  id: number;
  society_id: number;
  asset_id: number;
  client_uuid: string | null;
  logged_at: string;
  borewell_run_hours: number | null;
  water_level: number | null;
  motor_health_note: string | null;
  sump_level: number | null;
  oht_level: number | null;
  operator_id: number | null;
  notes: string | null;
  photo_url: string | null;
}

export interface DGLog {
  id: number;
  society_id: number;
  asset_id: number;
  client_uuid: string | null;
  run_start: string;
  run_end: string | null;
  run_hours: number | null;
  diesel_opening: number | null;
  diesel_closing: number | null;
  diesel_consumed: number | null;
  load_kw: number | null;
  frequency: number | null;
  voltage: number | null;
  operator_id: number | null;
  notes: string | null;
}

export type PPMFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "HALFYEARLY" | "YEARLY" | "CUSTOM_DAYS";

export interface PPMTask {
  id: number;
  society_id: number;
  asset_id: number | null;
  title: string;
  category: string | null;
  frequency: PPMFrequency;
  custom_interval_days: number | null;
  next_due: string | null;
  is_statutory: boolean;
  is_active: boolean;
  checklist_json: string[] | null;
}

export interface PPMCompletion {
  id: number;
  society_id: number;
  task_id: number;
  client_uuid: string | null;
  completed_at: string;
  completed_by: number | null;
  checklist_result_json: Record<string, boolean> | null;
  proof_photos_json: string[] | null;
  geo_lat: number | null;
  geo_lng: number | null;
  notes: string | null;
}

export interface ComplianceDoc {
  id: number;
  society_id: number;
  doc_type: string;
  title: string;
  file: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  asset_id: number | null;
  notes: string | null;
}

export interface DashboardData {
  overdue_ppm: { count: number; tasks: Array<{ id: number; title: string; next_due: string | null; days_overdue: number | null; asset_id: number | null }> };
  stp_breaches: { count: number; tests: Array<{ id: number; test_date: string | null; breach_details: string | null; asset_id: number }> };
  expiring_docs: { count: number; docs: Array<{ id: number; title: string; doc_type: string; expiry_date: string | null; days_until_expiry: number | null }> };
  dg_fuel: { estimated_stock_litres: number; total_purchased: number; total_consumed: number };
  pending_complaints: number;
  water_this_month: { borewell_run_hours: number; tanker_litres: number };
}

export type SyncStatus = "pending" | "synced" | "failed";

export interface OutboxEntry {
  id?: number;
  entity_type: "stp_log" | "water_log" | "dg_log" | "ppm_completion";
  client_uuid: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  created_at: string;
  synced_at: string | null;
  error: string | null;
  photo_blobs: Array<{ field: string; blob: Blob; name: string }>;
}
