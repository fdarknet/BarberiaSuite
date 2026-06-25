const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api").replace(/\/$/, "");
export const API_BASE = API_URL.replace(/\/api\/?$/, "");
export function assetUrl(p?: string | null) {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}
export type ApiUser = { id: string; role: "ADMIN" | "STAFF" | "CUSTOMER"; email: string; orgId: string; fullName?: string; staffId?: string | null; staffName?: string };

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("token");
  else localStorage.setItem("token", token);
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers as any) },
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text || "{}");
      if (j?.error) {
        const details = j?.details && typeof j.details === "object"
          ? Object.entries(j.details)
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => `${k}:${v}`)
              .join(", ")
          : "";
        const err = new Error(details ? `${j.error} (${details})` : String(j.error));
        (err as any).status = res.status;
        (err as any).data = j;
        throw err;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function requestForm<T>(path: string, form: FormData, method: string = "POST"): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: form });

  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text || "{}");
      if (j?.error) {
        const details = j?.details && typeof j.details === "object"
          ? Object.entries(j.details)
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => `${k}:${v}`)
              .join(", ")
          : "";
        const err = new Error(details ? `${j.error} (${details})` : String(j.error));
      (err as any).status = res.status;
      (err as any).data = j;
      throw err;
      }
    } catch {
      // ignore
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {

  authMe: () => request<{ user: ApiUser & { loyaltyPoints?: number; whatsappOptIn?: boolean; preferredChannel?: string } }>("/auth/me"),
  // Public
  health: () => request<{ ok: boolean }>("/health"),
  branches: (orgId: string) => request<{ branches: any[] }>(`/org/${orgId}/branches`),
  services: (branchId: string) => request<{ services: any[] }>(`/branches/${branchId}/services`),
  staff: (branchId: string, serviceId?: string) => {
    const qs = new URLSearchParams();
    if (serviceId) qs.set("serviceId", serviceId);
    const q = qs.toString();
    return request<{ staff: any[] }>(`/branches/${branchId}/staff${q ? `?${q}` : ""}`);
  },
  availability: (branchId: string, serviceId: string, date: string, staffId?: string) => {
    const qs = new URLSearchParams({ branchId, serviceId, date });
    if (staffId) qs.set("staffId", staffId);
    return request<{ slots: { startAt: string; endAt: string }[]; staffCandidates: { staffId: string; name: string; photoUrl?: string|null }[] }>(
      `/availability?${qs.toString()}`
    );
  },

  // Auth
  login: (email: string, password: string) => request<{ token: string; user: ApiUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  changePassword: (payload: { email: string; currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/auth/password/change", { method: "POST", body: JSON.stringify(payload) }),
  requestPasswordReset: (email: string) =>
    request<{ ok: boolean }>("/auth/password/reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (payload: { email: string; code: string; newPassword: string }) =>
    request<{ ok: boolean }>("/auth/password/reset/confirm", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: any) => request<{ token: string; user: ApiUser }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request<{ user: ApiUser }>("/auth/me"),

  // Customer booking
  createAppointment: (payload: any) => request<{ appointment: any }>("/appointments", { method: "POST", body: JSON.stringify(payload) }),
  updateAppointment: (id: string, payload: any) => request<{ appointment: any }>(`/appointments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Admin: agenda
  adminAppointments: (branchId: string, date: string) => {
    const qs = new URLSearchParams({ branchId, date });
    return request<{ appointments: any[] }>(`/admin/appointments?${qs.toString()}`);
  },

  // Admin: org settings / logo
  adminOrgSettings: () => request<{ org: any }>(`/admin/org/settings`),
  adminUpdateOrgSettings: (payload: any) => request<{ org: any }>(`/admin/org/settings`, { method: "PUT", body: JSON.stringify(payload) }),
  adminUploadOrgLogo: (file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return requestForm<{ logoUrl: string }>(`/admin/org/logo`, form, "POST");
  },
  adminUploadPaymentQr: (file: File) => {
    const form = new FormData();
    form.append("qr", file);
    return requestForm<{ qrImageUrl: string }>(`/admin/org/payment-qr`, form, "POST");
  },

adminOrgImages: () => request<{ images: any[]; coverUrl: string | null; displayMode: string }>(`/admin/org/images`),
adminUploadOrgImage: (file: File) => {
  const form = new FormData();
  form.append("image", file);
  return requestForm<{ url: string; filename: string }>(`/admin/org/images`, form, "POST");
},
adminDeleteOrgImage: (filename: string) =>
  request<{ ok: boolean }>(`/admin/org/images/${encodeURIComponent(filename)}`, { method: "DELETE" }),
adminSetOrgCover: (coverUrl: string | null, displayMode?: "logo" | "name" | "both" | "none") =>
  request<{ org: any }>(`/admin/org/cover`, { method: "POST", body: JSON.stringify({ coverUrl, displayMode }) }),

orgPublic: (orgId: string) => request<{ org: any }>(`/org/${orgId}/public`),
publicProducts: (orgId: string) => request<{ products: any[]; storeEnabled?: boolean }>(`/org/${orgId}/products`),
createStoreOrder: (orgId: string, payload: any) => request<{ order: any; paymentQrUrl: string | null }>(`/org/${orgId}/store-orders`, { method: "POST", body: JSON.stringify(payload) }),

  // Admin: branches/services/staff
  adminBranches: () => request<{ branches: any[] }>(`/admin/branches`),
  adminCreateBranch: (payload: any) => request<{ branch: any }>(`/admin/branches`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateBranch: (id: string, payload: any) => request<{ branch: any }>(`/admin/branches/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  adminDeleteBranch: (id: string) => request<{ ok: boolean }>(`/admin/branches/${id}`, { method: "DELETE" }),

  adminServices: () => request<{ services: any[] }>(`/admin/services`),
  adminCreateService: (payload: any) => request<{ service: any }>(`/admin/services`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateService: (id: string, payload: any) => request<{ service: any }>(`/admin/services/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  adminDeleteService: (id: string) => request<{ ok: boolean }>(`/admin/services/${id}`, { method: "DELETE" }),

  adminBranchServices: (branchId: string) => request<{ services: any[] }>(`/admin/branches/${branchId}/services`),
  adminUpdateBranchService: (branchId: string, serviceId: string, payload: any) =>
    request<{ branchService: any }>(`/admin/branches/${branchId}/services/${serviceId}`, { method: "PUT", body: JSON.stringify(payload) }),

  adminStaff: (branchId?: string) => {
    const qs = new URLSearchParams();
    if (branchId) qs.set("branchId", branchId);
    const q = qs.toString();
    return request<{ staff: any[] }>(`/admin/staff${q ? `?${q}` : ""}`);
  },
  adminCreateStaff: (payload: any) => request<{ staff: any }>(`/admin/staff`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateStaff: (id: string, payload: any) => request<{ staff: any }>(`/admin/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  adminDeleteStaff: (id: string) => request<{ ok: boolean }>(`/admin/staff/${id}`, { method: "DELETE" }),
  adminUploadStaffPhoto: (staffId: string, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return requestForm<{ photoUrl: string }>(`/admin/staff/${staffId}/photo`, form, "POST");
  },

  adminCustomers: (params: { q?: string; page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return request<{ customers: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/admin/customers${query ? `?${query}` : ""}`);
  },
  adminUpdateCustomer: (id: string, payload: any) => request<{ customer: any }>(`/admin/customers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  adminDeleteCustomer: (id: string) => request<{ ok: boolean }>(`/admin/customers/${id}`, { method: "DELETE" }),
  adminResetCustomerPassword: (id: string, password: string) => request<{ ok: boolean }>(`/admin/customers/${id}/password`, { method: "POST", body: JSON.stringify({ password }) }),

  adminGetAvailability: (staffId: string) => request<{ availability: any[] }>(`/admin/staff/${staffId}/availability`),
  adminSetAvailability: (staffId: string, days: any[]) => request<{ ok: boolean }>(`/admin/staff/${staffId}/availability`, { method: "PUT", body: JSON.stringify({ days }) }),

  // Admin: tienda online
  adminProducts: () => request<{ products: any[] }>(`/admin/products`),
  adminCreateProduct: (payload: any) => request<{ product: any }>(`/admin/products`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateProduct: (id: string, payload: any) => request<{ product: any }>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  adminDeleteProduct: (id: string) => request<{ ok: boolean }>(`/admin/products/${id}`, { method: "DELETE" }),
  adminUploadProductImage: (productId: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return requestForm<{ product: any; imageUrl: string }>(`/admin/products/${productId}/image`, form, "POST");
  },
  adminProductSales: (q: { branchId?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (q.branchId) qs.set("branchId", q.branchId);
    if (q.date) qs.set("date", q.date);
    const query = qs.toString();
    return request<{ sales: any[] }>(`/admin/product-sales${query ? `?${query}` : ""}`);
  },
  adminCreateProductSale: (payload: any) => request<{ sale: any }>(`/admin/product-sales`, { method: "POST", body: JSON.stringify(payload) }),
  adminStoreOrders: () => request<{ orders: any[] }>(`/admin/store-orders`),
  adminUpdateStoreOrder: (id: string, status: string) => request<{ order: any }>(`/admin/store-orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Admin: caja/pagos
  cashOpen: (branchId: string, openingCash: number, pin: string) => request<{ session: any; alreadyOpen?: boolean }>(`/admin/cash/open`, { method: "POST", body: JSON.stringify({ branchId, openingCash, pin }) }),
  cashCurrent: (branchId: string) => request<{ session: any | null; totals?: any }>(`/admin/cash/current?${new URLSearchParams({ branchId }).toString()}`),
  cashClose: (branchId: string, closingCashCounted: number, pin: string, notes?: string) =>
    request<{ session: any; summary: any }>(`/admin/cash/close`, { method: "POST", body: JSON.stringify({ branchId, closingCashCounted, pin, notes }) }),

  createPayment: (payload: any) => request<{ payment: any; commission: any; pointsAdded: number }>(`/admin/payments`, { method: "POST", body: JSON.stringify(payload) }),

  // Queue / Walk-ins (kiosk)
  queueCreateTicket: (payload: any) => request<{ ticket: any }>(`/queue/tickets`, { method: "POST", body: JSON.stringify(payload) }),
  queueTickets: (branchId: string, date?: string, staffId?: string) => {
    const qs = new URLSearchParams({ branchId });
    if (date) qs.set("date", date);
    if (staffId) qs.set("staffId", staffId);
    return request<{ tickets: any[] }>(`/queue/tickets?${qs.toString()}`);
  },
  queueUpdateTicket: (id: string, status: string) => request<{ ticket: any }>(`/queue/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  queuePromoteAppointment: (appointmentId: string) => request<{ ticket: any; alreadyExists?: boolean }>(`/queue/appointments/${encodeURIComponent(appointmentId)}/promote`, { method: "POST" }),
  queuePaidAppointments: (branchId: string, date?: string, staffId?: string) => {
    const qs = new URLSearchParams({ branchId });
    if (date) qs.set("date", date);
    if (staffId) qs.set("staffId", staffId);
    return request<{
      paidAppointments: {
        id: string;
        appointmentId: string;
        queueTicketId: string | null;
        customerName: string;
        ticketNumber: number | null;
        queueStatus: string | null;
        serviceName: string;
        staffName: string;
        startAt: string | null;
        paidAt: string;
      }[]
    }>(`/queue/paid-appointments?${qs.toString()}`);
  },

cashSessions: (q: { branchId: string; from?: string; to?: string }) => request(`/admin/cash/sessions?branchId=${encodeURIComponent(q.branchId)}&from=${encodeURIComponent(q.from ?? "")}&to=${encodeURIComponent(q.to ?? "")}`),
cashSessionReport: (sessionId: string) => request(`/admin/cash/sessions/${encodeURIComponent(sessionId)}/report`),
cashAddMovement: (body: { branchId: string; type: "IN"|"OUT"; amount: number; reason: string }) => request(`/admin/cash/movements`, { method: "POST", body: JSON.stringify(body) }),
cashMovementReport: (q: { from: string; to: string; branchId?: string; staffId?: string }) => request(`/admin/cash/movement-report?from=${encodeURIComponent(q.from)}&to=${encodeURIComponent(q.to)}&branchId=${encodeURIComponent(q.branchId ?? "")}&staffId=${encodeURIComponent(q.staffId ?? "")}`),
commissionsReport: (q: { from: string; to: string; branchId?: string; staffId?: string }) => request(`/admin/commissions?from=${encodeURIComponent(q.from)}&to=${encodeURIComponent(q.to)}&branchId=${encodeURIComponent(q.branchId ?? "")}&staffId=${encodeURIComponent(q.staffId ?? "")}`),
voidPayment: (paymentId: string, pin: string, reason: string) => request(`/admin/payments/${encodeURIComponent(paymentId)}/void`, { method: "POST", body: JSON.stringify({ pin, reason }) }),

};
