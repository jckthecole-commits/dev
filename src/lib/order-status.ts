/** Order lifecycle — labels, customer-facing copy and allowed transitions. */
export type OrderStatus = 'pending_payment' | 'placed' | 'rx_review' | 'on_hold' | 'in_lab' | 'qc' | 'ready' | 'shipped' | 'delivered' | 'cancelled' | 'returned'

export const STATUS: Record<OrderStatus, { label: string; tone: 'neutral' | 'info' | 'warn' | 'ok' | 'err'; customer: string }> = {
  pending_payment: { label: 'Așteaptă plata', tone: 'warn', customer: 'Așteptăm confirmarea plății.' },
  placed: { label: 'Nouă', tone: 'info', customer: 'Am primit comanda.' },
  rx_review: { label: 'Verificare rețetă', tone: 'info', customer: 'Optometristul verifică rețeta.' },
  on_hold: { label: 'Necesită clarificări', tone: 'warn', customer: 'Avem nevoie de câteva detalii de la tine — te contactăm.' },
  in_lab: { label: 'În laborator', tone: 'info', customer: 'Lentilele sunt în producție și montaj.' },
  qc: { label: 'Control calitate', tone: 'info', customer: 'Verificăm dioptriile montate și ajustăm rama.' },
  ready: { label: 'Gata', tone: 'ok', customer: 'Ochelarii sunt gata.' },
  shipped: { label: 'Expediată', tone: 'ok', customer: 'Coletul e pe drum.' },
  delivered: { label: 'Livrată', tone: 'ok', customer: 'Livrată. Purtare plăcută!' },
  cancelled: { label: 'Anulată', tone: 'err', customer: 'Comanda a fost anulată.' },
  returned: { label: 'Returnată', tone: 'neutral', customer: 'Produsul a fost returnat.' },
}

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['rx_review', 'in_lab', 'ready', 'on_hold', 'cancelled'],
  rx_review: ['in_lab', 'on_hold', 'cancelled'],
  on_hold: ['rx_review', 'in_lab', 'cancelled'],
  in_lab: ['qc', 'on_hold', 'cancelled'],
  qc: ['ready', 'in_lab'],
  ready: ['shipped', 'delivered'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

/** Steps shown on the customer's tracking page. */
export const TRACK_STEPS: { key: OrderStatus[]; label: string }[] = [
  { key: ['placed', 'pending_payment'], label: 'Plasată' },
  { key: ['rx_review', 'on_hold'], label: 'Rețetă verificată' },
  { key: ['in_lab', 'qc'], label: 'Laborator' },
  { key: ['ready'], label: 'Gata' },
  { key: ['shipped', 'delivered'], label: 'Livrare' },
]

export const PAYMENT_LABEL: Record<string, string> = { card: 'Card online', cod: 'Ramburs', transfer: 'Transfer bancar', store: 'La ridicare, în showroom' }
export const PAYMENT_STATUS_LABEL: Record<string, string> = { pending: 'neîncasată', authorized: 'autorizată', paid: 'încasată', failed: 'eșuată', refunded: 'rambursată', partially_refunded: 'rambursată parțial' }
export const SHIPPING_LABEL: Record<string, string> = { courier: 'Curier', easybox: 'easybox', pickup: 'Ridicare din showroom' }
