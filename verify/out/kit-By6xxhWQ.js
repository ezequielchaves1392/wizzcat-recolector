import { i as countOccupiedSlots, t as createGameLoop } from "./gameLoop-DA2943Xb.js";
//#region verify/kit.ts
/**
* Filas de las comprobaciones del banco EN CURSO.
*
* `kit.ts` se comparte entre bancos (Vite lo mete en un chunk comun), asi que
* `rows` es UN array para todos. `resumen()` lo vacia al terminar cada banco: sin
* eso, los fallos del banco anterior salen otra vez en el siguiente y parece que
* falla lo que no ha fallado.
*/
var rows = [];
function check(name, ok, detail = "") {
	rows.push({
		name,
		ok,
		detail
	});
}
var USER = {
	uid: "test",
	displayName: "Probador"
};
var DB = "users/test";
/** El documento tal y como está en la "base de datos", para mirar lo guardado. */
var guardado = () => globalThis.__MEM_DB__[DB];
/**
* Arranca el game loop con la partida dada puesta en la base de datos.
*
* `extra` es el cuarto argumento de `createGameLoop` —el mismo que `main.ts` le
* pasa a `showAchievementPopup`—, y existe porque sin él no hay forma de mirar si
* el motor **emite** un logro. Antes solo se podía mirar si se desbloqueaba en el
* estado, y son dos cosas distintas: el cartel depende de la primera y del cableado
* hasta la vista, y esa segunda mitad no es comprobable desde un banco (B3).
*/
async function boot(save, extra) {
	await new Promise((r) => setTimeout(r, 0));
	await new Promise((r) => setTimeout(r, 0));
	limpiarCola();
	globalThis.__MEM_DB__ = {};
	if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
	return await createGameLoop(USER, () => {}, void 0, extra?.onAchievement);
}
/**
* Vuelve a cargar desde lo último guardado, como si el jugador refrescara la
* página. Es la mitad de casi todas las comprobaciones: un cambio puede verse
* bien en memoria y no haber llegado al documento.
*
* NO limpia la cola a propósito: recargar es justo el caso para el que existe,
* y `queueCheck` lo usa para comprobar que lo pendiente se recupera. Quien
* quiera una recarga sin cola llama a `boot()`.
*/
async function reload() {
	return await createGameLoop(USER, () => {});
}
/**
* Borra la cola de nanitas pendientes.
*
* Vive aquí y no en el runner porque el problema no era solo entre bancos: cada
* `boot()` dentro de un mismo banco parte de un documento nuevo, y si la cola
* de una partida anterior siguiera ahí, `createGameLoop` la adoptaría por ser
* más reciente y arrancaría con un saldo que el test no ha puesto nunca.
*/
function limpiarCola() {
	try {
		globalThis.localStorage?.clear?.();
	} catch {}
}
/** Arranca una partida nueva (documento inexistente). */
async function bootNew() {
	globalThis.__MEM_DB__ = {};
	return await createGameLoop(USER, () => {});
}
var s = (g) => g.getState();
var wh = (g) => g.getState().warehouse ?? [];
var ids = (g) => wh(g).map((w) => w.id);
var nanites = (g) => g.getState().nanites;
var deType = (g, type) => wh(g).filter((w) => w.type === type).length;
var find = (g, id) => wh(g).find((w) => w.id === id);
/**
* Cuántas ranuras ocupa el almacén.
*
* No es `wh(g).length`: desde `data/stacking` la capacidad se cuenta por GRUPOS,
* y una pila de 20 llaves ocupa una. Comparar con el largo del array mide una
* cosa distinta de la que mide la pantalla.
*/
var ranuras = (g) => countOccupiedSlots(wh(g));
var collector = (id, tier = 3, over = {}) => ({
	id,
	name: `Recolector T${tier}`,
	type: "collector",
	details: `Recolección por click: +${20 * tier}`,
	rarity: "Épico",
	tier,
	level: 0,
	damage: 20 * tier,
	sellPrice: 500,
	...over
});
var companion = (id, tier = 3, over = {}) => ({
	id,
	name: `Compañero T${tier}`,
	type: "companion",
	details: "Recolección por segundo: +10/s",
	rarity: "Épico",
	tier,
	sellPrice: 2e3,
	...over
});
/** El companion de `state.companions` (la ficha que paga pasivo), no el item. */
var ficha = (id, tier = 3, over = {}) => ({
	id,
	name: `Compañero T${tier}`,
	type: "passive",
	power: 10,
	rarity: "Épico",
	tier,
	...over
});
var CRATE_NAMES = {
	common: "Caja Común",
	rare: "Caja Rara",
	epic: "Caja Épica",
	legendary: "Caja Legendaria"
};
var crate = (id, tipo = "common", stack = 1, over = {}) => ({
	id,
	name: CRATE_NAMES[tipo],
	type: "crate",
	details: "x",
	rarity: "Común",
	tier: 0,
	sellPrice: 125,
	stackable: true,
	stackCount: stack,
	...over
});
/**
* Un item apilable que NO se fusiona con el de al lado.
*
* Desde `data/stacking` la capacidad se cuenta en RANURAS OCUPADAS, y dos items
* apilables del mismo tipo y nombre se funden en una sola ranura al cargar
* (`mergeStacks`). Una prueba que pone tres cajas iguales esperando tres ranuras
*Distinct mide la fusion, no lo que queria. Para "N cosas que ocupan N ranuras"
* hay que usar items de nombres distintos: es lo que hace `distintos()`.
*/
var distintos = (n, tipo = "collector") => Array.from({ length: n }, (_, i) => tipo === "collector" ? collector(`r${i}`, 1, { name: `Recolector ${i}` }) : collector(`r${i}`, 1, { name: `Cosa ${i}` }));
var KEY_NAMES = [
	"Llave de Cifrado",
	"Llave Reforzada",
	"Llave Rúnica",
	"Llave del Vacío"
];
var key = (id, tier = 0, stack = 1, over = {}) => ({
	id,
	name: KEY_NAMES[tier],
	type: "key",
	details: "x",
	rarity: "Común",
	tier,
	sellPrice: 480,
	stackable: true,
	stackCount: stack,
	...over
});
var CRYSTAL_NAMES = [
	"Cristal de Mejora",
	"Cristal de Fase",
	"Cristal de Entropía",
	"Cristal Singular"
];
var crystal = (id, tier = 1, stack = 1, over = {}) => ({
	id,
	name: CRYSTAL_NAMES[tier - 1] ?? "Cristal de Mejora",
	type: "crystal",
	details: "x",
	rarity: "Común",
	tier,
	sellPrice: 180,
	stackable: true,
	stackCount: stack,
	...over
});
var consumable = (id, buffId, stack = 1, over = {}) => ({
	id,
	name: over.name ?? "Consumible",
	type: "consumable",
	details: "x",
	rarity: "Raro",
	tier: 0,
	sellPrice: 2500,
	stackable: true,
	stackCount: stack,
	buffId,
	...over
});
/**
* Partida base con los contadores ya en paz con el almacén.
*
* Los contadores se derivan del almacén al cargar, así que una partida de test
* que los traiga descuadrados mide el recorte, no lo que quiere medir.
*/
function baseSave(items, extra = {}) {
	const crates = {
		common: 0,
		rare: 0,
		epic: 0,
		legendary: 0
	};
	const keysByTier = {
		0: 0,
		1: 0,
		2: 0,
		3: 0
	};
	const crystalsByTier = {};
	let upgradeCrystals = 0;
	let afkCards = 0;
	for (const w of items) if (w.type === "crate") {
		const t = w.name.includes("Legendaria") ? "legendary" : w.name.includes("Épica") ? "epic" : w.name.includes("Rara") ? "rare" : "common";
		crates[t] += w.stackCount || 1;
	} else if (w.type === "key") keysByTier[w.tier ?? 0] += w.stackCount || 1;
	else if (w.type === "crystal") {
		crystalsByTier[w.tier ?? 1] += w.stackCount || 1;
		if ((w.tier ?? 1) === 1) upgradeCrystals += w.stackCount || 1;
	} else if (w.type === "consumable" && w.buffId === "afk") afkCards += w.stackCount || 1;
	return {
		saveVersion: 7,
		nanites: 1e3,
		totalNanitesProduced: 0,
		warehouse: items,
		crates,
		keys: keysByTier[0] + keysByTier[1] + keysByTier[2] + keysByTier[3],
		keysByTier,
		crystalsByTier,
		upgradeCrystals,
		afkCards,
		companions: [],
		activeCompanions: [],
		equippedCollectorId: null,
		warehouseCapacity: 30,
		maxCompanionSlots: 3,
		warehouseGaps: [],
		buffs: {
			clickBoostExpiresAt: 0,
			passiveBoostExpiresAt: 0,
			clickX2ExpiresAt: 0,
			clickX3ExpiresAt: 0
		},
		nodeLevels: {},
		unlockedNodes: [],
		cores: 0,
		totalCores: 0,
		shards: 0,
		forgedCount: 0,
		cosmetics: {
			title: "title_default",
			frame: "frame_none",
			banner: "banner_none",
			unlocked: []
		},
		unlockedAchievements: [],
		...extra
	};
}
/**
* Ejecuta `fn` con `Math.random` clavado en `valor`.
*
* POR QUÉ EXISTE. La sintonización del recolector tira un dado por cada intento
* y hasta ahora las pruebas solo miraban los RECHAZOS, que son deterministas
* porque no llegan al dado. La rama del ACIERTO —la que devuelve
* `{ success: true }`— no la comprobaba ningún banco. Ese hueco es
* precisamente lo que dejó pasar el bug más gordo que se arregla aquí:
* `crystalPicker.ts` leía `res.ok` sobre un `{ success }`, que da `undefined`,
* así que `!undefined` era `true` y TODA sintonización caía en la rama de
* error. Un acierto pintaba un toast rojo de "error" con el texto "¡Mejora
* exitosa!" dentro y sonaba el sonido de fallo. Un resultado mal leído no
* lanza ningún aviso: por eso hacía falta una prueba que lo leyera bien.
*
* No es una reimplementación de ninguna regla del juego, que es lo que este kit
* prohíbe: el umbral lo sigue poniendo `crystalSuccessChance` y el dado lo
* sigue tirando el game loop. Aquí solo se quita la varianza, que es justo lo
* que hace que una prueba sea intermitente.
*
* Los dos extremos son seguros sin conocer la fórmula: el techo de
* `crystalSuccessChance` es 95, así que `0` acierta siempre y `0.999` falla
* siempre, para cualquier nivel y cualquier cristal.
*/
function conRoll(valor, fn) {
	const original = Math.random;
	Math.random = () => valor;
	try {
		return fn();
	} finally {
		Math.random = original;
	}
}
function resumen(titulo) {
	const mio = rows.splice(0, rows.length);
	const fallos = mio.filter((r) => !r.ok);
	mio.forEach((r) => console.log(`${r.ok ? "PASA" : "FALLA"}  ${r.name}${r.detail ? "   [" + r.detail + "]" : ""}`));
	console.log(`\n${mio.length - fallos.length}/${mio.length} pruebas correctas (${titulo})`);
	if (fallos.length) {
		console.log("\nFALLOS:");
		fallos.forEach((r) => console.log("  - " + r.name + (r.detail ? "  [" + r.detail + "]" : "")));
		process.exitCode = 1;
	}
}
//#endregion
export { s as C, resumen as S, ids as _, check as a, ranuras as b, conRoll as c, crystal as d, deType as f, guardado as g, find as h, bootNew as i, consumable as l, ficha as m, baseSave as n, collector as o, distintos as p, boot as r, companion as s, USER as t, crate as u, key as v, wh as w, reload as x, nanites as y };
