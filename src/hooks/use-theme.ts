import { useApp } from '@/context/app-context';
import { useAppTheme } from '@/hooks/use-app-theme';

/** Tema activo según el modo accesible del contexto. */
export function useTheme() {
  const { accessibleMode } = useApp();
  return useAppTheme(accessibleMode);
}
