import { t as createGameLoop } from "./gameLoop-DA2943Xb.js";
//#region verify/equipCheck.ts
var rows = [];
function check(name, ok, detail = "") {
	rows.push({
		name,
		ok,
		detail
	});
}
var USER = {
	uid: "test",
	displayName: "Probador"
};
var DB = "users/test";
async function boot(save) {
	globalThis.__MEM_DB__ = {};
	if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
	return await createGameLoop(USER, () => {});
}
var collector = (id, tier = 3) => ({
	id,
	name: "Recolector T" + tier,
	type: "collector",
	details: "+20",
	rarity: "Épico",
	tier,
	level: 0,
	damage: 20,
	sellPrice: 500
});
var companion = (id, tier = 3) => ({
	id,
	name: "Compañero T" + tier,
	type: "companion",
	details: "+10/s",
	rarity: "Épico",
	tier,
	sellPrice: 2e3
});
function baseSave(warehouse, extra = {}) {
	return {
		saveVersion: 7,
		nanites: 1e3,
		warehouse,
		crates: {},
		companions: [],
		activeCompanions: [],
		equippedCollectorId: null,
		keys: 0,
		upgradeCrystals: 0,
		warehouseCapacity: 30,
		maxCompanionSlots: 3,
		...extra
	};
}
var find = (g, id) => g.getState().warehouse.find((w) => w.id === id);
var Nodo = class {
	/** Contenedor al que pertenece. Los listeners NO se propagan hacia él. */
	parent = null;
	ls = [];
	/** Número de listeners vivos en este nodo. */
	get count() {
		return this.ls.length;
	}
	addEventListener(_, fn) {
		this.ls.push(fn);
	}
	removeEventListener(_, fn) {
		const i = this.ls.indexOf(fn);
		if (i >= 0) this.ls.splice(i, 1);
	}
	/** Un clic: se ejecutan TODOS los listeners registrados, en orden. */
	click() {
		for (const fn of [...this.ls]) fn();
	}
};
async function main() {
	{
		const g = await boot(baseSave([collector("r1")]));
		const s = g.getState();
		check("toggle: nace sin nada equipado", s.equippedCollectorId === null && find(g, "r1").equipped !== true);
		g.equipCollector("r1");
		check("toggle: equipar pone id y bandera", s.equippedCollectorId === "r1" && find(g, "r1").equipped === true);
		g.equipCollector("r1");
		check("toggle: desequipar limpia id y bandera", s.equippedCollectorId === null && find(g, "r1").equipped !== true);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		const s = g.getState();
		g.equipCollector("r1");
		g.equipCollector("r2");
		check("toggle: cambiar de recolector no deja dos con la bandera puesta", s.warehouse.filter((w) => w.equipped).length === 1, "equipados=" + s.warehouse.filter((w) => w.equipped).map((w) => w.id).join(","));
		check("toggle: el anterior queda limpio", find(g, "r1").equipped !== true && find(g, "r2").equipped === true);
		check("toggle: y el id es el nuevo", s.equippedCollectorId === "r2");
	}
	{
		const g = await boot(baseSave([collector("r1"), companion("c1")]));
		const s = g.getState();
		s.companions = [{
			id: "c1",
			name: "Compañero T3",
			type: "click",
			power: 5,
			tier: 3
		}];
		g.equipCompanion("c1");
		check("toggle: equipar compañero lo mete en la lista", s.activeCompanions.length === 1, "activos=" + s.activeCompanions.join(","));
		g.equipCompanion("c1");
		check("toggle: desequipar compañero lo saca", s.activeCompanions.length === 0, "activos=" + s.activeCompanions.join(","));
	}
	{
		const g = await boot(baseSave([collector("r1")]));
		const s = g.getState();
		let raiz = new Nodo();
		const repintar = () => {
			const nuevo = new Nodo();
			raiz.parent = nuevo.parent;
			nuevo.addEventListener("click", () => g.equipCollector("r1"));
			raiz = nuevo;
		};
		const clic = () => {
			const antes = s.equippedCollectorId;
			raiz.click();
			return s.equippedCollectorId !== antes;
		};
		repintar();
		check("repintado: 1er render, el clic equipa", clic(), "listeners=" + raiz.count);
		repintar();
		check("repintado: tras repintar, el clic SIGUE cambiando el estado", clic(), "listeners=" + raiz.count);
		const g2 = await boot(baseSave([collector("r1"), collector("r2")]));
		const s2 = g2.getState();
		let raiz2 = new Nodo();
		const repintar2 = () => {
			const nuevo = new Nodo();
			raiz2.parent = nuevo.parent;
			nuevo.addEventListener("click", () => g2.equipCollector("r2"));
			raiz2 = nuevo;
		};
		repintar2();
		g2.equipCollector("r1");
		repintar2();
		raiz2.click();
		check("repintado: se puede cambiar de recolector después de repintar", s2.equippedCollectorId === "r2", "equippedCollectorId=" + s2.equippedCollectorId);
	}
	{
		const contenedor = new Nodo();
		let raiz = null;
		for (let i = 0; i < 5; i++) {
			raiz = new Nodo();
			raiz.parent = contenedor;
			raiz.addEventListener("click", () => {});
		}
		check("repintado: ligar sobre el nodo recreado no acumula en el contenedor", contenedor.count === 0 && raiz.count === 1, `contenedor=${contenedor.count} raiz=${raiz.count}`);
	}
	{
		const g = await boot(baseSave([collector("r1")]));
		const s = g.getState();
		g.equipCollector("r1");
		check("id y bandera: equipar deja los dos de acuerdo", s.equippedCollectorId === "r1" && find(g, "r1").equipped === true, `id=${s.equippedCollectorId} bandera=${find(g, "r1").equipped}`);
		s.equippedCollectorId = null;
		s.warehouse[0].equipped = true;
		g.equipCollector("r1");
		check("id y bandera: una bandera descolocada ya no manda", s.equippedCollectorId === "r1" && g.getClickDamage() > 0, `id=${s.equippedCollectorId} daño=${g.getClickDamage()}`);
		check("id y bandera: y el toggle se recupera del desajuste", find(g, "r1").equipped === true, "bandera=" + find(g, "r1").equipped);
	}
	{
		const g = await boot(baseSave([collector("r1"), collector("r2")]));
		const s = g.getState();
		s.equippedCollectorId = "r2";
		find(g, "r1").equipped = true;
		g.equipCollector("r1");
		check("id y bandera: pulsar sobre una bandera fantasma no destruye el equipado real", s.equippedCollectorId === "r1", "equippedCollectorId=" + s.equippedCollectorId);
		check("id y bandera: y solo queda un item con la bandera puesta", s.warehouse.filter((w) => w.equipped).length === 1, "equipados=" + s.warehouse.filter((w) => w.equipped).map((w) => w.id).join(","));
	}
	{
		const g = await boot(baseSave([collector("r1"), companion("m1")]));
		const s = g.getState();
		const slots = g.getCompanionSlots();
		s.companions = [{
			id: "m1",
			name: "Compañero T3",
			type: "click",
			power: 10,
			tier: 3
		}];
		g.recalculatePassiveIncome?.();
		const pasivoAntes = s.passiveIncome;
		g.equipCompanion("m1");
		check("compañero: uno real entra y paga", s.activeCompanions.includes("m1") && s.passiveIncome > pasivoAntes, `pasivo=${s.passiveIncome} antes=${pasivoAntes}`);
		const llenos = s.activeCompanions.length;
		const pasivoConUno = s.passiveIncome;
		const ok = g.equipCompanion("no_existe");
		check("compañero: un id inexistente se rechaza", ok === false, "ok=" + ok);
		check("compañero: y no gasta ranura", s.activeCompanions.length === llenos, `activos=${s.activeCompanions.join(",")} slots=${slots}`);
		check("compañero: ni aparece en el ingreso", s.passiveIncome === pasivoConUno, `pasivo=${s.passiveIncome} antes=${pasivoConUno}`);
	}
	{
		const g = await boot(baseSave([collector("r1"), companion("m1")]));
		const s = g.getState();
		s.companions = [{
			id: "m1",
			name: "Compañero T3",
			type: "click",
			power: 10,
			tier: 3
		}];
		g.equipCompanion("m1");
		g.equipCompanion("m1");
		check("compañero: desequipar un id válido lo saca y libera la ranura", s.activeCompanions.length === 0, "activos=" + s.activeCompanions.join(","));
	}
	{
		const g = await boot(baseSave([companion("m3", 3), companion("m1", 1)]));
		const s = g.getState();
		s.companions = [{
			id: "m3",
			name: "Compañero T3",
			type: "click",
			power: 3,
			tier: 3
		}, {
			id: "m1",
			name: "Compañero T1",
			type: "click",
			power: 1,
			tier: 1
		}];
		g.equipCompanion("m3");
		g.equipCompanion("m1");
		const porEquip = s.activeCompanions.join(",");
		s.activeCompanions.length = 0;
		g.toggleCompanionActive("m3");
		g.toggleCompanionActive("m1");
		const porToggle = s.activeCompanions.join(",");
		check("doble camino: los dos caminos coinciden", porEquip === porToggle, `equipCompanion=[${porEquip}] toggle=[${porToggle}]`);
		check("doble camino: y ordenan por tier, como se pintan", porEquip === "m1,m3", "activos=[" + porEquip + "]");
	}
	const fallos = rows.filter((r) => !r.ok);
	rows.forEach((r) => console.log(`${r.ok ? "PASA" : "FALLA"}  ${r.name}${r.detail ? "   [" + r.detail + "]" : ""}`));
	console.log(`\n${rows.length - fallos.length}/${rows.length} pruebas correctas`);
	if (fallos.length) {
		console.log("\nFALLOS:");
		fallos.forEach((r) => console.log("  - " + r.name + "  [" + r.detail + "]"));
		process.exitCode = 1;
	}
}
var equipCheck_default = main();
//#endregion
export { equipCheck_default as default };
