# Ruta Libre

Rutas accesibles y guía no visual para moverse por la USM Casa Central.

Equipo **Stop y los Bets** · **Hackathon LYOSS USM 2026** (21 nov 2026, Casa Central, Valparaíso).
Desafío: *Campus sin barreras: movilidad y orientación para todos*.

> ¿Cómo podemos utilizar la tecnología para reducir las dificultades de orientación y
> desplazamiento que enfrentan estudiantes con distintas necesidades dentro de un campus?

## Equipo

Equipo **Stop y los Bets**:

- Eduardo Pacheco
- Alex Domínguez
- Catalina Yáñez

## Problema

La Casa Central está en la ladera del cerro: desde Av. España hay escaleras, pendientes y desniveles entre edificios. Los ascensores no informan si funcionan. Eso afecta a estudiantes con **movilidad reducida** (silla de ruedas, muletas o una lesión temporal) y con **baja visión**, que hoy dependen de preguntar o de probar caminos.

## Relación con el desafío y los ODS

Responde a *Campus sin barreras* con movilidad (rutas por perfil) y orientación (guía para baja visión y para quien no conoce el campus).

- **ODS 4 · Educación de calidad** (meta 4.a): instalaciones educativas que tengan en cuenta a las personas con discapacidad. Que llegar a clases no dependa de poder subir escaleras.
- **ODS 10 · Reducción de las desigualdades** (meta 10.2): inclusión de todas las personas, independientemente de su discapacidad.
- **ODS 11 · Ciudades y comunidades sostenibles** (meta 11.7): espacios públicos seguros, inclusivos y accesibles, en particular para personas con discapacidad.

## El desafío en cinco decisiones

| | Nuestra decisión |
|---|---|
| **Barrera** | El campus está en un cerro: escaleras, pendientes sobre el 6 % y pisos sin ascensor cortan recorridos que en el plano parecen directos. Y cuando no hay camino, nadie te dice qué hacer. |
| **Personas** | Estudiantes con movilidad reducida (silla de ruedas, muletas, lesión temporal) y con baja visión. |
| **Mejora** | Que la ruta se calcule con las reglas de cada cuerpo, que la guía se pueda seguir sin mirar la pantalla, y que *no haya ruta* deje de ser un callejón sin salida. |
| **Tecnología** | Grafo del campus con Dijkstra y costos por perfil, guía por voz y vibraciones, y reportes de la comunidad que recalculan la ruta en vivo. Todo offline en el teléfono. |
| **Demo** | Un recorrido real en el teléfono, con los tres perfiles y los casos límite: ascensor caído, piso sin ascensor y destino inalcanzable. |

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
- **Cuando no hay ruta, igual te movemos**: la app calcula sola hasta dónde puedes llegar por tu cuenta, te guía hasta ese punto y levanta el ticket de acompañamiento en el portal de atención USM, sin que tengas que pedirlo.
- **Reportes de barreras** con recálculo de ruta en vivo.
- **Estado de ascensores** con frescura ("hace 12 min") y confirmaciones de la comunidad.
- **Baja visión**: alto contraste, texto grande, voz, referencias físicas, dirección horaria ("hacia las 3"), vibraciones distintas por maniobra, botón **Repetir** y compatibilidad con TalkBack.
- **Horario inteligente "Mi día"**.
- **Servicios en ruta y modo lluvia**.

Detalle de inclusión y código de vibraciones: [docs/INCLUSION.md](docs/INCLUSION.md).

## Tecnologías

Expo SDK 58, React Native, Expo Router, TypeScript, react-native-svg, react-native-gesture-handler, react-native-reanimated, expo-speech, expo-haptics, expo-image-picker (foto opcional en reportes) y @expo/vector-icons. Sin backend: estado en Context y datos en JSON locales.

## Estructura del proyecto

```
src/
  app/          pantallas (Expo Router): perfil, inicio, mapa, Mi día, ruta, navegación, reporte
  components/   UI reutilizable (mapas, tarjetas, selector de pisos, ascensores)
  constants/    theme.ts (colores, tipografía, espaciado, radios)
  context/      estado global (perfil, reportes, accesibilidad)
  data/         JSON: nodos, aristas, lugares, ascensores, plantas, horario
  hooks/        tema y simulación de ruta
  lib/          routing (Dijkstra), maniobras, vibraciones, edificios, tiempo
  types/        tipos compartidos
docs/           enunciado, presentación, plano e INCLUSION.md
```

## Instalación y configuración

Requisitos: Node LTS y **Expo Go** en el teléfono.

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go (teléfono y PC en la misma red). No requiere variables de entorno, cuentas ni backend: los datos vienen en `src/data/`.

Alternativa por USB (Android):

```bash
adb reverse tcp:8081 tcp:8081
```

y abre `exp://127.0.0.1:8081` en Expo Go.

## Cómo ejecutar y probar la demo

Historia de Camila Rojas, estudiante en silla de ruedas (perfil por defecto):

1. En el perfil queda marcado **Silla de ruedas** → **Continuar**.
2. En el inicio aparece su próxima clase, **Laboratorio de Ingeniería de Software en P401** (Edif. P, piso 4), con la hora a la que debe salir. Pulsar **Llévame**: ruta de 121 m con 0 escalones (evita 60), ascensor P apto para silla y puertas de 80 cm o más.
3. **Iniciar ruta** → **Simular**: pantalla dividida, con el edificio y el piso arriba y la instrucción del próximo giro abajo, hasta llegar a la P401.
4. De vuelta, ruta a **Laboratorios Edif. C**. Frente al ascensor de P aparece **"¿El ascensor no funciona? Repórtalo"**: al reportarlo, la app explica que no hay otra forma de bajar en silla y **pide apoyo sola** con un ticket que cambia de estado (enviado → apoyo en camino → *El apoyo llegó · te ayudan a bajar*).
5. Pulsar **Ya me ayudaron**: el ticket se cierra, la ruta se recalcula desde el piso 1 de P y Camila llega sola al Edificio C (73 m, 0 escalones).
6. Opcional: abrir **Mapa del campus** desde el inicio, tocar un edificio y recorrer sus pisos, ascensores y salas.
7. Opcional: cambiar a **Baja visión** y repetir: alto contraste, voz y vibraciones distintas por giro.

## Recursos externos y atribuciones

- Plano de Casa Central: material del desafío / USM.
- Antecedente: tesis USM 2024 *Aplicación móvil de mapa universitario, enfocado en accesibilidad, flexibilidad y eficiencia* (E. Carrillo Naranjo).
- Inspiración de UX: guía del Museo del Louvre para Nintendo 3DS (solo el patrón de interacción, sin assets).
- Skills de Claude Code para UI/UX y accesibilidad (MIT, de Anthropic, Vercel, Next Level Builder, Bencium y AccessLint): ver [`.claude/skills/SOURCES.md`](.claude/skills/SOURCES.md).

## Uso de herramientas de IA

Desarrollo asistido con **Claude Code**: Claude Opus como arquitecto y revisor, y subagentes Claude Sonnet y Haiku para implementación, búsqueda y chequeos. El equipo definió el problema, el alcance y el diseño de interacción (boceto en pizarra), y validó en dispositivo. Todo el código fue revisado y probado en Expo Go en un Android real.

El logo de Ruta Libre fue generado con **Google Gemini** (`docs/Gemini_Generated_Image_gqe186gqe186gqe1.jpg`) y elegido por el equipo.

## Limitaciones conocidas, datos y supuestos

- El plano de Casa Central (`docs/casa-central-1.jpg`) es real y se trazó a mano a vectores.
- **Edificios C y F dibujados por el equipo** (C: piso 1 real y sin ascensor; F: piso 1 y subterráneo).
- **Edificio P**: esquema simple de 5 pisos (-1 a 4) con ascensor y túnel bajo Av. Placeres; los nombres de los pisos 1 y -1 vienen de la tesis USM 2024 y el resto es simulado.
- **Simulados** (resto de edificios): escalones, pendientes, ascensores, plantas interiores, referencias físicas y horario.
- Sin GPS ni posicionamiento interior: la posición es simulada.
- El enfoque es baja visión, no ceguera total.
- Sin backend: los reportes son locales al dispositivo.
- El **ticket de apoyo** (folio, "portal de atención USM", apoyo en terreno de la DAE y sus estados) es **simulado**: no hay integración real con la universidad.

## Trabajo futuro

- Backend para reportes compartidos entre usuarios.
- Posicionamiento interior con balizas o QR.
- Datos oficiales de Infraestructura.
- Panel para la universidad.
- Validación con usuarios con discapacidad.
- Soporte para ceguera total.

## Licencia

[MIT](LICENSE)
