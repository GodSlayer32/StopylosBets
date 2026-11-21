import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors, typography } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
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
        <Stack.Screen name="report" options={{ title: 'Reportar barrera', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
