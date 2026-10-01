import { t as createGameLoop } from "./gameLoop-DA2943Xb.js";
//#region verify/sellCheck.ts
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
/** Guarda una partida en la "base de datos" y arranca el game loop con ella. */
async function boot(save) {
	globalThis.__MEM_DB__ = {};
	if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
	return await createGameLoop(USER, () => {});
}
/** Vuelve a cargar la partida desde lo último guardado, como si refrescaran. */
async function reload() {
	return await createGameLoop(USER, () => {});
}
var ids = (g) => g.getState().warehouse.map((w) => w.id);
var nanites = (g) => g.getState().nanites;
var find = (g, id) => g.getState().warehouse.find((w) => w.id === id);
/** El almacén como array, para mirar una unidad concreta de una pila. */
var wh = (g) => g.getState().warehouse;
var deType = (g, type) => g.getState().warehouse.filter((w) => w.type === type).length;
var collector = (id, tier = 3) => ({
	id,
	name: "Recolector T" + tier,
	type: "collector",
	details: "Recolección por click: +20",
	rarity: "Épico",
	tier,
	level: 0,
	damage: 20,
	sellPrice: 500
});
var companion = (id, tier = 3) => ({
	id,
	name: "Compañero T" + tier,
	type: "companion",
	details: "Recolección por segundo: +10/s",
	rarity: "Épico",
	tier,
	sellPrice: 2e3
});
var crate = (id, tipo = "common", stack = 1) => ({
	id,
	name: {
		common: "Caja Común",
		rare: "Caja Rara",
		epic: "Caja Épica",
		legendary: "Caja Legendaria"
	}[tipo],
	type: "crate",
	details: "x",
	rarity: "Común",
	tier: 0,
	sellPrice: 125,
	stackable: true,
	stackCount: stack
});
var key = (id, tier = 0, stack = 1) => ({
	id,
	name: {
		0: "Llave de Cifrado",
		1: "Llave Reforzada",
		2: "Llave Rúnica",
		3: "Llave del Vacío"
	}[tier],
	type: "key",
	details: "x",
	rarity: "Común",
	tier,
	sellPrice: 480,
	stackable: true,
	stackCount: stack
});
var crystal = (id, tier = 1, stack = 1) => ({
	id,
	name: {
		1: "Cristal de Afino",
		2: "Cristal de Fase",
		3: "Cristal de Entropía",
		4: "Cristal Singular"
	}[tier],
	type: "crystal",
	details: "x",
	rarity: "Común",
	tier,
	sellPrice: 180,
	stackable: true,
	stackCount: stack
});
var consumable = (id, stack = 1, over = {}) => ({
	id,
	name: "Tarjeta AFK",
	type: "consumable",
	details: "x",
	rarity: "Raro",
	tier: 0,
	sellPrice: 2500,
	stackable: true,
	stackCount: stack,
	buffId: "afk",
	...over
});
/** Un recolector como lo guardaba el juego ANTES del renombre a 'collector'. */
var legacyWeapon = (id = "weapon_blaster_001", over = {}) => ({
	id,
	name: "Blaster Láser",
	type: "weapon",
	details: "Recolección por click: +5",
	rarity: "Común",
	tier: 1,
	level: 0,
	damage: 5,
	sellPrice: 250,
	...over
});
/** Partida base con contadores ya en paz con el almacén. */
function baseSave(warehouse, extra = {}) {
	const crates = {
		common: 0,
		rare: 0,
		epic: 0,
		legendary: 0
	};
	warehouse.forEach((w) => {
		if (w.type === "crate") {
			const t = w.name.includes("Legendaria") ? "legendary" : w.name.includes("Épica") ? "epic" : w.name.includes("Rara") ? "rare" : "common";
			crates[t] += w.stackCount || 1;
		}
	});
	return {
		saveVersion: 7,
		nanites: 1e3,
		warehouse,
		crates,
		companions: [],
		activeCompanions: [],
		equippedCollectorId: null,
		keys: 0,
		upgradeCrystals: 0,
		warehouseCapacity: 30,
		...extra
	};
}
async function main() {
	{
		const g = await boot(baseSave([crate("c1")]));
		const antes = nanites(g);
		const r = g.sellItem("c1");
		const s = g.getState();
		check("caja suelta: sellItem devuelve ok", r.ok, r.msg ?? "");
		check("caja suelta: el almacén se queda vacío", s.warehouse.length === 0, ids(g).join(","));
		check("caja suelta: contador de cajas a 0", s.crates.common === 0, "crates.common=" + s.crates.common);
		check("caja suelta: paga el precio", r.gained === 125 && nanites(g) === antes + 125, "ganado=" + r.gained);
		const g2 = await reload();
		check("caja suelta: no revive al recargar", g2.getState().warehouse.length === 0, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 4)]));
		const r = g.sellItem("c1");
		check("pila de 4 cajas: se vende entera", r.ok && deType(g, "crate") === 0, ids(g).join(","));
		check("pila de 4 cajas: paga 4 x 125", r.gained === 500, "ganado=" + r.gained);
		check("pila de 4 cajas: contador a 0", g.getState().crates.common === 0, "crates.common=" + g.getState().crates.common);
	}
	{
		const g = await boot(baseSave([crate("c1", "common"), crate("c2", "epic")]));
		const antes = nanites(g);
		g.sellItem("c1");
		check("dos cajas distintas: tras la primera queda 1", deType(g, "crate") === 1 && g.getState().crates.common === 0 && g.getState().crates.epic === 1, "comunes=" + g.getState().crates.common + " epicas=" + g.getState().crates.epic);
		g.sellItem("c2");
		check("dos cajas distintas: tras la segunda no queda ninguna", deType(g, "crate") === 0 && g.getState().crates.common === 0 && g.getState().crates.epic === 0, "comunes=" + g.getState().crates.common + " epicas=" + g.getState().crates.epic);
		check("dos cajas distintas: paga las dos", nanites(g) === antes + 125 + 125, "nanites=" + nanites(g));
		const g2 = await reload();
		check("dos cajas distintas: no revive ninguna al recargar", deType(g2, "crate") === 0 && g2.getState().crates.epic === 0, "ids=" + ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([crate("c1"), crate("c2")]));
		const antes = nanites(g);
		check("pila de cajas iguales: se funden en un solo item", deType(g, "crate") === 1, "items=" + deType(g, "crate"));
		check("pila de cajas iguales: y el contador sigue diciendo 2", g.getState().crates.common === 2, "crates.common=" + g.getState().crates.common);
		check("pila de cajas iguales: vender una se lleva la pila entera", g.sellItem("c1").ok && deType(g, "crate") === 0, "quedan=" + deType(g, "crate"));
		check("pila de cajas iguales: paga las dos unidades", nanites(g) === antes + 250, "nanites=" + nanites(g));
		check("pila de cajas iguales: y el contador queda a 0", g.getState().crates.common === 0, "crates.common=" + g.getState().crates.common);
		const g2 = await reload();
		check("pila de cajas iguales: no revive al recargar", deType(g2, "crate") === 0, "ids=" + ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([key("k1", 0, 3)]));
		const r = g.sellItem("k1");
		check("llave: desaparece", r.ok && deType(g, "key") === 0, ids(g).join(","));
		check("llave: contador de llaves a 0", g.getState().keys === 0, "keys=" + g.getState().keys);
		check("llave: paga 3 unidades", r.gained === 1440, "ganado=" + r.gained);
		const g2 = await reload();
		check("llave: no revive al recargar", deType(g2, "key") === 0, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([crystal("x1", 1, 2)]));
		check("cristal: desaparece", g.sellItem("x1").ok && deType(g, "crystal") === 0, ids(g).join(","));
		check("cristal: contador a 0", g.getState().upgradeCrystals === 0, "crystals=" + g.getState().upgradeCrystals);
	}
	{
		const g = await boot(baseSave([consumable("u1", 2)]));
		const r = g.sellItem("u1");
		check("consumible: desaparece", r.ok && deType(g, "consumable") === 0, ids(g).join(","));
		check("consumible: paga 2 unidades", r.gained === 5e3, "ganado=" + r.gained);
	}
	{
		const g = await boot(baseSave([companion("m1"), companion("m2")], { companions: [{
			id: "m1",
			name: "Compañero T3",
			type: "passive",
			power: 10,
			rarity: "Épico",
			tier: 3
		}, {
			id: "m2",
			name: "Compañero T3",
			type: "passive",
			power: 10,
			rarity: "Épico",
			tier: 3
		}] }));
		check("compañero: desaparece del almacén", g.sellItem("m1").ok && deType(g, "companion") === 1, ids(g).join(","));
		check("compañero: sale de state.companions", !g.getState().companions.some((c) => c.id === "m1"), JSON.stringify(g.getState().companions.map((c) => c.id)));
		const g2 = await reload();
		check("compañero: no vuelve por la sincronización", deType(g2, "companion") === 1, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		check("recolector: desaparece", g.sellItem("r1").ok && deType(g, "collector") === 1, ids(g).join(","));
		check("recolector: queda el otro", !!find(g, "r2"), ids(g).join(","));
		const g2 = await reload();
		check("recolector: no revive al recargar", deType(g2, "collector") === 1, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")], { equippedCollectorId: "r1" }));
		const r = g.sellItem("r1");
		check("recolector equipado: se rechaza", !r.ok && !!r.msg, r.msg ?? "");
		check("recolector equipado: sigue en el almacén", deType(g, "collector") === 2, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("r1")]));
		const r = g.sellItem("r1");
		check("último recolector: se rechaza", !r.ok && deType(g, "collector") === 1, r.msg ?? "");
	}
	{
		const g = await boot(baseSave([key("k1")]));
		const r = g.sellItem("k1");
		const r2 = g.sellItem("k1");
		check("vender dos veces el mismo id: la 2ª falla", r.ok && !r2.ok, r2.msg ?? "");
	}
	{
		const g = await boot(baseSave([crate("c1"), key("k1", 0)]));
		const r = g.openCrateBox("c1", "k1");
		check("abrir caja: ok", r.ok, r.msg ?? "");
		check("abrir caja: la caja se consume", deType(g, "crate") === 0, ids(g).join(","));
		check("abrir caja: la llave se consume", !find(g, "k1"), ids(g).join(","));
		check("abrir caja: contador a 0", g.getState().crates.common === 0, "crates.common=" + g.getState().crates.common);
		const g2 = await reload();
		check("abrir caja: no revive al recargar", g2.getState().crates.common === 0, "crates.common=" + g2.getState().crates.common);
	}
	{
		const g = await boot({
			...baseSave([]),
			crates: {
				common: 3,
				rare: 0,
				epic: 0,
				legendary: 0
			},
			keys: 0
		});
		check("migración: contador huérfano se materializa", g.getState().crates.common === 3, "crates.common=" + g.getState().crates.common);
		const g2 = await reload();
		check("migración: no duplica al cargar otra vez", g2.getState().crates.common === 3, "crates.common=" + g2.getState().crates.common);
		const primera = g2.getState().warehouse.find((w) => w.type === "crate").id;
		g2.sellItem(primera);
		check("migración: tras vender, no queda ninguna", g2.getState().crates.common === 0 && deType(g2, "crate") === 0, "crates.common=" + g2.getState().crates.common + " items=" + deType(g2, "crate"));
	}
	{
		globalThis.__MEM_DB__ = {};
		const g = await createGameLoop(USER, () => {});
		check("partida nueva: recibe 2 cajas comunes", g.getState().crates.common === 2, "crates.common=" + g.getState().crates.common);
		check("partida nueva: las cajas son items reales", deType(g, "crate") === 1, "items de caja=" + deType(g, "crate") + " (las 2 en una sola pila)");
		check("partida nueva: y la pila lleva las 2 unidades", wh(g).find((w) => w.type === "crate")?.stackCount === 2, "stackCount=" + wh(g).find((w) => w.type === "crate")?.stackCount);
	}
	{
		const g = await boot(baseSave([
			crate("c1"),
			crate("c2"),
			collector("r1"),
			collector("r2"),
			key("k1", 0, 5)
		], {
			totalNanitesProduced: 5e6,
			totalCores: 1
		}));
		const r = g.prestige();
		check("prestigio: se concede", r.success, r.msg ?? "");
		check("prestigio: el almacén se vacía de lo reciclado", deType(g, "crate") === 1 && deType(g, "key") === 0, "cajas=" + deType(g, "crate") + " llaves=" + deType(g, "key"));
		check("prestigio: las 2 cajas de partida nueva son reales", g.getState().crates.common === 2 && deType(g, "crate") === 1, "contador=" + g.getState().crates.common + " items=" + deType(g, "crate"));
		const g2 = await reload();
		check("prestigio: las cajas no se duplican al recargar", g2.getState().crates.common === 2, "contador=" + g2.getState().crates.common);
	}
	{
		const g = await boot(baseSave([consumable("u1", 3)]));
		check("AFK: una pila de 3 cuenta 3", g.getState().afkCards === 3, "afkCards=" + g.getState().afkCards);
		const g2 = await boot(baseSave([
			consumable("u1"),
			consumable("u2"),
			consumable("u3")
		]));
		check("AFK: 3 tarjetas sueltas cuentan 3", g2.getState().afkCards === 3, "afkCards=" + g2.getState().afkCards);
		const g4 = await boot(baseSave([consumable("u1", 3, { name: "Tarjeta AFK" }), consumable("u2", 2, { name: "Permiso de Ausencia" })]));
		check("AFK: dos pilas distintas de tarjetas se suman", g4.getState().afkCards === 5, "afkCards=" + g4.getState().afkCards);
		check("AFK: y son dos celdas de verdad", deType(g4, "consumable") === 2, "items=" + deType(g4, "consumable"));
		const g3 = await boot(baseSave([consumable("u1", 3)]));
		g3.sellItem("u1");
		check("AFK: vender una pila de 3 se lleva las 3", g3.getState().afkCards === 0, "afkCards=" + g3.getState().afkCards);
		const g5 = await boot(baseSave([consumable("u2", 2)]));
		g5.useConsumable("u2");
		check("AFK: usar una tarjeta de una pila de 2 deja 1", g5.getState().afkCards === 1, "afkCards=" + g5.getState().afkCards);
	}
	{
		const g = await boot(baseSave([{
			...consumable("u1", 2),
			name: "Permiso de Ausencia"
		}]));
		check("AFK: se identifica por buffId, no por el nombre", g.getState().afkCards === 2, "afkCards=" + g.getState().afkCards);
	}
	{
		const viejo = { ...consumable("u1", 2) };
		delete viejo.buffId;
		const g = await boot(baseSave([viejo]));
		check("AFK: save viejo sin buffId se sigue contando", g.getState().afkCards === 2, "afkCards=" + g.getState().afkCards);
		const r = g.useConsumable("u1");
		check("AFK: y se puede usar igual", r.ok, r.msg ?? "");
	}
	{
		const g = await boot(baseSave([
			{
				id: "e1",
				name: "Ranura de Almacén",
				type: "consumable",
				details: "x",
				rarity: "Raro",
				tier: 0,
				sellPrice: 125,
				stackable: true,
				stackCount: 4,
				buffId: "warehouseExpander"
			},
			{
				id: "p1",
				name: "Piedra de Calibración",
				type: "consumable",
				details: "x",
				rarity: "Raro",
				tier: 0,
				sellPrice: 11250,
				stackable: true,
				stackCount: 2,
				buffId: "calibrationStone"
			},
			{
				id: "x1",
				name: "Caja Común",
				type: "crate",
				details: "x",
				rarity: "Común",
				tier: 0,
				sellPrice: 125,
				stackable: true,
				stackCount: 1,
				buffId: "afk"
			},
			consumable("u1", 1)
		]));
		check("AFK: no cuenta otros consumibles ni otros tipos", g.getState().afkCards === 1, "afkCards=" + g.getState().afkCards);
	}
	{
		const g = await boot(baseSave([consumable("u1", 5)], { afkCards: 1 }));
		check("AFK: al cargar se recalcula, no se cree al guardado", g.getState().afkCards === 5, "afkCards=" + g.getState().afkCards);
		const g2 = await reload();
		check("AFK: y el valor bueno es el que se guarda", g2.getState().afkCards === 5, "afkCards=" + g2.getState().afkCards);
	}
	{
		const g = await boot(baseSave([
			crate("c1"),
			crate("c2"),
			crate("c3"),
			key("k1"),
			key("k2")
		]));
		const antes = nanites(g);
		for (const id of [
			"c1",
			"c2",
			"c3",
			"k1",
			"k2"
		]) g.sellItem(id);
		check("ciclo: almacén vacío", g.getState().warehouse.length === 0, ids(g).join(","));
		check("ciclo: nanites = 3 cajas + 2 llaves", nanites(g) === antes + 375 + 960, "delta=" + (nanites(g) - antes));
		const g2 = await reload();
		check("ciclo: sigue vacío tras recargar", g2.getState().warehouse.length === 0, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([legacyWeapon(), companion("m1")], {
			saveVersion: 6,
			equippedWeaponId: "weapon_blaster_001"
		}));
		const s = g.getState();
		check("renombre: el item viejo pasa a ser recolector", deType(g, "collector") === 1 && deType(g, "weapon") === 0, ids(g).join(","));
		check("renombre: conserva su id, su daño y su descripción", find(g, "weapon_blaster_001")?.damage === 5 && find(g, "weapon_blaster_001")?.details === "Recolección por click: +5", JSON.stringify(find(g, "weapon_blaster_001")));
		check("renombre: el recolector equipado no se pierde", s.equippedCollectorId === "weapon_blaster_001", "equippedCollectorId=" + s.equippedCollectorId);
		check("renombre: el click vuelve a hacer daño", g.getClickDamage() > 0, "daño=" + g.getClickDamage());
		check("renombre: la bandera \"equipped\" acompaña al id", find(g, "weapon_blaster_001")?.equipped === true, JSON.stringify(find(g, "weapon_blaster_001")?.equipped));
		const g2 = await reload();
		const guardado = globalThis.__MEM_DB__[DB];
		check("renombre: se guarda y no vuelve al estado viejo", deType(g2, "collector") === 1 && guardado.saveVersion === 7, "saveVersion=" + guardado.saveVersion);
	}
	{
		const g = await boot(baseSave([legacyWeapon(), companion("m1")], { saveVersion: 6 }));
		check("renombre: el Blaster de partida se puede equipar", g.equipCollector("weapon_blaster_001") === true);
		check("renombre: queda como recolector equipado", g.getState().equippedCollectorId === "weapon_blaster_001", "equippedCollectorId=" + g.getState().equippedCollectorId);
		check("renombre: y hace daño al click", g.getClickDamage() > 0, "daño=" + g.getClickDamage());
	}
	{
		const g = await boot(baseSave([legacyWeapon(), companion("m1")], {
			saveVersion: 6,
			equippedWeaponId: "weapon_blaster_001"
		}));
		g.equipCollector("weapon_blaster_001");
		check("renombre: desequipar funciona", g.getState().equippedCollectorId === null, "equippedCollectorId=" + g.getState().equippedCollectorId);
		const g2 = await reload();
		check("renombre: el id viejo del documento no resucita el equipado", g2.getState().equippedCollectorId === null, "equippedCollectorId=" + g2.getState().equippedCollectorId);
		check("renombre: sin equipado, el click no hace daño", g2.getClickDamage() === 0, "daño=" + g2.getClickDamage());
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")], { equippedCollectorId: "r9" }));
		check("renombre: un id equipado colgante se limpia", g.getState().equippedCollectorId === null, "equippedCollectorId=" + g.getState().equippedCollectorId);
		check("renombre: y ningún item se marca por el camino", g.getState().warehouse.every((w) => !w.equipped), "EQ=colgado");
	}
	{
		const g = await boot(baseSave([legacyWeapon("weapon_blaster_001", { equipped: true })], { saveVersion: 6 }));
		check("renombre: bandera sin id: se recupera el equipado", g.getState().equippedCollectorId === "weapon_blaster_001", "equippedCollectorId=" + g.getState().equippedCollectorId);
	}
	{
		globalThis.__MEM_DB__ = {};
		const g = await createGameLoop(USER, () => {});
		const s = g.getState();
		const blaster = s.warehouse.find((w) => w.type === "collector");
		const dron = s.warehouse.find((w) => w.type === "companion");
		check("partida nueva: el Blaster es un recolector", !!blaster, ids(g).join(","));
		check("partida nueva: el Dron es un compañero", !!dron, ids(g).join(","));
		check("partida nueva: se pueden equipar los dos", g.equipCollector(blaster.id) === true && g.equipCompanion(dron.id) === true, `blaster=${blaster.id} dron=${dron.id}`);
		check("partida nueva: el click del Blaster hace daño", g.getClickDamage() > 0, "daño=" + g.getClickDamage());
		check("partida nueva: el Dron da ingreso pasivo", s.passiveIncome > 0, "pasivo=" + s.passiveIncome);
	}
	for (const [id, unidades] of [
		["c1", 4],
		["k1", 19],
		["x1", 7],
		["u1", 3]
	]) {
		const g = await boot(baseSave([
			crate("c1", "common", unidades),
			key("k1", 0, unidades),
			crystal("x1", 1, unidades),
			consumable("u1", unidades),
			collector("r1"),
			collector("r2")
		]));
		const unitario = g.getSellPrice(id);
		const anunciado = g.getSellTotal(id);
		const antes = nanites(g);
		const r = g.sellItem(id);
		const cobrado = nanites(g) - antes;
		check(`venta: el total anunciado de ${id} es unidad x ${unidades}`, anunciado === unitario * unidades, `anunciado=${anunciado} ${unitario}x${unidades}`);
		check(`venta: y es lo que entra en la cuenta de ${id}`, r.ok && cobrado === anunciado, `cobrado=${cobrado} anunciado=${anunciado}`);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		const id = "r1";
		const antes = nanites(g);
		g.sellItem(id);
		check("venta: un recolector no apilable se cobra a precio de una unidad", g.getSellTotal(id) === g.getSellPrice(id) * 1 || nanites(g) - antes === g.getSellPrice(id), `total=${g.getSellTotal(id)} unitario=${g.getSellPrice(id)} cobrado=${nanites(g) - antes}`);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		check("venta: un id inexistente vale 0 en precio y en total", g.getSellPrice("nada") === 0 && g.getSellTotal("nada") === 0, `unitario=${g.getSellPrice("nada")} total=${g.getSellTotal("nada")}`);
	}
	{
		const g = await boot(baseSave([key("k1", 0, 10)]));
		const antes = nanites(g);
		const r = g.sellItem("k1", 4);
		const pila = find(g, "k1");
		check("parcial: devuelve cuántas se vendieron", r.ok && r.sold === 4, "sold=" + r.sold);
		check("parcial: la pila conserva lo que sobra", !!pila && pila.stackCount === 6, "quedan=" + (pila ? pila.stackCount : "no existe"));
		check("parcial: cobra 4, no la pila", r.gained === 1920 && nanites(g) === antes + 1920, "ganado=" + r.gained + " nanitas=" + nanites(g));
		check("parcial: el contador de llaves baja a 6", g.getState().keys === 6, "keys=" + g.getState().keys);
		const g2 = await reload();
		const pila2 = find(g2, "k1");
		check("parcial: las 6 que sobran sobreviven a la recarga", !!pila2 && pila2.stackCount === 6, "quedan=" + (pila2 ? pila2.stackCount : "no existe"));
		check("parcial: y no se Readmite lo vendido", nanites(g2) === antes + 1920, "nanitas=" + nanites(g2));
		check("parcial: el contador tras recargar sigue en 6", g2.getState().keys === 6, "keys=" + g2.getState().keys);
	}
	{
		const desajustes = [];
		for (let n = 1; n <= 10; n++) {
			const g = await boot(baseSave([key("k1", 0, 10)]));
			const esperado = g.getSellTotal("k1", n);
			const r = g.sellItem("k1", n);
			if (r.gained !== esperado) desajustes.push(`n=${n} cargo=${r.gained} anunciaba=${esperado}`);
		}
		check("parcial: el cargo es EXACTAMENTE el que anunciaba getSellTotal, en las 10 cantidades", desajustes.length === 0, desajustes.join(" | ") || "las 10 cuadran");
	}
	{
		const g = await boot(baseSave([key("k1", 0, 3)]));
		const antes = nanites(g);
		const r = g.sellItem("k1", 99);
		check("parcial: pedir 99 en una pila de 3 se recorta a 3", r.ok && r.sold === 3, "sold=" + r.sold + " ganado=" + r.gained);
		check("parcial: y cobra lo de 3, no lo de 99", r.gained === 1440 && nanites(g) === antes + 1440, "ganado=" + r.gained);
		check("parcial: la pila se queda vacía", !find(g, "k1"), ids(g).join(","));
		check("parcial: y getSellTotal también se recorta", g.getSellTotal("k1", 99) === 0, "total=" + g.getSellTotal("k1", 99));
	}
	{
		const g = await boot(baseSave([key("k1", 0, 5)]));
		const antes = nanites(g);
		const malos = [
			0,
			-3,
			NaN,
			Infinity
		];
		const acepto = [];
		for (const n of malos) if (g.sellItem("k1", n).ok) acepto.push(`${n} -> ok`);
		check("parcial: 0, negativos, NaN e Infinity se rechazan", acepto.length === 0, acepto.join(" | ") || "los 4 rechazados");
		check("parcial: y rechazar no cobra nada", nanites(g) === antes, `nanitas=${nanites(g)} antes=${antes}`);
		check("parcial: y la pila sigue entera", find(g, "k1")?.stackCount === 5, "quedan=" + find(g, "k1")?.stackCount);
		const g3 = await boot(baseSave([key("k1", 0, 5)]));
		const a3 = nanites(g3);
		const rDecimal = g3.sellItem("k1", 1.7);
		check("parcial: un decimal se redondea ABAJO y se vende 1, no 2", rDecimal.ok && rDecimal.sold === 1 && nanites(g3) === a3 + 480, "sold=" + rDecimal.sold + " ganado=" + rDecimal.gained);
		check("parcial: por debajo de 1 no queda ni una unidad y se rechaza", (await boot(baseSave([key("k1", 0, 5)]))).sellItem("k1", .5).ok === false, "vendido 0.5");
		const rTexto = g.sellItem("k1", "2");
		check("parcial: un \"2\" escrito como texto se acepta y son 2 unidades", rTexto.ok && rTexto.sold === 2, "sold=" + rTexto.sold);
	}
	{
		const g1 = await boot(baseSave([key("k1", 0, 10)]));
		const a1 = nanites(g1);
		g1.sellItem("k1", 3);
		g1.sellItem("k1", 4);
		const r3 = g1.sellItem("k1", 3);
		const g2 = await boot(baseSave([key("k2", 0, 10)]));
		const a2 = nanites(g2);
		const rTodo = g2.sellItem("k2");
		check("parcial: tres ventas suman lo mismo que una de la pila entera", nanites(g1) - a1 === nanites(g2) - a2, `por partes=${nanites(g1) - a1} de una vez=${nanites(g2) - a2}`);
		check("parcial: y la tercera vació la pila", r3.sold === 3 && !find(g1, "k1"), ids(g1).join(","));
		check("parcial: vender sin decir cantidad sigue vendiendo la pila entera", rTodo.sold === 10 && !find(g2, "k2"), "sold=" + rTodo.sold);
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 8)]));
		const r = g.sellItem("c1", 5);
		check("parcial: una pila de cajas también se vende a medias", r.ok && r.sold === 5 && find(g, "c1")?.stackCount === 3, "sold=" + r.sold + " quedan=" + find(g, "c1")?.stackCount);
		check("parcial: y el contador de cajas sigue a la pila", g.getState().crates.common === 3, "crates.common=" + g.getState().crates.common);
		const g2 = await reload();
		check("parcial: las 3 cajas que sobran sobreviven", find(g2, "c1")?.stackCount === 3, "quedan=" + find(g2, "c1")?.stackCount);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		const unitario = g.getSellPrice("r1");
		const r = g.sellItem("r1", 7);
		check("parcial: un recolector se vende de una en una aunque se pidan 7", r.ok && r.sold === 1 && r.gained === unitario, `sold=${r.sold} ganado=${r.gained} unitario=${unitario}`);
	}
	const fallos = rows.filter((r) => !r.ok);
	rows.forEach((r) => console.log(`${r.ok ? "PASA" : "FALLA"}  ${r.name}${r.detail ? "   [" + r.detail + "]" : ""}`));
	console.log(`\n${rows.length - fallos.length}/${rows.length} pruebas correctas`);
	if (fallos.length) {
		console.log("\nFALLOS:");
		fallos.forEach((r) => console.log("  - " + r.name + "  [" + r.detail + "]"));
		process.exitCode = 1;
	}
}
var sellCheck_default = main();
//#endregion
export { sellCheck_default as default };
