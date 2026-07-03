/// <reference types="vite/client" />

/**
 * API Client for Aicon X Backend
 * Replaces Base44 SDK with direct API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  // Set JWT token for authenticated requests
  setToken(token) {
    this.token = token;
  }

  // Get JWT token
  getToken() {
    return this.token;
  }

  // Clear token
  clearToken() {
    this.token = null;
  }

  // Build headers with token
  getHeaders(additionalHeaders = {}, isFormData = false) {
    const headers = {
      ...additionalHeaders
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add current language to headers
    const lang = localStorage.getItem('iqon_lang') || 'en';
    headers['Accept-Language'] = lang;

    return headers;
  }

  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    // Prevent common bugs by checking for 'undefined' or 'null' in the URL
    // We check for both string and actual values
    if (typeof endpoint !== 'string' || endpoint.includes('undefined') || endpoint.includes('null')) {
      console.warn(`API Client: Blocked request to invalid endpoint: ${endpoint}`);
      throw new Error(`Invalid API endpoint: ${endpoint}`);
    }

    const url = `${this.baseURL}${endpoint}`;
    const {
      method = 'GET',
      body = null,
      headers: additionalHeaders = {},
      ...otherOptions
    } = options;

    const isFormData = body instanceof FormData;
    const headers = this.getHeaders(additionalHeaders, isFormData);

    const config = {
      method,
      headers,
      body: undefined,
      ...otherOptions
    };

    // Only set Content-Type and body if we have a body and it's not a GET/HEAD request
    if (body != null && !['GET', 'HEAD'].includes(method)) {
      if (isFormData) {
        config.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, config);

      // Handle unauthorized
      if (response.status === 401) {
        this.clearToken();
        localStorage.removeItem('iqon_token');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Unauthorized - Please login again');
      }

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          console.error(`Failed to parse JSON from ${endpoint}:`, text);
          data = { error: 'Invalid server response', message: text };
        }
      } else {
        data = await response.text();
      }

      const error = new Error(data?.message || data?.error || `API Error: ${response.status}`);
      error.status = response.status;
      error.details = data?.details; // Save validation details
      
      if (!response.ok) {
        // Detailed validation error logging
        if (data?.details && Array.isArray(data.details)) {
          const detailStr = data.details.map(d => {
            if (typeof d === 'string') return d;
            if (d?.path && Array.isArray(d.path)) {
              return `${d.path.join('.')}: ${d.message || 'Validation error'}`;
            }
            return d?.message || JSON.stringify(d);
          }).join(', ');
          console.error(`API Validation Error [${endpoint}]: ${detailStr}`, data.details);
        } else if (response.status !== 404) {
          console.error(`API Error [${endpoint}]: ${error.message}`, error);
        }
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.error(`Network Error [${endpoint}]: Please check your internet connection.`);
        throw new Error('Network error - could not connect to server');
      }
      // Only log if it's not a 404 error (already logged above) or if already logged
      if (error.status !== 404) {
        console.error(`API Error [${endpoint}]:`, error);
      }
      throw error;
    }
  }

  // GET request
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  // POST request
  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  // PUT request
  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  // PATCH request
  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  // DELETE request
  delete(endpoint, body = null, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE', body });
  }

  // Build query string from object
  buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else {
          searchParams.append(key, value);
        }
      }
    }
    return searchParams.toString();
  }
}

// Create singleton instance
export const apiClient = new APIClient();

// Export individual entity API modules
export const authAPI = {
  login: async (email, password, rememberMe = false) => {
    const data = await apiClient.post('/auth/login', { email, password, rememberMe });
    if (data.token) {
      apiClient.setToken(data.token);
      localStorage.setItem('iqon_token', data.token);
    }
    return data;
  },
  googleLogin: async (idToken) => {
    const data = await apiClient.post('/auth/google-login', { idToken });
    if (data.token) {
      apiClient.setToken(data.token);
      localStorage.setItem('iqon_token', data.token);
    }
    return data;
  },
  register: async (userData) => {
    const data = await apiClient.post('/auth/register', userData);
    if (data.token) {
      apiClient.setToken(data.token);
      localStorage.setItem('iqon_token', data.token);
    }
    return data;
  },
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.patch('/auth/me', data),
  updatePassword: (currentPassword, newPassword) => apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  updateEmail: (newEmail, password) => apiClient.post('/auth/change-email', { newEmail, password }),
  verifyEmail: (newEmail, token) => apiClient.post('/auth/verify-email', { newEmail, token }),
  updatePhone: (newPhone) => apiClient.post('/auth/change-phone', { newPhone }),
  verifyPhone: (newPhone, token) => apiClient.post('/auth/verify-phone', { newPhone, token }),
  setup2FA: () => apiClient.post('/auth/2fa/setup', {}),
  enable2FA: (token) => apiClient.post('/auth/2fa/enable', { token }),
  disable2FA: (token) => apiClient.post('/auth/2fa/disable', { token }),
  verify2FALogin: (twoFactorToken, token) => apiClient.post('/auth/login/2fa', { two_factor_token: twoFactorToken, token }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => apiClient.post('/auth/reset-password', { token, newPassword }),
  // Address Management
  getAddresses: () => apiClient.get('/auth/me/addresses'),
  addAddress: (address) => apiClient.post('/auth/me/addresses', address),
  updateAddress: (addressId, address) => apiClient.put(`/auth/me/addresses/${addressId}`, address),
  deleteAddress: (addressId) => apiClient.delete(`/auth/me/addresses/${addressId}`),
  setDefaultAddress: (addressId) => apiClient.patch(`/auth/me/addresses/${addressId}/default`, {}),
  // WebAuthn
  getWebAuthnRegisterOptions: () => apiClient.get('/auth/webauthn/register-options'),
  verifyWebAuthnRegister: (response) => apiClient.post('/auth/webauthn/register-verify', response),
  getWebAuthnLoginOptions: (email) => apiClient.post('/auth/webauthn/login-options', { email }),
  verifyWebAuthnLogin: (email, response) => {
    return apiClient.post('/auth/webauthn/login-verify', { email, response }).then(data => {
      if (data.token) {
        apiClient.setToken(data.token);
        localStorage.setItem('iqon_token', data.token);
      }
      return data;
    });
  },
  logout: () => {
    apiClient.clearToken();
    localStorage.removeItem('iqon_token');
  },
  initialize: () => {
    const token = localStorage.getItem('iqon_token');
    if (token) {
      apiClient.setToken(token);
    }
    return token;
  }
};

export const followsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows?${query}`);
  },
  follow: (followingUsername, followType = 'user', targetId = null) => 
    apiClient.post('/follows', { following_username: followingUsername, follow_type: followType, target_id: targetId }),
  unfollow: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.delete(`/follows?${query}`);
  },
  check: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/check?${query}`);
  },
  getFollowers: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/followers?${query}`);
  },
  getFollowing: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/following?${query}`);
  },
  getCounts: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/counts?${query}`);
  },
  getMyFollowing: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows/me/following?${query}`);
  },
  getMyFollowers: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows/me/followers?${query}`);
  }
};

export const followAPI = followsAPI;

export const productsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/products?${query}`);
  },
  get: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.patch(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  search: (query) => apiClient.get(`/products/search?q=${encodeURIComponent(query)}`),
  getTopSelling: (limit = 10) => apiClient.get(`/products/top-selling?limit=${limit}`),
  getRelated: (id, limit = 10) => apiClient.get(`/products/related/${id}?limit=${limit}`),
  getRecommendations: (limit = 10) => apiClient.get(`/products/recommendations?limit=${limit}`),
};

export const ordersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/orders?${query}`);
  },
  get: (id) => apiClient.get(`/orders/${id}`),
  create: (data) => apiClient.post('/orders', data),
  updateStatus: (id, status) => apiClient.patch(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => apiClient.patch(`/orders/${id}/status`, { status: 'cancelled' })
};

export const cartAPI = {
  get: () => apiClient.get('/cart'),
  add: (data) => apiClient.post('/cart', data),
  update: (itemId, data) => apiClient.put(`/cart/${itemId}`, data),
  remove: (itemId) => apiClient.delete(`/cart/${itemId}`),
  clear: () => apiClient.delete('/cart')
};

export const checkoutAPI = {
  process: (data) => apiClient.post('/checkout', data),
  verifyPayment: (orderId, reference) => apiClient.post(`/checkout/${orderId}/verify-payment`, { reference }),
};

export const couponsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/coupons?${query}`);
  },
  get: (id) => apiClient.get(`/coupons/${id}`),
  getByCode: (code) => apiClient.get(`/coupons/code/${code}`),
  create: (data) => apiClient.post('/coupons', data),
  update: (id, data) => apiClient.put(`/coupons/${id}`, data),
  delete: (id) => apiClient.delete(`/coupons/${id}`),
  validate: (code) => apiClient.get(`/coupons/validate/${code}`),
  validateForCart: (data) => apiClient.post('/coupons/validate', data),
  apply: (id) => apiClient.post(`/coupons/${id}/apply`, {}),
  listForVendor: (filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/coupons/vendor/me?${query}`);
  }
};

export const shippingZonesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/shipping-zones?${query}`);
  },
  get: (id) => apiClient.get(`/shipping-zones/${id}`),
  getByVendor: (vendorUsername) => apiClient.get(`/shipping-zones/vendor/${vendorUsername}`),
  getByStore: (storeId) => apiClient.get(`/shipping-zones/store/${storeId}`),
  listByStore: (storeId) => apiClient.get(`/shipping-zones?store_id=${storeId}`),
  listByStores: (storeIds) => apiClient.get(`/shipping-zones?store_ids=${storeIds.join(',')}`),
  create: (data) => apiClient.post('/shipping-zones', data),
  update: (id, data) => apiClient.put(`/shipping-zones/${id}`, data),
  delete: (id) => apiClient.delete(`/shipping-zones/${id}`),
  calculate: (id, data) => apiClient.post(`/shipping-zones/${id}/calculate`, data),
  getAvailable: (countryCode, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/shipping-zones/available/${countryCode}?${query}`);
  },
};

export const postsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/posts?${query}`);
  },
  get: (id, params = {}) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/posts/${id}${query ? `?${query}` : ''}`);
  },
  create: (data) => apiClient.post('/posts', data),
  update: (id, data) => apiClient.patch(`/posts/${id}`, data),
  delete: (id) => apiClient.delete(`/posts/${id}`),
  like: (id) => likesAPI.like('post', id),
  unlike: (id) => likesAPI.unlike('post', id),
  share: (id) => apiClient.patch(`/posts/${id}`, { $inc: { shares_count: 1 } }), // Direct increment for simplicity
};

export const bookmarksAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/bookmarks?${query}`);
  },
  check: (targetType, targetId) => apiClient.get(`/bookmarks/check?target_type=${targetType}&target_id=${targetId}`),
  add: (data) => apiClient.post('/bookmarks', data),
  remove: (targetType, targetId) => apiClient.delete(`/bookmarks?target_type=${targetType}&target_id=${targetId}`),
};

export const commentsAPI = {
  list: (postId, filters = {}) => {
    const query = apiClient.buildQueryString({ ...filters, post_id: postId });
    return apiClient.get(`/comments?${query}`);
  },
  get: (id) => apiClient.get(`/comments/${id}`),
  getThread: (id) => apiClient.get(`/comments/${id}/thread`),
  create: (data) => apiClient.post('/comments', data),
  update: (id, data) => apiClient.put(`/comments/${id}`, data),
  delete: (id) => apiClient.delete(`/comments/${id}`),
  like: (id) => likesAPI.like('comment', id),
  unlike: (id) => likesAPI.unlike('comment', id),
};

export const likesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/likes?${query}`);
  },
  check: (targetType, targetId) => apiClient.get(`/likes/check?target_type=${targetType}&target_id=${targetId}`),
  like: (targetType, targetId) => apiClient.post('/likes', { target_type: targetType, target_id: targetId }),
  unlike: (targetType, targetId) => apiClient.delete(`/likes?target_type=${targetType}&target_id=${targetId}`),
  getCount: (targetType, targetId) => apiClient.get(`/likes/count?target_type=${targetType}&target_id=${targetId}`),
  getUserLikes: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/likes/user?${query}`);
  }
};

export const withdrawalsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals?${query}`);
  },
  listByUsername: (username, filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals/vendor/username/${username}?${query}`);
  },
  get: (id) => apiClient.get(`/withdrawals/${id}`),
  getByVendor: (username) => apiClient.get(`/withdrawals/vendor/${username}`),
  create: (data) => apiClient.post('/withdrawals', data),
  update: (id, data) => apiClient.put(`/withdrawals/${id}`, data),
  updateStatus: (id, data) => apiClient.put(`/withdrawals/${id}/status`, data),
  delete: (id) => apiClient.delete(`/withdrawals/${id}`),
  getOverview: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals/stats/overview?${query}`);
  },
};

export const vendorSubscriptionsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/vendor-subscriptions?${query}`);
  },
  get: (id) => apiClient.get(`/vendor-subscriptions/${id}`),
  getByVendor: (username) => apiClient.get(`/vendor-subscriptions/vendor/${username}`),
  getByStore: (storeId) => apiClient.get(`/vendor-subscriptions/store/${storeId}`),
  create: (data) => apiClient.post('/vendor-subscriptions', data),
  update: (id, data) => apiClient.put(`/vendor-subscriptions/${id}`, data),
  cancel: (id) => apiClient.post(`/vendor-subscriptions/${id}/cancel`, {}),
  renew: (id) => apiClient.post(`/vendor-subscriptions/${id}/renew`, {}),
  delete: (id) => apiClient.delete(`/vendor-subscriptions/${id}`),
  getStatus: (id) => apiClient.get(`/vendor-subscriptions/${id}/status`),
  getPlans: () => apiClient.get('/vendor-subscriptions/public/plans'),
  updatePlans: (plan_prices) => apiClient.put('/vendor-subscriptions/public/plans', { plan_prices }),
  verifyPayment: (id, reference) => apiClient.post(`/vendor-subscriptions/${id}/verify-payment`, { reference }),
};

export const reportsAPI = {
  create: (data) => apiClient.post('/reports', data),
  getMe: () => apiClient.get('/reports/me'),
};

export const adminAPI = {
  getStats: () => apiClient.get('/admin/stats'),
  // Users
  getUsers: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/users?${query}`);
  },
  updateUserBlockStatus: (id, is_blocked) => apiClient.patch(`/admin/users/${id}/block`, { is_blocked }),
  bulkUpdateUserBlockStatus: (userIds, is_blocked) => apiClient.patch('/admin/users/bulk-block', { userIds, is_blocked }),
  updateUserRole: (id, role) => apiClient.patch(`/admin/users/${id}/role`, { role }),
  updateUserVerification: (id, is_verified) => apiClient.patch(`/admin/users/${id}/verify`, { is_verified }),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  // Stores
  getStores: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/stores?${query}`);
  },
  getStoreProducts: (storeId, params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/stores/${storeId}/products?${query}`);
  },
  updateStoreStatus: (id, status) => apiClient.patch(`/admin/stores/${id}/status`, { status }),
  bulkUpdateStoreStatus: (storeIds, status) => apiClient.patch('/admin/stores/bulk-status', { storeIds, status }),
  updateStoreVerification: (id, is_verified) => apiClient.patch(`/admin/stores/${id}/verify`, { is_verified }),
  deleteStore: (id) => apiClient.delete(`/admin/stores/${id}`),
  // Products
  getProducts: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/products?${query}`);
  },
  updateProductStatus: (id, status) => apiClient.patch(`/admin/products/${id}/status`, { status }),
  deleteProduct: (id) => apiClient.delete(`/admin/products/${id}`),
  // Orders
  getOrders: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/orders?${query}`);
  },
  updateOrderStatus: (id, status) => apiClient.patch(`/admin/orders/${id}/status`, { status }),
  // Withdrawals
  getWithdrawals: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/withdrawals?${query}`);
  },
  updateWithdrawalStatus: (id, status, notes) => apiClient.patch(`/admin/withdrawals/${id}/status`, { status, notes }),
  // Settings
  updateSettings: (data) => apiClient.patch('/admin/settings', data),
  // Reports
  getReports: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/reports?${query}`);
  },
  resolveReport: (id, status, admin_notes) => apiClient.patch(`/admin/reports/${id}/resolve`, { status, admin_notes }),
  // Activity Logs
  getActivityLogs: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/activity-logs?${query}`);
  },
  // Announcements
  getAnnouncements: () => apiClient.get('/admin/announcements'),
  createAnnouncement: (data) => apiClient.post('/admin/announcements', data),
  updateAnnouncement: (id, data) => apiClient.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => apiClient.delete(`/admin/announcements/${id}`),
  // Posts
  getPosts: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/posts?${query}`);
  },
  updatePostVisibility: (id, visibility) => apiClient.patch(`/admin/posts/${id}/visibility`, { visibility }),
  deletePost: (id) => apiClient.delete(`/admin/posts/${id}`),
  // Subscriptions
  getSubscriptions: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/admin/subscriptions?${query}`);
  },
  cancelSubscription: (id) => apiClient.post(`/admin/subscriptions/${id}/cancel`, {}),
  getSubscriptionPlans: () => apiClient.get('/admin/subscriptions/plans'),
  updateSubscriptionPlans: (planPrices) => apiClient.put('/admin/subscriptions/plans', { plan_prices: planPrices }),
};

export const announcementsAPI = {
  getActive: () => apiClient.get('/announcements/active'),
};

export const storesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stores?${query}`);
  },
  get: (id) => apiClient.get(`/stores/${id}`),
  create: (data) => apiClient.post('/stores', data),
  update: (id, data) => apiClient.patch(`/stores/${id}`, data),
  getByOwner: (username) => apiClient.get(`/stores/owner/${username}`),
  getByOwnerUsername: (username) => apiClient.get(`/stores/owner/username/${username}`)
};

export const usersAPI = {
  getProfile: (usernameOrEmail) => apiClient.get(`/users/${usernameOrEmail}`),
  getStatus: (usernameOrEmail) => apiClient.get(`/users/${usernameOrEmail}/status`),
  search: (query) => apiClient.get(`/users/search?q=${encodeURIComponent(query)}`),
  getSuggested: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/users/suggested?${query}`);
  },
  registerPushToken: (token) => apiClient.post('/users/push-token', { token }),
  unregisterPushToken: (token) => apiClient.delete('/users/push-token', { token })
};

export const communitiesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/communities?${query}`);
  },
  get: (id) => apiClient.get(`/communities/${id}`),
  getByName: (name) => apiClient.get(`/communities/name/${name}`),
  create: (data) => apiClient.post('/communities', data),
  update: (id, data) => apiClient.put(`/communities/${id}`, data),
  delete: (id) => apiClient.delete(`/communities/${id}`),
  listForMe: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/communities/user/me?${query}`);
  },
  join: (id) => apiClient.post(`/communities/${id}/join`, {}),
  leave: (id) => apiClient.post(`/communities/${id}/leave`, {})
};

export const communityMembersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/community-members?${query}`);
  },
  create: (data) => apiClient.post('/community-members', data),
  update: (id, data) => apiClient.put(`/community-members/${id}`, data),
  delete: (id) => apiClient.delete(`/community-members/${id}`),
  check: (communityId) => apiClient.get(`/community-members/check?community_id=${communityId}`),
  getMe: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/community-members/me?${query}`);
  },
  bulkAdd: (data) => apiClient.post('/community-members/bulk', data)
};

export const messagesAPI = {
  listConversations: () => apiClient.get('/messages/conversations'),
  list: (conversationId) => apiClient.get(`/messages/${conversationId}`),
  query: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/messages?${query}`);
  },
  send: (data) => apiClient.post('/messages', data),
  update: (id, data) => apiClient.patch(`/messages/${id}`, data),
  delete: (id) => apiClient.delete(`/messages/${id}`),
  markAsRead: (id) => apiClient.patch(`/messages/${id}/read`, {}),
  markConversationAsRead: (conversationId) => apiClient.patch(`/messages/conversation/${conversationId}/read`, {}),
};

export const callsAPI = {
  create: (data) => apiClient.post('/calls', data),
  getIncoming: () => apiClient.get('/calls/incoming'),
  answer: (id) => apiClient.post(`/calls/${id}/answer`),
  reject: (id) => apiClient.post(`/calls/${id}/reject`),
  end: (id, data) => apiClient.post(`/calls/${id}/end`, data),
  getHistory: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/calls/history?${query}`);
  },
  markMissed: () => apiClient.post('/calls/missed'),
};

export const notificationsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/notifications?${query}`);
  },
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/read-all'),
  delete: (id) => apiClient.delete(`/notifications/${id}`)
};

export const wishlistAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/wishlist?${query}`);
  },
  check: (productId) => apiClient.get(`/wishlist/check/${productId}`),
  add: (data) => apiClient.post('/wishlist', data),
  update: (productId, data) => apiClient.put(`/wishlist/${productId}`, data),
  remove: (productId) => apiClient.delete(`/wishlist/${productId}`),
  getStats: () => apiClient.get('/wishlist/stats'),
  bulkAdd: (data) => apiClient.post('/wishlist/bulk', data),
  clear: () => apiClient.delete('/wishlist'),
  getPopular: (limit = 20) => apiClient.get(`/wishlist/popular/items?limit=${limit}`)
};

export const reviewsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/reviews?${query}`);
  },
  get: (id) => apiClient.get(`/reviews/${id}`),
  create: (data) => apiClient.post('/reviews', data),
  update: (id, data) => apiClient.put(`/reviews/${id}`, data),
  delete: (id) => apiClient.delete(`/reviews/${id}`),
  markHelpful: (id) => likesAPI.like('review', id),
  getSummary: (productId) => apiClient.get(`/reviews/product/${productId}/summary`),
};

export const storeReviewsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/store-reviews?${query}`);
  },
  get: (id) => apiClient.get(`/store-reviews/${id}`),
  getByStore: (storeId, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/store-reviews/store/${storeId}?${query}`);
  },
  getByReviewer: (reviewerUsername) => apiClient.get(`/store-reviews/reviewer/${reviewerUsername}`),
  create: (data) => apiClient.post('/store-reviews', data),
  update: (id, data) => apiClient.put(`/store-reviews/${id}`, data),
  reply: (id, replyText) => apiClient.post(`/store-reviews/${id}/reply`, { reply: replyText }),
  markHelpful: (id) => apiClient.post(`/store-reviews/${id}/helpful`, {}),
  delete: (id) => apiClient.delete(`/store-reviews/${id}`),
  getStats: (storeId) => apiClient.get(`/store-reviews/stats/${storeId}`),
};

export const storiesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stories?${query}`);
  },
  get: (id) => apiClient.get(`/stories/${id}`),
  getByUser: (username) => apiClient.get(`/stories/user/${username}`),
  getMe: () => apiClient.get('/stories/user/me'),
  getFeed: () => apiClient.get('/stories/feed'),
  create: (data) => apiClient.post('/stories', data),
  update: (id, data) => apiClient.put(`/stories/${id}`, data),
  view: (id) => apiClient.post(`/stories/${id}/view`, {}),
  like: (id) => likesAPI.like('story', id),
  unlike: (id) => likesAPI.unlike('story', id),
  reply: (id, text) => apiClient.post(`/stories/${id}/reply`, { text }),
  delete: (id) => apiClient.delete(`/stories/${id}`),
  cleanup: () => apiClient.post('/stories/cleanup', {})
};

export const filesAPI = {
  getStorageStatus: () => apiClient.get('/files/storage-status'),
  getPresignedUrl: (filename, contentType, folder = 'media') => {
    const query = apiClient.buildQueryString({ filename, contentType, folder });
    return apiClient.get(`/files/presigned-url?${query}`);
  },
  // Upload to S3 using presigned URL (client-side direct upload)
  uploadToS3: async (file, presignedData) => {
    try {
      const { uploadUrl, key, cloudFrontDomain } = presignedData;
      
      // Direct upload to S3 using presigned URL
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.statusText}`);
      }

      // Construct CloudFront URL
      const url = cloudFrontDomain 
        ? `https://${cloudFrontDomain}/${key}`
        : uploadUrl.split('?')[0];

      return {
        url,
        key,
        provider: 's3',
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  },
  // Fallback to Cloudinary upload
  uploadToCloudinary: async (file, signatureData) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.api_key);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);
    formData.append('folder', signatureData.folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    return await response.json();
  },
  // Backend upload (base64)
  upload: async (file, options = {}) => {
    const { onProgress } = options;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          // Reading progress (0-50%)
          const progress = Math.round((e.loaded / e.total) * 50);
          onProgress(progress);
        }
      };
      
      reader.onloadend = async () => {
        try {
          const base64 = reader.result;
          
          if (onProgress) onProgress(50); // Reading complete
          
          console.log('Uploading file:', {
            name: file.name,
            type: file.type,
            size: `${Math.round(file.size / 1024)}KB`,
          });
          
          const response = await apiClient.post('/files/upload', { 
            file: base64,
            filename: file.name,
            contentType: file.type,
            folder: options.folder || 'media',
          });
          
          if (onProgress) onProgress(100); // Upload complete
          resolve(response);
        } catch (error) {
          console.error('File upload failed:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        const error = new Error('Failed to read file');
        console.error('FileReader error:', error);
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  },
  uploadDirect: (fileBase64, options = {}) => apiClient.post('/files/upload', { 
    file: fileBase64,
    ...options 
  }),
  delete: (keyOrPublicId, provider) => {
    const query = provider ? apiClient.buildQueryString({ provider }) : '';
    return apiClient.delete(`/files/${keyOrPublicId}${query ? `?${query}` : ''}`);
  },
};

export const paymentAPI = {
   itecpay: {
     initialize: (data) => apiClient.post('/payments/itecpay/initialize', data),
     verify: (data) => apiClient.post('/payments/itecpay/verify', data),
   }
};

export const affiliateLinksAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links?${query}`);
  },
  get: (id) => apiClient.get(`/affiliate-links/${id}`),
  getByRefCode: (refCode) => apiClient.get(`/affiliate-links/ref/${refCode}`),
  create: (data) => apiClient.post('/affiliate-links', data),
  update: (id, data) => apiClient.put(`/affiliate-links/${id}`, data),
  delete: (id) => apiClient.delete(`/affiliate-links/${id}`),
  trackClick: (refCode) => apiClient.post(`/affiliate-links/ref/${refCode}/click`, {}),
  listForMe: (filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links/influencer/me?${query}`);
  },
  listByProduct: (productId, filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links/product/${productId}?${query}`);
  },
  getLeaderboard: (params = {}) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/affiliate-links/leaderboard?${query}`);
  },
};

export const aiAPI = {
  health: () => apiClient.get('/ai/health'),
  invoke: (data) => apiClient.post('/ai/invoke', data),
  chat: (prompt, messages = [], system_prompt) => apiClient.post('/ai/chat', { prompt, messages, system_prompt }),
  assistant: (message, history = [], init = false, language = 'en') => apiClient.post('/ai/assistant', { message, history, init, language }),
  generateProductDescription: (data) => apiClient.post('/ai/generate-product-description', data),
  generateProductContent: (data) => apiClient.post('/ai/generate-product-content', data),
  generateSentimentSummary: (data) => apiClient.post('/ai/generate-sentiment-summary', data),
  translate: (data) => apiClient.post('/ai/translate', data),
};

export const sentimentAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get('/sentiment-summaries?' + query);
  },
  get: (id) => apiClient.get(`/sentiment-summaries/${id}`),
  getByProduct: (productId) => apiClient.get(`/sentiment-summaries/product/${productId}`),
  create: (data) => apiClient.post('/sentiment-summaries', data),
  update: (id, data) => apiClient.put(`/sentiment-summaries/${id}`, data),
  delete: (id) => apiClient.delete(`/sentiment-summaries/${id}`),
  getStats: () => apiClient.get('/sentiment-summaries/stats/overview'),
};

export default apiClient;
