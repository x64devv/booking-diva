export type PublicVenue = { id: string; name: string; capacity: number | null; seats_left: number | null };

export type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  theme: string | null;
  organiser: string | null;
  start_date: string;
  end_date: string;
  venue_summary: string | null;
  fee_amount: number;
  currency: string;
  registration_deadline: string | null;
  payment_deadline: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  roles: string[];
  is_open: boolean;
  accepting: boolean;
  venues: PublicVenue[];
};

export type RegistrationStatus = "reserved" | "paid" | "cancelled" | "expired";

export type Registration = {
  id: string;
  event_id: string;
  venue_id: string;
  reference: string;
  full_name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  role: string;
  branch: string | null;
  status: RegistrationStatus;
  amount_due: number;
  amount_paid: number;
  reserved_until: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  venues?: { name: string } | null;
};

export type Report = {
  totals: {
    registered: number; paid: number; reserved: number; overdue: number;
    cancelled: number; expired: number; expected: number; collected: number; outstanding: number;
  };
  by_venue: { id: string; name: string; capacity: number | null; is_active: boolean; paid: number; reserved: number; overdue: number; collected: number }[];
  by_role: { role: string; paid: number; reserved: number }[];
  by_gender: { gender: string; count: number }[];
  by_day: { day: string; registrations: number }[];
  by_collector: { name: string; payments: number; amount: number }[];
  payments_by_day: { day: string; amount: number; payments: number }[];
};

export function isOverdue(r: Pick<Registration, "status" | "reserved_until">) {
  return r.status === "reserved" && !!r.reserved_until && new Date(r.reserved_until) < new Date();
}
