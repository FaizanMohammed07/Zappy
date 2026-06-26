import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Provider } from 'react-redux';
import { store } from '../store';
import '../global.css'; // NativeWind v4 requires this
import * as SecureStore from 'expo-secure-store';
import { setCredentials } from '../store/authSlice';

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Attempt to hydrate auth state from SecureStore
    const loadAuth = async () => {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const roleStr = await SecureStore.getItemAsync('role');
      
      if (accessToken && refreshToken && roleStr) {
        // Hydrate store (user object would normally be fetched via /users/me next)
        store.dispatch(setCredentials({ 
          accessToken, 
          refreshToken, 
          user: null, 
          role: roleStr as 'user' | 'worker' | 'admin' 
        }));
      }

      // Basic Auth Guard logic
      const state = store.getState();
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!state.auth.isAuthenticated && !inAuthGroup) {
        // Redirect to login if not authenticated
        router.replace('/(auth)/login');
      } else if (state.auth.isAuthenticated && inAuthGroup) {
        // Redirect based on role if already authenticated
        if (state.auth.role === 'worker') {
          router.replace('/worker/dashboard');
        } else {
          router.replace('/(tabs)/home');
        }
      }
    };

    loadAuth();
  }, [segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="worker" options={{ headerShown: false }} />
      <Stack.Screen name="tracking/order/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <RootLayoutNav />
    </Provider>
  );
}
