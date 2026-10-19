const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('market_linkage_token');
  }

  setToken(token: string) {
    localStorage.setItem('market_linkage_token', token);
  }

  clearToken() {
    localStorage.removeItem('market_linkage_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errMessage = `HTTP Error ${res.status}`;
      try {
        const errorData = await res.json();
        errMessage = errorData.error || errorData.message || errMessage;
      } catch {
        // Fallback to status text
      }
      throw new Error(errMessage);
    }

    return res.json();
  }

  // --- AUTH ---
  async login(credentials: { email: string; password: string }) {
    return this.request<{ message: string; token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(data: any) {
    return this.request<{ message: string; token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser() {
    return this.request<{ user: any }>('/api/auth/me');
  }

  // --- PRODUCTS ---
  async getProducts(params: Record<string, any> = {}, lang?: string) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });
    if (lang) {
      searchParams.append('lang', lang);
    }
    return this.request<{ products: any[]; pagination: any }>(`/api/products?${searchParams.toString()}`);
  }

  async getProduct(id: string, lang?: string) {
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    return this.request<{ product: any }>(`/api/products/${id}${qs}`);
  }

  async translateText(text: string, source_lang: string = 'ta', target_lang: string = 'en') {
    return this.request<{ success: boolean; original_text: string; translated_text: string; source_lang: string; target_lang: string }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, source_lang, target_lang }),
    });
  }

  async createProduct(data: any) {
    return this.request<{ message: string; product_id: string; duplicate_warnings?: any[] }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<{ message: string; product?: any }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateProductStock(id: string, stockQuantity: number) {
    return this.request<{ message: string; stock_quantity: number }>(`/api/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock_quantity: stockQuantity }),
    });
  }

  async archiveProduct(id: string) {
    return this.request<{ message: string }>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getSellerInventory() {
    return this.request<{ products: any[] }>('/api/products/seller-inventory');
  }

  async uploadProductImage(file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.request<{ message: string; image_url: string; hashes: any; is_duplicate_suspected: boolean; duplicate_matches: any[] }>('/api/products/upload-image', {
      method: 'POST',
      body: fd,
    });
  }

  async aiCatalogGenerate(payload: { image?: File; image_url?: string; title?: string; notes?: string; auto_enhance?: boolean }) {
    if (payload.image) {
      const fd = new FormData();
      fd.append('image', payload.image);
      if (payload.notes) fd.append('notes', payload.notes);
      if (payload.auto_enhance !== undefined) fd.append('auto_enhance', String(payload.auto_enhance));
      return this.request<{ suggestion: any; image_url?: string; enhanced_image?: any; hashes?: any; duplicate_warnings?: any[] }>('/api/products/ai-catalog-generate', {
        method: 'POST',
        body: fd,
      });
    } else {
      return this.request<{ suggestion: any; image_url?: string; enhanced_image?: any }>('/api/products/ai-catalog-generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  }

  async getVoiceQuestions(language: string = 'ta') {
    return this.request<{
      language: string;
      questions: Array<{
        id: string;
        order: number;
        required: boolean;
        question_en: string;
        question_ta: string;
        hint_en: string;
        hint_ta: string;
        tts_text_en: string;
        tts_text_ta: string;
      }>;
      total_questions: number;
    }>(`/api/voice/questions?language=${encodeURIComponent(language)}`);
  }

  async processVoiceAnswer(payload: { field: string; spoken_text: string; language?: string; current_product?: any }) {
    return this.request<{
      is_valid: boolean;
      field: string;
      original_text: string;
      english_value?: any;
      display_text?: string;
      numeric_value?: number;
      associated_category?: string;
      associated_materials?: string;
      associated_description?: string;
      suggested_price?: number;
      price_suggestion?: any;
      error_message?: string;
      message?: string;
      confidence?: string;
    }>('/api/voice/process-answer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async suggestVoicePrice(payload: { category: string; materials: string; title?: string }) {
    return this.request<{
      suggested_price: number;
      price_range_min: number;
      price_range_max: number;
      explanation: string;
      explanation_ta: string;
      is_estimate: boolean;
    }>('/api/voice/suggest-price', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async enhanceProductBackground(payload: { image?: File; image_url?: string; backdrop_style?: string }) {
    if (payload.image) {
      const fd = new FormData();
      fd.append('image', payload.image);
      if (payload.backdrop_style) fd.append('backdrop_style', payload.backdrop_style);
      return this.request<{
        success: boolean;
        original_image_url: string;
        enhanced_image_url: string;
        service_used: string;
        backdrop_style: string;
        craft_fidelity: string;
        disclaimer: string;
      }>('/api/products/enhance-background', {
        method: 'POST',
        body: fd,
      });
    } else {
      return this.request<{
        success: boolean;
        original_image_url: string;
        enhanced_image_url: string;
        service_used: string;
        backdrop_style: string;
        craft_fidelity: string;
        disclaimer: string;
      }>('/api/products/enhance-background', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  }

  async calculateFairPrice(data: any) {
    return this.request<any>('/api/products/calculate-fair-price', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- VERIFICATION ---
  async getVerificationStatus(userId?: string) {
    const q = userId ? `?user_id=${userId}` : '';
    return this.request<{ verification: any }>(`/api/verification/status${q}`);
  }

  async getVerificationApplication(userId?: string) {
    const q = userId ? `?user_id=${userId}` : '';
    return this.request<{ application: any }>(`/api/verification/application${q}`);
  }

  async saveVerificationStep(step: number, payload: any) {
    return this.request<{ message: string; current_step: number; verification_status: string }>('/api/verification/application/save-step', {
      method: 'POST',
      body: JSON.stringify({ step, ...payload }),
    });
  }

  async submitVerificationApplication(data: any = {}) {
    return this.request<{ success: boolean; message: string; verification_status: string; submitted_at: string }>('/api/verification/submit-application', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reopenVerificationDraft() {
    return this.request<{ message: string; verification_status: string }>('/api/verification/application/reopen-draft', {
      method: 'POST',
    });
  }

  async submitVerification(notes?: string) {
    return this.request<{ message: string; verification_status: string }>('/api/verification/submit', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async uploadEvidence(file: File, evidenceType: string, description: string = '') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('evidence_type', evidenceType);
    fd.append('description', description);
    return this.request<{
      message: string;
      evidence_id: string;
      file_url: string;
      original_filename: string;
      evidence_type: string;
      is_video: boolean;
      file_size: number;
    }>('/api/verification/upload-evidence', {
      method: 'POST',
      body: fd,
    });
  }

  async deleteEvidence(evidenceId: string) {
    return this.request<{ message: string }>(`/api/verification/evidence/${evidenceId}`, {
      method: 'DELETE',
    });
  }

  async adminReviewVerification(data: { user_id: string; decision: string; reason: string; identity_verified?: boolean }) {
    return this.request<{ message: string; new_status: string; is_approved: boolean; history_entry: any }>('/api/verification/review', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- MATCHING & POOLING ---
  async createRequirement(data: any) {
    return this.request<{ message: string; requirement_id: string; initial_matches: any[] }>('/api/matching/requirements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRequirements(params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.append(k, String(v));
    });
    return this.request<{ requirements: any[] }>(`/api/matching/requirements?${searchParams.toString()}`);
  }

  async getRequirement(id: string) {
    return this.request<{ requirement: any }>(`/api/matching/requirements/${id}`);
  }

  async findSuppliers(data: any) {
    return this.request<{ matches: any[] }>('/api/matching/find-suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async nlpSearch(query: string) {
    return this.request<{ original_query: string; parsed_filters: any; ai_powered: boolean; matches_count: number; results: any[] }>('/api/matching/nlp-search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async getCollectivePoolPlan(requirementId: string, quantity: number, maxBudgetPerUnit?: number) {
    return this.request<{ plan: any }>('/api/matching/collective-pool-plan', {
      method: 'POST',
      body: JSON.stringify({ requirement_id: requirementId, quantity, max_budget_per_unit: maxBudgetPerUnit }),
    });
  }

  // --- QUOTATIONS ---
  async submitQuotation(data: any) {
    return this.request<{ message: string; quotation_id: string; total_price: number }>('/api/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQuotations(params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.append(k, String(v));
    });
    return this.request<{ quotations: any[] }>(`/api/quotations?${searchParams.toString()}`);
  }

  async getQuotation(id: string) {
    return this.request<{ quotation: any }>(`/api/quotations/${id}`);
  }

  async reviseQuotation(id: string, data: any) {
    return this.request<{ message: string; new_status: string; total_price: number }>(`/api/quotations/${id}/revise`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondQuotation(id: string, action: 'accept' | 'reject' | 'withdraw', reason?: string) {
    return this.request<{ message: string; status: string; quotation_id: string }>(`/api/quotations/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
  }

  // --- ORDERS ---
  async checkout(data: {
    items: { product_id: string; quantity: number }[];
    delivery_address: {
      full_name: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      pincode: string;
    };
    payment_method: string;
    idempotency_key?: string;
    notes?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      order_id: string;
      order_number: string;
      orders: any[];
      total_amount: number;
    }>('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createOrderFromQuotation(quotationId: string, deliveryAddress: any) {
    return this.request<{ message: string; order_id: string; order_number: string; status: string }>('/api/orders/create-from-quotation', {
      method: 'POST',
      body: JSON.stringify({ quotation_id: quotationId, delivery_address: deliveryAddress }),
    });
  }

  async getOrders(params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.append(k, String(v));
    });
    return this.request<{ orders: any[] }>(`/api/orders?${searchParams.toString()}`);
  }

  async getOrder(id: string) {
    return this.request<{ order: any }>(`/api/orders/${id}`);
  }

  async updateProductionProgress(orderId: string, stage: string, percentage: number, notes?: string) {
    return this.request<{ message: string; milestone: any }>(`/api/orders/${orderId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ stage, percentage, notes }),
    });
  }

  async dispatchOrder(orderId: string, carrier: string, trackingNumber: string, estimatedDelivery?: string) {
    return this.request<{ message: string; shipping_details: any }>(`/api/orders/${orderId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ carrier, tracking_number: trackingNumber, estimated_delivery: estimatedDelivery }),
    });
  }

  async confirmDelivery(orderId: string) {
    return this.request<{ message: string; status: string }>(`/api/orders/${orderId}/confirm-delivery`, {
      method: 'POST',
    });
  }

  async createReview(data: { order_id: string; rating: number; comment?: string; craftsmanship_rating?: number; delivery_rating?: number; communication_rating?: number }) {
    return this.request<{ message: string; review_id: string }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSellerReviews(sellerId: string) {
    return this.request<{ reviews: any[]; average_rating: number; total_reviews: number }>(`/api/reviews/seller/${sellerId}`);
  }

  async getMyReviewSummary() {
    try {
      return await this.request<{ average_rating: number; total_reviews: number }>('/api/reviews/my-summary');
    } catch {
      return { average_rating: 0, total_reviews: 0 };
    }
  }

  async raiseDispute(data: { order_id: string; reason: string; description: string }) {
    return this.request<{ message: string; dispute_id: string }>('/api/disputes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDisputes() {
    return this.request<{ disputes: any[] }>('/api/disputes');
  }

  async adminResolveDispute(disputeId: string, resolutionType: string, notes: string) {
    return this.request<{ message: string; resolution: any }>(`/api/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution_type: resolutionType, notes }),
    });
  }

  // --- MESSAGING & NOTIFICATIONS ---
  async getConversations() {
    return this.request<{ conversations: any[] }>('/api/messaging/conversations');
  }

  async createConversation(data: { recipient_id: string; subject?: string; initial_message?: string; product_id?: string; quotation_id?: string; order_id?: string }) {
    return this.request<{ conversation_id: string; message: string }>('/api/messaging/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMessages(conversationId: string) {
    return this.request<{ messages: any[]; subject: string }>(`/api/messaging/conversations/${conversationId}/messages`);
  }

  async sendMessage(conversationId: string, content: string) {
    return this.request<{ message: string; message_id: string; created_at: string }>(`/api/messaging/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getNotifications() {
    return this.request<{ notifications: any[]; unread_count: number }>('/api/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<{ message: string }>(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsRead() {
    return this.request<{ message: string }>('/api/notifications/mark-all-read', { method: 'POST' });
  }

  // --- ADMIN ---
  async getAdminOverview() {
    return this.request<{ metrics: any }>('/api/admin/overview-metrics');
  }

  async getAdminUsers(params: Record<string, any> = {}) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) sp.append(k, String(v)); });
    return this.request<{ users: any[]; pagination: any }>(`/api/admin/users?${sp.toString()}`);
  }

  async setUserStatus(userId: string, status: 'active' | 'suspended', reason?: string) {
    return this.request<{ message: string; status: string }>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  async getPendingVerifications() {
    return this.request<{ pending_verifications: any[] }>('/api/admin/verifications/pending');
  }

  async getDuplicateFlags(status: string = 'pending_review') {
    return this.request<{ duplicate_flags: any[] }>(`/api/admin/duplicate-flags?status=${status}`);
  }

  async reviewDuplicateFlag(flagId: string, decision: string, notes?: string) {
    return this.request<{ message: string; status: string }>(`/api/admin/duplicate-flags/${flagId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }

  async getAuditLogs() {
    return this.request<{ audit_logs: any[] }>('/api/admin/audit-logs');
  }

  // --- ANALYTICS ---
  async getSocialImpact() {
    return this.request<{ metrics: any; disclaimer: string }>('/api/analytics/social-impact');
  }

  async getDemandInsights() {
    return this.request<{ insights: any; data_source: string }>('/api/analytics/demand-insights');
  }

  // --- CONVENIENCE WRAPPERS ---
  async getMyProducts() {
    return this.getSellerInventory();
  }

  async getMyOrders() {
    return this.getOrders();
  }

  async getMyRequirements() {
    return this.getRequirements({ my: 'true' });
  }

  async getMyQuotations() {
    return this.getQuotations();
  }

  // --- ADMIN CONVENIENCE ---
  async getAdminMetrics() {
    try {
      const res = await this.request<{ metrics: any }>('/api/admin/overview-metrics');
      return (res as any).metrics || res;
    } catch {
      return {};
    }
  }

  async adminListUsers(params: Record<string, any> = {}) {
    return this.getAdminUsers(params);
  }

  async adminPendingVerifications() {
    try {
      const res = await this.getPendingVerifications();
      return { pending: (res as any).pending_verifications || [] };
    } catch {
      return { pending: [] };
    }
  }

  async adminDuplicateFlags() {
    try {
      const res = await this.getDuplicateFlags();
      return { flags: (res as any).duplicate_flags || [] };
    } catch {
      return { flags: [] };
    }
  }

  async adminUpdateUser(userId: string, data: { status?: string }) {
    if (data.status) {
      return this.setUserStatus(userId, data.status as 'active' | 'suspended');
    }
    return this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
export default api;
