import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRequestOtpMutation } from '../../services/api/authApi';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const router = useRouter();
  const [requestOtp, { isLoading, error }] = useRequestOtpMutation();

  const handleSendOtp = async () => {
    if (!phone) return;
    try {
      await requestOtp({ phone }).unwrap();
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    } catch (err) {
      console.error('Failed to send OTP:', err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-center">
        <Text className="text-3xl font-bold text-navy mb-2">Welcome to Zappy</Text>
        <Text className="text-gray-500 mb-8">Enter your phone number to continue</Text>

        <TextInput
          className="border border-gray-300 rounded-xl p-4 text-lg mb-4"
          placeholder="Phone Number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
        />

        {error ? <Text className="text-red-500 mb-4">Error sending OTP. Try again.</Text> : null}

        <TouchableOpacity 
          className="bg-primary rounded-xl p-4 items-center justify-center flex-row"
          onPress={handleSendOtp}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" className="mr-2" /> : null}
          <Text className="text-white text-lg font-bold">Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
