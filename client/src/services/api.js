import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';
import { setAuth, logout } from '../modules/auth/authSlice';

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
  tagTypes: ['Me', 'Order', 'Worker', 'Earnings', 'AdminMetrics', 'Kyc', 'Plan', 'Subscription', 'Wallet', 'Notification'],
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
      query: (id) => ({ url: `/orders/${id}/complete`, method: 'POST' }),
      invalidatesTags: (r, e, id) => ['Order', 'Earnings', { type: 'Order', id }],
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
    adminMetrics: b.query({ query: () => '/admin/metrics', providesTags: ['AdminMetrics'] }),
    adminOrders: b.query({
      query: ({ status, page = 1 } = {}) => ({ url: '/admin/orders', params: { status, page } }),
    }),
    adminWorkers: b.query({
      query: ({ q, skill, online, page = 1 } = {}) => ({
        url: '/admin/workers',
        params: { q, skill, online, page },
      }),
    }),
    adminBlockWorker: b.mutation({
      query: ({ id, blocked }) => ({
        url: `/admin/workers/${id}/block`,
        method: 'POST',
        body: { blocked },
      }),
      invalidatesTags: ['Worker'],
    }),
    adminKycPending: b.query({
      query: () => '/admin/kyc/pending',
      providesTags: ['Kyc'],
    }),
    adminKycApprove: b.mutation({
      query: (id) => ({ url: `/admin/workers/${id}/kyc/approve`, method: 'POST' }),
      invalidatesTags: ['Kyc'],
    }),
    adminKycReject: b.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/workers/${id}/kyc/reject`,
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
      query: (body) => ({ url: '/admin/pricing', method: 'PATCH', body }),
    }),
    adminToggles: b.mutation({
      query: (body) => ({ url: '/admin/toggles', method: 'PATCH', body }),
    }),
    adminRevenue: b.query({
      query: (days = 7) => `/admin/revenue?days=${days}`,
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
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = api;
