import { K as TIER_SYSTEM, U as STORE_ITEMS } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check } from "./kit-By6xxhWQ.js";
//#region verify/balanceCheck.ts
/** El poder medio del tier, que es el punto medio de su rango. */
function poderMedio(tier) {
	const r = TIER_SYSTEM.ranges[tier];
	return (r[0] + r[1]) / 2;
}
/** El precio de la carta de ese tipo y ese tier. */
function precio(tipo, tier) {
	return STORE_ITEMS[`${tipo}CardT${tier}`].cost;
}
/** Coste por punto de poder, que es la cifra que tiene que estar acotada. */
function porPunto(tipo, tier) {
	return precio(tipo, tier) / poderMedio(tier);
}
var TIERS = [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10
];
async function main() {
	{
		const banda = {
			companion: [150, 430],
			collector: [150, 430]
		};
		for (const tipo of ["companion", "collector"]) {
			const ratios = TIERS.map((t) => porPunto(tipo, t));
			const fuera = ratios.filter((r) => r < banda[tipo][0] || r > banda[tipo][1]);
			check(`${tipo}: los diez tiers caen en la banda de 150 a 430 por punto`, fuera.length === 0, `por punto = ${ratios.map((r) => Math.round(r)).join(", ")}`);
			const todos = ratios.every((r, i) => i === 0 || r >= ratios[i - 1] * .98);
			check(`${tipo}: y el coste por punto NUNCA baja al subir de tier`, todos, ratios.map((r) => Math.round(r)).join(", "));
		}
	}
	for (const tipo of ["companion", "collector"]) for (let t = 2; t <= 10; t++) {
		const actual = porPunto(tipo, t);
		const anterior = porPunto(tipo, t - 1);
		check(`${tipo}: el T${t} no sale mejor por punto que el T${t - 1}`, actual > anterior, `T${t}=${Math.round(actual)} T${t - 1}=${Math.round(anterior)}`);
	}
	{
		const distintos = TIERS.filter((t) => precio("companion", t) !== precio("collector", t));
		check("compañero y recolector cuestan lo mismo en los diez tiers", distintos.length === 0, distintos.length ? `difieren en T${distintos.join(", T")}` : "");
		check("el poder del T10 sale del rango, no de una constante inventada", TIER_SYSTEM.ranges[10][1] > 500, `ranges[10]=${JSON.stringify(TIER_SYSTEM.ranges[10])}`);
	}
	{
		const precios = TIERS.map((t) => precio("collector", t));
		const total = precios.reduce((a, b) => a + b, 0);
		const ultimo = precios[precios.length - 1];
		const dosUltimos = precios[8] + precios[9];
		check("el T10 solo es una parte grande del total: llegar al final cuesta", ultimo / total > .35, `T10 = ${ultimo} de ${total} (${Math.round(ultimo / total * 100)}%)`);
		check("y los dos últimos tiers se llevan más de la mitad", dosUltimos / total > .5, `T9+T10 = ${dosUltimos} de ${total} (${Math.round(dosUltimos / total * 100)}%)`);
		check("el juego se estira: de T1 a T10 el precio total se multiplica por más de 8", total / precios[0] > 8, `${precios[0]} -> ${total} = x${(total / precios[0]).toFixed(1)}`);
	}
	{
		const costeDeSubir = (nivel) => Math.max(1, Math.floor(1.2 * Math.pow(1.26, nivel)));
		let cristales = 0;
		for (let l = 0; l < 20; l++) cristales += costeDeSubir(l);
		const enNanitas = cristales * STORE_ITEMS.upgradeCrystal.cost;
		const colector = precio("collector", 10);
		check("sintonizar a nivel 20 no es un botón: cuesta una fracción seria del item", enNanitas / colector > .4, `sintonizar=${enNanitas} recolectorT10=${colector} (${Math.round(enNanitas / colector * 100)}%)`);
		check("ni un segundo en el mismo recolector sale gratis: el cristal tiene un precio real", enNanitas < colector * 2, `${enNanitas} vs ${colector}`);
	}
	resumen("balance: el precio sigue al poder");
}
var balanceCheck_default = main();
//#endregion
export { balanceCheck_default as default };
