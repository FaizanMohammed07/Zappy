import { apiSlice } from './apiSlice';

export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<any[], void>({
      query: () => ({
        url: '/orders',
      }),
      transformResponse: (r: any) => r?.orders ?? r ?? [],
      providesTags: ['Order'],
    }),
    getOrderById: builder.query<any, string>({
      query: (id) => ({
        url: `/orders/${id}`,
      }),
      transformResponse: (r: any) => r?.order ?? r,
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
    getQuote: builder.query<any, { service: string; pickupLat: number; pickupLng: number }>({
      query: (params) => ({ url: '/orders/quote', params }),
    }),
    createOrder: builder.mutation<any, any>({
      query: (data) => ({
        url: '/orders',
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Order'],
    }),
    cancelOrder: builder.mutation<any, string>({
      query: (id) => ({
        url: `/orders/${id}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Order', id }, 'Order'],
    }),
    acceptOffer: builder.mutation<any, string>({
      query: (id) => ({
        url: `/orders/${id}/accept`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Order', id }, 'Order'],
    }),
    startTrip: builder.mutation<any, string>({
      query: (id) => ({
        url: `/orders/${id}/start-trip`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
    arrive: builder.mutation<any, string>({
      query: (id) => ({
        url: `/orders/${id}/arrived`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),
    startService: builder.mutation<any, { id: string; otp: string }>({
      query: ({ id, otp }) => ({
        url: `/orders/${id}/start-service`,
        method: 'POST',
        data: { otp },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Order', id: arg.id }],
    }),
    completeService: builder.mutation<any, { id: string; paymentMethod: string }>({
      query: ({ id, paymentMethod }) => ({
        url: `/orders/${id}/complete`,
        method: 'POST',
        data: { paymentMethod },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: 'Order', id: arg.id }, 'Order', 'Wallet'],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useLazyGetQuoteQuery,
  useCreateOrderMutation,
  useCancelOrderMutation,
  useAcceptOfferMutation,
  useStartTripMutation,
  useArriveMutation,
  useStartServiceMutation,
  useCompleteServiceMutation,
} = ordersApi;
