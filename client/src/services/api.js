import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';
import { setAuth, logout } from '../modules/auth/authSlice';
import { adminApiPath } from '../config/admin';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  // credentials: 'include' sends the httpOnly refresh-token cookie on every request.
  // The server only reads it on /auth/refresh and /auth/logout — all other routes
  // ignore it. Required for the silent refresh flow. (#78)
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

// Mutex ensures only one refresh call happens at a time — concurrent 401s
// from parallel queries would otherwise each try to refresh and rotate the
// family multiple times, triggering false reuse-detection revocations.
const refreshMutex = new Mutex();

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) return result;
  // Never try to refresh if this IS the refresh call
  if (typeof args !== 'string' && args.url === '/auth/refresh') return result;

  // Wait if another request is already refreshing
  if (refreshMutex.isLocked()) {
    await refreshMutex.waitForUnlock();
    return rawBaseQuery(args, api, extraOptions);
  }

  const release = await refreshMutex.acquire();
  try {
    const state = api.getState();
    // RT is in an httpOnly cookie — we don't need to read it from state.
    // credentials: 'include' (set on rawBaseQuery) sends the cookie automatically.
    const refreshRes = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions
    );
    if (refreshRes.data?.accessToken) {
      api.dispatch(
        setAuth({
          accessToken: refreshRes.data.accessToken,
          profile: state.auth.profile,
          role: state.auth.role,
        })
      );
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      // Refresh failed (RT_REUSE, RT_REVOKED, expired). Log the user out.
      api.dispatch(logout());
    }
  } finally {
    release();
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me', 'Order', 'Worker', 'Earnings', 'AdminMetrics', 'Kyc', 'Plan', 'Subscription', 'Wallet', 'Notification', 'AdminUsers', 'Disputes', 'Payouts', 'Incentives', 'CancellationConfig', 'PricingCfg', 'AuditLogs', 'Addresses', 'Ad', 'Promo', 'Gamification', 'Recommendations', 'FeatureFlags', 'SupportTickets', 'Referral'],
  endpoints: (b) => ({
    // --- Auth ---
    requestOtp: b.mutation({
      query: (body) => ({ url: '/auth/otp/request', method: 'POST', body }),
    }),
    loginUser: b.mutation({
      query: (body) => ({ url: '/auth/user/login', method: 'POST', body }),
    }),
    loginWorker: b.mutation({
      query: (body) => ({ url: '/auth/worker/login', method: 'POST', body }),
    }),
    loginAdmin: b.mutation({
      query: (body) => ({ url: '/auth/admin/login', method: 'POST', body }),
    }),
    logout: b.mutation({
      query: (refreshToken) => ({ url: '/auth/logout', method: 'POST', body: { refreshToken } }),
    }),

    // --- User ---
    getMe: b.query({ query: () => '/users/me', providesTags: ['Me'] }),
    getAddresses: b.query({
      query: () => '/users/addresses',
      providesTags: ['Addresses'],
    }),
    addAddress: b.mutation({
      query: (body) => ({ url: '/users/addresses', method: 'POST', body }),
      invalidatesTags: ['Addresses'],
    }),
    deleteAddress: b.mutation({
      query: (addrId) => ({ url: `/users/addresses/${addrId}`, method: 'DELETE' }),
      invalidatesTags: ['Addresses'],
    }),
    saveRecentLocation: b.mutation({
      query: (body) => ({ url: '/users/recent-location', method: 'POST', body }),
    }),
    registerDeviceToken: b.mutation({
      query: (body) => ({ url: '/users/device-token', method: 'POST', body }),
    }),
    registerWorkerDeviceToken: b.mutation({
      query: (body) => ({ url: '/workers/device-token', method: 'POST', body }),
    }),

    // --- Pricing quote ---
    getQuote: b.query({ query: (params) => ({ url: '/orders/quote', params }) }),

    // --- Orders ---
    createOrder: b.mutation({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
      invalidatesTags: ['Order'],
    }),
    getOrder: b.query({
      query: (id) => `/orders/${id}`,
      providesTags: (r, e, id) => [{ type: 'Order', id }],
    }),
    listOrders: b.query({
      query: (page = 1) => `/orders/mine?page=${page}`,
      providesTags: ['Order'],
    }),
    getCancelPreview: b.query({
      query: (id) => `/orders/${id}/cancel-preview`,
    }),
    cancelOrder: b.mutation({
      query: ({ id, reason }) => ({ url: `/orders/${id}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: (r, e, a) => ['Order', { type: 'Order', id: a.id }],
    }),
    workerReportNoResponse: b.mutation({
      query: (id) => ({ url: `/orders/${id}/no-response`, method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'Order', id }],
    }),
    workerReportPartUnavailable: b.mutation({
      query: ({ id, partName, notes }) => ({ url: `/orders/${id}/part-unavailable`, method: 'POST', body: { partName, notes } }),
      invalidatesTags: (r, e, a) => [{ type: 'Order', id: a.id }],
    }),
    rateOrder: b.mutation({
      query: ({ id, rating, review }) => ({
        url: `/orders/${id}/rate`,
        method: 'POST',
        body: { rating, review },
      }),
      invalidatesTags: (r, e, a) => [{ type: 'Order', id: a.id }],
    }),
    getOrderInvoiceUrl: b.query({
      query: (id) => `/orders/${id}/invoice`,
    }),

    // --- Chat ---
    getChatMessages: b.query({
      query: ({ orderId, limit = 50 }) => `/orders/${orderId}/chat?limit=${limit}`,
      providesTags: (r, e, { orderId }) => [{ type: 'Order', id: `chat-${orderId}` }],
    }),
    sendChatMessage: b.mutation({
      query: ({ orderId, text, cannedCode }) => ({
        url: `/orders/${orderId}/chat`,
        method: 'POST',
        body: { text, cannedCode },
      }),
    }),

    // --- Worker ---
    getWorkerMe: b.query({ query: () => '/workers/me', providesTags: ['Me'] }),
    updateWorkerProfile: b.mutation({
      query: (body) => ({ url: '/workers/profile', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    goOnline: b.mutation({
      query: (body) => ({ url: '/workers/online', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),
    goOffline: b.mutation({
      query: () => ({ url: '/workers/offline', method: 'POST' }),
      invalidatesTags: ['Me'],
    }),
    getEarnings: b.query({
      query: (range = 'today') => `/workers/earnings?range=${range}`,
      providesTags: ['Earnings'],
    }),
    workerAccept: b.mutation({
      query: (id) => ({ url: `/orders/${id}/accept`, method: 'POST' }),
    }),
    workerReject: b.mutation({
      query: (id) => ({ url: `/orders/${id}/reject`, method: 'POST' }),
    }),
    workerStartTrip: b.mutation({
      query: (id) => ({ url: `/orders/${id}/start-trip`, method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'Order', id }],
    }),
    workerArrive: b.mutation({
      query: (id) => ({ url: `/orders/${id}/arrived`, method: 'POST' }),
      invalidatesTags: (r, e, id) => [{ type: 'Order', id }],
    }),
    workerStartService: b.mutation({
      query: ({ id, otp }) => ({ url: `/orders/${id}/start-service`, method: 'POST', body: { otp } }),
      invalidatesTags: (r, e, a) => [{ type: 'Order', id: a.id }],
    }),
    workerComplete: b.mutation({
      query: ({ id, completionPhotos = [] }) => ({
        url: `/orders/${id}/complete`,
        method: 'POST',
        body: { completionPhotos },
      }),
      invalidatesTags: (r, e, a) => ['Order', 'Earnings', { type: 'Order', id: a.id }],
    }),
    getWorkerOrders: b.query({
      query: (page = 1) => `/workers/orders?page=${page}`,
      providesTags: ['Order'],
    }),
    getNearbyWorkers: b.query({
      query: ({ lat, lng }) => `/workers/nearby?lat=${lat}&lng=${lng}`,
    }),
    getDemandZones: b.query({
      query: ({ lat, lng }) => `/workers/demand-zones?lat=${lat}&lng=${lng}`,
    }),

    // --- KYC ---
    getKycStatus: b.query({ query: () => '/workers/kyc/status', providesTags: ['Kyc'] }),
    submitKyc: b.mutation({
      query: (body) => ({ url: '/workers/kyc/submit', method: 'POST', body }),
      invalidatesTags: ['Kyc', 'Me'],
    }),
    presignUpload: b.mutation({
      query: (body) => ({ url: '/uploads/presign', method: 'POST', body }),
    }),

    // --- Admin ---
    adminMetrics: b.query({ query: () => adminApiPath('/metrics'), providesTags: ['AdminMetrics'] }),
    adminOrders: b.query({
      query: ({ status, page = 1 } = {}) => ({ url: adminApiPath('/orders'), params: { status, page } }),
    }),
    adminWorkers: b.query({
      query: ({ q, skill, online, page = 1 } = {}) => ({
        url: adminApiPath('/workers'),
        params: { q, skill, online, page },
      }),
    }),
    adminBlockWorker: b.mutation({
      query: ({ id, blocked }) => ({
        url: adminApiPath(`/workers/${id}/block`),
        method: 'POST',
        body: { blocked },
      }),
      invalidatesTags: ['Worker'],
    }),
    adminKycPending: b.query({
      query: () => adminApiPath('/kyc/pending'),
      providesTags: ['Kyc'],
    }),
    adminKycApprove: b.mutation({
      query: (id) => ({ url: adminApiPath(`/workers/${id}/kyc/approve`), method: 'POST' }),
      invalidatesTags: ['Kyc'],
    }),
    adminKycReject: b.mutation({
      query: ({ id, reason }) => ({
        url: adminApiPath(`/workers/${id}/kyc/reject`),
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Kyc'],
    }),

    // --- Plans / Subscriptions ---
    listPlans: b.query({
      query: (audience) => `/subscriptions/plans${audience ? `?audience=${audience}` : ''}`,
      providesTags: ['Plan'],
    }),
    mySubscription: b.query({
      query: () => '/subscriptions/me',
      providesTags: ['Subscription'],
    }),
    subscribe: b.mutation({
      query: (planCode) => ({
        url: '/subscriptions/subscribe',
        method: 'POST',
        body: { planCode },
      }),
    }),
    cancelSubscription: b.mutation({
      query: (id) => ({ url: `/subscriptions/${id}/cancel`, method: 'POST' }),
      invalidatesTags: ['Subscription'],
    }),

    // --- Wallet ---
    getWallet: b.query({ query: () => '/wallet', providesTags: ['Wallet'] }),
    walletTransactions: b.query({
      query: ({ page = 1, limit = 50 } = {}) => `/wallet/transactions?page=${page}&limit=${limit}`,
      providesTags: ['Wallet'],
    }),
    walletTopup: b.mutation({
      query: (amountPaise) => ({
        url: '/wallet/topup',
        method: 'POST',
        body: { amountPaise },
      }),
    }),

    // --- Payments ---
    verifyPayment: b.mutation({
      query: (body) => ({ url: '/payments/verify', method: 'POST', body }),
      invalidatesTags: ['Subscription', 'Wallet'],
    }),

    // --- Notifications ---
    listNotifications: b.query({
      query: ({ page = 1, unreadOnly = false } = {}) =>
        `/notifications?page=${page}&unreadOnly=${unreadOnly}`,
      providesTags: ['Notification'],
    }),
    markNotificationRead: b.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),
    markAllNotificationsRead: b.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notification'],
    }),

    // --- Pricing (public) ---
    getPricingConfig: b.query({ query: () => '/pricing' }),
    adminUpdatePricing: b.mutation({
      query: (body) => ({ url: adminApiPath('/pricing'), method: 'PATCH', body }),
    }),
    adminToggles: b.mutation({
      query: (body) => ({ url: adminApiPath('/toggles'), method: 'PATCH', body }),
    }),
    adminToggleDispatch: b.mutation({
      query: (body) => ({ url: adminApiPath('/dispatch/toggle'), method: 'PATCH', body }),
    }),
    adminRevenue: b.query({
      query: (days = 7) => adminApiPath(`/revenue?days=${days}`),
    }),

    // --- Admin: Extended ---
    adminAnalytics: b.query({
      query: (days = 30) => adminApiPath(`/analytics?days=${days}`),
    }),
    // Founder Audit (scenarios 96-98)
    adminOrderAudit: b.query({
      query: (orderId) => adminApiPath(`/audit/order/${orderId}`),
    }),
    adminCommissionAudit: b.query({
      query: (days = 7) => adminApiPath(`/audit/commission?days=${days}`),
    }),
    adminWorkerTrustAudit: b.query({
      query: () => adminApiPath('/audit/worker-trust'),
    }),
    adminReconciliationQueue: b.query({
      query: () => adminApiPath('/payments/reconciliation-queue'),
    }),
    adminReconcilePayment: b.mutation({
      query: (razorpayOrderId) => ({ url: adminApiPath(`/payments/${razorpayOrderId}/reconcile`), method: 'POST' }),
    }),
    // Business Intelligence (scenarios 81-85)
    adminServicePnL: b.query({
      query: (days = 30) => adminApiPath(`/business/service-pnl?days=${days}`),
    }),
    adminChurnRisk: b.query({
      query: () => adminApiPath('/business/churn-risk'),
    }),
    adminDeadCategories: b.query({
      query: (days = 30) => adminApiPath(`/business/dead-categories?days=${days}`),
    }),
    adminGeoReadiness: b.query({
      query: ({ lat, lng, radiusKm = 15 }) => adminApiPath(`/business/geo-readiness?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
    }),
    adminQuoteAbandonment: b.query({
      query: (days = 7) => adminApiPath(`/business/quote-abandonment?days=${days}`),
    }),
    adminListUsers: b.query({
      query: ({ q, blocked, page = 1 } = {}) => ({ url: adminApiPath('/users'), params: { q, blocked, page } }),
      providesTags: ['AdminUsers'],
    }),
    adminBlockUser: b.mutation({
      query: ({ id, blocked }) => ({ url: adminApiPath(`/users/${id}/block`), method: 'POST', body: { blocked } }),
      invalidatesTags: ['AdminUsers'],
    }),
    adminGetPricingConfig: b.query({
      query: () => adminApiPath('/pricing-config'),
      providesTags: ['PricingCfg'],
    }),
    adminSetPricingConfig: b.mutation({
      query: (body) => ({ url: adminApiPath('/pricing-config'), method: 'PUT', body }),
      invalidatesTags: ['PricingCfg'],
    }),
    adminWalletAdjust: b.mutation({
      query: (body) => ({ url: adminApiPath('/wallet/adjust'), method: 'POST', body }),
    }),
    adminWalletReconcile: b.mutation({
      query: ({ kind, id }) => ({ url: adminApiPath(`/wallet/reconcile/${kind}/${id}`), method: 'POST' }),
    }),
    adminAuditLogs: b.query({
      query: ({ action, actorId, page = 1 } = {}) => ({ url: adminApiPath('/audit-logs'), params: { action, actorId, page } }),
      providesTags: ['AuditLogs'],
    }),
    adminDisputes: b.query({
      query: ({ status = 'open', page = 1 } = {}) => ({ url: adminApiPath('/disputes'), params: { status, page } }),
      providesTags: ['Disputes'],
    }),
    adminResolveDispute: b.mutation({
      query: ({ id, ...body }) => ({ url: adminApiPath(`/disputes/${id}/resolve`), method: 'POST', body }),
      invalidatesTags: ['Disputes'],
    }),
    adminPayouts: b.query({
      query: ({ status, page = 1 } = {}) => ({ url: adminApiPath('/payouts'), params: { status, page } }),
      providesTags: ['Payouts'],
    }),
    adminApprovePayout: b.mutation({
      query: (id) => ({ url: adminApiPath(`/payouts/${id}/approve`), method: 'POST' }),
      invalidatesTags: ['Payouts'],
    }),
    adminRejectPayout: b.mutation({
      query: ({ id, reason }) => ({ url: adminApiPath(`/payouts/${id}/reject`), method: 'POST', body: { reason } }),
      invalidatesTags: ['Payouts'],
    }),
    adminProcessPayout: b.mutation({
      query: (id) => ({ url: adminApiPath(`/payouts/${id}/process`), method: 'POST' }),
      invalidatesTags: ['Payouts'],
    }),
    adminGetIncentives: b.query({
      query: () => adminApiPath('/incentives'),
      providesTags: ['Incentives'],
    }),
    adminSetMilestones: b.mutation({
      query: (milestones) => ({ url: adminApiPath('/incentives/milestones'), method: 'PUT', body: { milestones } }),
      invalidatesTags: ['Incentives'],
    }),
    adminRatingSweep: b.mutation({
      query: () => ({ url: adminApiPath('/incentives/rating-sweep'), method: 'POST' }),
    }),
    adminListDeferredMilestones: b.query({
      query: () => adminApiPath('/incentives/deferred'),
      providesTags: ['DeferredMilestones'],
    }),
    adminReleaseDeferredMilestone: b.mutation({
      query: ({ workerId, milestone }) => ({
        url: adminApiPath(`/incentives/deferred/${workerId}/${milestone}/release`),
        method: 'POST',
      }),
      invalidatesTags: ['DeferredMilestones'],
    }),

    // --- Admin: Cashback ---
    adminGetCashbackConfig: b.query({
      query: () => adminApiPath('/cashback/config'),
      providesTags: ['CashbackConfig'],
    }),
    adminSetCashbackConfig: b.mutation({
      query: (body) => ({ url: adminApiPath('/cashback/config'), method: 'PUT', body }),
      invalidatesTags: ['CashbackConfig'],
    }),
    adminGetCashbackStats: b.query({
      query: (days = 30) => adminApiPath(`/cashback/stats?days=${days}`),
    }),

    // --- Admin: Referrals ---
    adminGetReferralStats: b.query({
      query: (days = 30) => adminApiPath(`/referrals/stats?days=${days}`),
    }),
    adminListRecentReferrals: b.query({
      query: ({ status, page = 1 } = {}) => ({
        url: adminApiPath('/referrals/recent'),
        params: { ...(status && { status }), page },
      }),
    }),
    adminGetCancellationConfig: b.query({
      query: () => adminApiPath('/cancellation-config'),
      providesTags: ['CancellationConfig'],
    }),
    adminUpdateCancellationConfig: b.mutation({
      query: (body) => ({ url: adminApiPath('/cancellation-config'), method: 'PATCH', body }),
      invalidatesTags: ['CancellationConfig'],
    }),
    adminWorkerPenalties: b.query({
      query: (id) => adminApiPath(`/workers/${id}/penalties`),
    }),

    // --- Admin: Subscription Plans ---
    adminListPlans: b.query({
      query: () => adminApiPath('/plans'),
      providesTags: ['Plan'],
    }),
    adminCreatePlan: b.mutation({
      query: (body) => ({ url: adminApiPath('/plans'), method: 'POST', body }),
      invalidatesTags: ['Plan'],
    }),
    adminUpdatePlan: b.mutation({
      query: ({ id, ...body }) => ({ url: adminApiPath(`/plans/${id}`), method: 'PATCH', body }),
      invalidatesTags: ['Plan'],
    }),
    adminDeletePlan: b.mutation({
      query: (id) => ({ url: adminApiPath(`/plans/${id}`), method: 'DELETE' }),
      invalidatesTags: ['Plan'],
    }),

    // --- Ads ---
    getActiveAds: b.query({
      query: () => '/ads',
      providesTags: ['Ad'],
    }),
    trackAdImpression: b.mutation({
      query: (id) => ({ url: `/ads/${id}/impression`, method: 'POST' }),
    }),
    trackAdClick: b.mutation({
      query: (id) => ({ url: `/ads/${id}/click`, method: 'POST' }),
    }),
    // Admin: Ads
    adminListAds: b.query({
      query: ({ status, audience, page = 1 } = {}) => {
        const params = new URLSearchParams({ page });
        if (status)   params.set('status', status);
        if (audience) params.set('audience', audience);
        return adminApiPath(`/ads?${params}`);
      },
      providesTags: ['Ad'],
    }),
    adminCreateAd: b.mutation({
      query: (body) => ({ url: adminApiPath('/ads'), method: 'POST', body }),
      invalidatesTags: ['Ad'],
    }),
    adminUpdateAd: b.mutation({
      query: ({ id, ...body }) => ({ url: adminApiPath(`/ads/${id}`), method: 'PATCH', body }),
      invalidatesTags: ['Ad'],
    }),
    adminDeleteAd: b.mutation({
      query: (id) => ({ url: adminApiPath(`/ads/${id}`), method: 'DELETE' }),
      invalidatesTags: ['Ad'],
    }),

    // --- Promos/Coupons ---
    validatePromo: b.mutation({
      query: (body) => ({ url: '/promos/validate', method: 'POST', body }),
    }),
    // Admin: Promos
    adminListPromos: b.query({
      query: ({ page = 1 } = {}) => adminApiPath(`/promos?page=${page}`),
      providesTags: ['Promo'],
    }),
    adminCreatePromo: b.mutation({
      query: (body) => ({ url: adminApiPath('/promos'), method: 'POST', body }),
      invalidatesTags: ['Promo'],
    }),
    adminUpdatePromo: b.mutation({
      query: ({ id, ...body }) => ({ url: adminApiPath(`/promos/${id}`), method: 'PATCH', body }),
      invalidatesTags: ['Promo'],
    }),
    adminDeletePromo: b.mutation({
      query: (id) => ({ url: adminApiPath(`/promos/${id}`), method: 'DELETE' }),
      invalidatesTags: ['Promo'],
    }),

    // --- Gamification ---
    getGamification: b.query({
      query: () => '/gamification',
      providesTags: ['Gamification'],
    }),

    // --- Recommendations ---
    getRecommendations: b.query({
      query: () => '/recommendations',
      providesTags: ['Recommendations'],
    }),

    // --- Admin: Geo Analytics (Heatmap) ---
    adminGeoAnalytics: b.query({
      query: ({ days = 30, precision = 2, service } = {}) => ({
        url: adminApiPath('/geo-analytics'),
        params: { days, precision, service },
      }),
    }),
    adminDemandPatterns: b.query({
      query: ({ days = 30, service } = {}) => ({
        url: adminApiPath('/demand-patterns'),
        params: { days, service },
      }),
    }),

    // --- Admin: System Health ---
    adminSystemHealth: b.query({
      query: () => adminApiPath('/system/health'),
    }),

    // --- Admin: Feature Flags ---
    adminFeatureFlags: b.query({
      query: () => adminApiPath('/feature-flags'),
      providesTags: ['FeatureFlags'],
    }),
    adminSetFeatureFlag: b.mutation({
      query: (body) => ({ url: adminApiPath('/feature-flags'), method: 'POST', body }),
      invalidatesTags: ['FeatureFlags'],
    }),

    // --- Admin: Alerts ---
    adminAlerts: b.query({
      query: () => adminApiPath('/alerts'),
    }),

    // --- Admin: Retention ---
    adminRetention: b.query({
      query: (days = 30) => adminApiPath(`/retention?days=${days}`),
    }),

    // --- Admin: Support Tickets ---
    adminSupportTickets: b.query({
      query: ({ status, priority, category, page = 1 } = {}) => ({
        url: adminApiPath('/support'),
        params: { status, priority, category, page },
      }),
      providesTags: ['SupportTickets'],
    }),
    adminReplyTicket: b.mutation({
      query: ({ id, ...body }) => ({ url: adminApiPath(`/support/${id}/reply`), method: 'POST', body }),
      invalidatesTags: ['SupportTickets'],
    }),

    // --- Admin: Live Operations ---
    adminLiveOps: b.query({
      query: () => adminApiPath('/liveops'),
    }),

    // --- Construction Timer (correct server path: /vertical-features/construction/timer) ---
    getConstructionTimer: b.query({ query: (orderId) => `/vertical-features/construction/timer/${orderId}` }),
    startConstructionTimer: b.mutation({ query: ({ orderId }) => ({ url: '/vertical-features/construction/timer/start', method: 'POST', body: { orderId } }) }),
    pauseConstructionTimer: b.mutation({ query: ({ orderId }) => ({ url: '/vertical-features/construction/timer/pause', method: 'POST', body: { orderId } }) }),
    resumeConstructionTimer: b.mutation({ query: ({ orderId }) => ({ url: '/vertical-features/construction/timer/resume', method: 'POST', body: { orderId } }) }),
    stopConstructionTimer: b.mutation({ query: ({ orderId }) => ({ url: '/vertical-features/construction/timer/stop', method: 'POST', body: { orderId } }) }),

    // --- Phone Health (correct server path: /vertical-features/phone/health-report) ---
    getPhoneHealthReport: b.query({ query: (orderId) => `/vertical-features/phone/health-report/${orderId}` }),
    submitPhoneHealthReport: b.mutation({
      query: ({ orderId, components, partsReplaced }) => ({ url: '/vertical-features/phone/health-report', method: 'POST', body: { orderId, components, partsReplaced } }),
    }),

    // --- Vehicle Health (correct server path: /vertical-features/vehicles/health-report) ---
    getVehicleHealthReport: b.query({ query: (orderId) => `/vertical-features/vehicles/health-report/${orderId}` }),
    submitVehicleHealthReport: b.mutation({
      query: ({ orderId, reportType, preDamageDocs }) => ({ url: '/vertical-features/vehicles/health-report', method: 'POST', body: { orderId, reportType, preDamageDocs } }),
    }),

    // --- Admin Catalog (correct server path: /catalog/admin/services) ---
    adminGetCatalogServices: b.query({ query: () => '/catalog/admin/services' }),
    adminUpdateCatalogService: b.mutation({
      query: ({ code, ...body }) => ({ url: `/catalog/admin/services/${code}`, method: 'PUT', body }),
    }),
    adminServiceActiveOrderCount: b.query({
      query: (code) => `/catalog/admin/services/${code}/active-orders`,
    }),
    // --- Admin Verticals (correct server path: /${slug}/verticals mounted in routes) ---
    adminGetVerticals: b.query({ query: () => `${adminApiPath('/verticals')}` }),
    adminUpdateVertical: b.mutation({
      query: ({ vertical, ...body }) => ({ url: adminApiPath(`/verticals/${vertical}`), method: 'PUT', body }),
    }),
    adminAddSparePart: b.mutation({
      query: ({ vertical, ...body }) => ({ url: adminApiPath(`/verticals/mobile/spare-parts`), method: 'POST', body }),
    }),
    adminUpdateSparePart: b.mutation({
      query: ({ partId, ...body }) => ({ url: adminApiPath(`/verticals/mobile/spare-parts/${partId}`), method: 'PATCH', body }),
    }),
    adminRemoveSparePart: b.mutation({
      query: ({ partId }) => ({ url: adminApiPath(`/verticals/mobile/spare-parts/${partId}`), method: 'DELETE' }),
    }),
    adminRefundOrder: b.mutation({
      query: ({ orderId, reason }) => ({ url: adminApiPath(`/orders/${orderId}/refund`), method: 'POST', body: { reason } }),
    }),

    // --- Warranty (correct server path: /service-features/warranties/order/:orderId) ---
    getOrderWarranty: b.query({
      query: (orderId) => `/service-features/warranties/order/${orderId}`,
    }),

    // --- Service Checklist (correct server path: /service-features/checklist/:service) ---
    getServiceChecklist: b.query({
      query: (service) => `/service-features/checklist/${service}`,
    }),
    submitChecklist: b.mutation({
      query: ({ orderId, completedItems }) => ({ url: `/orders/${orderId}/checklist`, method: 'POST', body: { completedIds: completedItems } }),
    }),

    // --- Shifts (correct server paths) ---
    getShifts: b.query({
      query: ({ lat, lng } = {}) => `/workers/shifts${lat ? `?lat=${lat}&lng=${lng}` : ''}`,
    }),
    previewShift: b.query({
      query: ({ lat, lng }) => `/workers/shifts/preview?lat=${lat}&lng=${lng}`,
    }),
    commitShift: b.mutation({
      query: (body) => ({ url: '/workers/shifts', method: 'POST', body }),
    }),
    cancelShiftSlot: b.mutation({
      query: ({ slotId }) => ({ url: '/workers/shifts/cancel', method: 'DELETE', body: { slotId } }),
    }),

    // --- Wellness ---
    getWellness: b.query({ query: () => '/workers/wellness' }),

    // --- Earned Wage ---
    getEarnedWage: b.query({ query: () => '/workers/earned-wage' }),
    requestWageAdvance: b.mutation({
      query: ({ amountPaise }) => ({ url: '/workers/earned-wage/advance', method: 'POST', body: { amountPaise } }),
    }),

    // --- SOS ---
    triggerSOS: b.mutation({
      query: ({ orderId, lat, lng }) => ({ url: `/workers/sos`, method: 'POST', body: { orderId, lat, lng } }),
    }),

    // --- Break Bonus (server: POST /workers/wellness/break-bonus) ---
    claimBreakBonus: b.mutation({
      query: () => ({ url: '/workers/wellness/break-bonus', method: 'POST' }),
    }),

    // --- Price Revision ---
    getPriceRevision: b.query({
      query: (orderId) => `/orders/${orderId}/price-revision`,
      providesTags: (r, e, id) => [{ type: 'Order', id }],
    }),
    respondPriceRevision: b.mutation({
      query: ({ orderId, accept }) => ({ url: `/orders/${orderId}/price-revision/respond`, method: 'POST', body: { accept } }),
      invalidatesTags: (r, e, a) => [{ type: 'Order', id: a.orderId }],
    }),

    // --- Tip ---
    sendTip: b.mutation({
      query: ({ orderId, amountPaise }) => ({ url: `/orders/${orderId}/tip`, method: 'POST', body: { amountPaise } }),
      invalidatesTags: (r, e, a) => [{ type: 'Order', id: a.orderId }],
    }),

    // --- Surge Info ---
    getSurgeInfo: b.query({
      query: ({ lat, lng }) => `/pricing/surge?lat=${lat}&lng=${lng}`,
    }),

    // --- Diagnosis Flow ---
    getDiagnosisFlow: b.query({
      query: (service) => `/service-features/diagnosis/${service}`,
    }),
    analyseDiagnosis: b.mutation({
      query: ({ service, answers }) => ({
        url: `/service-features/diagnosis/${service}/analyse`,
        method: 'POST',
        body: { answers },
      }),
    }),

    // --- Worker: Public Profile + Leaderboard ---
    getWorkerPublicProfile: b.query({
      query: (workerId) => `/workers/${workerId}/public`,
      providesTags: (r, e, id) => [{ type: 'Worker', id }],
    }),
    getWorkerLeaderboard: b.query({
      query: () => '/workers/leaderboard',
      providesTags: ['Worker'],
    }),

    // --- Referrals ---
    getReferralCode: b.query({
      query: () => '/referrals/my-code',
      providesTags: ['Referral'],
    }),
    applyReferralCode: b.mutation({
      query: (code) => ({ url: '/referrals/apply', method: 'POST', body: { code } }),
      invalidatesTags: ['Referral'],
    }),
    getReferralHistory: b.query({
      query: () => '/referrals/history',
      providesTags: ['Referral'],
    }),
  }),
});

export const {
  useRequestOtpMutation,
  useLoginUserMutation,
  useLoginWorkerMutation,
  useLoginAdminMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetQuoteQuery,
  useLazyGetQuoteQuery,
  useCreateOrderMutation,
  useGetOrderQuery,
  useListOrdersQuery,
  useGetCancelPreviewQuery,
  useCancelOrderMutation,
  useWorkerReportNoResponseMutation,
  useWorkerReportPartUnavailableMutation,
  useRateOrderMutation,
  useGetWorkerMeQuery,
  useUpdateWorkerProfileMutation,
  useGoOnlineMutation,
  useGoOfflineMutation,
  useGetEarningsQuery,
  useWorkerAcceptMutation,
  useWorkerRejectMutation,
  useWorkerStartTripMutation,
  useWorkerArriveMutation,
  useWorkerStartServiceMutation,
  useWorkerCompleteMutation,
  useGetKycStatusQuery,
  useSubmitKycMutation,
  usePresignUploadMutation,
  useAdminMetricsQuery,
  useAdminOrdersQuery,
  useAdminWorkersQuery,
  useAdminBlockWorkerMutation,
  useAdminKycPendingQuery,
  useAdminKycApproveMutation,
  useAdminKycRejectMutation,
  useListPlansQuery,
  useMySubscriptionQuery,
  useSubscribeMutation,
  useCancelSubscriptionMutation,
  useGetWalletQuery,
  useWalletTransactionsQuery,
  useWalletTopupMutation,
  useVerifyPaymentMutation,
  useGetPricingConfigQuery,
  useAdminUpdatePricingMutation,
  useAdminTogglesMutation,
  useAdminToggleDispatchMutation,
  useAdminRevenueQuery,
  useAdminAnalyticsQuery,
  useAdminOrderAuditQuery,
  useAdminCommissionAuditQuery,
  useAdminWorkerTrustAuditQuery,
  useAdminReconciliationQueueQuery,
  useAdminReconcilePaymentMutation,
  useAdminServicePnLQuery,
  useAdminChurnRiskQuery,
  useAdminDeadCategoriesQuery,
  useAdminGeoReadinessQuery,
  useAdminQuoteAbandonmentQuery,
  useAdminListUsersQuery,
  useAdminBlockUserMutation,
  useAdminGetPricingConfigQuery,
  useAdminSetPricingConfigMutation,
  useAdminWalletAdjustMutation,
  useAdminWalletReconcileMutation,
  useAdminAuditLogsQuery,
  useAdminDisputesQuery,
  useAdminResolveDisputeMutation,
  useAdminPayoutsQuery,
  useAdminApprovePayoutMutation,
  useAdminRejectPayoutMutation,
  useAdminProcessPayoutMutation,
  useAdminGetIncentivesQuery,
  useAdminSetMilestonesMutation,
  useAdminRatingSweepMutation,
  useAdminListDeferredMilestonesQuery,
  useAdminReleaseDeferredMilestoneMutation,
  useAdminGetCashbackConfigQuery,
  useAdminSetCashbackConfigMutation,
  useAdminGetCashbackStatsQuery,
  useAdminGetReferralStatsQuery,
  useAdminListRecentReferralsQuery,
  useAdminGetCancellationConfigQuery,
  useAdminUpdateCancellationConfigMutation,
  useAdminWorkerPenaltiesQuery,
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetAddressesQuery,
  useAddAddressMutation,
  useDeleteAddressMutation,
  useSaveRecentLocationMutation,
  useRegisterDeviceTokenMutation,
  useRegisterWorkerDeviceTokenMutation,
  useGetOrderInvoiceUrlQuery,
  useGetChatMessagesQuery,
  useSendChatMessageMutation,
  useGetWorkerOrdersQuery,
  useGetNearbyWorkersQuery,
  useGetDemandZonesQuery,
  useLazyGetNearbyWorkersQuery,
  useAdminListPlansQuery,
  useAdminCreatePlanMutation,
  useAdminUpdatePlanMutation,
  useAdminDeletePlanMutation,
  // Ads
  useGetActiveAdsQuery,
  useTrackAdImpressionMutation,
  useTrackAdClickMutation,
  useAdminListAdsQuery,
  useAdminCreateAdMutation,
  useAdminUpdateAdMutation,
  useAdminDeleteAdMutation,
  // Promos
  useValidatePromoMutation,
  useAdminListPromosQuery,
  useAdminCreatePromoMutation,
  useAdminUpdatePromoMutation,
  useAdminDeletePromoMutation,
  // Gamification + Recommendations
  useGetGamificationQuery,
  useGetRecommendationsQuery,
  // Enterprise admin
  useAdminGeoAnalyticsQuery,
  useAdminDemandPatternsQuery,
  useAdminSystemHealthQuery,
  useAdminFeatureFlagsQuery,
  useAdminSetFeatureFlagMutation,
  useAdminAlertsQuery,
  useAdminRetentionQuery,
  useAdminSupportTicketsQuery,
  useAdminReplyTicketMutation,
  useAdminLiveOpsQuery,
  // Referrals
  useGetReferralCodeQuery,
  useApplyReferralCodeMutation,
  useGetReferralHistoryQuery,
  // Worker public profile + leaderboard
  useGetWorkerPublicProfileQuery,
  useGetWorkerLeaderboardQuery,
  // Diagnosis flow
  useGetDiagnosisFlowQuery,
  useAnalyseDiagnosisMutation,
  // Surge info
  useLazyGetSurgeInfoQuery,
  // Tip
  useSendTipMutation,
  // Price revision
  useGetPriceRevisionQuery,
  useRespondPriceRevisionMutation,
  // Warranty + checklist
  useGetOrderWarrantyQuery,
  useGetServiceChecklistQuery,
  useSubmitChecklistMutation,
  // Shifts
  useGetShiftsQuery,
  useLazyPreviewShiftQuery,
  useCommitShiftMutation,
  useCancelShiftSlotMutation,
  // Wellness + earned wage
  useGetWellnessQuery,
  useGetEarnedWageQuery,
  useRequestWageAdvanceMutation,
  // SOS + bonus
  useTriggerSOSMutation,
  useClaimBreakBonusMutation,
  // Construction timer
  useGetConstructionTimerQuery,
  useStartConstructionTimerMutation,
  usePauseConstructionTimerMutation,
  useResumeConstructionTimerMutation,
  useStopConstructionTimerMutation,
  // Phone + vehicle health
  useGetPhoneHealthReportQuery,
  useSubmitPhoneHealthReportMutation,
  useGetVehicleHealthReportQuery,
  useSubmitVehicleHealthReportMutation,
  // Admin catalog + verticals
  useAdminGetCatalogServicesQuery,
  useAdminUpdateCatalogServiceMutation,
  useAdminServiceActiveOrderCountQuery,
  useAdminGetVerticalsQuery,
  useAdminUpdateVerticalMutation,
  useAdminAddSparePartMutation,
  useAdminUpdateSparePartMutation,
  useAdminRemoveSparePartMutation,
  useAdminRefundOrderMutation,
} = api;
