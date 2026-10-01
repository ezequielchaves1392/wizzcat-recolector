import { C as s, S as resumen, _ as ids, a as check, d as crystal, h as find, l as consumable, m as ficha, n as baseSave, o as collector, r as boot, s as companion, u as crate, v as key, w as wh, x as reload } from "./kit-By6xxhWQ.js";
//#region verify/moveCheck.ts
async function main() {
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["c"], "a");
		check("mover: acepta un item suelto", r === true, String(r));
		check("mover: por defecto lo pone justo delante del ancla", ids(g).join(",") === "c,a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.moveItems(["a"], "b");
		check("mover: un item que ya esta delante del ancla se queda", ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.moveItems(["a"], "c", "despues");
		check("mover: en medio queda el bloque detrás del ancla", ids(g).join(",") === "b,c,a", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.moveItems(["a"], "b", "despues");
		check("mover: cae en la celda señalada y no en la de al lado", ids(g).join(",") === "b,a,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.moveItems(["c"], "a", "antes");
		check("mover: hacia la izquierda cae en la celda señalada", ids(g).join(",") === "c,a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["a"], "b", "despues");
		check("mover: soltar sobre la celda de al lado SI cambia el orden", r === true && ids(g).join(",") === "b,a,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		g.moveItems(["a"], "c", "despues");
		check("mover: a un salto largo cae en la celda exacta", ids(g).indexOf("a") === 2, ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["a"], null);
		check("mover: con ancla null va al final", r === true && ids(g).join(",") === "b,c,a", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["c"], null);
		check("mover: un item que ya esta al final se queda", r === true && ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("z"),
			collector("p1"),
			collector("p2"),
			collector("p3")
		]));
		g.moveItems([
			"p1",
			"p2",
			"p3"
		], "z");
		check("mover: un bloque conserva su orden interno", ids(g).join(",") === "p1,p2,p3,z", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("z"),
			collector("a"),
			collector("m"),
			collector("b")
		]));
		g.moveItems(["a", "b"], "z");
		check("mover: el bloque queda junto, sin entremezclar", ids(g).join(",") === "a,b,z,m", ids(g).join(","));
		const g2 = await boot(baseSave([
			collector("z"),
			collector("a"),
			collector("m"),
			collector("b")
		]));
		g2.moveItems(["a", "b"], "m");
		check("mover: delante de un ancla que esta en medio, igual de junto", ids(g2).join(",") === "z,a,b,m", ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("z"),
			collector("a"),
			collector("b")
		]));
		g.moveItems(["b", "a"], "z");
		check("mover: el bloque se ordena por su posicion original, no por el argumento", ids(g).join(",") === "a,b,z", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			crate("p1", "common", 2),
			crate("p2", "rare", 3),
			crate("p3", "epic", 1),
			collector("z")
		]));
		g.moveItems([
			"p1",
			"p2",
			"p3"
		], "z");
		check("mover: un bloque de tres items apilables va junto", ids(g).join(",") === "p1,p2,p3,z", ids(g).join(","));
		check("mover: y cada item conserva sus unidades", wh(g).map((w) => w.stackCount).join(",") === "2,3,1,", wh(g).map((w) => w.stackCount).join(","));
	}
	{
		const items = Array.from({ length: 19 }, (_, i) => key("k" + i));
		const g = await boot(baseSave([collector("z"), ...items]));
		check("mover: 19 llaves separadas se funden en una celda", wh(g).length === 2, "items=" + wh(g).length);
		g.moveItems([find(g, "k0").id], "z");
		check("mover: arrastrar esa celda mueve la pila entera, no la parte", ids(g).join(",") === find(g, "k0").id + ",z", ids(g).join(","));
		check("mover: y no se pierde ninguna unidad", find(g, "k0").stackCount === 19, "stackCount=" + find(g, "k0").stackCount);
	}
	{
		const items = [
			collector("r1", 4, {
				level: 3,
				damage: 80,
				affixes: ["x"],
				potential: 3
			}),
			companion("m1", 2),
			crate("c1", "epic", 4),
			key("k1", 1, 7),
			crystal("x1", 3, 2),
			consumable("u1", "afk", 5)
		];
		const g = await boot(baseSave(items, { nanites: 7777 }));
		const foto = JSON.stringify(wh(g).slice().sort((a, b) => a.id.localeCompare(b.id)));
		const contadores = JSON.stringify({
			n: s(g).nanites,
			k: s(g).keys,
			c: s(g).crates,
			comp: s(g).companions,
			afk: s(g).afkCards
		});
		g.moveItems([
			"r1",
			"m1",
			"c1",
			"k1",
			"x1",
			"u1"
		], null);
		check("mover: no se crea ni se borra ningun item", wh(g).length === items.length, `${wh(g).length} vs ${items.length}`);
		check("mover: el contenido de los items es identico", JSON.stringify(wh(g).slice().sort((a, b) => a.id.localeCompare(b.id))) === foto);
		check("mover: nanitas y contadores intactos", JSON.stringify({
			n: s(g).nanites,
			k: s(g).keys,
			c: s(g).crates,
			comp: s(g).companions,
			afk: s(g).afkCards
		}) === contadores, "cambiados");
	}
	{
		const g = await boot(baseSave([crate("p1", "common", 5), collector("z")]));
		g.moveItems(["p1"], "z");
		check("mover: la pila conserva sus unidades", findStackCount(g, "p1") === 5, String(findStackCount(g, "p1")));
		check("mover: y sigue siendo una sola celda", celdasDe(g).length === 2, celdasDe(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		check("mover: lista vacia se rechaza", g.moveItems([], "a") === false);
		check("mover: y el almacen queda igual", ids(g).join(",") === "a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		const r = g.moveItems(["nada", "tampoco"], "a");
		check("mover: si ninguno de los ids existe se rechaza", r === false, String(r));
		check("mover: y no se toca el almacen", ids(g).join(",") === "a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["a", "idCaducado"], "b", "despues");
		check("mover: un id caducado no bloquea al grupo", r === true, String(r));
		check("mover: y los ids buenos se mueven", ids(g).join(",") === "b,a,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		check("mover: ancla inexistente se rechaza", g.moveItems(["a"], "no_existe") === false, String(g.moveItems(["a"], "no_existe")));
		check("mover: y no manda el item al final", ids(g).join(",") === "a,b", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems(["b"], "b");
		check("mover: soltar sobre si mismo se rechaza", r === false, String(r));
		check("mover: y ningun item se pierde", ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c")
		]));
		const r = g.moveItems([
			"a",
			"b",
			"c"
		], "b");
		check("mover: soltar todo el almacen sobre si mismo se rechaza", r === false, String(r));
		check("mover: y el almacen sigue entero", ids(g).join(",") === "a,b,c", ids(g).join(","));
	}
	{
		const n = 12;
		const items = Array.from({ length: n }, (_, i) => collector(`i${i}`));
		const g = await boot(baseSave(items));
		const original = new Set(ids(g));
		for (let k = 0; k < 12; k++) {
			const actual = ids(g);
			const origen = actual[k % n];
			const destino = actual[(k * 5 + 3) % n];
			if (origen !== destino) g.moveItems([origen], destino, k % 2 ? "despues" : "antes");
		}
		const final = ids(g);
		check("cadena: no se pierde ningun item", new Set(final).size === n, `${new Set(final).size} de ${n}`);
		check("cadena: no aparece ningun item nuevo", [...final].every((id) => original.has(id)), final.join(","));
		check("cadena: siguen siendo todos los originales", original.size === n, [...original].join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c"),
			collector("d")
		]));
		g.sellItem("a");
		const r = g.moveItems(["d"], "c");
		check("cadena: tras una venta el almacen se sigue moviendo", r === true && ids(g).join(",") === "b,d,c", ids(g).join(","));
		const r2 = g.moveItems(["c"], "b");
		check("cadena: y un segundo movimiento encadenado tambien", r2 === true && ids(g).join(",") === "c,b,d", ids(g).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("b"),
			collector("c"),
			crate("p1", "common", 3)
		]));
		g.moveItems(["p1"], "c", "despues");
		const esperado = ids(g).join(",");
		const g2 = await reload();
		check("guardar: el orden se conserva tras recargar", ids(g2).join(",") === esperado, `${ids(g2).join(",")} vs ${esperado}`);
		check("guardar: y sigue habiendo los mismos items", wh(g2).length === 4, ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([collector("a"), collector("b")]));
		g.moveItems(["a"], "b", "despues");
		g.moveItems(["a"], "idQueNoExiste");
		const g2 = await reload();
		check("guardar: un movimiento fallido no altera el orden guardado", ids(g2).join(",") === "b,a", ids(g2).join(","));
	}
	{
		const g = await boot(baseSave([
			collector("a"),
			collector("c"),
			collector("b")
		], { equippedCollectorId: "b" }));
		check("equipar + mover: la partida arranca con el recolector equipado", s(g).equippedCollectorId === "b" && g.getClickDamage() > 0, `id=${s(g).equippedCollectorId} danio=${g.getClickDamage()}`);
		g.moveItems(["b"], "a");
		check("equipar + mover: el recolector equipado se mueve bien", ids(g).join(",") === "b,a,c" && s(g).equippedCollectorId === "b", ids(g).join(","));
		check("equipar + mover: y sigue haciendo dano", g.getClickDamage() > 0, "danio=" + g.getClickDamage());
		const g2 = await reload();
		check("equipar + mover: el equipado sobrevive con el nuevo orden", s(g2).equippedCollectorId === "b" && g2.getClickDamage() > 0, `id=${s(g2).equippedCollectorId} danio=${g2.getClickDamage()}`);
	}
	{
		const items = [collector("a"), companion("m1")];
		const g = await boot(baseSave(items, {
			companions: [ficha("m1")],
			activeCompanions: ["m1"]
		}));
		g.moveItems(["m1"], "a");
		check("equipar + mover: el companero activo se mueve bien", ids(g).join(",") === "m1,a" && s(g).activeCompanions.join(",") === "m1", ids(g).join(","));
		check("equipar + mover: y sigue pagando pasivo", s(g).passiveIncome > 0, "pasivo=" + s(g).passiveIncome);
	}
	{
		const g = await boot(baseSave([collector("solo")]));
		const r = g.moveItems(["solo"], null);
		check("un solo item: moverlo no lo destruye", wh(g).length === 1 && ids(g).join(",") === "solo", ids(g).join(","));
		check("un solo item: la operacion responde correctamente", r === true, String(r));
	}
	{
		const g = await boot(baseSave([]));
		check("almacen vacio: mover se rechaza sin reventar", g.moveItems(["a"], null) === false);
		check("almacen vacio: sigue vacio", wh(g).length === 0);
	}
	resumen("movimientos");
}
function findStackCount(g, id) {
	const w = wh(g).find((x) => x.id === id);
	return w ? w.stackCount || 0 : -1;
}
function celdasDe(g) {
	return wh(g).map((w) => w.id);
}
var moveCheck_default = main();
//#endregion
export { moveCheck_default as default };
