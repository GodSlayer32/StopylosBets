# -*- coding: utf-8 -*-
"""
Genera mapa-usm-accesible.html.

    python mapeo/construir.py

Pasos:
  1. red_usm.py  -> red_usm.json   (nodos, aristas, destinos + terreno de campus_red.json)
  2. red_usm.json + plantilla_usm.html -> ../../mapa-usm-accesible.html

Para corregir el mapa se edita red_usm.py (las tablas N, E y DEST) y se vuelve a correr
esto. La plantilla solo tiene la interfaz y el ruteo; los datos del campus van en red_usm.py.
"""
import io, json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, 'mapa-usm-accesible.html')

sys.path.insert(0, AQUI)
import red_usm

datos = red_usm.build()
io.open(os.path.join(AQUI, 'red_usm.json'), 'w', encoding='utf-8').write(
    json.dumps(datos, ensure_ascii=False, separators=(',', ':')))

plantilla = io.open(os.path.join(AQUI, 'plantilla_usm.html'), encoding='utf-8').read()
assert '__DATOS__' in plantilla, 'la plantilla perdio el marcador __DATOS__'
html = plantilla.replace('__DATOS__', json.dumps(datos, ensure_ascii=False, separators=(',', ':')))
io.open(SALIDA, 'w', encoding='utf-8').write(html)

esc = sum(1 for a in datos['aristas'] if a['tipo'] == 'escalera')
ram = sum(1 for a in datos['aristas'] if a['tipo'] == 'rampa')
print('%d nodos, %d tramos (%d escaleras, %d rampas), %d destinos'
      % (len(datos['nodos']), len(datos['aristas']), esc, ram, len(datos['destinos'])))
print(SALIDA, '%.0f KB' % (len(html) / 1024))
