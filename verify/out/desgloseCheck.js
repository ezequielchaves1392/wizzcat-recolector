import { S as resumen, a as check, n as baseSave, o as collector, r as boot } from "./kit-By6xxhWQ.js";
//#region verify/desgloseCheck.ts
async function main() {
	for (const c of [
		{
			nombre: "nivel 0, sin nada más",
			damage: 5,
			level: 0,
			over: {}
		},
		{
			nombre: "nivel 4",
			damage: 5,
			level: 4,
			over: {}
		},
		{
			nombre: "nivel 19 (el tope habitual)",
			damage: 5,
			level: 19,
			over: {}
		},
		{
			nombre: "daño que no es redondo",
			damage: 13,
			level: 7,
			over: {}
		},
		{
			nombre: "daño grande",
			damage: 466,
			level: 12,
			over: {}
		}
	]) {
		const g = await boot(baseSave([collector("r1", 3, {
			damage: c.damage,
			level: c.level
		})], { nanites: 0 }));
		g.equipCollector("r1");
		const d = g.getClickDamageBreakdown?.();
		check(`${c.nombre}: el desglose existe`, d && typeof d.total === "number", `desglose=${JSON.stringify(d)}`);
		if (d) {
			check(`${c.nombre}: base + nivel + bonos === total`, d.base + d.porNivel + d.porBonos === d.total, `${d.base} + ${d.porNivel} + ${d.porBonos} = ${d.base + d.porNivel + d.porBonos} pero el total es ${d.total}`);
			check(`${c.nombre}: el total es el mismo que cobra el click`, d.total === g.getClickDamage(), `desglose=${d.total} getClickDamage=${g.getClickDamage()}`);
			check(`${c.nombre}: ninguna parte es negativa`, d.base >= 0 && d.porNivel >= 0 && d.porBonos >= 0, JSON.stringify(d));
		}
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 100,
			level: 10
		})], { nanites: 0 }));
		g.equipCollector("r1");
		const d = g.getClickDamageBreakdown?.();
		check("con nivel 10, la parte de nivel es REAL y no cero", (d?.porNivel ?? 0) > 0, `porNivel=${d?.porNivel} total=${d?.total}`);
		check("y vale exactamente lo que dice la fórmula (nivel 10 = x2,0 sobre 100)", d?.porNivel === 100, `porNivel=${d?.porNivel} total=${d?.total}`);
		const g0 = await boot(baseSave([collector("r1", 3, {
			damage: 100,
			level: 0
		})], { nanites: 0 }));
		g0.equipCollector("r1");
		const d0 = g0.getClickDamageBreakdown?.();
		check("con nivel 0 la parte de nivel es 0, para que la vista pueda ocultarla", d0?.porNivel === 0, `porNivel=${d0?.porNivel}`);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 100,
			level: 5
		})], { nanites: 0 }));
		g.equipCollector("r1");
		const antes = g.getClickDamageBreakdown?.();
		check("sin buff, el total es el mismo que cobra el click", antes?.total === g.getClickDamage(), `total=${antes?.total} damage=${g.getClickDamage()}`);
		g.getState().buffs.clickBoostExpiresAt = Date.now() + 6e4;
		const conBuff = g.getClickDamageBreakdown?.();
		check("con el buff x2 el total sube", conBuff?.total > (antes?.total ?? 0), `antes=${antes?.total} conBuff=${conBuff?.total}`);
		check("con buff, la parte de NIVEL no se mueve", conBuff?.porNivel === antes?.porNivel, `nivel antes=${antes?.porNivel} conBuff=${conBuff?.porNivel}`);
		check("y el efecto entero del buff cae en BONOS", (conBuff?.porBonos ?? 0) - (antes?.porBonos ?? 0) === (conBuff?.total ?? 0) - (antes?.total ?? 0), `bonos ${antes?.porBonos}->${conBuff?.porBonos} mientras el total ${antes?.total}->${conBuff?.total}`);
		check("y las partes siguen cuadrando con el buff puesto", (conBuff?.base ?? 0) + (conBuff?.porNivel ?? 0) + (conBuff?.porBonos ?? 0) === conBuff?.total, `${conBuff?.base} + ${conBuff?.porNivel} + ${conBuff?.porBonos} vs ${conBuff?.total}`);
		g.getState().buffs.clickBoostExpiresAt = 0;
		const tras = g.getClickDamageBreakdown?.();
		check("al expirar el buff, el desglose vuelve al que había", tras?.total === antes?.total, `antes=${antes?.total} tras=${tras?.total}`);
	}
	{
		const d = (await boot(baseSave([], { nanites: 0 }))).getClickDamageBreakdown?.();
		check("sin recolector equipado el desglose es todo cero, no undefined", d && d.total === 0 && d.base === 0 && d.porNivel === 0 && d.porBonos === 0, `desglose=${JSON.stringify(d)}`);
		check("y por eso la vista no pinta ninguna línea de desglose", d?.total === 0, `total=${d?.total}`);
	}
	resumen("desglose: las partes suman el total");
}
var desgloseCheck_default = main();
//#endregion
export { desgloseCheck_default as default };
