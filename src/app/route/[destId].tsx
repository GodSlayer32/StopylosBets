import { useLocalSearchParams } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';

export default function RouteScreen() {
  const { destId } = useLocalSearchParams<{ destId: string }>();
  return (
    <Screen>
      <AppText variant="title">Ruta hacia {destId}</AppText>
      <AppText color="textMuted">Aquí verás el plano y los pasos de tu ruta accesible.</AppText>
    </Screen>
  );
}
