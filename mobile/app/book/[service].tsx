import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import { MapPin, ChevronLeft } from 'lucide-react-native';
import { useLazyGetQuoteQuery, useCreateOrderMutation } from '../../services/api/ordersApi';

export default function BookServiceScreen() {
  const { service } = useLocalSearchParams<{ service: string }>();
  const router = useRouter();

  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(true);

  const [fetchQuote, { data: quote, isFetching: quoting }] = useLazyGetQuoteQuery();
  const [createOrder, { isLoading: creating }] = useCreateOrderMutation();

  // Get current GPS on mount + reverse-geocode for a readable address.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocating(false); return; }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setLoc({ lat, lng });
        try {
          const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (a) setAddress([a.name, a.street, a.city, a.region].filter(Boolean).join(', '));
        } catch {}
        fetchQuote({ service: String(service), pickupLat: lat, pickupLng: lng });
      } catch {
        Alert.alert('Location error', 'Could not get your location. Enable GPS and try again.');
      } finally {
        setLocating(false);
      }
    })();
  }, [service]);

  const price = quote?.quote?.total ?? quote?.total;

  const confirm = async () => {
    if (!loc) { Alert.alert('Location needed', 'We need your location to find a nearby pro.'); return; }
    if (!address.trim()) { Alert.alert('Address needed', 'Please enter your address.'); return; }
    try {
      const res = await createOrder({
        service: String(service),
        pickupLocation: { lat: loc.lat, lng: loc.lng, address: address.trim() },
        ...(price ? { quotedTotalRupees: Math.round(price) } : {}),
      }).unwrap();
      const id = res?.order?._id || res?._id;
      if (id) router.replace(`/tracking/order/${id}`);
    } catch (e: any) {
      const code = e?.data?.code;
      if (code === 'NO_WORKERS_IN_AREA') {
        Alert.alert("We're not in your area yet", 'No workers available here right now — we are expanding fast!');
      } else {
        Alert.alert('Booking failed', e?.data?.error || 'Please try again.');
      }
    }
  };

  const title = String(service || '').replace(/_/g, ' ');

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
          <ChevronLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-navy ml-3 capitalize">{title}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className="text-sm font-bold text-gray-400 uppercase mt-4 mb-2">Service location</Text>
        <View className="bg-gray-50 rounded-2xl p-4 flex-row items-start gap-3">
          <MapPin size={18} color="#2563EB" />
          <View className="flex-1">
            {locating ? (
              <Text className="text-gray-400">Getting your location…</Text>
            ) : loc ? (
              <Text className="text-xs text-gray-400">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</Text>
            ) : (
              <Text className="text-red-500 text-xs">Location unavailable — enable GPS</Text>
            )}
          </View>
        </View>

        <Text className="text-sm font-bold text-gray-400 uppercase mt-5 mb-2">Address</Text>
        <TextInput
          className="border border-gray-200 rounded-xl p-3 text-base"
          placeholder="House / flat, area, landmark"
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <Text className="text-sm font-bold text-gray-400 uppercase mt-5 mb-2">Price</Text>
        <View className="bg-primary/5 rounded-2xl p-4">
          {quoting ? (
            <ActivityIndicator color="#2563EB" />
          ) : price ? (
            <Text className="text-2xl font-extrabold text-navy">₹{Math.round(price)}</Text>
          ) : (
            <Text className="text-gray-400">Quote will appear after location is set</Text>
          )}
          {quote?.quote?.surgeMultiplier > 1 ? (
            <Text className="text-xs text-accent mt-1">{quote.quote.surgeMultiplier}× surge in effect</Text>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3 bg-white border-t border-gray-100">
        <TouchableOpacity
          className="bg-primary rounded-2xl p-4 items-center flex-row justify-center gap-2"
          onPress={confirm}
          disabled={creating || locating}
        >
          {creating ? <ActivityIndicator color="#fff" /> : null}
          <Text className="text-white text-lg font-bold">{creating ? 'Booking…' : 'Confirm Booking'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
