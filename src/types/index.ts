export type UserRole = 'client' | 'vendeur' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  google_id?: string;
  avatar_url?: string;
  is_email_verified?: boolean;
  must_change_password?: boolean;
  created_at: string;
}

export type PlanTier = 'essentiel' | 'croissance';
export type CertificationStatus = 'non_certifiee' | 'demande_envoyee' | 'paiement_a_verifier' | 'verification_en_cours' | 'certifiee' | 'refusee' | 'retiree';

export interface Store {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url?: string;
  banner_url?: string;
  phone: string;
  address: string;
  city: string;
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason?: string;
  suspended_at?: string;
  suspended_by?: string;
  plan_tier: PlanTier;
  plan_expires_at?: string;
  allows_cod: boolean;
  is_certified: boolean; // Badge "Boutique certifiée"
  certification_status: CertificationStatus;
  certified_at?: string;
  certified_by?: string;
  created_at: string;
}

export interface StoreCertification {
  id: string;
  store_id: string;
  store_name?: string;
  wave_payment_reference?: string;
  verified_payment_reference?: string;
  proof_document_url?: string;
  status: CertificationStatus;
  amount_fcfa: number;
  vendor_notes?: string;
  admin_id?: string;
  admin_name?: string;
  admin_notes?: string;
  rejection_reason?: string;
  certified_at?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryZone {
  id: string;
  store_id: string;
  region: string;
  price_fcfa: number;
  estimated_days: string;
  created_at: string;
}

export interface StoreCategory {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id?: string;
  name: string;
  description: string;
  price_fcfa: number;
  compare_price_fcfa?: number;
  stock_quantity: number;
  images: string[];
  ai_images?: string[];
  is_active: boolean;
  created_at: string;
  store_name?: string;
  store_slug?: string;
  store_city?: string;
  store_is_certified?: boolean;
  store?: Store;
  category?: StoreCategory;
}

export interface AiConfig {
  daily_quota_per_store: number;
  enabled: boolean;
  provider: string;
}

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  discount_percent?: number;
  discount_amount_fcfa?: number;
  min_order_amount_fcfa: number;
  is_active: boolean;
  expires_at?: string;
}

export type OrderStatus = 'en_attente' | 'confirmee' | 'en_livraison' | 'livree' | 'annulee';
export type PaymentMethod = 'paiement_livraison' | 'wave' | 'orange_money';
export type PaymentStatus = 'non_paye' | 'en_attente' | 'paye' | 'echoue';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_image?: string;
  unit_price_fcfa: number;
  quantity: number;
  total_price_fcfa: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  store_id: string;
  status: OrderStatus;
  subtotal_fcfa: number;
  delivery_fee_fcfa: number;
  discount_amount_fcfa: number;
  total_fcfa: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  delivery_region: string;
  delivery_address: string;
  delivery_notes?: string;
  created_at: string;
  store_name?: string;
  items?: OrderItem[];
}

export interface Conversation {
  id: string;
  store_id: string;
  customer_id: string;
  store_name?: string;
  customer_name?: string;
  last_message?: string;
  last_message_date?: string;
  unread_count?: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface PlatformReview {
  id: string;
  user_id: string;
  user_name?: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  store_id: string;
  store_name?: string;
  plan_tier: PlanTier;
  price_fcfa: number;
  duration_months: number;
  status: 'actif' | 'expire' | 'en_attente' | 'paiement_a_verifier';
  offline_payment_reference: string;
  proof_document_url?: string;
  vendor_notes?: string;
  verified_by_admin_id: string;
  verified_payment_reference?: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: any;
  created_at: string;
}

export const SENEGAL_REGIONS = [
  'Dakar',
  'Thiès',
  'Diourbel',
  'Fatick',
  'Kaolack',
  'Kaffrine',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Tambacounda',
  'Kédougou',
  'Kolda',
  'Sédhiou',
  'Ziguinchor'
] as const;
