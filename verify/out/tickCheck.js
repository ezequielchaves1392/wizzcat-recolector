import { S as resumen, a as check, m as ficha, n as baseSave, r as boot, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/tickCheck.ts
/**
* Sustituye `setInterval` por uno que recoge los callbacks.
*
* Guarda el original y devuelve el restaurador: los bancos se ejecutan todos en
* el mismo proceso, y dejar el `setInterval` cambiado es exactamente el tipo de
* banco que se apaga solo en cuanto le toca hablar a otro.
*/
function capturarIntervalos() {
	const lista = [];
	const original = globalThis.setInterval;
	const originalClear = globalThis.clearInterval;
	globalThis.setInterval = ((fn, ms) => {
		lista.push({
			fn,
			ms: Number(ms) || 0
		});
		return lista.length;
	});
	globalThis.clearInterval = (() => {});
	return {
		lista,
		restaurar() {
			globalThis.setInterval = original;
			globalThis.clearInterval = originalClear;
		}
	};
}
/** El tick del juego: el único intervalo de medio segundo que pide. */
function tickDe(lista) {
	const deMedioSegundo = lista.filter((i) => i.ms === 500);
	const elegido = deMedioSegundo[deMedioSegundo.length - 1];
	if (!elegido) throw new Error("el game loop no ha registrado ningún intervalo de 500 ms");
	return elegido.fn;
}
/** Una partida con un compañero activo de `power` y todo lo demás a cero. */
function partidaConPasivo(power, tipo = "passive") {
	return baseSave([], {
		nanites: 0,
		totalNanitesProduced: 0,
		companions: [ficha("c1", 1, {
			power,
			type: tipo
		})],
		activeCompanions: ["c1"],
		maxCompanionSlots: 3
	});
}
async function main() {
	{
		const { lista, restaurar } = capturarIntervalos();
		try {
			const g = await boot(partidaConPasivo(5));
			const tick = tickDe(lista);
			const pasivo = g.getState().passiveIncome;
			check("con +5/s el HUD anuncia 5", pasivo === 5, "passiveIncome=" + pasivo);
			check("un cobro por segundo, no medio", pasivo === 5 && Number.isInteger(pasivo), "passiveIncome=" + pasivo);
			tick();
			check("medio segundo: todavía no entra nada", nanites(g) === 0, "saldo=" + nanites(g));
			tick();
			check("al segundo: entran los 5 de golpe", nanites(g) === 5, "saldo=" + nanites(g));
			tick();
			check("otro medio segundo: el saldo se queda quieto", nanites(g) === 5, "saldo=" + nanites(g));
			tick();
			check("al siguiente segundo: otros 5", nanites(g) === 10, "saldo=" + nanites(g));
		} finally {
			restaurar();
		}
	}
	{
		const { lista, restaurar } = capturarIntervalos();
		try {
			const g = await boot(partidaConPasivo(7));
			const tick = tickDe(lista);
			const visto = [];
			for (let i = 0; i < 4; i++) {
				tick();
				visto.push(nanites(g));
			}
			check("con +7/s el segundo entra entero y de una vez", JSON.stringify(visto) === JSON.stringify([
				0,
				7,
				7,
				14
			]), "saldos=" + JSON.stringify(visto));
			check("con +7/s nunca hay un saldo con decimales", visto.every((n) => Number.isInteger(n)), "saldos=" + JSON.stringify(visto));
		} finally {
			restaurar();
		}
	}
	{
		const { lista, restaurar } = capturarIntervalos();
		try {
			const g = await boot(partidaConPasivo(5));
			const tick = tickDe(lista);
			const cobros = [];
			let anterior = nanites(g);
			for (let i = 0; i < 10; i++) {
				tick();
				const saldo = nanites(g);
				if (saldo !== anterior) cobros.push(saldo - anterior);
				anterior = saldo;
			}
			check("diez ticks = cinco cobros", cobros.length === 5, "cobros=" + JSON.stringify(cobros));
			check("cada cobro vale el ingreso entero", cobros.every((c) => c === 5), "cobros=" + JSON.stringify(cobros));
			check("el total sigue siendo 5 por segundo", nanites(g) === 25, "saldo=" + nanites(g));
			check("lo producido lleva la misma cuenta que el saldo", g.getState().totalNanitesProduced === nanites(g), "producido=" + g.getState().totalNanitesProduced + " saldo=" + nanites(g));
		} finally {
			restaurar();
		}
	}
	{
		const { lista, restaurar } = capturarIntervalos();
		try {
			const g = await boot(partidaConPasivo(3, "click"));
			const tick = tickDe(lista);
			const visto = [];
			for (let i = 0; i < 4; i++) {
				tick();
				visto.push(nanites(g));
			}
			check("un compañero de click también cobra entero", JSON.stringify(visto) === JSON.stringify([
				0,
				3,
				3,
				6
			]), "saldos=" + JSON.stringify(visto));
		} finally {
			restaurar();
		}
	}
	{
		const { lista, restaurar } = capturarIntervalos();
		const visibilidadOriginal = document.visibilityState;
		try {
			const g = await boot(baseSave([], {
				nanites: 0,
				totalNanitesProduced: 0,
				companions: [ficha("c1", 1, {
					power: 5,
					type: "passive"
				})],
				activeCompanions: ["c1"],
				maxCompanionSlots: 3
			}));
			const tick = tickDe(lista);
			const reloj = g.getState();
			const realNow = Date.now;
			let falso = realNow();
			Date.now = () => falso;
			try {
				falso = realNow();
				for (let i = 0; i < 4; i++) tick();
				const antesDelUmbral = nanites(g);
				check("B9: mirando y activo, el ingreso entra", antesDelUmbral > 0, "saldo=" + antesDelUmbral);
				falso = realNow() + 61e3;
				for (let i = 0; i < 4; i++) tick();
				const despues = nanites(g);
				check("B9: sin hacer nada, el ingreso se corta solo", despues === antesDelUmbral, `antes=${antesDelUmbral} despues=${despues}`);
				check("B9: y ni un tick más de los cuatro cobra nada", nanites(g) === antesDelUmbral, "saldo=" + nanites(g));
				check("B9: y el estado dice AFK, para que lo que se ve sea lo que pasa", g.isAfk() === true, "isAfk=" + g.isAfk());
				reloj.bonus.autoClick = .5;
				falso = realNow() + 61e3;
				const antesConArbol = nanites(g);
				for (let i = 0; i < 200; i++) tick();
				const conArbol = nanites(g);
				check("B9: el árbol estaba tirando clicks y el saldo no se ha movido", conArbol === antesConArbol, `antes=${antesConArbol} conArbol=${conArbol} — si el corte del AFK no alcanzara al árbol, aquí habría entrado daño de sus clicks`);
				check("B9: y aun así, con el árbol trabajando, el AFK se mantiene", g.isAfk() === true, "isAfk=" + g.isAfk());
			} finally {
				Date.now = realNow;
			}
		} finally {
			document.visibilityState = visibilidadOriginal;
			restaurar();
		}
	}
	{
		const { lista, restaurar } = capturarIntervalos();
		const visibilidadOriginal = document.visibilityState;
		try {
			const g = await boot(partidaConPasivo(5));
			const tick = tickDe(lista);
			tick();
			tick();
			const antes = nanites(g);
			document.visibilityState = "hidden";
			for (let i = 0; i < 10; i++) tick();
			check("con la pestaña oculta no entra ni un nanita", nanites(g) === antes, "saldo=" + nanites(g) + " antes=" + antes);
		} finally {
			document.visibilityState = visibilidadOriginal;
			restaurar();
		}
	}
	resumen("tick: el ingreso pasivo entra entero y a su ritmo");
}
var tickCheck_default = main();
//#endregion
export { tickCheck_default as default };
