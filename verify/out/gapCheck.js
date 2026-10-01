import { C as s, S as resumen, _ as ids, a as check, g as guardado, n as baseSave, o as collector, r as boot, s as companion, u as crate, v as key, w as wh, x as reload } from "./kit-By6xxhWQ.js";
import { a as visibleStacksFor, i as moveToFreeCell, n as moveIntoGap, r as moveItemTo } from "./warehouse-BIb0Wey5.js";
//#region verify/gapCheck.ts
/** Los huecos tal y como los guarda el juego. */
var huecos = (g) => g.getWarehouseGaps?.() ?? [];
/**
* La rejilla como la ve el jugador, con `·` delante del item que lleva hueco.
*
* Reimplementa aquí el mismo criterio que el pintor —un hueco va justo antes de
* su ancla— a propósito: si el banco usara la función del pintor no
* comprobaría nada, porque una prueba que llama a la implementación que quiere
* verificar pasa justo cuando la implementación está mal.
*/
var rejilla = (g, filtro = "all", sort = "default") => {
	const celdas = visibleStacksFor(g, s(g), filtro, sort);
	const cuenta = /* @__PURE__ */ new Map();
	if (filtro === "all" && sort === "default") for (const id of huecos(g)) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
	const out = [];
	for (const c of celdas) {
		for (let h = 0; h < (cuenta.get(c.item.id) ?? 0); h++) out.push("·");
		out.push(c.item.id);
	}
	return out;
};
async function main() {
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		check("huecos: nace sin huecos", huecos(g).length === 0, huecos(g).join(","));
		check("huecos: y la rejilla no tiene ninguno", rejilla(g).join(",") === "a,b,c", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["c"]);
		check("huecos: uno antes de c se pinta en su sitio", rejilla(g).join(",") === "a,b,·,c", rejilla(g).join(","));
		check("huecos: y no toca el almacen", ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps([
			"a",
			"b",
			"c"
		]);
		check("huecos: tres huecos no crean items", wh(g).length === 3, String(wh(g).length));
		check("huecos: y la rejilla es un hueco por celda", rejilla(g).join(",") === "·,a,·,b,·,c", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["c"]);
		const r = moveIntoGap(g, "a", "c", "all", "default");
		check("hueco: soltar dentro de un hueco se acepta", r === true, String(r));
		check("hueco: el item entra justo antes del ancla", ids(g).join(",") === "b,a,c", ids(g).join(","));
		check("hueco: y el hueco se queda donde estaba el item", huecos(g).join(",") === "b", huecos(g).join(","));
		check("hueco: la rejilla lo cuenta como un hueco antes de b", rejilla(g).join(",") === "·,b,a,c", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c"),
			collector("d")
		]));
		g.setWarehouseGaps(["c"]);
		const r = moveIntoGap(g, "a", "c", "all", "default");
		check("hueco: arrastrar no crea ni destruye huecos", r === true && huecos(g).length === 1, `${r} ${huecos(g).join(",")}`);
		check("hueco: el hueco se reancla donde estaba el item", huecos(g).join(",") === "b", huecos(g).join(","));
		check("hueco: el item entra en el hueco", ids(g).join(",") === "b,a,c,d", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["b"]);
		const r = moveIntoGap(g, "c", "b", "all", "default");
		check("hueco: si el item es el ultimo, el hueco nuevo no necesita ancla", r === true && huecos(g).length === 0, `${r} ${huecos(g).join(",")}`);
		check("hueco: y el item entra igualmente en el hueco", ids(g).join(",") === "a,c,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["b"]);
		const r = moveIntoGap(g, "a", "b", "all", "default");
		check("hueco: soltar justo delante del hueco no hace nada", r === false && ids(g).join(",") === "a,b,c" && huecos(g).join(",") === "b", `${r} ${ids(g).join(",")} ${huecos(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		g.setWarehouseGaps(["a"]);
		const r = moveIntoGap(g, "a", "a", "all", "default");
		check("hueco: soltar dentro del hueco que precede al propio item se rechaza", r === false && ids(g).join(",") === "a,b", String(r));
	}
	{
		const items = [
			collector("a"),
			collector("b"),
			crate("p1", "common", 3),
			crate("p2", "common", 2),
			key("k1", 0, 7),
			companion("m1")
		];
		const g = await boot(baseSave(items));
		const original = new Set(ids(g));
		g.setWarehouseGaps(["p1", "m1"]);
		for (let k = 0; k < 12; k++) {
			const celdas = visibleStacksFor(g, s(g), "all", "default");
			const celda = celdas[k % celdas.length];
			const siguiente = celdas[(k + 2) % celdas.length];
			if (celda.item.id === siguiente.item.id) continue;
			if (k % 2 === 0) moveIntoGap(g, celda.item.id, siguiente.item.id, "all", "default");
			else moveItemTo(g, celda.item.id, (k + 2) % celdas.length, "all", "default");
		}
		const final = ids(g);
		check("cadena: no se pierde ningun item", new Set(final).size === original.size, `${new Set(final).size} de ${original.size}`);
		check("cadena: no aparece ningun item nuevo", [...final].every((id) => original.has(id)), final.join(","));
		check("cadena: y todos los huecos apuntan a items que existen", huecos(g).every((id) => final.includes(id)), huecos(g).join(","));
	}
	{
		const items = Array.from({ length: 10 }, (_, i) => collector("c" + i));
		const g = await boot(baseSave(items, {
			warehouseCapacity: 10,
			nanites: 5e3
		}));
		g.setWarehouseGaps(["c0", "c5"]);
		check("capacidad: los huecos no cuentan como ranura", wh(g).length === 10 && g.getCapacity() === 10, `${wh(g).length}/${g.getCapacity()}`);
		const r = g.buyStoreItem("collectorCardT1");
		check("capacidad: con el almacen lleno y huecos, la compra se rechaza igual", r === false, JSON.stringify(r));
	}
	{
		const items = Array.from({ length: 9 }, (_, i) => collector("c" + i));
		const g = await boot(baseSave(items, {
			warehouseCapacity: 10,
			nanites: 5e3
		}));
		g.setWarehouseGaps(["c0"]);
		const r = g.buyStoreItem("collectorCardT1");
		check("capacidad: y con hueco de sobra la compra SI entra", !!r && wh(g).length === 10, `${JSON.stringify(r)} ${wh(g).length}`);
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c"),
			collector("d")
		]));
		g.setWarehouseGaps(["b"]);
		g.sellItem("b");
		check("higiene: vender el ancla de un hueco lo borra", huecos(g).length === 0, huecos(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			crate("p1", "common", 2),
			collector("c")
		]));
		g.setWarehouseGaps(["b", "p1"]);
		g.sellItem("p1");
		check("higiene: solo se borra el hueco que se queda sin ancla", huecos(g).join(",") === "b", huecos(g).join(","));
	}
	{
		await boot(baseSave([collector("a")]));
		const doc = guardado();
		doc.warehouseGaps = ["no_existe", "a"];
		const g2 = await reload();
		check("higiene: al cargar se descartan los huecos colgantes", huecos(g2).join(",") === "a", huecos(g2).join(","));
	}
	{
		await boot(baseSave([collector("a"), collector("b")]));
		const doc = guardado();
		delete doc.warehouseGaps;
		const g2 = await reload();
		check("higiene: sin el campo, cero huecos y cero problemas", huecos(g2).length === 0 && ids(g2).join(",") === "a,b", huecos(g2).join(","));
		const doc2 = guardado();
		doc2.warehouseGaps = "esto no es una lista";
		const g3 = await reload();
		check("higiene: y con basura en el campo tambien cero huecos", huecos(g3).length === 0, huecos(g3).join(","));
	}
	{
		(await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]))).setWarehouseGaps(["b"]);
		const g2 = await reload();
		check("guardar: los huecos sobreviven a recargar", huecos(g2).join(",") === "b", huecos(g2).join(","));
		check("guardar: y el almacen sigue igual", ids(g2).join(",") === "a,b,c", ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["b"]);
		moveItemTo(g, "b", 0, "all", "default");
		check("guardar: el hueco sigue pegado a su item aunque se mueva", huecos(g).join(",") === "b" && ids(g).join(",") === "b,a,c", `${huecos(g).join(",")} ${ids(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("d"),
			collector("b"),
			collector("e")
		]));
		g.setWarehouseGaps(["b"]);
		check("filtro: con filtro activo no se pintan huecos", rejilla(g, "collector").join(",") === "a,d,b,e", rejilla(g, "collector").join(","));
		check("filtro: pero siguen guardados", huecos(g).join(",") === "b", huecos(g).join(","));
		check("filtro: y con el filtro Todo vuelven a verse", rejilla(g, "all").join(",") === "a,d,·,b,e", rejilla(g, "all").join(","));
	}
	{
		const g = await boot(baseSave([collector("a", 1), collector("b", 9)]));
		g.setWarehouseGaps(["a"]);
		check("orden: con un orden activo no se pintan huecos", rejilla(g, "all", "tier").join(",") === "b,a", rejilla(g, "all", "tier").join(","));
		check("orden: y con \"Mi orden\" vuelven a verse", rejilla(g, "all", "default").join(",") === "·,a,b", rejilla(g, "all", "default").join(","));
	}
	{
		const items = [collector("dron"), collector("blaster")];
		for (let i = 0; i < 19; i++) items.push(key("k" + i));
		const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
		check("mockup: el almacen con 19 llaves da 3 celdas", visibleStacksFor(g, s(g), "all", "default").length === 3, ids(g).join(","));
		g.setWarehouseGaps(["dron"]);
		check("mockup: el hueco delante del dron se ve en la rejilla", rejilla(g).join(",") === "·,dron,blaster,k0", rejilla(g).join(","));
		g.setWarehouseGaps(["k0"]);
		const r = moveIntoGap(g, "dron", "k0", "all", "default");
		check("mockup: soltar dentro del hueco mete el item ahi", r === true && ids(g).join(",") === "blaster,dron,k0", ids(g).join(","));
		check("mockup: y el hueco se queda donde estaba el dron", huecos(g).join(",") === "blaster", huecos(g).join(","));
		check("mockup: la rejilla lo enseña como hueco antes del blaster", rejilla(g).join(",") === "·,blaster,dron,k0", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		]));
		const r = moveToFreeCell(g, "dron", 3, "all", "default");
		check("vacia: soltar en la primera celda vacia se acepta", r === true, String(r));
		check("vacia: el item se va al final del almacen", ids(g).join(",") === "blaster,k1,dron", ids(g).join(","));
		check("vacia: hace falta UNA celda de hueco", huecos(g).length === 1, huecos(g).join(","));
		check("vacia: el item cae en la posicion SENALADA, no en la de al lado", rejilla(g).indexOf("dron") === 3, rejilla(g).join(",") + " senalada 3");
		check("vacia: y los demas items NO se mueven de sitio", rejilla(g).slice(0, 2).join(",") === "blaster,k1", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		]));
		const r = moveToFreeCell(g, "dron", 5, "all", "default");
		check("vacia: soltar en la celda 5 se acepta", r === true, String(r));
		check("vacia: hacen falta 3 celdas de hueco", huecos(g).length === 3, huecos(g).join(","));
		check("vacia: y el item cae en la 5, exacta", rejilla(g).join(",") === "blaster,k1,·,·,·,dron", rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("blaster"),
			collector("k1"),
			collector("dron")
		]));
		const r = moveToFreeCell(g, "dron", 5, "all", "default");
		check("vacia: el ULTIMO item tambien se mueve a una celda vacia", r === true && rejilla(g).indexOf("dron") === 5, r + " " + rejilla(g).join(","));
		check("vacia: y no se reordena nada, que ya estaba al final", ids(g).join(",") === "blaster,k1,dron", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		]));
		const r = moveToFreeCell(g, "dron", 9, "all", "default");
		check("vacia: la celda 9 se alcanza con 3 items", r === true && rejilla(g).indexOf("dron") === 9, r + " " + rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		], { warehouseCapacity: 21 }));
		const r = moveToFreeCell(g, "dron", 40, "all", "default");
		check("vacia: mas alla de la ultima celda se recorta, no se inventa", r === true && rejilla(g).indexOf("dron") === 20, r + " " + rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("dron")]));
		const r = moveToFreeCell(g, "dron", 2, "all", "default");
		check("vacia: la celda libre de al lado tambien es un destino", r === true && rejilla(g).join(",") === "a,·,dron", `${r} ${rejilla(g).join(",")}`);
		check("vacia: y el almacen no se toca, solo la disposicion", ids(g).join(",") === "a,dron", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			crate("c1"),
			collector("b")
		]));
		const r = moveToFreeCell(g, "c1", 5, "collector", "default");
		check("vacia: con un filtro activo no se mueve un item oculto", r === false && ids(g).join(",") === "a,c1,b", r + " " + ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.setWarehouseGaps(["a"]);
		const r = moveToFreeCell(g, "c", 5, "all", "default");
		check("vacia: el hueco previo sobrevive intacto", r === true && huecos(g).filter((id) => id === "a").length === 1, huecos(g).join(","));
		check("vacia: y el item cae igualmente en la senalada", rejilla(g).indexOf("c") === 5, rejilla(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		], { warehouseCapacity: 21 }));
		const r = moveToFreeCell(g, "dron", 17, "all", "default");
		check("tablero: con 3 celdas y 18 libres se llega a la celda 17", r === true && rejilla(g).indexOf("dron") === 17, `${r} ${rejilla(g).join(",")}`);
		check("tablero: y los otros dos items no se mueven de sitio", rejilla(g).slice(0, 2).join(",") === "blaster,k1", rejilla(g).join(","));
		check("tablero: hacen falta 15 celdas de hueco, y caben", huecos(g).length === 15, huecos(g).length.toString());
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		], { warehouseCapacity: 21 }));
		const r = moveToFreeCell(g, "k1", 17, "all", "default");
		check("tablero: el ULTIMO item tambien llega a la celda 17", r === true && rejilla(g).indexOf("k1") === 17, `${r} ${rejilla(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([
			collector("dron"),
			collector("blaster"),
			collector("k1")
		], { warehouseCapacity: 21 }));
		moveToFreeCell(g, "dron", 17, "all", "default");
		const r = moveToFreeCell(g, "k1", 40, "all", "default");
		check("tablero: mas alla de la ultima celda se recorta, no se inventa", r === true && rejilla(g).indexOf("k1") === 20, `${r} ${rejilla(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")], { warehouseCapacity: 12 }));
		g.setWarehouseGaps(new Array(250).fill("a"));
		check("guardado: un numero disparatado de huecos se recorta", huecos(g).length === 200, huecos(g).length.toString());
		check("guardado: y ningun item desaparece por ello", ids(g).join(",") === "a,b", ids(g).join(","));
	}
	resumen("huecos del almacen");
}
var gapCheck_default = main();
//#endregion
export { gapCheck_default as default };
