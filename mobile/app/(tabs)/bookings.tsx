import React from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useGetOrdersQuery } from '../../services/api/ordersApi';

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-success',
  cancelled: 'text-red-500',
  failed: 'text-red-500',
  searching: 'text-accent',
};

const ACTIVE = ['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'];

export default function BookingsScreen() {
  const router = useRouter();
  const { data: orders = [], isLoading, refetch, isFetching } = useGetOrdersQuery();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-navy">My Bookings</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2563EB" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ padding: 16 }}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }: any) => {
            const isActive = ACTIVE.includes(item.status);
            return (
              <TouchableOpacity
                className="bg-white border border-gray-100 rounded-2xl p-4 mb-3"
                onPress={() => router.push(`/tracking/order/${item._id}`)}
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-bold text-navy capitalize">{String(item.service || '').replace(/_/g, ' ')}</Text>
                  <Text className={`text-xs font-bold capitalize ${STATUS_STYLE[item.status] || 'text-primary'}`}>
                    {String(item.status || '').replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400 mt-1">{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''}</Text>
                <View className="flex-row justify-between items-center mt-2">
                  {item.pricing?.total ? <Text className="text-sm font-bold text-navy">₹{item.pricing.total}</Text> : <View />}
                  {isActive ? <Text className="text-xs font-semibold text-primary">Track →</Text> : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <Calendar size={40} color="#CBD5E1" />
              <Text className="text-gray-400 mt-3">No bookings yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
