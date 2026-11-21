# Council UX — Ronda 2: votación

Regla del usuario: solo se implementa lo que TODAS las lentes aprueban (unanimidad).
Vota cada propuesta desde TU skill: A (apruebo) / R (rechazo: perjudica algo que tu skill protege) / N (neutral: mi skill no tiene objeción).
N cuenta como "de acuerdo"; un solo R la bloquea. Rechaza solo con razón concreta de tu skill.
Ya corregidos (no votar): chip "Ya reportado" desbordado; ✓ duplicado en chips de silla.

| ID | Propuesta | Origen |
|----|-----------|--------|
| C1 | Áreas táctiles ≥48: filas FloorRail (36→48 o 44+hitSlop), botones ‹ › 🔊 y Simular de la tarjeta compacta (44→48/minTouch), "Mi posición" (44→48), botón borrar búsqueda (minTouch). | RN, PM, A11y |
| C2 | Botón deshabilitado (‹ en paso 1): sin opacity 0.4; usar icono/borde en textMuted visible (y en alto contraste borde blanco tenue). | PM, A11y, BF |
| C3 | Tarjeta compacta: "Luego…" en hasta 2 líneas (no truncar); tamaños 12/13 literales → tokens de typography (mín 13). | PM, BF, A11y |
| C4 | Eliminar fontSize literales en toda la app → tokens (mín 13; "Exterior" del FloorRail 11→13); `maxFontSizeMultiplier=1.6` en AppText y minHeight en vez de height en controles con texto. | PM, A11y |
| C5 | Contraste de bordes: nuevo token `borderStrong` (~#8A94A6, ≥3:1) para chips sin seleccionar, inputs y tarjetas pulsables; `border` queda para divisores. | A11y |
| C6 | Oscurecer `warning` (#9A4504) y `success` (#116A33) para margen AA (≥5.5:1) en pills/chips. | A11y |
| C7 | Hook `useReduceMotion` (AccessibilityInfo.isReduceMotionEnabled + evento) aplicado a fade interior/exterior, pulso del FloorRail y aviso de recálculo. | RN, A11y |
| C8 | `accessibilityLiveRegion="polite"` en la instrucción de la tarjeta; announce solo para el aviso de 15 m. | A11y |
| C9 | Chip con prop `role`: selección única → radio+checked dentro de radiogroup (tipos de barrera, ascensor); filtros → checkbox. | A11y |
| C10 | Modales (vibraciones, hoja de ascensor): accessibilityViewIsModal, onRequestClose, foco al título, paddingBottom con insets.bottom. | A11y, RN |
| C11 | Feedback al presionar en Button/Chip/Card: android_ripple con primarySoft + leve oscurecimiento (sin scale); háptico Light en Button primario. | RN, BF |
| C12 | Reportar: teclado no tapa la descripción ni Enviar (KeyboardAvoidingView/scroll al input; keyboardShouldPersistTaps="handled" en Screen). | RN |
| C13 | Inicio: "Llévame" único CTA primario de la tarjeta; "Ver mi día" como acción secundaria alineada a la izquierda; borde de tarjeta 1 px; banner de avisos más discreto (dangerSoft sin borde de 2 px); más aire entre tarjeta y avisos. | PM, BF |
| C14 | Vista previa: métricas en 3 columnas alineadas (min · metros · escalones); "Está lloviendo" en una fila compacta sin tarjeta propia; footer en una sola fila (Iniciar ruta + botón icono "Escuchar" 52×52) para que el mapa se vea sin scroll. | PM, BF |
| C15 | Mi día: quitar título duplicado (display → "Sábado 21 · son las 11:12"); el tramo entre clases dentro de la tarjeta de la clase siguiente (estado → horario → acciones); clase terminada sin opacidad en el texto (check + "Terminada"). | PM, BF, A11y |
| C16 | Switch con trackColor/thumbColor del theme (apagado visible) y estado en accessibilityState. | PM |
| C17 | Silla sin ruta: círculo en primarySoft con icono primary (menos alarma), icono del CTA Placeres = map/navigate (no caminante), bloque centrado verticalmente; "Voy con acompañante" mismo peso visual. | BF |
| C18 | Perfil: arriba del titular "Ruta Libre" + isotipo simple (icono) + "USM Casa Central". | BF |
| C19 | Cambiar el acento de marca (#1747D1) por un color institucional/menos genérico, solo tokens. | BF |
| C20 | Tipografía Atkinson Hyperlegible (expo-font) para display/title; cuerpo sistema. | BF |
| C21 | Estabilidad de navegación: congelar la ruta en navigate (no refetch al votar en el prompt); TICK_MS 33→66; mover derivaciones costosas fuera del tick; memo en FloorRail/InstructionCard. | Perf |
| C22 | Indicador "Recalculando…" (opacidad 0.6 en la tarjeta de ruta) al activar lluvia/acompañante. | Perf |
| C23 | Voz: al activar 🔊 leer la maniobra actual; aviso de 15 m cuando dist ≤15 aunque se salte (sin límite inferior 8). | Perf |
| C24 | Auto-retorno de exploración con timer de 8 s (no solo al cambiar maniobra). | Perf |
| C25 | `denyIncident`/`confirmIncident` estables (ref o lógica en updater) para no leer estado viejo al votar rápido. | Perf |
| C26 | Motion al cambiar de paso: texto de la tarjeta translateX ±12 (200 ms, native driver) + pulso del icono; respeta reduce motion. | BF |
| C27 | Transiciones de stack: fade_from_bottom en vista previa, fade al pasar de perfil a inicio (~250 ms). | BF |
| C28 | TalkBack: título del header con el destino ("C-210") en vista previa; links internos con role button; quitar hints redundantes "Toca para…". | RN, A11y |

Responde SOLO con una línea por ID: `C# | A/R/N | motivo ≤10 palabras (obligatorio si R)`.

## Resultado de la votación (5 lentes: React Native, UI/UX Pro Max, Bencium + Frontend Design, Accesibilidad WCAG, React perf/composición)

- **Implementadas (unanimidad):** C1–C12, C14–C18, C21, C23–C25, C27, C28.
- **Implementadas recortadas:** C13 (sin tocar el borde del banner de avisos, objeción de accesibilidad) y C22 ("Recalculando…" con texto y spinner, sin bajar opacidad).
- **Rechazadas:** C19 (cambio de acento: riesgo de contraste), C20 (fuente custom: riesgo en Expo Go y parpadeo), C26 (animación por paso: carga y tirones).
