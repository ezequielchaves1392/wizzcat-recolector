# AGENTS.md — Cyber-Forge

Juego incremental web en español. Vite + TypeScript + Tailwind 3 + Firebase
(Auth + Firestore), sin framework de UI y sin librería de tests.

---

## ⛔ PROTOCOLO DE SESIÓN — LEE ESTO ANTES DE TOCAR NADA

Este proyecto tiene el working tree con un **lote grande sin commitear** y ha
habido **más de un agente editando el mismo directorio a la vez**. Leer el código
sin estos tres ficheros primero es la forma más rápida de romper algo y no
enterarte.

### 1. Lee los ficheros de `docs/`

| Fichero | Qué te dice |
|---|---|
| [`docs/CONTEXTO-JUEGO.md`](./docs/CONTEXTO-JUEGO.md) | Qué es el juego, los 7 sistemas, cómo se guarda, **las discrepancias conocidas** y lo que **no** está verificado. |
| [`docs/REGLAS-Y-TECNOLOGIAS.md`](./docs/REGLAS-Y-TECNOLOGIAS.md) | Stack, entry points, la suite `verify/`, y las **31 reglas** del proyecto (R1-R31). Esta es la que manda. |
| [`docs/CAMBIOS-MACRO.md`](./docs/CAMBIOS-MACRO.md) | Por qué el juego es como es, fase por fase, y el estado real del repositorio. |
| [`docs/PENDIENTES.md`](./docs/PENDIENTES.md) | **Lo que el jugador quiere añadir**, con el plan de trabajo y el orden. Si dice *"sigamos con tareas pendientes"*, se lee este fichero entero. |

### Comandos que aceleran lo de siempre

Hay cuatro comandos de proyecto en `.opencode/commands/`. Cada uno trae dentro el
procedimiento completo, así que no hace falta acordarlo otra vez:

| Comando | Qué hace |
|---|---|
| `/idea <lo que sea>` | Apunta una idea nueva en la lista, ya clasificada. Guarda tus palabras textuales. |
| `/plan` | **Lista los pendientes y para. El jugador elige.** No hace trabajo. Separa lo bloqueado por una decisión suya de lo que se puede empezar ya, con qué desbloquea cada cosa y qué lo bloquea. |
| `/feature` | Una feature del apartado **Features**, con las reglas de R2 y R3 dentro. |
| `/bug` | Un bug del apartado **Bugs**: reproducir antes de arreglar, causa raíz en el mensaje. |

Si aun así pide trabajar a pelo, el fichero manda igual: `PENDIENTES.md` es la
fuente y estos comandos solo la leen mejor.

Si vas a tocar el almacén, también [`docs/huecos-almacen.md`](./docs/huecos-almacen.md).

**Y una cuarta cosa que no es un documento:** el jugador puede pedir features por
otro lado. Cuando eso pase, la idea se escribe en `PENDIENTES.md` antes de
tocarla, para que no viva solo en una conversación.

### 2. `git status` y `git diff` antes de investigar

El working tree es la referencia, **no el último commit**. Rama `main`.

**Estado a 2 de octubre de 2026:** `v1.1.0` está **taggeado en GitHub**, y después hay
un lote grande de trabajo ya commitado: la forja infinita sin techo (`d5daee3`), el tope de
almacén y expansores por tipo (`3b9048a`), el lote de compras, identidad y cajas de lote
de `35acadb` a `0f0968a`, y la reescritura de `docs/PENDIENTES.md` en versión corta. Es la
fase 11 de `docs/CAMBIOS-MACRO.md`: el contenido inalcanzable (llaves, cristales, Espectro
Azulado), el AFK automático, el cartel de logro, la valoración a la vista y el
rebalanceo de la fase 10. La lista de lo implementado está en el apartado **Hecho** de
`docs/PENDIENTES.md`.

**Y una corrección que hace tiempo que estaba mal: el juego NO está en GitHub Pages.**
El tag existe, pero Pages no está activado en el repo y `.github/workflows/publicar.yml`
falla en `configure-pages` en todos los pushes. **No se quiere publicar en Pages**, así que
lo pendiente es borrar ese workflow, no activar nada.

Aun así, **comprueba `git status` antes de dar por buena cualquier afirmación
sobre el estado del repo**: el árbol puede ir por delante del último commit, y
fue justo lo que pasó dos veces (la fase 8 sin commitear, y `8ae5b91`, que
escribió las reglas del `.gitignore` sin ejecutar el `git rm --cached` que las
hace cumplir). Si hay algo sin commitear, manda el working tree.

Y una trampa de este repo, ya pagada dos veces: **una regla del `.gitignore` no
des-rastrea nada**. Si un fichero ya está en el índice, hay que quitarlo con
`git rm --cached` explícitamente, y `git check-ignore` sobre un fichero
rastreado sale con código 1 y parece que la regla no existe.

### 3. Comprueba si hay otro agente trabajando

Ficheros modificados en los últimos minutos:

```bash
Get-ChildItem src/**/*.ts, verify/*.ts | Sort-Object LastWriteTime -Descending | Select-Object -First 5 LastWriteTime, Name
```

Si algo se está tocando ahora mismo, **no lo edites**: dilo primero. `docs/huecos-almacen.md`
se escribió íntegramente para advertir de esta situación.

### 4. Línea base antes de cambiar nada

```bash
npm run build     # tsc && vite build
npm run verify    # 30 bancos = 1825 pruebas (el total varía: algunas pruebas son condicionales)
```

Un banco que no imprime no es un banco que pasa: `run.mjs` envuelve cada uno en
un `try/catch` que lo dice, y el banco exporta `main()` ya invocada.

---

## Las 10 reglas que más se rompen

El resto está en `docs/REGLAS-Y-TECNOLOGIAS.md`.

1. **La vista NUNCA muta el estado.** Todo pasa por la API de `createGameLoop()`.
2. **Una sola fuente de verdad por regla.** Las reglas compartidas viven en `src/data/`.
3. **Muestra el mismo número que cobras.** El precio sale del game loop, nunca de una copia en la vista.
4. **Nunca lances al usuario.** Devuelve `{ ok, msg }`. `try/catch` registra y sigue.
5. **Los listeners van sobre el nodo que `mountInto()` recrea**, nunca sobre `#app`. Si van en `#app`, se acumulan y una acción se ejecuta N veces.
6. **El estado que sobrevive a un render es de módulo** (`const ui = {...}`), no de función.
7. **`data-*` lleva la semántica; las clases llevan el aspecto.** Nada de `className.includes(...)` para decidir lógica.
8. **Coacciona al cargar, nunca confíes en el save.** `?? default`, `Array.isArray`, inferencia por nombre, `saveVersion` para lo irreversible.
9. **Cada comprobación acaba en `reload()`.** Lo que solo vive en memoria es un bug.
10. **Nada de ingreso pasivo si el jugador no está mirando la pantalla.** Y el tiempo ausente se mide con `performance.now()`, acotado por tres cosas.

---

## Comandos

```bash
npm run dev       # servidor de desarrollo
npm run build     # tsc && vite build — el type-check es puerta de entrada
npm run verify    # banco de pruebas propio: 30 bancos sobre el game loop real
```

Para un banco suelto:

```bash
$env:ONE_BANK="gapCheck"; npx vite build --config verify/vite.one.config.ts
node verify/one.mjs gapCheck
```

Para lo que `verify/` **no** cubre (render, navegación, arrastre real):

| Banco | URL |
|---|---|
| Cualquier pantalla con datos de ejemplo, viewport real | `preview.html?vista=almacen&w=390&h=844` |
| La pantalla de acceso | `auth-preview.html` |
| Recorrido automático de navegación | `nav-test.html` |
| Arrastre con DOM real | `drag-test.html?caso=<n>` |
| La ruleta aislada | `ruleta-preview.html` |

---

## Mapa rápido

```
src/gameLoop.ts      EL MOTOR. Estado, tick, Firestore, migraciones. ~2900 líneas.
src/data/*           LAS REGLAS DEL JUEGO en datos puros.
src/components/*     Pantallas. warehouse.ts es el grande.
src/ui/*             Cromo y páginas.
src/services/*       Backend. naniteQueue.ts es la pieza más cuidadosa.
src/utils/toast.ts   La pila de avisos. ÚNICA de utils/* con banco.
verify/*             Banco de pruebas propio. NO está en tsconfig.json.
docs/*               Este directorio.
```

`src/types.ts`, `src/state.ts` y `src/components/upgrades.ts` son **vestigiales**:
no los importa nadie y sus valores contradicen los reales. No los uses como
referencia. (`src/components/crates.ts` era el cuarto y **se ha borrado** con
F31: llevaba muerto desde hacía tiempo y leía `state.crates.common`, que con
diez niveles de caja habría mostrado `undefined` en cuatro tarjetas.)

---

## Estilo de los commits

Imperativo y con alcance declarado: `fix: las cajas se consumen de verdad, inventario libre y cristales por nivel`.

Cuerpo en listas agrupadas por tema, explicando **el porqué** y **la causa raíz**
del bug, no su síntoma. Y cerrando con lo que se comprobó y cómo
("0px de overflow en las 7 páginas a 390×844 y a 1440×900").

---

## Al terminar

`npm run build` + `npm run verify`. Y si el cambio toca la economía o el
guardado: **una prueba nueva en el banco que corresponda**. Si queda algo sin
resolver, una entrada en la lista de discrepancias de `docs/CONTEXTO-JUEGO.md`.

Y **actualiza `docs/PENDIENTES.md`**: lo que se hizo se marca `[x]`, lo que se
descartó se marca `[-]` con el motivo en una línea, y **lo que se descubriera
haciendo otra cosa se añade al final**. Ese último punto es el que más se olvida
y el que más caro sale: una idea que solo existe en un commit nadie la vuelve a
encontrar.
