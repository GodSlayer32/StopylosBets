# Inclusión en Ruta Libre

Guía del equipo: por qué la app sirve a dos discapacidades a la vez, qué está hecho y cómo probarlo.

## Idea central

Una misma app y un mismo flujo, con dos ajustes distintos según el perfil:

- **Movilidad reducida** (muletas, silla de ruedas) cambia **la ruta**: por dónde vas. La app evita escaleras y pendientes fuertes y usa rampas y ascensores.
- **Baja visión** cambia **cómo te comunicamos la ruta**: voz, vibraciones, referencias físicas, alto contraste y texto grande.

> Frase para el pitch: *"La movilidad cambia la ruta; la visión cambia cómo te la contamos."*

Para baja visión, el mapa es secundario. Lo que guía es la voz, las vibraciones y las referencias que se pueden tocar u oír.

## Estado de cada punto

| # | Punto | Para quién | Estado |
|---|-------|-----------|--------|
| 1 | Referencias físicas en las instrucciones (barandas, baldosa podotáctil, puertas, sonido de la fuente) y dirección horaria ("hacia las 3") | Baja visión | Hecho (datos simulados) |
| 2 | Vibraciones distintas por maniobra y botón grande "Repetir instrucción" | Baja visión | Hecho |
| 3 | Compatibilidad con TalkBack: anuncios automáticos, etiquetas, estados y encabezados | Baja visión | Hecho (sin probar con TalkBack activo) |
| 4 | Estado de ascensores con frescura y confirmación ("reportado hace 12 min · 3 confirmaciones", "¿Sigue caído?") | Movilidad | En curso |
| 5 | Descanso y servicios en la ruta (bancas, baños accesibles) | Movilidad | Trabajo futuro |
| 6 | Prueba con usuarios en el campus | Ambos | Pendiente (equipo) |

## Código de vibraciones

| Maniobra | Vibración |
|----------|-----------|
| Izquierda | 2 pulsos cortos |
| Derecha | 3 pulsos cortos |
| Recto | 1 pulso suave |
| Ascensor, escalera o rampa | 1 pulso largo + 1 corto |
| Llegada | Vibración de éxito + 2 pulsos largos |
| Aviso a 15 m del giro | 1 pulso suave |

La leyenda también está en la app: botón **?** en la pantalla de navegación.

## Cómo probarlo en el teléfono

### Voz y vibraciones
1. Sube el volumen y quita el modo silencio.
2. En la pantalla de perfil elige **Baja visión**: la app pasa a alto contraste.
3. Inicio → **Llévame** (Laboratorios Edif. C) → **Iniciar ruta**.
4. Toca **Repetir instrucción**: debe leer la instrucción con su referencia física y vibrar según la maniobra.
5. Avanza con ▶ y comprueba que cada giro vibre distinto (2 pulsos = izquierda, 3 = derecha).

### TalkBack
1. Activa TalkBack: Ajustes → Accesibilidad → TalkBack.
2. Recorre perfil → inicio → ruta → navegación deslizando el dedo.
3. Comprueba que:
   - cada botón diga qué hace,
   - las tarjetas de perfil digan si están seleccionadas,
   - el resumen de ruta se lea como una frase ("9 minutos, 305 metros, sin escaleras, evitas 80 escalones"),
   - al avanzar de paso, TalkBack anuncie la maniobra solo.
4. Con TalkBack activo la app no usa su propia voz, para no hablar dos veces.

## Prueba con usuarios (punto 6, ~15 min)

Las bases piden *evidencia real de funcionamiento*. Una prueba corta en Casa Central vale más que cualquier funcionalidad extra.

**Movilidad reducida**
- Un integrante recorre de Av. España al Edificio C con una pierna inmovilizada o muletas prestadas.
- Primero sin la app (eligiendo su camino) y después siguiendo la ruta de la app.
- Anotar: tiempo, escalones subidos, veces que tuvo que devolverse.

**Baja visión**
- Un integrante con lentes empañados o cinta translúcida recorre del Patio Central al Edificio C solo con voz y vibraciones, acompañado por otro por seguridad.
- Anotar: tiempo, errores de dirección, cuántas veces usó "Repetir instrucción", comentarios.

**Para el pitch:** una frase con el resultado, por ejemplo: *"Con la app subió 0 escalones en vez de 80 y llegó en X minutos."*

## Supuestos y límites (declarar en README y pitch)

- Las referencias físicas, escalones, pendientes, estado de ascensores y plantas de los edificios son **simulados**, basados en el plano real de Casa Central.
- No hay GPS ni posicionamiento en interiores: la posición se simula en la demo.
- El enfoque es **baja visión**, no ceguera total; para ceguera se necesitaría validación con usuarios y orientación más fina.
- Antecedente: tesis USM 2024 (E. Carrillo, mapa accesible del Edificio P). Nosotros cubrimos el campus completo, con rutas por perfil, reportes en vivo y guía no visual.
