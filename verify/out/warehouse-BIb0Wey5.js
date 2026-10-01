import { S as RARITY_RANK, a as isStackable, r as MAX_STACK } from "./gameLoop-DA2943Xb.js";
import "./tuningRoulette-BK0PqpT9.js";
//#region src/components/warehouse.ts
/**
* Las celdas de la rejilla para un filtro y un orden concretos.
*
* Es `visibleStacks` sin el estado de pantalla. La versión que leía `ui.filter` y
* `ui.sort` no se podía comprobar sin montar la pantalla entera, y el agrupado de
* pilas es justo lo que hay que verificar: de él dependen a la vez lo que se pinta
* y los índices que el arrastre usa como destino, así que un error ahí mueve el
* item a un sitio distinto del que el jugador señaló.
*/
function visibleStacksFor(game, state, filtro, sort) {
	let items = (state.warehouse || []).filter((w) => matchesFilter(w, filtro));
	if (sort === "name") items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
	else if (sort === "rarity") items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
	else if (sort === "tier") items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
	else if (sort === "value") {
		const precio = (w) => game.getSellPrice?.(w.id) ?? w.sellPrice ?? 0;
		items = [...items].sort((a, b) => precio(b) - precio(a));
	}
	const grupos = [];
	const celdaDe = /* @__PURE__ */ new Map();
	for (const w of items) {
		if (isStackable(w)) {
			const clave = `${w.type}_${w.name}`;
			const tope = MAX_STACK[w.type] ?? 20;
			const previa = celdaDe.get(clave);
			if (previa !== void 0) {
				grupos[previa].ids.push(w.id);
				grupos[previa].count = Math.min(grupos[previa].count + (w.stackCount || 1), tope);
				continue;
			}
			celdaDe.set(clave, grupos.length);
			grupos.push({
				item: w,
				ids: [w.id],
				count: Math.min(w.stackCount || 1, tope)
			});
			continue;
		}
		grupos.push({
			item: w,
			ids: [w.id],
			count: 0
		});
	}
	return grupos;
}
/**
* Cuántas celdas tiene el tablero.
*
* El jugador ve estas celdas y puede soltar en CUALQUIERA, ocupada o no. Es un
* tablero de verdad, no una lista: por eso una celda vacía es un sitio libre
* válido y no un adorno. El mínimo de 12 es para que una mochila recién estrenada
* no salga con tres celdas y un resto de sitio invisible, y el múltiplo de tres
* es para que las filas cierren en la rejilla.
*
* Vive en una función y no en línea porque el arrastre necesita el MISMO número.
* Si el pintado y el destino calcularan distinto, un item podría acabar
* empujado fuera de la rejilla y desaparecer de la vista sin que se hubiera
* vendido: lo peor que puede pasarle a un inventario.
*/
function totalCeldasPintadas(celdas, capacity) {
	return Math.max(celdas, Math.min(capacity, Math.max(12, Math.ceil(capacity / 3) * 3)));
}
/**
* Solta el grupo de `draggedId` dentro del hueco que precede a `gapBeforeId`.
*
* Es un INTERCAMBIO, no una inserción: el item entra en el hueco y el hueco se
* queda donde estaba el item. Es lo que hace que arrastrar a un hueco tenga
* sentido —si solo rellenara el hueco, el item desapareciería de donde estaba y
* el almacén se compactaría hacia arriba, que es justo lo contrario de lo que se
* acaba de pedir— y es la razón de que el número de huecos no cambie al
* arrastrar.
*
* Se deja justo delante de su ancla, asi que si el grupo ya estaba ahi no hay
* movimiento posible: el gesto no significa nada y se rechaza con un motivo,
* para que el jugador no se quede pensando que el arrastre se ha roto.
*/
function moveIntoGap(game, draggedId, gapBeforeId, filtro, sort) {
	const state = game.getState();
	const celdas = visibleStacksFor(game, state, filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const grupo = celdas[origen];
	if (grupo.ids.includes(gapBeforeId)) return false;
	if (celdas.findIndex((c) => c.ids.includes(gapBeforeId)) === origen + 1) return false;
	if (!game.moveItems(grupo.ids, gapBeforeId, "antes")) return false;
	const siguiente = celdas[origen + 1];
	const huecos = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []).filter((id) => id !== gapBeforeId);
	if (siguiente) huecos.push(siguiente.item.id);
	game.setWarehouseGaps?.(huecos);
	return true;
}
/**
* Suelta el grupo de `draggedId` en la celda VACIA `dstPainted`, que es la
* posicion PINTADA que el jugador senalo -con los huecos ya intercalados, no el
* indice de celda.
*
* LA REGLA, tal y como la entiende el jugador: **mientras queden celdas vacias,
* cualquier objeto se puede mover a cualquiera de ellas.** Tambien el ultimo, que
* es el caso que antes se rechazaba con "no hay mas sitio libre detras": hay
* sitio, lo que no habia era forma de representarlo.
*
* COMO SE REPRESENTA. El array sigue siendo una lista empaquetada, asi que el
* item solo tiene un sitio: el final. Para que se VEA en la celda 5 hay que poner
* celdas de hueco por delante que lo empujen hasta ahi, y por eso un hueco puede
* ocupar varias celdas seguidas.
*
* DONDE VAN LOS HUECOS: todos en el item que se mueve, y ninguno en los demas.
* Es lo que hace que los otros items se queden donde estaban. Repartirlos desde
* la izquierda -que es lo que habia antes- metia huecos en medio de un almacen
* lleno y desplazaba cosas que el jugador no habia tocado: al soltar un item en
* una celda vacia se movian tres mas.
*
* CUANTOS. Con `K` celdas, `E` celdas de hueco ya puestas delante del item y `H`
* nuevas, su posicion pintada es `(K - 1) + E + H`. Para que caiga en
* `dstPainted`: `H = dstPainted - (K - 1) - E`. El tope es `2K - 1` posiciones,
* porque no puede haber mas celdas de hueco que celdas ocupadas: cada hueco
* necesita un item al que anclarse. Mas alla de ese tope se recorta en vez de
* inventar una posicion.
*/
function moveToFreeCell(game, draggedId, dstPainted, filtro, sort) {
	const state = game.getState();
	const celdas = visibleStacksFor(game, state, filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;
	const K = celdas.length;
	if (!K) return false;
	const yaPuestos = /* @__PURE__ */ new Map();
	for (const id of game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) yaPuestos.set(id, (yaPuestos.get(id) ?? 0) + 1);
	const totalPuestos = [...yaPuestos.values()].reduce((a, b) => a + b, 0);
	const grupo = celdas[origen];
	const hayQueMover = origen !== K - 1;
	if (hayQueMover && !game.moveItems(grupo.ids, null, "despues")) return false;
	const delante = celdas.filter((_, i) => i !== origen).reduce((sum, c) => sum + (yaPuestos.get(c.item.id) ?? 0), 0);
	const wanted = Math.max(0, dstPainted - (K - 1) - delante);
	const caben = Math.max(0, totalCeldasPintadas(K, capacity) - K - totalPuestos);
	const H = Math.min(wanted, caben);
	if (!hayQueMover && H === 0) return false;
	const salida = [];
	for (const c of celdas) {
		if (c.ids.includes(draggedId)) {
			salida.push(...Array(H).fill(c.item.id));
			continue;
		}
		salida.push(...Array(yaPuestos.get(c.item.id) ?? 0).fill(c.item.id));
	}
	game.setWarehouseGaps?.(salida);
	return true;
}
/**
* El mismo traslado, con el filtro y el orden como parámetros en vez de leídos
* del estado de pantalla. La rejilla que el jugador está viendo y la que usa el
* arrastre tienen que ser LA MISMA: si divergen, el número de celda que señala no
* es el sitio que se mueve. Se puede comprobar sin DOM, que es lo que hace este
* banco de pruebas.
*/
function moveItemTo(game, draggedId, dstViewIndex, filtro, sort) {
	if (dstViewIndex < 0) return false;
	const celdas = visibleStacksFor(game, game.getState(), filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const grupo = celdas[origen];
	if (dstViewIndex === origen) return false;
	const destino = dstViewIndex >= celdas.length ? null : celdas[dstViewIndex];
	if (destino && grupo.ids.includes(destino.ids[0])) return false;
	const irDespues = dstViewIndex > origen;
	const ancla = destino ? irDespues ? destino.ids[destino.ids.length - 1] : destino.ids[0] : null;
	return game.moveItems(grupo.ids, ancla, irDespues ? "despues" : "antes");
}
/** ¿El item pasa el filtro activo de la rejilla? */
function matchesFilter(w, filtro) {
	if (filtro === "all") return true;
	if (filtro === "otros") return !["collector", "companion"].includes(w.type);
	return w.type === filtro;
}
//#endregion
export { visibleStacksFor as a, moveToFreeCell as i, moveIntoGap as n, moveItemTo as r, matchesFilter as t };
