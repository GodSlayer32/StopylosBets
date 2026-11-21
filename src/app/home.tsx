import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenState } from '@/components/ScreenState';

export default function Home() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <AppText variant="display">¿A dónde vas?</AppText>
      <Banner tone="warning" text="Ascensor del Edificio C fuera de servicio" />
      <ScreenState variant="loading" title="Buscando salas" message="Cargando los destinos de Casa Central." />
      <Button label="Ir a sala C-210" icon="navigate" fullWidth onPress={() => router.push('/route/C-210')} />
      <Button label="Reportar una barrera" variant="secondary" icon="flag" fullWidth onPress={() => router.push('/report')} />
    </Screen>
  );
}
