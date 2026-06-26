import { apiSlice } from './apiSlice';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    requestOtp: builder.mutation<{ success: boolean; message: string }, { phone: string }>({
      query: (data) => ({
        url: '/auth/otp/request',
        method: 'POST',
        data,
      }),
    }),
    loginUser: builder.mutation<{ accessToken: string; refreshToken: string; user: any }, { phone: string; otp: string }>({
      query: (data) => ({
        url: '/auth/user/login',
        method: 'POST',
        data,
      }),
    }),
    loginWorker: builder.mutation<{ accessToken: string; refreshToken: string; worker: any }, { phone: string; otp: string }>({
      query: (data) => ({
        url: '/auth/worker/login',
        method: 'POST',
        data,
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),
    getMe: builder.query<any, void>({
      query: () => ({
        url: '/users/me',
      }),
      providesTags: ['User'],
    }),
  }),
});

export const {
  useRequestOtpMutation,
  useLoginUserMutation,
  useLoginWorkerMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
