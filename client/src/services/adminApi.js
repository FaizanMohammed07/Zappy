/**
 * Admin API Service
 * ---------------------------------------------------------------------------
 * Uses RTK Query injectEndpoints() to add all admin endpoints to the shared
 * `api` slice without creating a separate store instance.
 *
 * Importing from this file gives you type-safe, tree-shaken access to every
 * admin hook without polluting the user-facing api.js bundle.
 *
 * Admin pages can migrate imports from:
 *   import { useAdminMetricsQuery } from '../../services/api';
 * to:
 *   import { useAdminMetricsQuery } from '../../services/adminApi';
 *
 * api.js re-exports everything for backwards compatibility — no page breaks.
 * ---------------------------------------------------------------------------
 */

import { api } from './api';
import { adminApiPath } from '../config/admin';

const adminApi = api.injectEndpoints({
  overrideExisting: false,
  endpoints: (b) => ({

    /* ── Metrics & Analytics ── */
    adminMetrics: b.query({ query: () => adminApiPath('/metrics'), providesTags: ['AdminMetrics'] }),
    adminRevenue: b.query({ query: (days = 7) => adminApiPath(`/revenue?days=${days}`) }),
    adminAnalytics: b.query({ query: (days = 30) => adminApiPath(`/analytics?days=${days}`) }),
    adminDemandPatterns: b.query({
      query: ({ days = 30, service } = {}) => ({ url: adminApiPath('/demand-patterns'), params: { days, service } }),
    }),

    /* ── Orders ── */
    adminOrders: b.query({
      query: ({ status, page = 1 } = {}) => ({ url: adminApiPath('/orders'), params: { status, page } }),
    }),
    adminRefundOrder: b.mutation({
      query: ({ orderId, reason }) => ({ url: adminApiPath(`/orders/${orderId}/refund`), method: 'POST', body: { reason } }),
    }),
    adminReconciliationQueue: b.query({ query: () => adminApiPath('/payments/reconciliation-queue') }),
    adminReconcilePayment: b.mutation({
      query: (razorpayOrderId) => ({ url: adminApiPath(`/payments/${razorpayOrderId}/reconcile`), method: 'POST' }),
    }),
    adminOrderAudit: b.query({ query: (orderId) => adminApiPath(`/audit/order/${orderId}`) }),
    adminCommissionAudit: b.query({ query: (days = 7) => adminApiPath(`/audit/commission?days=${days}`) }),
    adminWorkerTrustAudit: b.query({ query: () => adminApiPath('/audit/worker-trust') }),

    /* ── Workers ── */
    adminWorkers: b.query({
      query: ({ q, skill, online, page = 1 } = {}) => ({ url: adminApiPath('/workers'), params: { q, skill, online, page } }),
    }),
    adminBlockWorker: b.mutation({
      query: ({ id, blocked }) => ({ url: adminApiPath(`/workers/${id}/block`), method: 'POST', body: { blocked } }),
      invalidatesTags: ['Worker'],
    }),
    adminKycPending: b.query({ query: () => adminApiPath('/kyc/pending'), providesTags: ['Kyc'] }),
    adminKycApprove: b.mutation({ query: (id) => ({ url: adminApiPath(`/workers/${id}/kyc/approve`), method: 'POST' }), invalidatesTags: ['Kyc'] }),
    adminKycReject: b.mutation({
      query: ({ id, reason }) => ({ url: adminApiPath(`/workers/${id}/kyc/reject`), method: 'POST', body: { reason } }),
      invalidatesTags: ['Kyc'],
    }),
    adminWorkerPenalties: b.query({ query: (id) => adminApiPath(`/workers/${id}/penalties`) }),

    /* ── Users ── */
    adminListUsers: b.query({
      query: ({ q, blocked, page = 1 } = {}) => ({ url: adminApiPath('/users'), params: { q, blocked, page } }),
      providesTags: ['AdminUsers'],
    }),
    adminBlockUser: b.mutation({
      query: ({ id, blocked }) => ({ url: adminApiPath(`/users/${id}/block`), method: 'POST', body: { blocked } }),
      invalidatesTags: ['AdminUsers'],
    }),

    /* ── Pricing & Config ── */
    adminUpdatePricing: b.mutation({ query: (body) => ({ url: adminApiPath('/pricing'), method: 'PATCH', body }) }),
    adminToggles: b.mutation({ query: (body) => ({ url: adminApiPath('/toggles'), method: 'PATCH', body }) }),
    adminToggleDispatch: b.mutation({ query: (body) => ({ url: adminApiPath('/dispatch/toggle'), method: 'PATCH', body }) }),
    adminGetPricingConfig: b.query({ query: () => adminApiPath('/pricing-config'), providesTags: ['PricingCfg'] }),
    adminSetPricingConfig: b.mutation({ query: (body) => ({ url: adminApiPath('/pricing-config'), method: 'PUT', body }), invalidatesTags: ['PricingCfg'] }),
    adminGetCancellationConfig: b.query({ query: () => adminApiPath('/cancellation-config'), providesTags: ['CancellationConfig'] }),
    adminUpdateCancellationConfig: b.mutation({ query: (body) => ({ url: adminApiPath('/cancellation-config'), method: 'PATCH', body }), invalidatesTags: ['CancellationConfig'] }),

    /* ── Financial ── */
    adminWalletAdjust: b.mutation({ query: (body) => ({ url: adminApiPath('/wallet/adjust'), method: 'POST', body }) }),
    adminWalletReconcile: b.mutation({ query: ({ kind, id }) => ({ url: adminApiPath(`/wallet/reconcile/${kind}/${id}`), method: 'POST' }) }),
    adminPayouts: b.query({ query: ({ status, page = 1 } = {}) => ({ url: adminApiPath('/payouts'), params: { status, page } }), providesTags: ['Payouts'] }),
    adminApprovePayout: b.mutation({ query: (id) => ({ url: adminApiPath(`/payouts/${id}/approve`), method: 'POST' }), invalidatesTags: ['Payouts'] }),
    adminRejectPayout: b.mutation({ query: ({ id, reason }) => ({ url: adminApiPath(`/payouts/${id}/reject`), method: 'POST', body: { reason } }), invalidatesTags: ['Payouts'] }),
    adminProcessPayout: b.mutation({ query: (id) => ({ url: adminApiPath(`/payouts/${id}/process`), method: 'POST' }), invalidatesTags: ['Payouts'] }),

    /* ── Incentives ── */
    adminGetIncentives: b.query({ query: () => adminApiPath('/incentives'), providesTags: ['Incentives'] }),
    adminSetMilestones: b.mutation({ query: (milestones) => ({ url: adminApiPath('/incentives/milestones'), method: 'PUT', body: { milestones } }), invalidatesTags: ['Incentives'] }),
    adminRatingSweep: b.mutation({ query: () => ({ url: adminApiPath('/incentives/rating-sweep'), method: 'POST' }) }),
    adminListDeferredMilestones: b.query({ query: () => adminApiPath('/incentives/deferred') }),
    adminReleaseDeferredMilestone: b.mutation({
      query: ({ workerId, milestone }) => ({ url: adminApiPath(`/incentives/deferred/${workerId}/${milestone}/release`), method: 'POST' }),
    }),

    /* ── Plans ── */
    adminListPlans: b.query({ query: () => adminApiPath('/plans'), providesTags: ['Plan'] }),
    adminCreatePlan: b.mutation({ query: (body) => ({ url: adminApiPath('/plans'), method: 'POST', body }), invalidatesTags: ['Plan'] }),
    adminUpdatePlan: b.mutation({ query: ({ id, ...body }) => ({ url: adminApiPath(`/plans/${id}`), method: 'PATCH', body }), invalidatesTags: ['Plan'] }),
    adminDeletePlan: b.mutation({ query: (id) => ({ url: adminApiPath(`/plans/${id}`), method: 'DELETE' }), invalidatesTags: ['Plan'] }),

    /* ── Disputes ── */
    adminDisputes: b.query({ query: ({ status = 'open', page = 1 } = {}) => ({ url: adminApiPath('/disputes'), params: { status, page } }), providesTags: ['Disputes'] }),
    adminResolveDispute: b.mutation({ query: ({ id, ...body }) => ({ url: adminApiPath(`/disputes/${id}/resolve`), method: 'POST', body }), invalidatesTags: ['Disputes'] }),

    /* ── Ads & Promos ── */
    adminListAds: b.query({
      query: ({ status, audience, page = 1 } = {}) => {
        const params = new URLSearchParams({ page });
        if (status)   params.set('status', status);
        if (audience) params.set('audience', audience);
        return adminApiPath(`/ads?${params}`);
      },
      providesTags: ['Ad'],
    }),
    adminCreateAd:  b.mutation({ query: (body) => ({ url: adminApiPath('/ads'), method: 'POST', body }), invalidatesTags: ['Ad'] }),
    adminUpdateAd:  b.mutation({ query: ({ id, ...body }) => ({ url: adminApiPath(`/ads/${id}`), method: 'PATCH', body }), invalidatesTags: ['Ad'] }),
    adminDeleteAd:  b.mutation({ query: (id) => ({ url: adminApiPath(`/ads/${id}`), method: 'DELETE' }), invalidatesTags: ['Ad'] }),
    adminListPromos: b.query({ query: ({ page = 1 } = {}) => adminApiPath(`/promos?page=${page}`), providesTags: ['Promo'] }),
    adminCreatePromo: b.mutation({ query: (body) => ({ url: adminApiPath('/promos'), method: 'POST', body }), invalidatesTags: ['Promo'] }),
    adminUpdatePromo: b.mutation({ query: ({ id, ...body }) => ({ url: adminApiPath(`/promos/${id}`), method: 'PATCH', body }), invalidatesTags: ['Promo'] }),
    adminDeletePromo: b.mutation({ query: (id) => ({ url: adminApiPath(`/promos/${id}`), method: 'DELETE' }), invalidatesTags: ['Promo'] }),

    /* ── Cashback & Referrals ── */
    adminGetCashbackConfig: b.query({ query: () => adminApiPath('/cashback/config'), providesTags: ['CashbackConfig'] }),
    adminSetCashbackConfig: b.mutation({ query: (body) => ({ url: adminApiPath('/cashback/config'), method: 'PUT', body }), invalidatesTags: ['CashbackConfig'] }),
    adminGetCashbackStats: b.query({ query: (days = 30) => adminApiPath(`/cashback/stats?days=${days}`) }),
    adminGetReferralStats: b.query({ query: (days = 30) => adminApiPath(`/referrals/stats?days=${days}`) }),
    adminListRecentReferrals: b.query({
      query: ({ status, page = 1 } = {}) => ({ url: adminApiPath('/referrals/recent'), params: { ...(status && { status }), page } }),
    }),

    /* ── Geo & Heatmap ── */
    adminGeoAnalytics: b.query({
      query: ({ days = 30, precision = 2, service } = {}) => ({ url: adminApiPath('/geo-analytics'), params: { days, precision, service } }),
    }),

    /* ── Audit Logs ── */
    adminAuditLogs: b.query({
      query: ({ action, actorId, page = 1 } = {}) => ({ url: adminApiPath('/audit-logs'), params: { action, actorId, page } }),
      providesTags: ['AuditLogs'],
    }),

    /* ── System & Feature Flags ── */
    adminSystemHealth: b.query({ query: () => adminApiPath('/system/health') }),
    adminFeatureFlags: b.query({ query: () => adminApiPath('/feature-flags'), providesTags: ['FeatureFlags'] }),
    adminSetFeatureFlag: b.mutation({ query: (body) => ({ url: adminApiPath('/feature-flags'), method: 'POST', body }), invalidatesTags: ['FeatureFlags'] }),
    adminAlerts: b.query({ query: () => adminApiPath('/alerts') }),

    /* ── Operations ── */
    adminRetention: b.query({ query: (days = 30) => adminApiPath(`/retention?days=${days}`) }),
    adminSupportTickets: b.query({
      query: ({ status, priority, category, page = 1 } = {}) => ({ url: adminApiPath('/support'), params: { status, priority, category, page } }),
      providesTags: ['SupportTickets'],
    }),
    adminReplyTicket: b.mutation({ query: ({ id, ...body }) => ({ url: adminApiPath(`/support/${id}/reply`), method: 'POST', body }), invalidatesTags: ['SupportTickets'] }),
    adminLiveOps: b.query({ query: () => adminApiPath('/liveops') }),

    /* ── Business Intelligence ── */
    adminServicePnL: b.query({ query: (days = 30) => adminApiPath(`/business/service-pnl?days=${days}`) }),
    adminChurnRisk: b.query({ query: () => adminApiPath('/business/churn-risk') }),
    adminDeadCategories: b.query({ query: (days = 30) => adminApiPath(`/business/dead-categories?days=${days}`) }),
    adminGeoReadiness: b.query({
      query: ({ lat, lng, radiusKm = 15 }) => adminApiPath(`/business/geo-readiness?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
    }),
    adminQuoteAbandonment: b.query({ query: (days = 7) => adminApiPath(`/business/quote-abandonment?days=${days}`) }),

    /* ── Catalog & Verticals ── */
    adminGetCatalogServices: b.query({ query: () => '/catalog/admin/services' }),
    adminUpdateCatalogService: b.mutation({ query: ({ code, ...body }) => ({ url: `/catalog/admin/services/${code}`, method: 'PUT', body }) }),
    adminServiceActiveOrderCount: b.query({ query: (code) => `/catalog/admin/services/${code}/active-orders` }),
    adminGetVerticals: b.query({ query: () => adminApiPath('/verticals') }),
    adminUpdateVertical: b.mutation({ query: ({ vertical, ...body }) => ({ url: adminApiPath(`/verticals/${vertical}`), method: 'PUT', body }) }),
    adminAddSparePart: b.mutation({ query: (body) => ({ url: adminApiPath('/verticals/mobile/spare-parts'), method: 'POST', body }) }),
    adminUpdateSparePart: b.mutation({ query: ({ partId, ...body }) => ({ url: adminApiPath(`/verticals/mobile/spare-parts/${partId}`), method: 'PATCH', body }) }),
    adminRemoveSparePart: b.mutation({ query: ({ partId }) => ({ url: adminApiPath(`/verticals/mobile/spare-parts/${partId}`), method: 'DELETE' }) }),
  }),
});

export const {
  /* Metrics */
  useAdminMetricsQuery, useAdminRevenueQuery, useAdminAnalyticsQuery, useAdminDemandPatternsQuery,
  /* Orders */
  useAdminOrdersQuery, useAdminRefundOrderMutation, useAdminReconciliationQueueQuery,
  useAdminReconcilePaymentMutation, useAdminOrderAuditQuery, useAdminCommissionAuditQuery, useAdminWorkerTrustAuditQuery,
  /* Workers */
  useAdminWorkersQuery, useAdminBlockWorkerMutation, useAdminKycPendingQuery,
  useAdminKycApproveMutation, useAdminKycRejectMutation, useAdminWorkerPenaltiesQuery,
  /* Users */
  useAdminListUsersQuery, useAdminBlockUserMutation,
  /* Pricing */
  useAdminUpdatePricingMutation, useAdminTogglesMutation, useAdminToggleDispatchMutation,
  useAdminGetPricingConfigQuery, useAdminSetPricingConfigMutation,
  useAdminGetCancellationConfigQuery, useAdminUpdateCancellationConfigMutation,
  /* Financial */
  useAdminWalletAdjustMutation, useAdminWalletReconcileMutation,
  useAdminPayoutsQuery, useAdminApprovePayoutMutation, useAdminRejectPayoutMutation, useAdminProcessPayoutMutation,
  /* Incentives */
  useAdminGetIncentivesQuery, useAdminSetMilestonesMutation, useAdminRatingSweepMutation,
  useAdminListDeferredMilestonesQuery, useAdminReleaseDeferredMilestoneMutation,
  /* Plans */
  useAdminListPlansQuery, useAdminCreatePlanMutation, useAdminUpdatePlanMutation, useAdminDeletePlanMutation,
  /* Disputes */
  useAdminDisputesQuery, useAdminResolveDisputeMutation,
  /* Ads & Promos */
  useAdminListAdsQuery, useAdminCreateAdMutation, useAdminUpdateAdMutation, useAdminDeleteAdMutation,
  useAdminListPromosQuery, useAdminCreatePromoMutation, useAdminUpdatePromoMutation, useAdminDeletePromoMutation,
  /* Cashback & Referrals */
  useAdminGetCashbackConfigQuery, useAdminSetCashbackConfigMutation, useAdminGetCashbackStatsQuery,
  useAdminGetReferralStatsQuery, useAdminListRecentReferralsQuery,
  /* Geo */
  useAdminGeoAnalyticsQuery,
  /* Audit */
  useAdminAuditLogsQuery,
  /* System */
  useAdminSystemHealthQuery, useAdminFeatureFlagsQuery, useAdminSetFeatureFlagMutation, useAdminAlertsQuery,
  /* Operations */
  useAdminRetentionQuery, useAdminSupportTicketsQuery, useAdminReplyTicketMutation, useAdminLiveOpsQuery,
  /* BI */
  useAdminServicePnLQuery, useAdminChurnRiskQuery, useAdminDeadCategoriesQuery,
  useAdminGeoReadinessQuery, useAdminQuoteAbandonmentQuery,
  /* Catalog */
  useAdminGetCatalogServicesQuery, useAdminUpdateCatalogServiceMutation,
  useAdminServiceActiveOrderCountQuery, useAdminGetVerticalsQuery, useAdminUpdateVerticalMutation,
  useAdminAddSparePartMutation, useAdminUpdateSparePartMutation, useAdminRemoveSparePartMutation,
} = adminApi;

export default adminApi;
