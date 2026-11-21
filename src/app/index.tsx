import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';

export default function MobilityProfile() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <AppText variant="display">¿Cómo te mueves por el campus?</AppText>
      <AppText color="textMuted">Elige tu perfil y te mostramos las rutas que sí funcionan para ti.</AppText>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ScreenState variant="empty" title="Perfiles próximamente" message="Aquí vas a elegir muletas, silla de ruedas o baja visión." />
      </View>
      <Button label="Continuar" icon="arrow-forward" fullWidth onPress={() => router.push('/home')} />
    </Screen>
  );
}
