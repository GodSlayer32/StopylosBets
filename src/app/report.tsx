import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';

export default function Report() {
  const router = useRouter();
  return (
    <Screen>
      <AppText variant="title">¿Qué barrera encontraste?</AppText>
      <ScreenState variant="error" title="No pudimos enviar" message="Revisa tu conexión e inténtalo otra vez." onAction={() => {}} />
      <Button label="Cerrar" variant="ghost" fullWidth onPress={() => router.back()} />
    </Screen>
  );
}
