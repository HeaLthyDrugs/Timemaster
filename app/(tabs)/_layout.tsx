import { Link, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import { HeaderButton } from '../../components/HeaderButton';
import { TabBarIcon } from '../../components/TabBarIcon';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? 'white' : 'black',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#888888' : '#888888',
        tabBarShowLabel: false,
        headerShadowVisible: false,
        elevation: 0,
        headerShown: true,
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : 'white',
        },
        headerTitleStyle: {
          color: colorScheme === 'dark' ? 'white' : 'black',
        },
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : 'white',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Track',
          headerTitle: 'Track',
          headerTitleStyle: {
            fontSize: 32,
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? 'black' : 'white',
          },
          tabBarIcon: ({ color, focused }: { color: string, focused: boolean }) => (
            <TabBarIcon 
              type="AntDesign" 
              name={focused ? "clockcircle" : "clockcircleo"} 
              color={color} 
            />
          ),
          headerRight: () => (  
            <Link href="/modal" asChild>
              <HeaderButton />
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analytics',
          headerTitle: 'Analysis',
          headerTitleStyle: {
            fontSize: 32,
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? 'black' : 'white',
          },
          tabBarIcon: ({ color, focused }: { color: string, focused: boolean }) => (
            <TabBarIcon 
              type='Ionicons' 
              name={focused ? "pie-chart" : "pie-chart-outline"} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
