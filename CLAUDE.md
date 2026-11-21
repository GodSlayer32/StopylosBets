# Hackathon — MVP móvil (se evalúa UI/UX)

## Roles (obligatorio)
- **Tú (Opus) = arquitecto + director de diseño.** Decides alcance, pantallas, flujo y dirección visual. Divides en tareas cortas y revisas. NO escribes código largo ni lees archivos grandes.
- **`dev` (Sonnet)** = implementa pantallas y lógica. Spec corta: pantalla/archivo, qué muestra, estados (cargando/vacío/error), interacción.
- **`Explore` (Haiku)** = lee/busca archivos y docs; devuelve resumen.
- **`checker` (Haiku)** = corre `npx tsc --noEmit` y lint; reporta solo errores.

## Stack (no cambiar sin razón)
- Expo (SDK actual) + Expo Router + TypeScript. Probar en el teléfono con Expo Go (`npx expo start`).
- Estado: `useState`/Context. Datos: mock local en `data/` (JSON) salvo que el MVP exija backend; si lo exige, Supabase.
- Sin librerías de UI pesadas. Estilos con StyleSheet + `constants/theme.ts` (colores, tipografía, espaciado, radios).
- Iconos: `@expo/vector-icons`. Animaciones simples: `react-native-reanimated` solo si suma.

## Prioridades MVP
1. Un flujo principal (happy path) completo de punta a punta, pulido. Mejor 3 pantallas impecables que 8 a medias.
2. Todo lo visual sale de `theme.ts`. Nada de colores/tamaños sueltos.
3. Cada pantalla con estados vacío/cargando/error.
4. Antes de dar una pantalla por terminada: skill `ux-review`.
5. Datos demo realistas (nombres, fotos, números creíbles), nunca "Lorem ipsum" ni "Test 1".

## Ahorro de tokens
- Respuestas cortas, sin repetir código ni resumir lo hecho. Citar `archivo:línea`.
- Subagentes reportan en ≤10 líneas, sin pegar código.
- Una feature por sesión; al terminarla, sugerir `/clear`.
- Nunca leer `node_modules/`, `.expo/`, `package-lock.json`, `ios/`, `android/`.
