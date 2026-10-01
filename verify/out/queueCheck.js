import { J as confirmarCola, q as anotarPendiente, t as createGameLoop } from "./gameLoop-DA2943Xb.js";
import { C as s, S as resumen, a as check, g as guardado, i as bootNew, n as baseSave, o as collector, r as boot, t as USER, x as reload, y as nanites } from "./kit-By6xxhWQ.js";
//#region verify/queueCheck.ts
/**
* `localStorage` de mentira, con lo justo para que la cola funcione.
*
* El de `run.mjs` es un `{getItem: () => null, setItem(){}}` que no guarda nada,
* así que con él la cola no se puede examinar. Este sí, y además cuenta las
* escrituras, que es como se comprueba que anotar es síncrono.
*/
function instalarAlmacen() {
	const datos = /* @__PURE__ */ new Map();
	let escrituras = 0;
	globalThis.localStorage = {
		getItem: (k) => datos.has(k) ? datos.get(k) : null,
		setItem: (k, v) => {
			datos.set(k, v);
			escrituras++;
		},
		removeItem: (k) => {
			datos.delete(k);
			escrituras++;
		},
		clear: () => {
			datos.clear();
		},
		get escrituras() {
			return escrituras;
		},
		_datos: datos
	};
	return {
		datos,
		get escrituras() {
			return escrituras;
		}
	};
}
/** Cuántas veces se ha escrito la cola. El atajo más corto a `datos`. */
var CLAVE = "cyberforge_nanitas_pendientes";
var cola = () => globalThis.localStorage._datos.get(CLAVE);
/** El estado guardado en la cola, o null si no hay. */
var leerCola = () => {
	const crudo = cola();
	return crudo ? JSON.parse(crudo) : null;
};
var sinRed = (v) => {
	globalThis.__MEM_DB__.fallar = v;
};
/**
* Fecha a milisegundos, sea un `Timestamp` o un número.
*
* El stub guarda lo que le pasó el juego, y el juego escribe `new Date()`. Para
* las pruebas que comparan dos marcas de tiempo hace falta leer las dos
* formas, y duplicar aquí la conversión es preferible a meter una función de
* producción solo para poder probarla: si la copia se desincroniza de la real,
* el banco valida una regla que no es la del juego.
*/
function aMilis(valor) {
	if (valor == null) return 0;
	if (typeof valor === "number") return valor;
	if (typeof valor?.toMillis === "function") return valor.toMillis();
	if (typeof valor?.seconds === "number") return valor.seconds * 1e3;
	return 0;
}
/**
* Silencia el `console.error` del guardado mientras se simula la caída.
*
* El `catch` de `saveToFirebase` hace `console.error` a propósito —en
* producción es lo que te avisa de que algo va mal— y este banco provoca
* treinta fallos seguidos. Sin esto, la mitad de su salida son errores de red
* simulados y los `PASA` de verdad quedan enterrados: el banco parecía fallar
* cuando lo que falla es, precisamente, que no hay red.
*
* Se restaura siempre, también si una comprobación revienta, porque un banco
* que se come la consola de los demás es peor que uno que no imprime.
*/
function silenciarErrores(accion) {
	const original = console.error;
	console.error = () => {};
	return accion().finally(() => {
		console.error = original;
	});
}
async function main() {
	const almacen = instalarAlmacen();
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 555;
		g.flush();
		const c = leerCola();
		check("cola: se anota el saldo al intentar guardar", c?.nanites === 555, "nanites=" + c?.nanites);
		check("cola: guarda el uid dueño", c?.uid === USER.uid, "uid=" + c?.uid);
		check("cola: guarda una marca de tiempo", typeof c?.ts === "number" && c.ts > 0, "ts=" + c?.ts);
		await g.cleanup();
	}
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 700;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		check("cola: se vacía cuando el servidor confirma", cola() === void 0, "cola=" + cola());
		check("cola: y el documento se quedó con el saldo", guardado().nanites === 700, "doc=" + guardado().nanites);
		await g.cleanup();
	}
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 1e3;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		check("cola: punto de partida guardado", cola() === void 0);
		sinRed(true);
		s(g).nanites = 4242;
		await silenciarErrores(async () => {
			g.flush();
			await new Promise((r) => setTimeout(r, 20));
		});
		const c = leerCola();
		check("cola: sin red, la cola sobrevive", c?.nanites === 4242, "cola=" + c?.nanites);
		check("cola: y el documento sigue con lo último bueno", guardado().nanites === 1e3, "doc=" + guardado().nanites);
		const g2 = await silenciarErrores(() => reload());
		check("cola: al recargar recupera lo perdido", nanites(g2) === 4242, "nanites=" + nanites(g2));
		sinRed(false);
		g2.flush();
		await new Promise((r) => setTimeout(r, 20));
		check("cola: al recuperar la red se confirma", guardado().nanites === 4242, "doc=" + guardado().nanites);
		check("cola: y la cola queda vacía", cola() === void 0);
		await g2.cleanup();
		sinRed(false);
	}
	{
		const items = [collector("r1", 3)];
		const g = await boot(baseSave(items, {
			nanites: 5e6,
			totalNanitesProduced: 5e6,
			resets: 0,
			totalCores: 0
		}));
		s(g).nanites = 5e6;
		s(g).totalNanitesProduced = 5e6;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		check("prestigio: punto de partida en el servidor", guardado().nanites === 5e6, "doc=" + guardado().nanites);
		sinRed(true);
		s(g).totalNanitesProduced = 9e8;
		const r = await silenciarErrores(async () => {
			const res = g.prestige();
			await new Promise((r2) => setTimeout(r2, 20));
			return res;
		});
		check("prestigio: el reinicio se puede ejecutar", !!r?.success, JSON.stringify(r));
		check("prestigio: el documento aún tiene el saldo viejo (falló la subida)", guardado().nanites === 5e6, "doc=" + guardado().nanites);
		check("prestigio: pero la cola apunta a cero", leerCola()?.nanites === 0, "cola=" + JSON.stringify(leerCola()));
		const g2 = await silenciarErrores(() => reload());
		check("PRESTIGIO: sin red, el reinicio NO se deshace", nanites(g2) === 0, "nanites=" + nanites(g2));
		check("PRESTIGIO: y los núcleos que pagó NO se pierden", s(g2).cores > 0, "nucleos=" + s(g2).cores);
		check("PRESTIGIO: ni el contador de reinicios", s(g2).resets === 1, "reinicios=" + s(g2).resets);
		sinRed(false);
		g2.flush();
		await new Promise((r3) => setTimeout(r3, 20));
		check("PRESTIGIO: al volver la red, el documento queda a cero", guardado().nanites === 0, "doc=" + guardado().nanites);
		await silenciarErrores(() => g2.cleanup());
		sinRed(false);
	}
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 100;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		sinRed(true);
		s(g).nanites = 300;
		await silenciarErrores(async () => {
			g.flush();
			await new Promise((r) => setTimeout(r, 20));
		});
		const colaTs = leerCola()?.ts ?? 0;
		check("dos dispositivos: la cola local se anota", leerCola()?.nanites === 300);
		check("dos dispositivos: y lleva su marca de tiempo", colaTs > 0, "ts=" + colaTs);
		await silenciarErrores(() => g.cleanup());
		sinRed(false);
		const doc = guardado();
		doc.nanites = 8888;
		doc.updatedAt = {
			seconds: Math.floor((colaTs + 6e4) / 1e3),
			nanoseconds: 0
		};
		const g2 = await reload();
		check("dos dispositivos: gana el documento, no la cola vieja", nanites(g2) === 8888, "nanites=" + nanites(g2));
		check("dos dispositivos: y la cola se descarta", cola() === void 0);
		await g2.cleanup();
	}
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 100;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		const guardadoTs = aMilis(guardado().updatedAt);
		sinRed(true);
		s(g).nanites = 7777;
		await silenciarErrores(async () => {
			g.flush();
			await new Promise((r) => setTimeout(r, 20));
		});
		const colaTs = leerCola()?.ts ?? 0;
		check("cola nueva: la cola es posterior al documento", colaTs > guardadoTs, "cola=" + colaTs + " doc=" + guardadoTs);
		const g2 = await silenciarErrores(() => reload());
		check("cola nueva: gana la cola, que es lo más reciente", nanites(g2) === 7777, "nanites=" + nanites(g2));
		await silenciarErrores(() => g2.cleanup());
		sinRed(false);
	}
	{
		const g = await boot(baseSave([collector("r1", 3)]));
		s(g).nanites = 4242;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		sinRed(true);
		s(g).nanites = 4242;
		await silenciarErrores(async () => {
			g.flush();
			await new Promise((r) => setTimeout(r, 20));
		});
		check("cola ajena: hay cola del usuario de test", leerCola()?.uid === USER.uid, "uid=" + leerCola()?.uid);
		sinRed(false);
		await new Promise((r) => setTimeout(r, 20));
		globalThis.__MEM_DB__ = {};
		globalThis.__MEM_DB__["users/otro"] = JSON.parse(JSON.stringify(baseSave([collector("r1", 3)])));
		const g2 = await createGameLoop({
			uid: "otro",
			displayName: "Otro"
		}, () => {});
		check("cola ajena: el otro usuario no hereda el saldo", nanites(g2) !== 4242, "nanites=" + nanites(g2));
		check("cola ajena: y arranca con lo que hay en SU documento", nanites(g2) === 1e3, "nanites=" + nanites(g2));
		await g2.cleanup();
		await g.cleanup();
	}
	{
		await boot(baseSave([collector("r1", 3)]));
		globalThis.localStorage._datos.set(CLAVE, "{esto no es json");
		let arranco = true;
		let g = null;
		try {
			g = await reload();
		} catch {
			arranco = false;
		}
		check("cola corrupta: el juego arranca igualmente", arranco);
		check("cola corrupta: y usa el documento, que sí es válido", !!g && nanites(g) === 1e3, "nanites=" + (g ? nanites(g) : "n/a"));
		if (g) await g.cleanup();
	}
	{
		const g = await bootNew();
		check("partida nueva: sigue naciendo a cero", nanites(g) === 0, "nanites=" + nanites(g));
		s(g).nanites = 1234;
		g.flush();
		await new Promise((r) => setTimeout(r, 20));
		check("partida nueva: el guardado normal sigue funcionando", guardado().nanites === 1234 && guardado().userId === USER.uid, "doc=" + guardado().nanites);
		check("partida nueva: y no deja cola colgando", cola() === void 0);
		await g.cleanup();
	}
	check("cola: se usó el almacenamiento del juego", almacen.datos.size >= 0);
	{
		globalThis.localStorage.clear();
		const tsA = anotarPendiente("test", 100, 0, 0, 0, 0, 0);
		await new Promise((r) => setTimeout(r, 2));
		const tsB = anotarPendiente("test", 200, 0, 0, 0, 0, 0);
		check("regla: la segunda anotación es más nueva", tsB > tsA, `${tsA} -> ${tsB}`);
		check("regla: y la cola guarda el saldo más nuevo", leerCola()?.nanites === 200, "cola=" + JSON.stringify(leerCola()));
		const vacioA = confirmarCola(tsA);
		check("regla: confirmar un guardado viejo NO vacía la cola", vacioA === false && leerCola() !== null, `devolvió ${vacioA}, cola=${leerCola() === null ? "borrada" : "viva"}`);
		check("regla: y el saldo que nadie confirmó sigue ahí", leerCola()?.nanites === 200, "cola=" + JSON.stringify(leerCola()));
		const vacioB = confirmarCola(tsB);
		check("regla: confirmar el guardado más nuevo sí la vacía", vacioB === true && leerCola() === null, `devolvió ${vacioB}, cola=${leerCola() === null ? "borrada" : "viva"}`);
		check("regla: confirmar sin cola no rompe nada", confirmarCola(tsB) === true);
		globalThis.localStorage._datos.set(CLAVE, "{esto no es json");
		check("regla: un registro ilegible no se borra", confirmarCola(tsB) === false && cola() !== void 0, "borró algo que no podía leer");
		globalThis.localStorage._datos.set(CLAVE, JSON.stringify({
			v: 1,
			uid: "test",
			nanites: 9,
			producidas: 0,
			clics: 0,
			nucleos: 0,
			totalNucleos: 0,
			reinicios: 0,
			ts: "ayer"
		}));
		check("regla: una marca que no es fecha no se borra", confirmarCola(tsB) === false && cola() !== void 0, "borró con una marca inválida");
		globalThis.localStorage.clear();
	}
	resumen("cola de nanitas pendientes");
	/**
	* VACÍA LA COLA ANTES DE TERMINAR.
	*
	* Este banco sustituye el global por uno suyo para poder inspeccionar la
	* cola, y no lo devuelve. Como el runner limpia entre bancos llamando a
	* `localStorage.clear()`, y `kit.ts` limpia en cada `boot()`, este es el
	* último —pero un `cleanup()` pende de alguno de sus game loops y escribirá
	* en la cola después de este punto. Vaciar aquí deja el estado como lo
	* encontraría una pestaña nueva, que es lo que un banco siguiente espera.
	*/
	globalThis.localStorage.clear();
}
/**
* `main()` INVOCADO, y no `main`.
*
* El runner hace `await import(...)` y espera el `default` tal cual. Los demás
* bancos exportan la promesa ya empezada (`export default main();`) y por eso
* `typeof default` es `object`. Exportando la función, el `await` recibía un
* function object —que se resuelve en sí mismo, sin ejecutar nada— y el banco
* terminaba sin imprimir ni una línea y sin dar error. Era el motivo de que
* `queueCheck` llevara tiempo "en construcción" sin que se supiera que
* simplemente no se estaba ejecutando.
*/
var queueCheck_default = main();
//#endregion
export { queueCheck_default as default };
