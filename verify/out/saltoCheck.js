import { E as makeCrateOnlyCompanion, K as TIER_SYSTEM, k as probabilidadDeSalto, x as CRATE_ONLY_COMPANIONS, y as CRATE_LOOT } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check } from "./kit-By6xxhWQ.js";
//#region verify/saltoCheck.ts
var CAJAS = [
	"common",
	"rare",
	"epic",
	"legendary"
];
/** Cuenta cuántas veces sale una entrada concreta en `n` sorteos reales. */
function vecesQueSale(c, id, n = 2e4) {
	const tabla = CRATE_LOOT[c];
	const total = tabla.reduce((s, e) => s + e.weight, 0);
	let veces = 0;
	for (let i = 0; i < n; i++) {
		let r = Math.random() * total;
		for (const e of tabla) {
			r -= e.weight;
			if (r < 0) {
				if (e.id === id) veces++;
				break;
			}
		}
	}
	return veces;
}
function sumarPesos(c) {
	return CRATE_LOOT[c].reduce((s, e) => s + e.weight, 0);
}
async function main() {
	for (const c of CAJAS) {
		const p = probabilidadDeSalto(c);
		check(`salto: ${c} da botín de arriba entre 1% y 8%`, p >= .01 && p <= .08, `${(p * 100).toFixed(2)}% (peso ${CRATE_LOOT[c].find((e) => e.id === "up")?.weight} de ${sumarPesos(c)})`);
	}
	for (const c of CAJAS) {
		const teorica = probabilidadDeSalto(c);
		const TIRADAS = 2e4;
		const medida = vecesQueSale(c, "up", TIRADAS) / TIRADAS;
		check(`salto: ${c} la tirada real da lo que dice la tabla`, Math.abs(medida - teorica) < .01, `medida=${(medida * 100).toFixed(2)}% tabla=${(teorica * 100).toFixed(2)}% en ${TIRADAS} tiradas`);
	}
	for (const c of CAJAS) {
		const entrada = CRATE_LOOT[c].find((e) => e.id === "up");
		check(`salto: ${c} tiene entrada de salto en la tabla`, entrada !== void 0, "sin entrada");
		const TOPE_PROPIO = {
			common: 1,
			rare: 4,
			epic: 6,
			legendary: 8
		};
		const salto = CRATE_LOOT[c].find((e) => e.id === "up");
		const esperados = /* @__PURE__ */ new Set([TOPE_PROPIO[c], TOPE_PROPIO[c] + 1]);
		const p = salto.build({ ownedCosmetics: [] });
		check(`salto: ${c} da T${TOPE_PROPIO[c] + 1}, nunca más`, esperados.has(p.tier), `tier=${p.tier} en una caja cuyo tope propio es T${TOPE_PROPIO[c]}`);
		check(`salto: el anuncio y el item son del mismo tier`, p.item?.tier === p.tier, `anuncia T${p.tier} y el item es T${p.item?.tier}`);
	}
	{
		const entrada = CRATE_LOOT.common.find((e) => e.id === "up");
		let maxTier = 0;
		for (let i = 0; i < 3e3; i++) {
			const p = entrada.build({ ownedCosmetics: [] });
			if (p.tier > maxTier) maxTier = p.tier;
		}
		check("salto: la caja comun sube a lo sumo a T2", maxTier === 2, `tier maximo=${maxTier}`);
	}
	{
		const indiceDelFantasmaAzulado = 5;
		const fantasma = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[indiceDelFantasmaAzulado]);
		check("D1: el compañero existe y se puede construir", !!fantasma?.item?.name && typeof fantasma.item.power === "number", JSON.stringify({
			nombre: fantasma?.item?.name,
			poder: fantasma?.item?.power
		}));
		const leyenda = CRATE_LOOT.legendary.map((e) => ({
			id: e.id,
			b: e.build({ ownedCosmetics: [] })
		}));
		const loUsa = leyenda.some(({ b }) => b.item?.name === fantasma.item.name);
		check("D1: y sale de la caja legendaria", loUsa, `buscando "${fantasma.item.name}" entre ${leyenda.length} entradas`);
		const entrada = CRATE_LOOT.legendary.find((e) => e.build({ ownedCosmetics: [] }).item?.name === fantasma.item.name);
		const totalLegendaria = sumarPesos("legendary");
		const peso = entrada?.weight ?? 0;
		const prob = peso / totalLegendaria;
		check("D1: y sale poco, para que siga siendo exclusivo", prob > 0 && prob <= .05, `${(prob * 100).toFixed(2)}% (peso ${peso} de ${totalLegendaria})`);
		for (let i = 0; i < indiceDelFantasmaAzulado; i++) {
			const nombre = CRATE_ONLY_COMPANIONS[i].name;
			const enTabla = CAJAS.some((c) => CRATE_LOOT[c].some((e) => e.build({ ownedCosmetics: [] }).item?.name === nombre));
			check(`D1: el índice ${i} (${nombre}) sigue saliendo de alguna caja`, enTabla, nombre);
		}
	}
	for (const c of CAJAS) {
		const tabla = CRATE_LOOT[c];
		const total = sumarPesos(c);
		const sinSalto = total - tabla.find((e) => e.id === "up").weight;
		const pesoUp = tabla.find((e) => e.id === "up").weight;
		check(`salto: ${c} no se come la caja (el resto pesa ${sinSalto} de ${total})`, sinSalto / total >= .85, `el salto se lleva el ${(pesoUp / total * 100).toFixed(1)}% y queda ${(sinSalto / total * 100).toFixed(1)}%`);
	}
	for (const c of CAJAS) {
		const entrada = CRATE_LOOT[c].find((e) => e.id === "up");
		const vistos = /* @__PURE__ */ new Set();
		let sinNombre = 0;
		for (let i = 0; i < 600; i++) {
			const p = entrada.build({ ownedCosmetics: [] });
			if (typeof p.name !== "string" || !p.name || p.name === "undefined") sinNombre++;
			else vistos.add(p.name);
			if (p.item && (typeof p.item.name !== "string" || !p.item.name)) sinNombre++;
		}
		check(`salto: ${c} siempre da un nombre de verdad`, sinNombre === 0, `sin nombre en ${sinNombre} de 600 tiradas`);
		check(`salto: ${c} da varios nombres distintos, no uno fijo`, vistos.size >= 2, `nombres distintos=${[...vistos].join(" | ")}`);
	}
	{
		const entrada = CRATE_LOOT.legendary.find((e) => e.id === "up");
		for (let i = 0; i < 300; i++) {
			const p = entrada.build({ ownedCosmetics: [] });
			if (p.kind !== "companion") continue;
			const rango = TIER_SYSTEM.ranges[p.tier];
			if (!rango) {
				check("salto: el tier del salto existe en TIER_SYSTEM", false, `tier=${p.tier}`);
				break;
			}
			const ok = p.item.power >= rango[0] && p.item.power <= rango[1];
			check("salto: el poder sale del rango de su tier", ok, `tier=${p.tier} rango=${JSON.stringify(rango)} power=${p.item.power}`);
			break;
		}
	}
	resumen("salto: la probabilidad baja de botín de arriba, y el que faltaba");
}
var saltoCheck_default = main();
//#endregion
export { saltoCheck_default as default };
