# Ruta Libre

Rutas accesibles y guía no visual para moverse por la USM Casa Central.

Proyecto del **Hackathon LYOSS USM 2026** (21 nov 2026, Casa Central, Valparaíso). Desafío: *Campus sin barreras: movilidad y orientación para todos*.

## Problema

La Casa Central está en la ladera del cerro: desde Av. España hay escaleras, pendientes y desniveles entre edificios. Los ascensores no informan si funcionan. Eso afecta a estudiantes con **movilidad reducida** (silla de ruedas, muletas o una lesión temporal) y con **baja visión**, que hoy dependen de preguntar o de probar caminos.

## Solución

Una misma app y un mismo flujo con dos ajustes:

> **La movilidad cambia la ruta; la visión cambia cómo te la contamos.**

- Movilidad reducida: la app evita escaleras y pendientes fuertes y usa rampas y ascensores.
- Baja visión: voz, vibraciones, referencias físicas, alto contraste y texto grande.

## Funcionalidades

Implementadas y verificables hoy:

- **Perfil de movilidad** (sin restricciones, muletas, silla de ruedas, baja visión).
- **Mapa del campus explorable**: desde el inicio, mapa vectorial con zoom y arrastre; tocar un edificio muestra su planta por piso, estado del ascensor y lista de salas con "Llévame"; buscador de salas y lugares.
- **Rutas por perfil**: Dijkstra con restricciones de escaleras y pendiente.
- **Vista previa** de la ruta con los escalones evitados.
- **Modo navegación en pantalla dividida**, inspirado en la guía del Louvre para Nintendo 3DS: mapa macro o planta por piso con selector de pisos arriba, vista cercana que gira según el rumbo abajo, y mapa superior explorable.
- **Instrucciones por maniobra** paso a paso.
- **Reportes de barreras** con recálculo de ruta en vivo.
- **Estado de ascensores** con frescura ("hace 12 min") y confirmaciones de la comunidad.
- **Baja visión**: alto contraste, texto grande, voz, referencias físicas, dirección horaria ("hacia las 3"), vibraciones distintas por maniobra, botón **Repetir** y compatibilidad con TalkBack.
- **Horario inteligente "Mi día"**.
- **Servicios en ruta y modo lluvia**.

Detalle de inclusión y código de vibraciones: [docs/INCLUSION.md](docs/INCLUSION.md).

## Demo sugerida

1. Elegir el perfil **Muletas**.
2. Pedir ruta a **Laboratorios Edif. C** (416 m, evita 80 escalones) y pulsar **Simular** para recorrerla.
3. Ir a **Mi día**: la **Ayudantía en C-210** (piso 2, Edif. C, sin ascensor) aparece como *Sin ruta accesible · piso sin ascensor*.
4. Pulsar **Solicitar sala accesible**: se abre el mensaje cortés prearmado para compartir con Docencia o el profesor.
5. Opcional: pedir ruta a **Lab. Física** (ascensor del Edif. D), reportar ese ascensor como caído y ver el estado *sin ruta* con alternativa.
6. Cambiar a **Silla de ruedas**: sin ruta autónoma desde Av. España, alternativa por **Placeres** o con acompañante.
7. Cambiar a **Baja visión** y repetir: alto contraste, voz y vibraciones.

## Cómo ejecutar

Requisitos: Node LTS y **Expo Go** en el teléfono.

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go (teléfono y PC en la misma red).

Alternativa por USB (Android):

```bash
adb reverse tcp:8081 tcp:8081
```

y abre `exp://127.0.0.1:8081` en Expo Go.

## Tecnologías

Expo SDK 58, React Native, Expo Router, TypeScript, react-native-svg, react-native-gesture-handler, react-native-reanimated, expo-speech, expo-haptics y @expo/vector-icons. Sin backend: estado en Context y datos en JSON locales.

## Estructura del proyecto

```
src/
  app/          pantallas (Expo Router): inicio, ruta, navegación, reporte
  components/   UI reutilizable (mapas, tarjetas, selector de pisos, ascensores)
  constants/    theme.ts (colores, tipografía, espaciado, radios)
  context/      estado global (perfil, reportes, accesibilidad)
  data/         JSON: nodos, aristas, lugares, ascensores, plantas, horario
  hooks/        tema y simulación de ruta
  lib/          routing (Dijkstra), maniobras, vibraciones, edificios, tiempo
  types/        tipos compartidos
docs/           enunciado, presentación, plano e INCLUSION.md
```

## Datos, supuestos y limitaciones

- El plano de Casa Central (`docs/casa-central-1.jpg`) es real y se trazó a mano a vectores.
- **Edificio C relevado por el equipo** (plantas reales, sin ascensor).
- **Simulados** (resto de edificios): escalones, pendientes, ascensores, plantas interiores, referencias físicas y horario.
- Sin GPS ni posicionamiento interior: la posición es simulada.
- El enfoque es baja visión, no ceguera total.
- Sin backend: los reportes son locales al dispositivo.

## Recursos externos

- Plano de Casa Central: material del desafío / USM.
- Antecedente: tesis USM 2024 *Aplicación móvil de mapa universitario, enfocado en accesibilidad, flexibilidad y eficiencia* (E. Carrillo Naranjo).
- Inspiración de UX: guía del Museo del Louvre para Nintendo 3DS (solo el patrón de interacción, sin assets).
- Skills de Claude Code para UI/UX y accesibilidad (MIT, de Anthropic, Vercel, Next Level Builder, Bencium y AccessLint): ver [`.claude/skills/SOURCES.md`](.claude/skills/SOURCES.md).

## Uso de IA

Desarrollo asistido con **Claude Code**: Claude Opus como arquitecto y revisor, y subagentes Claude Sonnet y Haiku para implementación, búsqueda y chequeos. El equipo definió el problema, el alcance y el diseño de interacción (boceto en pizarra), y validó en dispositivo. Todo el código fue revisado y probado en Expo Go en un Android real.

## Trabajo futuro

- Backend para reportes compartidos entre usuarios.
- Posicionamiento interior con balizas o QR.
- Datos oficiales de Infraestructura.
- Panel para la universidad.
- Validación con usuarios con discapacidad.
- Soporte para ceguera total.

## Integrantes

| Nombre | Rol |
|--------|-----|
| TODO: [Nombre Apellido] | TODO: [Rol] |
| TODO: [Nombre Apellido] | TODO: [Rol] |
| TODO: [Nombre Apellido] | TODO: [Rol] |

## Licencia

[MIT](LICENSE)
