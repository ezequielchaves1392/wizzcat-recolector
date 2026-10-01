import { L as COMPANION_SLOT_BUY, U as STORE_ITEMS, _ as TREE_BY_ID, v as nodeCost } from "./gameLoop-DA2943Xb.js";
import { C as s, S as resumen, _ as ids, a as check, b as ranuras, f as deType, h as find, n as baseSave, p as distintos, r as boot, u as crate, w as wh, x as reload, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/buyCheck.ts
async function main() {
	{
		const g = await boot(baseSave([], { nanites: 1e4 }));
		const antes = nanites(g);
		const item = g.buyStoreItem("keyT0");
		check("tienda: devuelve el item comprado", !!item && item.type === "key", JSON.stringify(item?.id));
		check("tienda: cobra el precio de carta", nanites(g) === antes - STORE_ITEMS.keyT0.cost, `cobrado=${antes - nanites(g)} precio=${STORE_ITEMS.keyT0.cost}`);
		check("tienda: la llave entra en el almacen", deType(g, "key") === 1, ids(g).join(","));
		check("tienda: el contador de llaves sube a 1", s(g).keys === 1, "keys=" + s(g).keys);
		check("tienda: el item devuelto es el que esta en el almacen", !!item?.id && !!find(g, item.id));
		const g2 = await reload();
		check("tienda: la compra sobrevive a la recarga", deType(g2, "key") === 1 && s(g2).keys === 1, `items=${deType(g2, "key")} keys=${s(g2).keys}`);
	}
	const casos = [
		{
			k: "upgradeCrystal",
			tipo: "crystal",
			coste: 60,
			nombre: "Cristal"
		},
		{
			k: "commonCrate",
			tipo: "crate",
			coste: 500,
			nombre: "Común"
		},
		{
			k: "rareCrate",
			tipo: "crate",
			coste: 1500,
			nombre: "Rara"
		},
		{
			k: "epicCrate",
			tipo: "crate",
			coste: 5500,
			nombre: "Épica"
		},
		{
			k: "legendaryCrate",
			tipo: "crate",
			coste: 21e3,
			nombre: "Legendaria"
		},
		{
			k: "backpackExpander",
			tipo: "consumable",
			coste: 1400,
			nombre: "Expansor"
		},
		{
			k: "afkCard",
			tipo: "consumable",
			coste: 1e4,
			nombre: "Tarjeta AFK"
		},
		{
			k: "clickX2Card",
			tipo: "consumable",
			coste: 5e3,
			nombre: "Click x2"
		},
		{
			k: "clickX3Card",
			tipo: "consumable",
			coste: 15e3,
			nombre: "Click x3"
		},
		{
			k: "calibrationStone",
			tipo: "consumable",
			coste: 45e3,
			nombre: "Calibración"
		},
		{
			k: "stabilityNano",
			tipo: "consumable",
			coste: 9e4,
			nombre: "Nanopartícula"
		},
		{
			k: "companionCardT1",
			tipo: "companion"
		},
		{
			k: "companionCardT5",
			tipo: "companion"
		},
		{
			k: "collectorCardT1",
			tipo: "collector"
		},
		{
			k: "collectorCardT10",
			tipo: "collector"
		}
	];
	const masCaro = Math.max(...casos.map((c) => STORE_ITEMS[c.k].cost));
	for (const c of casos) {
		const coste = STORE_ITEMS[c.k].cost;
		const g = await boot(baseSave([], { nanites: masCaro * 2 }));
		const antesN = wh(g).length;
		const antesNanites = nanites(g);
		const item = g.buyStoreItem(c.k);
		check(`tienda ${c.k}: cobra ${coste}`, nanites(g) === antesNanites - coste, `cobrado=${antesNanites - nanites(g)}`);
		check(`tienda ${c.k}: mete 1 item de tipo ${c.tipo}`, wh(g).length === antesN + 1 && deType(g, c.tipo) === 1, `antes=${antesN} ahora=${wh(g).length} de ${c.tipo}=${deType(g, c.tipo)}`);
		if (c.nombre) check(`tienda ${c.k}: el item se llama "${c.nombre}"`, String(item?.name ?? "").includes(c.nombre), `nombre=${item?.name}`);
		check(`tienda ${c.k}: el item comprado existe y trae id`, !!item?.id && !!find(g, item.id), JSON.stringify(item?.id));
	}
	{
		const g = await boot(baseSave([], { nanites: 2e5 }));
		g.buyStoreItem("epicCrate");
		g.buyStoreItem("epicCrate");
		check("tienda: dos cajas epicas dejan el contador a 2", s(g).crates.epic === 2, "epic=" + s(g).crates.epic);
		const g2 = await reload();
		check("tienda: el contador de cajas no se duplica al recargar", s(g2).crates.epic === 2, "epic=" + s(g2).crates.epic);
	}
	{
		const g = await boot(baseSave([], { nanites: 2e5 }));
		g.buyStoreItem("afkCard");
		check("tienda: la tarjeta AFK cuenta al comprarse", s(g).afkCards === 1, "afkCards=" + s(g).afkCards);
		const g2 = await reload();
		check("tienda: y sigue contando tras recargar", s(g2).afkCards === 1, "afkCards=" + s(g2).afkCards);
	}
	{
		const g = await boot(baseSave([], { nanites: 2e5 }));
		const item = g.buyStoreItem("companionCardT3");
		check("tienda: el compañero comprado tiene ficha en state.companions", s(g).companions.some((c) => c.id === item.id), JSON.stringify(s(g).companions.map((c) => c.id)));
		g.equipCompanion(item.id);
		check("tienda: y equipado paga ingreso pasivo", s(g).passiveIncome > 0, "pasivo=" + s(g).passiveIncome);
		const g2 = await reload();
		check("tienda: el compañero comprado sobrevive a la recarga", deType(g2, "companion") >= 1 && s(g2).passiveIncome > 0, `items=${deType(g2, "companion")} pasivo=${s(g2).passiveIncome}`);
	}
	{
		const g = await boot(baseSave([], { nanites: 100 }));
		const antes = nanites(g);
		const r = g.buyStoreItem("legendaryCrate");
		check("tienda: sin nanitas no se compra", r === false, String(r));
		check("tienda: y no se cobra nada", nanites(g) === antes, "nanites=" + nanites(g));
		check("tienda: ni se entrega un item a medias", wh(g).length === 0, ids(g).join(","));
	}
	{
		const precioCristal = STORE_ITEMS.upgradeCrystal.cost;
		const g = await boot(baseSave([], { nanites: precioCristal }));
		const r = g.buyStoreItem("upgradeCrystal");
		check("tienda: con las nanitas justas SI se compra", r !== false, String(r));
		check("tienda: y deja la cartera a cero", nanites(g) === 0, "nanitas=" + nanites(g));
	}
	{
		const menos = STORE_ITEMS.upgradeCrystal.cost - 1;
		const g = await boot(baseSave([], { nanites: menos }));
		const r = g.buyStoreItem("upgradeCrystal");
		check("tienda: con una nanita menos NO se compra", r === false && nanites(g) === menos, "nanitas=" + nanites(g));
	}
	{
		const g = await boot(baseSave([], { nanites: 5e3 }));
		const antes = nanites(g);
		const r = g.buyStoreItem("itemInventado");
		check("tienda: una clave inexistente devuelve false", r === false, String(r));
		check("tienda: y no cobra", nanites(g) === antes, "nanites=" + nanites(g));
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			nodeLevels: {
				refinery: 3,
				bulk_buy: 2,
				scrapyard: 1
			},
			unlockedNodes: [
				"refinery",
				"bulk_buy",
				"scrapyard"
			]
		}));
		const descuento = s(g).bonus.costReduction;
		check("descuento: los nodos comprados bajan el coste de tienda", descuento > 0, "costReduction=" + descuento);
		const antes = nanites(g);
		g.buyStoreItem("commonCrate");
		const esperado = Math.floor(STORE_ITEMS.commonCrate.cost * (1 - descuento));
		check("descuento: el cobro aplica el descuento del arbol", nanites(g) === antes - esperado, `cobrado=${antes - nanites(g)} esperado=${esperado} sin=${STORE_ITEMS.commonCrate.cost}`);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 1e3,
			nodeLevels: {
				refinery: 6,
				bulk_buy: 5,
				scrapyard: 1
			},
			unlockedNodes: [
				"refinery",
				"bulk_buy",
				"scrapyard"
			]
		}));
		const antes = nanites(g);
		const r = g.buyStoreItem("commonCrate");
		check("descuento: con descuento enorme el item llega igual", r !== false && deType(g, "crate") === 1, ids(g).join(","));
		const cobrado = antes - nanites(g);
		check("descuento: se cobra menos que el precio de carta, pero algo", cobrado > 0 && cobrado < STORE_ITEMS.commonCrate.cost, `cobrado=${cobrado} de carta=${STORE_ITEMS.commonCrate.cost}`);
		check("descuento: y la cartera nunca queda negativa", nanites(g) >= 0, "nanites=" + nanites(g));
	}
	{
		const g = await boot(baseSave(distintos(30), { nanites: 2e5 }));
		check("capacidad: 30 items distintos llenan 30 ranuras", ranuras(g) === 30, "ranuras=" + ranuras(g));
		const antes = nanites(g);
		const r = g.buyStoreItem("commonCrate");
		check("capacidad: con el almacen lleno no se compra un item", r === false, String(r));
		check("capacidad: y no se cobra", nanites(g) === antes, "nanites=" + nanites(g));
		check("capacidad: el almacen sigue igual", ranuras(g) === 30, "ranuras=" + ranuras(g));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 20), crate("c2", "epic", 10)], {
			nanites: 2e5,
			warehouseCapacity: 2
		}));
		check("capacidad: dos cajas de distinto tipo son dos ranuras", ranuras(g) === 2, "ranuras=" + ranuras(g));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 20), crate("c2", "common", 10)], {
			nanites: 2e5,
			warehouseCapacity: 2
		}));
		check("capacidad: dos cajas del mismo tipo se funden en una ranura", ranuras(g) === 1, "ranuras=" + ranuras(g));
	}
	{
		const g = await boot(baseSave(distintos(30), { nanites: 2e5 }));
		const capAntes = s(g).warehouseCapacity;
		const r = g.buyStoreItem("warehouseSlot");
		check("capacidad: la ampliacion de almacen SI se compra con el almacen lleno", r !== false, String(r));
		check("capacidad: y sube la capacidad 5", s(g).warehouseCapacity === capAntes + 5, `${capAntes} -> ${s(g).warehouseCapacity}`);
		check("capacidad: sin meter un item de mas", ranuras(g) === 30, "ranuras=" + ranuras(g));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 5)], {
			nanites: 2e5,
			warehouseCapacity: 1
		}));
		check("capacidad: una ranura y una pila de cajas = almacen lleno", ranuras(g) === 1, "ranuras=" + ranuras(g) + "/" + g.getCapacity());
		const antes = nanites(g);
		const r = g.buyStoreItem("commonCrate");
		check("capacidad: con el almacen lleno, una caja que cabe en la pila SI se compra", r !== false, String(r));
		check("capacidad: se suma a la pila sin abrir ranura nueva", ranuras(g) === 1 && find(g, "c1")?.stackCount === 6, "ranuras=" + ranuras(g) + " unidades=" + find(g, "c1")?.stackCount);
		check("capacidad: y se paga una sola vez", nanites(g) === antes - STORE_ITEMS.commonCrate.cost, "nanites=" + nanites(g));
	}
	{
		const g = await boot(baseSave([crate("c1", "common", 5)], {
			nanites: 2e5,
			warehouseCapacity: 1
		}));
		const antes = nanites(g);
		const r = g.buyStoreItem("epicCrate");
		check("capacidad: un item que necesita ranura nueva se rechaza con el almacen lleno", r === false, String(r));
		check("capacidad: y no se cobra", nanites(g) === antes, "nanites=" + nanites(g));
		check("capacidad: la pila existente no cambia", find(g, "c1")?.stackCount === 5, "unidades=" + find(g, "c1")?.stackCount);
	}
	{
		const r = (await boot(baseSave([crate("c1", "common", 5)], {
			nanites: 2e5,
			warehouseCapacity: 1
		}))).buyStoreItem("collectorCardT1");
		check("capacidad: una carta de recolector con el almacen lleno se rechaza", r === false, String(r));
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			warehouseCapacity: 1
		}));
		const r1 = g.buyStoreItem("commonCrate");
		const r2 = g.buyStoreItem("rareCrate");
		check("capacidad: el primer item entra", r1 !== false);
		check("capacidad: el segundo se rechaza al llenarse", r2 === false && ranuras(g) === 1, "ranuras=" + ranuras(g));
		check("capacidad: y solo se cobro una vez", nanites(g) === 2e5 - STORE_ITEMS.commonCrate.cost, "nanites=" + nanites(g));
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			warehouseCapacity: 1,
			nodeLevels: {
				storage_rack: 1,
				scrapyard: 1
			},
			unlockedNodes: ["storage_rack", "scrapyard"]
		}));
		check("capacidad: la capacidad efectiva suma los slots del arbol", g.getCapacity() === 1 + s(g).bonus.storageSlots, `getCapacity=${g.getCapacity()}`);
		const comprados = [
			"commonCrate",
			"rareCrate",
			"epicCrate"
		].filter((k) => g.buyStoreItem(k) !== false).length;
		check("capacidad: se pueden llenar los huecos del arbol", comprados === s(g).bonus.storageSlots, `comprados=${comprados} bonus=${s(g).bonus.storageSlots}`);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			maxCompanionSlots: 1
		}));
		const r1 = g.buyStoreItem("companionSlot1");
		check("permisos: el primer hueco de companero se compra", r1 !== false, String(r1));
		check("permisos: y sube los slots a 2", s(g).maxCompanionSlots === 2, "slots=" + s(g).maxCompanionSlots);
		const r2 = g.buyStoreItem("companionSlot1");
		check("permisos: comprarlo dos veces se rechaza", r2 === false, String(r2));
		check("permisos: y no se cobra la segunda", s(g).maxCompanionSlots === 2, "slots=" + s(g).maxCompanionSlots);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			maxCompanionSlots: 1
		}));
		const r = g.buyStoreItem("companionSlot2");
		check("permisos: la segunda ranura se compra", r !== false, String(r));
		check("permisos: y lleva los slots donde dice la tabla", s(g).maxCompanionSlots === COMPANION_SLOT_BUY[1].da, "slots=" + s(g).maxCompanionSlots + " tabla=" + COMPANION_SLOT_BUY[1].da);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			maxCompanionSlots: 2,
			nodeLevels: {
				squad_slots: 1,
				passive_loop: 1,
				core_sink: 1
			},
			unlockedNodes: [
				"squad_slots",
				"passive_loop",
				"core_sink"
			]
		}));
		check("permisos: el slot del arbol suma al total efectivo", g.getCompanionSlots() === 3, "slots=" + g.getCompanionSlots());
		const r = g.buyStoreItem("companionSlot2");
		check("permisos: con 3 slots efectivos se puede comprar la siguiente ranura", r !== false, String(r));
		check("permisos: y lleva los slots donde dice la tabla", s(g).maxCompanionSlots === COMPANION_SLOT_BUY[1].da, "slots=" + s(g).maxCompanionSlots + " tabla=" + COMPANION_SLOT_BUY[1].da);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 2e5,
			maxCompanionSlots: 1,
			nodeLevels: {
				squad_slots: 1,
				passive_loop: 1,
				core_sink: 1
			},
			unlockedNodes: [
				"squad_slots",
				"passive_loop",
				"core_sink"
			]
		}));
		const antes = nanites(g);
		const r = g.buyStoreItem("companionSlot1");
		check("permisos: con 2 slots efectivos no se cobra un hueco que ya se tiene", r === false && nanites(g) === antes, `ok=${r} nanites=${nanites(g)}`);
	}
	{
		const g = await boot(baseSave([], {
			cores: 100,
			unlockedNodes: [],
			nodeLevels: {}
		}));
		const node = TREE_BY_ID.core_sink;
		const coste = nodeCost(node, 0);
		const antes = s(g).cores;
		const r = g.buyNode("core_sink");
		check("arbol: la compra de un nodo raiz se concede", r.success, r.msg ?? "");
		check("arbol: cobra los nucleos justos", s(g).cores === antes - coste, `cobrado=${antes - s(g).cores} coste=${coste}`);
		check("arbol: sube el nivel del nodo", s(g).nodeLevels.core_sink === 1, "nivel=" + s(g).nodeLevels.core_sink);
		check("arbol: proyecta el nodo en unlockedNodes", s(g).unlockedNodes.includes("core_sink"), s(g).unlockedNodes.join(","));
		check("arbol: aplica la bonificacion del nodo", s(g).bonus.passiveMult > 0, "passiveMult=" + s(g).bonus.passiveMult);
		const g2 = await reload();
		check("arbol: el nodo comprado sobrevive a la recarga", s(g2).nodeLevels.core_sink === 1, "nivel=" + s(g2).nodeLevels.core_sink);
		check("arbol: y la bonificacion se recalcula al cargar", s(g2).bonus.passiveMult > 0, "passiveMult=" + s(g2).bonus.passiveMult);
	}
	{
		const g = await boot(baseSave([], {
			cores: 1e3,
			nodeLevels: { core_sink: 1 },
			unlockedNodes: ["core_sink"]
		}));
		const n1 = nodeCost(TREE_BY_ID.core_sink, 1);
		const antes = s(g).cores;
		const r = g.buyNode("core_sink");
		check("arbol: el segundo nivel se compra", r.success, r.msg ?? "");
		check("arbol: el segundo nivel cuesta MAS que el primero", s(g).cores === antes - n1 && n1 > nodeCost(TREE_BY_ID.core_sink, 0), `nivel2=${n1} nivel1=${nodeCost(TREE_BY_ID.core_sink, 0)}`);
		check("arbol: y acumula el nivel", s(g).nodeLevels.core_sink === 2, "nivel=" + s(g).nodeLevels.core_sink);
		check("arbol: la bonificacion se suma por niveles", s(g).bonus.passiveMult > .15, "passiveMult=" + s(g).bonus.passiveMult);
	}
	{
		const g = await boot(baseSave([], { cores: 1e4 }));
		const r = g.buyNode("auto_clicker");
		check("arbol: sin requisitos no se compra", !r.success && !!r.msg, r.msg ?? "");
		check("arbol: el mensaje nombra el requisito que falta", /Requiere/i.test(r.msg ?? "") && /Filo Afilado/.test(r.msg ?? ""), r.msg ?? "");
		check("arbol: y no se cobran nucleos", s(g).cores === 1e4, "cores=" + s(g).cores);
	}
	{
		const r = (await boot(baseSave([], { cores: 1e4 }))).buyNode("nodoInexistente");
		check("arbol: un nodo inexistente se rechaza", !r.success && !!r.msg, r.msg ?? "");
	}
	{
		const g = await boot(baseSave([], { cores: 0 }));
		const r = g.buyNode("core_sink");
		check("arbol: sin nucleos no se compra", !r.success && !!r.msg, r.msg ?? "");
		check("arbol: y no secreates un nivel fantasma", !s(g).nodeLevels.core_sink, JSON.stringify(s(g).nodeLevels));
	}
	{
		const g = await boot(baseSave([], {
			cores: 1e5,
			nodeLevels: {
				squad_slots: 4,
				passive_loop: 1,
				core_sink: 1
			},
			unlockedNodes: [
				"squad_slots",
				"passive_loop",
				"core_sink"
			]
		}));
		const antes = s(g).cores;
		const r = g.buyNode("squad_slots");
		check("arbol: en el nivel maximo no se compra mas", !r.success && /máximo/i.test(r.msg ?? ""), r.msg ?? "");
		check("arbol: y no se cobran nucleos", s(g).cores === antes, "cores=" + s(g).cores);
	}
	{
		const g = await boot(baseSave([], { cores: 100 }));
		check("forja: antes del nodo la forja esta cerrada", g.getForgeInfo().forgeUnlocked === false);
		g.buyNode("blueprint");
		check("forja: tras comprarlo la forja se abre", g.getForgeInfo().forgeUnlocked === true);
		check("forja: y se abre tambien tras recargar", (await reload()).getForgeInfo().forgeUnlocked === true);
	}
	{
		const g = await boot(baseSave([crate("c1"), {
			...crate("k1"),
			type: "key",
			name: "Llave de Cifrado",
			tier: 0
		}], { warehouseCapacity: 1 }));
		check("capacidad: la partida respeta la capacidad al cargar", wh(g).length <= 1, "items=" + wh(g).length);
	}
	{
		const cartasConItem = [
			"keyT0",
			"keyT1",
			"keyT2",
			"keyT3",
			"upgradeCrystal",
			"commonCrate",
			"rareCrate",
			"epicCrate",
			"legendaryCrate",
			"backpackExpander",
			"afkCard",
			"clickX2Card",
			"clickX3Card",
			"calibrationStone",
			"stabilityNano",
			"companionCardT1",
			"companionCardT5",
			"companionCardT10",
			"collectorCardT1",
			"collectorCardT5",
			"collectorCardT10"
		];
		const abusos = [];
		for (const carta of cartasConItem) {
			const g = await boot(baseSave([], {
				nanites: 1e6,
				warehouseCapacity: 40
			}));
			const antes = nanites(g);
			const comprados = g.buyStoreItem(carta);
			if (!comprados || comprados.ok === false) continue;
			const id = comprados.id;
			if (!id || !find(g, id)) continue;
			const trasComprar = nanites(g);
			if (trasComprar >= antes) {
				abusos.push(`${carta}: la compra no cobro (antes=${antes} despues=${trasComprar})`);
				continue;
			}
			g.sellItem(id);
			const delta = nanites(g) - antes;
			if (delta > 0) abusos.push(`${carta}: cuesta ${STORE_ITEMS[carta].cost} y compra+venta deja +${delta}`);
		}
		check("tienda: NINGUNA carta se revende por mas de lo que costo", abusos.length === 0, abusos.join(" | ") || `${cartasConItem.length} cartas comprobadas, ninguna imprime`);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 1e4,
			warehouseCapacity: 40
		}));
		const antes = nanites(g);
		for (let i = 0; i < 10; i++) {
			const k = g.buyStoreItem("keyT0");
			if (!k || !find(g, k.id)) continue;
			g.sellItem(k.id);
			const c = g.buyStoreItem("upgradeCrystal");
			if (!c || !find(g, c.id)) continue;
			g.sellItem(c.id);
		}
		check("tienda: comprar y vender 10 veces NO crea nanitas", nanites(g) <= antes, `antes=${antes} despues=${nanites(g)} · delta=${nanites(g) - antes}`);
		check("tienda: y el almacen queda como estaba", wh(g).length === 0, "quedan=" + wh(g).length + " ids=" + ids(g).join(","));
	}
	resumen("compra");
}
var buyCheck_default = main();
//#endregion
export { buyCheck_default as default };
