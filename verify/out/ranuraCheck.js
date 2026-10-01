import { H as RANURA_POR_CARTA, L as COMPANION_SLOT_BUY, R as COMPANION_SLOT_COSTS, U as STORE_ITEMS } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check, n as baseSave, r as boot, x as reload } from "./kit-By6xxhWQ.js";
//#region verify/ranuraCheck.ts
/** Una partida con `slots` ranuras y dinero de sobra. */
function partidaConSlots(slots = 1) {
	return baseSave([], {
		nanites: 5e7,
		maxCompanionSlots: slots
	});
}
async function main() {
	{
		check("la primera compra da 2 ranuras", COMPANION_SLOT_BUY[0]?.da === 2, JSON.stringify(COMPANION_SLOT_BUY[0]));
		check("y la última da el tope de la tienda", COMPANION_SLOT_BUY[COMPANION_SLOT_BUY.length - 1]?.da === 6, `ultima=${COMPANION_SLOT_BUY[COMPANION_SLOT_BUY.length - 1]?.da} tope=6`);
		let anterior = 1;
		for (const compra of COMPANION_SLOT_BUY) {
			check(`"${compra.etiqueta}" da más ranuras que la anterior`, compra.da > anterior, `${anterior} -> ${compra.da}`);
			check(`y no de más de 2 de golpe (era el +3)`, compra.da - anterior <= 2, `salto=${compra.da - anterior}`);
			anterior = compra.da;
		}
		check("hay una carta de tienda por cada fila de la tabla", Object.keys(RANURA_POR_CARTA).length === COMPANION_SLOT_BUY.length, `cartas=${Object.keys(RANURA_POR_CARTA).length} filas=${COMPANION_SLOT_BUY.length}`);
		for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
			const carta = `companionSlot${i + 1}`;
			check(`la carta ${carta} existe en STORE_ITEMS`, STORE_ITEMS[carta] !== void 0, carta);
			check(`y su precio sale de COMPANION_SLOT_COSTS`, STORE_ITEMS[carta]?.cost === COMPANION_SLOT_COSTS[i + 1], `carta=${STORE_ITEMS[carta]?.cost} tabla=${COMPANION_SLOT_COSTS[i + 1]}`);
		}
	}
	{
		for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
			const carta = `companionSlot${i + 1}`;
			const esperado = COMPANION_SLOT_BUY[i].da;
			const g = await boot(partidaConSlots(1));
			for (let j = 0; j <= i; j++) g.buyStoreItem(`companionSlot${j + 1}`);
			check(`compra: ${carta} deja las ${esperado} ranuras que dice`, g.getCompanionSlots() === esperado, `esperado=${esperado} real=${g.getCompanionSlots()}`);
		}
		const g = await boot(baseSave([], {
			nanites: 5e7,
			maxCompanionSlots: 1,
			nodeLevels: { squad_slots: 4 }
		}));
		for (let j = 0; j < COMPANION_SLOT_BUY.length; j++) g.buyStoreItem(`companionSlot${j + 1}`);
		const conArbol = g.getCompanionSlots();
		check("compra: con el árbol de por medio, el total supera el tope de la tienda", conArbol > 6, `total=${conArbol} topeTienda=6`);
	}
	for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
		const carta = `companionSlot${i + 1}`;
		const tope = COMPANION_SLOT_BUY[i].da;
		const g = await boot(partidaConSlots(tope));
		check(`compra: ${carta} no se puede volver a comprar en su propio tope`, g.canBuyStoreItem(carta) === false, `slots=${g.getCompanionSlots()} tope=${tope} canBuy=${g.canBuyStoreItem(carta)}`);
		const g2 = await boot(partidaConSlots(tope - 1));
		check(`compra: ${carta} sí se puede comprar si falta al menos una`, g2.canBuyStoreItem(carta) === true, `slots=${g2.getCompanionSlots()} tope=${tope} canBuy=${g2.canBuyStoreItem(carta)}`);
	}
	{
		const porRanura = [];
		let desde = 1;
		for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
			const hasta = COMPANION_SLOT_BUY[i].da;
			const precio = COMPANION_SLOT_COSTS[i + 1];
			porRanura.push(Math.round(precio / (hasta - desde)));
			desde = hasta;
		}
		check("el precio por ranura sube, pero sin saltos", porRanura.every((p, i) => i === 0 || p > porRanura[i - 1]), `precio por ranura = ${porRanura.join(" -> ")}`);
		check("y ningún salto multiplica por más de 4 el precio de la ranura", porRanura.every((p, i) => i === 0 || p <= porRanura[i - 1] * 4), `precio por ranura = ${porRanura.join(" -> ")}`);
		check("y la última ranura sale más cara que un compañero T1 entero (900)", porRanura[porRanura.length - 1] > 900, `ultima=${porRanura[porRanura.length - 1]} — si fuera menor, el escuadrón grande sería barato`);
	}
	for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
		const carta = `companionSlot${i + 1}`;
		const g = await boot(partidaConSlots(1));
		for (let j = 0; j <= i; j++) g.buyStoreItem(`companionSlot${j + 1}`);
		g.buyStoreItem(carta);
		check(`permiso: ${carta} no crea un item en el almacén`, g.getState().warehouse.length === 0, `items=${JSON.stringify(g.getState().warehouse.map((w) => w.id))}`);
		const g2 = await reload();
		check(`permiso: ${carta} sobrevive a la recarga con ${COMPANION_SLOT_BUY[i].da} ranuras`, g2.getCompanionSlots() === COMPANION_SLOT_BUY[i].da, `tras recargar=${g2.getCompanionSlots()}`);
	}
	resumen("ranuras: cuántas hay, cuántas abre cada carta y cuánto cuestan");
}
var ranuraCheck_default = main();
//#endregion
export { ranuraCheck_default as default };
