import { S as resumen, a as check, m as ficha, n as baseSave, o as collector, r as boot, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/senalCheck.ts
/**
* Sustituye `setInterval` por uno que APARTA los callbacks, y dispara el de
* 500 ms a mano.
*
* Es el mismo truco que `tickCheck`, duplicado aquí a propósito: los dos bancos
* necesitan el tick de verdad y ninguno debe depender del otro, porque si uno
* importara la ayuda del otro, un fallo en el compartido se leería como un
* fallo de los dos.
*
* POR QUÉ EL `boot` VA DENTRO Y NO FUERA. El tick solo se registra si el jugador
* está presente, y eso lo decide `isPlayerPresent()` en el momento de construir
* el game loop. Sustituir `setInterval` antes de `boot()` es lo único que
* garantiZa que el intervalo existe; si se hiciera después, la lista saldría
* vacía y este banco reventaría con "no ha registrado ningún intervalo" —que es
* un mensaje que señala al banco y no a la causa.
*/
async function conTick(fn, save) {
	const lista = [];
	const original = globalThis.setInterval;
	const originalClear = globalThis.clearInterval;
	globalThis.setInterval = ((f, ms) => {
		lista.push({
			fn: f,
			ms: Number(ms) || 0
		});
		return lista.length;
	});
	globalThis.clearInterval = (() => {});
	try {
		const g = await boot(save);
		const deMedio = lista.filter((i) => i.ms === 500);
		const elegido = deMedio[deMedio.length - 1];
		if (!elegido) throw new Error("el game loop no ha registrado ningún intervalo de 500 ms");
		await fn(elegido.fn, g);
	} finally {
		globalThis.setInterval = original;
		globalThis.clearInterval = originalClear;
	}
}
/** Una partida con varios compañeros activos y todo lo demás a cero. */
function partidaCon(...fichas) {
	return baseSave([collector("r1")], {
		nanites: 0,
		totalNanitesProduced: 0,
		companions: fichas,
		activeCompanions: fichas.map((f) => f.id),
		maxCompanionSlots: 5
	});
}
/**
* Una partida con N clics automáticos por segundo.
*
* POR QUÉ PASA POR `nodeLevels` Y NO POR `bonus.autoClick`. `bonus` es un
* campo DERIVADO: al cargar el save se recalcula con `recomputeBonuses()` a
* partir de `nodeLevels`, que es la fuente de verdad. Poner `autoClick` a mano
* en el save no llega a ninguna parte —la carga lo pisa— y el banco se quedaba
* esperando clicks que no ocurrían nunca.
*
* El nodo es `auto_clicker`, que da 0,5 por nivel, así que `clicsPorSegundo * 2`
* niveles son los que hacen falta. El identificador sale de `data/tree.ts` y el
* BONUS de ese nodo es el del juego: aquí no se reimplementa ninguna regla.
*
* Y lleva RECOLECTOR EQUIPADO, porque sin él `calculateClickDamage()` da 0 y el
* click automático entra a cero: el aviso se emitía, el saldo no subía, y el
* banco tenía razón sobre el código y sobre la partida mal montada a la vez.
* Un click automático sin recolector no es un caso raro del juego, es una partida
* que todavía no ha equipado nada —y en ese caso no de nada, que es lo
* correcto—; para mirar el aviso hace falta un recolector de verdad.
*/
function partidaAutoClick(clicsPorSegundo) {
	return baseSave([collector("r1", 3, {
		damage: 60,
		level: 4
	})], {
		nanites: 0,
		totalNanitesProduced: 0,
		cores: 999,
		equippedCollectorId: "r1",
		nodeLevels: { auto_clicker: clicsPorSegundo * 2 }
	});
}
/** Reparte el mismo problema entre los tres sitios donde se puede ver. */
function reparto() {
	return [
		{
			nombre: "reparto",
			n: 2,
			pesos: [3, 3]
		},
		{
			nombre: "impar",
			n: 3,
			pesos: [
				1,
				1,
				1
			]
		},
		{
			nombre: "desiguales",
			n: 3,
			pesos: [
				10,
				1,
				1
			]
		},
		{
			nombre: "uno solo",
			n: 1,
			pesos: [7]
		}
	];
}
async function main() {
	for (const caso of reparto()) {
		const fichas = caso.pesos.map((p, i) => ficha("c" + i, 1, {
			power: p,
			type: "passive"
		}));
		await conTick(async (tick, g) => {
			const ingreso = g.getState().passiveIncome;
			const suma = fichas.reduce((a, f) => a + (typeof g.getCompanionOutput === "function" ? g.getCompanionOutput(f.id) : -1), 0);
			check(`${caso.nombre}: las fichas suman EXACTAMENTE el ingreso`, suma === ingreso, `suma=${suma} ingreso=${ingreso} pesos=${JSON.stringify(caso.pesos)}`);
			check(`${caso.nombre}: y ninguna ficha se queda sin su parte`, fichas.every((f) => g.getCompanionOutput(f.id) >= 0), fichas.map((f) => `${f.id}=${g.getCompanionOutput(f.id)}`).join(" "));
			const antes = nanites(g);
			for (let i = 0; i < 2; i++) tick();
			check(`${caso.nombre}: el contador sube lo que dicen las fichas`, nanites(g) - antes === ingreso, `subió=${nanites(g) - antes} ingreso=${ingreso}`);
		}, partidaCon(...fichas, ficha("mx", 1, {
			power: .5,
			type: "multiplier"
		})));
	}
	await conTick(async (tick, g) => {
		const ingreso = g.getState().passiveIncome;
		const esperado = 9;
		const mostrado = g.getState().companions.filter((c) => c.type === "passive").reduce((a, c) => a + g.getCompanionOutput(c.id), 0);
		check("con x1,5 el ingreso sube a 9", ingreso === esperado, `ingreso=${ingreso}`);
		check("las fichas dicen 9 y no 6: el power desnudo ya no se enseña", mostrado === esperado && mostrado !== 6, `fichas=${mostrado} (power desnudo seriam 6)`);
		const antes = nanites(g);
		for (let i = 0; i < 2; i++) tick();
		check("y el contador sube 9, que es lo que dicen", nanites(g) - antes === esperado, `subió=${nanites(g) - antes}`);
	}, partidaCon(ficha("c0", 1, {
		power: 3,
		type: "passive"
	}), ficha("c1", 1, {
		power: 3,
		type: "passive"
	}), ficha("mx", 1, {
		power: .5,
		type: "multiplier"
	})));
	await conTick(async (tick, g) => {
		const antes = nanites(g);
		tick();
		tick();
		const pendientes = typeof g.drainClickEvents === "function" ? g.drainClickEvents() : [];
		const sumaAvisos = pendientes.reduce((a, e) => a + e.cantidad, 0);
		check("el árbol emite un aviso por click cobrado", Array.isArray(pendientes) && pendientes.length === 2, "avisos=" + JSON.stringify(pendientes));
		check("y los avisos suman EXACTAMENTE lo que entró en la cuenta", sumaAvisos === nanites(g) - antes, `avisos=${JSON.stringify(pendientes)} suman=${sumaAvisos} entrado=${nanites(g) - antes}`);
		const clima = nanites(g) - antes;
		for (let i = 0; i < 2; i++) tick();
		const mas = nanites(g) - antes - clima;
		const avisos2 = g.drainClickEvents?.() ?? [];
		check("y sigue emitiendo en los segundos siguientes", avisos2.length > 0 && avisos2.reduce((a, e) => a + e.cantidad, 0) === mas, `avisos=${avisos2.length} suma=${avisos2.reduce((a, e) => a + e.cantidad, 0)} entrado=${mas}`);
		check("drainedla vacía la cola", (g.drainClickEvents?.() ?? []).length === 0, "la segunda llamada devolvió avisos");
	}, partidaAutoClick(2));
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 4
		})], { nanites: 1e3 }));
		g.equipCollector("r1");
		const antes = nanites(g);
		const devuelto = g.click();
		const entrado = nanites(g) - antes;
		check("click() devuelve un número", typeof devuelto === "number", "devuelto=" + devuelto);
		check("y es exactamente lo que entró en la cuenta", devuelto === entrado, `devuelto=${devuelto} entrado=${entrado}`);
		check("el daño no cambia entre el click y la lectura", Math.abs(devuelto - g.getClickDamage()) <= 1, `devuelto=${devuelto} getClickDamage=${g.getClickDamage()}`);
	}
	await conTick(async (tick, g) => {
		const visibilidadOriginal = document.visibilityState;
		try {
			tick();
			tick();
			g.drainClickEvents?.();
			const antes = nanites(g);
			document.visibilityState = "hidden";
			for (let i = 0; i < 10; i++) tick();
			check("con la pestaña oculta no entra ni un nanita del árbol", nanites(g) === antes, `saldo=${nanites(g)} antes=${antes}`);
			check("y tampoco queda ningún aviso acumulado", (g.drainClickEvents?.() ?? []).length === 0, "quedaron avisos de un tiempo en el que no se cobró nada");
		} finally {
			document.visibilityState = visibilidadOriginal;
		}
	}, partidaAutoClick(2));
	{
		const g = await boot(baseSave([collector("r1")], { nanites: 500 }));
		check("sin compañeros no hay ingreso que repartir", g.getState().passiveIncome === 0, "ingreso=" + g.getState().passiveIncome);
		check("y preguntar por uno inexistente da 0, no un NaN", g.getCompanionOutput?.("no_existe") === 0, "salida=" + g.getCompanionOutput?.("no_existe"));
	}
	for (const c of [
		{
			id: "fantasma",
			nombre: "Fantasma Cuantico",
			type: "multiplier",
			power: .35
		},
		{
			id: "oraculo",
			nombre: "Oraculo Tribal",
			type: "multiplier",
			power: .75
		},
		{
			id: "avatar",
			nombre: "Avatar del Vacio",
			type: "passive",
			power: 65
		},
		{
			id: "fenix",
			nombre: "Fenix de Datos",
			type: "passive",
			power: 40
		},
		{
			id: "centinela",
			nombre: "Centinela Eterno",
			type: "click",
			power: 32
		}
	]) {
		const g = await boot(baseSave([collector("r1")], {
			nanites: 0,
			totalNanitesProduced: 0,
			companions: [ficha(c.id, 3, {
				power: c.power,
				type: c.type
			})],
			activeCompanions: [c.id]
		}));
		const lista = typeof g.getAnunciablesIngreso === "function" ? g.getAnunciablesIngreso() : [];
		const anuncia = lista.map((a) => a.id);
		const debeAnunciar = c.type !== "multiplier";
		check(`${c.nombre} (${c.type}) ${debeAnunciar ? "anuncia" : "NO anuncia"}`, debeAnunciar ? anuncia.includes(c.id) : !anuncia.includes(c.id), `anunciables=[${anuncia.join(", ")}] ingreso=${g.getState().passiveIncome}`);
		if (debeAnunciar) {
			const cuota = lista.find((a) => a.id === c.id);
			check(`${c.nombre}: y su aviso lleva la cifra que entra en la cuenta`, cuota?.cantidad === g.getState().passiveIncome, `aviso=${cuota?.cantidad} ingreso=${g.getState().passiveIncome} power=${c.power}`);
		}
	}
	{
		const anuncia = ((await boot(baseSave([collector("r1")], {
			nanites: 0,
			totalNanitesProduced: 0,
			companions: [ficha("mx", 3, {
				power: .5,
				type: "multiplier"
			}), ficha("av", 3, {
				power: 65,
				type: "passive"
			})],
			activeCompanions: ["mx", "av"]
		}))).getAnunciablesIngreso?.() ?? []).map((a) => a.id);
		check("con un multiplicador al lado, el passive sigue anunciando", anuncia.includes("av") && !anuncia.includes("mx"), `anunciables=[${anuncia.join(", ")}]`);
	}
	{
		const g = await boot(baseSave([collector("r1")], {
			nanites: 0,
			totalNanitesProduced: 0,
			companions: [
				ficha("a", 1, {
					power: 6,
					type: "click"
				}),
				ficha("b", 3, {
					power: 18,
					type: "passive"
				}),
				ficha("c", 5, {
					power: 42,
					type: "passive"
				})
			],
			activeCompanions: [
				"a",
				"b",
				"c"
			]
		}));
		const suma = (g.getAnunciablesIngreso?.() ?? []).reduce((a, x) => a + x.cantidad, 0);
		check("lo que anuncian los tres suma el ingreso del bloque", suma === g.getState().passiveIncome, `anuncian=${suma} ingreso=${g.getState().passiveIncome}`);
	}
	resumen("senal: lo que se enseña es lo que se cobra");
}
var senalCheck_default = main();
//#endregion
export { senalCheck_default as default };
