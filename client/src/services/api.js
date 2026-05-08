import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';
import { setAuth, logout } from '../modules/auth/authSlice';
import { adminApiPath } from '../config/admin';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
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
    const rt = state.auth.refreshToken;
    if (!rt) {
      api.dispatch(logout());
      return result;
    }
    const refreshRes = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST', body: { refreshToken: rt } },
      api,
      extraOptions
    );
    if (refreshRes.data) {
      api.dispatch(
        setAuth({
          accessToken: refreshRes.data.accessToken,
          refreshToken: refreshRes.data.refreshToken,
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
  tagTypes: ['Me', 'Order', 'Worker', 'Earnings', 'AdminMetrics', 'Kyc', 'Plan', 'Subscription', 'Wallet', 'Notification', 'AdminUsers', 'Disputes', 'Payouts', 'Incentives', 'CancellationConfig', 'PricingCfg', 'AuditLogs', 'Addresses'],
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
    adminRevenue: b.query({
      query: (days = 7) => adminApiPath(`/revenue?days=${days}`),
    }),

    // --- Admin: Extended ---
    adminAnalytics: b.query({
      query: (days = 30) => adminApiPath(`/analytics?days=${days}`),
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
  useRateOrderMutation,
  useGetWorkerMeQuery,
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
  useAdminRevenueQuery,
  useAdminAnalyticsQuery,
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
} = api;
