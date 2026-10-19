export type UserRole = 'admin' | 'seller' | 'buyer';

export type SellerType = 
  | 'individual_producer' 
  | 'producer_group' 
  | 'self_help_group' 
  | 'cooperative' 
  | 'reseller';

export type BuyerType = 
  | 'individual' 
  | 'wholesaler' 
  | 'retailer' 
  | 'business' 
  | 'institution' 
  | 'exporter';

export type VerificationStatus = 
  | 'unverified' 
  | 'pending' 
  | 'needs_more_information' 
  | 'verified_producer' 
  | 'verified_group' 
  | 'verified_reseller' 
  | 'rejected' 
  | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  preferred_language?: 'en' | 'ta';
  verification_status?: VerificationStatus;
  seller_type?: SellerType;
  organization_name?: string;
  craft_category?: string;
  buyer_type?: BuyerType;
  business_name?: string;
  status?: 'active' | 'suspended';
  created_at?: string;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  description: string;
  materials: string;
  dimensions?: string;
  production_method?: string;
  price_per_unit: number;
  stock_quantity: number;
  allocated_stock?: number;
  available_stock?: number;
  moq: number;
  monthly_capacity?: number;
  lead_time_days: number;
  images: string[];
  is_published?: boolean;
  created_at?: string;
  seller?: {
    id: string;
    name: string;
    seller_type: SellerType;
    state?: string;
    district?: string;
    verification_status: VerificationStatus;
    is_producer_verified?: boolean;
    workshop_details?: string;
  };
}

export interface BuyerRequirement {
  id: string;
  buyer_id?: string;
  title: string;
  category: string;
  description: string;
  quantity: number;
  target_unit_price?: number;
  max_budget?: number;
  destination_city?: string;
  destination_state?: string;
  delivery_deadline?: string;
  max_lead_time_days?: number;
  quality_specifications?: string;
  status: 'open' | 'in_negotiation' | 'fulfilled' | 'cancelled';
  created_at?: string;
  buyer?: {
    id: string;
    name: string;
    buyer_type?: BuyerType;
    city?: string;
  };
  matches?: MatchResult[];
}

export interface MatchResult {
  product_id: string;
  product_title: string;
  category: string;
  price_per_unit: number;
  currency: string;
  stock_quantity: number;
  monthly_capacity: number;
  moq: number;
  lead_time_days: number;
  images: string[];
  seller: {
    seller_id: string;
    name: string;
    seller_type: SellerType;
    state: string;
    district: string;
    verification_status: VerificationStatus;
    producer_badge: boolean;
  };
  match_score: number;
  score_breakdown: Record<string, { score: number; max: number }>;
  positive_reasons: string[];
  constraints: string[];
  can_fulfill_independently: boolean;
}

export interface QuotationRevision {
  revision_num: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  lead_time_days: number;
  notes?: string;
  modified_by: string;
  role?: string;
  timestamp: string;
}

export interface Quotation {
  id: string;
  requirement_id?: string;
  requirement_title?: string;
  seller: { id: string; name: string; email?: string };
  buyer: { id: string; name: string; email?: string };
  product?: { id: string; title: string; images?: string[] };
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  lead_time_days: number;
  delivery_terms: string;
  notes?: string;
  status: 'draft' | 'submitted' | 'revision_requested' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  revisions?: QuotationRevision[];
  created_at?: string;
  updated_at?: string;
}

export interface ProductionProgress {
  stage: string;
  percentage: number;
  notes?: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  seller: { id: string; name: string; email?: string; phone?: string };
  buyer: { id: string; name: string; email?: string; phone?: string };
  product?: { id: string; title: string; category?: string; images?: string[]; image?: string };
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: 'pending_confirmation' | 'confirmed' | 'in_production' | 'quality_check' | 'dispatched' | 'delivered' | 'completed' | 'cancelled' | 'disputed';
  payment_status?: string;
  delivery_address?: Record<string, string>;
  delivery_terms?: string;
  lead_time_days?: number;
  production_progress?: ProductionProgress[];
  shipping_details?: {
    carrier?: string;
    tracking_number?: string;
    dispatch_date?: string;
    estimated_delivery?: string;
  };
  has_review?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'verification' | 'requirement' | 'quotation' | 'order' | 'dispute' | 'system' | 'message';
  link: string;
  read: boolean;
  created_at: string;
}

export interface DuplicateFlag {
  id: string;
  status: 'pending_review' | 'confirmed_duplicate' | 'false_positive' | 'dismissed';
  similarity_score: number;
  hamming_distance: number;
  new_product: {
    id: string;
    title: string;
    image_url: string;
    seller_name: string;
    seller_id: string;
  };
  existing_product: {
    id: string;
    title: string;
    image_url: string;
    seller_name: string;
    seller_id: string;
  };
  reviewer_notes?: string;
  created_at: string;
}

// Runtime value exports to satisfy ES module import declarations in the browser
export const User = {};
export const UserRole = {};
export const SellerType = {};
export const BuyerType = {};
export const VerificationStatus = {};
export const Product = {};
export const BuyerRequirement = {};
export const MatchResult = {};
export const QuotationRevision = {};
export const Quotation = {};
export const ProductionProgress = {};
export const Order = {};
export const NotificationItem = {};

