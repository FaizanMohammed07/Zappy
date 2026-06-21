import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { useGetOrdersQuery } from '../../services/api/ordersApi';
import { logout } from '../../store/authSlice';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const { data: orders, isLoading } = useGetOrdersQuery();
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('role');
    dispatch(logout());
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-lightBg">
      <ScrollView className="flex-1 px-4 pt-6">
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-gray-500 text-sm">Welcome back,</Text>
            <Text className="text-2xl font-bold text-navy">{user?.name || 'Customer'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} className="bg-gray-200 px-4 py-2 rounded-full">
            <Text className="text-navy font-bold">Logout</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-primary p-6 rounded-3xl mb-8">
          <Text className="text-white text-2xl font-bold mb-2">Need Help Now?</Text>
          <Text className="text-blue-100 mb-4">Book a top-rated professional in minutes.</Text>
          <TouchableOpacity className="bg-white px-6 py-3 rounded-full self-start">
            <Text className="text-primary font-bold">Explore Services</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xl font-bold text-navy mb-4">Your Recent Bookings</Text>
        
        {isLoading ? (
          <ActivityIndicator color="#2563EB" />
        ) : (
          orders?.length ? (
            orders.map(order => (
              <TouchableOpacity 
                key={order._id} 
                className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100"
                onPress={() => router.push(`/tracking/order/${order._id}`)}
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="font-bold text-lg">{order.service}</Text>
                  <Text className="text-primary font-bold">₹{order.price}</Text>
                </View>
                <Text className="text-gray-500 mb-2">{order.status}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-gray-500">No recent bookings found.</Text>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
