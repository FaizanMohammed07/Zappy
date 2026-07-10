import { apiSlice } from './apiSlice';

export const catalogApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Public service catalog — same source as the website (live prices).
    getServices: builder.query<any[], void>({
      query: () => ({ url: '/catalog/services' }),
      transformResponse: (r: any) => r?.services ?? r ?? [],
    }),
  }),
});

export const { useGetServicesQuery } = catalogApi;
