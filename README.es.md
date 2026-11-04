<p align="center">
  <img src="assets/banner.png" alt="/handoff: Detente a media tarea. No pierdas nada. Un skill de Claude Code que termina lo que está corriendo, hace commit local y deja un solo archivo en el que la siguiente sesión puede confiar." width="100%">
</p>

<p align="center">
  <a href="#instalación"><img alt="Plugin de Claude Code" src="https://img.shields.io/badge/Claude_Code-plugin-138840?style=flat-square"></a>
  <a href="skills/handoff/SKILL.md"><img alt="Agent Skills: SKILL.md" src="https://img.shields.io/badge/Agent_Skills-SKILL.md-0b100c?style=flat-square"></a>
  <img alt="Cero dependencias" src="https://img.shields.io/badge/dependencias-0-138840?style=flat-square">
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-0b100c?style=flat-square"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>Español</b>
</p>

**`/handoff` es un skill de Claude Code para cuando una sesión tiene que terminar a media tarea.** Deja que termine lo que ya estaba corriendo, hace commit local y escribe un solo `HANDOFF.md` desde el que una sesión sin contexto puede retomar sin adivinar. Y luego se detiene. Funciona en cualquier agente que lea `SKILL.md`.

Sin él, llegar al límite de uso a media tarea significa que la sesión de mañana empieza desde cero: vuelve a leer el código, vuelve a correr las pruebas y vuelve a intentar lo que ayer ya falló.

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

<p align="center">
  <img src="assets/demo.svg" alt="Demo en terminal: /handoff espera una revisión en curso, revisa el estado del repo, hace un commit WIP local, escribe y verifica HANDOFF.md. A la mañana siguiente una sesión nueva encuentra el handoff, revisa git, lee lo que falló y hace la primera pregunta." width="100%">
</p>

<sub>El skill y el demo están en inglés; el handoff se escribe en el idioma en que le hablas.</sub>

## Qué pasa cuando lo corres

Escribe `/handoff`, o di *«cierra la sesión»*, *«vamos a parar»* o *«ya me quedé sin uso»*.

| Fase | Qué hace | Qué se niega a hacer |
|---|---|---|
| **0. Congela** | Te dice en una línea qué sigue corriendo y cuánto le falta. Deja que esa unidad termine: una revisión de código entrega sus hallazgos, un workflow sus cambios, una suite de pruebas sus números. | Arrancar el siguiente bug, otra vuelta de revisión o «un arreglo rápido». |
| **1. Evidencia** | Lee el estado real: rama, HEAD, archivos modificados, commits sin push, secretos en cambios y commits, últimos resultados de pruebas. | Confiar en lo que recuerda de la conversación. |
| **2. Commit** | Hace commit, por nombre, de los archivos que editó en esta sesión, en cada repo que tocó. Pruebas en rojo = un commit `WIP:` honesto. | Deploy. Push, salvo que lo pidas en ese turno. Tocar archivos que no editó. Agregar un `.env`. |
| **3. Escribe** | Escribe `HANDOFF.md` con cinco secciones y le corre un verificador. | Entregarte un archivo con secciones vacías, huecos `{{plantilla}}` o marcadores como `<repo>`. |
| **4. Para** | Te dice dónde quedó el archivo, qué tienes que decidir y la frase exacta para retomar. | Seguir trabajando después de ese mensaje. |

## Las cinco secciones

Todos los handoffs tienen la misma forma, escritos en tu idioma:

| # | Sección | Responde |
|---|---|---|
| 1 | **Objetivo** | Lo que pediste, citado, y las reglas que pusiste (sin push, sin deploy, tope de vueltas de revisión). |
| 2 | **En qué estado terminó todo** | Por repo: rama, HEAD, limpio o no, con push o no. Pruebas con números. Qué se verificó y qué solo afirmó un agente. |
| 3 | **Qué cambió** | Archivo por archivo, con su commit. Lo que se dejó sin tocar a propósito. |
| 4 | **Qué intentamos y falló** | Cada callejón sin salida con su causa real y *qué hacer en su lugar*. |
| 5 | **Pasos siguientes exactos** | Numerados, con comandos completos y rutas absolutas. Tus decisiones pendientes primero, como A/B. |

La sección 4 es la razón de ser de este skill. Anota cada callejón sin salida con su causa para que la siguiente sesión no lo repita. Del [handoff de ejemplo](skills/handoff/references/example-handoff.md):

> **False premise about the function timeout.** Took "10 s per request" from an old forum answer, so I cut the provider call timeout to 8 s → legitimate slow charges got retried → that caused F2. The official platform docs say 60 s. **Instead:** read the official limits page before designing around a limit.

(En español: una premisa falsa sobre el tiempo límite de la plataforma, sacada de un foro, causó un bug; la documentación oficial decía otra cosa. En su lugar: leer la documentación oficial antes de diseñar alrededor de un límite.)

## Retoma donde te quedaste

Abre una sesión en la misma carpeta y di:

```
continue from HANDOFF.md
```

(o *«continúa con HANDOFF.md»*). El agente primero compara el archivo con la realidad (¿el HEAD sigue igual que en la sección 2? ¿el árbol está limpio?), lee la sección 4 antes de tocar código, te hace las preguntas A/B pendientes y empieza por el paso 1. Con el plugin instalado, una sesión nueva te avisa que hay un handoff esperando antes de que lo pidas:

```
Handoff waiting: ledgerline: idempotent payment webhook (STOPPED AT USAGE LIMIT, 9 h ago). To pick it up, say: continue from HANDOFF.md
```

**¿Cambias de computadora?** Guarda los handoffs en una carpeta que se sincronice (ver [Configuración](#configuración)) y di *«/handoff y haz push»*: sube la rama actual después de revisar secretos, nunca con `--force`, y pregunta antes si es la rama principal.

## Instalación

**Plugin de Claude Code** (incluye el aviso al iniciar sesión):

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

**Cualquier agente que lea `SKILL.md`** (Claude Code, Codex, Cursor, Gemini CLI y otros), con el [CLI de skills](https://skills.sh):

```
npx skills add asalazarvaldiviaocg/handoff
```

**A mano:** copia una carpeta.

```bash
git clone https://github.com/asalazarvaldiviaocg/handoff
mkdir -p ~/.claude/skills && cp -r handoff/skills/handoff ~/.claude/skills/
```

```powershell
# Windows PowerShell
git clone https://github.com/asalazarvaldiviaocg/handoff
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse handoff\skills\handoff "$HOME\.claude\skills\"
```

Los scripts de apoyo, la búsqueda de secretos y el aviso al iniciar sesión necesitan **Node 18+** en tu PATH. Sin Node, el skill usa comandos de `git` normales y te avisa que se saltaron la búsqueda de secretos y el verificador.

## ¿Por qué no solo `/compact` o `claude --resume`?

Resuelven otros problemas. Úsalos también.

| | `/compact` | `claude --resume` | `/handoff` |
|---|---|---|---|
| Lo puede retomar un compañero u otro agente | No | No, es tu transcript | **Sí, es un archivo normal: compártelo o guarda los handoffs en una carpeta sincronizada** |
| Lo puede retomar otra computadora | No | Solo si copias el transcript | **Con una carpeta sincronizada y `/handoff y haz push`** |
| Espera revisiones, workflows y pruebas en curso | No | No | **Sí** |
| Deja tu trabajo en un commit | No | No | **Sí, local** |
| Guarda aparte lo que falló | A veces, dentro de un resumen | Enterrado en el transcript | **Sección 4** |
| Costo de retomar al día siguiente | n/a | Recarga toda la conversación | **Lee un archivo de unos cuantos KB** |
| Se revisa que no tenga huecos antes de usarlo | No | No | **Verificador** |

**Otros skills de handoff** casi siempre escriben un archivo de resumen. Este además espera el trabajo en curso, hace commit WIP por repo, no toca archivos de otros, verifica su propio resultado y se anuncia a la siguiente sesión. No se dispara solo al llegar a cierto porcentaje de uso; si quieres eso, haz que tu barra de estado o un hook le diga al agente que corra `/handoff` alrededor del 90 %.

## Lo que nunca hace

- **Deploy.** Nunca. En su lugar deja en la sección 5 el comando exacto y el rollback.
- **Push sin que lo pidas.** Solo *«/handoff y haz push»* (o tu OK en ese turno), y un secreto en un commit sin push lo bloquea.
- **Tocar archivos que no editó.** Hace commit de sus archivos por nombre, nunca `git add -A`. Cualquier otro archivo modificado se anota y no se toca; los que no cambiaron desde que empezó la sesión se marcan como probablemente de alguien más.
- **Dejar pasar un secreto en silencio.** Revisa los cambios, los archivos nuevos y cada commit que todavía no está en el remoto (uno por uno, así que una llave que se agregó y luego se borró igual cuenta) antes del commit, avisa de archivos `.env` que no están en `.gitignore` y revisa `HANDOFF.md` antes de entregártelo.
- **Meter `HANDOFF.md` en tu historial.** Va a `.git/info/exclude`, que es local y no cambia ningún archivo versionado.

## Configuración

**Dónde queda el handoff.** Por defecto, `HANDOFF.md` en la raíz del repo en el que trabajabas. Para guardarlos en algo que se sincronice entre computadoras (una bóveda de Obsidian, una carpeta compartida), agrega una línea a tu `CLAUDE.md` o `AGENTS.md`:

```
Handoffs go to: /Users/tu-usuario/notas/handoffs/HANDOFF.md
```

Para que el aviso al iniciar sesión también busque ahí, define `HANDOFF_PATH` con esa ruta absoluta, en el perfil de tu terminal o en el bloque `env` de `~/.claude/settings.json`.

**Apagar el aviso.** Define `HANDOFF_NOTICE=off` de la misma forma.

## Qué trae

```
skills/handoff/
├── SKILL.md                         el procedimiento que sigue el agente
├── references/
│   ├── stopping-boundary.md         qué hacer con cada tipo de trabajo en curso
│   ├── handoff-template.md          la plantilla de 5 secciones
│   └── example-handoff.md           un handoff realista ya lleno
└── scripts/
    ├── repo-state.mjs               rama, HEAD, archivos modificados, commits sin push, secretos
    └── check-handoff.mjs            el verificador del handoff (--minimal para la versión corta)
hooks/session-start.mjs              aviso «Handoff waiting» al iniciar sesión
tests/run.mjs                        54 pruebas de regresión (node tests/run.mjs)
```

## Preguntas frecuentes

**¿Funciona fuera de Claude Code?** El skill es un `SKILL.md` estándar, así que cualquier agente compatible con Agent Skills lo puede correr. El aviso al iniciar sesión es un hook de Claude Code; en otros agentes solo di «continue from HANDOFF.md».

**¿Va a meter `HANDOFF.md` en mi repo?** No. Queda excluido de forma local. Si *quieres* versionarlo, dilo en tu `CLAUDE.md`.

**¿Y si algo sigue corriendo cuando lo llamo?** Espera a que termine esa unidad y no arranca nada nuevo. Di *«para ya»* y no espera nada: detiene todo y anota qué quedó interrumpido.

**Voy en 99 % de uso. ¿Alcanza?** Modo mínimo: primero el commit local y luego guarda y verifica (`--minimal`) un handoff de 20 a 40 líneas con el objetivo, los HEAD y tres pasos siguientes. Las secciones 3 y 4 vienen después, si queda presupuesto.

**¿Cuántos tokens gasta?** Cargar el skill son unos 5.5k tokens. Los tres archivos de referencia que lee en el camino suman unos 4.4k. Además: unos cuantos comandos de `git`, la corrida de pruebas si es rápida y escribir el handoff, normalmente unos pocos miles de tokens. El modo mínimo se salta casi todo.

## De dónde salió

Empezó como un skill privado para un entorno que corta sesiones todo el tiempo: dos computadoras, una bóveda de notas compartida y límites de uso que llegan a media tarea. Casi todas las reglas salieron de algo que falló:

- **«Espera la revisión en curso»**: una revisión de código con varios agentes se cortó cuando solo le faltaba el reporte final.
- **«Lee la documentación oficial antes de diseñar alrededor de un límite»** (justo lo que va en la sección 4): un tiempo límite de diez segundos sacado de una respuesta de foro causó cuatro bugs. El límite real era de sesenta.
- **«Escribe el handoff con la herramienta de archivos, no con un heredoc»**: veinte kilobytes de markdown con comillas y barras invertidas rompieron el heredoc dos veces.
- **«Avisa antes de usar la primera herramienta»**: en las pruebas, el agente se saltaba la única línea que el usuario necesita oír, hasta que la instrucción pasó a la descripción del skill.

En mi propia prueba lado a lado con dos escenarios de cierre, el mismo modelo con la versión original del skill cumplió los 69 puntos de la rúbrica; sin el skill, 55. No guardé ese arnés de pruebas, así que tómalo como una anécdota, no como un benchmark. Antes de publicarla, la versión pública se corrió de punta a punta en repos desechables, dos veces, y sus scripts pasan las 54 pruebas de regresión de [`tests/`](tests/run.mjs), cada una construida con un bug que esas corridas encontraron.

## Contribuir

Los issues y pull requests son bienvenidos, sobre todo filas nuevas para la [tabla de qué hacer con lo que sigue corriendo](skills/handoff/references/stopping-boundary.md) de entornos que todavía no conoce. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

¿Tienes una sección 4 que te ahorró una tarde? Compártela en [Discussions](https://github.com/asalazarvaldiviaocg/handoff/discussions), sin los secretos.

---

<p align="center">
  Si <code>/handoff</code> te salvó una sesión, una ⭐ ayuda a que la siguiente persona lo encuentre.<br>
  <sub>Licencia MIT. Hecho con Claude Code.</sub>
</p>
