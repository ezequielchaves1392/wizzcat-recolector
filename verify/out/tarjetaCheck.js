import { U as STORE_ITEMS, z as CONSUMABLES } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check, m as ficha, n as baseSave, r as boot } from "./kit-By6xxhWQ.js";
//#region verify/tarjetaCheck.ts
async function main() {
	for (const id of ["clickBuff", "passiveBuff"]) {
		check(`tienda: ${id} ya no es una carta`, STORE_ITEMS[id] === void 0, `sigue en STORE_ITEMS: ${JSON.stringify(STORE_ITEMS[id])}`);
		check(`tienda: ${id} ya no es un consumible`, CONSUMABLES[id] === void 0, `sigue en CONSUMABLES: ${JSON.stringify(CONSUMABLES[id])}`);
	}
	for (const id of [
		"afkCard",
		"clickX2Card",
		"clickX3Card"
	]) {
		check(`tarjetas: ${id} sigue en la tienda`, STORE_ITEMS[id] !== void 0, id);
		check(`tarjetas: ${id} sigue siendo un consumible`, CONSUMABLES[id] !== void 0, id);
	}
	{
		const TOPE_MS = 9e5;
		for (const [id, def] of Object.entries(STORE_ITEMS)) {
			if (def?.durationMs === void 0) continue;
			check(`duracion: ${id} dura como mucho ${TOPE_MS / 6e4} min`, def.durationMs <= TOPE_MS, `${id} dura ${def.durationMs / 6e4} min`);
		}
		const pasivosComprables = Object.entries(STORE_ITEMS).filter(([, def]) => def?.durationMs !== void 0).map(([id]) => id).filter((id) => {
			return CONSUMABLES[id]?.buffId === "passiveBoost";
		});
		check("ningun buff de ingreso pasivo se puede comprar ya", pasivosComprables.length === 0, `quedan: ${JSON.stringify(pasivosComprables)}`);
	}
	{
		const guardado = (passiveBoostExpiresAt) => baseSave([], {
			nanites: 0,
			totalNanitesProduced: 0,
			companions: [ficha("c1", 1, {
				power: 10,
				type: "passive"
			})],
			activeCompanions: ["c1"],
			maxCompanionSlots: 3,
			buffs: {
				clickBoostExpiresAt: 0,
				passiveBoostExpiresAt,
				clickX2ExpiresAt: 0,
				clickX3ExpiresAt: 0
			}
		});
		const conBuffViejo = (await boot(guardado(Date.now() + 36e5))).getState().passiveIncome;
		const sinBuff = (await boot(guardado(0))).getState().passiveIncome;
		check("una partida vieja con el buff de pasivo sigue cobrando el doble", conBuffViejo === sinBuff * 2, `conBuff=${conBuffViejo} sinBuff=${sinBuff}`);
		check("y no se ha roto el ingreso normal", sinBuff === 10, `sinBuff=${sinBuff} (un compañero de power 10)`);
	}
	{
		const g = await boot(baseSave([], {
			nanites: 0,
			afkCards: 0,
			afkExpiresAt: 0
		}));
		check("la tarjeta AFK sigue siendo el camino de tiempo ausente", typeof g.getAfkDurationMs === "function" && g.getAfkDurationMs() > 0, `duracion=${g.getAfkDurationMs?.()}`);
		check("las tarjetas AFK del almacen no se confunden con el AFK de mirar", g.isAfk() === false, `isAfk=${g.isAfk()} — está activo al arrancar, que es lo correcto`);
	}
	resumen("tarjetas: solo tarjetas, y ninguna es una puerta trasera al AFK");
}
var tarjetaCheck_default = main();
//#endregion
export { tarjetaCheck_default as default };
