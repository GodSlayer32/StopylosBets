# Setup del equipo (MVP móvil)

## 1. Una persona crea el proyecto (5 min)
```bash
npx create-expo-app@latest mi-app
cd mi-app
# copiar aquí CLAUDE.md, EQUIPO.md, .gitignore y la carpeta .claude/ del kit (reemplazar si ya existen)
git init && git add . && git commit -m "init" && git push   # repo privado, invitar a los otros 2
```

## 2. Cada uno
```bash
git clone <repo> && cd mi-app && npm install
claude          # /login con su Pro
```
Dentro de Claude Code (si no se instalaron solos al confiar en la carpeta):
```
/plugin install expo@claude-plugins-official
/plugin install frontend-design@claude-plugins-official
```
Verificar: `/model` → Opus · `/agents` → dev, Explore, checker.
Instalar **Expo Go** en el teléfono y probar con `npx expo start`.

## 3. Primeros 30 min (los 3 juntos, sin código)
1. Problema → usuario → **un** flujo principal (máx. 3-4 pantallas).
2. `/council-lite` si dudan entre ideas.
3. Uno define la dirección visual y crea `constants/theme.ts` (colores, fuentes, espaciado). Todo lo demás depende de esto: va primero.

## 4. Reparto
- **A:** theme + componentes base (Button, Card, Input, EmptyState) + pantalla principal.
- **B:** resto de pantallas del flujo + navegación.
- **C:** datos demo realistas, lógica, y desde la mitad del día: pitch, slides y grabar video de respaldo de la demo.
- Cada uno en su archivo/pantalla. `git pull --rebase` antes de cada push. Commits chicos y seguidos.

## 5. Horarios (8 h)
- Hora 0-0:30 idea y flujo · 0:30-1 theme + esqueleto navegable.
- Hora 4: el flujo completo funciona de punta a punta (feo está bien).
- Hora 4-6:30 pulido UI/UX (`ux-review` en cada pantalla).
- Última hora y media: **congelar features**, solo bugs, ensayar demo 2 veces.
