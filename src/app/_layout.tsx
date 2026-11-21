import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/context/app-context';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

function ThemedStack() {
  const { colors, typography, accessible } = useTheme();
  const reduceMotion = useReduceMotion();
  return (
    <>
      <StatusBar style={accessible ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text, fontWeight: typography.heading.fontWeight },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'Inicio', headerShown: false, animation: reduceMotion ? 'none' : 'fade', animationDuration: 200 }} />
        <Stack.Screen name="my-day" options={{ title: 'Mi día' }} />
        <Stack.Screen name="route/[destId]" options={{ title: 'Tu ruta', animation: reduceMotion ? 'none' : 'fade_from_bottom', animationDuration: 250 }} />
        <Stack.Screen name="navigate/[destId]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report" options={{ title: 'Reportar barrera', presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemedStack />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
