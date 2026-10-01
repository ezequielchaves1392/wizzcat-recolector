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
| [`docs/PENDIENTES.md`](./docs/PENDIENTES.md) | **Lo que el jugador quiere añadir.** Si dice *"sigamos con tareas pendientes"*, se lee este fichero entero. |

Si vas a tocar el almacén, también [`docs/huecos-almacen.md`](./docs/huecos-almacen.md).

**Y una cuarta cosa que no es un documento:** el jugador puede pedir features por
otro lado. Cuando eso pase, la idea se escribe en `PENDIENTES.md` antes de
tocarla, para que no viva solo en una conversación.

### 2. `git status` y `git diff` antes de investigar

El working tree es la referencia, **no el último commit**. Rama `main`. El último
lote —la ruleta del sintonizador, la refactorización de la ruleta de cajas en tres
ficheros y la retirada del botón de huecos del almacén— entró en `ce3a346` y está
descrito como fase 8 de `docs/CAMBIOS-MACRO.md`.

Aun así, **comprueba `git status` antes de dar por buena cualquier afirmación
sobre el estado del repo**: el árbol puede ir por delante del último commit, y
fue justo lo que pasó durante la fase 8. Si hay algo sin commitear, manda el
working tree.

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
npm run verify    # 16 bancos = 1123 pruebas (el total varía ±1: una prueba es condicional)
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
npm run verify    # banco de pruebas propio: 16 bancos sobre el game loop real
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

`src/types.ts`, `src/state.ts`, `src/components/crates.ts` y
`src/components/upgrades.ts` son **vestigiales**: no los imports nadie y sus
valores contradicen los reales. No los uses como referencia.

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
