import { C as s, S as resumen, _ as ids, a as check, d as crystal, l as consumable, n as baseSave, o as collector, r as boot, s as companion, u as crate, v as key, w as wh, x as reload } from "./kit-By6xxhWQ.js";
import { a as visibleStacksFor, r as moveItemTo, t as matchesFilter } from "./warehouse-BIb0Wey5.js";
//#region verify/filterCheck.ts
/** Los ids de las celdas, que es lo que el jugador ve y lo que se comprueba. */
var celdas = (g, filtro, sort = "default") => visibleStacksFor(g, s(g), filtro, sort).map((c) => c.item.id);
/** Los ids de TODOS los items detrás de cada celda (una pila son varios). */
var grupos = (g, filtro, sort = "default") => visibleStacksFor(g, s(g), filtro, sort).map((c) => c.ids);
async function main() {
	{
		const g = await boot(baseSave([
			collector("r1"),
			collector("r2"),
			companion("m1"),
			crate("c1"),
			key("k1"),
			crystal("x1"),
			consumable("u1", "afk")
		]));
		check("filtro Todo: deja pasar todo", celdas(g, "all").length === 7, celdas(g, "all").join(","));
		check("filtro Recolectores: solo recolectores", celdas(g, "collector").join(",") === "r1,r2", celdas(g, "collector").join(","));
		check("filtro Companeros: solo companeros", celdas(g, "companion").join(",") === "m1", celdas(g, "companion").join(","));
		check("filtro Otros: ni recolectores ni companeros", celdas(g, "otros").join(",") === "c1,k1,x1,u1", celdas(g, "otros").join(","));
		const otros = new Set(celdas(g, "collector").concat(celdas(g, "companion")));
		const todo = new Set(celdas(g, "all"));
		check("filtro: Recolectores + Companeros + Otros = Todo", otros.size + celdas(g, "otros").length === todo.size, `partes=${otros.size + celdas(g, "otros").length} todo=${todo.size}`);
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			companion("m1"),
			{
				id: "z1",
				name: "Cosa Rara",
				type: "weapon",
				details: "x",
				rarity: "Común",
				sellPrice: 1
			},
			{
				id: "z2",
				name: "Trozo",
				type: "modulo",
				details: "x",
				rarity: "Raro",
				sellPrice: 1
			}
		]));
		check("filtro Otros: un tipo desconocido SI sale", celdas(g, "otros").join(",") === "z1,z2", celdas(g, "otros").join(","));
		check("filtro: matchesFilter es la misma regla que usa la rejilla", matchesFilter({ type: "weapon" }, "otros") === true && matchesFilter({ type: "collector" }, "otros") === false);
	}
	{
		const g = await boot(baseSave([collector("r1")]));
		check("filtro sin resultados: la rejilla queda vacia", celdas(g, "companion").length === 0, celdas(g, "companion").join(","));
	}
	{
		const g = await boot(baseSave([collector("r1")]));
		check("filtro desconocido: no muestra nada en vez de mostrarlo todo", celdas(g, "filtroQueNoExiste").length === 0, celdas(g, "filtroQueNoExiste").join(","));
	}
	{
		const g = await boot(baseSave([crate("c1"), collector("r1")]));
		s(g).warehouse.push(crate("c2"));
		check("pilas: dos cajas separadas por otra cosa se aunan en una celda", celdas(g, "all").length === 2, celdas(g, "all").join(","));
		check("pilas: la celda guarda los dos ids detras", grupos(g, "all").find((gr) => gr.includes("c1"))?.join(",") === "c1,c2", JSON.stringify(grupos(g, "all")));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 5), crate("c2")]));
		const celda = visibleStacksFor(g, s(g), "all", "default").find((c) => c.item.id === "c1");
		check("pilas: el contador suma las unidades de la celda", celda.count === 6, "count=" + celda.count);
		check("pilas: tras la fusion hay un solo item detras", celda.ids.length === 1, celda.ids.join(","));
		check("pilas: y ese item lleva las 6 unidades", celda.item.stackCount === 6, "stackCount=" + celda.item.stackCount);
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 25)]));
		const celda = visibleStacksFor(g, s(g), "all", "default")[0];
		check("pilas: el contador se recorta al tope del tipo (caja=20)", celda.count === 20, "count=" + celda.count);
		check("pilas: pero el item sigue con sus unidades reales", celda.item.stackCount === 25, "stackCount=" + celda.item.stackCount);
	}
	{
		const g = await boot(baseSave([key("k1", 0, 120)]));
		const celda = visibleStacksFor(g, s(g), "all", "default")[0];
		check("pilas: el tope de llaves es 99, no 20", celda.count === 99, "count=" + celda.count);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			stackable: true,
			stackCount: 3
		}), collector("r2", 3, {
			stackable: true,
			stackCount: 3
		})]));
		check("pilas: los recolectores no se apilan aunque digan que son apilables", celdas(g, "all").length === 2, celdas(g, "all").join(","));
	}
	{
		const g = await boot(baseSave([key("k1", 0), key("k2", 1)]));
		check("pilas: dos llaves de distinto nivel no se aunan", celdas(g, "all").length === 2, celdas(g, "all").join(","));
	}
	{
		const g = await boot(baseSave([crate("c1", "common"), crate("c2", "epic")]));
		check("pilas: dos cajas de distinto tipo no se aunan", celdas(g, "all").length === 2, celdas(g, "all").join(","));
	}
	{
		const g = await boot(baseSave([
			companion("a", 1, {
				name: "Zeta",
				rarity: "Común",
				sellPrice: 100
			}),
			companion("b", 5, {
				name: "Alfa",
				rarity: "Legendario",
				sellPrice: 900
			}),
			companion("c", 3, {
				name: "Beta",
				rarity: "Épico",
				sellPrice: 400
			})
		]));
		check("orden Mi orden: respeta el orden del jugador", celdas(g, "all", "default").join(",") === "a,b,c", celdas(g, "all", "default").join(","));
		check("orden Nombre: alfabetico", celdas(g, "all", "name").join(",") === "b,c,a", celdas(g, "all", "name").join(","));
		check("orden Rareza: de la mas rara a la mas comun", celdas(g, "all", "rarity").join(",") === "b,c,a", celdas(g, "all", "rarity").join(","));
		check("orden Tier: de mayor a menor", celdas(g, "all", "tier").join(",") === "b,c,a", celdas(g, "all", "tier").join(","));
		check("orden Valor: de mayor a menor precio", celdas(g, "all", "value").join(",") === "b,c,a", celdas(g, "all", "value").join(","));
		check("orden: ordenar no toca el orden guardado", ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("r1", 9, { name: "Zeta" }),
			collector("r2", 1, { name: "Alfa" }),
			companion("m1", 3, { name: "Beta" })
		]));
		check("orden + filtro: el filtro se aplica antes de ordenar", celdas(g, "collector", "name").join(",") === "r2,r1", celdas(g, "collector", "name").join(","));
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			crate("c1"),
			collector("r2"),
			crate("c2")
		]));
		check("filtro + arrastre: la celda 0 es del filtro, no del almacen", celdas(g, "collector")[0] === "r1", celdas(g, "collector").join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		moveItemTo(g, "a", 1, "all", "default");
		check("arrastre: soltar en la celda 1 deja el item en la celda 1", ids(g).join(",") === "b,a,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = moveItemTo(g, "a", 1, "all", "default");
		check("arrastre: soltar sobre la celda de al lado SI mueve", r === true && ids(g).join(",") === "b,a,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		moveItemTo(g, "c", 0, "all", "default");
		check("arrastre: mover a la primera celda lo pone al principio", ids(g).join(",") === "c,a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		moveItemTo(g, "a", 2, "all", "default");
		check("arrastre: soltar en la ultima celda lo pone en esa celda", ids(g).join(",") === "b,c,a", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c"),
			collector("d")
		]));
		moveItemTo(g, "a", 3, "all", "default");
		check("arrastre: un salto de dos celdas cae donde se senalo", ids(g).join(",") === "b,c,d,a", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = moveItemTo(g, "a", 7, "all", "default");
		check("arrastre: soltar en un hueco del final lo manda al final", r === true && ids(g).join(",") === "b,c,a", ids(g).join(","));
	}
	{
		const items = [collector("dron"), companion("blaster")];
		for (let i = 0; i < 19; i++) items.push(key("k" + i));
		const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
		check("huecos: con una pila de 19 hay 3 celdas y 21 huecos pintados", celdas(g, "all").length === 3 && celdas(g, "all").join(",") === "dron,blaster,k0", celdas(g, "all").join(","));
		const r = moveItemTo(g, "dron", 3, "all", "default");
		check("huecos: soltar en un hueco lleva el item a la ultima celda ocupada", r === true && celdas(g, "all").join(",") === "blaster,k0,dron", celdas(g, "all").join(","));
	}
	{
		const items = [collector("dron"), companion("blaster")];
		for (let i = 0; i < 19; i++) items.push(key("k" + i));
		const g = await boot(baseSave(items, { warehouseCapacity: 21 }));
		const r = moveItemTo(g, "k0", 3, "all", "default");
		check("huecos: soltar en un hueco lo que ya esta al final no rompe nada", r === true && celdas(g, "all").join(",") === "dron,blaster,k0", celdas(g, "all").join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		const r = moveItemTo(g, "a", 0, "all", "default");
		check("arrastre: soltar sobre su propia celda no hace nada", r === false && ids(g).join(",") === "a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			crate("p1", "common", 2),
			crate("p2", "epic", 3),
			collector("z")
		]));
		const ok = moveItemTo(g, "p1", 1, "all", "default");
		check("arrastre: arrastrar una pila la mueve entera", ok === true, ids(g).join(","));
		check("arrastre: los items de la pila van juntos y en orden", ids(g).join(",") === "p2,p1,z", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			crate("p1", "common"),
			crate("p2", "epic"),
			collector("z")
		]));
		const r = moveItemTo(g, "p2", 1, "all", "default");
		check("arrastre: soltar una pila sobre su propia celda no hace nada", r === false && wh(g).length === 3, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		const r = g.moveItems(["a"], "no_existe");
		check("arrastre: un ancla inexistente se rechaza", r === false && ids(g).join(",") === "a,b", ids(g).join(","));
	}
	{
		const r = (await boot(baseSave([collector("a"), collector("b")]))).moveItems([], "a");
		check("arrastre: mover una lista vacia se rechaza", r === false, String(r));
	}
	{
		const r = (await boot(baseSave([collector("a"), collector("b")]))).moveItems(["no_existe"], null);
		check("arrastre: mover ids que no estan se rechaza", r === false, String(r));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["c", "idCaducado"], "a");
		check("arrastre: un id caducado no bloquea al resto", r === true && ids(g).join(",") === "c,a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			crate("c1", "common"),
			collector("r2"),
			crate("c2", "epic")
		]));
		moveItemTo(g, "r2", 0, "collector", "default");
		check("arrastre + filtro: el destino es una celda del filtro", ids(g).join(",") === "r2,r1,c1,c2", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("r1"),
			crate("c1"),
			collector("r2")
		]));
		const r = moveItemTo(g, "c1", 0, "collector", "default");
		check("arrastre + filtro: un item oculto por el filtro no se mueve", r === false && ids(g).join(",") === "r1,c1,r2", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("barato", 1, { sellPrice: 10 }), collector("caro", 9, { sellPrice: 999 })]));
		const ordenValor = celdas(g, "all", "value");
		check("arrastre + orden: las celdas son las del orden activo", ordenValor.join(",") === "caro,barato", ordenValor.join(","));
		moveItemTo(g, "barato", 0, "all", "value");
		check("arrastre + orden: el item se coloca donde se senalo", ids(g).join(",") === "barato,caro", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		moveItemTo(g, "c", 0, "all", "default");
		const g2 = await reload();
		check("arrastre: el nuevo orden sobrevive a la recarga", ids(g2).join(",") === "c,a,b", ids(g2).join(","));
		check("arrastre: y no se pierde ningun item al guardar", wh(g2).length === 3, ids(g2).join(","));
	}
	{
		const items = [
			collector("a"),
			crate("c1"),
			key("k1")
		];
		const g = await boot(baseSave(items, { nanites: 5e3 }));
		const antes = JSON.stringify({
			n: s(g).nanites,
			k: s(g).keys,
			c: s(g).crates.common
		});
		moveItemTo(g, "a", 2, "all", "default");
		const despues = JSON.stringify({
			n: s(g).nanites,
			k: s(g).keys,
			c: s(g).crates.common
		});
		check("arrastre: no toca nanitas ni contadores", antes === despues, despues);
	}
	{
		const g = await boot(baseSave([
			crate("c1", "common"),
			crate("c2", "epic"),
			collector("r1"),
			collector("r2")
		]));
		check("venta: antes hay 4 celdas", celdas(g, "all").length === 4, celdas(g, "all").join(","));
		g.sellItem("c1");
		check("venta: tras vender una caja su celda desaparece", celdas(g, "all").length === 3, celdas(g, "all").join(","));
		g.sellItem("c2");
		check("venta: tras vender la otra tambien", celdas(g, "all").length === 2, celdas(g, "all").join(","));
		check("venta: y la rejilla no inventa ids que no estan", new Set(celdas(g, "all")).size === new Set(ids(g)).size, `${celdas(g, "all").join(",")} / ${ids(g).join(",")}`);
	}
	{
		const g = await boot(baseSave([
			crate("p1", "common", 4),
			collector("r1"),
			collector("r2")
		]));
		check("venta: una pila es una celda", celdas(g, "all").length === 3, celdas(g, "all").join(","));
		g.sellItem("p1");
		check("venta: vender la pila quita su celda entera", celdas(g, "all").length === 2, celdas(g, "all").join(","));
		check("venta: y no queda ningun id fantasma", new Set(celdas(g, "all")).size === new Set(ids(g)).size, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			companion("m1"),
			companion("m2"),
			collector("r1"),
			collector("r2")
		]));
		check("venta + filtro: el filtro companeros tiene 2 celdas", celdas(g, "companion").length === 2, celdas(g, "companion").join(","));
		g.sellItem("m1");
		check("venta + filtro: tras vender queda 1 celda", celdas(g, "companion").length === 1, celdas(g, "companion").join(","));
		const r = moveItemTo(g, "r1", 5, "companion", "default");
		check("venta + filtro: con un filtro corto no se mueve un item oculto", r === false && ids(g).join(",") === "m2,r1,r2", ids(g).join(","));
		const r2 = moveItemTo(g, "m2", 4, "companion", "default");
		check("venta + filtro: el item del filtro activo si se mueve a un hueco", r2 === true && ids(g).join(",") === "r1,r2,m2", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		g.sellItem("r1");
		check("venta: un almacen con un item da una celda", celdas(g, "all").length === 1, celdas(g, "all").join(","));
		check("venta: mover la ultima celda a un hueco la manda al final (no hay nada que mover)", moveItemTo(g, "r2", 0, "all", "default") === false, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([]));
		check("vacio: sin items hay cero celdas", celdas(g, "all").length === 0, celdas(g, "all").join(","));
		check("vacio: y mover en un almacen vacio se rechaza sin error", moveItemTo(g, "lo_que_sea", 0, "all", "default") === false);
	}
	resumen("filtros y rejilla");
}
var filterCheck_default = main();
//#endregion
export { filterCheck_default as default };
