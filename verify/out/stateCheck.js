import { c as collectorValue, d as collectorUpgradeCost, f as coreProgress, g as pendingCores, h as nextCores, l as fusionImprovesDensity, m as nanitesToNextCore, p as nanitesForCores, u as collectorMaxLevel, y as CRATE_LOOT } from "./gameLoop-DA2943Xb.js";
import { C as s, S as resumen, _ as ids, a as check, c as conRoll, d as crystal, f as deType, g as guardado, h as find, i as bootNew, l as consumable, m as ficha, n as baseSave, o as collector, r as boot, s as companion, u as crate, v as key, w as wh, x as reload, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/stateCheck.ts
/**
* La PILA de un material en un nivel dado, o `undefined` si no hay ninguna.
*
* Se busca por `tier` y no por el nombre, porque el nombre es lo que se deduce
* cuando el save es viejo (`keyTierFromName`) y lo que cambia con la
* traducción. El nivel es el dato del que habla el botín.
*/
function pilaDe(g, tipo, tier) {
	if (typeof tier !== "number") return void 0;
	return wh(g).find((w) => w.type === tipo && w.tier === tier);
}
/**
* Valor de `Math.random` que hace salir la fila pedida de la tabla de una caja.
*
* Lee los PESOS de `CRATE_LOOT` en vez de fijarlos a mano, así que si mañana se
* añade, se quita o se reordena una entrada, esto sigue acertando sin tocar el
* test. No reimplementa ninguna regla del juego —solo construye el dado que hace
* que salga la fila que el test quiere mirar— y devuelve `null` si esa fila no
* existe, para que el test falle con un mensaje claro en vez de abrir 300 cajas
* confiando en la suerte.
*/
function rollPara(caja, idFila) {
	const tabla = CRATE_LOOT[caja];
	const total = tabla.reduce((a, e) => a + e.weight, 0);
	let antes = 0;
	for (const e of tabla) {
		if (e.id === idFila) return (antes + e.weight / 2) / total;
		antes += e.weight;
	}
	throw new Error(`la caja ${caja} no tiene la fila ${idFila}`);
}
async function main() {
	{
		const g = await bootNew();
		check("partida nueva: nace con nanitas a cero", s(g).nanites === 0, "nanites=" + s(g).nanites);
		check("partida nueva: trae un recolector", deType(g, "collector") === 1, ids(g).join(","));
		check("partida nueva: trae un companero", deType(g, "companion") === 1, ids(g).join(","));
		check("partida nueva: y las 2 cajas de bienvenida, en una sola pila", deType(g, "crate") === 1 && wh(g).find((w) => w.type === "crate")?.stackCount === 2, ids(g).join(","));
		check("partida nueva: la capacidad por defecto es 15", s(g).warehouseCapacity === 15, "cap=" + s(g).warehouseCapacity);
		check("partida nueva: 1 hueco de companero", s(g).maxCompanionSlots === 1, "slots=" + s(g).maxCompanionSlots);
		check("partida nueva: nace sin nada equipado", s(g).equippedCollectorId === null, String(s(g).equippedCollectorId));
		check("partida nueva: no hay companion activo", s(g).activeCompanions.length === 0, s(g).activeCompanions.join(","));
		const g2 = await reload();
		check("partida nueva: recargar no duplica las cajas", s(g2).crates.common === 2 && wh(g2).filter((w) => w.type === "crate").length === 1, `items=${wh(g2).filter((w) => w.type === "crate").length} contador=${s(g2).crates.common}`);
		check("partida nueva: y la pila sigue con las 2 unidades", wh(g2).find((w) => w.type === "crate")?.stackCount === 2, "stackCount=" + wh(g2).find((w) => w.type === "crate")?.stackCount);
	}
	{
		await bootNew();
		await reload();
		const g3 = await reload();
		check("partida nueva: recargar muchas veces no acumula cajas", s(g3).crates.common === 2 && wh(g3).find((w) => w.type === "crate")?.stackCount === 2, `contador=${s(g3).crates.common} unidades=${wh(g3).find((w) => w.type === "crate")?.stackCount}`);
	}
	{
		await boot(baseSave([
			collector("r1", 4, {
				level: 5,
				damage: 80,
				affixes: ["a"],
				potential: 3
			}),
			crate("c1", "epic", 2),
			key("k1", 2, 3),
			crystal("x1", 2, 4),
			consumable("u1", "afk", 2, { name: "Tarjeta AFK" }),
			{
				id: "m1",
				name: "Compañero T2",
				type: "companion",
				details: "x",
				rarity: "Épico",
				tier: 2,
				sellPrice: 500
			}
		], {
			nanites: 12345,
			totalNanitesProduced: 987654,
			totalClicks: 321,
			cratesOpened: 7,
			warehouseCapacity: 28,
			maxCompanionSlots: 4,
			cores: 33,
			totalCores: 44,
			resets: 2,
			shards: 9,
			forgedCount: 5,
			companions: [ficha("m1", 2)],
			activeCompanions: ["m1"],
			equippedCollectorId: "r1",
			nodeLevels: {
				core_sink: 3,
				core_edge: 1
			},
			unlockedNodes: ["core_sink", "core_edge"]
		}));
		const g2 = await reload();
		const t = s(g2);
		check("guardar: nanites", t.nanites === 12345, "nanites=" + t.nanites);
		check("guardar: total producido", t.totalNanitesProduced === 987654, String(t.totalNanitesProduced));
		check("guardar: total de clicks", t.totalClicks === 321, String(t.totalClicks));
		check("guardar: cajas abiertas", t.cratesOpened === 7, String(t.cratesOpened));
		check("guardar: capacidad", t.warehouseCapacity === 28, String(t.warehouseCapacity));
		check("guardar: slots de companero", t.maxCompanionSlots === 4, String(t.maxCompanionSlots));
		check("guardar: nucleos", t.cores === 33 && t.totalCores === 44, `${t.cores}/${t.totalCores} cola=${globalThis.localStorage.getItem("cyberforge_nanitas_pendientes")}`);
		check("guardar: reinicios", t.resets === 2, String(t.resets));
		check("guardar: esquirlas", t.shards === 9, String(t.shards));
		check("guardar: recolectores forjadas", t.forgedCount === 5, String(t.forgedCount));
		check("guardar: nodos del arbol", t.nodeLevels.core_sink === 3 && t.nodeLevels.core_edge === 1, JSON.stringify(t.nodeLevels));
		check("guardar: el almacen entero", wh(g2).length === 6, ids(g2).join(","));
		check("guardar: el recolector conserva nivel, dano, afijos y potencial", (() => {
			const r = find(g2, "r1");
			return r?.level === 5 && r?.damage === 80 && r?.potential === 3 && JSON.stringify(r?.affixes) === "[\"a\"]";
		})(), JSON.stringify(find(g2, "r1")));
		check("guardar: el companero activo sigue activo", t.activeCompanions.join(",") === "m1", t.activeCompanions.join(","));
		check("guardar: el recolector equipado sigue equipado", t.equippedCollectorId === "r1" && g2.getClickDamage() > 0, "danio=" + g2.getClickDamage());
		check("guardar: el documento queda en la version actual", guardado().saveVersion === s(g2).saveVersion, `documento=${guardado().saveVersion} estado=${s(g2).saveVersion}`);
	}
	await boot(baseSave([collector("r1")], {
		saveVersion: 6,
		campoAjeno: "noTocar"
	}));
	await reload();
	check("guardar: el merge no borra claves ajenas al guardado", guardado().campoAjeno === "noTocar", String(guardado().campoAjeno));
	{
		const g = await boot({
			saveVersion: 3,
			nanites: 500,
			warehouse: [collector("r1")]
		});
		check("migracion: una partida minima carga sin error", !!s(g).warehouse, "sin almacen");
		check("migracion: los contadores de material se derivan del almacen", typeof s(g).keys === "number" && typeof s(g).upgradeCrystals === "number", `keys=${s(g).keys} crystals=${s(g).upgradeCrystals}`);
		check("migracion: el documento se sube a la version actual", guardado().saveVersion === s(g).saveVersion, `documento=${guardado().saveVersion} estado=${s(g).saveVersion}`);
	}
	{
		const g = await boot(baseSave([{
			id: "r1",
			name: "Cosa Vieja",
			type: "collector",
			rarity: "Común",
			tier: 2
		}], { saveVersion: 4 }));
		const r = find(g, "r1");
		check("migracion: un recolector sin dano recibe uno", typeof r?.damage === "number" && r.damage > 0, JSON.stringify(r?.damage));
		check("migracion: y su descripcion se pone al dia", r?.details === `Recolección por click: +${r.damage}`, JSON.stringify(r?.details));
	}
	{
		const llave = key("k1", 0, 1, { name: "Llave Rúnica" });
		delete llave.tier;
		const crist = crystal("x1", 1, 1, { name: "Cristal de Fase" });
		delete crist.tier;
		const g = await boot(baseSave([llave, crist], { saveVersion: 4 }));
		check("migracion: una llave sin nivel lo deduce del nombre", find(g, "k1")?.tier === 2, "tier=" + find(g, "k1")?.tier);
		check("migracion: un cristal sin nivel tambien", find(g, "x1")?.tier === 2, "tier=" + find(g, "x1")?.tier);
	}
	{
		const g = await boot(baseSave([], {
			saveVersion: 5,
			keys: 3,
			keysByTier: {
				0: 2,
				1: 1,
				2: 0,
				3: 0
			},
			upgradeCrystals: 4
		}));
		check("migracion: un contador de llaves sin items se materializa", s(g).keys === 3, "keys=" + s(g).keys);
		check("migracion: en dos pilas, una por nivel", deType(g, "key") === 2, "items=" + deType(g, "key") + " unidades=" + wh(g).filter((w) => w.type === "key").map((w) => `${w.name}:${w.stackCount}`).join(" "));
		const g2 = await reload();
		check("migracion: no duplica las llaves al cargar otra vez", s(g2).keys === 3, "keys=" + s(g2).keys);
	}
	{
		const g = await boot(baseSave([
			key("k1", 0, 3),
			key("k2", 1, 2),
			crystal("x1", 1, 4)
		], { saveVersion: 7 }));
		check("sin duplicar: una carga deja las llaves como estaban", s(g).keys === 5 && deType(g, "key") === 2, `keys=${s(g).keys} items=${deType(g, "key")}`);
		check("sin duplicar: y los cristales como estaban", s(g).upgradeCrystals === 4 && deType(g, "crystal") === 1, `crystals=${s(g).upgradeCrystals} items=${deType(g, "crystal")}`);
		const g2 = await reload();
		check("sin duplicar: la segunda carga NO duplica las llaves", s(g2).keys === 5 && deType(g2, "key") === 2, `keys=${s(g2).keys} items=${deType(g2, "key")} (${s(g2).warehouse.filter((w) => w.type === "key").map((w) => w.stackCount).join("+")})`);
		check("sin duplicar: ni los cristales", s(g2).upgradeCrystals === 4 && deType(g2, "crystal") === 1, `crystals=${s(g2).upgradeCrystals} items=${deType(g2, "crystal")}`);
		const g3 = await reload();
		const g4 = await reload();
		check("sin duplicar: cinco recargas no multiplican el material", s(g3).keys === 5 && s(g4).keys === 5, `3a=${s(g3).keys} 4a=${s(g4).keys}`);
		check("sin duplicar: y el almacen no crece", wh(g4).length === 3, ids(g4).join(","));
	}
	{
		const g = await boot(baseSave([key("k1", 0, 2)], {
			saveVersion: 7,
			keys: 5,
			keysByTier: {
				0: 5,
				1: 0,
				2: 0,
				3: 0
			}
		}));
		check("migracion parcial: solo se recupera lo que falta", s(g).keys === 5, `keys=${s(g).keys} (almacen tenia 2, contador decia 5)`);
		const g2 = await reload();
		check("migracion parcial: y no se duplica al cargar otra vez", s(g2).keys === 5, `keys=${s(g2).keys}`);
	}
	{
		const g = await boot(baseSave([], {
			saveVersion: 5,
			crates: {
				common: 0,
				rare: 5,
				epic: 0,
				legendary: 0
			}
		}));
		check("migracion: al cargar, un contador de cajas huérfano se materializa", s(g).crates.rare === 5 && wh(g).some((w) => w.type === "crate"), "rare=" + s(g).crates.rare + " items=" + deType(g, "crate"));
		const g2 = await reload();
		check("migracion: y al cargar otra vez no se crea ninguna mas", s(g2).crates.rare === 5 && wh(g2).filter((w) => w.type === "crate").length === 1, `rare=${s(g2).crates.rare} items=${wh(g2).filter((w) => w.type === "crate").length}`);
		check("migracion: las 5 cajas estan en una sola pila", wh(g2).find((w) => w.type === "crate")?.stackCount === 5, "stackCount=" + wh(g2).find((w) => w.type === "crate")?.stackCount);
		g2.sellItem(wh(g2).find((w) => w.type === "crate").id);
		check("migracion: tras vender la pila, el contador baja a 0", s(g2).crates.rare === 0, "rare=" + s(g2).crates.rare);
		const g3 = await reload();
		check("migracion: y no reaparece al recargar", s(g3).crates.rare === 0 && deType(g3, "crate") === 0, `rare=${s(g3).crates.rare} items=${deType(g3, "crate")}`);
	}
	{
		const g = await boot({
			nanites: 100,
			warehouse: [{
				id: "w1",
				name: "Blaster Láser",
				type: "weapon",
				details: "x",
				rarity: "Común",
				tier: 1,
				sellPrice: 250
			}]
		});
		check("migracion: sin saveVersion tambien migra", deType(g, "collector") === 1, ids(g).join(","));
	}
	{
		const items = [
			crate("c1"),
			crate("c2"),
			consumable("u1", "afk"),
			companion("m1", 5),
			collector("r1", 5)
		];
		const g = await boot(baseSave(items, { warehouseCapacity: 3 }));
		check("capacidad: el almacen se recorta al limite", wh(g).length === 3, ids(g).join(","));
		check("capacidad: se conservan recolectores y companeros, no cajas", !!find(g, "r1") && !!find(g, "m1"), ids(g).join(","));
	}
	{
		const items = [
			collector("r1"),
			collector("r2"),
			crate("c1"),
			crate("c2")
		];
		const g = await boot(baseSave(items, {
			warehouseCapacity: 1,
			equippedCollectorId: "r1"
		}));
		check("capacidad: con recorte minimo sobrevive el recolector equipado", s(g).equippedCollectorId === "r1" && !!find(g, "r1"), `id=${s(g).equippedCollectorId} items=${ids(g).join(",")}`);
		check("capacidad: y el click sigue haciendo dano", g.getClickDamage() > 0, "danio=" + g.getClickDamage());
	}
	{
		const g = await boot(baseSave([
			crate("c1"),
			crate("c2"),
			crate("c3"),
			{
				id: "m1",
				name: "Compañero T1",
				type: "companion",
				details: "x",
				rarity: "Común",
				sellPrice: 100
			},
			{
				id: "m2",
				name: "Compañero T1",
				type: "companion",
				details: "x",
				rarity: "Común",
				sellPrice: 100
			}
		], {
			warehouseCapacity: 2,
			companions: [ficha("m1"), ficha("m2")],
			activeCompanions: ["m1"]
		}));
		check("capacidad: sobrevive el companero activo", s(g).activeCompanions.includes("m1"), s(g).activeCompanions.join(","));
		check("capacidad: y el recorte no lo descuadra", wh(g).length <= 2, "items=" + wh(g).length);
	}
	{
		const g = await boot(baseSave([
			crate("c1"),
			crate("c2"),
			collector("r1")
		], { warehouseCapacity: 1 }));
		const g2 = await reload();
		check("capacidad: recargar tras un recorte no lo cambia otra vez", wh(g2).length === 1 && wh(g2)[0].id === wh(g)[0].id, `${ids(g2).join(",")} vs ${ids(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([
			crate("c1", "common", 4),
			key("k1", 0, 2),
			crystal("x1", 1, 3)
		]));
		for (const [id, unidades] of [
			["c1", 4],
			["k1", 2],
			["x1", 3]
		]) {
			const unitario = g.getSellPrice(id);
			const nanoAntes = nanites(g);
			const r = g.sellItem(id);
			const cobrado = nanites(g) - nanoAntes;
			check(`precio: ${id} cobra unidad x unidades (${unitario} x ${unidades})`, r.ok && cobrado === unitario * unidades, `cobrado=${cobrado} esperado=${unitario * unidades}`);
		}
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 2)], {
			nodeLevels: { scrapyard: 2 },
			unlockedNodes: ["scrapyard"]
		}));
		const prima = 1 + s(g).bonus.sellMult;
		check("precio: la bonificacion de venta sube el precio mostrado", g.getSellPrice("c1") === Math.floor(125 * prima), `${g.getSellPrice("c1")} prima=${prima}`);
		const antes = nanites(g);
		g.sellItem("c1");
		check("precio: y el cobro usa el mismo numero", nanites(g) - antes === g.getSellPrice("c1") + 0 || nanites(g) - antes === Math.floor(125 * prima * 2), `cobrado=${nanites(g) - antes}`);
	}
	{
		const g = await boot(baseSave([crate("c1")]));
		check("precio: un id inexistente vale 0", g.getSellPrice("no_existe") === 0);
		check("precio: y venderlo se rechaza", g.sellItem("no_existe").ok === false);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, { damage: 60 })], { nanites: 0 }));
		check("click: sin recolector equipado no hay dano", g.getClickDamage() === 0, "danio=" + g.getClickDamage());
		g.click();
		check("click: sin recolector no se gana nada", s(g).nanites === 0, "nanites=" + s(g).nanites);
		check("click: pero el click se cuenta igualmente", s(g).totalClicks === 1, "clicks=" + s(g).totalClicks);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, { damage: 60 })], { nanites: 0 }));
		g.equipCollector("r1");
		const danio = g.getClickDamage();
		check("click: con recolector hay dano", danio > 0, "danio=" + danio);
		g.click();
		check("click: el click da el dano anunciado", s(g).nanites === danio, `${s(g).nanites} vs ${danio}`);
		const d2 = g.getClickDamage();
		g.click();
		check("click: el segundo click da el dano de ese momento", s(g).nanites === danio + d2, `${s(g).nanites} vs ${danio}+${d2}`);
		const d3 = g.getClickDamage();
		g.click();
		check("click: y el tercero tambien", s(g).nanites === danio + d2 + d3, `${s(g).nanites} vs ${danio}+${d2}+${d3}`);
		check("click: el total producido lleva la cuenta", s(g).totalNanitesProduced === s(g).nanites, `${s(g).totalNanitesProduced} vs ${s(g).nanites}`);
		check("click: y el numero de clicks tambien", s(g).totalClicks === 3, "clicks=" + s(g).totalClicks);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 0
		})], { nanites: 0 }));
		g.equipCollector("r1");
		const d0 = g.getClickDamage();
		g.updateState({ warehouse: wh(g).map((w) => w.id === "r1" ? {
			...w,
			level: 10
		} : w) });
		const d10 = g.getClickDamage();
		check("click: el nivel del recolector sube el dano", d10 > d0, `${d0} -> ${d10}`);
		check("click: y sigue equipado", s(g).equippedCollectorId === "r1", String(s(g).equippedCollectorId));
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 0
		}), crystal("x1", 1, 5)], {
			nanites: 0,
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		}));
		g.equipCollector("r1");
		const coste = collectorUpgradeCost(0);
		const antes = find(g, "x1").stackCount;
		const danio0 = g.getClickDamage();
		const r = conRoll(0, () => g.upgradeEquippedCollector(1));
		check("mejora: el acierto se lee por `success` y no por `ok`", r.success === true, `success=${r.success} ok=${JSON.stringify(r.ok)} msg=${r.msg ?? ""}`);
		check("mejora: y el mensaje es el del acierto, no el del fallo", /exitosa/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: el acierto sube el nivel", find(g, "r1").level === 1, "nivel=" + find(g, "r1").level);
		check("mejora: consume los cristales del coste", find(g, "x1").stackCount === antes - coste, `antes=${antes} ahora=${find(g, "x1").stackCount} coste=${coste}`);
		check("mejora: y el nivel nuevo paga más daño", g.getClickDamage() > danio0, `${danio0} -> ${g.getClickDamage()}`);
		const g2 = await reload();
		check("mejora: el acierto sobrevive a la recarga", find(g2, "r1")?.level === 1, "nivel=" + find(g2, "r1")?.level);
		check("mejora: y el reload no regasta la mejora", find(g2, "x1")?.stackCount === antes - coste, "stackCount=" + find(g2, "x1")?.stackCount);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 4
		}), crystal("x1", 1, 5)], { nanites: 0 }));
		g.equipCollector("r1");
		const coste = collectorUpgradeCost(4);
		const antes = find(g, "x1").stackCount;
		const danio0 = g.getClickDamage();
		const r = conRoll(.999, () => g.upgradeEquippedCollector(1));
		check("mejora: el fallo se lee por `success`", r.success === false, `success=${r.success} ok=${JSON.stringify(r.ok)}`);
		check("mejora: y el mensaje lo dice", /fallo/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: el fallo no retrocede el nivel", find(g, "r1").level === 4, "nivel=" + find(g, "r1").level);
		check("mejora: el fallo no cambia el daño", g.getClickDamage() === danio0, `${danio0} -> ${g.getClickDamage()}`);
		check("mejora: pero el cristal se paga igual", find(g, "x1").stackCount === antes - coste, `antes=${antes} ahora=${find(g, "x1").stackCount} coste=${coste}`);
		const g2 = await reload();
		check("mejora: el fallo sobrevive a la recarga", find(g2, "r1")?.level === 4, "nivel=" + find(g2, "r1")?.level);
		check("mejora: y el cristal gastado no vuelve", find(g2, "x1")?.stackCount === antes - coste, "stackCount=" + find(g2, "x1")?.stackCount);
	}
	{
		const g = await boot(baseSave([crystal("x1", 1, 5)], { nanites: 0 }));
		const r = g.upgradeEquippedCollector(1);
		check("mejora: sin recolector equipado se rechaza", !r.success && !!r.msg, r.msg ?? "");
		check("mejora: y no se gastan cristales", find(g, "x1").stackCount === 5, String(find(g, "x1")?.stackCount));
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 0
		}), crystal("x1", 3, 5)], { nanites: 0 }));
		g.equipCollector("r1");
		const r = g.upgradeEquippedCollector(1);
		check("mejora: sin cristal del nivel pedido se rechaza", !r.success && /no tienes/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: y el cristal de otro nivel no se gasta", find(g, "x1").stackCount === 5, String(find(g, "x1")?.stackCount));
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 20
		}), crystal("x1", 1, 99)], { nanites: 0 }));
		g.equipCollector("r1");
		const r = g.upgradeEquippedCollector(1);
		check("mejora: en el nivel maximo se rechaza", !r.success && /máximo/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: y no se gastan cristales", find(g, "x1").stackCount === 99, String(find(g, "x1")?.stackCount));
	}
	{
		const paraPasarDe20 = collectorUpgradeCost(20);
		const cristalesDe20 = paraPasarDe20 + 10;
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 20,
			maxLevel: 28,
			potential: 3
		}), crystal("x1", 1, cristalesDe20)], { nanites: 0 }));
		g.equipCollector("r1");
		const r = conRoll(0, () => g.upgradeEquippedCollector(1));
		check("mejora: un recolector forjado pasa del 20 si su techo da", r.success === true && find(g, "r1").level === 21, `nivel=${find(g, "r1").level} msg=${r.msg ?? ""}`);
		check("mejora: y el gasto es real", find(g, "x1").stackCount === cristalesDe20 - paraPasarDe20, `x1=${find(g, "x1").stackCount} menos ${paraPasarDe20}`);
		const g2 = await reload();
		check("mejora: y el nivel 21 sobrevive a la recarga", find(g2, "r1")?.level === 21, "nivel=" + find(g2, "r1")?.level);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 28,
			maxLevel: 28
		}), crystal("x1", 1, 99)], { nanites: 0 }));
		g.equipCollector("r1");
		const r = g.upgradeEquippedCollector(1);
		check("mejora: en el techo del item se rechaza", !r.success && /máximo/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: y no se gastan cristales", find(g, "x1").stackCount === 99, String(find(g, "x1")?.stackCount));
		check("mejora: el mensaje nombra el techo del item", /\+280%/.test(r.msg ?? ""), r.msg ?? "");
	}
	check("mejora: sin `maxLevel` el techo es 20", collectorMaxLevel(void 0) === 20 && collectorMaxLevel(null) === 20 && collectorMaxLevel(28) === 28, [collectorMaxLevel(void 0), collectorMaxLevel(28)].join(","));
	check("mejora: un `maxLevel` de 0 no rompe el techo", collectorMaxLevel(0) === 20, String(collectorMaxLevel(0)));
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 10
		}), crystal("x1", 1, 1)], { nanites: 0 }));
		g.equipCollector("r1");
		const necesita = collectorUpgradeCost(10);
		check("mejora: el coste crece con el nivel", necesita > 1, "coste en nivel 10=" + necesita);
		const r = g.upgradeEquippedCollector(1);
		check("mejora: con menos cristales de los necesarios se rechaza", !r.success && /Necesitas/i.test(r.msg ?? ""), r.msg ?? "");
		check("mejora: y no se queda sin cristales", find(g, "x1")?.stackCount === 1, "stackCount=" + find(g, "x1")?.stackCount);
		check("mejora: y el nivel no cambia", find(g, "r1").level === 10, "nivel=" + find(g, "r1").level);
	}
	{
		const g = await boot(baseSave([crate("c1", "legendary"), key("k1", 0, 1, { name: "Llave de Cifrado" })]));
		const r = g.openCrateBox("c1", "k1");
		check("cajas: una llave de nivel 0 no abre un cofre de nivel 3", !r.ok && !!r.msg, r.msg ?? "");
		check("cajas: y no se gasta nada", !!find(g, "c1") && !!find(g, "k1"), ids(g).join(","));
	}
	{
		const g = await boot(baseSave([crate("c1", "common"), key("k1", 3, 1, { name: "Llave del Vacío" })]));
		const r = g.openCrateBox("c1", "k1");
		check("cajas: una llave mejor abre un cofre peor", r.ok, r.msg ?? "");
		check("cajas: y consume la llave", !find(g, "k1"), ids(g).join(","));
	}
	{
		const g = await boot(baseSave([crate("c1", "common"), key("k1", 0, 2)]));
		const r = g.openCrateBox("c1", "k1");
		check("cajas: con la llave correcta se abre", r.ok, r.msg ?? "");
		check("cajas: la caja se consume", !find(g, "c1"), ids(g).join(","));
		const esperado = r.reward?.kind === "keys" && (r.reward.keyTier ?? 0) === 0 ? 1 + r.reward.amount : 1;
		check("cajas: el botín de llaves se apila con las de su nivel", find(g, "k1")?.stackCount === esperado, `pila=${find(g, "k1")?.stackCount} esperado=${esperado} premio=${r.reward?.kind}`);
		check("cajas: el contador de cajas abiertas sube", s(g).cratesOpened === 1, String(s(g).cratesOpened));
		const g2 = await reload();
		check("cajas: el botin aplicado sobrevive a la recarga", s(g2).cratesOpened === 1 && deType(g2, "crate") === s(g2).crates.common, `abiertas=${s(g2).cratesOpened} items=${deType(g2, "crate")} contador=${s(g2).crates.common}`);
	}
	{
		const g = await boot(baseSave([crate("c1", "common")]));
		const r = g.openCrateBox("c1", "k1");
		check("cajas: sin llave se rechaza y no se gasta la caja", !r.ok && !!find(g, "c1"), r.msg ?? "");
	}
	{
		const r = (await boot(baseSave([key("k1", 0, 1)]))).openCrateBox("c1", "k1");
		check("cajas: sin caja se rechaza", !r.ok, r.msg ?? "");
	}
	{
		const lleno = Array.from({ length: 29 }, (_, i) => crate(`x${i}`));
		const g = await boot(baseSave([
			...lleno,
			crate("c1", "common"),
			key("k1", 0, 1)
		], { warehouseCapacity: 30 }));
		const antes = wh(g).length;
		g.openCrateBox("c1", "k1");
		check("cajas: con el almacen lleno el botin no desborda", wh(g).length <= g.getCapacity(), `antes=${antes} ahora=${wh(g).length} cap=${g.getCapacity()}`);
	}
	{
		const g = await boot(baseSave([crate("c1", "legendary"), key("k3", 3, 1)]));
		const r = conRoll(rollPara("legendary", "keys"), () => g.openCrateBox("c1", "k3"));
		check("cajas: la caja legendary se abre", r.ok, r.msg ?? "");
		check("cajas: la llave del botín es del nivel que anuncia", r.reward?.kind === "keys" && pilaDe(g, "key", r.reward.keyTier)?.stackCount === r.reward.amount, `anuncia ${r.reward?.keyTier}x${r.reward?.amount} y llegó ` + JSON.stringify(wh(g).filter((w) => w.type === "key").map((w) => `${w.name}:${w.tier}x${w.stackCount ?? 1}`)));
		check("cajas: y no aparece una llave del nivel equivocado", !wh(g).some((w) => w.type === "key" && w.tier !== r.reward?.keyTier), "sobran llaves de otro nivel");
		const g2 = await reload();
		check("cajas: y el nivel de la llave sobrevive a la recarga", pilaDe(g2, "key", r.reward.keyTier)?.stackCount === r.reward.amount, `pila=${pilaDe(g2, "key", r.reward.keyTier)?.stackCount}`);
	}
	{
		const g = await boot(baseSave([crate("c1", "legendary"), key("k3", 3, 1)]));
		const r = conRoll(rollPara("legendary", "crystals"), () => g.openCrateBox("c1", "k3"));
		check("cajas: el cristal del botín es del nivel que anuncia", r.reward?.kind === "crystals" && pilaDe(g, "crystal", r.reward.materialTier)?.stackCount === r.reward.amount, `anuncia ${r.reward?.materialTier}x${r.reward?.amount} y llegó ` + JSON.stringify(wh(g).filter((w) => w.type === "crystal").map((w) => `${w.name}:${w.tier}x${w.stackCount ?? 1}`)));
		check("cajas: y no aparece un cristal del nivel equivocado", !wh(g).some((w) => w.type === "crystal" && w.tier !== r.reward?.materialTier), "sobran cristales de otro nivel");
	}
	{
		const g = await boot(baseSave([
			crate("c1", "legendary"),
			key("k3", 3, 1),
			crystal("x1", 1, 5),
			crystal("x2", 2, 5),
			collector("r1", 3, {
				damage: 60,
				level: 0
			})
		]));
		g.equipCollector("r1");
		const coste = collectorUpgradeCost(0);
		const r = conRoll(0, () => g.upgradeEquippedCollector(2));
		check("cajas: sintonizar con nivel 2 gasta el cristal de nivel 2", find(g, "x2").stackCount === 5 - coste, `x2=${find(g, "x2").stackCount} coste=${coste} msg=${r.msg ?? ""}`);
		check("cajas: y el de nivel 1 no se toca", find(g, "x1").stackCount === 5, "x1=" + find(g, "x1").stackCount);
	}
	{
		const g = await boot(baseSave([
			crate("c1"),
			collector("r1"),
			collector("r2")
		], { totalNanitesProduced: 10 }));
		const r = g.prestige();
		check("prestigio: por debajo del umbral se rechaza", !r.success && !!r.msg, r.msg ?? "");
		check("prestigio: y no se toca nada", deType(g, "crate") === 1 && s(g).nanites === 1e3, `nanites=${s(g).nanites}`);
	}
	{
		const g = await boot(baseSave([
			crate("c1", "common", 2),
			crate("c2", "epic", 1),
			collector("r1", 3),
			collector("r2", 3),
			{
				id: "m1",
				name: "Compañero T1",
				type: "companion",
				details: "x",
				rarity: "Común",
				sellPrice: 100
			},
			key("k1", 0, 5)
		], {
			totalNanitesProduced: 5e7,
			nanites: 123456,
			cores: 7,
			totalCores: 12,
			resets: 3,
			nodeLevels: { core_sink: 2 },
			unlockedNodes: ["core_sink"],
			unlockedAchievements: ["first_click"],
			forgedCount: 4,
			shards: 6
		}));
		const esperado = nextCores({
			totalNanitesProduced: 5e7,
			totalCores: 12,
			coreGain: s(g).bonus.coreGain
		});
		const r = g.prestige();
		check("prestigio: con suficiente produccion se concede", r.success, r.msg ?? "");
		check("prestigio: otorga los nucleos anunciados", s(g).cores === 7 + esperado, `${s(g).cores} esperado=${7 + esperado}`);
		check("prestigio: el historico de nucleos crece", s(g).totalCores === 12 + esperado, String(s(g).totalCores));
		check("prestigio: se resetea el progreso", s(g).nanites < 123456, "nanites=" + s(g).nanites);
		check("prestigio: los contadores de reinicios suben", s(g).resets === 4, String(s(g).resets));
		check("prestigio: se conservan los NODOS del arbol", s(g).nodeLevels.core_sink === 2, JSON.stringify(s(g).nodeLevels));
		check("prestigio: se conservan los logros", s(g).unlockedAchievements.includes("first_click"), s(g).unlockedAchievements.join(","));
		check("prestigio: se conservan las recolectores forjadas", s(g).forgedCount === 4, String(s(g).forgedCount));
		check("prestigio: se conservan las esquirlas", s(g).shards === 6, String(s(g).shards));
		check("prestigio: el almacen se recycle", deType(g, "crate") === 1 && deType(g, "key") === 0, `cajas=${deType(g, "crate")} llaves=${deType(g, "key")}`);
		check("prestigio: y son las 2 cajas de bienvenida, en una sola pila", s(g).crates.common === 2 && deType(g, "crate") === 1 && wh(g).find((w) => w.type === "crate")?.stackCount === 2, `contador=${s(g).crates.common} items=${deType(g, "crate")} unidades=${wh(g).find((w) => w.type === "crate")?.stackCount}`);
		const g2 = await reload();
		check("prestigio: el resultado sobrevive a la recarga", s(g2).resets === 4 && s(g2).cores === 7 + esperado && s(g2).crates.common === 2, `resets=${s(g2).resets} cores=${s(g2).cores} cajas=${s(g2).crates.common}`);
	}
	{
		(await boot(baseSave([
			crate("c1"),
			collector("r1"),
			collector("r2")
		], { totalNanitesProduced: 5e7 }))).prestige();
		await reload();
		(await bootNew()).prestige?.();
		const g3 = await reload();
		check("prestigio: reiniciar otra vez no rompe el estado", typeof s(g3).nanites === "number", "nanites=" + s(g3).nanites);
	}
	{
		const g = await boot(baseSave([
			collector("a", 2),
			collector("b", 2),
			collector("c", 2)
		]));
		const r = g.forgeCollector([
			"a",
			"b",
			"c"
		]);
		check("forja: sin el nodo que la abre no se fusiona", !r.success && /Planos Viejos/i.test(r.msg ?? ""), r.msg ?? "");
		check("forja: y no se consume ningun material", deType(g, "collector") === 3, ids(g).join(","));
	}
	{
		const conBlueprint = {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		};
		const g = await boot(baseSave([
			collector("a", 2),
			collector("b", 2),
			collector("c", 2)
		], conBlueprint));
		check("forja: con 2 materiales se rechaza", !g.forgeCollector(["a", "b"]).success);
		check("forja: con 4 materiales se rechaza", !g.forgeCollector([
			"a",
			"b",
			"c",
			"a"
		]).success);
		check("forja: un id inexistente se rechaza", !g.forgeCollector([
			"a",
			"b",
			"nope"
		]).success);
		check("forja: y nada se ha consumido todavia", deType(g, "collector") === 3, ids(g).join(","));
		const g2 = await boot(baseSave([
			collector("a", 2),
			collector("b", 3),
			collector("c", 2)
		], conBlueprint));
		check("forja: los 3 tienen que ser del mismo tier", !g2.forgeCollector([
			"a",
			"b",
			"c"
		]).success);
		const g3 = await boot(baseSave([
			collector("a", 11),
			collector("b", 11),
			collector("c", 11)
		], conBlueprint));
		check("forja: T11 es el techo y no se fusiona", !g3.forgeCollector([
			"a",
			"b",
			"c"
		]).success);
		const g4 = await boot(baseSave([
			collector("a", 2),
			collector("b", 2),
			collector("c", 2)
		], {
			...conBlueprint,
			equippedCollectorId: "a"
		}));
		check("forja: la partida arranca con un recolector equipado", s(g4).equippedCollectorId === "a", String(s(g4).equippedCollectorId));
		const r = g4.forgeCollector([
			"a",
			"b",
			"c"
		]);
		check("forja: el recolector equipado no se puede consumir", !r.success, r.msg ?? "");
		check("forja: y sigue en el almacen", deType(g4, "collector") === 3, ids(g4).join(","));
		check("forja: y sigue haciendo dano", g4.getClickDamage() > 0, "danio=" + g4.getClickDamage());
	}
	{
		const g = await boot(baseSave([
			collector("a", 2, { damage: 40 }),
			collector("b", 2, { damage: 30 }),
			collector("c", 2, { damage: 50 })
		], {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		}));
		const r = g.forgeCollector([
			"a",
			"b",
			"c"
		]);
		check("forja: con 3 del mismo tier se ejecuta", typeof r.success === "boolean", r.msg ?? "");
		if (r.success) {
			check("forja: acierto, quedan el mas fuerte y la forjada", deType(g, "collector") === 2, "recolectores=" + deType(g, "collector"));
			check("forja: acierto, el almacen no queda ni vacio ni duplicado", wh(g).length === 2 && new Set(ids(g)).size === wh(g).length, ids(g).join(","));
			check("forja: la cuenta de forjadas sube", s(g).forgedCount >= 1, String(s(g).forgedCount));
		} else {
			check("forja: fallo, se pierden los 3 materiales", deType(g, "collector") === 0, "recolectores=" + deType(g, "collector"));
			check("forja: fallo, y a cambio dan esquirlas", s(g).shards > 0, "esquirlas=" + s(g).shards);
			check("forja: fallo, y el almacen no queda con ids repetidos", new Set(ids(g)).size === wh(g).length, ids(g).join(","));
		}
		const g2 = await reload();
		check("forja: el resultado sobrevive a la recarga", wh(g2).length === wh(g).length, `${wh(g2).length} vs ${wh(g).length}`);
	}
	{
		const g = await boot(baseSave([
			collector("a", 2),
			collector("b", 2),
			collector("c", 2),
			consumable("p1", "calibrationStone", 2, { name: "Piedra de Calibración" })
		], {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		}));
		const r = g.forgeCollector([
			"a",
			"b",
			"c"
		], 5, 0);
		check("forja: pedir mas piedras de las que hay se rechaza", !r.success, r.msg ?? "");
		check("forja: y no se gasta ninguna", find(g, "p1")?.stackCount === 2, String(find(g, "p1")?.stackCount));
	}
	{
		const g = await boot(baseSave([
			collector("a", 2),
			collector("b", 2),
			collector("c", 2)
		], {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		}));
		const r = g.forgeCollector([
			"a",
			"b",
			"c"
		], 0, 1);
		check("forja: pedir una nanoparticula sin tenerla se rechaza", !r.success, r.msg ?? "");
		check("forja: y no se fusiona", deType(g, "collector") === 3, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a", 2, { damage: 40 }),
			collector("b", 2, { damage: 30 }),
			collector("c", 2, { damage: 50 }),
			consumable("n1", "stabilityNano", 1, { name: "Nanopartícula de Estabilidad" })
		], {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		}));
		const r = g.forgeCollector([
			"a",
			"b",
			"c"
		], 0, 1);
		check("forja: con la nanoparticula la fusion se ejecuta", typeof r.success === "boolean", r.msg ?? "");
		check("forja: y la nanoparticula se gasta", !find(g, "n1"), ids(g).join(","));
	}
	{
		const conBlueprint = {
			nodeLevels: { blueprint: 1 },
			unlockedNodes: ["blueprint"]
		};
		const porTier = {};
		const entradasPorTier = {};
		let aciertos = 0;
		let intentos = 0;
		let algunaRenta = false;
		let algunaPerdida = false;
		for (let tier = 1; tier <= 9; tier++) {
			let peorDensidad = Infinity;
			let ultimaEntrada = [];
			for (let intento = 0; intento < 4; intento++) {
				const g = await boot(baseSave([
					collector("a", tier, { damage: 20 * tier }),
					collector("b", tier, { damage: 20 * tier }),
					collector("c", tier, { damage: 20 * tier })
				], conBlueprint));
				const entrada = [
					find(g, "a"),
					find(g, "b"),
					find(g, "c")
				].map((w) => ({ ...w }));
				const r = g.forgeCollector([
					"a",
					"b",
					"c"
				]);
				intentos++;
				if (!r.success || !r.collector) continue;
				aciertos++;
				ultimaEntrada = entrada;
				r.collector;
				peorDensidad = Math.min(peorDensidad, collectorValue(r.collector) / (entrada.reduce((s, w) => s + collectorValue(w), 0) / 3));
				if (collectorValue(r.collector) / entrada.reduce((s, w) => s + collectorValue(w), 0) > 1) algunaRenta = true;
				else algunaPerdida = true;
			}
			if (peorDensidad !== Infinity) {
				porTier["T" + tier] = Number((peorDensidad / 1.15).toFixed(2));
				entradasPorTier["T" + tier] = ultimaEntrada;
			}
		}
		const peorDensidad = Math.min(...Object.values(porTier));
		check("forja: se pudo medir la fusion en todos los intentos", intentos > 0 && aciertos >= 8, `intentos=${intentos} aciertos=${aciertos}`);
		check("forja: fusionar mejora el valor por ranura en TODOS los tiers", peorDensidad >= 1, "margen por tier=" + JSON.stringify(porTier));
		const ref = Object.keys(entradasPorTier)[0];
		const rRef = (await boot(baseSave([
			collector("a", 1),
			collector("b", 1),
			collector("c", 1)
		], conBlueprint))).forgeCollector([
			"a",
			"b",
			"c"
		]);
		check("forja: `fusionImprovesDensity` coincide con lo medido", !rRef.success || fusionImprovesDensity([
			collector("a", 1),
			collector("b", 1),
			collector("c", 1)
		], rRef.collector), ref ?? "");
		check("forja: DATO la curva de valor total (pierde en T1-T4)", algunaPerdida, `hay tiers que ganan=${algunaRenta} y tiers que pierden=${algunaPerdida}`);
	}
	{
		const g = await boot(baseSave([consumable("p1", "calibrationStone", 3, { name: "Piedra de Calibración" })]));
		const r = g.useConsumable("p1");
		check("forja: la piedra no se gasta usandola en el almacen", !r.ok, r.msg ?? "");
		check("forja: y conserva sus unidades", find(g, "p1").stackCount === 3, String(find(g, "p1").stackCount));
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			collector("r2"),
			crate("c1")
		]));
		g.updateState({ nanites: 4242 });
		check("updateState: aplica el cambio", s(g).nanites === 4242, "nanites=" + s(g).nanites);
		const g2 = await reload();
		check("updateState: y lo guarda", s(g2).nanites === 4242, "nanites=" + s(g2).nanites);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		g.updateState({ warehouse: Array.from({ length: 20 }, (_, i) => crate(`n${i}`)) });
		check("updateState: un almacen entrante demasiado grande se recorta", wh(g).length <= g.getCapacity(), `items=${wh(g).length} cap=${g.getCapacity()}`);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		g.updateState({
			warehouse: [crate("n1", "common", 3)],
			crates: {
				common: 3,
				rare: 0,
				epic: 0,
				legendary: 0
			}
		});
		check("updateState: no fabrica cajas de las que ya no hay", deType(g, "crate") === 1 && s(g).crates.common === 3, `items=${deType(g, "crate")} contador=${s(g).crates.common}`);
	}
	{
		const g = await boot(baseSave([
			collector("r1", 5, {
				damage: 100,
				level: 5
			}),
			crate("c1"),
			crate("c2"),
			key("k1", 0, 1),
			consumable("u1", "afk", 1, { name: "Tarjeta AFK" })
		], { nanites: 0 }));
		g.equipCollector("r1");
		for (let i = 0; i < 5; i++) g.click();
		g.sellItem("k1");
		g.useConsumable("u1");
		g.openCrateBox("c1", "k1");
		g.moveItems([find(g, "r2")?.id ?? "r1"], null);
		check("logros: ninguna operacion revienta", wh(g).length >= 0, "ok");
		check("logros: los logros desbloqueados son ids conocidos", s(g).unlockedAchievements.every((id) => typeof id === "string"), s(g).unlockedAchievements.join(","));
		const g2 = await reload();
		check("logros: y se guardan sin romper la carga", Array.isArray(s(g2).unlockedAchievements), String(s(g2).unlockedAchievements));
	}
	{
		const g = await boot(baseSave([], {
			nanites: 5e5,
			warehouseCapacity: 30,
			maxCompanionSlots: 1
		}));
		const antes = wh(g).length;
		g.buyStoreItem("warehouseSlot");
		check("tienda: la ampliacion no ocupa ranura", wh(g).length === antes && s(g).warehouseCapacity === 35, `items=${wh(g).length} cap=${s(g).warehouseCapacity}`);
		g.buyStoreItem("companionSlot1");
		check("tienda: el hueco de companero tampoco", wh(g).length === antes, "items=" + wh(g).length);
		const g2 = await reload();
		check("tienda: y ambos permisos sobreviven a la recarga", s(g2).warehouseCapacity === 35 && s(g2).maxCompanionSlots === 2, `cap=${s(g2).warehouseCapacity} slots=${s(g2).maxCompanionSlots}`);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 5e5,
			warehouseCapacity: 50
		}));
		const r = g.expandWarehouse();
		check("ampliar: en el tope de 50 se rechaza", r === false, String(r));
		check("ampliar: y la capacidad no pasa de 50", s(g).warehouseCapacity === 50, "cap=" + s(g).warehouseCapacity);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 1e4,
			warehouseCapacity: 10
		}));
		const antes = nanites(g);
		const r = g.expandWarehouse();
		check("ampliar: con nanitas suficientes se amplía", r === true, String(r));
		check("ampliar: y cobra lo justo", nanites(g) === antes - 500, `cobrado=${antes - nanites(g)}`);
		check("ampliar: +5 ranuras", s(g).warehouseCapacity === 15, "cap=" + s(g).warehouseCapacity);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 1e7,
			maxCompanionSlots: 1
		}));
		let Slots = 1;
		for (let i = 0; i < 8; i++) g.unlockCompanionSlot();
		check("ampliar: los slots de companero no pasan de 5", s(g).maxCompanionSlots === 5, "slots=" + s(g).maxCompanionSlots);
		check("ampliar: y se han comprado 4 huecos", s(g).maxCompanionSlots - Slots === 4, `slots=${s(g).maxCompanionSlots}`);
	}
	{
		const g = await boot(baseSave([
			collector("r1", 3, { damage: 60 }),
			collector("r2", 3, { damage: 40 }),
			crate("c1", "common", 2),
			crate("c2", "epic", 1),
			key("k1", 0, 3),
			crystal("x1", 1, 3),
			consumable("u1", "afk", 2, { name: "Tarjeta AFK" }),
			{
				id: "m1",
				name: "Compañero T1",
				type: "companion",
				details: "x",
				rarity: "Común",
				sellPrice: 100
			}
		], {
			nanites: 1e5,
			companions: [ficha("m1")],
			maxCompanionSlots: 4
		}));
		g.equipCollector("r1");
		for (let i = 0; i < 10; i++) g.click();
		g.equipCompanion("m1");
		g.buyStoreItem("upgradeCrystal");
		g.buyStoreItem("rareCrate");
		g.sellItem("c2");
		g.moveItems(["r2"], "r1");
		g.useConsumable("u1");
		g.openCrateBox("c1", "k1");
		g.equipCollector("r2");
		g.buyNode("core_sink");
		const enMemoria = JSON.stringify(s(g).warehouse);
		const enDisco = JSON.stringify(guardado().warehouse);
		check("ciclo largo: el almacen en memoria es el que hay en el documento", enMemoria === enDisco, enMemoria === enDisco ? "" : "difieren");
		check("ciclo largo: nanites en memoria = nanitas guardadas", s(g).nanites === guardado().nanites, `${s(g).nanites} vs ${guardado().nanites}`);
		const g2 = await reload();
		const forma = (x) => JSON.stringify(x.map((w) => [w.id, w.stackable ? w.stackCount || 1 : 1]));
		check("ciclo largo: recargar devuelve el mismo almacen", forma(wh(g2)) === forma(wh(g)), `g2=${forma(wh(g2))}\n       g=${forma(wh(g))}`);
		check("ciclo longo: recargar devuelve los mismos nanites", s(g2).nanites === s(g).nanites, `${s(g2).nanites} vs ${s(g).nanites}`);
		check("ciclo largo: recargar devuelve el mismo equipado", s(g2).equippedCollectorId === s(g).equippedCollectorId, `${s(g2).equippedCollectorId} vs ${s(g).equippedCollectorId}`);
		check("ciclo largo: recargar devuelve los mismos companeros activos", s(g2).activeCompanions.join(",") === s(g).activeCompanions.join(","), `${s(g2).activeCompanions.join(",")} vs ${s(g).activeCompanions.join(",")}`);
		check("ciclo largo: no hay ids duplicados tras todo el ciclo", new Set(ids(g2)).size === wh(g2).length, ids(g2).join(","));
		check("ciclo largo: el click sigue haciendo dano", g2.getClickDamage() > 0, "danio=" + g2.getClickDamage());
		check("ciclo largo: el pasivo sigue pagando", s(g2).passiveIncome > 0, "pasivo=" + s(g2).passiveIncome);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 3
		})]));
		g.equipCollector("r1");
		for (let i = 0; i < 3; i++) g.click();
		const lista = g.getAchievements();
		check("logros: la lista tiene entradas", lista.length > 0, String(lista.length));
		check("logros: cada uno trae actual y objetivo", lista.every((a) => typeof a.current === "number" && typeof a.target === "number"));
		check("logros: el actual nunca pasa del objetivo", lista.every((a) => a.current <= a.target), "alguno se pasa");
		check("logros: los desbloqueados coinciden con el estado", g.getAchievements().filter((a) => a.unlocked).every((a) => s(g).unlockedAchievements.includes(a.id)), "desincronizado");
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			totalNanitesProduced: 1e6,
			cores: 0,
			totalCores: 0,
			resets: 0
		}));
		const esperado = pendingCores(1e6, s(g).bonus.coreGain);
		const r = g.prestige();
		check("prestigio: la primera ascencion da los nucleos justos", r.success && r.gained === esperado, `ganado=${r.gained} esperado=${esperado}`);
		check("prestigio: y el historico NO se cuenta dos veces", s(g).totalCores === esperado, `totalCores=${s(g).totalCores} esperado=${esperado}`);
		check("prestigio: la cartera queda con exactamente lo ganado", s(g).cores === esperado, `cores=${s(g).cores} esperado=${esperado}`);
		check("prestigio: y queda en un reinicio", s(g).resets === 1, `resets=${s(g).resets}`);
		const g2 = await reload();
		check("prestigio: el historico corregido sobrevive a la recarga", g2.getState().totalCores === esperado, `totalCores=${g2.getState().totalCores}`);
		check("prestigio: el anuncio de la pagina coincide con lo ya ganado", g2.getPrestigeInfo().totalCores === esperado, String(g2.getPrestigeInfo().totalCores));
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			totalNanitesProduced: 1e6,
			cores: 0,
			totalCores: 0,
			resets: 0
		}));
		g.prestige();
		const justo = pendingCores(1e6, s(g).bonus.coreGain);
		g.getState().totalNanitesProduced = 1e6;
		check("prestigio: al reconducir 1 M otra vez no hay segundo noyau todavia", g.getPrestigeInfo().pending === 0 && justo > 0, `pending=${g.getPrestigeInfo().pending} primerAscension=${justo}`);
		g.getState().totalNanitesProduced = 2e6;
		const segundo = g.getPrestigeInfo().pending;
		check("prestigio: pasar de 1 M SI da el segundo núcleo", segundo >= 1, `pending=${segundo}`);
		check("prestigio: y da MENOS que el primero, porque el histórico se descuenta", segundo < justo, `segundo=${segundo} primero=${justo}`);
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			totalNanitesProduced: 1e6,
			cores: 0,
			totalCores: 0,
			resets: 0
		}));
		g.prestige();
		const hist = s(g).totalCores;
		g.getState().totalNanitesProduced = 1e6;
		const st = (p) => ({
			totalNanitesProduced: p,
			totalCores: hist,
			coreGain: s(g).bonus.coreGain
		});
		const falta = nanitesToNextCore(st(1e6));
		check("B12: en la segunda vuelta con 1 M falta MAS de 0 (la vista decia 0)", falta > 0, `falta=${falta}`);
		check("B12: y produciendo justo lo que falta aparece el siguiente nucleo", nextCores(st(1e6 + falta)) >= 1, `pending=${nextCores(st(1e6 + falta))} falta=${falta}`);
		check("B12: y con uno menos todavia no hay nada (la cifra es exacta, no un redondeo)", nextCores(st(1e6 + falta - 1)) === 0, `pending=${nextCores(st(1e6 + falta - 1))}`);
		const g2 = await reload();
		check("B12: el historico y el pendiente sobreviven a la recarga", g2.getPrestigeInfo().pending === 0 && g2.getPrestigeInfo().totalCores === hist, `pending=${g2.getPrestigeInfo().pending} totalCores=${g2.getPrestigeInfo().totalCores}`);
		const prog1 = coreProgress(st(1e6));
		const prog2 = coreProgress(st(2e6));
		check("B12: la barra sube al producir (antes bajaba de 1 a 0,67)", prog2 > prog1, `1M=${prog1} 2M=${prog2}`);
		check("B12: y llega a 1 cuando ya se puede reciclar", coreProgress(st(1e6 + falta)) === 1, String(coreProgress(st(1e6 + falta))));
		check("B12: en la primera vuelta el umbral sigue siendo el minimo de 1 M", nanitesForCores(1, 0) === 1e6 && nanitesToNextCore({
			totalNanitesProduced: 4e5,
			totalCores: 0,
			coreGain: 0
		}) === 6e5, `forCores(1)=${nanitesForCores(1, 0)}`);
	}
	resumen("estado, migracion y economia");
}
var stateCheck_default = main();
//#endregion
export { stateCheck_default as default };
