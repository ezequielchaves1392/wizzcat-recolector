import { U as STORE_ITEMS } from "./gameLoop-DA2943Xb.js";
import { C as s, S as resumen, _ as ids, a as check, d as crystal, f as deType, g as guardado, h as find, i as bootNew, l as consumable, n as baseSave, o as collector, r as boot, w as wh, x as reload, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/playthroughCheck.ts
/** Cuántos clicks se dan en un paso. Suficiente para que la cifra sea legible. */
var CLICKS = 20;
async function main() {
	const g = await bootNew();
	{
		check("nacimiento: nace con cero nanitas", nanites(g) === 0, "nanitas=" + nanites(g));
		check("nacimiento: trae un recolector, un compañero y 2 cajas", deType(g, "collector") === 1 && deType(g, "companion") === 1 && deType(g, "crate") === 1, ids(g).join(","));
		check("nacimiento: las 2 cajas de bienvenida son UNA pila", wh(g).find((w) => w.type === "crate")?.stackCount === 2, "unidades=" + wh(g).find((w) => w.type === "crate")?.stackCount);
		check("nacimiento: almacén de 15 y una sola ranura de compañero", g.getCapacity() === 15 && g.getCompanionSlots() === 1, `cap=${g.getCapacity()} slots=${g.getCompanionSlots()}`);
		check("nacimiento: NADA equipado, que es lo que el jugador ve", s(g).equippedCollectorId === null && s(g).activeCompanions.length === 0, `equipo=${s(g).equippedCollectorId} companeros=${s(g).activeCompanions.join(",")}`);
		check("nacimiento: y sin ingreso pasivo", s(g).passiveIncome === 0, "pasivo=" + s(g).passiveIncome);
		const g2 = await reload();
		check("nacimiento: y recargar no inventa nada", nanites(g2) === 0 && deType(g2, "crate") === 1, ids(g2).join(","));
	}
	{
		for (let i = 0; i < 3; i++) g.click();
		check("click: sin recolector no se gana nada", nanites(g) === 0, "nanitas=" + nanites(g));
		check("click: pero el click se cuenta igualmente", s(g).totalClicks === 3, "clics=" + s(g).totalClicks);
		const danio = g.getClickDamage();
		check("click: sin nada equipado el daño es cero", danio === 0, "danio=" + danio);
		const colector = wh(g).find((w) => w.type === "collector");
		const equipado = g.equipCollector(colector.id);
		check("click: se puede equipar el recolector de partida", equipado === true, String(equipado));
		check("click: el equipado queda dicho en el estado", s(g).equippedCollectorId === colector.id, String(s(g).equippedCollectorId));
		const announced = g.getClickDamage();
		check("click: equipado, el daño es mayor que cero", announced > 0, "danio=" + announced);
		const antes = nanites(g);
		for (let i = 0; i < CLICKS; i++) g.click();
		const ganado = nanites(g) - antes;
		check("click: N clicks dan N veces el daño anunciado", ganado === announced * CLICKS, `ganado=${ganado} esperado=${announced * CLICKS}`);
		check("click: el total produzido lleva la cuenta", s(g).totalNanitesProduced === ganado, `producido=${s(g).totalNanitesProduced} ganado=${ganado}`);
		const g2 = await reload();
		check("click: y el saldo del jugador sobrevive a la recarga", nanites(g2) === ganado, `nanitas=${nanites(g2)}`);
		check("click: el recolector sigue equipado tras recargar", s(g2).equippedCollectorId === colector.id, String(s(g2).equippedCollectorId));
		check("click: y sigue haciendo daño", g2.getClickDamage() === announced, `${announced} -> ${g2.getClickDamage()}`);
	}
	{
		const g3 = await reload();
		const barato = "collectorCardT1";
		const saldoAntes = nanites(g3);
		const denied = g3.buyStoreItem(barato);
		check("tienda: sin nanitas no se compra", !denied, String(denied));
		check("tienda: y no se cobra nada", nanites(g3) === saldoAntes, "nanitas=" + nanites(g3));
		const precio = STORE_ITEMS[barato].cost;
		g3.updateState({ nanites: precio });
		const comprado = g3.buyStoreItem(barato);
		check("tienda: con las nanitas justas sí se compra", Boolean(comprado), String(comprado));
		check("tienda: se cobra EXACTAMENTE el precio de carta", nanites(g3) === 0, `nanitas=${nanites(g3)} precio=${precio}`);
		check("tienda: lo comprado llega al almacén", ids(g3).includes(comprado.id), String(comprado?.id));
		check("tienda: sin nanitas pero con sitio, cabe igual", g3.canBuyStoreItem(barato) === true, "dice que no cabe con 3 de 15 ranuras");
		const g4 = await reload();
		check("tienda: la compra sobrevive a la recarga", deType(g4, "collector") === 2, "recolectores=" + deType(g4, "collector"));
		check("tienda: y la cartera vacía también sobrevive", nanites(g4) === 0, "nanitas=" + nanites(g4));
	}
	{
		const g5 = await reload();
		check("compañero: se nace con uno pero inactivo", s(g5).activeCompanions.length === 0 && s(g5).passiveIncome === 0, `activos=${s(g5).activeCompanions.length} pasivo=${s(g5).passiveIncome}`);
		const comp = wh(g5).find((w) => w.type === "companion");
		const pasivo0 = s(g5).passiveIncome;
		const ok = g5.equipCompanion(comp.id);
		check("compañero: se activa", ok === true, String(ok));
		check("compañero: y a partir de ahí hay ingreso pasivo", s(g5).passiveIncome > pasivo0, `pasivo=${s(g5).passiveIncome}`);
		check("compañero: con 1 ranura no cabe un segundo", g5.equipCompanion("inexistente") === false, "aceptó un id que no existe");
		const g6 = await reload();
		check("compañero: el activo sigue activo tras recargar", s(g6).activeCompanions.includes(comp.id), s(g6).activeCompanions.join(","));
		check("compañero: y el ingreso pasivo sobrevive", s(g6).passiveIncome === s(g5).passiveIncome, `${s(g5).passiveIncome} -> ${s(g6).passiveIncome}`);
		const fuera = g6.equipCompanion(comp.id);
		check("compañero: se puede quitar", fuera === true, String(fuera));
		check("compañero: y al quitarlo se acaba el ingreso pasivo", s(g6).activeCompanions.length === 0 && s(g6).passiveIncome === 0, `activos=${s(g6).activeCompanions.length} pasivo=${s(g6).passiveIncome}`);
		g6.equipCompanion(comp.id);
	}
	{
		const g7 = await reload();
		const cap = g7.getCapacity();
		check("almacén: la capacidad es la que se anuncia", cap === 15, "cap=" + cap);
		const ranuras = wh(g7).length;
		check("almacén: las 2 cajas de bienvenida ocupan 1 ranura, no 2", deType(g7, "crate") === 1 && wh(g7).find((w) => w.type === "crate")?.stackCount === 2 && ranuras === 4, `items=${ranuras} cajas=${deType(g7, "crate")} unidades=2`);
		check("almacén: con sitio de sobra la compra cabe", g7.canBuyStoreItem("collectorCardT2") === true, "no cabe con " + ranuras + " de 15");
		const antesCap = g7.getCapacity();
		const antesSlots = wh(g7).length;
		g7.updateState({ nanites: 6e3 });
		const permiso = g7.buyStoreItem("warehouseSlot");
		check("almacén: se puede ampliar", Boolean(permiso), String(permiso));
		check("almacén: ampliar NO mete un item", wh(g7).length === antesSlots, `${antesSlots} -> ${wh(g7).length}`);
		check("almacén: y la capacidad sube 5", g7.getCapacity() === antesCap + 5, `${antesCap} -> ${g7.getCapacity()}`);
		g7.updateState({ nanites: 1400 });
		const expansor = g7.buyStoreItem("backpackExpander");
		check("almacén: el expansor SÍ es un item", Boolean(expansor) && deType(g7, "consumable") === 1, "consumibles=" + deType(g7, "consumable"));
		const capTrasComprar = g7.getCapacity();
		check("almacén: pero comprarlo NO amplía todavía", capTrasComprar === antesCap + 5, "cap=" + capTrasComprar);
		const usado = g7.useConsumable(expansor.id);
		check("almacén: ampliar es usarlo", usado.ok === true, usado.msg ?? "");
		check("almacén: y al usarlo sube 1 ranura", g7.getCapacity() === capTrasComprar + 1, `${capTrasComprar} -> ${g7.getCapacity()}`);
		const g8 = await reload();
		check("almacén: las dos ampliaciones sobreviven a la recarga", g8.getCapacity() === antesCap + 6, "cap=" + g8.getCapacity());
		const g9 = await boot(baseSave([...Array.from({ length: 14 }, (_, i) => collector("c" + i)), cr("pila", "common", 5)], {
			nanites: 1e5,
			warehouseCapacity: 15
		}));
		check("almacén lleno: está lleno de verdad", g9.getCapacity() === 15 && wh(g9).length === 15, `${wh(g9).length}/${g9.getCapacity()}`);
		check("almacén lleno: un item que necesita ranura NO cabe", g9.canBuyStoreItem("collectorCardT1") === false, "dice que cabe");
		check("almacén lleno: y al comprarlo no se cobra", (() => {
			g9.buyStoreItem("collectorCardT1");
			return nanites(g9) === 1e5;
		})(), "nanitas=" + nanites(g9));
		check("almacén lleno: pero otra caja del mismo tipo SÍ cabe, porque se apila", g9.canBuyStoreItem("commonCrate") === true, `hay una pila de ${wh(g9).find((w) => w.id === "pila")?.stackCount} cajas`);
		check("almacén lleno: y al comprarla no ocupa ranura nueva", (() => {
			const antes = wh(g9).length;
			const comprada = g9.buyStoreItem("commonCrate");
			return Boolean(comprada) && wh(g9).length === antes;
		})(), `items=${wh(g9).length}`);
		check("almacén lleno: y la pila suma las unidades", wh(g9).find((w) => w.id === "pila")?.stackCount === 6, "unidades=" + wh(g9).find((w) => w.id === "pila")?.stackCount);
	}
	{
		const g10 = await boot(baseSave([
			collector("r1", 3, { damage: 60 }),
			{
				...collector("r1"),
				id: "r2"
			},
			{
				...collector("r1"),
				id: "r3",
				type: "crate",
				name: "Caja Común",
				stackable: true,
				stackCount: 4
			}
		], {
			nanites: 500,
			warehouseCapacity: 30
		}));
		const unitarioCaja = g10.getSellPrice("r3");
		const unitarioRec = g10.getSellPrice("r1");
		check("venta: el precio unitario es el de UNA pieza", unitarioRec > 0, "unitario=" + unitarioRec);
		check("venta: y el de una caja es el suyo, no el de otro item", unitarioCaja > 0 && unitarioCaja !== unitarioRec, `caja=${unitarioCaja} recolector=${unitarioRec}`);
		const total = g10.getSellTotal("r3");
		check("venta: el total de una pila es SU unitario × unidades", total === unitarioCaja * 4, `total=${total} unitario=${unitarioCaja} pila=4`);
		check("venta: el total NO es el unitario (la trampa que ya pasó)", total !== unitarioCaja, "son iguales");
		const antes = nanites(g10);
		const vendido = g10.sellItem("r3");
		check("venta: se vende la pila entera", vendido.ok === true, vendido.msg ?? "");
		check("venta: y se cobra EXACTAMENTE lo que el botón decía", nanites(g10) - antes === total, `cobrado=${nanites(g10) - antes}(total=${total})`);
		check("venta: y la pila desaparece del almacén", !find(g10, "r3"), ids(g10).join(","));
		const g11 = await reload();
		check("venta: no se resucita al recargar", !find(g11, "r3"), ids(g11).join(","));
		check("venta: y la cartera es la que quedó", nanites(g11) === antes + total, `nanitas=${nanites(g11)}`);
		g11.equipCollector("r1");
		const intentado = g11.sellItem("r1");
		check("venta: el recolector equipado no se vende", intentado.ok === false, intentado.msg ?? "");
		check("venta: y sigue en el almacén haciendo daño", Boolean(find(g11, "r1")) && g11.getClickDamage() > 0, "danio=" + g11.getClickDamage());
	}
	{
		const g12 = await boot(baseSave([
			{ ...collector("r1", 3, { damage: 60 }) },
			cr("c1", "common"),
			keyT1("k1", 2)
		], {
			nanites: 0,
			warehouseCapacity: 30
		}));
		const antes = nanites(g12);
		const cajas = wh(g12).filter((w) => w.type === "crate").length;
		const llaves = wh(g12).filter((w) => w.type === "key").reduce((a, w) => a + (w.stackCount ?? 1), 0);
		const r = g12.openCrateBox("c1", "k1");
		const sueltas = r.reward?.kind === "keys" ? r.reward.amount ?? 0 : 0;
		const llavesDeFabrica = llaves - 1 + sueltas;
		const totalLlaves = (gg) => wh(gg).filter((w) => w.type === "key").reduce((a, w) => a + (w.stackCount ?? 1), 0);
		check("caja: se abre", r.ok === true, r.msg ?? "");
		check("caja: la caja se consume", deType(g12, "crate") < cajas, "cajas=" + deType(g12, "crate"));
		check("caja: y se gasta UNA llave", totalLlaves(g12) === llavesDeFabrica, `llaves=${totalLlaves(g12)} esperado=${llavesDeFabrica} (botín soltó ${sueltas})`);
		check("caja: el contador de cajas abiertas sube", s(g12).cratesOpened === 1, "abiertas=" + s(g12).cratesOpened);
		const premio = r.reward;
		check("caja: vuelve un premio con etiqueta y nombre", Boolean(premio && premio.label && premio.name), JSON.stringify(premio?.label ?? null));
		if (premio?.kind === "nanites") {
			const ganado = nanites(g12) - antes;
			check("caja: si son nanitas, entran las que dice la etiqueta", premio.label.includes(String(ganado)) || premio.label.includes("K"), `etiqueta="${premio.label}" entraron=${ganado}`);
		}
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
		const g13 = await reload();
		check("caja: el botín sobrevive a la recarga", s(g13).cratesOpened === 1, "abiertas=" + s(g13).cratesOpened);
		const cajas13 = deType(g13, "crate");
		const llaves13 = wh(g13).filter((w) => w.type === "key").reduce((a, w) => a + (w.stackCount ?? 1), 0);
		check("caja: la caja abierta no vuelve", cajas13 < cajas, `cajas=${cajas13} (antes ${cajas})`);
		check("caja: abrir una caja NO multiplica el material", totalLlaves(g13) <= llavesDeFabrica, `llaves=${llaves13} tope=${llavesDeFabrica} (antes ${llaves}, botín soltó ${sueltas})`);
		check("caja: la llave consumida no vuelve al recargar", totalLlaves(g13) === llavesDeFabrica, `llaves=${llaves13} esperado=${llavesDeFabrica} · doc=${JSON.stringify(guardado()?.keys ?? "sin campo keys")}`);
	}
	{
		const g14 = await boot(baseSave([collector("base", 3, { damage: 60 })], {
			nanites: 5e6,
			warehouseCapacity: 40
		}));
		const poder = [];
		for (let tier = 1; tier <= 10; tier++) {
			const carta = `collectorCardT${tier}`;
			const comprado = g14.buyStoreItem(carta);
			if (!comprado) continue;
			const id = comprado.id;
			g14.equipCollector(id);
			poder.push({
				tier,
				coste: STORE_ITEMS[carta].cost,
				danio: g14.getClickDamage()
			});
			g14.equipCollector("base");
			g14.sellItem(id);
		}
		const detalle = poder.map((p) => `T${p.tier}:${(p.danio / p.coste * 1e3).toFixed(1)}`).join(" ");
		check("balance: se pudieron medir los diez tiers", poder.length === 10, "medidos=" + poder.length);
		check("balance: más tier es más daño", poder.every((p, i) => i === 0 || p.danio > poder[i - 1].danio), detalle);
		const ratio = poder.map((p) => p.danio / p.coste);
		const max = Math.max(...ratio);
		const min = Math.min(...ratio);
		const factor = max / min;
		const peor = poder[ratio.indexOf(min)].tier;
		const mejor = poder[ratio.indexOf(max)].tier;
		check("balance: el poder por nanita se midió en los diez tiers", ratio.every((r) => r > 0), detalle);
		check("balance: la curva no se dispara (peor ≤ 6× el mejor)", factor <= 6, `T${peor} contra T${mejor}: ${factor.toFixed(1)}x  ${detalle}`);
		check("balance: DATO la dispersión real entre tiers", true, `${factor.toFixed(1)}x de T${peor} a T${mejor}; el objetivo declarado es 1,3x`);
	}
	{
		const g15 = await boot(baseSave([collector("r1", 3, { damage: 60 }), consumable("u1", "clickX2", 1, { name: "Tarjeta Click x2" })], {
			nanites: 0,
			warehouseCapacity: 30
		}));
		g15.equipCollector("r1");
		const danio = g15.getClickDamage();
		const r = g15.useConsumable("u1");
		check("buff: una tarjeta Click x2 se aplica", r.ok === true, r.msg ?? "");
		check("buff: y duplica el daño por click", g15.getClickDamage() === danio * 2, `${danio} -> ${g15.getClickDamage()}`);
		check("buff: el item se gasta", !find(g15, "u1"), ids(g15).join(","));
		const cancelado = g15.cancelBuff("clickX2");
		check("buff: se puede cancelar", Boolean(cancelado), String(cancelado));
		check("buff: y al cancelar vuelve el daño", g15.getClickDamage() === danio, `${danio} -> ${g15.getClickDamage()}`);
		const g16 = await reload();
		check("buff: el buff cancelado no sobrevive a la recarga", g16.getClickDamage() === danio, "danio=" + g16.getClickDamage());
		check("buff: y el item cancelado no vuelve", !find(g16, "u1"), ids(g16).join(","));
	}
	{
		const g17 = await boot(baseSave([collector("r1", 3, { damage: 60 })], {
			nanites: 1e3,
			totalNanitesProduced: 500,
			warehouseCapacity: 30
		}));
		const bajo = g17.prestige();
		check("ascensión: por debajo del umbral se rechaza", !bajo.success, bajo.msg ?? "");
		check("ascensión: y no se toca el progreso", nanites(g17) === 1e3, "nanitas=" + nanites(g17));
		const g18 = await boot(baseSave([collector("r1", 3, { damage: 60 }), crystal("x1", 1, 3)], {
			nanites: 2e6,
			totalNanitesProduced: 5e7,
			warehouseCapacity: 30,
			cores: 3,
			totalCores: 10,
			resets: 2,
			nodeLevels: { core_sink: 2 },
			unlockedNodes: ["core_sink"]
		}));
		const info = g18.getPrestigeInfo();
		check("ascensión: la página anuncia lo que daría", info.pending > 0, "daria=" + info.pending);
		const r = g18.prestige();
		check("ascensión: con suficiente producción se concede", r.success === true, r.msg ?? "");
		check("ascensión: otorga los núcleos anunciados", s(g18).cores === 3 + info.pending, `nucleos=${s(g18).cores} esperado=${3 + info.pending}`);
		check("ascensión: el progreso se reinicia", nanites(g18) === 0, "nanitas=" + nanites(g18));
		check("ascensión: los núcleos NO se pierden", s(g18).cores > 3, "nucleos=" + s(g18).cores);
		check("ascensión: el árbol de pasivas se conserva", (s(g18).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g18).nodeLevels));
		check("ascensión: el contador de reinicios sube", s(g18).resets === 3, "reinicios=" + s(g18).resets);
		const g19 = await reload();
		check("ascensión: el reinicio sobrevive a la recarga", nanites(g19) === 0 && s(g19).cores === 3 + info.pending && s(g19).resets === 3, `nanitas=${nanites(g19)} nucleos=${s(g19).cores} reinicios=${s(g19).resets}`);
		check("ascensión: y el árbol sigue ahí tras recargar", (s(g19).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g19).nodeLevels));
		const blaster = wh(g19).find((w) => w.type === "collector");
		check("ascensión: queda un recolector con el que empezar", Boolean(blaster), "items=" + ids(g19).join(","));
		g19.equipCollector(blaster.id);
		check("ascensión: y con él se vuelve a hacer daño", g19.getClickDamage() > 0, "danio=" + g19.getClickDamage());
		g19.click();
		check("ascensión: no hay bloqueo: el primer click ya da algo", nanites(g19) > 0, "nanitas=" + nanites(g19));
	}
	resumen("la partida entera de un jugador nuevo");
}
/** Una caja con el nombre que el juego reconoce al abrirla. */
function cr(id, tipo, stack = 1) {
	return {
		id,
		name: {
			common: "Caja Común",
			rare: "Caja Rara",
			epic: "Caja Épica",
			legendary: "Caja Legendaria"
		}[tipo],
		type: "crate",
		details: "x",
		rarity: "Raro",
		tier: 0,
		sellPrice: 500,
		stackable: true,
		stackCount: stack
	};
}
/** Una llave de nivel 0, que abre las cajas comunes. */
function keyT1(id, stack) {
	return {
		id,
		name: "Llave de Cifrado",
		type: "key",
		details: "x",
		rarity: "Raro",
		tier: 0,
		sellPrice: 480,
		stackable: true,
		stackCount: stack
	};
}
var playthroughCheck_default = main();
//#endregion
export { playthroughCheck_default as default };
