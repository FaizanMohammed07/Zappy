import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { LogOut, User, Phone, Shield } from 'lucide-react-native';
import { logout } from '../../store/authSlice';
import { socketClient } from '../../services/socket/socketClient';

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = useSelector((s: any) => s.auth);
  const user = auth.user || {};

  const doLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('role');
    } catch {}
    socketClient.disconnect();
    dispatch(logout());
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-8">
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-3">
            <User size={36} color="#2563EB" />
          </View>
          <Text className="text-xl font-bold text-navy">{user.name || 'Zappy User'}</Text>
          <Text className="text-gray-500 capitalize">{auth.role || 'customer'}</Text>
        </View>

        <View className="bg-gray-50 rounded-2xl p-4 mb-6">
          {user.phone ? (
            <View className="flex-row items-center gap-3 py-2">
              <Phone size={16} color="#64748B" />
              <Text className="text-navy">{user.phone}</Text>
            </View>
          ) : null}
          <View className="flex-row items-center gap-3 py-2">
            <Shield size={16} color="#64748B" />
            <Text className="text-navy">Verified account</Text>
          </View>
        </View>

        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 border border-red-200 rounded-xl p-4"
          onPress={() => Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log out', style: 'destructive', onPress: doLogout },
          ])}
        >
          <LogOut size={18} color="#EF4444" />
          <Text className="text-red-500 font-bold">Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
