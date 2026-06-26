import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ChevronLeft, Phone, MessageSquare, X } from 'lucide-react-native';
import { useGetOrderByIdQuery, useCancelOrderMutation } from '../../../services/api/ordersApi';
import { socketClient } from '../../../services/socket/socketClient';

const STAGES = ['searching', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed'];
const LABEL: Record<string, string> = {
  searching: 'Finding a professional…',
  assigned: 'Professional assigned',
  on_the_way: 'On the way to you',
  arrived: 'Arrived at your location',
  in_progress: 'Service in progress',
  completed: 'Service completed',
  cancelled: 'Booking cancelled',
  failed: 'Booking failed',
};
const CANCELLABLE = ['created', 'searching', 'assigned', 'on_the_way'];

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const { data: order, isLoading, refetch } = useGetOrderByIdQuery(String(id), { pollingInterval: 10000 });
  const [cancelOrder, { isLoading: cancelling }] = useCancelOrderMutation();
  const [workerLoc, setWorkerLoc] = useState<{ lat: number; lng: number } | null>(null);

  const pickup = order?.pickupLocation?.coordinates
    ? { lat: order.pickupLocation.coordinates[1], lng: order.pickupLocation.coordinates[0] }
    : null;

  // Live worker location + status updates via socket.
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      await socketClient.connect();
      socketClient.emit('order:subscribe', { orderId: id });
      socketClient.on('worker.location', (d: any) => {
        if (mounted && typeof d?.lat === 'number') setWorkerLoc({ lat: d.lat, lng: d.lng });
      });
      socketClient.on('order.status', () => { if (mounted) refetch(); });
      socketClient.on('worker.assigned', () => { if (mounted) refetch(); });
    })();
    return () => {
      mounted = false;
      socketClient.emit('order:unsubscribe', { orderId: id });
      socketClient.off('worker.location');
      socketClient.off('order.status');
      socketClient.off('worker.assigned');
    };
  }, [id]);

  const status = order?.status;
  const stageIdx = STAGES.indexOf(status);

  const doCancel = () => {
    Alert.alert('Cancel booking', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, cancel', style: 'destructive', onPress: async () => {
        try { await cancelOrder(String(id)).unwrap(); refetch(); } catch (e: any) { Alert.alert('Failed', e?.data?.error || 'Try again'); }
      } },
    ]);
  };

  if (isLoading || !order) {
    return <SafeAreaView className="flex-1 bg-white items-center justify-center"><ActivityIndicator color="#2563EB" /></SafeAreaView>;
  }

  const region = pickup ? { latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 } : undefined;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
          <ChevronLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-navy ml-3">Track Booking</Text>
      </View>

      {/* Map */}
      <View style={{ height: 280 }}>
        {region ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
          >
            {pickup ? <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Your location" pinColor="#2563EB" /> : null}
            {workerLoc ? <Marker coordinate={{ latitude: workerLoc.lat, longitude: workerLoc.lng }} title="Professional" pinColor="#F97316" /> : null}
          </MapView>
        ) : (
          <View className="flex-1 bg-gray-100 items-center justify-center"><Text className="text-gray-400">Map unavailable</Text></View>
        )}
      </View>

      <ScrollView className="flex-1 px-5">
        {/* Status */}
        <View className="bg-primary/5 rounded-2xl p-4 mt-4">
          <Text className="text-lg font-bold text-navy">{LABEL[status] || status}</Text>
          <Text className="text-xs text-gray-500 mt-0.5 capitalize">{String(order.service || '').replace(/_/g, ' ')} · ₹{order.pricing?.total ?? '—'}</Text>
        </View>

        {/* Progress */}
        <View className="mt-5">
          {STAGES.slice(0, 5).map((s, i) => {
            const done = stageIdx >= i;
            return (
              <View key={s} className="flex-row items-center mb-3">
                <View className={`w-3 h-3 rounded-full ${done ? 'bg-primary' : 'bg-gray-200'}`} />
                <Text className={`ml-3 ${done ? 'text-navy font-semibold' : 'text-gray-400'}`}>{LABEL[s]}</Text>
              </View>
            );
          })}
        </View>

        {/* Start-service OTP (show to the professional) */}
        {order.serviceStartOtp && ['assigned', 'on_the_way', 'arrived'].includes(status) ? (
          <View className="bg-accent/10 rounded-2xl p-4 mt-3">
            <Text className="text-xs font-bold text-accent uppercase">Start OTP</Text>
            <Text className="text-2xl font-extrabold text-navy tracking-widest mt-1">{order.serviceStartOtp}</Text>
            <Text className="text-xs text-gray-500 mt-1">Share this with the professional to start the service</Text>
          </View>
        ) : null}

        {/* Worker contact */}
        {order.workerId ? (
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-2 border border-gray-200 rounded-xl p-3" onPress={() => router.push(`/chat/${id}`)}>
              <MessageSquare size={16} color="#2563EB" /><Text className="font-semibold text-navy">Chat</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Cancel */}
        {CANCELLABLE.includes(status) ? (
          <TouchableOpacity className="flex-row items-center justify-center gap-2 mt-5 mb-10" onPress={doCancel} disabled={cancelling}>
            <X size={16} color="#EF4444" /><Text className="text-red-500 font-semibold">Cancel booking</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
