import { Link, Tabs } from 'expo-router';
import { Easing, useColorScheme } from 'react-native';
import { Animated } from 'react-native';

import { HeaderButton } from '../../components/HeaderButton';
import { TabBarIcon } from '../../components/TabBarIcon';

// Custom slide animation for tab transitions
const forSlide = ({
  current,
  next,
  inverted,
  layouts: { screen }
}: {
  current: { progress: Animated.AnimatedInterpolation<number> };
  next?: { progress: Animated.AnimatedInterpolation<number> } | undefined;
  inverted: Animated.AnimatedInterpolation<number>;
  layouts: { screen: { width: number; height: number } };
}) => {
  const progress = Animated.add(
    current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    next ? next.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }) : 0
  );

  return {
    cardStyle: {
      transform: [
        {
          translateX: Animated.multiply(
            progress.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [screen.width, 0, -screen.width],
              extrapolate: 'clamp',
            }),
            inverted
          ),
        },
      ],
    },
  };
};

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
          borderRadius: 40,
          paddingTop: 10,
        },
        animationEnabled: true,
        cardStyleInterpolator: forSlide,
        detachPreviousScreen: false,
        gestureEnabled: true,
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
            backgroundColor: colorScheme === 'dark' ? 'black' : '#fafaff',
          },
          tabBarIcon: ({ color, focused }: { color: string, focused: boolean }) => (
            <TabBarIcon
              type="AntDesign"
              name={focused ? "clockcircle" : "clockcircleo"}
              color={color}
            />
          ),
          headerRight: () => (
            <Link href="/settings" asChild>
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
            backgroundColor: colorScheme === 'dark' ? 'black' : '#fafaff',
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
