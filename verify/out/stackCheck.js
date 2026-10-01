import { a as isStackable, i as countOccupiedSlots, o as mergeStacks, s as stackUnits } from "./gameLoop-DA2943Xb.js";
import { C as s, S as resumen, _ as ids, a as check, d as crystal, i as bootNew, l as consumable, n as baseSave, o as collector, r as boot, u as crate, v as key, w as wh, x as reload, y as nanites } from "./kit-By6xxhWQ.js";
import { a as visibleStacksFor } from "./warehouse-BIb0Wey5.js";
//#region verify/stackCheck.ts
/** Cuántas celdas pinta la rejilla, que es lo que el jugador ve. */
var celdas = (g) => visibleStacksFor(g, s(g), "all", "default");
/** Cuántas unidades de un tipo hay, sin importar cuántas pilas las guarden. */
var unidades = (g, type) => wh(g).filter((w) => w.type === type).reduce((a, w) => a + stackUnits(w), 0);
async function main() {
	{
		const uno = key("k1", 0, 19);
		const otro = key("k2", 0, 4);
		const r = mergeStacks([uno, otro]);
		check("apilado: dos pilas de la misma llave se funden en una", r.items.length === 1, String(r.items.length));
		check("apilado: y las unidades se suman, no se pierden", r.items[0].stackCount === 23, "stackCount=" + r.items[0].stackCount);
		check("apilado: se conserva el id del primero", r.items[0].id === "k1", r.items[0].id);
		check("apilado: y se avisa de que se ha tocado", r.changed === true);
	}
	{
		const r = mergeStacks([key("k1", 0, 5), {
			id: "k2",
			name: "Llave de Cifrado",
			type: "key",
			stackable: true
		}]);
		check("apilado: un item sin stackCount cuenta como una unidad", r.items.length === 1 && r.items[0].stackCount === 6, `items=${r.items.length} stack=${r.items[0]?.stackCount}`);
	}
	{
		const r = mergeStacks([key("k1", 0, 3), key("k2", 1, 3)]);
		check("apilado: dos llaves de distinto nivel NO se funden", r.items.length === 2, String(r.items.length));
	}
	{
		const r = mergeStacks([collector("r1", 3, {
			stackable: true,
			stackCount: 3
		}), collector("r2", 3, {
			stackable: true,
			stackCount: 3
		})]);
		check("apilado: los recolectores no se funden nunca", r.items.length === 2, String(r.items.length));
	}
	{
		const r = mergeStacks([collector("r1")]);
		check("apilado: un item que no es apilable se queda sin stackCount", r.items[0].stackCount === void 0, String(r.items[0].stackCount));
		check("apilado: y se avisa de que no se ha tocado nada", r.changed === false);
	}
	check("apilado: una llave es apilable", isStackable(key("k1", 0, 1)) === true);
	check("apilado: un recolector no lo es", isStackable(collector("r1")) === false);
	{
		const items = [
			collector("r1"),
			crate("c1", "common", 3),
			crate("c2"),
			key("k1", 0, 19),
			crystal("x1", 1, 7)
		];
		check("ranuras: 3 cajas y 19 llaves son 2 ranuras, no 22", countOccupiedSlots(items) === 4, String(countOccupiedSlots(items)));
	}
	{
		const g = await boot(baseSave([collector("r1")], { nanites: 1e7 }));
		for (let i = 0; i < 19; i++) g.buyStoreItem("keyT0");
		const pilas = wh(g).filter((w) => w.type === "key");
		check("tienda: 19 llaves compradas son 19 unidades", unidades(g, "key") === 19, String(unidades(g, "key")));
		check("tienda: y están en UNA sola pila", pilas.length === 1, `pilas=${pilas.length}`);
		check("tienda: la pila lleva las 19 dentro", pilas[0]?.stackCount === 19, String(pilas[0]?.stackCount));
		check("tienda: y no se ha gastado ni una ranura más", countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
		check("tienda: el contador de llaves cuadra", s(g).keys === 19, String(s(g).keys));
	}
	{
		const relleno = Array.from({ length: 9 }, (_, i) => crate(`c${i}`, "common", 1, { name: `Caja Común ${i}` }));
		const g = await boot(baseSave([
			collector("r1"),
			...relleno,
			key("k1", 0, 1)
		], {
			warehouseCapacity: 11,
			nanites: 0
		}));
		const antes = countOccupiedSlots(wh(g));
		check("cajas: el almacen de prueba esta lleno", antes === g.getCapacity(), `ranuras=${antes} cap=${g.getCapacity()}`);
		const r = g.openCrateBox("c0", "k1");
		check("cajas: con el almacen lleno la caja se abre igualmente", r.ok, r.msg ?? "");
		check("cajas: y el almacen no se desborda", countOccupiedSlots(wh(g)) <= g.getCapacity(), `ranuras=${countOccupiedSlots(wh(g))} cap=${g.getCapacity()}`);
	}
	{
		const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
		const g = await boot(baseSave([collector("r1"), ...sueltos], {
			keys: 19,
			keysByTier: {
				0: 19,
				1: 0,
				2: 0,
				3: 0
			}
		}));
		const llaves = wh(g).filter((w) => w.type === "key");
		check("migracion: 19 llaves guardadas por separado se vuelven una pila", llaves.length === 1, `pilas=${llaves.length}`);
		check("migracion: y las 19 unidades siguen ahi", llaves[0]?.stackCount === 19, String(llaves[0]?.stackCount));
		check("migracion: no se pierde ni una unidad", unidades(g, "key") === 19, String(unidades(g, "key")));
		check("migracion: el contador de llaves no cambia", s(g).keys === 19, String(s(g).keys));
		check("migracion: y el almacen ocupa una ranura menos", countOccupiedSlots(wh(g)) === 2, String(countOccupiedSlots(wh(g))));
	}
	{
		const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
		await boot(baseSave([collector("r1"), ...sueltos], {
			keys: 19,
			keysByTier: {
				0: 19,
				1: 0,
				2: 0,
				3: 0
			}
		}));
		const g2 = await reload();
		const llaves = wh(g2).filter((w) => w.type === "key");
		check("migracion: la fusion se guarda", llaves.length === 1, `pilas=${llaves.length}`);
		check("migracion: y no se vuelve a partir en 19 al recargar", llaves[0]?.stackCount === 19, String(llaves[0]?.stackCount));
	}
	{
		const g = await bootNew();
		const cajas = wh(g).filter((w) => w.type === "crate");
		check("partida nueva: las 2 cajas de bienvenida son UNA pila", cajas.length === 1, `pilas=${cajas.length}`);
		check("partida nueva: con las 2 unidades dentro", cajas[0]?.stackCount === 2, String(cajas[0]?.stackCount));
		check("partida nueva: y el contador de cajas sigue a 2", s(g).crates.common === 2, String(s(g).crates.common));
	}
	{
		const items = [
			collector("r1"),
			collector("r2"),
			crate("c1", "common", 4),
			crate("c2", "common", 2),
			crate("c3", "epic"),
			key("k1", 0, 19),
			key("k2", 1, 3),
			crystal("x1", 1, 8),
			consumable("u1", "afk", 2),
			consumable("u2", "clickBoost", 1)
		];
		const g = await boot(baseSave(items));
		check("cuadra: el contador de ranuras coincide con las celdas pintadas", countOccupiedSlots(wh(g)) === celdas(g).length, `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
	}
	{
		const g = await boot(baseSave([collector("r1")], { nanites: 1e7 }));
		g.buyStoreItem("keyT0");
		g.buyStoreItem("keyT0");
		g.buyStoreItem("upgradeCrystal");
		g.buyStoreItem("commonCrate");
		g.buyStoreItem("commonCrate");
		g.buyStoreItem("afkCard");
		g.openCrateBox(wh(g).find((w) => w.type === "crate").id, wh(g).find((w) => w.type === "key").id);
		check("cuadra: sigue cuadrando despues de comprar y abrir", countOccupiedSlots(wh(g)) === celdas(g).length, `contador=${countOccupiedSlots(wh(g))} celdas=${celdas(g).length}`);
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			key("k1", 0, 19),
			crate("c1")
		]));
		check("cuadra: el contador no depende del filtro", countOccupiedSlots(wh(g)) === 3, String(countOccupiedSlots(wh(g))));
	}
	{
		const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
		const g = await boot(baseSave([
			...lleno,
			crate("c1", "common", 1),
			key("k1", 0, 1)
		], {
			warehouseCapacity: 6,
			nanites: 1e7
		}));
		check("lleno: el almacen esta lleno", countOccupiedSlots(wh(g)) === g.getCapacity(), `${countOccupiedSlots(wh(g))}/${g.getCapacity()}`);
		const r = g.buyStoreItem("commonCrate");
		check("lleno: una caja mas se compra igual (deja de ocupar ranura nueva)", r !== false, String(r));
		check("lleno: y se suma a la pila de cajas, sin gastar ranura", countOccupiedSlots(wh(g)) === g.getCapacity() && wh(g).find((w) => w.type === "crate")?.stackCount === 2, `ranuras=${countOccupiedSlots(wh(g))} pila=${wh(g).find((w) => w.type === "crate")?.stackCount}`);
		const g2 = await boot(baseSave([
			...lleno,
			crate("c1", "common", 1),
			key("k1", 0, 1)
		], {
			warehouseCapacity: 6,
			nanites: 1e7
		}));
		const antes = nanites(g2);
		const r2 = g2.buyStoreItem("companionCardT1");
		check("lleno: y un item que si ocupa ranura se rechaza", r2 === false, String(r2));
		check("lleno: sin cobrar por encima", nanites(g2) === antes, `${antes} -> ${nanites(g2)}`);
	}
	{
		const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
		const g = await boot(baseSave([
			...lleno,
			crate("c1", "common", 1),
			key("k1", 0, 1)
		], {
			warehouseCapacity: 6,
			nanites: 1e7
		}));
		check("tienda: con el almacen lleno, una caja SÍ cabe (se suma a su pila)", g.canBuyStoreItem("commonCrate") === true, String(g.canBuyStoreItem("commonCrate")));
		check("tienda: y comprar una caja funciona de verdad", g.buyStoreItem("commonCrate") !== false, "rechazada");
		check("tienda: con el almacen lleno, una carta de compañero NO cabe", g.canBuyStoreItem("companionCardT1") === false, String(g.canBuyStoreItem("companionCardT1")));
		check("tienda: y comprarla falla de verdad", g.buyStoreItem("companionCardT1") === false, "aceptada");
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			warehouseCapacity: 30,
			nanites: 1e7
		}));
		for (const k of [
			"keyT0",
			"upgradeCrystal",
			"commonCrate",
			"afkCard",
			"companionCardT1",
			"collectorCardT1"
		]) if (g.canBuyStoreItem(k) === false) check(`tienda: ${k} se puede comprar con el almacen vacio`, false, "dice que no cabe");
		check("tienda: con el almacen vacio, todo se puede comprar", true);
	}
	{
		const lleno = Array.from({ length: 4 }, (_, i) => collector(`r${i}`));
		const g = await boot(baseSave([
			...lleno,
			crate("c1", "common", 1),
			key("k1", 0, 1)
		], {
			warehouseCapacity: 6,
			maxCompanionSlots: 1,
			nanites: 1e7
		}));
		check("tienda: ampliar el almacen funciona con el almacen lleno", g.canBuyStoreItem("warehouseSlot") === true && g.buyStoreItem("warehouseSlot") !== false);
		check("tienda: y anadir un hueco de companero tambien", g.canBuyStoreItem("companionSlot1") === true && g.buyStoreItem("companionSlot1") !== false);
	}
	await boot(baseSave([collector("r1")], {
		warehouseCapacity: 30,
		nanites: 1e7
	}));
	for (const k of [
		"keyT0",
		"keyT1",
		"keyT2",
		"keyT3",
		"upgradeCrystal"
	]) {
		const gk = await boot(baseSave([collector("r1")], { nanites: 1e7 }));
		gk.buyStoreItem(k);
		gk.buyStoreItem(k);
		const tipo = k.startsWith("key") ? "key" : "crystal";
		const pilas = wh(gk).filter((w) => w.type === tipo);
		check(`tienda: dos "${k}" caen en UNA pila, no en dos`, pilas.length === 1, `pilas=${pilas.length} (${pilas.map((w) => w.name).join(" | ")})`);
		check(`tienda: y la pila lleva las 2 unidades`, pilas[0]?.stackCount === 2, `stackCount=${pilas[0]?.stackCount}`);
		check(`tienda: las dos unidades son del mismo nivel`, new Set(pilas.map((w) => w.tier)).size === 1, `niveles=${[...new Set(pilas.map((w) => w.tier))].join(",")}`);
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			warehouseCapacity: 30,
			nanites: 1e7
		}));
		g.buyStoreItem("keyT0");
		const nombrePila = wh(g).find((w) => w.type === "key")?.name;
		const rellenos = Array.from({ length: 40 }, (_, i) => collector(`x${i}`, 1, { name: `Relleno ${i}` }));
		for (const w of rellenos) {
			if (countOccupiedSlots(wh(g)) >= g.getCapacity()) break;
			g.buyStoreItem("collectorCardT1");
		}
		const g2 = await boot(baseSave([
			collector("r1"),
			{
				id: "k0",
				name: nombrePila,
				type: "key",
				details: "x",
				rarity: "Común",
				tier: 0,
				sellPrice: 480,
				stackable: true,
				stackCount: 3
			},
			...rellenos.slice(0, 20).map((w, i) => ({
				...w,
				id: `x${i}`
			}))
		], {
			warehouseCapacity: 22,
			keys: 3,
			keysByTier: {
				0: 3,
				1: 0,
				2: 0,
				3: 0
			},
			nanites: 1e7
		}));
		const ocupada = countOccupiedSlots(wh(g2));
		check("tienda: el almacen de la prueba esta lleno", ocupada === g2.getCapacity(), `${ocupada}/${g2.getCapacity()}`);
		check("tienda: con el almacen lleno, la llave SÍ cabe (es su propia pila)", g2.canBuyStoreItem("keyT0") === true, String(g2.canBuyStoreItem("keyT0")));
		const r = g2.buyStoreItem("keyT0");
		const k = wh(g2).find((w) => w.type === "key");
		check("tienda: y la compra va con ella en vez de fallar", r !== false && k?.stackCount === 4, `ok=${r !== false} pila=${k?.stackCount}`);
		check("tienda: sin gastar una ranura nueva", countOccupiedSlots(wh(g2)) === g2.getCapacity(), `${countOccupiedSlots(wh(g2))}/${g2.getCapacity()}`);
	}
	{
		const sueltos = Array.from({ length: 19 }, (_, i) => key(`k${i}`, 0, 1));
		const g = await boot(baseSave([
			collector("r1"),
			collector("r2"),
			...sueltos
		], {
			keys: 19,
			keysByTier: {
				0: 19,
				1: 0,
				2: 0,
				3: 0
			},
			nanites: 0
		}));
		const pila = wh(g).find((w) => w.type === "key");
		const antes = nanites(g);
		const r = g.sellItem(pila.id);
		check("vender: una pila fusionada se vende entera", r.ok && pila.id, r.msg ?? "");
		check("vender: y cobra las 19 unidades, no una", nanites(g) === antes + 19 * pila.sellPrice, `${antes} -> ${nanites(g)}`);
		check("vender: la pila desaparece del almacen", !wh(g).some((w) => w.type === "key"), ids(g).join(","));
	}
	{
		const sueltos = Array.from({ length: 3 }, (_, i) => consumable(`u${i}`, "afk", 1));
		const g = await boot(baseSave([
			collector("r1"),
			collector("r2"),
			...sueltos
		], { afkCards: 3 }));
		const pila = wh(g).find((w) => w.type === "consumable");
		check("gastar: las tarjetas se funden en una pila", pila?.stackCount === 3, String(pila?.stackCount));
		check("gastar: y el contador de AFK las ve las tres", s(g).afkCards === 3, String(s(g).afkCards));
		const r = g.useConsumable(pila.id);
		check("gastar: usar una gasta UNA unidad de la pila", r.ok, r.msg ?? "");
		check("gastar: y la pila queda en 2", wh(g).find((w) => w.id === pila.id)?.stackCount === 2, String(wh(g).find((w) => w.id === pila.id)?.stackCount));
	}
	resumen("apilado");
}
var stackCheck_default = main();
//#endregion
export { stackCheck_default as default };
