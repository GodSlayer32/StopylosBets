import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';

function ThemedStack() {
  const { colors, typography, accessible } = useTheme();
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
        <Stack.Screen name="home" options={{ title: 'Inicio', headerShown: false }} />
        <Stack.Screen name="route/[destId]" options={{ title: 'Tu ruta' }} />
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
