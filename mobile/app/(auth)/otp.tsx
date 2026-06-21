import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLoginUserMutation, useLoginWorkerMutation } from '../../services/api/authApi';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/authSlice';
import * as SecureStore from 'expo-secure-store';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<'user' | 'worker'>('user'); // Basic toggle for demo purposes
  
  const router = useRouter();
  const dispatch = useDispatch();
  
  const [loginUser, { isLoading: isUserLoading }] = useLoginUserMutation();
  const [loginWorker, { isLoading: isWorkerLoading }] = useLoginWorkerMutation();

  const handleVerify = async () => {
    if (!otp) return;
    try {
      const loginMutation = role === 'user' ? loginUser : loginWorker;
      const data = await loginMutation({ phone, otp }).unwrap();
      
      // Securely store tokens
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      await SecureStore.setItemAsync('role', role);

      // Dispatch to Redux
      dispatch(setCredentials({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: role === 'user' ? (data as any).user : (data as any).worker,
        role: role,
      }));

      // Navigation is handled by RootLayout Auth Guard
    } catch (err) {
      console.error('Failed to verify OTP:', err);
    }
  };

  const isLoading = isUserLoading || isWorkerLoading;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-3xl font-bold text-navy mb-2">Verify OTP</Text>
        <Text className="text-gray-500 mb-8">Code sent to {phone}</Text>

        <View className="flex-row mb-6 gap-4">
          <TouchableOpacity 
            className={`flex-1 p-3 rounded-xl border ${role === 'user' ? 'bg-primary border-primary' : 'border-gray-300'}`}
            onPress={() => setRole('user')}
          >
            <Text className={`text-center ${role === 'user' ? 'text-white' : 'text-navy'}`}>Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 p-3 rounded-xl border ${role === 'worker' ? 'bg-primary border-primary' : 'border-gray-300'}`}
            onPress={() => setRole('worker')}
          >
            <Text className={`text-center ${role === 'worker' ? 'text-white' : 'text-navy'}`}>Worker</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          className="border border-gray-300 rounded-xl p-4 text-lg mb-4 text-center tracking-[10px]"
          placeholder="0000"
          keyboardType="number-pad"
          maxLength={4}
          value={otp}
          onChangeText={setOtp}
        />

        <TouchableOpacity 
          className="bg-primary rounded-xl p-4 items-center justify-center flex-row"
          onPress={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
          <Text className="text-white text-lg font-bold">Verify & Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
