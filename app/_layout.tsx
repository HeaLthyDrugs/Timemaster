import '../global.css';
import 'expo-dev-client';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Icon } from '@roninoss/icons';
import { Link, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';

import { ThemeToggle } from '~/components/ThemeToggle';
import { cn } from '~/lib/cn';
import { useColorScheme, useInitialAndroidBarSync } from '~/lib/useColorScheme';
import { NAV_THEME } from '~/theme';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { NetworkProvider } from '../contexts/NetworkContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Auth guard component to handle protected routes
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inLoginPage = segments[0] === 'login';

    if (!user && !inAuthGroup && !inLoginPage) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (user && (inAuthGroup || inLoginPage)) {
      // Redirect to main app if already authenticated
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading, router]);

  if (isLoading) {
    // You could add a loading screen here
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  useInitialAndroidBarSync();
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  return (
    <>
      <StatusBar
        key={`root-status-bar-${isDarkColorScheme ? 'light' : 'dark'}`}
        style={isDarkColorScheme ? 'light' : 'dark'}
      />
      
      <NetworkProvider>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <ActionSheetProvider>
                <NavThemeProvider value={NAV_THEME[colorScheme]}>
                  <AuthGuard>
                    <Stack screenOptions={SCREEN_OPTIONS}>
                      <Stack.Screen name="(tabs)" options={TABS_OPTIONS} />
                      <Stack.Screen name="login" options={LOGIN_OPTIONS} />
                      <Stack.Screen name="modal" options={MODAL_OPTIONS} />
                    </Stack>
                  </AuthGuard>
                </NavThemeProvider>
              </ActionSheetProvider>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </NetworkProvider>
    </>
  );
}

const SCREEN_OPTIONS = {
  animation: 'ios_from_right', // for android
} as const;

const TABS_OPTIONS = {
  headerShown: false,
} as const;

const LOGIN_OPTIONS = {
  headerShown: false,
} as const;

const INDEX_OPTIONS = {
  headerLargeTitle: true,
  title: 'NativeWindUI',
  headerRight: () => <SettingsIcon />,
} as const;

function SettingsIcon() {
  const { colors } = useColorScheme();
  return (
    <Link href="/modal" asChild>
      <Pressable className="opacity-80">
        {({ pressed }) => (
          <View className={cn(pressed ? 'opacity-50' : 'opacity-90')}>
            <Icon name="cog-outline" color={colors.foreground} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
} as const;
