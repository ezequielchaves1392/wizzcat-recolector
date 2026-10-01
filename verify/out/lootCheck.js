import { A as rollCrateReward, C as buildRouletteStrip, D as makeRouletteTile, G as crateCosmetics, T as lootAmountText, W as COSMETICS_BY_ID, Y as formatNumber, b as CRATE_META, w as isCountedLoot, y as CRATE_LOOT } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check } from "./kit-By6xxhWQ.js";
//#region verify/lootCheck.ts
var CAJAS = Object.keys(CRATE_LOOT);
/**
* Un aplicador de mentira que lleva la cuenta de lo aplicado.
*
* Es la firma real de `LootApplier`, no una reimplementación: si esa firma
* cambia, esto deja de compilar en vez de seguir pasando en verde.
*/
function crearApplier(tieneEspacio = true, yaTiene = []) {
	const cuenta = {
		nanitas: 0,
		cristales: 0,
		llaves: 0,
		ids: []
	};
	const poseidos = new Set(yaTiene);
	return {
		cuenta,
		poseidos,
		applier: {
			nanites: (n) => {
				cuenta.nanitas += n;
			},
			crystals: (n) => {
				cuenta.cristales += n;
			},
			keys: (n) => {
				cuenta.llaves += n;
			},
			addItem: () => tieneEspacio,
			hasSpace: () => tieneEspacio,
			unlockCosmetic: (id) => {
				if (poseidos.has(id)) return false;
				poseidos.add(id);
				cuenta.ids.push(id);
				return true;
			},
			ownedCosmetics: () => [...poseidos]
		}
	};
}
/** Cuánto se cobra de un premio, o `null` si no es una cantidad. */
function cobrado(premio, cuenta) {
	if (premio.kind === "nanites") return cuenta.nanitas;
	if (premio.kind === "crystals") return cuenta.cristales;
	if (premio.kind === "keys") return cuenta.llaves;
	return null;
}
async function main() {
	{
		const fallos = [];
		for (const caja of CAJAS) for (let i = 0; i < 3e3; i++) {
			const { cuenta, applier } = crearApplier();
			const premio = rollCrateReward(caja, applier);
			const pagado = cobrado(premio, cuenta);
			if (pagado === null) continue;
			const esperado = `+${formatNumber(pagado)}`;
			if (makeRouletteTile(premio).amount !== esperado) fallos.push(`${caja}: casilla ${makeRouletteTile(premio).amount}, cobrado ${pagado}`);
			if (!premio.label.includes(String(pagado))) fallos.push(`${caja}: la etiqueta "${premio.label}" no dice ${pagado}`);
			if (fallos.length > 4) break;
		}
		check("botín: la casilla enseña la cifra exacta que entra en la cuenta", fallos.length === 0, fallos.slice(0, 3).join(" | "));
	}
	{
		const uno = lootAmountText({ amount: 999 });
		const otro = lootAmountText({ amount: 10833 });
		check("botín: la cifra usa el formato de los contadores", uno === `+${formatNumber(999)}` && otro === `+${formatNumber(10833)}`, `${uno} / ${otro}`);
	}
	{
		const conCifra = (kind, amount) => isCountedLoot({
			kind,
			amount
		});
		check("botín: nanitas, cristales y llaves siempre enseñan su cantidad", conCifra("nanites", 1) && conCifra("crystals", 1) && conCifra("keys", 1), [
			conCifra("nanites", 1),
			conCifra("crystals", 1),
			conCifra("keys", 1)
		].join(","));
		check("botín: un objeto de a uno no enseña \"+1\"", !conCifra("companion", 1) && !conCifra("collector", 1) && !conCifra("cosmetic", 1), "companion, collector y cosmetic");
		check("botín: pero varios de una vez, sí", conCifra("crate", 2) && conCifra("consumable", 2) && !conCifra("crate", 1), "crate x2 sí, crate x1 no");
	}
	{
		let tirasMalas = 0;
		for (const caja of CAJAS) for (let i = 0; i < 200; i++) {
			const { tiles } = buildRouletteStrip(caja, 26);
			if (tiles.length !== 26) tirasMalas++;
			if (tiles.some((t) => !t.label || !t.rarity || !t.icon)) tirasMalas++;
		}
		check("ruleta: la tira se llena entera y ninguna casilla queda sin texto", tirasMalas === 0, "tiras con huecos=" + tirasMalas);
	}
	{
		const conEntrada = CAJAS.filter((c) => CRATE_LOOT[c].some((e) => e.id === "cosmetic"));
		const sueltos = Object.values(COSMETICS_BY_ID).filter((c) => c.unlock.kind === "crate").filter((c) => !conEntrada.includes(c.unlock.value));
		check("cosméticos: ninguno declara una caja que no lo sortea", sueltos.length === 0, sueltos.map((c) => c.id).join(","));
		const sinNada = conEntrada.filter((c) => crateCosmetics(c).length === 0);
		check("cosméticos: toda caja con la entrada tiene al menos un cosmético", sinNada.length === 0, sinNada.join(","));
	}
	{
		const vistos = /* @__PURE__ */ new Set();
		for (let i = 0; i < 4e3; i++) {
			const { cuenta, applier } = crearApplier();
			rollCrateReward("legendary", applier);
			cuenta.ids.forEach((id) => vistos.add(id));
		}
		const esperados = crateCosmetics("legendary").map((c) => c.id);
		const faltan = esperados.filter((id) => !vistos.has(id));
		check("cosméticos: los de la legendaria salen todos con el tiempo", faltan.length === 0, `faltan ${faltan.join(",")} de ${esperados.length}`);
	}
	{
		const { cuenta, applier, poseidos } = crearApplier();
		for (let i = 0; i < 6e3 && poseidos.size < crateCosmetics("common").length; i++) rollCrateReward("common", applier);
		check("cosméticos: se desbloquean en la lista, no como item del almacén", poseidos.size === crateCosmetics("common").length && cuenta.ids.length === poseidos.size, `desbloqueados=${poseidos.size} veces=${cuenta.ids.length}`);
		const primero = COSMETICS_BY_ID[[...poseidos][0]];
		check("cosméticos: el desbloqueado existe y es de un tipo equipable", Boolean(primero) && [
			"title",
			"frame",
			"banner"
		].includes(primero.type), primero ? `${primero.id}:${primero.type}` : "ninguno");
	}
	{
		const todos = crateCosmetics("legendary").map((c) => c.id);
		let repetidos = 0;
		let compensado = 0;
		for (let i = 0; i < 4e3; i++) {
			const { applier } = crearApplier(true, todos);
			const premio = rollCrateReward("legendary", applier);
			if (premio.cosmeticId) repetidos++;
			if (premio.details.includes("cosméticos")) compensado++;
		}
		check("cosméticos: con los de la caja en la mano no se sortea ninguno", repetidos === 0, `repetidos=${repetidos} de ${todos.length} posibles`);
		check("cosméticos: sin novedades, el premio son nanitas y no un repetido", compensado > 0, "veces=" + compensado);
	}
	{
		const { cuenta, applier, poseidos } = crearApplier(false);
		let cosmeticos = 0;
		for (let i = 0; i < 6e3; i++) if (rollCrateReward("common", applier).kind === "cosmetic") cosmeticos++;
		check("cosméticos: con el almacén lleno el cosmético entra igual", cosmeticos > 0 && poseidos.size === crateCosmetics("common").length, `veces=${cosmeticos} desbloqueados=${poseidos.size}`);
		check("cosméticos: y ninguno se compensó por falta de sitio", cuenta.ids.length === poseidos.size, `ids=${cuenta.ids.length} desbloqueados=${poseidos.size}`);
	}
	{
		const coste = Math.round(CRATE_META.legendary.cost * 1.5);
		let porAlmacen = 0;
		let porDuplicado = 0;
		const sinEspacio = crearApplier(false);
		const conTodo = crearApplier(true, crateCosmetics("legendary").map((c) => c.id));
		for (let i = 0; i < 4e3; i++) {
			const a = rollCrateReward("legendary", sinEspacio.applier);
			if (a.details === "No cabía el objeto, se compensó en nanitas") porAlmacen = a.amount;
			const b = rollCrateReward("legendary", conTodo.applier);
			if (b.details.includes("Ya tienes todos")) porDuplicado = b.amount;
		}
		check("cosméticos: el duplicado paga lo mismo que el almacén lleno", porAlmacen === coste && porDuplicado === coste, `almacén=${porAlmacen} duplicado=${porDuplicado} coste=${coste}`);
	}
	{
		let fantasma = "";
		for (const caja of CAJAS) for (let i = 0; i < 2e3; i++) {
			const { cuenta, applier } = crearApplier();
			const premio = rollCrateReward(caja, applier);
			for (const id of cuenta.ids) if (!COSMETICS_BY_ID[id]) fantasma = id;
			if (premio.cosmeticId && !COSMETICS_BY_ID[premio.cosmeticId]) fantasma = premio.cosmeticId;
		}
		check("cosméticos: ningún premio trae un id que no exista en el catálogo", fantasma === "", fantasma);
	}
	{
		let mal = "";
		for (const caja of CAJAS) for (let i = 0; i < 2e3; i++) {
			const premio = rollCrateReward(caja, crearApplier().applier);
			if (!premio.cosmeticId) continue;
			const cos = COSMETICS_BY_ID[premio.cosmeticId];
			if (cos && (premio.rarity !== cos.rarity || premio.name !== cos.name)) mal = premio.cosmeticId;
		}
		check("cosméticos: el nombre y la rareza del premio son los del catálogo", mal === "", mal);
	}
	{
		const tope = {
			common: 1,
			rare: 2,
			epic: 3,
			legendary: 5
		};
		const escala = {
			"Común": 0,
			"Raro": 1,
			"Épico": 2,
			"Legendario": 3,
			"Mítico": 4,
			"Divino": 5
		};
		const pasadas = [];
		for (const caja of CAJAS) for (const cos of crateCosmetics(caja)) if (escala[cos.rarity] > tope[caja]) pasadas.push(`${cos.id} en ${caja}`);
		check("cosméticos: la rareza no supera la de la caja que la reparte", pasadas.length === 0, pasadas.join(", "));
	}
	resumen("botín y cosméticos de caja");
}
var lootCheck_default = main();
//#endregion
export { lootCheck_default as default };
