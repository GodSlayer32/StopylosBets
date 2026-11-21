# Mapa de rutas accesibles — USM Casa Central

Genera `mapa-usm-accesible.html`, aquí mismo: el plano del campus con la red de caminos, dónde
hay escaleras, rampas y ascensores, y un ruteador que calcula la ruta según el perfil de
movilidad de quien la pide. Es la pieza de mapeo del MVP; se abre con doble clic, no necesita
servidor ni conexión.

```bash
python mapeo/construir.py
```

Esta carpeta es autocontenida: no depende de nada fuera de ella.

## Archivos

| Archivo | Qué es |
|---|---|
| `red_usm.py` | **El modelo.** Tablas `N` (nodos), `E` (tramos), `VIA` (puntos intermedios del trazado), `DEST` (destinos), `CALLES_EXT` (avenidas del entorno) y `LUGARES` (rótulos de espacios abiertos). Es lo único que se edita para corregir el mapa. |
| `plantilla_usm.html` | Interfaz y lógica de ruteo. Los datos entran por el marcador `__DATOS__`. |
| `red_usm.json` | Salida intermedia de `red_usm.py`. No se edita a mano. |
| `construir.py` | Pega las dos cosas y escribe el HTML. |
| `campus_red.json` | Terreno y polígonos de edificios, extraídos del plano. Entrada, no se edita. |
| `plano-campus.jpg` | El plano original del campus. Es la referencia para corregir coordenadas. |
| `mapa-usm-accesible.html` | La salida. Se regenera, no se edita. |

El terreno (taludes, pasto, cancha, pavimento) y los polígonos de edificios se leen de
`campus_red.json`, que es la extracción automática del plano: esa parte es geometría y está
bien. Lo que se rehízo a mano es la red de caminos.

`red_usm.json` también sirve como fuente de datos para la app: trae nodos, tramos con su tipo y
peldaños, y los 30 destinos con su ficha de accesibilidad. Si la pantalla de ruta lo necesita,
se puede importar tal cual desde `src/`.

## Cómo está trazado

Sobre `plano-campus.jpg`, 1024 × 785 px. La escala (≈ 0,5 m/px) se calibró con la cancha del estadio.
Las coordenadas de los nodos son píxeles de esa imagen, así que para mover un punto basta mirar
el plano y cambiar el par `(x, y)`.

Un tramo se dibuja recto entre sus dos nodos salvo que aparezca en `VIA`, donde se le dan
puntos intermedios para que siga el corredor real del plano (la rampa en zigzag, el sendero
oriente, las curvas de Quezada Acharán). Esos puntos también entran en el cálculo del largo,
así que agregarlos hace la distancia más exacta, no solo más bonita.

Cada tramo lleva:

- **tipo** — `sendero`, `calle`, `escalera`, `rampa`, `ascensor`, `salvaescaleras`, `interior`, `talud`.
- **conf** — qué tan seguro es el dato:
  - `alta`: se ve en el plano o lo afirma la tesis.
  - `media`: inferido del dibujo (trazado, curvas de nivel) con buena evidencia.
  - `baja`: estimado. **Hay que ir a verlo.** Se dibuja punteado y la ficha dice «por verificar».
- **esc** — número de peldaños.
- **nota** — qué se sabe del tramo y de dónde salió.

La cota `z` de cada nodo es una **estimación por terrazas**, no un levantamiento. Sirve para saber
cuánto se sube y se baja y para ordenar los tramos por dificultad, pero las pendientes son órdenes
de magnitud. Por eso `build()` las recorta: máximo 20 % en caminos, 12 % en rampas, 45 % en
escaleras y taludes.

## Cuando no hay ruta

Antes, si el perfil no tenía ningún camino hasta el destino, no se calculaba nada. Ahora
`calcular()` tiene un tercer modo:

1. **estricta** — ruta que cumple todo lo que el perfil necesita.
2. **flexible** — no existe una limpia: se da la de menor dificultad y se marcan los puntos
   donde hace falta ayuda.
3. **parcial** — no existe ninguna. `rutaParcial()` recorre toda la red alcanzable y devuelve la
   ruta hasta el **nodo alcanzable que queda más cerca del destino** (distancia en línea recta).
   El hueco que falta se dibuja con puntos rojos y los metros que quedan, el último punto
   alcanzable lleva una chincheta «!» y el pin del destino se pone en rojo.

Entre el candidato sin barreras y el que las acepta se prefiere **siempre el primero**: pasar por
un tramo duro solo se elige si acerca al destino a menos de la mitad de lo que falta, o si sin él
no se puede avanzar ni un metro. Son justo los tramos que exigen ayuda de otra persona, así que
usarlos para «llegar más cerca» sería hacer trampa con el dato.

Si ni siquiera hay un trayecto parcial (origen aislado, todas sus salidas reportadas), el panel lo
dice y ofrece lo mismo.

## Pedir ayuda: ticket en el portal USM

En los modos **parcial** y **flexible** el panel agrega el bloque «Pedir que te acompañen»:

- un enlace al portal de atención <https://usm.proactivanet.com/proactivanet/portal/>, que se abre
  en una pestaña nueva;
- `textoTicket()` arma la descripción de la solicitud: origen, destino, perfil de movilidad, hasta
  dónde se llega sin ayuda, los metros que faltan, los puntos del trayecto donde se necesita
  acompañamiento, el detalle paso a paso y las barreras reportadas que están cortando el paso;
- al abrir el portal (o con el botón «Copiar el detalle») ese texto se copia al portapapeles para
  pegarlo en la descripción. Si el navegador niega el portapapeles —pasa al abrir el archivo con
  `file://` en algunos navegadores— el texto queda desplegado y seleccionado para copiarlo a mano.

El portal no acepta datos por la URL ni tiene API pública conocida, así que **el ticket no se crea
solo**: la persona lo envía desde el portal con su cuenta institucional. Si más adelante hay un
endpoint para crear solicitudes, el único cambio es reemplazar el enlace por un POST con el mismo
texto que ya genera `textoTicket()`.

## Fuentes

- **Plano:** `plano-campus.jpg` (el plano del campus que entregó el equipo).
- **Accesibilidad:** Cañas Escobar, Camila (2018). *Propuestas para lograr una USM accesible, Casa
  Central*. Memoria de Constructor Civil, Depto. de Obras Civiles, UTFSM.
  <https://repositorio.usm.cl/handle/123456789/6098>

De la tesis salen: los puntajes de las cinco porterías y de cada edificio, qué edificios tienen
ascensor (y que ninguno cumple norma), el salva-escaleras del Edificio C, la escalera que conecta
la Portería Valdés con el Edificio M, y los nombres de las cuatro calles interiores (Quezada
Acharán, Agustín Edwards, Carlos Van Buren, Talleres).

**La tesis es de 2018.** Si desde entonces se construyó una rampa o se arregló un ascensor, el
modelo está desactualizado en ese punto.

## Lo que cambió al revisar el plano a fondo

Una primera versión del modelo tenía una calle bordeando el pie del cerro desde la plaza de
la Portería España hacia el oriente. **No existe:** al ampliar el plano, ese trazo curvo son
curvas de nivel muy juntas, o sea el talud. La consecuencia es fuerte y vale la pena decirla
en la demo: desde la Portería España la única conexión con el campus es la escalera
monumental. Una silla de ruedas tiene que salir a Av. España, rodear por fuera hasta Av. San
Luis y entrar por el oriente a la altura del Auditorio — unos 440 m contra los 190 m de quien
sube la escalera.

## Qué falta verificar en terreno

Los tramos con `conf='baja'` y estos puntos concretos:

1. **Senderos del costado oriente** (`T_PATH ↔ SL_2 ↔ SL_1 ↔ D_N`). Sostienen la única ruta sin
   peldaños entre Av. España y el Patio Central. Si ahí hay escalones, esa ruta no existe.
2. **Rampa en zigzag** junto al Edificio D (`RB_T ↔ RB_M ↔ RB_B`). Se leyó del dibujo por la curva
   de 180° sin marcas de peldaños. Falta confirmar la pendiente y si tiene portón.
3. **Subida por Av. San Luis** (`SL_ESQ → SL_T → T_PATH`): es por donde entra la ruta accesible
   desde Av. España. Falta confirmar que desde San Luis se puede entrar al campus a la altura
   del Auditorio sin peldaños, y qué pendiente real tiene esa cuadra.
4. **Asignación de nombres de calles.** La tesis los nombra pero no los ubica, y en el plano las
   etiquetas están demasiado pixeladas para leerlas. La asignación actual es la más coherente con
   lo que dice la tesis («Acceso Oriente — calle Talleres» y «Acceso Poniente — calle Quezada
   Acharán» para el Edificio C), pero no está confirmada.
5. **Portería Portales.** La tesis la evalúa (es la mejor de las cinco) pero no se pudo ubicar en
   el plano, así que **no está en el modelo**.
6. **Cotas.** Un par de mediciones reales de desnivel (plaza → terraza del A, y calle interior →
   Patio Central) permitirían reemplazar las estimaciones.
