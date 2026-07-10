import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useGetServicesQuery } from '../../services/api/catalogApi';

export default function ServicesScreen() {
  const router = useRouter();
  const { data: services = [], isLoading, refetch, isFetching } = useGetServicesQuery();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return services;
    return services.filter((s: any) =>
      (s.name || '').toLowerCase().includes(term) || (s.code || '').toLowerCase().includes(term),
    );
  }, [services, q]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-navy">Services</Text>
        <Text className="text-gray-500 mb-3">Book a verified professional</Text>
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3">
          <Search size={18} color="#94A3B8" />
          <TextInput
            className="flex-1 p-3 text-base"
            placeholder="Search services"
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ padding: 16 }}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const price = Math.round((item.priceRangeMinPaise || 0) / 100);
            return (
              <TouchableOpacity
                className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex-row items-center justify-between"
                onPress={() => router.push(`/book/${item.code}`)}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-navy capitalize">{(item.name || item.code || '').replace(/_/g, ' ')}</Text>
                  {item.description ? (
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <Text className="text-sm font-semibold text-primary mt-1">{price > 0 ? `From ₹${price}` : 'Get Quote'}</Text>
                </View>
                <View className="bg-primary rounded-xl px-4 py-2">
                  <Text className="text-white font-bold text-xs">Book</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">No services found</Text>}
        />
      )}
    </SafeAreaView>
  );
}
