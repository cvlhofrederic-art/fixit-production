export type RFQStatus = 'pending' | 'answered' | 'closed'
export type OfferStatus = 'pending' | 'accepted' | 'rejected'

export interface RFQItem {
  id: string
  rfq_id: string
  product_name: string
  product_ref?: string
  category?: string
  quantity: number
  unit: string
  notes?: string
}

export interface RFQ {
  id: string
  user_id: string
  country: 'FR' | 'PT'
  status: RFQStatus
  message?: string
  title: string
  created_at: string
  updated_at: string
  rfq_items?: RFQItem[]
  offers?: Offer[]
}

export interface Supplier {
  id: string
  name: string
  email: string
  country: 'FR' | 'PT'
  categories: string[]
}

export interface OfferItem {
  id: string
  offer_id: string
  rfq_item_id?: string
  product_name: string
  unit_price: number
  quantity: number
  total_price: number
}

export interface Offer {
  id: string
  rfq_id: string
  supplier_id?: string
  supplier_name: string
  supplier_email: string
  total_price?: number
  delivery_days?: number
  comment?: string
  status: OfferStatus
  token: string
  created_at: string
  offer_items?: OfferItem[]
}

export interface CreateRFQPayload {
  title: string
  message?: string
  country: 'FR' | 'PT'
  items: Omit<RFQItem, 'id' | 'rfq_id'>[]
}
