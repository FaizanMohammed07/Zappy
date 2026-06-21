import { Tabs } from 'expo-router';
import { Home, ClipboardList, Settings } from 'lucide-react-native';

export default function WorkerLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#F97316', // Zappy Accent Orange for Worker app
      headerShown: false,
    }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'Offers',
          tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />, // Change icon later
        }}
      />
    </Tabs>
  );
}
