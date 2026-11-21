# Skills de UI/UX instaladas

Skills de terceros copiadas sin modificar (salvo quitar tests) para guiar a Claude Code en diseño, UX y accesibilidad. Todas con licencia MIT.

| Skill | Enfoque | Fuente |
|-------|---------|--------|
| `frontend-design` | Interfaces distintivas con estética audaz | [anthropics/skills](https://github.com/anthropics/skills) |
| `web-design-guidelines` | Auditoría de interfaces (accesibilidad, UX) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| `react-best-practices` | Rendimiento de React | vercel-labs/agent-skills |
| `composition-patterns` | Arquitectura de componentes React | vercel-labs/agent-skills |
| `react-native-skills` | Rendimiento móvil, animaciones, navegación | vercel-labs/agent-skills |
| `ui-ux-pro-max` | Estilos, paletas y stacks de diseño | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |
| `bencium-controlled-ux-designer`, `bencium-innovative-ux-designer` | UX integral, accesibilidad, responsive, motion | [bencium/bencium-claude-code-design-skill](https://github.com/bencium/bencium-claude-code-design-skill) |
| `accessibility-audit`, `-scan`, `-inspect`, `-fix`, `-diff` (+ `shared/`) | Auditorías WCAG | [accesslint/claude-marketplace](https://github.com/accesslint/claude-marketplace) |

## Notas para este proyecto (Expo / React Native)

- Las más aplicables a la app son `react-native-skills`, `ui-ux-pro-max`, los dos `bencium-*` y `frontend-design`.
- `web-design-guidelines`, `react-best-practices` y las de AccessLint están pensadas para web. Úsense como criterios (WCAG, contraste, jerarquía); sus reglas de DOM/CSS/Next.js no aplican directo.
- Las skills de AccessLint esperan un servidor MCP de AccessLint que no está instalado; sus partes automáticas no funcionarán, pero la metodología WCAG sí sirve.
- Siempre respetar `CLAUDE.md`: todo lo visual sale de `src/constants/theme.ts`.
