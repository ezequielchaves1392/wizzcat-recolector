import { B as CRATE_TYPES, F as cratesOpenedBy, I as keyOpens, M as KEY_DEFS, N as KEY_TIER_ORDER, O as pickLoot, P as STORE_KEY_TIER, U as STORE_ITEMS, V as KEY_COSTS, j as CRATE_KEY_TIER, y as CRATE_LOOT } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check, n as baseSave, r as boot, u as crate, v as key } from "./kit-By6xxhWQ.js";
//#region verify/llaveCheck.ts
var CAJAS = Object.keys(CRATE_KEY_TIER);
async function main() {
	for (const c of CAJAS) {
		const necesaria = CRATE_KEY_TIER[c];
		const sueltas = /* @__PURE__ */ new Set();
		for (let i = 0; i < 400; i++) {
			const premio = pickLoot(c).build({ ownedCosmetics: [] });
			if (premio.keyTier !== void 0) sueltas.add(premio.keyTier);
		}
		check(`botin: ${c} suelta alguna vez su propia llave`, Array.from(sueltas).includes(necesaria), `necesita T${necesaria} y suelta ${JSON.stringify(Array.from(sueltas))}`);
	}
	for (const c of CAJAS) {
		const t = CRATE_KEY_TIER[c];
		check(`tienda: la llave de ${c} se puede comprar`, KEY_DEFS[t].buyable === true && KEY_DEFS[t].cost !== null, `T${t} buyable=${KEY_DEFS[t].buyable} cost=${KEY_DEFS[t].cost}`);
	}
	for (const t of KEY_TIER_ORDER) {
		const def = KEY_DEFS[t];
		cratesOpenedBy(t);
		for (const c of CAJAS) if (keyOpens(t, CRATE_KEY_TIER[c])) check(`texto: ${def.name} dice que abre ${CRATE_TYPES[c].name}, y lo abre`, def.details.includes(CRATE_TYPES[c].name), `details="${def.details}"`);
		for (const c of CAJAS) if (def.details.includes(CRATE_TYPES[c].name)) check(`texto: ${def.name} nombra ${CRATE_TYPES[c].name} y de verdad la abre`, keyOpens(t, CRATE_KEY_TIER[c]), `T${t} contra ${c} (necesita T${CRATE_KEY_TIER[c]})`);
	}
	for (const t of KEY_TIER_ORDER) {
		const carta = `keyT${t}`;
		const def = KEY_DEFS[t];
		check(`tienda: ${carta} existe en STORE_ITEMS`, STORE_ITEMS[carta] !== void 0, carta);
		check(`tienda: ${carta} se llama ${def.name}`, STORE_ITEMS[carta]?.label === def.name, `carta="${STORE_ITEMS[carta]?.label}" llave="${def.name}"`);
		check(`tienda: ${carta} cuesta lo que dice KEY_DEFS`, STORE_ITEMS[carta]?.cost === def.cost, `carta=${STORE_ITEMS[carta]?.cost} def=${def.cost}`);
		check(`tienda: ${carta} apunta al nivel ${t}`, STORE_KEY_TIER[carta] === t, `STORE_KEY_TIER=${STORE_KEY_TIER[carta]}`);
	}
	for (const t of KEY_TIER_ORDER) {
		const g = await boot(baseSave([], { nanites: 1e7 }));
		const res = g.buyStoreItem?.(`keyT${t}`);
		const llaves = (g.getState().warehouse ?? []).filter((w) => w.type === "key");
		check(`compra: keyT${t} deja en el almacen la llave T${t}`, llaves.length === 1 && llaves[0]?.tier === t, `entrado=${JSON.stringify(llaves.map((w) => ({
			n: w.name,
			t: w.tier
		})))} res=${JSON.stringify(res)}`);
		check(`compra: y se llama ${KEY_DEFS[t].name}`, llaves[0]?.name === KEY_DEFS[t].name, `entrado="${llaves[0]?.name}"`);
	}
	for (let i = 1; i < KEY_COSTS.length; i++) check(`precios: la llave T${i} cuesta mas que la T${i - 1}`, KEY_COSTS[i] > KEY_COSTS[i - 1], `${KEY_COSTS[i - 1]} -> ${KEY_COSTS[i]}`);
	for (const c of CAJAS) {
		const t = CRATE_KEY_TIER[c];
		const precioCaja = STORE_ITEMS[`${c}Crate`]?.cost ?? 0;
		check(`precio: la llave de ${c} (T${t}) no es mas cara que ${c}`, KEY_DEFS[t].cost < precioCaja, `llave=${KEY_DEFS[t].cost} caja=${precioCaja}`);
	}
	{
		for (const c of CAJAS) {
			const r = (await boot(baseSave([crate("c1", c), key("k1", CRATE_KEY_TIER[c], 1)], { nanites: 0 }))).openCrateBox("c1", "k1");
			check(`abrir: ${c} se abre con su llave`, r.ok, r.msg ?? "");
			check(`abrir: y es la de ${c} de verdad`, r.crateType === c, `crateType=${r.crateType}`);
		}
		const r = (await boot(baseSave([crate("c1", "common"), key("k3", 3, 1, { name: KEY_DEFS[3].name })], { nanites: 0 }))).openCrateBox("c1", "k3");
		check("abrir: la llave del Vacio si abre una caja comun (regla \"igual o superior\")", r.ok, r.msg ?? "");
	}
	for (const c of CAJAS) {
		const entrada = CRATE_LOOT[c].find((e) => e.id === "keys");
		check(`botin: ${c} tiene entrada de llaves`, entrada !== void 0, "sin entrada de llaves");
		if (!entrada) continue;
		const premio = entrada.build({ ownedCosmetics: [] });
		const def = KEY_DEFS[premio.keyTier];
		check(`botin: ${c} anuncia el nombre de la llave que suelta`, premio.name === def.name, `anuncia="${premio.name}" suelta="${def.name}"`);
		check(`botin: ${c} y su texto es el de esa llave`, premio.details === def.details, `anuncia="${premio.details}" real="${def.details}"`);
		check(`botin: ${c} y su rareza es la de esa llave`, premio.rarity === def.rarity, `anuncia="${premio.rarity}" real="${def.rarity}"`);
		for (const [rnd, n] of [[0, 1], [.99, 2]]) {
			const original = Math.random;
			Math.random = () => rnd;
			const p = entrada.build({ ownedCosmetics: [] });
			Math.random = original;
			const esperado = n > 1 ? def.namePlural : def.name;
			check(`botin: ${c} con ${n} escribe "+${n} ${esperado}"`, p.label === `+${n} ${esperado}` && p.amount === n, `label="${p.label}" amount=${p.amount}`);
		}
	}
	resumen("llaves: una por caja, obtenibles, y diciendo la verdad");
}
var llaveCheck_default = main();
//#endregion
export { llaveCheck_default as default };
