# -*- coding: utf-8 -*-
"""
Red de rutas accesibles de USM Casa Central, mapeada a mano sobre aasas.jpg.

Fuentes:
  - Geometria: plano aasas.jpg (1024x785 px, ~0.5 m/px, medido con la cancha del estadio).
  - Poligonos de edificios y terreno: tools/campus_red.json (extraccion automatica, geometria fiable).
  - Datos de accesibilidad: tesis USM "Propuestas para lograr una USM accesible, Casa Central",
    Canas Escobar, Camila (2018), Depto. Obras Civiles UTFSM.
    https://repositorio.usm.cl/handle/123456789/6098

conf: alta  = visible en el plano o afirmado en la tesis
      media = inferido del dibujo (trazado, curvas de nivel) con buena evidencia
      baja  = estimado, hay que verificar en terreno
"""
import json, re, io, os

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, 'campus_red.json')
M_POR_PX = 0.5

# ---------------------------------------------------------------- nodos
# id: (x, y, z_estimada_m, nombre)
N = {
    # --- Acceso Av. Espana (sur, cota baja)
    'ESP_AV':    (600, 694, 8, 'Av. España (paradero)'),
    'PORT_ESP':  (609, 667, 10, 'Portería España'),
    'PLAZA':     (645, 671, 13, 'Plaza del Monumento a Don Federico Santa María'),
    'ESC_PIE':   (637, 657, 13, 'Pie de la escalera monumental'),
    'ESC_CIMA':  (635, 639, 19, 'Cima de la escalera monumental'),
    'BALCON':    (634, 629, 19, 'Balcón mirador sobre la escalera'),
    'PERG_E':    (628, 648, 13, 'Pérgola (extremo oriente)'),
    'PERG_W':    (583, 645, 13, 'Pérgola (extremo poniente)'),
    # --- Av. Espana hacia el oriente y subida por Av. San Luis.
    #     Al oriente de la plaza el plano solo muestra talud: no hay camino al pie del cerro.
    'ESP_E1':    (760, 690,  8, 'Av. España (hacia el oriente)'),
    'ESP_E2':    (890, 676,  9, 'Av. España, antes de San Luis'),
    'SL_ESQ':    (972, 662, 11, 'Esquina Av. España con Av. San Luis'),
    'SL_T':      (949, 604, 15, 'Av. San Luis, frente al Edificio T'),

    # --- Calle Agustin Edwards (terraza frente al Edificio A)
    'AE_W':      (575, 608, 19, 'Calle Agustín Edwards (poniente)'),
    'AE_C':      (637, 607, 19, 'Calle Agustín Edwards (frente al Edificio A)'),
    'AE_E':      (688, 605, 19, 'Calle Agustín Edwards (oriente)'),

    # --- Edificio A
    'A_S':       (640, 597, 19, 'Acceso sur Edificio A'),
    'A_W':       (572, 578, 19, 'Acceso poniente Edificio A'),
    'A_N':       (676, 566, 31, 'Acceso norte Edificio A (Patio Central)'),
    'A_ASC':     (658, 558, 19, 'Ascensor Edificio A'),

    # --- Patio Central
    'PC_S':      (670, 562, 31, 'Patio Central (sur)'),
    'PC_C':      (676, 518, 31, 'Patio Central'),
    'PC_N':      (684, 471, 31, 'Patio Central (norte)'),
    'PC_NE':     (731, 470, 32, 'Patio Central (esquina nororiente)'),
    'GIM1':      (602, 556, 28, 'Gimnasío 1 y Sala de estar'),

    # --- Biblioteca (Edificio U) y su patio interior
    'U_PATIO':   (601, 505, 31, 'Patio interior Edificio U'),
    'U_ESC':     (609, 531, 31, 'Escalera del patio interior U'),
    'U_N':       (600, 455, 34, 'Patio interior U (acceso norte)'),
    'U_ACC':     (563, 467, 34, 'Acceso principal Biblioteca (Edificio U)'),
    'U_ASC':     (570, 500, 31, 'Ascensor Biblioteca'),

    # --- Edificio B y piscina
    'B_S':       (660, 476, 32, 'Acceso sur Edificio B (Patio Central)'),
    'B_N':       (640, 361, 43, 'Acceso norte Edificio B (calle interior)'),
    'B_W':       (568, 402, 39, 'Acceso poniente Edificio B'),
    'PISCINA':   (642, 416, 36, 'Piscina Edificio B'),

    # --- Rampa en zigzag entre el nivel de B y el Patio Central
    'RB_T':      (763, 439, 39, 'Cabecera de la rampa en zigzag'),
    'RB_M':      (709, 452, 36, 'Rampa en zigzag (vuelta)'),
    'RB_B':      (766, 467, 33, 'Pie de la rampa en zigzag'),

    # --- Calle Talleres (oriente)
    'TAL_N':     (732, 251, 50, 'Calle Talleres (norte)'),
    'TAL_J':     (740, 263, 50, 'Edificio J'),
    'TAL_K':     (748, 333, 45, 'Calle Talleres frente al CIAC'),
    'TAL_M':     (741, 381, 42, 'Calle Talleres (tramo medio)'),
    'TAL_S':     (746, 421, 40, 'Calle Talleres (sur)'),
    'O_N':       (778, 431, 38, 'Edificios O y N'),

    # --- Calle interior entre el Edificio C y el Edificio B
    'SP_W':      (460, 357, 43, 'Calle interior (extremo poniente)'),
    'SP_1':      (520, 356, 43, 'Calle interior (tramo 1)'),
    'SP_2':      (590, 355, 43, 'Calle interior (tramo 2)'),
    'SP_3':      (660, 356, 43, 'Calle interior (tramo 3)'),
    'SP_E':      (722, 358, 43, 'Calle interior (extremo oriente)'),

    # --- Calle Quezada Acharan (poniente del Edificio C)
    'QA_N':      (463, 251, 50, 'Calle Quezada Acharán (norte)'),
    'QA_M':      (452, 300, 46, 'Calle Quezada Acharán (medio)'),
    'QA_S':      (456, 345, 43, 'Calle Quezada Acharán (sur)'),

    # --- Franja norte y Av. Los Placeres
    'CN_W':      (468, 247, 50, 'Vereda norte (poniente)'),
    'CN_M':      (590, 246, 50, 'Vereda norte (frente al Edificio C)'),
    'CN_E':      (712, 248, 50, 'Vereda norte (oriente)'),
    'PORT_PLA':  (651, 242, 50, 'Portería Placeres'),
    'AV_PLA':    (651, 231, 50, 'Av. Los Placeres'),
    'AV_PLA_W':  (470, 229, 50, 'Av. Los Placeres (poniente)'),
    'PORT_EDP':  (600, 207, 51, 'Portería Edificio Placeres'),
    'P_ACC':     (600, 200, 51, 'Edificio P / Federación de Estudiantes'),
    'P2_ACC':    (611, 159, 52, 'Edificio P2'),

    # --- Edificio C
    'C_W':       (463, 320, 47, 'Acceso poniente Edificio C'),
    'C_S1':      (546, 351, 43, 'Acceso sur poniente Edificio C'),
    'C_S2':      (656, 353, 43, 'Acceso sur oriente Edificio C'),
    'C_N':       (590, 254, 50, 'Acceso norte Edificio C'),
    'C_E':       (719, 300, 46, 'Acceso oriente Edificio C (Calle Talleres)'),
    'C_SALVA':   (560, 347, 43, 'Salva-escaleras Edificio C'),
    'C_INT':     (592, 304, 46, 'Interior Edificio C (nivel intermedio)'),

    # --- Parque entre el Edificio L y el estadio
    'PQ_N':      (497, 372, 37, 'Parque (norte)'),
    'PQ_C':      (505, 420, 32, 'Parque (centro)'),
    'PQ_S':      (497, 452, 29, 'Parque (sur)'),
    'L_ACC':     (484, 463, 28, 'Edificio L'),

    # --- Estadio y patios deportivos
    'EST_NE':    (482, 388, 24, 'Estadio (esquina nororiente)'),
    'EST_E':     (487, 470, 24, 'Estadio (costado oriente)'),
    'EST_SE':    (480, 548, 23, 'Estadio (esquina suroriente)'),
    'EST_N':     (420, 371, 24, 'Patio de las Palmas / estadio (norte)'),
    'EST_S':     (420, 560, 23, 'Estadio (sur)'),

    # --- Poniente: Pasaje Valdes, Edificio M, M2
    'PORT_VAL':  (258, 300, 44, 'Portería Valdés'),
    'VAL_S':     (255, 345, 42, 'Pasaje Valdés (sur)'),
    'M_ACC':     (290, 352, 37, 'Acceso Edificio M'),
    'M_S':       (296, 420, 31, 'Edificio M (extremo sur)'),
    'M2_ACC':    (324, 390, 29, 'Edificio M2 / Gimnasío 2'),
    'CANCHAS':   (345, 430, 26, 'Canchas 5x5 y 7x7'),
    'R_ACC':     (335, 245, 49, 'Edificio R / Relaciones Estudiantiles'),
    'R2_ACC':    (379, 283, 47, 'Edificio R2 / Sansanito'),
    'RR_PATH':   (400, 310, 45, 'Sendero entre R2 y la calle interior'),

    # --- Casa del Rector
    'H_ACC':     (477, 586, 23, 'Edificio H / Casa del Rector'),
    'H_N':       (486, 563, 24, 'Jardin norte de la Casa del Rector'),

    # --- Oriente: D, E, F, F2, T, cancha de tenis
    'D_N':       (760, 480, 32, 'Acceso norte Edificio D (Comedor)'),
    'D_W':       (722, 519, 31, 'Acceso poniente Edificio D (Comedor)'),
    'D_S':       (757, 570, 27, 'Acceso sur Edificio D'),
    'E_ACC':     (790, 561, 25, 'Edificio E'),
    'E_ASC':     (795, 556, 25, 'Ascensor Edificio E'),
    'CEIBOS':    (762, 604, 21, 'Patio de los Ceibos y Patio del Cañón'),
    'F2_ACC':    (730, 606, 20, 'Edificio F2'),
    'F_N':       (789, 636, 18, 'Acceso norte Edificio F (Miramar)'),
    'F_ACC':     (800, 658, 17, 'Edificio F / Miramar'),
    'TENIS':     (828, 598, 25, 'Cancha de tenis'),
    'SL_1':      (826, 523, 30, 'Sendero oriente (tramo norte)'),
    'SL_2':      (862, 562, 26, 'Sendero oriente (tramo sur)'),
    'T_ACC':     (957, 640, 18, 'Edificio T / Auditorio'),
    'T_PATH':    (905, 630, 19, 'Sendero al Auditorio T'),
    'AE_F':      (712, 601, 20, 'Paso de la terraza al Edificio F2'),
}

# ---------------------------------------------------------------- aristas
# (a, b, tipo, conf, escalones, nota)
#   tipo: sendero | calle | escalera | rampa | talud | ascensor | salvaescaleras | interior
E = [
    # ---------- Acceso Av. Espana
    ('ESP_AV', 'PORT_ESP', 'sendero', 'alta', 0,
     'Vereda de Av. España hasta la portería. Se acumula gente por el paradero; la tesis la califica como riesgo vehicular exterior.'),
    ('PORT_ESP', 'PLAZA', 'sendero', 'alta', 0,
     'Portería España: puertas estrechas para el flujo que recibe, sin rampa ni señalización (tesis 2018, puntaje 23 "grave").'),
    ('PLAZA', 'ESC_PIE', 'sendero', 'alta', 0,
     'Plaza del Monumento a Don Federico Santa María, pavimento plano.'),
    ('ESC_PIE', 'ESC_CIMA', 'escalera', 'alta', 72,
     'Escalera monumental. Único paso peatonal directo entre la plaza y la terraza del Edificio A. Sin rampa ni plataforma.'),
    ('ESC_CIMA', 'BALCON', 'sendero', 'alta', 0, 'Balcón mirador sobre la escalera.'),
    ('BALCON', 'AE_C', 'sendero', 'alta', 0, 'Paso del balcón a la calle Agustín Edwards.'),
    ('ESC_PIE', 'PERG_E', 'sendero', 'alta', 0, 'Pie de la escalera hacia la pérgola.'),
    ('PERG_E', 'PERG_W', 'sendero', 'media', 0, 'Pérgola: paseo cubierto hacia el poniente, a nivel.'),

    # ---------- Av. Espana al oriente y subida por Av. San Luis
    #  Al oriente de la plaza el plano solo muestra talud (curvas de nivel muy juntas):
    #  desde la Porteria Espana no se puede bordear el cerro, hay que rodear por fuera.
    ('ESP_AV', 'ESP_E1', 'calle', 'alta', 0,
     'Vereda de Av. España hacia el oriente, por fuera del campus.'),
    ('ESP_E1', 'ESP_E2', 'calle', 'alta', 0, 'Vereda de Av. España.'),
    ('ESP_E2', 'SL_ESQ', 'calle', 'alta', 0, 'Vereda de Av. España hasta la esquina de San Luis.'),
    ('SL_ESQ', 'SL_T', 'calle', 'media', 0,
     'Subida por Av. San Luis. Calle de cerro, en pendiente sostenida y sin vereda segregada.'),
    ('SL_T', 'T_ACC', 'escalera', 'media', 12,
     'Acceso al Auditorio desde Av. San Luis. La tesis clasífica el acceso principal del Edificio T como gravísimo: inaccesible para movilidad reducida.'),
    ('SL_T', 'T_PATH', 'sendero', 'media', 0,
     'Entrada al campus por el oriente, desde Av. San Luis al sendero del Auditorio.'),

    # ---------- Calle Agustin Edwards
    ('AE_E', 'AE_C', 'calle', 'alta', 0, 'Calle Agustín Edwards frente al Edificio A.'),
    ('AE_C', 'AE_W', 'calle', 'alta', 0,
     'Calle Agustín Edwards, tramo poniente. Puntaje 25 en la tesis: su tramo III es el más riesgoso.'),
    ('AE_E', 'AE_F', 'sendero', 'media', 0, 'Paso de la terraza hacia el Edificio F2.'),
    ('AE_F', 'F2_ACC', 'sendero', 'media', 0, 'Acceso al Edificio F2.'),

    # ---------- Edificio A
    ('AE_C', 'A_S', 'sendero', 'alta', 3, 'Acceso sur del Edificio A desde Agustín Edwards: tiene peldaños de acceso.'),
    ('A_S', 'A_ASC', 'interior', 'alta', 0, 'Pasíllo interior del Edificio A hasta el ascensor.'),
    ('A_ASC', 'A_N', 'ascensor', 'alta', 0,
     'Ascensor del Edificio A. La tesis lo registra como existente pero NO accesible (cabina/botonera fuera de norma).'),
    ('A_N', 'PC_S', 'sendero', 'alta', 0, 'Acceso norte del Edificio A al Patio Central.'),
    ('A_W', 'AE_W', 'sendero', 'media', 2, 'Acceso poniente del Edificio A.'),
    ('GIM1', 'PC_S', 'sendero', 'media', 4, 'Gimnasío 1 / Sala de estar al Patio Central.'),

    # ---------- Patio Central
    ('PC_S', 'PC_C', 'sendero', 'alta', 0, 'Patio Central, pavimento continuo.'),
    ('PC_C', 'PC_N', 'sendero', 'alta', 0, 'Patio Central, pavimento continuo.'),
    ('PC_N', 'PC_NE', 'sendero', 'alta', 0, 'Patio Central, costado nororiente.'),
    ('PC_N', 'B_S', 'sendero', 'alta', 2, 'Acceso sur del Edificio B desde el Patio Central.'),
    ('PC_C', 'D_W', 'sendero', 'alta', 2, 'Paso del Patio Central al comedor (Edificio D).'),
    ('PC_C', 'U_PATIO', 'sendero', 'media', 0, 'Paso del Patio Central al patio interior de la Biblioteca.'),

    # ---------- Biblioteca (Edificio U)
    ('U_N', 'U_PATIO', 'escalera', 'alta', 14, 'Escalera del patio interior de la Biblioteca.'),
    ('U_PATIO', 'U_ESC', 'sendero', 'media', 0, 'Patio interior de la Biblioteca, tramo sur.'),
    ('U_ESC', 'GIM1', 'escalera', 'media', 8, 'Escalera del patio de la Biblioteca al Gimnasío 1.'),
    ('U_PATIO', 'U_ASC', 'sendero', 'media', 1, 'Acceso al ascensor de la Biblioteca.'),
    ('U_ASC', 'U_ACC', 'ascensor', 'alta', 0,
     'Ascensor de la Biblioteca. Existe, pero la tesis lo clasífica como NO accesible.'),
    ('U_N', 'U_ACC', 'sendero', 'media', 0, 'Acceso principal de la Biblioteca (único de sus 4 accesos considerado principal).'),
    ('U_N', 'B_W', 'sendero', 'media', 0, 'Sendero entre la Biblioteca y el costado poniente del Edificio B.'),
    ('U_ACC', 'PQ_S', 'sendero', 'media', 0, 'Sendero de la Biblioteca al parque.'),

    # ---------- Edificio B
    ('B_W', 'PISCINA', 'interior', 'media', 6, 'Paso interior del Edificio B a la piscina.'),
    ('B_S', 'PISCINA', 'interior', 'media', 8, 'Paso interior del Edificio B a la piscina.'),
    ('B_N', 'PISCINA', 'interior', 'media', 10,
     'Interior del Edificio B. Es el edificio peor evaluado del campus (puntaje 33, ranking 1) y no tiene ascensor.'),
    ('B_N', 'SP_3', 'sendero', 'alta', 3, 'Acceso norte del Edificio B a la calle interior.'),
    ('B_W', 'SP_1', 'sendero', 'media', 0, 'Sendero poniente del Edificio B hacia la calle interior.'),

    # ---------- Rampa en zigzag (nivel B <-> Patio Central)
    ('SP_E', 'TAL_M', 'calle', 'media', 0, 'Enlace de la calle interior con Calle Talleres.'),
    ('TAL_M', 'TAL_S', 'calle', 'media', 0, 'Calle Talleres, tramo sur.'),
    ('TAL_S', 'RB_T', 'sendero', 'media', 0, 'Llegada a la cabecera de la rampa.'),
    ('TAL_S', 'O_N', 'sendero', 'media', 0, 'Acceso a los Edificios O y N.'),
    ('RB_T', 'RB_M', 'rampa', 'media', 0,
     'Rampa en zigzag, primer tramo. Es el único enlace sin peldaños dibujado entre el nivel del Edificio B y el Patio Central.'),
    ('RB_M', 'RB_B', 'rampa', 'media', 0, 'Rampa en zigzag, segundo tramo (vuelta de 180 grados).'),
    ('RB_B', 'PC_NE', 'sendero', 'media', 0, 'Pie de la rampa al Patio Central.'),
    ('RB_B', 'D_N', 'sendero', 'media', 0, 'Pie de la rampa al acceso norte del comedor.'),

    # ---------- Calle interior entre C y B
    ('SP_W', 'SP_1', 'calle', 'alta', 0, 'Calle interior entre el Edificio C y el Edificio B.'),
    ('SP_1', 'SP_2', 'calle', 'alta', 0, 'Calle interior entre el Edificio C y el Edificio B.'),
    ('SP_2', 'SP_3', 'calle', 'alta', 0, 'Calle interior entre el Edificio C y el Edificio B.'),
    ('SP_3', 'SP_E', 'calle', 'alta', 0, 'Calle interior entre el Edificio C y el Edificio B.'),
    ('SP_1', 'C_S1', 'sendero', 'alta', 2, 'Acceso sur poniente del Edificio C.'),
    ('SP_2', 'C_SALVA', 'sendero', 'alta', 0, 'Llegada al salva-escaleras del Edificio C.'),
    ('SP_3', 'C_S2', 'sendero', 'alta', 2, 'Acceso sur oriente del Edificio C.'),

    # ---------- Edificio C
    ('C_SALVA', 'C_INT', 'salvaescaleras', 'alta', 0,
     'Plataforma salva-escaleras del Edificio C. La tesis la registra como existente, pero advierte que requiere ayuda de terceros para operarla.'),
    ('C_S1', 'C_INT', 'escalera', 'media', 12, 'Escalera interior del Edificio C.'),
    ('C_S2', 'C_INT', 'escalera', 'media', 12, 'Escalera interior del Edificio C.'),
    ('C_INT', 'C_N', 'escalera', 'media', 16, 'Escalera interior del Edificio C al nivel norte.'),
    ('C_INT', 'C_E', 'interior', 'media', 4, 'Pasíllo interior del Edificio C al acceso oriente.'),
    ('C_INT', 'C_W', 'interior', 'media', 4, 'Pasíllo interior del Edificio C al acceso poniente.'),
    ('C_N', 'CN_M', 'sendero', 'alta', 2, 'Acceso norte del Edificio C a la vereda de Av. Los Placeres.'),
    ('C_E', 'TAL_K', 'sendero', 'alta', 3, 'Acceso oriente del Edificio C (Calle Talleres).'),
    ('C_W', 'QA_M', 'sendero', 'alta', 3, 'Acceso poniente del Edificio C (Calle Quezada Acharán).'),

    # ---------- Calle Talleres
    ('CN_E', 'TAL_N', 'calle', 'alta', 0, 'Calle Talleres, inicio norte.'),
    ('TAL_N', 'TAL_J', 'calle', 'alta', 0, 'Calle Talleres frente al Edificio J.'),
    ('TAL_J', 'TAL_K', 'calle', 'alta', 0, 'Calle Talleres en bajada hacia el CIAC.'),
    ('TAL_K', 'TAL_M', 'calle', 'alta', 0, 'Calle Talleres en bajada.'),

    # ---------- Calle Quezada Acharan
    ('CN_W', 'QA_N', 'calle', 'alta', 0, 'Calle Quezada Acharán, inicio norte.'),
    ('QA_N', 'QA_M', 'calle', 'alta', 0, 'Calle Quezada Acharán en bajada.'),
    ('QA_M', 'QA_S', 'calle', 'alta', 0, 'Calle Quezada Acharán en bajada.'),
    ('QA_S', 'SP_W', 'calle', 'alta', 0, 'Enlace con la calle interior.'),

    # ---------- Franja norte y Av. Los Placeres
    ('AV_PLA_W', 'AV_PLA', 'calle', 'alta', 0, 'Av. Los Placeres (vereda norte del campus).'),
    ('AV_PLA', 'PORT_PLA', 'sendero', 'alta', 0,
     'Cruce de Av. Los Placeres a la Portería Placeres. La tesis la evalúa con puntaje 23 ("grave"): puertas estrechas, sin rampa, riesgo vehicular.'),
    ('PORT_PLA', 'CN_M', 'sendero', 'alta', 0, 'Vereda norte, hacia el poniente.'),
    ('PORT_PLA', 'CN_E', 'sendero', 'alta', 0, 'Vereda norte, hacia el oriente.'),
    ('CN_M', 'CN_W', 'sendero', 'alta', 0, 'Vereda norte, tramo poniente.'),
    ('AV_PLA_W', 'CN_W', 'sendero', 'media', 1, 'Cruce de Av. Los Placeres por el poniente.'),
    ('AV_PLA', 'PORT_EDP', 'sendero', 'alta', 0,
     'Cruce de Av. Los Placeres al Edificio Placeres. Es el acceso mejor evaluado de los cinco (puntaje 20), pero sin rampa en su entrada principal y con pavimento resbaladizo con lluvia.'),
    ('PORT_EDP', 'P_ACC', 'sendero', 'alta', 2, 'Entrada principal del Edificio P / Federación de Estudiantes.'),
    ('P_ACC', 'P2_ACC', 'sendero', 'media', 0, 'Paso interior del conjunto P hacia el Edificio P2.'),

    # ---------- Parque entre L y el estadio
    ('SP_W', 'PQ_N', 'sendero', 'media', 0, 'Sendero del parque, tramo norte.'),
    ('PQ_N', 'PQ_C', 'escalera', 'media', 30, 'Tramo escalonado del parque, bajada fuerte hacia el estadio.'),
    ('PQ_C', 'PQ_S', 'sendero', 'media', 0, 'Sendero del parque en bajada.'),
    ('PQ_S', 'L_ACC', 'sendero', 'media', 0, 'Acceso al Edificio L.'),
    ('PQ_S', 'EST_E', 'escalera', 'media', 20, 'Escalinata final de bajada al estadio.'),
    ('PQ_C', 'EST_NE', 'talud', 'media', 0,
     'Ladera entre el parque y el estadio. Pendiente fuerte, sin pavimento continuo.'),

    # ---------- Estadio
    ('EST_NE', 'EST_N', 'sendero', 'media', 0, 'Patio de las Palmas, borde norte del estadio.'),
    ('EST_NE', 'EST_E', 'sendero', 'media', 0, 'Borde oriente del estadio.'),
    ('EST_E', 'EST_SE', 'sendero', 'media', 0, 'Borde oriente del estadio.'),
    ('EST_SE', 'EST_S', 'sendero', 'media', 0, 'Borde sur del estadio.'),
    ('EST_SE', 'H_N', 'sendero', 'media', 0, 'Paso del borde sur del estadio al jardín de la Casa del Rector.'),
    ('H_N', 'H_ACC', 'sendero', 'media', 3, 'Acceso a la Casa del Rector (Edificio H). 2 accesos, 1 principal, sin ascensor.'),
    ('EST_N', 'CANCHAS', 'sendero', 'media', 0, 'Canchas 5x5 y 7x7.'),
    ('CANCHAS', 'M2_ACC', 'sendero', 'media', 0, 'Acceso al Gimnasío 2 (Edificio M2).'),
    ('CANCHAS', 'M_S', 'sendero', 'media', 0, 'Paso al extremo sur del Edificio M.'),

    # ---------- Poniente: Valdes, M, M2, R
    ('PORT_VAL', 'VAL_S', 'calle', 'alta', 0,
     'Pasaje Valdés. La Portería Valdés es la peor evaluada del campus (puntaje 36, "gravísimo"): riesgo vehicular, sin señalización, pasadas estrechas y pavimento resbaladizo.'),
    ('VAL_S', 'M_ACC', 'escalera', 'alta', 26,
     'La tesis lo dice textual: la Portería Valdés "está conectada con el edificio M mediante escaleras, sin contar con rampas o elevadores".'),
    ('M_ACC', 'M_S', 'interior', 'media', 20, 'Interior del Edificio M (puntaje 27, segundo peor del campus, sin ascensor).'),
    ('M_S', 'M2_ACC', 'sendero', 'media', 4, 'Paso del Edificio M al Gimnasío 2.'),
    ('PORT_VAL', 'R_ACC', 'sendero', 'media', 0, 'Sendero del Pasaje Valdés al Edificio R.'),
    ('R_ACC', 'R2_ACC', 'sendero', 'media', 3, 'Paso del Edificio R al Sansanito (Edificio R2).'),
    ('R2_ACC', 'RR_PATH', 'sendero', 'media', 0, 'Sendero desde el Sansanito hacia el oriente.'),
    ('RR_PATH', 'QA_M', 'sendero', 'media', 0, 'Enlace con Calle Quezada Acharán.'),
    ('RR_PATH', 'SP_W', 'talud', 'baja', 0, 'Bajada informal hacia la calle interior. Verificar en terreno.'),
    ('M_ACC', 'RR_PATH', 'talud', 'baja', 0, 'Ladera entre el Edificio M y el sendero de R2. Verificar en terreno.'),

    # ---------- Oriente: D, E, F, F2, T
    ('D_W', 'D_N', 'interior', 'media', 6, 'Interior del comedor (Edificio D). 7 accesos, 4 principales, sin ascensor.'),
    ('D_W', 'D_S', 'interior', 'media', 6, 'Interior del comedor hacia su acceso sur.'),
    ('D_S', 'E_ACC', 'sendero', 'alta', 2, 'Paso del comedor al Edificio E.'),
    ('E_ACC', 'E_ASC', 'interior', 'alta', 0, 'Pasíllo interior del Edificio E hasta el ascensor.'),
    ('E_ASC', 'CEIBOS', 'ascensor', 'alta', 0,
     'Ascensor del Edificio E. Existe, pero la tesis lo clasífica como NO accesible.'),
    ('E_ACC', 'CEIBOS', 'escalera', 'media', 10, 'Escalera del Edificio E al Patio de los Ceibos.'),
    ('CEIBOS', 'F2_ACC', 'sendero', 'media', 0, 'Patio de los Ceibos hacia el Edificio F2.'),
    ('CEIBOS', 'TENIS', 'sendero', 'media', 2, 'Patio del Cañón y cancha de tenis.'),
    ('CEIBOS', 'F_N', 'sendero', 'media', 4, 'Bajada al acceso norte del Edificio F.'),
    ('F_N', 'F_ACC', 'sendero', 'alta', 0, 'Edificio F (Miramar): 7 accesos, 3 principales. Es el edificio mejor evaluado del campus.'),
    ('F2_ACC', 'F_N', 'escalera', 'media', 14, 'Escalera entre el Edificio F2 y el Edificio F.'),
    ('D_N', 'SL_1', 'sendero', 'media', 0, 'Sendero oriente, tramo norte.'),
    ('SL_1', 'TENIS', 'sendero', 'media', 0, 'Sendero oriente hacia la cancha de tenis.'),
    ('SL_1', 'SL_2', 'sendero', 'media', 0, 'Sendero oriente en bajada.'),
    ('SL_2', 'T_PATH', 'sendero', 'media', 0, 'Sendero oriente hacia el Auditorio.'),
    ('T_PATH', 'T_ACC', 'escalera', 'media', 12,
     'Acceso al Auditorio desde el sendero del campus. También escalonado.'),
    ('F_ACC', 'T_PATH', 'sendero', 'media', 0, 'Sendero entre el Edificio F y el Auditorio.'),
    ('O_N', 'SL_1', 'talud', 'baja', 0, 'Paso oriente por la ladera. Verificar en terreno.'),
]

# ---------------------------------------------------------------- destinos
# id de nodo -> ficha. puntaje/ranking: tesis 2018 (mayor puntaje = peor accesibilidad)
DEST = [
    ('A_S',      'Edificio A',                      'Aulas y administracion',   {'accesos': 5, 'principales': 3, 'ascensor': 'si-no-accesible', 'puntaje': None, 'nota': 'Junto con el F, el edificio mejor evaluado del campus, aúnque con fallas de diseño.'}),
    ('B_N',      'Edificio B',                      'Aulas y piscina',          {'accesos': 6, 'principales': 4, 'ascensor': 'no', 'puntaje': 33, 'ranking': 1, 'nota': 'El peor evaluado del campus. Sin ascensor.'}),
    ('C_S2',     'Edificio C',                      'Aulas y laboratorios',     {'accesos': 5, 'principales': 3, 'ascensor': 'no', 'puntaje': 18.67, 'ranking': 7, 'nota': 'Sin ascensor, pero tiene la única plataforma salva-escaleras del campus.'}),
    ('D_W',      'Edificio D',                      'Comedor',                  {'accesos': 7, 'principales': 4, 'ascensor': 'no', 'puntaje': 17.3, 'nota': 'El espacio común menos grave según la tesis.'}),
    ('E_ACC',    'Edificio E',                      'Aulas',                    {'accesos': 3, 'principales': 3, 'ascensor': 'si-no-accesible', 'puntaje': None}),
    ('F_ACC',    'Edificio F (Miramar)',            'Aulas',                    {'accesos': 7, 'principales': 3, 'ascensor': 'no', 'nota': 'El más accesible del grupo de edificios.'}),
    ('F2_ACC',   'Edificio F2',                     'Aulas',                    {'accesos': 5, 'principales': 2, 'ascensor': 'no', 'puntaje': 22.5, 'ranking': 5}),
    ('H_ACC',    'Edificio H',                      'Casa del Rector',          {'accesos': 2, 'principales': 1, 'ascensor': 'no', 'puntaje': 25}),
    ('TAL_K',    'Edificio K (CIAC)',               'Centro Integrado de Aprendizaje de Ciencias Básicas', {'accesos': 3, 'principales': 1, 'ascensor': 'no', 'puntaje': 30, 'ranking': 1, 'nota': 'Gravísimo: su acceso principal es inaccesible para movilidad reducida.'}),
    ('L_ACC',    'Edificio L',                      'Servicios',                {}),
    ('M_ACC',    'Edificio M',                      'Aulas y talleres',         {'accesos': 3, 'principales': 2, 'ascensor': 'no', 'puntaje': 27, 'ranking': 3, 'nota': 'Segundo peor del campus. Solo se llega por escaleras desde la Portería Valdés.'}),
    ('M2_ACC',   'Edificio M2',                     'Gimnasío 2 y canchas 5x5 / 7x7', {}),
    ('P_ACC',    'Edificio P',                      'Federación de Estudiantes', {'accesos': 2, 'principales': 2, 'ascensor': 'si-no-accesible', 'puntaje': 18}),
    ('P2_ACC',   'Edificio P2',                     'Oficinas',                 {}),
    ('R_ACC',    'Edificio R',                      'Relaciones Estudiantiles', {'accesos': 4, 'principales': 2, 'ascensor': 'no', 'puntaje': 23}),
    ('R2_ACC',   'Edificio R2',                     'Sansanito',                {'accesos': 1, 'principales': 1, 'ascensor': 'no', 'puntaje': 20}),
    ('T_ACC',    'Edificio T',                      'Auditorio',                {'accesos': 2, 'principales': 1, 'ascensor': 'no', 'puntaje': 30, 'ranking': 1, 'nota': 'Gravísimo: acceso principal inaccesible.'}),
    ('U_ACC',    'Edificio U',                      'Biblioteca',               {'accesos': 4, 'principales': 1, 'ascensor': 'si-no-accesible', 'puntaje': 24, 'nota': 'Aquí está el Punto Accesible de la Biblioteca USM.'}),
    ('PC_C',     'Patio Central',                   'Patio, Gimnasío 1 y Sala de estar', {}),
    ('PISCINA',  'Piscina',                         'Piscina del Edificio B',   {'nota': 'El sector de esparcimiento menos grave, por estar al interior de un edificio.'}),
    ('EST_E',    'Estadio',                         'Estadio, Patio de las Palmas y Patio del Magnolio', {}),
    ('TENIS',    'Cancha de tenis',                 'Patio de los Ceibos, Taca-taca y Patio del Cañón', {}),
    ('U_PATIO',  'Patio interior U',                'Patio de la Biblioteca',   {}),
    ('PLAZA',    'Monumento Don Federico',          'Plaza del monumento',      {}),
    ('PORT_ESP', 'Portería España',                 'Acceso por Av. España',    {'puntaje': 23, 'nota': 'Grave: puertas estrechas, sin rampa ni señalización.'}),
    ('PORT_PLA', 'Portería Placeres',               'Acceso por Av. Los Placeres', {'puntaje': 23, 'nota': 'Grave: puertas estrechas, sin rampa ni señalización.'}),
    ('PORT_VAL', 'Portería Valdés',                 'Acceso por Pasaje Valdés', {'puntaje': 36, 'ranking': 1, 'nota': 'La peor evaluada: gravísimo. Varios escalones y riesgo vehicular.'}),
    ('PORT_EDP', 'Portería Edificio Placeres',      'Acceso por el Edificio P', {'puntaje': 20, 'nota': 'La mejor evaluada, pero sin rampa en su entrada principal.'}),
    ('O_N',      'Edificios O y N',                 'Servicios',                {}),
    ('TAL_J',    'Edificio J',                      'Servicios',                {}),
]

# ---------------------------------------------------------------- polilineas
# Puntos intermedios para que el trazo siga el corredor real del plano en vez de
# cortar en linea recta. Se leyeron sobre la capa de pavimento de campus_red.json.
VIA = {
    ('D_N', 'SL_1'):     [(790, 487), (812, 503)],
    ('SL_1', 'SL_2'):    [(845, 543)],
    ('SL_2', 'T_PATH'):  [(878, 582), (894, 606)],
    ('SL_1', 'TENIS'):   [(812, 546), (820, 574)],
    ('F_ACC', 'T_PATH'): [(838, 665), (872, 668), (898, 652)],
    ('SL_ESQ', 'SL_T'):  [(962, 644), (954, 622)],
    ('ESP_E2', 'SL_ESQ'):[(930, 670)],
    ('SL_T', 'T_PATH'):  [(936, 604), (920, 612)],
    ('RB_T', 'RB_M'):    [(744, 440), (724, 444)],
    ('RB_M', 'RB_B'):    [(722, 462), (746, 468)],
    ('CEIBOS', 'TENIS'): [(788, 589), (808, 588)],
    ('QA_M', 'QA_S'):    [(450, 322)],
    ('TAL_K', 'TAL_M'):  [(747, 356)],
    ('PQ_N', 'PQ_C'):    [(503, 396)],
    ('PQ_C', 'PQ_S'):    [(499, 436)],
    ('EST_NE', 'EST_E'): [(486, 428)],
    ('ESP_AV', 'ESP_E1'):[(680, 696)],
    ('ESP_E1', 'ESP_E2'):[(825, 684)],
    ('PORT_VAL', 'R_ACC'): [(262, 272), (300, 258)],
    ('CANCHAS', 'M_S'):  [(330, 428)],
    ('EST_SE', 'H_N'):   [(483, 556)],
}

# ---------------------------------------------------------------- avenidas
# Calles publicas que bordean el campus. No son parte del grafo salvo donde la
# red las usa: van en el mapa para dar contexto y nombre a lo que se ve.
CALLES_EXT = [
    {'n': 'Avenida España', 'pts': [(0, 704), (160, 713), (360, 711), (540, 702),
                                    (660, 697), (780, 688), (880, 675), (960, 657), (1024, 640)]},
    {'n': 'Avenida San Luis', 'pts': [(740, 232), (757, 288), (774, 338), (794, 394), (814, 444),
                                      (852, 476), (898, 518), (928, 558), (946, 600), (960, 644),
                                      (972, 662)]},
    {'n': 'Avenida Los Placeres', 'pts': [(250, 226), (400, 230), (560, 232), (660, 232), (742, 234)]},
    {'n': 'Pasaje Valdés', 'pts': [(258, 238), (258, 300), (254, 350), (250, 410), (250, 462)]},
    {'n': 'Calle General Bari', 'pts': [(150, 462), (200, 468), (252, 474), (325, 494)]},
]

# Rotulos de espacios abiertos: sin ellos el plano se lee como manchas de color.
LUGARES = [
    {'n': 'Estadio',            'x': 418, 'y': 462},
    {'n': 'Patio de las Palmas','x': 420, 'y': 372},
    {'n': 'Canchas 5x5 y 7x7',  'x': 348, 'y': 441},
    {'n': 'Parque',             'x': 516, 'y': 404},
    {'n': 'Patio Central',      'x': 690, 'y': 498},
    {'n': 'Patio de los Ceibos','x': 768, 'y': 590},
    {'n': 'Cancha de tenis',    'x': 850, 'y': 592},
    {'n': 'Plaza del Monumento','x': 640, 'y': 680},
]

ORIGENES = ['PORT_ESP', 'PORT_PLA', 'PORT_VAL', 'PORT_EDP', 'ESP_AV', 'PC_C', 'U_ACC', 'D_W', 'A_S']


def build():
    src = json.load(open(SRC, encoding='utf-8'))
    nodos = {k: {'x': v[0], 'y': v[1], 'z': v[2], 'n': v[3]} for k, v in N.items()}
    aristas = []
    for a, b, tipo, conf, esc, nota in E:
        assert a in nodos, a
        assert b in nodos, b
        ax, ay, az = nodos[a]['x'], nodos[a]['y'], nodos[a]['z']
        bx, by, bz = nodos[b]['x'], nodos[b]['y'], nodos[b]['z']
        medio = VIA.get((a, b)) or [p for p in reversed(VIA.get((b, a), []))]
        pts = [(ax, ay)] + [tuple(p) for p in medio] + [(bx, by)]
        plano_m = sum(((pts[k][0] - pts[k - 1][0]) ** 2 + (pts[k][1] - pts[k - 1][1]) ** 2) ** 0.5
                      for k in range(1, len(pts))) * M_POR_PX
        dz = abs(az - bz)
        largo = (plano_m ** 2 + dz ** 2) ** 0.5
        pend = (dz / plano_m * 100) if plano_m > 0.5 else 0
        # Las cotas son estimadas: en tramos cortos el cociente se dispara, así que
        # se acota a un maximo creible por tipo. Los medios mecanicos no tienen pendiente.
        if tipo in ('ascensor', 'salvaescaleras'):
            pend = 0.0
        elif tipo == 'rampa':
            pend = min(pend, 12)
        elif tipo in ('escalera', 'talud'):
            pend = min(pend, 45)
        else:
            pend = min(pend, 20)
        arista = {
            'a': a, 'b': b, 'tipo': tipo, 'conf': conf, 'esc': esc,
            'm': round(largo, 1), 'dz': round(az - bz, 1), 'pend': round(pend, 1),
            'nota': nota,
        }
        if medio:
            arista['via'] = [[float(x), float(y)] for x, y in medio]
        aristas.append(arista)

    dest = []
    for nid, nombre, uso, ficha in DEST:
        assert nid in nodos, nid
        d = {'id': nid, 'nombre': nombre, 'uso': uso}
        d.update(ficha)
        dest.append(d)

    edificios = []
    for b in src['buildings']:
        edificios.append({'id': b['id'], 'd': b['d'], 'cx': b['cx'], 'cy': b['cy']})

    return {
        'W': src['W'], 'H': src['H'], 'm_por_px': M_POR_PX,
        'calles': CALLES_EXT,
        'lugares': LUGARES,
        'terreno': {'talud': src['talud'], 'pasto': src['pasto'],
                    'cancha': src['cancha'], 'walk': src['walk']},
        'edificios': edificios,
        'nodos': nodos,
        'aristas': aristas,
        'destinos': sorted(dest, key=lambda d: d['nombre']),
        'origenes': ORIGENES,
    }


if __name__ == '__main__':
    d = build()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'red_usm.json')
    json.dump(d, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('nodos', len(d['nodos']), 'aristas', len(d['aristas']), 'destinos', len(d['destinos']))
    print('escaleras', sum(1 for a in d['aristas'] if a['tipo'] == 'escalera'))
    print('rampas', sum(1 for a in d['aristas'] if a['tipo'] == 'rampa'))
    print(out, os.path.getsize(out))
