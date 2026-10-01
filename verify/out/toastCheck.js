import { X as showToast, Z as syncToastOffset } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check, n as baseSave, r as boot } from "./kit-By6xxhWQ.js";
//#region verify/toastCheck.ts
/** El contenedor donde se apilan los avisos. */
var pila = () => globalThis.document.querySelector("#toast-stack");
/** Los avisos ahora mismo, en orden de aparición. */
var vivos = () => pila()?.children ?? [];
/**
* Vacía la pila y espera a que lo esté de verdad.
*
* POR QUÉ HACE FALTA, Y POR QUÉ NO ES EXÓTICO.
*
* Los bancos se ejecutan todos en el mismo proceso y el módulo de avisos es UNO
* solo para todos, así que al empezar este banco la pila ya tiene dentro lo que
* fue dejando la cola de nanitas de los bancos anteriores: "Guardado. Tu
* progreso ya está en la nube", "Recuperadas 3.24 K nanitas...", "Almacén
* lleno...". No es un residuo del stub: es el juego funcionando.
*
* Antes no se notaba porque `appendChild` era una sinonima y nadie miraba los
* hijos. Ahora que sí, cualquier aserción sobre el número de avisos empieza
* midiendo los de otro banco.
*
* Se espera a que se vayan solos en vez de vaciarlos a golpes, porque borrarlos
* a golpes dejaría los avisos de otro banco a medias de su desvanecido y el
* estado seguiría sin ser el de una pila recién creada. Con el tope de espera
* hay red: si algún día un aviso viviera más de lo que debería, el banco
* fallaría diciendo cuántos quedaban en vez de quedarse colgado.
*/
async function vaciarPila() {
	for (let intento = 0; intento < 40 && vivos().length; intento++) await dormir(100);
}
/** El texto de cada aviso, sin el contador de repeticiones. */
var textos = () => vivos().map((t) => t.children[0]?.textContent ?? "");
/** El contador `×N` de cada aviso, o `null` si no tiene. */
var contadores = () => vivos().map((t) => {
	const c = t.children[1];
	return c?.classList?.contains("hidden") ? null : c?.textContent ?? null;
});
var dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Publica una cabecera con un borde inferior conocido y devuelve su nodo. */
function cabecera(borde) {
	const el = globalThis.document.createElement("header");
	el.getBoundingClientRect = () => ({
		top: 0,
		bottom: borde,
		height: borde,
		left: 0,
		right: 0,
		width: 0
	});
	globalThis.__DOM__.header = el;
	return el;
}
/**
* Arranca el motor recogiendo los logros que anuncia.
*
* `createGameLoop` acepta un cuarto argumento, `onAchievement`, que es lo que
* `main.ts` pasa a `showAchievementPopup`. Aquí se mira ese mismo gancho, y no la
* función de la vista: el banco comprueba **que el motor emite**, que es la mitad
* comprobable del bug. La otra mitad (que la vista tenga dónde pintarlo) es la
* cola de `main.ts`, y esa se documenta allí.
*/
async function motorConLogros(save) {
	const vistos = [];
	return {
		g: await boot(save, { onAchievement: (a) => vistos.push(a.title) }),
		vistos
	};
}
/** Una partida con `capacidadBase` slots y dinero de sobra para ampliar. */
function saveParaAmpliar(capacidadBase = 15) {
	return baseSave([], {
		nanites: 1e7,
		warehouseCapacity: capacidadBase
	});
}
async function main() {
	await vaciarPila();
	showToast("Primero", "info");
	check("un aviso crea la pila", !!pila(), "id=" + (pila()?.id ?? "ninguno"));
	showToast("Segundo", "success");
	showToast("Tercero", "error");
	check("tres avisos NO crean tres contenedores", vivos().length === 3, "hijos=" + vivos().length);
	check("el contenedor vive en body, no en la vista", globalThis.document.body.children.includes(pila()), "body=" + globalThis.document.body.children.length);
	check("y se sale de los de abajo al final, en orden", textos().join("|") === "Primero|Segundo|Tercero", textos().join("|"));
	showToast("Primero", "info");
	check("repetir un aviso NO añade otro", vivos().length === 3, "hijos=" + vivos().length);
	check("sube su contador a ×2", contadores()[0] === "×2", "contador=" + contadores()[0]);
	showToast("Primero", "info");
	check("y a ×3", contadores()[0] === "×3", "contador=" + contadores()[0]);
	check("un aviso sin repetir no enseña contador", contadores()[1] === null, "contador=" + contadores()[1]);
	showToast("Primero", "error");
	check("el mismo texto con otro tipo es otro aviso", vivos().length === 4 && contadores()[3] === null, "hijos=" + vivos().length + " contador=" + contadores()[3]);
	check("los espacios de más no crean avisos nuevos", (() => {
		showToast("   ", "info");
		return vivos().length === 4;
	})(), "hijos=" + vivos().length);
	showToast("Cuarto", "info");
	check("el que se expulsa sigue en pantalla desvaneciéndose", vivos().length === 5 && textos()[0] === "Primero", textos().join("|"));
	await dormir(400);
	check("pasado el desvanecido quedan cuatro, no cinco", vivos().length === 4, "hijos=" + vivos().length);
	check("y el que se fue es el más viejo de la lista, no el último", textos().join("|") === "Segundo|Tercero|Primero|Cuarto", textos().join("|"));
	showToast("Quinto", "info");
	showToast("Sexto", "info");
	await dormir(400);
	check("una racha larga no deja una columna de veinte", vivos().length === 4, "hijos=" + vivos().length);
	check("y se quedan los últimos, no los primeros", textos()[vivos().length - 1] === "Sexto", textos().join("|"));
	await vaciarPila();
	check("sin cabecera se queda en el margen por defecto", pila().style.top === "12px", "top=" + pila().style.top);
	cabecera(66);
	syncToastOffset();
	check("con la cabecera de 66 px queda por debajo, con hueco", pila().style.top === "78px", "top=" + pila().style.top);
	cabecera(79);
	syncToastOffset();
	check("y se recoloca al cambiar de vista (lo llama renderRoute)", pila().style.top === "91px", "top=" + pila().style.top);
	const sinMedir = globalThis.document.createElement("header");
	globalThis.__DOM__.header = sinMedir;
	syncToastOffset();
	check("una cabecera sin medir no pega los avisos al borde", pila().style.top === "12px", "top=" + pila().style.top);
	showToast("Primero", "info");
	showToast("Segundo", "success");
	showToast("Tercero", "error");
	const roles = vivos().map((t) => t.getAttribute("role"));
	check("los errores se anuncian como alerta", roles.includes("alert"), roles.join(","));
	check("y el resto, con normalidad", roles.filter((r) => r === "status").length === roles.length - 1, roles.join(","));
	check("la columna no intercepta toques, pero los avisos sí", pila().className.includes("pointer-events-none") && vivos()[0].className.includes("pointer-events-auto"), "columna=" + pila().className.slice(0, 40));
	check("y cada aviso tiene zona táctil de 44 px", vivos().every((t) => t.className.includes("min-h-[44px]")), vivos()[0].className.match(/min-h-\[44px\]/) ? "min-h-44px" : "no");
	await vaciarPila();
	showToast("Guardado de mentira", "info");
	showToast("Recuperadas 3.24 K", "info");
	const antes = vivos().length;
	await dormir(3400);
	check("los avisos se van solos", antes === 2 && vivos().length === 0, "antes=" + antes + " ahora=" + vivos().length);
	showToast("Guardado de mentira", "info");
	check("un texto que ya estaba no vuelve con contador puesto", vivos().length === 1 && contadores()[0] === null, "contador=" + contadores()[0]);
	{
		const { g, vistos } = await motorConLogros(saveParaAmpliar(15));
		g.buyStoreItem("warehouseSlot");
		check("logros: ampliar el almacén hasta 20 desbloquea el logro", g.getState().unlockedAchievements.includes("deep_pockets"), "logros=" + JSON.stringify(g.getState().unlockedAchievements));
		check("y lo ANUNCIA, que es lo que hace el cartel", vistos.includes("Almacén Masivo"), "anunciados=" + JSON.stringify(vistos));
	}
	{
		const { g, vistos } = await motorConLogros(saveParaAmpliar(15));
		g.buyStoreItem("warehouseSlot");
		const trasLaPrimera = vistos.length;
		g.buyStoreItem("warehouseSlot");
		g.buyStoreItem("warehouseSlot");
		check("logros: ampliar más no vuelve a anunciar el mismo logro", vistos.length === trasLaPrimera, `antes=${trasLaPrimera} despues=${vistos.length} lista=${JSON.stringify(vistos)}`);
	}
	{
		const { g } = await motorConLogros(saveParaAmpliar(15));
		const conArbol = await motorConLogros(baseSave([], {
			nanites: 1e7,
			warehouseCapacity: 15,
			nodeLevels: {
				storage_rack: 1,
				void_hoard: 1
			}
		}));
		const pista = (gg) => gg.getAchievements().find((a) => a.id === "deep_pockets")?.current;
		check("logros: la pista llega al tope de 20 por el árbol, no por la tienda", pista(conArbol.g) === 20 && conArbol.g.getCapacity() === 26, `pista=${pista(conArbol.g)} capacidad=${conArbol.g.getCapacity()} (base=15 +3+8 del árbol)`);
		check("y sin árbol la pista es la base, sin tocar el tope", pista(g) === 15 && g.getCapacity() === 15, `pista=${pista(g)} capacidad=${g.getCapacity()}`);
		check("y con el árbol lleno, el logro SÍ se cumple por la vía del árbol", conArbol.g.getState().unlockedAchievements.includes("deep_pockets"), "logros=" + JSON.stringify(conArbol.g.getState().unlockedAchievements));
	}
	delete globalThis.__DOM__.header;
	resumen("avisos flotantes");
}
var toastCheck_default = main();
//#endregion
export { toastCheck_default as default };
