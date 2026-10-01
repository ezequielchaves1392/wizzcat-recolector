//#region src/utils/toast.ts
/** Cuánto vive un aviso antes de retirarse solo. */
var VIDA_MS = 3e3;
/** Cuántos avisos conviven como máximo. Al superarlo, se va el más viejo. */
var MAX_VIVOS = 4;
/** Separación entre la cabecera y el primer aviso. */
var HUECO_CABECERA = 12;
/**
* Avisos vivos ahora mismo.
*
* Vive a nivel de módulo y no dentro de `showToast` a propósito: la función se
* llama una vez por acción, y un array creado dentro se perdería en la llamada
* siguiente. Es el mismo patrón que la pila de números flotantes de `main.ts`.
*/
var vivos = [];
/** El contenedor. Se crea la primera vez y se reutiliza siempre el mismo. */
var pila = null;
var COLORES = {
	success: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
	error: "bg-red-500/20 border-red-500/40 text-red-300",
	info: "bg-blue-500/20 border-blue-500/40 text-blue-300"
};
/** El contenedor, creándolo la primera vez. */
function asegurarPila() {
	if (pila) return pila;
	const el = document.createElement("div");
	el.id = "toast-stack";
	el.className = "fixed right-3 md:right-4 z-[60] flex flex-col items-end gap-2 w-[min(92vw,20rem)] pointer-events-none";
	document.body.appendChild(el);
	pila = el;
	return pila;
}
/**
* Coloca la pila justo debajo de la cabecera.
*
* Se mide el `<header>` real en vez de escribir una altura a ojo, porque su alto
* no es fijo: en móvil le crece una fila entera con los buffs activos, y en
* escritorio lleva margen superior. Lo que hay en la posición superior derecha
* de las siete pantallas es ese header, así que esta es la única forma de que
* los avisos no caigan encima.
*
* `renderRoute` la llama al montar cada página; `showToast` también, porque al
* cambiar de vista el borde inferior puede haber cambiado sin que nadie avise.
*
* Sin cabecera (la terminal de administración antes de pintarla, o los bancos de
* pruebas, donde no hay DOM) se deja el margen por defecto en vez de fallar:
* un aviso en la esquina es mejor que ningún aviso.
*/
function syncToastOffset() {
	if (!pila) return;
	const cabecera = document.querySelector("header");
	let borde = 0;
	if (cabecera && typeof cabecera.getBoundingClientRect === "function") {
		const rect = cabecera.getBoundingClientRect();
		if (rect && rect.height > 0) borde = rect.bottom;
	}
	pila.style.top = `${Math.round(borde + HUECO_CABECERA)}px`;
}
/** Pone `×N` o lo esconde, según si el aviso se ha repetido. */
function pintarContador(t) {
	t.contador.classList.toggle("hidden", t.veces < 2);
	if (t.veces >= 2) t.contador.textContent = `×${t.veces}`;
}
/** (Re)arma el temporizador de un aviso: vive `VIDA_MS` desde ahora. */
function armar(t) {
	if (t.temporizador) clearTimeout(t.temporizador);
	t.temporizador = setTimeout(() => retirar(t), VIDA_MS);
}
/**
* Se va un aviso: primero se desvanece y luego se borra el nodo.
*
* El borrado va con su propio temporizador y no en el mismo golpe que el
* desvanecido porque el nodo tiene que quedarse en el DOM durante la
* transición; si se quitara antes, el aviso desaparecería de golpe.
*/
function retirar(t) {
	if (t.temporizador) clearTimeout(t.temporizador);
	const i = vivos.indexOf(t);
	if (i === -1) return;
	vivos.splice(i, 1);
	t.el.classList.add("translate-x-full", "opacity-0");
	setTimeout(() => t.el.remove(), 300);
}
function showToast(message, type = "info") {
	const texto = message.trim();
	if (!texto) return;
	const contenedor = asegurarPila();
	if (!contenedor) return;
	syncToastOffset();
	const repetido = vivos.find((t) => t.mensaje === texto && t.tipo === type);
	if (repetido) {
		repetido.veces++;
		pintarContador(repetido);
		armar(repetido);
		return;
	}
	const textoEl = document.createElement("span");
	textoEl.className = "flex-1 min-w-0 break-words leading-relaxed";
	textoEl.textContent = texto;
	const contador = document.createElement("span");
	contador.className = "shrink-0 font-bold opacity-80";
	const el = document.createElement("div");
	el.className = "flex items-center gap-2.5 w-full min-h-[44px] px-4 py-3 rounded-xl border text-xs font-mono shadow-2xl cursor-pointer pointer-events-auto transition-all duration-300 translate-x-full opacity-0 " + COLORES[type];
	el.setAttribute("role", type === "error" ? "alert" : "status");
	el.appendChild(textoEl);
	el.appendChild(contador);
	const t = {
		el,
		contador,
		mensaje: texto,
		tipo: type,
		veces: 1
	};
	pintarContador(t);
	el.addEventListener("click", () => retirar(t));
	contenedor.appendChild(el);
	vivos.push(t);
	armar(t);
	while (vivos.length > MAX_VIVOS) retirar(vivos[0]);
	setTimeout(() => t.el.classList.remove("translate-x-full", "opacity-0"), 10);
}
//#endregion
//#region src/utils/format.ts
var UNITS = [
	"",
	"K",
	"M",
	"B",
	"T",
	"Qa",
	"Qi",
	"Sx",
	"Sp",
	"Oc",
	"No",
	"Dc"
];
var THRESHOLD = 1e3;
function formatNumber(num) {
	if (num === void 0 || num === null || !isFinite(num)) return "0";
	const negative = num < 0;
	const value = Math.abs(num);
	if (value < THRESHOLD) return `${negative ? "-" : ""}${Math.floor(value).toLocaleString("es-ES")}`;
	let tier = Math.floor(Math.log10(value) / 3);
	if (tier >= UNITS.length) return value.toExponential(2).replace("e+", "e");
	const scaled = value / Math.pow(THRESHOLD, tier);
	const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
	return `${negative ? "-" : ""}${scaled.toFixed(decimals)} ${UNITS[tier]}`;
}
//#endregion
//#region verify/stubs/firebase-app.ts
var initializeApp = (config) => ({
	config,
	name: "stub"
});
//#endregion
//#region verify/stubs/firebase-firestore.ts
var getFirestore = (app) => app;
var doc = (_db, ...path) => ({ id: path.join("/") });
var getDoc = async (ref) => {
	const doc = globalThis.__MEM_DB__?.[ref.id];
	return {
		exists: () => !!doc,
		data: () => doc ? clonar(doc) : void 0
	};
};
var clonar = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
var setDoc = async (ref, data, options) => {
	if (globalThis.__MEM_DB__?.fallar) throw new Error("FirestoreError: unavailable: Sin conexión (simulado)");
	const espera = globalThis.__MEM_DB__?.retrasar;
	if (espera) {
		delete globalThis.__MEM_DB__.retrasar;
		await espera;
	}
	const db = globalThis.__MEM_DB__;
	const previo = options?.merge ? db[ref.id] : void 0;
	db[ref.id] = clonar(previo ? {
		...previo,
		...data
	} : data);
};
var db = getFirestore(initializeApp({
	apiKey: "AIzaSyDe2OtAdDFWOml4v6EuISnPhYI-0xx8kOU",
	authDomain: "chronos-tap.firebaseapp.com",
	databaseURL: "https://chronos-tap-default-rtdb.firebaseio.com",
	projectId: "chronos-tap",
	storageBucket: "chronos-tap.firebasestorage.app",
	messagingSenderId: "755222927108",
	appId: "1:755222927108:web:82744c3626e7a125c92251",
	measurementId: "G-WGZLCFN2GH"
}));
//#endregion
//#region src/services/naniteQueue.ts
var CLAVE = "cyberforge_nanitas_pendientes";
var VERSION = 1;
var NADA = {
	existe: false,
	nanites: 0,
	producidas: 0,
	clics: 0,
	nucleos: 0,
	totalNucleos: 0,
	reinicios: 0,
	ts: 0
};
/**
* Lee la cola guardada para esta cuenta.
*
* NUNCA lanza y devuelve `existe: false` ante cualquier cosa inesperada: un
* `localStorage` corrupto, un registro de otra versión del juego o un
* `JSON.parse` fallando no pueden impedir que el juego arranque. Perder la cola
* es un bug de hace tres versiones; no arrancar es perder la partida.
*
* Que devuelva `existe: false` para un registro corrupto es deliberado: un
* registro ilegible no se puede comparar por fecha, así que no hay manera de
* saber si es más nuevo que el documento. Ante la duda se queda el documento,
* que es el estado que el jugador reconoce y el que todas las demás sesiones
* han visto. Inventarse una fecha sería apostar por un saldo que nadie ha visto.
*/
function leerCola(uid) {
	try {
		const crudo = localStorage.getItem(CLAVE);
		if (!crudo) return NADA;
		const r = JSON.parse(crudo);
		if (!r || r.v !== VERSION) return NADA;
		if (r.uid !== uid) return NADA;
		if (typeof r.ts !== "number" || !isFinite(r.ts) || r.ts <= 0) return NADA;
		if (![
			r.nanites,
			r.producidas,
			r.clics,
			r.nucleos,
			r.totalNucleos,
			r.reinicios
		].every((n) => typeof n === "number" && isFinite(n))) return NADA;
		return {
			existe: true,
			nanites: r.nanites,
			producidas: r.producidas,
			clics: r.clics,
			nucleos: r.nucleos,
			totalNucleos: r.totalNucleos,
			reinicios: r.reinicios,
			ts: r.ts
		};
	} catch {
		return NADA;
	}
}
/**
* Anota el estado actual como pendiente de confirmar.
*
* Se llama desde el propio guardado, antes de tocar la red. Es una escritura
* SÍNCRONA a propósito: el objetivo es que esté en el disco antes de que el
* jugador pueda cerrar la pestaña, y un `await` abre una ventana en la que un
* cierre deja la operación a medias.
*
* Se anota INCLUSO cuando los tres valores son cero, y esa es la parte
* delicada. El reinicio de prestigio pone las nanitas a cero: si aquí se
* escribiera "sin cola" por no haber nada pendiente, el documento del servidor
* se quedaría con el saldo previo y el reinicio se perdería. Escribir el cero
* es precisamente lo que lo hace desaparecer.
*/
function anotarPendiente(uid, nanites, producidas, clics, nucleos, totalNucleos, reinicios) {
	try {
		const registro = {
			v: VERSION,
			uid,
			nanites: Math.floor(nanites),
			producidas: Math.floor(producidas),
			clics: Math.floor(clics),
			nucleos: Math.floor(nucleos),
			totalNucleos: Math.floor(totalNucleos),
			reinicios: Math.floor(reinicios),
			ts: Date.now()
		};
		localStorage.setItem(CLAVE, JSON.stringify(registro));
		return registro.ts;
	} catch {
		return 0;
	}
}
/**
* Vacía la cola SOLO si lo que hay dentro sigue siendo lo que se acaba de
* confirmar, y devuelve si la vació.
*
* POR QUÉ NO BASTA CON `vaciarCola()` AL CONFIRMAR. `saveToFirebase` no se espera
* en ninguno de los treinta sitios que la llaman, así que dos guardados se
* solapan de forma normal: el jugador compra mientras el guardado anterior sigue
* en el aire. Y entonces:
*
*   · El guardado A anota 100 y sale hacia la red.
*   · El guardado B anota 200 y sale detrás.
*   · B falla. A llega después, su operación salió bien, y vacía la cola.
*
* El documento se queda con 100, la cola ya no está, y el jugador ha perdido 200
* nanitas sin ninguna forma de recuperarlas. Para A la operación fue un éxito,
* y con razón: lo que A confirman es que A llegó. Lo que no puede afirmar es que
* lo suyo sea lo último que se anotó.
*
* La marca de tiempo lo resuelve sin cambiar nada de la temporización: se vacía
* solo si el registro que hay dentro es el mismo —o uno más viejo— que el que
* este guardado confirmó. Si otro guardado escribió después, su saldo sigue ahí,
* que es justo lo que hay que dejar vivo.
*
* Lo que NO arregla esto: dos guardados que los dos terminan bien pueden
* escribirse en orden inverso, y el `setDoc` del que lleva el snapshot viejo se
* escribiría después, dejando el documento unos segundos por detrás. Esa carrera
* se cura sola en el siguiente guardado (cada compra y el intervalo de quince
* segundos), mientras que la que arregla esta función no se curaba nunca, porque
* la red de seguridad ya no estaba.
*/
function confirmarCola(tsConfirmado) {
	try {
		const crudo = localStorage.getItem(CLAVE);
		if (!crudo) return true;
		const r = JSON.parse(crudo);
		if (!r || typeof r.ts !== "number" || !isFinite(r.ts)) return false;
		if (r.ts > tsConfirmado) return false;
		localStorage.removeItem(CLAVE);
		return true;
	} catch {
		return false;
	}
}
/**
* ¿Queda algo por subir?
*
* Solo mira si el registro existe. NO compara contra el documento ni decide si
* el saldo es cero: un registro a cero puede ser el reinicio de prestigio, y
* esa es precisamente la razón de que siga ahí. Este "¿hay cola?" sirve para
* decidir si merece la pena reintentar un guardado, no para decidir qué saldo
* es el bueno.
*/
function hayPendientes(uid) {
	return leerCola(uid).existe;
}
//#endregion
//#region src/data/tiers.ts
var TIER_SYSTEM = {
	ranges: {
		1: [5, 7],
		2: [8, 12],
		3: [13, 19],
		4: [21, 31],
		5: [34, 50],
		6: [55, 81],
		7: [88, 132],
		8: [142, 214],
		9: [230, 346],
		10: [373, 559]
	},
	companionNames: {
		1: [
			"Dron Explorador",
			"Dron Centinela",
			"Dron Mensajero"
		],
		2: [
			"Cazador Nocturno",
			"Rastreador Fantasma",
			"Explorador Estelar"
		],
		3: [
			"Guerrero Mecánico",
			"Titán de Acero",
			"Coloso de Batalla"
		],
		4: [
			"Señor de la Guerra",
			"Destruyente Imperial",
			"Aniquilador Prime"
		],
		5: [
			"Avatar del Caos",
			"Heraldo del Vacío",
			"Portador del Trueno"
		],
		6: [
			"Supremo Estratega",
			"Maestro de Batallas",
			"General Supremo"
		],
		7: [
			"Forjador de Mundos",
			"Creador de Imperios",
			"Arquitecto Cósmico"
		],
		8: [
			"Devorador de Estrellas",
			"Señor del Tiempo",
			"Amo del Espacio"
		],
		9: [
			"Entidad Primordial",
			"Ser Trascendente",
			"Conciencia Universal"
		],
		10: [
			"Dios de la Guerra",
			"El Omnipotente",
			"El Infinito"
		]
	},
	collectorNames: {
		1: [
			"Blaster Láser",
			"Pistola de Plasma",
			"Rifle de Pulso"
		],
		2: [
			"Cañón de Partículas",
			"Lanzador de Energía",
			"Desintegrador Táctico"
		],
		3: [
			"Aniquilador Cuántico",
			"Devorador de Materia",
			"Coloso de Fuego"
		],
		4: [
			"Guadaña del Vacío",
			"Maldición Estelar",
			"Juicio Final"
		],
		5: [
			"Apocalipsis",
			"Armagedón",
			"Ragnarök"
		],
		6: [
			"Excalibur",
			"Mjolnir",
			"Gungnir"
		],
		7: [
			"Lanza del Destino",
			"Espada del Crepúsculo",
			"Hacha del Caos"
		],
		8: [
			"Corte del Tiempo",
			"Filo del Infinito",
			"Navaja Cósmica"
		],
		9: [
			"Recolector del Apocalipsis",
			"Instrumento de la Muerte",
			"Herencia de los Dioses"
		],
		10: [
			"El Principio y El Fin",
			"La Última Palabra",
			"El Todo y La Nada"
		]
	},
	rarityByTier: {
		1: "Común",
		2: "Común",
		3: "Raro",
		4: "Raro",
		5: "Épico",
		6: "Épico",
		7: "Legendario",
		8: "Legendario",
		9: "Mítico",
		10: "Divino"
	}
};
//#endregion
//#region src/data/cosmetics.ts
var glassBase = {
	border: "1px solid",
	borderRadius: "9999px"
};
var COSMETICS = [
	{
		id: "title_default",
		type: "title",
		name: "Sin título",
		description: "Operativo novel.",
		rarity: "Común",
		unlock: {
			kind: "default",
			value: 0
		},
		style: { color: "var(--text-muted)" }
	},
	{
		id: "title_recruited",
		type: "title",
		name: "Recluta",
		description: "Primera semana en la Cyber Base.",
		rarity: "Raro",
		unlock: {
			kind: "achievement",
			value: "first_click"
		},
		style: {
			color: "#60a5fa",
			font: "mono"
		}
	},
	{
		id: "title_smith",
		type: "title",
		name: "Aprendiz de Forja",
		description: "Forjaste tu primera recolector.",
		rarity: "Raro",
		unlock: {
			kind: "achievement",
			value: "first_forge"
		},
		style: {
			color: "#f97316",
			font: "mono"
		}
	},
	{
		id: "title_smith_master",
		type: "title",
		name: "Maestro de Forja",
		description: "Forjaste 25 recolectores.",
		rarity: "Épico",
		unlock: {
			kind: "achievement",
			value: "smith_25"
		},
		style: {
			color: "#fbbf24",
			font: "display"
		}
	},
	{
		id: "title_ascended",
		type: "title",
		name: "Ascendido",
		description: "Reiniciaste tu progreso 5 veces.",
		rarity: "Épico",
		unlock: {
			kind: "achievement",
			value: "ascendant"
		},
		style: {
			color: "#c084fc",
			font: "display"
		}
	},
	{
		id: "title_singularity",
		type: "title",
		name: "Singularidad",
		description: "Compraste el nodo Singularidad.",
		rarity: "Mítico",
		unlock: {
			kind: "cores",
			value: 0
		},
		style: {
			color: "#f0abfc",
			font: "display",
			glow: "true"
		}
	},
	{
		id: "title_champion",
		type: "title",
		name: "Campeón",
		description: "Permaneciste 7 días en el Top 3.",
		rarity: "Legendario",
		unlock: {
			kind: "ranking",
			value: 3
		},
		style: {
			color: "#fde047",
			font: "display",
			glow: "true"
		}
	},
	{
		id: "title_legend",
		type: "title",
		name: "Leyenda de la Forja",
		description: "Permaneciste 7 días en el Top 1.",
		rarity: "Divino",
		unlock: {
			kind: "ranking",
			value: 1
		},
		style: {
			color: "#fde047",
			font: "display",
			glow: "true",
			gradient: "linear-gradient(90deg,#fde047,#fb923c,#f472b6)"
		}
	},
	{
		id: "title_ghost",
		type: "title",
		name: "Fantasma",
		description: "Un logro secreto. No se explica.",
		rarity: "Mítico",
		unlock: {
			kind: "secret",
			value: "ghost",
			hint: "Haz algo que el juego no te pide."
		},
		style: {
			color: "#94a3b8",
			font: "display",
			blur: "true"
		}
	},
	{
		id: "title_architect",
		type: "title",
		name: "Arquitecto",
		description: "Abreste las 5 ramas del árbol.",
		rarity: "Divino",
		unlock: {
			kind: "cores",
			value: 2e3
		},
		style: {
			color: "#22d3ee",
			font: "display",
			glow: "true"
		}
	},
	{
		id: "frame_none",
		type: "frame",
		name: "Sin marco",
		description: "Perfil limpio.",
		rarity: "Común",
		unlock: {
			kind: "default",
			value: 0
		},
		style: {}
	},
	{
		id: "frame_steel",
		type: "frame",
		name: "Acero",
		description: "Borde metálico sobrio.",
		rarity: "Raro",
		unlock: {
			kind: "achievement",
			value: "first_click"
		},
		style: {
			...glassBase,
			borderColor: "#52525b"
		}
	},
	{
		id: "frame_neon",
		type: "frame",
		name: "Neón",
		description: "Borde con brillo pulsante.",
		rarity: "Épico",
		unlock: {
			kind: "cores",
			value: 40
		},
		style: {
			...glassBase,
			borderColor: "var(--accent)",
			boxShadow: "0 0 18px color-mix(in srgb, var(--accent) 60%, transparent)",
			animation: "framePulse 3s ease-in-out infinite"
		}
	},
	{
		id: "frame_ember",
		type: "frame",
		name: "Brasa",
		description: "Borde naranja de fundición.",
		rarity: "Épico",
		unlock: {
			kind: "achievement",
			value: "smith_25"
		},
		style: {
			...glassBase,
			borderColor: "#f97316",
			boxShadow: "0 0 20px #f9731666"
		}
	},
	{
		id: "frame_void",
		type: "frame",
		name: "Vacío",
		description: "Borde que absorbe la luz.",
		rarity: "Legendario",
		unlock: {
			kind: "cores",
			value: 250
		},
		style: {
			...glassBase,
			borderColor: "#7c3aed",
			boxShadow: "0 0 24px #7c3aed80, inset 0 0 20px #00000080"
		}
	},
	{
		id: "frame_gold",
		type: "frame",
		name: "Oro Prohibido",
		description: "Solo para el Top 1.",
		rarity: "Divino",
		unlock: {
			kind: "ranking",
			value: 1
		},
		style: {
			...glassBase,
			borderColor: "#fde047",
			boxShadow: "0 0 26px #fde04790",
			animation: "frameShimmer 4s linear infinite"
		}
	},
	{
		id: "frame_matrix",
		type: "frame",
		name: "Cascada",
		description: "Borde con degradado animado.",
		rarity: "Legendario",
		unlock: {
			kind: "ranking",
			value: 10
		},
		style: {
			...glassBase,
			borderColor: "transparent",
			background: "linear-gradient(#09090b,#09090b) padding-box, linear-gradient(90deg,#22c55e,#06b6d4,#a855f7) border-box",
			borderWidth: "2px"
		}
	},
	{
		id: "banner_none",
		type: "banner",
		name: "Sin fondo",
		description: "Fondo transparente.",
		rarity: "Común",
		unlock: {
			kind: "default",
			value: 0
		},
		style: {}
	},
	{
		id: "banner_grid",
		type: "banner",
		name: "Rejilla",
		description: "Rejilla técnica tenue.",
		rarity: "Raro",
		unlock: {
			kind: "default",
			value: 0
		},
		style: {
			backgroundImage: "linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)",
			backgroundSize: "18px 18px"
		}
	},
	{
		id: "banner_sunset",
		type: "banner",
		name: "Atardecer",
		description: "Degradado cálido.",
		rarity: "Raro",
		unlock: {
			kind: "cores",
			value: 20
		},
		style: { background: "linear-gradient(120deg,#7c2d12,#db2777)" }
	},
	{
		id: "banner_abyss",
		type: "banner",
		name: "Abismo",
		description: "Azul profundo con halo.",
		rarity: "Épico",
		unlock: {
			kind: "cores",
			value: 120
		},
		style: { background: "radial-gradient(120% 100% at 50% 0%,#1e3a8a,#020617 60%)" }
	},
	{
		id: "banner_toxic",
		type: "banner",
		name: "Tóxico",
		description: "Verde radioactivo.",
		rarity: "Épico",
		unlock: {
			kind: "achievement",
			value: "jackpot"
		},
		style: { background: "linear-gradient(135deg,#052e16,#10b981)" }
	},
	{
		id: "banner_crimson",
		type: "banner",
		name: "Carmesí",
		description: "Rojo de alarma.",
		rarity: "Legendario",
		unlock: {
			kind: "achievement",
			value: "ascendant"
		},
		style: { background: "linear-gradient(135deg,#450a0a,#dc2626)" }
	},
	{
		id: "banner_crown",
		type: "banner",
		name: "Corona",
		description: "Solo para el primer lugar.",
		rarity: "Divino",
		unlock: {
			kind: "ranking",
			value: 1
		},
		style: { background: "conic-gradient(from 180deg at 50% 0%,#fde047,#f97316,#fbbf24,#fef08c,#f97316,#fde047)" }
	},
	{
		id: "banner_hidden",
		type: "banner",
		name: "Sin Nombre",
		description: "Aparece en algunos perfiles. Nadie sabe de dónde sale.",
		rarity: "Mítico",
		unlock: {
			kind: "secret",
			value: "hidden",
			hint: "Cien cajas. Ni una más."
		},
		style: { background: "repeating-linear-gradient(45deg,#0b0b12,#0b0b12 8px,#18181f 8px,#18181f 16px)" }
	},
	{
		id: "title_scraplord",
		type: "title",
		name: "Señor de Chatarra",
		description: "Recicló más chatarra que nadie en la base.",
		rarity: "Raro",
		unlock: {
			kind: "crate",
			value: "common"
		},
		style: {
			color: "#a3a3a3",
			font: "mono"
		}
	},
	{
		id: "frame_oxy",
		type: "frame",
		name: "Óxido",
		description: "Borde corroído, del montón y sin pulir.",
		rarity: "Raro",
		unlock: {
			kind: "crate",
			value: "common"
		},
		style: {
			...glassBase,
			borderColor: "#a16207",
			borderStyle: "dashed"
		}
	},
	{
		id: "title_burnout",
		type: "title",
		name: "Fundido",
		description: "Se quedó sin refrigerante a mitad de una fusión.",
		rarity: "Épico",
		unlock: {
			kind: "crate",
			value: "rare"
		},
		style: {
			color: "#fb923c",
			font: "display"
		}
	},
	{
		id: "banner_foundry",
		type: "banner",
		name: "Fundición",
		description: "El horno encendido, de noche.",
		rarity: "Épico",
		unlock: {
			kind: "crate",
			value: "rare"
		},
		style: { background: "linear-gradient(160deg,#451a03,#ea580c 55%,#facc15)" }
	},
	{
		id: "title_nightshift",
		type: "title",
		name: "Turno de Noche",
		description: "La Cyber Base nunca está vacía.",
		rarity: "Legendario",
		unlock: {
			kind: "crate",
			value: "epic"
		},
		style: {
			color: "#818cf8",
			font: "display",
			glow: "true"
		}
	},
	{
		id: "banner_datastorm",
		type: "banner",
		name: "Tormenta de Datos",
		description: "Caudal de telemetría sin filtrar.",
		rarity: "Épico",
		unlock: {
			kind: "crate",
			value: "epic"
		},
		style: { backgroundImage: "repeating-linear-gradient(115deg,rgba(56,189,248,.28) 0 2px,transparent 2px 10px),linear-gradient(180deg,#082f49,#0c4a6e)" }
	},
	{
		id: "frame_quantum",
		type: "frame",
		name: "Cuántico",
		description: "Borde que solo está ahí cuando lo miras.",
		rarity: "Mítico",
		unlock: {
			kind: "crate",
			value: "legendary"
		},
		style: {
			...glassBase,
			borderColor: "transparent",
			borderWidth: "2px",
			background: "linear-gradient(#0b0b12,#0b0b12) padding-box, repeating-linear-gradient(90deg,#22d3ee 0 6px,transparent 6px 12px) border-box"
		}
	},
	{
		id: "banner_aurora",
		type: "banner",
		name: "Aurora",
		description: "El cielo de la Cyber Base visto desde el tejado.",
		rarity: "Legendario",
		unlock: {
			kind: "crate",
			value: "legendary"
		},
		style: { background: "linear-gradient(120deg,#4c1d95,#0e7490 45%,#10b981)" }
	},
	{
		id: "title_signal",
		type: "title",
		name: "La Señal",
		description: "El único cosmético Divino que no se gana en el ranking.",
		rarity: "Divino",
		unlock: {
			kind: "crate",
			value: "legendary"
		},
		style: {
			color: "#34d399",
			font: "display",
			glow: "true",
			gradient: "linear-gradient(90deg,#34d399,#22d3ee,#a78bfa)"
		}
	}
];
Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
/**
* Cosméticos que puede dar una caja.
*
* Es la única forma de que las tablas de botín sepan qué sortean: filtran por
* el `unlock` del catálogo en vez de llevar su propia lista de ids. Si las dos
* cosas vivieran separadas, bastaría con borrar una entrada de aquí para que la
* caja siguiera anunciando un cosmético que ya no existe, y el premio saldría
* con un id que nadie encuentra al equiparlo.
*
* Se lee del catálogo y no de una constante: el catálogo es la fuente de verdad
* desde antes de que existiera el botín de cosméticos.
*/
var crateCosmetics = (crate) => COSMETICS.filter((c) => c.unlock.kind === "crate" && c.unlock.value === crate);
//#endregion
//#region src/data/store.ts
var CONSUMABLES = {
	backpackExpander: {
		name: "Expansor de Almacén",
		details: "Aumenta el almacén +1 slot (máx 20)",
		rarity: "Raro",
		buffId: "warehouseExpander"
	},
	afkCard: {
		name: "Tarjeta AFK",
		details: "Permite juego sin la ventana activa 10 min (acumulable x3)",
		rarity: "Raro",
		buffId: "afk"
	},
	clickX2Card: {
		name: "Tarjeta Click x2",
		details: "Otorga x2 al click por 30 segundos",
		rarity: "Raro",
		buffId: "clickX2"
	},
	clickX3Card: {
		name: "Tarjeta Click x3",
		details: "Otorga x3 al click por 30 segundos",
		rarity: "Épico",
		buffId: "clickX3"
	},
	calibrationStone: {
		name: "Piedra de Calibración",
		details: "Sube 12 puntos la probabilidad de la próxima fusión",
		rarity: "Raro",
		buffId: "calibrationStone"
	},
	stabilityNano: {
		name: "Nanopartícula de Estabilidad",
		details: "Deja el recolector forjado con un afijo extra garantizado",
		rarity: "Legendario",
		buffId: "stabilityNano"
	}
};
var CRATE_TYPES = {
	common: {
		name: "Caja Común",
		rarity: "Común",
		details: "Recompensas de partida temprana: nanitas, cristales, algún dron T1."
	},
	rare: {
		name: "Caja Rara",
		rarity: "Raro",
		details: "Material de forja y compañeros T3, con algún recolector T4 sobrecargado."
	},
	epic: {
		name: "Caja Épica",
		rarity: "Épico",
		details: "Compañeros T6 y recolectores T6, con piedras de calibración."
	},
	legendary: {
		name: "Caja Legendaria",
		rarity: "Legendario",
		details: "Recolectores T8 y compañeros Divinos que no se compran. Sale la Nanopartícula de Estabilidad."
	}
};
var KEY_COSTS = [
	250,
	900,
	3e3,
	11e3
];
var COMPANION_SLOT_COSTS = [
	0,
	1200,
	4500,
	16e3,
	55e3,
	18e4,
	52e4,
	14e5,
	36e5,
	9e6
];
/**
* Las tres compras de ranura, y CADA UNA CON EL NÚMERO QUE DA.
*
* `da` es lo que el motor escribe en `maxCompanionSlots`. Es lo único que decide
* cuántas ranuras hay, y la tarjeta lo lee de aquí, así que no puede ser un "+3" en
* un texto y un `= 5` en el motor: es un número en un sitio.
*
* Los saltos son +1, +2 y +2. El +2 del medio sube el total a 4 en vez de a 5, que
* es lo que hace que la tercera compra quede cerca de la segunda en vez de dejar un
* +3 y un +1 detrás.
*/
var COMPANION_SLOT_BUY = [
	{
		da: 2,
		etiqueta: "Slot de Compañero 2"
	},
	{
		da: 4,
		etiqueta: "Ranura de Escuadrón (ranuras 3 y 4)"
	},
	{
		da: 6,
		etiqueta: "Ranura de Escuadrón (ranuras 5 y 6)"
	}
];
/** La carta de tienda `companionSlotN` (N = 1, 2, 3), con su precio y su etiqueta. */
function defDeRanura(n) {
	const compra = COMPANION_SLOT_BUY[n - 1];
	return {
		cost: COMPANION_SLOT_COSTS[n] ?? 0,
		label: compra?.etiqueta ?? "Ranura de escuadrón"
	};
}
/**
* Qué carta de la tienda es cuál compra de ranura.
*
* Se construye de `COMPANION_SLOT_BUY` para que las dos mitades no puedan
* separarse: si alguien añade una cuarta compra a la tabla, la carta aparece sola
* y con su número. Es lo mismo que hace `STORE_KEY_TIER` con las llaves (B7), y el
* motivo por el que aquí se repite: los dos sitios eran el bug.
*/
var RANURA_POR_CARTA = Object.fromEntries(COMPANION_SLOT_BUY.map((c, i) => [`companionSlot${i + 1}`, c]));
var STORE_ITEMS = {
	keyT0: {
		cost: KEY_COSTS[0],
		label: "Llave de Cifrado"
	},
	keyT1: {
		cost: KEY_COSTS[1],
		label: "Llave Reforzada"
	},
	keyT2: {
		cost: KEY_COSTS[2],
		label: "Llave Rúnica"
	},
	keyT3: {
		cost: KEY_COSTS[3],
		label: "Llave del Vacío"
	},
	upgradeCrystal: {
		cost: 200,
		label: "Cristal de Mejora"
	},
	warehouseSlot: {
		cost: 6e3,
		label: "Ampliar Almacén (+5 slots)"
	},
	commonCrate: {
		cost: 500,
		label: "Caja Común"
	},
	rareCrate: {
		cost: 1500,
		label: "Caja Rara"
	},
	epicCrate: {
		cost: 5500,
		label: "Caja Épica"
	},
	legendaryCrate: {
		cost: 21e3,
		label: "Caja Legendaria"
	},
	backpackExpander: {
		cost: 1400,
		label: "Expansor de Almacén (+1 slot)"
	},
	companionSlot1: defDeRanura(1),
	companionSlot2: defDeRanura(2),
	companionSlot3: defDeRanura(3),
	afkCard: {
		cost: 1e4,
		label: "Tarjeta AFK Básica (10 min, acumulable x3)"
	},
	clickX2Card: {
		cost: 5e3,
		durationMs: 3e4,
		label: "Tarjeta Click x2 (30s)"
	},
	clickX3Card: {
		cost: 15e3,
		durationMs: 3e4,
		label: "Tarjeta Click x3 (30s)"
	},
	calibrationStone: {
		cost: 45e3,
		label: "Piedra de Calibración (+12% de éxito)"
	},
	stabilityNano: {
		cost: 9e4,
		label: "Nanopartícula de Estabilidad (+8% y un afijo extra)"
	},
	companionCardT1: {
		cost: 900,
		label: "Compañero Tier 1"
	},
	companionCardT2: {
		cost: 1700,
		label: "Compañero Tier 2"
	},
	companionCardT3: {
		cost: 3e3,
		label: "Compañero Tier 3"
	},
	companionCardT4: {
		cost: 5500,
		label: "Compañero Tier 4"
	},
	companionCardT5: {
		cost: 9900,
		label: "Compañero Tier 5"
	},
	companionCardT6: {
		cost: 18e3,
		label: "Compañero Tier 6"
	},
	companionCardT7: {
		cost: 32550,
		label: "Compañero Tier 7"
	},
	companionCardT8: {
		cost: 59050,
		label: "Compañero Tier 8"
	},
	companionCardT9: {
		cost: 106950,
		label: "Compañero Tier 9"
	},
	companionCardT10: {
		cost: 193850,
		label: "Compañero Tier 10"
	},
	collectorCardT1: {
		cost: 900,
		label: "Recolector Tier 1"
	},
	collectorCardT2: {
		cost: 1700,
		label: "Recolector Tier 2"
	},
	collectorCardT3: {
		cost: 3e3,
		label: "Recolector Tier 3"
	},
	collectorCardT4: {
		cost: 5500,
		label: "Recolector Tier 4"
	},
	collectorCardT5: {
		cost: 9900,
		label: "Recolector Tier 5"
	},
	collectorCardT6: {
		cost: 18e3,
		label: "Recolector Tier 6"
	},
	collectorCardT7: {
		cost: 32550,
		label: "Recolector Tier 7"
	},
	collectorCardT8: {
		cost: 59050,
		label: "Recolector Tier 8"
	},
	collectorCardT9: {
		cost: 106950,
		label: "Recolector Tier 9"
	},
	collectorCardT10: {
		cost: 193850,
		label: "Recolector Tier 10"
	}
};
//#endregion
//#region src/data/items.ts
/**
* Tipos de cofre y sus nombres.
*
* Se importan como VALOR, no solo como tipo, y es lo que hace que el `details` de
* una llave pueda escribirse solo: el texto sale de `CRATE_TYPES`, que es donde
* vive el nombre de cada caja, y de `CRATE_KEY_TIER`, que es donde vive la regla
* de qué llave la abre. Las dos mitades de la frase salen de las dos tablas que
* ya existían y no se añade ninguna tercera.
*
* Este módulo ya dependía de `store.ts` (por el tipo `CrateType`), así que esto
* no crea un ciclo nuevo: la flecha va en el mismo sentido.
*/
/**
* El nivel de llave se compara por índice, no por rareza textual: "Épico" no
* ordena de forma fiable entre idiomas y es un dato editable desde Firestore.
*/
var KEY_TIER_ORDER = [
	0,
	1,
	2,
	3
];
/** Qué llave necesita cada cofre. */
var CRATE_KEY_TIER = {
	common: 0,
	rare: 1,
	epic: 2,
	legendary: 3
};
/**
* Los cofre que abre una llave de este nivel, de menor a mayor.
*
* ES LA MISMA PREGUNTA QUE `keyOpens`, CON EL MISMO CRITERIO, y por eso no es
* una segunda regla: sale de llamar a `keyOpens`. Antes esta lista estaba
* escrita a mano en el `details` de cada llave, y las cuatro mentían (B6): la
* Cifrada decía "Comunes y Raros" sin abrir las raras, y la Rúnica decía
* "Épicos y Legendarios" sin abrir las legendarias. Un texto derivado no puede
* mentir porque no hay nadie que lo escriba.
*/
function cratesOpenedBy(keyTier) {
	return Object.keys(CRATE_KEY_TIER).filter((c) => keyOpens(keyTier, CRATE_KEY_TIER[c])).sort((a, b) => CRATE_KEY_TIER[a] - CRATE_KEY_TIER[b]);
}
/** El `details` de una llave, generado con el mismo criterio que la regla. */
function detailsDeLlave(keyTier) {
	const nombres = cratesOpenedBy(keyTier).map((c) => CRATE_TYPES[c].name);
	if (nombres.length === 0) return "No abre ningún cofre.";
	if (nombres.length === 1) return `Abre ${nombres[0]}.`;
	const ultimo = nombres.pop();
	return `Abre ${nombres.join(", ")} y ${ultimo}.`;
}
/**
* Las cuatro llaves, con su texto generado. Su PRECIO no está aquí: está en
* `KEY_COSTS` (`data/store.ts`), que es el fichero de los precios, y las cuatro
* cartas de la tienda lo leen de ahí. Con el precio en dos sitios fue como la
* tienda acabó vendiendo una carta llamada "Llave de Cifrado" que entregaba la
* Reforzada (B7): nombre en un sitio, entrega en otro, precio en un tercero.
*
* POR QUÉ LAS CUATRO SON COMPRABLES. La cadena de llaves era una escalera
* imposible (B6): la del Vacío no salía de ninguna parte, así que la caja
* legendaria no se podía abrir nunca, y la Rúnica solo salía de la legendaria.
* Cerrar el botín arregla medio problema, pero deja la tienda como una red de
* seguridad cara: si un jugador llega a la legendaria sin llave, tiene que poder
* comprarla. Con las cuatro a la venta, ningún cofre es inalcanzable por
* defecto y la tienda deja de ser un callejón sin salida.
*/
var KEY_DEFS = {
	0: {
		tier: 0,
		name: "Llave de Cifrado",
		namePlural: "Llaves de Cifrado",
		details: detailsDeLlave(0),
		rarity: "Común",
		buyable: true,
		cost: KEY_COSTS[0],
		dropRate: 0
	},
	1: {
		tier: 1,
		name: "Llave Reforzada",
		namePlural: "Llaves Reforzadas",
		details: detailsDeLlave(1),
		rarity: "Raro",
		buyable: true,
		cost: KEY_COSTS[1],
		dropRate: 22
	},
	2: {
		tier: 2,
		name: "Llave Rúnica",
		namePlural: "Llaves Rúnicas",
		details: detailsDeLlave(2),
		rarity: "Épico",
		buyable: true,
		cost: KEY_COSTS[2],
		dropRate: 14
	},
	3: {
		tier: 3,
		name: "Llave del Vacío",
		namePlural: "Llaves del Vacío",
		details: detailsDeLlave(3),
		rarity: "Legendario",
		buyable: true,
		cost: KEY_COSTS[3],
		dropRate: 4
	}
};
/**
* Qué carta de la tienda vende cada llave: `keyT0` → nivel 0, y así.
*
* ESTE MAPA ES LO QUE ARREGLA B7, y existe para que nadie tenga que escribir el
* nivel otra vez. El fallo era que la compra usaba un `STORE_MATERIAL_TIER`
* único para todas las llaves: una sola carta, un solo nivel, y el nombre de la
* carta ('Llave de Cifrado') no tenía nada que ver con lo que entraba al
* almacén. Con el nivel saliendo del nombre de la carta, el nombre y el item
* son lo mismo por construcción.
*
* Va al revés que un parseo de nombre: aquí el nombre de la carta decide el
* nivel y el nivel decide el nombre del item, en vez de adivinar el nivel a
* partir del nombre del item. Un item guardado por una partida vieja puede
* tener cualquier nombre; una carta de tienda es de este fichero.
*/
var STORE_KEY_TIER = {
	keyT0: 0,
	keyT1: 1,
	keyT2: 2,
	keyT3: 3
};
var CRYSTAL_DEFS = {
	1: {
		tier: 1,
		name: "Cristal de Afino",
		details: "x1 a la probabilidad de mejora.",
		rarity: "Común",
		buyable: true,
		cost: 1440,
		power: 1,
		dropRate: 0
	},
	2: {
		tier: 2,
		name: "Cristal de Fase",
		details: "x1.75 a la probabilidad de mejora.",
		rarity: "Raro",
		buyable: false,
		cost: null,
		power: 1.75,
		dropRate: 20
	},
	3: {
		tier: 3,
		name: "Cristal de Entropía",
		details: "x2.75 a la probabilidad de mejora.",
		rarity: "Épico",
		buyable: false,
		cost: null,
		power: 2.75,
		dropRate: 12
	},
	4: {
		tier: 4,
		name: "Cristal Singular",
		details: "x4 a la probabilidad de mejora. Casi nunca falla.",
		rarity: "Legendario",
		buyable: false,
		cost: null,
		power: 4,
		dropRate: 4
	}
};
/**
* Probabilidad de éxito de una sintonización con el cristal dado.
*
* Fórmula base: `95 - nivel·3`, con suelo en 35. Es alta al principio y se
* estrecha al final, así que el jugador sube deprisa las primeras niveles y
* tiene que decidir cuánto arriesgar en las últimas.
*
* El cristal multiplica DESPUÉS de aplicar el suelo, no antes. Si
* multiplicara antes, un cristal x4 con el suelo en 35 daría 140; el recorte
* al 95 se comería la diferencia casi entera y el cristal caro no valdría su
* precio. El techo del 95% es intencionado —nunca hay fallo garantizado, solo
* improbable— para que la mejora siempre se sienta posible.
*/
function crystalSuccessChance(level, crystalPower) {
	const base = Math.max(35, 95 - level * 3);
	return Math.min(95, Math.round(base * crystalPower));
}
/**
* Devuelve el multiplicador de un cristal por su etiqueta.
*
* Se busca por etiqueta y no por un campo `tier` guardado, porque las partidas
* viejas no tienen ese campo y porque la etiqueta es lo que el jugador ve.
* Si el nombre no se reconoce, se cae al cristal básico: una mejora nunca
* debe fallar por un dato corrupto.
*/
function crystalPowerFromName(name) {
	const n = (name || "").toLowerCase();
	if (n.includes("singular")) return CRYSTAL_DEFS[4].power;
	if (n.includes("entrop")) return CRYSTAL_DEFS[3].power;
	if (n.includes("fase")) return CRYSTAL_DEFS[2].power;
	return CRYSTAL_DEFS[1].power;
}
/** Devuelve el nivel de llave a partir del nombre del item. */
function keyTierFromName(name) {
	const n = (name || "").toLowerCase();
	if (n.includes("vacio") || n.includes("vacío")) return 3;
	if (n.includes("rúnica") || n.includes("runica")) return 2;
	if (n.includes("reforzada")) return 1;
	return 0;
}
/**
* Una llave de nivel `held` ¿abre un cofre de nivel `needed`?
*
* La regla es "igual o superior": una llave del Vacío abre una caja común.
* Al revés no, porque entonces el nivel de la llave no comunicaría nada.
*
* Y LA REGLA NO ES EL BUG DE B6, aunque lo parecía. Con "igual o superior" la
* Reforzada no abre la épica (1 < 2) ni la legendaria, así que **cada nivel
* sigue siendo el único que abre su caja** y no hay contenido muerto. Lo que
* estaba roto era otra cosa, y son tres cosas distintas:
*
*   1. los cuatro `details` estaban escritos a mano y los cuatro mentían
*      (ahora se generan con esta misma función, así que no pueden);
*   2. la llave del Vacío no salía de ninguna parte, así que la caja
*      legendaria era imponible de abrir (B6);
*   3. la tienda vendía una sola llave, con un nombre y un precio que no eran
*      los de la llave que entregaba (B7).
*
* Dejar la regla como estaba, y documentar por qué, aunque cueste leerlo. Se
* probó la igualdad exacta ("una llave, una caja") y se volvió atrás: rompe a
* propósito que la llave del Vacío sirva para las cajas de abajo, que es la
* mitad de la comodidad del sistema, y F5 no la pedía — pedía que exista una
* llave por tipo de caja, y con cuatro llaves y cuatro cajas eso ya se cumple.
*/
function keyOpens(keyHeld, keyNeeded) {
	return KEY_TIER_ORDER.indexOf(keyHeld) >= KEY_TIER_ORDER.indexOf(keyNeeded);
}
//#endregion
//#region src/components/crateLoot.ts
var RARITY_RANK = {
	"Común": 0,
	"Raro": 1,
	"Épico": 2,
	"Legendario": 3,
	"Mítico": 4,
	"Divino": 5,
	"Sobrecargado": 6
};
var CRATE_META = {
	common: {
		name: "Caja Común",
		icon: "crate",
		accent: "text-slate-300",
		cost: 400
	},
	rare: {
		name: "Caja Rara",
		icon: "crate",
		accent: "text-blue-400",
		cost: 1200
	},
	epic: {
		name: "Caja Épica",
		icon: "crystal",
		accent: "text-purple-400",
		cost: 4500
	},
	legendary: {
		name: "Caja Legendaria",
		icon: "trophy",
		accent: "text-amber-400",
		cost: 18e3
	}
};
var CRATE_ONLY_COMPANIONS = [
	{
		name: "Fantasma Cuántico",
		type: "multiplier",
		power: .35,
		rarity: "Mítico",
		icon: "sparkle"
	},
	{
		name: "Oráculo Tribal",
		type: "multiplier",
		power: .75,
		rarity: "Legendario",
		icon: "crystal"
	},
	{
		name: "Avatar del Vacío",
		type: "passive",
		power: 65,
		rarity: "Divino",
		icon: "globe"
	},
	{
		name: "Fénix de Datos",
		type: "passive",
		power: 40,
		rarity: "Mítico",
		icon: "bolt"
	},
	{
		name: "Centinela Eterno",
		type: "click",
		power: 32,
		rarity: "Legendario",
		icon: "shield"
	},
	{
		name: "Espectro Azulado",
		type: "passive",
		power: 18,
		rarity: "Épico",
		icon: "companion"
	}
];
var COSMETIC_ICON = {
	title: "medal",
	frame: "sparkle",
	banner: "layers"
};
/** Recolectores sobrecargadas: mismo tier, daño por encima del rango normal del tier. */
function makeOverclockCollector(tier) {
	const top = (TIER_SYSTEM.ranges[tier] || [1, 5])[1];
	const damage = Math.round(top * 1.25);
	const names = TIER_SYSTEM.collectorNames[tier] || ["Blaster Láser"];
	const name = names[Math.floor(Math.random() * names.length)];
	RARITY_RANK[tier >= 9 ? "Divino" : tier >= 7 ? "Mítico" : "Legendario"];
	return {
		name: `${name} SOBRECARGADO`,
		rarity: "Sobrecargado",
		details: `Recolección por click: +${damage} (base T${tier}: ${top})`,
		item: {
			id: `oc_collector_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			name: `${name} SOBRECARGADO`,
			type: "collector",
			details: `Recolección por click: +${damage} (base T${tier}: ${top})`,
			rarity: "Sobrecargado",
			tier,
			level: 0,
			damage,
			overclock: true,
			sellPrice: Math.round(CRATE_META.legendary.cost * .4)
		}
	};
}
function makeCrateOnlyCompanion(entry) {
	const id = `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	const details = entry.type === "multiplier" ? `Multiplicador global: x${(1 + entry.power).toFixed(2).replace(/\.?0+$/, "")}` : `Recolección por segundo: +${entry.power}/s`;
	return {
		companion: {
			id,
			name: entry.name,
			type: entry.type,
			power: entry.power,
			rarity: entry.rarity
		},
		item: {
			id,
			name: entry.name,
			type: "companion",
			details,
			rarity: entry.rarity,
			companionType: entry.type,
			power: entry.power,
			exclusive: true,
			sellPrice: 0
		}
	};
}
/**
* Un cosmético de esta caja, de entre los que el jugador todavía no tiene.
*
* Filtra por los que ya posee a propósito. Sortear a ciegas entre los que ya
* tiene convertiría la segunda legendaria de la tarde en un cosmético repetido,
* y el jugador leería "La Señal" en la ruleta y "ya lo tienes" en el inventario:
* la casilla volvería a mentir sobre el premio. Con el filtro, la ruleta
* enseña siempre algo que de verdad entra.
*
* `null` si ya los tiene todos, que es la única forma de que esto no dé nada.
*/
function rollCrateCosmetic(crate, owned) {
	const libres = crateCosmetics(crate).filter((c) => !owned.includes(c.id));
	if (libres.length === 0) return null;
	const cos = libres[Math.floor(Math.random() * libres.length)];
	return {
		kind: "cosmetic",
		amount: 1,
		name: cos.name,
		label: cos.name,
		details: cos.description,
		rarity: cos.rarity,
		icon: COSMETIC_ICON[cos.type],
		cosmeticId: cos.id,
		exclusive: true
	};
}
var rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
/**
* La entrada de llaves de una caja, y sale de `CRATE_KEY_TIER`: **cada caja
* suelta la llave que la abre**.
*
* POR QUÉ ESTA FUNCIÓN Y NO CUATRO ENTRADAS ESCRITAS A MANO. Antes las cuatro
* estaban escritas una por una, con su nombre, su texto y su nivel, y por eso la
* cadena era una escalera imposible (B6): la legendaria soltaba la Rúnica, la
* Rúnica solo salía de la legendaria, y **la del Vacío no salía de ninguna
* parte**, así que la caja legendaria no se podía abrir nunca. Con la tabla, la
* leyenda del Vacío sale de la legendaria porque es lo que la tabla dice, no
* porque alguien lo escribiera.
*
* Y EL NOMBRE Y EL TEXTO TAMBIÉN SALEN DE AQUÍ, y no están en la línea de
* abajo, por la misma razón que la tienda: nombre, texto y nivel tenían tres
* copias y ninguna se deducía de las otras. Un botín que anuncia una llave con
* un nombre que no es el de esa llave vuelve a ser el bug, solo que en la
* ruleta.
*
* LA CANTIDAD ES 1 O 2 PARA TODAS, a propósito. Es lo justo para devolver parte
* de lo que costó la llave y no más: si una caja devolviera la llave entera,
* comprar llave y caja en la tienda sería indiferente y el cofre dejaría de ser
* una decisión de riesgo. Con 1 o 2, abrir es siempre una pérdida neta de
* nanitas y la tienda nunca es el camino bueno.
*/
function buildKeyLoot(crateType) {
	const tier = CRATE_KEY_TIER[crateType];
	const def = KEY_DEFS[tier];
	return {
		id: "keys",
		weight: 10,
		build: () => {
			const a = rand(1, 2);
			const etiqueta = a > 1 ? def.namePlural : def.name;
			return {
				kind: "keys",
				amount: a,
				name: def.name,
				label: `+${a} ${etiqueta}`,
				details: def.details,
				rarity: def.rarity,
				icon: "key",
				keyTier: tier
			};
		}
	};
}
/**
* LA PROBABILIDAD BAJA DE QUE UNA CAJA DÉ ALGO DE ARRIBA (F6).
*
* Cada caja tiene su tabla con lo que le corresponde, y en cada una hay una entrada
* `up` de peso bajo: un tier por encima, o un nivel de caja. No es decoration,
* es la razón por la que abrir una caja común tiene una sorpresa, aunque sea rara:
*
*   común     6%   dron T2 o recolector T2
*   rara      5%   T6 o recolector T6 sobrecargado
*   épica     4%   T10 o recolector T10 sobrecargado
*   legendaria 4%  compañía exclusiva de caja que no estaba en la tabla
*
* **POR QUÉ EL PESO ES BAJO Y NO UNA FRACCIÓN.** El peso es relativo dentro de la
* caja: un 5% de peso no es un 5% de probabilidad, es `5 / suma`. Con la tabla de la
* rara sumando 101, sale un 4,95%. Está bien que sea bajo, pero no porque el número
* lo sea.
*
* **POR QUÉ UN SOLO PASO Y NO "LO QUE SALGA".** Si una caja pudiera dar cualquier
* tier de arriba, la caja común sería una caja legendaria con más pasos. Un solo
* salto hace que el premio alto siga siendo reconocible ("me ha salido un T6 en una
* caja rara") y que se pueda razonar: la caja legendaria es donde se busca lo bueno.
*
* Y la probabilidad real de un salto **no es el peso**: es `peso / suma de la tabla`,
* y la suma es distinta en cada caja. Por eso los pesos no son iguales en las cuatro
* y por eso `llaveCheck`-style, el banco mide las cuatro por separado en vez de mirar
* el número de la tabla.
*
* **Y AQUÍ ESTÁ D1, QUE SE RESUELVE DE PASO.** `CRATE_ONLY_COMPANIONS` tiene seis
* compañeros y la tabla de la legendaria solo usa los índices 0 a 4: el **Espectro
* Azulado** (índice 5) estaba definido y era inalcanzable. Se ha metido en la tabla
* en vez de borrarlo, porque el arreglo de más valor para el jugador es que exista
* el compañero y que se pueda conseguir, no que el array quede bonito. La entrada
* baja a 6 y el resto se queda como estaba, así que el índice 5 no se ha movido y
* ningún guardado lo apunta.
*/
function buildUpLoot(crateType) {
	return {
		id: "up",
		weight: UP_WEIGHTS[crateType],
		build: () => subirNTier(crateType, 1)
	};
}
/** Pesos del salto, por caja. Medidos, no redondeados. */
var UP_WEIGHTS = {
	common: 6,
	rare: 5,
	epic: 4,
	legendary: 4
};
/**
* Un nombre del tier de arriba, elegido al azar entre los tres.
*
* El `as Record<number, string[]>` está porque `companionNames` está tipado con las
* claves literales 1..10 y aquí el índice llega como `number` (sale de
* `TIER_PROPIO[c] + 1`, y `TIER_PROPIO` es un `Record<CrateType, number>`). El
* índice es correcto: `Math.min(10, ...)` lo deja siempre en rango.
*/
function nombreDeArriba(origen, tier) {
	const tablas = TIER_SYSTEM.companionNames;
	const lista = origen === "companion" ? tablas[tier] : TIER_SYSTEM.collectorNames[tier];
	return lista[rand(0, lista.length - 1)];
}
/**
* El premio del salto: un tier por encima del que le tocaría a la caja.
*
* O sea: una caja común da un T2 (le tocaría T1), una rara da un T4, una épica da
* un T8 y una legendaria da un T10. La razón de "+1" y no "+2" es que el salto se
* note sin dejar de ser del mismo juego: un T4 dentro de una caja rara ya es
* imposible por el precio (4.500 contra 1.500 de la caja) y ya es un premio.
*/
function subirNTier(crateType, pasos) {
	const propio = TIER_PROPIO[crateType];
	const tier = Math.min(10, propio + pasos);
	if (Math.random() < .5) {
		const t = TIER_SYSTEM.ranges[tier];
		const p = rand(t[0], t[1]);
		const nombre = nombreDeArriba("companion", tier);
		return {
			kind: "companion",
			amount: 1,
			name: nombre,
			label: nombre,
			details: `Recolección por segundo: +${p}/s`,
			rarity: TIER_SYSTEM.rarityByTier[tier],
			icon: "companion",
			tier,
			item: {
				id: `crate_up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
				name: nombre,
				type: "companion",
				details: `Recolección por segundo: +${p}/s`,
				rarity: TIER_SYSTEM.rarityByTier[tier],
				tier,
				companionType: "passive",
				power: p,
				sellPrice: Math.floor(p * 62)
			},
			up: true
		};
	}
	const w = makeOverclockCollector(tier);
	return {
		kind: "collector",
		amount: 1,
		name: w.name,
		label: w.name,
		details: w.details,
		rarity: w.rarity,
		icon: "collector",
		tier,
		item: w.item,
		up: true
	};
}
/** El tier que le "toca" a cada caja, que es la referencia del salto de +1. */
var TIER_PROPIO = {
	common: 1,
	rare: 3,
	epic: 6,
	legendary: 8
};
var CRATE_LOOT = {
	common: [
		{
			id: "nanites",
			weight: 34,
			build: () => {
				const a = rand(250, 400);
				return {
					kind: "nanites",
					amount: a,
					name: "Nanitas",
					label: `+${a} Nanitas`,
					details: "Materia prima básica",
					rarity: "Común",
					icon: "bolt"
				};
			}
		},
		{
			id: "crystals",
			weight: 26,
			build: () => {
				const a = rand(2, 4);
				return {
					kind: "crystals",
					amount: a,
					name: "Cristales de Mejora",
					label: `+${a} Cristales`,
					details: "Sube el nivel del recolector",
					rarity: "Raro",
					icon: "crystal",
					materialTier: 1
				};
			}
		},
		{
			id: "dron",
			weight: 22,
			build: () => ({
				kind: "companion",
				amount: 1,
				name: "Dron Explorador",
				label: "Dron Explorador",
				details: "Recolección por segundo: +2/s",
				rarity: "Común",
				icon: "companion",
				tier: 1,
				item: {
					id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					name: "Dron Explorador",
					type: "companion",
					details: "Recolección por segundo: +2/s",
					rarity: "Común",
					companionType: "passive",
					power: 2,
					sellPrice: 100
				}
			})
		},
		buildKeyLoot("common"),
		buildUpLoot("common"),
		{
			id: "expander",
			weight: 6,
			build: () => ({
				kind: "consumable",
				amount: 1,
				name: "Ranura de Almacén",
				label: "+1 ranura de almacén",
				details: "Amplía el almacén +1 slot",
				rarity: "Raro",
				icon: "plus",
				item: {
					id: `crate_slot_${Date.now()}`,
					name: "Ranura de Almacén",
					type: "consumable",
					details: "Amplía el almacén +1 slot",
					rarity: "Raro",
					buffId: "warehouseExpander",
					stackable: true,
					stackCount: 1,
					sellPrice: 125
				}
			})
		},
		{
			id: "cosmetic",
			weight: 5,
			build: (ctx) => rollCrateCosmetic("common", ctx.ownedCosmetics)
		}
	],
	rare: [
		{
			id: "crystals",
			weight: 26,
			build: () => {
				const a = rand(6, 10);
				return {
					kind: "crystals",
					amount: a,
					name: "Cristales de Mejora",
					label: `+${a} Cristales`,
					details: "Sube el nivel del recolector",
					rarity: "Épico",
					icon: "crystal",
					materialTier: 1
				};
			}
		},
		{
			id: "companion_t3",
			weight: 24,
			build: () => {
				const t = TIER_SYSTEM.ranges[3];
				const p = rand(t[0], t[1]);
				return {
					kind: "companion",
					amount: 1,
					name: "Artillero Táctico",
					label: "Artillero Táctico",
					details: `Recolección por segundo: +${p}/s`,
					rarity: "Épico",
					icon: "bolt",
					tier: 3,
					item: {
						id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
						name: "Artillero Táctico",
						type: "companion",
						details: `Recolección por segundo: +${p}/s`,
						rarity: "Épico",
						tier: 3,
						companionType: "passive",
						power: p,
						sellPrice: 400
					}
				};
			}
		},
		{
			id: "collector_t4",
			weight: 20,
			build: () => {
				const w = makeOverclockCollector(4);
				return {
					kind: "collector",
					amount: 1,
					name: w.name,
					label: w.name,
					details: w.details,
					rarity: w.rarity,
					icon: "collector",
					tier: 4,
					item: w.item
				};
			}
		},
		{
			id: "epic_crate",
			weight: 16,
			build: () => ({
				kind: "crate",
				amount: 1,
				name: "Caja Épica",
				label: "+1 Caja Épica",
				details: "Abre una caja de botín superior",
				rarity: "Épico",
				icon: "crystal",
				item: {
					id: `crate_epic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					name: "Caja Épica",
					type: "crate",
					details: "Contiene recompensas altas",
					rarity: "Épico",
					tier: 0,
					sellPrice: 1125,
					stackable: true,
					stackCount: 1
				}
			})
		},
		buildKeyLoot("rare"),
		buildUpLoot("rare"),
		{
			id: "cosmetic",
			weight: 5,
			build: (ctx) => rollCrateCosmetic("rare", ctx.ownedCosmetics)
		}
	],
	epic: [
		{
			id: "crystals",
			weight: 22,
			build: () => {
				const a = rand(16, 24);
				return {
					kind: "crystals",
					amount: a,
					name: "Cristales de Mejora",
					label: `+${a} Cristales`,
					details: "Sube el nivel del recolector",
					rarity: "Legendario",
					icon: "crystal",
					materialTier: 1
				};
			}
		},
		{
			id: "calibration_stone",
			weight: 18,
			build: () => {
				const a = rand(1, 2);
				return {
					kind: "consumable",
					amount: a,
					name: "Piedra de Calibración",
					label: `${a} Piedra${a > 1 ? "s" : ""} de Calibración`,
					details: "Sube 12 puntos la probabilidad de la próxima fusión",
					rarity: "Raro",
					icon: "flask",
					item: {
						id: `crate_stone_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
						name: "Piedra de Calibración",
						type: "consumable",
						details: "Sube 12 puntos la probabilidad de la próxima fusión",
						rarity: "Raro",
						buffId: "calibrationStone",
						stackable: true,
						stackCount: a,
						sellPrice: 11250
					}
				};
			}
		},
		{
			id: "companion_t6",
			weight: 20,
			build: () => {
				const t = TIER_SYSTEM.ranges[6];
				const p = rand(t[0], t[1]);
				return {
					kind: "companion",
					amount: 1,
					name: "Titán de Acero",
					label: "Titán de Acero",
					details: `Recolección por segundo: +${p}/s`,
					rarity: "Legendario",
					icon: "companion",
					tier: 6,
					item: {
						id: `crate_comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
						name: "Titán de Acero",
						type: "companion",
						details: `Recolección por segundo: +${p}/s`,
						rarity: "Legendario",
						tier: 6,
						companionType: "passive",
						power: p,
						sellPrice: 2500
					}
				};
			}
		},
		{
			id: "collector_oc6",
			weight: 16,
			build: () => {
				const w = makeOverclockCollector(6);
				return {
					kind: "collector",
					amount: 1,
					name: w.name,
					label: w.name,
					details: w.details,
					rarity: w.rarity,
					icon: "collector",
					tier: 6,
					item: w.item
				};
			}
		},
		{
			id: "ghost",
			weight: 12,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[0]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "sparkle",
					item: c.item,
					exclusive: true
				};
			}
		},
		{
			id: "phoenix",
			weight: 10,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[3]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "bolt",
					item: c.item,
					exclusive: true
				};
			}
		},
		{
			id: "legendary_crate",
			weight: 10,
			build: () => ({
				kind: "crate",
				amount: 1,
				name: "Caja Legendaria",
				label: "+1 Caja Legendaria",
				details: "Abre una caja de botín máximo",
				rarity: "Legendario",
				icon: "trophy",
				item: {
					id: `crate_legendary_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					name: "Caja Legendaria",
					type: "crate",
					details: "Contiene recompensas máximas",
					rarity: "Legendario",
					tier: 0,
					sellPrice: 4500,
					stackable: true,
					stackCount: 1
				}
			})
		},
		buildKeyLoot("epic"),
		buildUpLoot("epic"),
		{
			id: "cosmetic",
			weight: 6,
			build: (ctx) => rollCrateCosmetic("epic", ctx.ownedCosmetics)
		}
	],
	legendary: [
		{
			id: "crystals",
			weight: 20,
			build: () => {
				const a = rand(45, 65);
				return {
					kind: "crystals",
					amount: a,
					name: "Cristales de Mejora",
					label: `+${a} Cristales`,
					details: "Sube el nivel del recolector",
					rarity: "Mítico",
					icon: "crystal",
					materialTier: 2
				};
			}
		},
		{
			id: "collector_oc8",
			weight: 18,
			build: () => {
				const w = makeOverclockCollector(8);
				return {
					kind: "collector",
					amount: 1,
					name: w.name,
					label: w.name,
					details: w.details,
					rarity: w.rarity,
					icon: "collector",
					tier: 8,
					item: w.item
				};
			}
		},
		{
			id: "stability_nano",
			weight: 14,
			build: () => ({
				kind: "consumable",
				amount: 1,
				name: "Nanopartícula de Estabilidad",
				label: "Nanopartícula de Estabilidad",
				details: "Deja el recolector forjado con un afijo garantizado",
				rarity: "Legendario",
				icon: "flask",
				item: {
					id: `crate_nano_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					name: "Nanopartícula de Estabilidad",
					type: "consumable",
					details: "Deja el recolector forjado con un afijo garantizado",
					rarity: "Legendario",
					buffId: "stabilityNano",
					stackable: true,
					stackCount: 1,
					sellPrice: 55e3
				}
			})
		},
		{
			id: "avatar",
			weight: 16,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[2]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "globe",
					item: c.item,
					exclusive: true
				};
			}
		},
		{
			id: "oracle",
			weight: 14,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[1]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "crystal",
					item: c.item,
					exclusive: true
				};
			}
		},
		{
			id: "sentinel",
			weight: 12,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[4]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "shield",
					item: c.item,
					exclusive: true
				};
			}
		},
		{
			id: "espectro",
			weight: 5,
			build: () => {
				const c = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[5]);
				return {
					kind: "companion",
					amount: 1,
					name: c.companion.name,
					label: c.companion.name,
					details: c.item.details,
					rarity: c.companion.rarity,
					icon: "sparkle",
					item: c.item,
					exclusive: true
				};
			}
		},
		buildKeyLoot("legendary"),
		buildUpLoot("legendary"),
		{
			id: "cosmetic",
			weight: 6,
			build: (ctx) => rollCrateCosmetic("legendary", ctx.ownedCosmetics)
		}
	]
};
/** Compra una entrada por peso. */
function pickLoot(crateType, weights) {
	const table = CRATE_LOOT[crateType];
	const w = weights ?? table.map((e) => e.weight);
	const total = w.reduce((a, b) => a + b, 0);
	let roll = Math.random() * total;
	for (let i = 0; i < table.length; i++) {
		roll -= w[i];
		if (roll <= 0) return table[i];
	}
	return table[table.length - 1];
}
/**
* Cuánto vale realmente el botín de una entrada de la tabla.
*
* La tabla guarda números "de autor": 250-400 nanitas, 2-4 cristales. Eso es lo
* que cuesta la caja, no lo que recibe el jugador. La conversión va aquí para
* que la cifra que la ruleta enseña y la que entra en la cuenta sean SIEMPRE la
* misma. Si cada sitio calculara su propia versión, la casilla podría prometer
* +350 y el saldo sumar +11.667, y el jugador no sabría si el número es premio
* o error.
*
* Solo devuelve el botín: aplicarlo es cosa de quien sortea, porque aplicar
* implica tocar el estado del jugador.
*/
function resolveLootAmount(crateType, entry) {
	const base = {
		...entry,
		exclusive: entry.exclusive ?? false
	};
	if (base.kind === "nanites") {
		const value = Math.round(base.amount * CRATE_META[crateType].cost / 12);
		return {
			...base,
			amount: value,
			label: `+${value} Nanitas`
		};
	}
	if (base.kind === "crystals") {
		const value = Math.round(base.amount * (1 + RARITY_RANK[base.rarity] * .25));
		return {
			...base,
			amount: value,
			label: `+${value} Cristales de Mejora`
		};
	}
	return base;
}
/**
* Decide el premio y lo aplica. Si el almacén está lleno y el drop es un item,
* se compensa en nanitas para no perderlo nunca.
*/
function rollCrateReward(crateType, applier) {
	const entry = pickLoot(crateType);
	const ctx = { ownedCosmetics: applier.ownedCosmetics() };
	const built = entry.build(ctx);
	if (!built) {
		const dup = naniteCompensation(crateType, "Ya tienes todos los cosméticos de esta caja");
		applier.nanites(dup.amount);
		return dup;
	}
	const reward = resolveLootAmount(crateType, built);
	switch (reward.kind) {
		case "nanites":
			applier.nanites(reward.amount);
			return reward;
		case "crystals":
			applier.crystals(reward.amount, reward.materialTier ?? 1);
			return reward;
		case "keys":
			applier.keys(reward.amount, reward.keyTier ?? 0);
			return reward;
		case "cosmetic": {
			if (applier.unlockCosmetic(reward.cosmeticId)) return reward;
			const dup = naniteCompensation(crateType, "Ya lo tenías");
			applier.nanites(dup.amount);
			return dup;
		}
		default: {
			if (reward.item ? applier.addItem(reward.item) : false) return reward;
			const full = naniteCompensation(crateType, "No cabía el objeto, se compensó en nanitas");
			applier.nanites(full.amount);
			return {
				...full,
				name: "Compensación",
				label: `Almacén lleno: +${full.amount} Nanitas`
			};
		}
	}
}
/**
* El premio de consolación: las mismas nanitas que dejaría un objeto sin sitio.
*
* Una sola función para los dos casos (almacén lleno y cosmético repetido) a
* propósito. Si cada uno calculara su propio importe, el repetido acabaría
* pagándose más que el premio de verdad y la ruleta enseñaría un número que
* contradice a la tabla.
*/
function naniteCompensation(crateType, details) {
	const compensation = Math.round(CRATE_META[crateType].cost * 1.5);
	return {
		kind: "nanites",
		amount: compensation,
		name: "Compensación",
		label: `+${compensation} Nanitas`,
		details,
		rarity: "Común",
		icon: "bolt",
		exclusive: false
	};
}
//#endregion
//#region src/achievements.ts
var ACHIEVEMENTS = [
	{
		id: "first_click",
		title: "Primer Enlace",
		description: "Extrae 100 Nanitas en total",
		icon: "bolt",
		rewardText: "+2% poder de click",
		reward: {
			clickBonus: .02,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: Math.min(s.totalNanitesProduced ?? 0, 100),
			target: 100
		})
	},
	{
		id: "collector_10",
		title: "Táctico",
		description: "Sube un recolector al nivel 10",
		icon: "medal",
		rewardText: "+5% poder de click",
		reward: {
			clickBonus: .05,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: Math.max(0, ...(s.warehouse ?? []).filter((w) => w.type === "collector").map((w) => w.level || 0)),
			target: 10
		})
	},
	{
		id: "swarm",
		title: "Enjambre Autómata",
		description: "Equipa 3 compañeros a la vez",
		icon: "companion",
		rewardText: "+8% ingreso pasivo",
		reward: {
			clickBonus: 0,
			passiveBonus: .08
		},
		progress: (s) => ({
			current: Math.min(s.activeCompanions?.length ?? 0, 3),
			target: 3
		})
	},
	{
		id: "overclocked",
		title: "Fuera de Especificación",
		description: "Consigue un recolector Sobrecargado",
		icon: "flame",
		rewardText: "+10% poder de click",
		reward: {
			clickBonus: .1,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: (s.warehouse ?? []).some((w) => w.overclock) ? 1 : 0,
			target: 1
		})
	},
	{
		id: "crate_opener",
		title: "Descifrador",
		description: "Abre 25 cajas",
		icon: "crate",
		rewardText: "+12% ingreso pasivo",
		reward: {
			clickBonus: 0,
			passiveBonus: .12
		},
		progress: (s) => ({
			current: Math.min(s.cratesOpened ?? 0, 25),
			target: 25
		})
	},
	{
		id: "jackpot",
		title: "Fortuna Divina",
		description: "Consigue un compañero Mítico o Divino de caja",
		icon: "crown",
		rewardText: "+15% poder de click",
		reward: {
			clickBonus: .15,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: (s.companions ?? []).some((c) => c.rarity === "Mítico" || c.rarity === "Divino") ? 1 : 0,
			target: 1
		})
	},
	{
		id: "rich",
		title: "M magnate",
		description: "Acumula 250.000 Nanitas",
		icon: "graph",
		rewardText: "+15% ingreso pasivo",
		reward: {
			clickBonus: 0,
			passiveBonus: .15
		},
		progress: (s) => ({
			current: Math.min(Math.floor(s.nanites ?? 0), 25e4),
			target: 25e4
		})
	},
	{
		id: "full_squad",
		title: "Escuadrón Completo",
		description: "Equipa 5 compañeros a la vez",
		icon: "chip",
		rewardText: "+20% ingreso pasivo",
		reward: {
			clickBonus: 0,
			passiveBonus: .2
		},
		progress: (s) => ({
			current: Math.min(s.activeCompanions?.length ?? 0, 5),
			target: 5
		})
	},
	{
		id: "deep_pockets",
		title: "Almacén Masivo",
		description: "Amplía el almacén a 20 slots",
		icon: "warehouse",
		rewardText: "+25% poder de click",
		reward: {
			clickBonus: .25,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: Math.min((s.warehouseCapacity ?? 0) + (s.bonus?.storageSlots ?? 0), 20),
			target: 20
		})
	},
	{
		id: "tycoon",
		title: "Barón de Nanobots",
		description: "Alcanza 5.000 Nanitas por segundo",
		icon: "sparkle",
		rewardText: "+30% poder de click y +30% pasivo",
		reward: {
			clickBonus: .3,
			passiveBonus: .3
		},
		progress: (s) => ({
			current: Math.min(Math.floor(s.passiveIncome ?? 0), 5e3),
			target: 5e3
		})
	},
	{
		id: "first_forge",
		title: "Primera Chispa",
		description: "Forja tu primer recolector",
		icon: "collector",
		rewardText: "+5% poder de click · Título \"Aprendiz de Forja\"",
		reward: {
			clickBonus: .05,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: Math.min(s.forgedCount ?? 0, 1),
			target: 1
		})
	},
	{
		id: "smith_25",
		title: "Maestro de Forja",
		description: "Forja 25 recolectores con éxito",
		icon: "collector",
		rewardText: "+10% click y +10% pasivo · Marco \"Brasa\"",
		reward: {
			clickBonus: .1,
			passiveBonus: .1
		},
		progress: (s) => ({
			current: Math.min(s.forgedCount ?? 0, 25),
			target: 25
		})
	},
	{
		id: "ascendant",
		title: "Ascendido",
		description: "Recicla tu progreso 5 veces",
		icon: "sparkle",
		rewardText: "+20% click y +20% pasivo · Banner \"Carmesí\"",
		reward: {
			clickBonus: .2,
			passiveBonus: .2
		},
		progress: (s) => ({
			current: Math.min(s.resets ?? 0, 5),
			target: 5
		})
	},
	{
		id: "ghost",
		title: "???",
		description: "Un logro que nadie te pidió completar.",
		icon: "sparkle",
		rewardText: "Título oculto",
		reward: {
			clickBonus: 0,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: (s.warehouse ?? []).some((w) => (w.affixes || []).includes("aff_void")) ? 1 : 0,
			target: 1
		})
	},
	{
		id: "hidden",
		title: "???",
		description: "Cien cajas. Ni una más.",
		icon: "crate",
		rewardText: "Banner oculto",
		reward: {
			clickBonus: 0,
			passiveBonus: 0
		},
		progress: (s) => ({
			current: Math.min(s.cratesOpened ?? 0, 100),
			target: 100
		})
	}
];
function createAchievementState() {
	return {
		unlocked: [],
		clickBonus: 0,
		passiveBonus: 0
	};
}
/** Recalcula el progreso de todos los logros y devuelve los recién desbloqueados. */
function evaluateAchievements(state, achState) {
	const newlyUnlocked = [];
	for (const ach of ACHIEVEMENTS) {
		if (achState.unlocked.includes(ach.id)) continue;
		const { current, target } = ach.progress(state);
		if (current >= target) {
			achState.unlocked.push(ach.id);
			achState.clickBonus += ach.reward.clickBonus;
			achState.passiveBonus += ach.reward.passiveBonus;
			newlyUnlocked.push(ach);
		}
	}
	return newlyUnlocked;
}
//#endregion
//#region src/data/achievements.ts
/** Achievements que otorgan únicamente cosmético: no dan bonificación. */
var SECRET_ACHIEVEMENTS = ["ghost", "hidden"];
//#endregion
//#region src/data/tree.ts
var G = 1.55;
var TREE_BY_ID = Object.fromEntries([
	{
		id: "core_sink",
		name: "Sumidero de Núcleos",
		description: "+8% al ingreso pasivo por nivel.",
		icon: "chip",
		category: "multiplicador",
		tier: 0,
		requires: [],
		baseCost: 1,
		costGrowth: G,
		maxLevel: 10,
		bonus: { passiveMult: .08 },
		x: 0,
		y: 0
	},
	{
		id: "core_edge",
		name: "Filo Afilado",
		description: "+8% al daño de click por nivel.",
		icon: "collector",
		category: "multiplicador",
		tier: 0,
		requires: [],
		baseCost: 1,
		costGrowth: G,
		maxLevel: 10,
		bonus: { clickMult: .08 },
		x: 0,
		y: 1
	},
	{
		id: "scrapyard",
		name: "Chatarrería",
		description: "+12% al precio de venta por nivel.",
		icon: "trash",
		category: "economia",
		tier: 0,
		requires: [],
		baseCost: 2,
		costGrowth: G,
		maxLevel: 5,
		bonus: { sellMult: .12 },
		x: 0,
		y: 2
	},
	{
		id: "refinery",
		name: "Refinado",
		description: "-4% al coste de la tienda por nivel.",
		icon: "crystal",
		category: "economia",
		tier: 0,
		requires: [],
		baseCost: 3,
		costGrowth: G,
		maxLevel: 6,
		bonus: { costReduction: .04 },
		x: 0,
		y: 3
	},
	{
		id: "blueprint",
		name: "Planos Viejos",
		description: "Desbloquea el Crafteo de recolectores.",
		icon: "sparkle",
		category: "exclusivo",
		tier: 0,
		requires: [],
		baseCost: 4,
		costGrowth: 1,
		maxLevel: 1,
		bonus: {},
		x: 0,
		y: 4
	},
	{
		id: "auto_clicker",
		name: "Autómata de Clicks",
		description: "+0.5 clics automáticos por segundo.",
		icon: "bolt",
		category: "automatizacion",
		tier: 1,
		requires: ["core_edge"],
		baseCost: 3,
		costGrowth: 1.6,
		maxLevel: 10,
		bonus: { autoClick: .5 },
		x: 1,
		y: 0
	},
	{
		id: "passive_loop",
		name: "Bucle de Extracción",
		description: "+10% al ingreso pasivo por nivel.",
		icon: "companion",
		category: "multiplicador",
		tier: 1,
		requires: ["core_sink"],
		baseCost: 3,
		costGrowth: G,
		maxLevel: 8,
		bonus: { passiveMult: .1 },
		x: 1,
		y: 1
	},
	{
		id: "forge_luck",
		name: "Instinto de Forja",
		description: "+6% a la probabilidad de crafteo.",
		icon: "sparkle",
		category: "crafteo",
		tier: 1,
		requires: ["blueprint"],
		baseCost: 4,
		costGrowth: 1.5,
		maxLevel: 5,
		bonus: { craftLuck: .06 },
		x: 1,
		y: 2
	},
	{
		id: "shard_sifter",
		name: "Criba de Esquirlas",
		description: "+25% de esquirlas por fallo.",
		icon: "crystal",
		category: "crafteo",
		tier: 1,
		requires: ["blueprint"],
		baseCost: 3,
		costGrowth: G,
		maxLevel: 4,
		bonus: { shardBonus: .25 },
		x: 1,
		y: 3
	},
	{
		id: "storage_rack",
		name: "Estantería Extra",
		description: "+3 ranuras de almacén por nivel.",
		icon: "warehouse",
		category: "economia",
		tier: 1,
		requires: ["scrapyard"],
		baseCost: 3,
		costGrowth: G,
		maxLevel: 6,
		bonus: { storageSlots: 3 },
		x: 1,
		y: 4
	},
	{
		id: "auto_clicker2",
		name: "Dedo de Acero",
		description: "+1.5 clics automáticos por segundo.",
		icon: "bolt",
		category: "automatizacion",
		tier: 2,
		requires: ["auto_clicker"],
		baseCost: 10,
		costGrowth: 1.7,
		maxLevel: 8,
		bonus: { autoClick: 1.5 },
		x: 2,
		y: 0
	},
	{
		id: "multiplier_amp",
		name: "Amplificador Global",
		description: "+6% a TODOS los multiplicadores por nivel.",
		icon: "sparkle",
		category: "multiplicador",
		tier: 2,
		requires: ["passive_loop", "core_edge"],
		baseCost: 12,
		costGrowth: 1.65,
		maxLevel: 8,
		bonus: {
			clickMult: .06,
			passiveMult: .06
		},
		x: 2,
		y: 1
	},
	{
		id: "crate_sight",
		name: "Ojo de Caja",
		description: "+10% de suerte en las cajas por nivel.",
		icon: "crate",
		category: "economia",
		tier: 2,
		requires: ["shard_sifter"],
		baseCost: 8,
		costGrowth: G,
		maxLevel: 5,
		bonus: { crateLuck: .1 },
		x: 2,
		y: 2
	},
	{
		id: "bulk_buy",
		name: "Compra a Granel",
		description: "-5% adicional al coste de tienda.",
		icon: "store",
		category: "economia",
		tier: 2,
		requires: ["refinery", "scrapyard"],
		baseCost: 9,
		costGrowth: G,
		maxLevel: 5,
		bonus: { costReduction: .05 },
		x: 2,
		y: 3
	},
	{
		id: "squad_slots",
		name: "Cuadrilla",
		description: "+1 ranura de compañero activa.",
		icon: "companion",
		category: "exclusivo",
		tier: 2,
		requires: ["passive_loop"],
		baseCost: 25,
		costGrowth: 1,
		maxLevel: 4,
		bonus: { companionSlots: 1 },
		x: 2,
		y: 4
	},
	{
		id: "offline_ops",
		name: "Operaciones Offline",
		description: "Los clics automáticos siguen funcionando 2 min al volver.",
		icon: "clock",
		category: "automatizacion",
		tier: 3,
		requires: ["auto_clicker2"],
		baseCost: 25,
		costGrowth: 1.8,
		maxLevel: 5,
		bonus: { offlineClicks: 120 },
		x: 3,
		y: 0
	},
	{
		id: "quantum_amp",
		name: "Amplificador Cuántico",
		description: "+10% a todos los multiplicadores.",
		icon: "crystal",
		category: "multiplicador",
		tier: 3,
		requires: ["multiplier_amp", "crate_sight"],
		baseCost: 60,
		costGrowth: 1.75,
		maxLevel: 6,
		bonus: {
			clickMult: .1,
			passiveMult: .1
		},
		x: 3,
		y: 1
	},
	{
		id: "afk_extend",
		name: "Suspensión Prolongada",
		description: "+30 min de buff AFK por tarjeta por nivel.",
		icon: "card",
		category: "automatizacion",
		tier: 3,
		requires: ["shard_sifter", "refinery"],
		baseCost: 20,
		costGrowth: G,
		maxLevel: 4,
		bonus: { afkHours: .5 },
		x: 3,
		y: 2
	},
	{
		id: "master_smith",
		name: "Maestro Forjador",
		description: "+12% a la probabilidad de crafteo.",
		icon: "collector",
		category: "crafteo",
		tier: 3,
		requires: ["forge_luck", "multiplier_amp"],
		baseCost: 45,
		costGrowth: 1.7,
		maxLevel: 5,
		bonus: { craftLuck: .12 },
		x: 3,
		y: 3
	},
	{
		id: "core_yield",
		name: "Rendimiento del Núcleo",
		description: "+20% de núcleos por reinicio.",
		icon: "sparkle",
		category: "economia",
		tier: 3,
		requires: ["core_sink", "bulk_buy"],
		baseCost: 40,
		costGrowth: 1.8,
		maxLevel: 5,
		bonus: { coreGain: .2 },
		x: 3,
		y: 4
	},
	{
		id: "singularity",
		name: "Singularidad",
		description: "+18% a todos los multiplicadores. No tiene tope.",
		icon: "sparkle",
		category: "multiplicador",
		tier: 4,
		requires: ["quantum_amp", "master_smith"],
		baseCost: 220,
		costGrowth: 2,
		maxLevel: 5,
		bonus: {
			clickMult: .18,
			passiveMult: .18
		},
		x: 4,
		y: 1
	},
	{
		id: "full_automation",
		name: "Automatización Total",
		description: "+4 clics automáticos por segundo.",
		icon: "bolt",
		category: "automatizacion",
		tier: 4,
		requires: ["offline_ops", "multiplier_amp"],
		baseCost: 180,
		costGrowth: 1.9,
		maxLevel: 5,
		bonus: { autoClick: 4 },
		x: 4,
		y: 0
	},
	{
		id: "void_hoard",
		name: "Almacén del Vacío",
		description: "+8 ranuras de almacén por nivel.",
		icon: "warehouse",
		category: "economia",
		tier: 4,
		requires: ["storage_rack", "core_yield"],
		baseCost: 90,
		costGrowth: 1.7,
		maxLevel: 5,
		bonus: { storageSlots: 8 },
		x: 4,
		y: 2
	},
	{
		id: "chaos_forge",
		name: "Forja del Caos",
		description: "+20% a la probabilidad de crafteo. Recolectores más caras de reparar.",
		icon: "collector",
		category: "crafteo",
		tier: 4,
		requires: ["master_smith", "core_yield"],
		baseCost: 260,
		costGrowth: 2.1,
		maxLevel: 4,
		bonus: { craftLuck: .2 },
		x: 4,
		y: 3
	}
].map((n) => [n.id, n]));
/** Coste del siguiente nivel de un nodo. */
function nodeCost(node, currentLevel) {
	return Math.ceil(node.baseCost * Math.pow(node.costGrowth, currentLevel));
}
//#endregion
//#region src/data/prestige.ts
var EMPTY_BONUSES = {
	clickMult: 0,
	passiveMult: 0,
	costReduction: 0,
	sellMult: 0,
	craftLuck: 0,
	shardBonus: 0,
	autoClick: 0,
	afkHours: 0,
	offlineClicks: 0,
	crateLuck: 0,
	coreGain: 0,
	storageSlots: 0,
	companionSlots: 0
};
/** Umbral mínimo de producción para que un reinicio tenga sentido. */
var PRESTIGE_MIN_NANITES = 1e6;
/** Núcleos que se ganarían con el estado actual. */
function pendingCores(totalProduced, coreGainBonus = 0) {
	if (totalProduced < 1e6) return 0;
	const raw = 8 * Math.pow(totalProduced / 1e6, .6);
	return Math.floor(raw * (1 + coreGainBonus));
}
/** Núcleo gained en el siguiente reinicio, descontando lo ya ganado. */
function nextCores(state) {
	const total = pendingCores(state.totalNanitesProduced, state.coreGain);
	return Math.max(0, total - state.totalCores);
}
/**
* Producción total necesaria para justificar `nucleos` núcleos.
*
* Es la inversa de `pendingCores`: el mínimo `p` con `pendingCores(p) >= nucleos`.
* Vive aquí y no en la vista (R2/R3): la página de Ascensión y el banco leen el
* mismo número, así que lo que se enseña es lo que se cobra.
*/
function nanitesForCores(nucleos, coreGainBonus = 0) {
	if (nucleos <= 0) return 0;
	const mult = 1 + coreGainBonus;
	let p = Math.max(PRESTIGE_MIN_NANITES, Math.ceil(1e6 * Math.pow(nucleos / (8 * mult), 1 / .6)));
	while (p > 0 && pendingCores(p - 1, coreGainBonus) >= nucleos) p--;
	while (pendingCores(p, coreGainBonus) < nucleos) p++;
	return p;
}
/** Cuánto falta producir para el siguiente núcleo (0 si ya se puede reciclar). */
function nanitesToNextCore(state) {
	if (nextCores(state) > 0) return 0;
	const umbral = nanitesForCores(state.totalCores + 1, state.coreGain);
	return Math.max(0, umbral - state.totalNanitesProduced);
}
/**
* Progreso 0..1 hacia el siguiente núcleo, para la barra de la UI.
*
* Se mide en esfuerzo (producido / umbral del siguiente), no en
* `totalCores / total`: esa fracción BAJA al producir —con 8 de histórico da 1
* con 1 M y 0,67 con 2 M—, así que la barra retrocedía cuanto más jugabas.
* La producción se reinicia a 0 en cada Ascenso, así que medir desde 0 es lo
* que el jugador siente: lo producido entre lo necesario.
*/
function coreProgress(state) {
	if (nextCores(state) > 0) return 1;
	const umbral = nanitesForCores(state.totalCores + 1, state.coreGain);
	if (umbral <= 0) return 0;
	return Math.min(1, Math.max(0, state.totalNanitesProduced / umbral));
}
/**
* Agrega las bonificaciones de todos los nodos comprados.
* Se recalcula desde cero en cada cambio: 30 nodos son baratos de sumar y
* evita el bug clásico de "el bonificador no cuadra con lo comprado" cuando
* un nodo se satura o se resetea.
*/
function aggregateBonuses(nodeLevels) {
	const out = { ...EMPTY_BONUSES };
	for (const [id, level] of Object.entries(nodeLevels)) {
		if (!level) continue;
		const node = TREE_BY_ID[id];
		if (!node) continue;
		for (const [key, value] of Object.entries(node.bonus)) {
			const k = key;
			if (typeof value !== "number") continue;
			out[k] += value * level;
		}
	}
	return out;
}
/** Un nodo se puede comprar si están comprados todos sus requisitos. */
function canBuyNode(nodeId, nodeLevels, cores) {
	const node = TREE_BY_ID[nodeId];
	if (!node) return {
		ok: false,
		reason: "Nodo desconocido."
	};
	const level = nodeLevels[nodeId] || 0;
	if (level >= node.maxLevel) return {
		ok: false,
		reason: "Nivel máximo alcanzado."
	};
	const missing = node.requires.filter((r) => !(nodeLevels[r] > 0));
	if (missing.length) return {
		ok: false,
		reason: `Requiere: ${missing.map((id) => TREE_BY_ID[id]?.name ?? id).join(", ")}`
	};
	const cost = nodeCost(node, level);
	if (cores < cost) return {
		ok: false,
		reason: `Faltan ${cost - cores} núcleos.`
	};
	return { ok: true };
}
//#endregion
//#region src/data/crafting.ts
var AFFIXES = [
	{
		id: "aff_sharp",
		name: "Afilado",
		description: "+18% al daño de click.",
		rarity: "Raro",
		effect: { clickMult: .18 }
	},
	{
		id: "aff_rapid",
		name: "Cadencia",
		description: "+12% al daño de click.",
		rarity: "Raro",
		effect: { clickMult: .12 }
	},
	{
		id: "aff_yield",
		name: "Rendimiento",
		description: "+20% al ingreso pasivo.",
		rarity: "Raro",
		effect: { passiveMult: .2 }
	},
	{
		id: "aff_flow",
		name: "Flujo",
		description: "+14% al ingreso pasivo.",
		rarity: "Raro",
		effect: { passiveMult: .14 }
	},
	{
		id: "aff_bulwark",
		name: "Baluarte",
		description: "+60 de daño plano.",
		rarity: "Épico",
		effect: { flatDamage: 60 }
	},
	{
		id: "aff_core",
		name: "Núcleo",
		description: "+40 de ingreso pasivo plano.",
		rarity: "Épico",
		effect: { flatPassive: 40 }
	},
	{
		id: "aff_crit",
		name: "Crítico",
		description: "+8% de probabilidad de crítico (×2 daño).",
		rarity: "Épico",
		effect: { critChance: .08 }
	},
	{
		id: "aff_focus",
		name: "Foco",
		description: "+14% de probabilidad de crítico.",
		rarity: "Legendario",
		effect: { critChance: .14 }
	},
	{
		id: "aff_luck",
		name: "Suerte de Forja",
		description: "+10% a la probabilidad de crafteo del recolector.",
		rarity: "Legendario",
		effect: { craftLuck: .1 }
	},
	{
		id: "aff_ephemeral",
		name: "Efenéreo",
		description: "+35% a ambos multiplicadores.",
		rarity: "Legendario",
		effect: {
			clickMult: .35,
			passiveMult: .35
		}
	},
	{
		id: "aff_eternal",
		name: "Eterno",
		description: "+8 de daño por cada nivel del recolector.",
		rarity: "Mítico",
		effect: { flatDamage: 8 }
	},
	{
		id: "aff_absorb",
		name: "Absorción",
		description: "+18 de ingreso pasivo por cada 5 niveles.",
		rarity: "Mítico",
		effect: { flatPassive: 18 }
	},
	{
		id: "aff_prime",
		name: "Primo",
		description: "+55% a todos los multiplicadores del recolector.",
		rarity: "Mítico",
		effect: {
			clickMult: .55,
			passiveMult: .55
		}
	},
	{
		id: "aff_void",
		name: "Vacío Devorador",
		description: "+25% al daño, +25% al pasivo, +10% crítico.",
		rarity: "Divino",
		effect: {
			clickMult: .25,
			passiveMult: .25,
			critChance: .1
		}
	}
];
var AFFIX_BY_ID = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));
/** Cuántos niveles extra da cada estrella de potencial. */
var MAX_LEVEL_PER_POTENTIAL = 3;
/**
* El techo de niveles de un recolector.
*
* Recibe el `maxLevel` del item y no el item entero. Una razón es que la regla es
* sobre un número y no necesita conocer la forma del item. La otra es la que
* cuesta: `{ maxLevel?: number }` es un *weak type* —todos sus campos opcionales—
* y TypeScript rechaza con TS2559 cualquier objeto que no comparta ninguna
* propiedad con él, así que un `WarehouseItem` no se le puede pasar ni con el
* tipo bien puesto.
*
* POR QUÉ ESTA FUNCIÓN Y NO UN `?? 20` EN CADA SITIO. El techo se escribía a mano
* en cinco sitios y los cinco no coincidían: la ficha del almacén, el panel del
* jugador, la valoración y el desglose usaban `item.maxLevel ?? 20`, el game loop
* comparaba contra una constante de 20 y el selector de cristales contra un 35 a
* pelo. De ahí dos bugs que no se parecían: un recolector forjado con techo 28
* llegaba al 20 y el juego respondía "ya no puedes" mientras la barra de la ficha
* seguía llegando a 28; y un recolector de la tienda en su nivel 20 abría el
* selector, gastaba el cristal y le rechazaban la sintonización.
*
* El techo pertenece a la MISMA regla que lo crea —`maxLevel: 20 + potencial * 3`
* más abajo en este mismo fichero—, así que vive aquí y lo leen el motor y las
* vistas por igual. Una regla compartida escrita cinco veces no está compartida:
* está copiada, y las copias divergen.
*
* Si el item no trae `maxLevel` es que viene de la tienda, y esos topan en 20. Un
* `maxLevel` de 0 o negativo también cae al de base: es dato corrupto, y tratarlo
* como "techo cero" dejaría al recolector sin poder subir nunca.
*/
function collectorMaxLevel(maxLevel) {
	if (typeof maxLevel === "number" && maxLevel > 0) return maxLevel;
	return 20;
}
/**
* Cristales que cuesta subir del nivel dado al siguiente.
*
* Vive AQUÍ y no en `gameLoop.ts` por una razón concreta: es la mitad de la
* sintonización, y la otra mitad —la probabilidad de éxito,
* `crystalSuccessChance()` en `data/items.ts`— ya vivía en `data/`. Una regla
* partida en dos sitios es una regla que se puede tocar por un lado y olvidar por
* el otro.
*
* 1,1,2,2,3,3,5,6,8,9,11,14,17,21,26,32,40,50,63,79 -> 456 cristales en total,
* 91 200 nanitas con el cristal a 200.
*
* POR QUÉ SUBIÓ DE 1.14 A 1.26. Antes subir a nivel 20 costaba 100 cristales, que
* a 60 cada uno salían 6 000 nanitas: menos del 4% de un T10. No había nada que
* decidir, era un botón. Ahora subir al máximo cuesta la mitad del recolector,
* que es la relación que hace que "¿llevo esto a 15 o a 16?" sea una pregunta de
* verdad.
*
* Y por qué NO depende del tier del recolector, que es lo tentador: porque el
* coste es POR INTENTO, no por item. Sube un T1 y sale carísimo; sube un T10 y
* sale la mitad de su precio. La consecuencia buscada es que no se desperdicie
* cristal en un recolector malo, que es justo lo que se quiere: el jugador
* invierte en lo que le va a durar la partida.
*/
function collectorUpgradeCost(level) {
	return Math.max(1, Math.floor(1.2 * Math.pow(1.26, level)));
}
/** Probabilidad base de éxito de una fusión de tier T → T+1. */
function baseSuccessChance(fromTier) {
	return Math.max(.3, .78 - (fromTier - 1) * .05);
}
/** Chance final = base + pasivas + piedras, topado a 95%. */
function successChance(fromTier, craftLuck, stonesUsed, affixLuck, nanoUsed = 0) {
	const base = baseSuccessChance(fromTier);
	const stones = Math.min(5, stonesUsed) * .12;
	const nano = nanoUsed > 0 ? .08 : 0;
	const total = base + craftLuck + stones + affixLuck + nano;
	return Math.min(.95, total);
}
/**
* Potencial 1..5. Sube con:
*  - Materiales de rareza alta (sobrecargados/míticos)
*  - Recolectores de nivel alto (invertidas en experiencia, no en dinero)
*  - Piedras de Calibración usadas
*/
function rollPotential(materials, stonesUsed) {
	let score = 1;
	for (const m of materials) {
		const rarityScore = RARITY_WEIGHT[m.rarity] ?? 0;
		const levelScore = (m.level || 0) * .06;
		score += rarityScore * .4 + levelScore;
	}
	score += stonesUsed * .25;
	const jitter = (Math.random() - .5) * .8;
	return Math.max(1, Math.min(5, Math.round(score + jitter - .5)));
}
var RARITY_WEIGHT = {
	"Común": 0,
	"Raro": .5,
	"Épico": 1,
	"Legendario": 1.6,
	"Mítico": 2.4,
	"Divino": 3.2,
	"Sobrecargado": 2.8
};
var FORGE_PREFIX = [
	"Forja de",
	"Espuela de",
	"Nucleo de",
	"Herencia de",
	"Sello de",
	"Yunque de"
];
var FORGE_NOUN = [
	"Vórtice",
	"Éclipsis",
	"Confín",
	"Ceniza",
	"Éter",
	"Nébula",
	"Duna",
	"Ónix",
	"Zafiro",
	"Cobalto"
];
/** Nombre generado: "Forja de Ceniza" + sufijo de linaje. */
function forgeCollectorName(potential, tier, rng = Math.random) {
	return `${FORGE_PREFIX[Math.floor(rng() * FORGE_PREFIX.length)]} ${FORGE_NOUN[Math.floor(rng() * FORGE_NOUN.length)]}${tier >= 11 ? " PRIMIGENIA" : tier >= 9 ? " SINGULAR" : ""}${potential >= 5 ? "·Absoluta" : potential >= 4 ? "·Prima" : ""}`;
}
/**
* Intenta fusionar 3 recolectores del mismo tier.
* - Si tiene éxito: devuelve la nueva recolector, los materiales se consumen.
* - Si falla: se consumen los materiales, se devuelven esquirlas.
*/
function attemptForge(materials, tier, authorName, options) {
	const maxTier = options.maxTier ?? 11;
	if (materials.length !== 3) return {
		success: false,
		error: "Se necesitan 3 recolectores del mismo tier."
	};
	if (tier < 1 || tier >= maxTier) return {
		success: false,
		error: `No se pueden forjar recolectores de tier ${tier + 1}.`
	};
	if (materials.some((m) => m.tier !== tier)) return {
		success: false,
		error: "Las 3 recolectores deben ser del mismo tier."
	};
	const affixLuck = materials.reduce((acc, m) => acc + (m.affixes?.length || 0) * .02, 0);
	const nanoUsed = options.nanoUsed ?? 0;
	const chance = successChance(tier, options.craftLuck, options.stonesUsed, affixLuck, nanoUsed);
	if (Math.random() > chance) {
		const baseShards = 8 + tier * 6;
		const matBonus = materials.reduce((a, m) => a + RARITY_WEIGHT[m.rarity] * 4, 0);
		return {
			success: false,
			shards: Math.round((baseShards + matBonus) * (1 + options.shardBonus)),
			chanceUsed: chance
		};
	}
	const potential = rollPotential(materials, options.stonesUsed);
	const newTier = tier + 1;
	const name = forgeCollectorName(potential, newTier);
	const baseRange = TIER_SYSTEM.ranges[Math.min(newTier, 10)] ?? [1, 5];
	const baseDamage = Math.round((baseRange[0] + baseRange[1]) / 2);
	const baseAffixCount = Math.min(3, Math.max(1, potential - 1));
	const affixes = pickAffixes(Math.min(4, baseAffixCount + (nanoUsed > 0 ? 1 : 0)), materials);
	const potentialMult = 1 + (potential - 1) * .12;
	const damage = Math.round(baseDamage * potentialMult);
	const rarity = collectorRarity(newTier, potential);
	return {
		success: true,
		collector: {
			id: `forged_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
			name,
			type: "collector",
			details: `Daño base: +${damage}`,
			rarity,
			tier: newTier,
			level: 0,
			maxLevel: 20 + potential * MAX_LEVEL_PER_POTENTIAL,
			potential,
			damage,
			affixes,
			forgedBy: authorName,
			forgedAt: Date.now(),
			lineage: materials.map((m) => m.rarity),
			sellPrice: 0
		},
		chanceUsed: chance
	};
}
function collectorRarity(tier, potential) {
	const clamped = Math.max(1, Math.min(tier, 10));
	const base = TIER_SYSTEM.rarityByTier[clamped] ?? "Común";
	if (potential >= 5 && tier >= 9) return "Divino";
	if (potential >= 4 && tier >= 7) return "Mítico";
	if (potential >= 3 && tier >= 5) return "Legendario";
	if (potential >= 2 && tier >= 3) return "Épico";
	return base || "Común";
}
/** Elige N afijos distintos, con pesos inversos a la rareza. */
function pickAffixes(count, materials) {
	const candidates = AFFIXES.slice();
	const picked = [];
	for (let i = 0; i < count && candidates.length > 0; i++) {
		const weights = candidates.map((a) => {
			return 1 / (.5 + (RARITY_WEIGHT[a.rarity] ?? 1));
		});
		const total = weights.reduce((a, b) => a + b, 0);
		let roll = Math.random() * total;
		let idx = 0;
		for (; idx < weights.length - 1; idx++) {
			roll -= weights[idx];
			if (roll <= 0) break;
		}
		picked.push(candidates[idx].id);
		candidates.splice(idx, 1);
	}
	return picked;
}
//#endregion
//#region src/data/valuation.ts
/** Valor de referencia de un recolector base de cada tier (sin nivel ni afijos). */
var TIER_BASE_VALUE = {
	1: 220,
	2: 480,
	3: 1e3,
	4: 2100,
	5: 4400,
	6: 9200,
	7: 19e3,
	8: 39e3,
	9: 8e4,
	10: 162e3,
	11: 33e4
};
/**
* Multiplicador de valor por rareza.
*
* Calibrado contra la forja: si la rareza multiplica demasiado, la fusión pasa
* de "rentable" (1.8x) a "imprescindible" (10x) y el crafteo se traga el juego.
* Con estos valores la rentabilidad está entre 1.3x y 2.2x en todo el rango:
* merece la pena, pero no rompe nada.
*/
var RARITY_VALUE_MULT = {
	"Común": 1,
	"Raro": 1.3,
	"Épico": 1.7,
	"Legendario": 2.2,
	"Mítico": 2.8,
	"Divino": 3.6,
	"Sobrecargado": 2.4
};
/** Cada nivel del recolector suma un porcentaje creciente del valor base. */
function levelValueMult(level, maxLevel = 20) {
	if (level <= 0) return 1;
	const half = maxLevel / 2;
	let mult = 1;
	for (let i = 0; i < level; i++) mult += i < half ? .06 : .1;
	return mult;
}
function potentialValueMult(potential) {
	if (!potential) return 1;
	return 1 + (potential - 1) * .45;
}
function affixValueMult(collector) {
	if (!collector.affixes?.length) return 1;
	let mult = 1;
	for (const id of collector.affixes) {
		const a = AFFIX_BY_ID[id];
		if (!a) continue;
		let contrib = 0;
		if (a.effect.clickMult) contrib += a.effect.clickMult * .8;
		if (a.effect.passiveMult) contrib += a.effect.passiveMult * .8;
		if (a.effect.flatDamage) contrib += Math.min(.5, a.effect.flatDamage / 400);
		if (a.effect.flatPassive) contrib += Math.min(.5, a.effect.flatPassive / 400);
		if (a.effect.critChance) contrib += a.effect.critChance * 2.5;
		if (a.effect.craftLuck) contrib += a.effect.craftLuck * 1.5;
		mult += contrib;
	}
	return mult;
}
/**
* Prima de fama: un recolector forjado por alguien conocido vale más, pero no rinde
* más. Es el separador entre "objeto" y "trofeo".
*/
function fameValueMult(authorRank) {
	if (authorRank === null) return 1;
	if (authorRank <= 1) return 2.2;
	if (authorRank <= 3) return 1.8;
	if (authorRank <= 10) return 1.5;
	if (authorRank <= 50) return 1.3;
	if (authorRank <= 100) return 1.2;
	return 1.05;
}
/**
* Deriva del mercado: un recolector recién forjada se vende algo más cara y se
* estabiliza. Se calcula con la edad, sin estado global.
*/
function marketAgeMult(forgedAt) {
	if (!forgedAt) return 1;
	const ageDays = (Date.now() - forgedAt) / 864e5;
	if (ageDays < 1) return 1.35;
	if (ageDays < 7) return 1.15;
	if (ageDays < 30) return 1;
	if (ageDays < 90) return .94;
	return .88;
}
function collectorValue(collector, opts = {}) {
	const base = TIER_BASE_VALUE[Math.max(1, Math.min(collector.tier, 11))] ?? 200;
	const levelMult = levelValueMult(collector.level || 0, collectorMaxLevel(collector.maxLevel));
	const rarityMult = RARITY_VALUE_MULT[collector.rarity] ?? 1;
	const potMult = potentialValueMult(collector.potential ?? 0);
	const affMult = affixValueMult(collector);
	const fameMult = fameValueMult(opts.authorRank ?? null);
	const ageMult = marketAgeMult(collector.forgedAt);
	const passives = opts.sellMult ?? 1;
	const raw = base * levelMult * rarityMult * potMult * affMult * fameMult * ageMult * passives;
	const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(raw)) - 2));
	return Math.round(raw / magnitude) * magnitude;
}
/**
* Precio de venta. El jugador recibe el 42% del valor: el resto cubre el
* inputs consumidos y deja margen al mercado.
*/
function sellPrice(collector, opts = {}) {
	return Math.max(1, Math.floor(collectorValue(collector, opts) * .42));
}
//#endregion
//#region src/data/stacking.ts
/**
* Los tipos cuyos items se acumulan en una sola celda.
*
* Un tipo que no esté en esta lista NUNCA se agrupa, por muchas unidades que
* tenga. Dos recolectores son dos celdas aunque digan que son apilables: si se
* fundieran, el jugador no podría elegir con cuál hacer clic.
*/
var STACKABLE_TYPES = [
	"consumable",
	"crate",
	"key",
	"crystal"
];
/** Un item se agrupa solo si lo dice Y si su tipo lo permite. */
function isStackable(item) {
	return !!item && !!item.stackable && STACKABLE_TYPES.includes(item.type);
}
/** Unidades de un item. Un item no apilable siempre vale una. */
function stackUnits(item) {
	if (!isStackable(item)) return 1;
	const n = Number(item.stackCount);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
/**
* La clave con la que dos items son "la misma pila".
*
* `type` + `name`, que es lo que ya usaba la rejilla. El nombre es lo que
* distingue una llave de la otra: dos llaves de distinto nivel se llaman
* distinto, así que el jugador puede elegir con cuál abrir el cofre.
*/
function stackKey(item) {
	return `${item?.type}::${item?.name}`;
}
/**
* Cuántas ranuras ocupa un almacén.
*
* Es la función que responde "¿queda hueco?" y la que pinta el "21/21 ranuras".
* Cuenta GRUPOS, no entradas: por eso tiene que agrupar con la misma clave que
* la rejilla.
*/
function countOccupiedSlots(items) {
	const lista = items || [];
	const celdas = /* @__PURE__ */ new Set();
	for (let i = 0; i < lista.length; i++) {
		const w = lista[i];
		celdas.add(isStackable(w) ? stackKey(w) : `#${i}:${w.id}`);
	}
	return celdas.size;
}
/**
* Colapsa los items apilables repetidos en una sola pila cada uno.
*
* Es la migración de las partidas ya jugadas. Una pila guardada como 19 items
* sueltos de la misma llave se convierte en UN item con `stackCount: 19`, que es
* lo que la rejilla ya estaba mostrando desde antes. No se pierde ninguna
* unidad: se suman, y `syncMaterialCounters` sigue viendo el mismo total.
*
* Se conserva el PRIMER item de cada grupo, con su id, porque es el que puede
* tener algo pendiente detrás (un Companion en `state.companions` apunta al id
* de su ficha, y un afijo de un recolector forjado apunta a su id).
*
* Devuelve el mismo array cuando no había nada que fusionar, para que el
* llamante pueda usar el resultado como prueba de "esto no se ha tocado".
*/
function mergeStacks(items) {
	const celdaDe = /* @__PURE__ */ new Map();
	const salida = [];
	let changed = false;
	for (const w of items) {
		if (!isStackable(w)) {
			salida.push(w);
			continue;
		}
		const clave = stackKey(w);
		const previa = celdaDe.get(clave);
		if (previa) {
			const unidades = stackUnits(w);
			previa.stackCount = stackUnits(previa) + unidades;
			changed = true;
			continue;
		}
		const copia = {
			...w,
			stackCount: stackUnits(w)
		};
		celdaDe.set(clave, copia);
		salida.push(copia);
	}
	return {
		items: changed ? salida : items,
		changed
	};
}
//#endregion
//#region src/data/buffs.ts
/** Cada TARJETA de AFK da 10 minutos. */
var AFK_CARD_DURATION_MS = 6e5;
/** Tope acumulable del buff de AFK: tres tarjetas y nada más. */
var MAX_AFK_BUFF_DURATION_MS = 18e5;
/**
* Campo del guardado que lleva el tiempo restante de cada buff.
*
* El nombre de la clave ES el campo de `state.buffs`. Por eso `cancelBuff()`
* puede pedir "cuánto le queda" sin una tabla aparte: mira el campo y ya está.
*
* `afkCard` NO está, y no por descuido: el tiempo de AFK vive en
* `state.afkExpiresAt`, fuera de `state.buffs`. Por eso `BuffKey` lo añade a
* mano y `cancelBuff()` lo trata en una rama aparte.
*/
var BUFF_FIELDS = {
	clickBoost: "clickBoostExpiresAt",
	clickX2: "clickX2ExpiresAt",
	clickX3: "clickX3ExpiresAt",
	passiveBoost: "passiveBoostExpiresAt"
};
//#endregion
//#region src/data/generators.ts
/** El nombre que le toca, por tier, de entre los tres que hay. */
function nombreDe(tipo, tier, rng) {
	const nombres = (tipo === "companion" ? TIER_SYSTEM.companionNames : TIER_SYSTEM.collectorNames)[tier] || [tipo === "companion" ? "Dron Explorador" : "Blaster Láser"];
	return nombres[Math.floor(rng() * nombres.length)];
}
/** El poder del tier, dentro de su rango, sin salirse nunca. */
function poderDe(tier, rng) {
	const rango = TIER_SYSTEM.ranges[tier] || [1, 5];
	return Math.floor(rng() * (rango[1] - rango[0] + 1)) + rango[0];
}
/**
* Un compañero nuevo del tier pedido.
*
* `type: 'click'` para todos los de la tienda, a propósito: el flotante que
* anuncia y el ingreso por segundo son la misma cifra para ellos. Los `passive` y
* `multiplier` son solo de caja, y salen de `crateLoot.ts`, que es donde vive
* la tabla de botín.
*/
function generateCompanionByTier(tier, rng = Math.random) {
	return {
		id: `comp_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
		name: nombreDe("companion", tier, rng),
		type: "click",
		power: poderDe(tier, rng),
		rarity: TIER_SYSTEM.rarityByTier[tier] || "Común",
		tier
	};
}
/**
* Un recolector nuevo del tier pedido.
*
* El `damage` es el poder del rango, y `details` lo dice con el mismo número: si
* el texto y el daño no coinciden, el jugador compara la ficha con lo que le da
* y no entiende la diferencia.
*/
function generateCollectorByTier(tier, rng = Math.random) {
	const power = poderDe(tier, rng);
	return {
		id: `collector_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
		name: nombreDe("collector", tier, rng),
		type: "collector",
		details: `Recolección por click: +${power}`,
		rarity: TIER_SYSTEM.rarityByTier[tier] || "Común",
		tier,
		level: 0,
		damage: power
	};
}
//#endregion
//#region src/gameLoop.ts
var SAVE_VERSION = 7;
/**
* Tope de seguridad de celdas de hueco guardadas.
*
* No es el limite real -ese es el tablero, y lo calcula la vista-, sino un
* cortafuegos contra un documento manipulado que traiga un numero disparatado y
* empuje todos los items fuera de la rejilla. Muy por encima de cualquier
* almacen real: un tablero de 200 celdas es un almacen de 200 items.
*/
var TOPE_CELDAS_HUECO = 200;
/**
* Normaliza una fecha guardada a milisegundos.
*
* El juego escribe `updatedAt` como `new Date()`, que Firestore convierte en un
* `Timestamp`; pero `rankingService` escribe el suyo como `Date.now()`, un
* número pelado, y en una partida larga hay documentos escritos por los dos
* caminos. La cola de nanitas compara su marca con este campo para decidir cuál
* de los dos es más nuevo, así que un `toDate()` a medias reventaría con el
* segundo.
*/
function aMilis(valor) {
	if (valor == null) return 0;
	if (typeof valor === "number") return valor;
	if (typeof valor === "string") {
		const t = Date.parse(valor);
		return Number.isNaN(t) ? 0 : t;
	}
	if (typeof valor.toMillis === "function") return valor.toMillis();
	if (typeof valor.seconds === "number") return valor.seconds * 1e3;
	return 0;
}
/**
* Tipos de item que se renombraron, del nombre viejo al nuevo.
*
* `weapon` pasó a llamarse `collector` cuando las armas se convirtieron en
* recolectores. El nombre viaja en el guardado, no en el código, así que el
* cambio no alcanzó a las partidas que ya estaban escritas.
*
* No se puede arreglar en la vista, porque el objeto no está mal: es el mismo
* Blaster Láser con la etiqueta vieja. Y el tipo es la clave de todo lo
* demás —la pestaña del filtro, el botón de equipar, la forja, el precio de
* venta, la protección de "no vendas el último"—, así que un item con el tipo
* viejo desaparece de "Recolectores", no se puede equipar y el detalle acaba
* pintando la etiqueta cruda: "weapon".
*
* Se traduce una vez al cargar y se guarda el resultado.
*/
var LEGACY_ITEM_TYPES = { weapon: "collector" };
/** Traduce los tipos renombrados de un almacén. Devuelve si ha tocado algo. */
function migrateItemTypes(warehouse) {
	let changed = false;
	for (const item of warehouse) {
		const moderno = LEGACY_ITEM_TYPES[item.type];
		if (!moderno) continue;
		item.type = moderno;
		changed = true;
	}
	return changed;
}
/**
* Deja `equippedCollectorId` y la bandera `equipped` de los items diciendo lo
* mismo.
*
* Son la misma información en dos sitios, y una partida vieja no siempre tiene
* los dos: con la bandera puesta y el id vacío, la rejilla marcaba el item como
* equipado y el juego no leía su daño, así que el click se quedaba a cero sin
* decir nada. Al revés, el detalle ofrecía "Desequipar" sobre un item que nadie
* tenía puesto.
*
* El id manda porque es lo que lee el cálculo de daño, y la bandera se recalcula
* a partir de él. Un id que ya no apunta a ningún recolector se descarta en vez
* de dejar el estado apuntando al vacío.
*/
function reconcileEquippedCollector(warehouse, equippedId, adoptarBandera = true) {
	let id = equippedId;
	if (id && !warehouse.some((w) => w.id === id && w.type === "collector")) id = null;
	if (!id && adoptarBandera) {
		const marcados = warehouse.filter((w) => w.type === "collector" && w.equipped);
		if (marcados.length === 1) id = marcados[0].id;
	}
	let changed = id !== equippedId;
	for (const w of warehouse) {
		const debeSer = w.type === "collector" && w.id === id;
		if (!!w.equipped === debeSer) continue;
		w.equipped = debeSer;
		changed = true;
	}
	return {
		id,
		changed
	};
}
function inferBuffIdFromName(name) {
	const lower = name.toLowerCase();
	if (lower.includes("expansor")) return "warehouseExpander";
	if (lower.includes("afk")) return "afk";
	if (lower.includes("click x3")) return "clickX3";
	if (lower.includes("click x2")) return "clickX2";
	if (lower.includes("pasivo")) return "passiveBoost";
	if (/clics?\s*x2/.test(lower)) return "clickBoost";
	return null;
}
function createCrateItem(crateType, quantity = 1) {
	const def = CRATE_TYPES[crateType];
	const storeItem = STORE_ITEMS[`${crateType}Crate`];
	return {
		id: `crate_${crateType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		name: def.name,
		type: "crate",
		details: def.details,
		rarity: def.rarity,
		tier: 0,
		sellPrice: Math.floor(storeItem.cost / 4),
		stackable: true,
		stackCount: quantity
	};
}
async function createGameLoop(user, onUpdate, username, onAchievement) {
	const achievementState = createAchievementState();
	const baseCompanion = {
		id: "companion_base_001",
		name: "Dron Explorador",
		type: "click",
		power: 5,
		rarity: "Común",
		tier: 1
	};
	const displayName = (user.displayName || username || "Operativo").trim();
	const isBlanquician = displayName.toLowerCase() === "blanquician";
	const isAdmin = displayName.toLowerCase() === "admin";
	const initialNanites = isBlanquician || isAdmin ? 1e8 : 0;
	/**
	* Cuánto del segundo le toca a cada compañero, indexado por su id.
	*
	* POR QUÉ ESTÁ AQUÍ, JUNTO AL ESTADO Y NO JUNTO A SU USUARIO. Se rellena en
	* `repartirPorCompanion()`, que se llama desde `recalculatePassiveIncome()`, y
	* esa función se dispara al construir el estado —y también desde
	* `checkAchievements()` durante esa misma construcción—. Un `const` declarado
	* más abajo del todo es zona temporal muerta en ese punto, y el fallo sale como
	* `Cannot access ... before initialization` desde DENTRO del `try/catch` que
	* informa de fallos de red: un error de código disfrazado de Firebase, que es
	* exactamente el modo de fallo que este módulo ya Suffrió una vez con
	* `one.mjs`.
	*/
	const ingresoPorCompanion = /* @__PURE__ */ new Map();
	let state = {
		saveVersion: SAVE_VERSION,
		nanites: initialNanites,
		totalNanitesProduced: initialNanites,
		passiveIncome: 0,
		passiveMultiplier: 1,
		totalClicks: 0,
		totalInfraestructure: 0,
		cratesOpened: 0,
		unlockedAchievements: [],
		cores: 0,
		totalCores: 0,
		resets: 0,
		unlockedNodes: [],
		nodeLevels: {},
		shards: 0,
		forgedCount: 0,
		bonus: {
			clickMult: 0,
			passiveMult: 0,
			costReduction: 0,
			sellMult: 0,
			craftLuck: 0,
			shardBonus: 0,
			autoClick: 0,
			afkHours: 0,
			offlineClicks: 0,
			crateLuck: 0,
			coreGain: 0,
			storageSlots: 0,
			companionSlots: 0
		},
		cosmetics: {
			title: "title_default",
			frame: "frame_none",
			banner: "banner_none",
			unlocked: [
				"title_default",
				"frame_none",
				"banner_none"
			]
		},
		keys: 3,
		upgradeCrystals: 5,
		warehouseCapacity: 15,
		maxCompanionSlots: 1,
		warehouseGaps: [],
		afkCards: 0,
		afkExpiresAt: 0,
		crates: {
			common: 2,
			rare: 0,
			epic: 0,
			legendary: 0
		},
		keysByTier: {
			0: 3,
			1: 0,
			2: 0,
			3: 0
		},
		crystalsByTier: { 1: 5 },
		crystalTotal: 5,
		equippedCollectorId: null,
		companions: [baseCompanion],
		activeCompanions: [],
		warehouse: [{
			id: "collector_blaster_001",
			name: "Blaster Láser",
			type: "collector",
			details: "Recolección por click: +5",
			rarity: "Común",
			tier: 1,
			level: 0,
			damage: 5,
			sellPrice: 250
		}, {
			id: "companion_base_001",
			name: "Dron Explorador",
			type: "companion",
			details: "Recolección por segundo: +5/s",
			rarity: "Común",
			tier: 1,
			sellPrice: 250
		}],
		buffs: {
			clickBoostExpiresAt: 0,
			passiveBoostExpiresAt: 0,
			clickX2ExpiresAt: 0,
			clickX3ExpiresAt: 0
		}
	};
	/**
	* Precio de venta de un item del almacén.
	*
	* Vive fuera del objeto devuelto porque lo necesitan dos sitios: la vista, que
	* lo pinta, y `sellItem()`, que lo cobra. Con la fórmula duplicada, la tarjeta
	* podía enseñar un precio y el cobro aplicar otro.
	*/ function getSellPriceFor(item) {
		if (item.type === "collector") return sellPrice(item, { sellMult: 1 + state.bonus.sellMult });
		return Math.floor((item.sellPrice || 0) * (1 + state.bonus.sellMult));
	}
	/**
	* Cuántas unidades de una pila se pueden vender, ya recortadas a lo que hay.
	*
	* Sin `pedidas` devuelve la pila entera: es el comportamiento de siempre, y por
	* eso todos los bancos que llamaban a `sellItem(id)` siguen vendiéndolo todo.
	*
	* POR QUÉ SE RECORTA Y POR QUÉ NO SE RECHAZA. Entre que el jugador abre la ficha
	* y pulsa "Vender" la pila puede haber bajado: abrió una caja, vendió otra cosa,
	* le Reseteó la Ascensión. Recortar devuelve menos de lo que el botón anunciaba,
	* pero el botón se lo pregunta a ESTA misma función, así que el número que se
	* pintó y el que se cobra salen de aquí y no pueden discrepar. Rechazar, en
	* cambio, deja un botón muerto — que es peor que un bug visible, porque el
	* jugador no entiende por qué no ocurre nada.
	*
	* 0 significa "cantidad no válida", que es el único caso que `sellItem` rechaza
	* de verdad: un 0 o un texto no es una intención de compra.
	*/
	function unidadesVendibles(item, pedidas) {
		const disponibles = stackUnits(item);
		if (pedidas === void 0 || pedidas === null) return disponibles;
		const n = Math.floor(Number(pedidas));
		if (!Number.isFinite(n) || n < 1) return 0;
		return Math.min(n, disponibles);
	}
	/**
	* Mete un item en el almacén, sumándolo a la pila que ya hubiera.
	*
	* Es la ÚNICA forma de añadir un item al almacén, y el motivo de que exista es
	* que antes no lo había: cada sitio hacía `state.warehouse.push(item)`, así que
	* una caja que soltaba una llave metía un item NUEVO en vez de sumar una unidad a
	* la pila de llaves que el jugador ya tenía. Cada llave ocupaba su propia
	* ranura, la rejilla las agrupaba en una celda con un "19" y el contador pedía
	* 19 ranuras por un item que el jugador nunca había visto duplicado.
	*
	* Un apilable se suma a la primera pila del mismo tipo y nombre; si no cabe en
	* ella, se abre una pila nueva. Un item que no es apilable siempre entra con su
	* propio id, porque dos recolectores son dos cosas distintas aunque se llamen
	* igual.
	*
	* Devuelve false si no había hueco. No avisa: quien llama decide, porque hay
	* sitios que compensan en nanitas y sitios que pierden el botín a propósito.
	*/
	function addToWarehouse(item) {
		const pila = pilaPara(item);
		if (pila) {
			pila.stackCount = stackUnits(pila) + stackUnits(item);
			return true;
		}
		if (countOccupiedSlots(state.warehouse) >= effectiveWarehouseCapacity()) return false;
		state.warehouse.push(item);
		return true;
	}
	/**
	* La pila a la que se sumaría este item, o null si no hay ninguna.
	*
	* Es la pregunta "¿necesita ranura nueva?" y tiene que ser la MISMA que se hace
	* en `addToWarehouse`. Si se respondiera solo mirando si el almacén está lleno,
	* una compra de algo que cabe en una pila existente se rechazaría con el almacén
	* lleno: el jugador vería "Almacén lleno" por un item que no ocupa ni una ranura
	* y perdería las nanitas.
	*/
	function pilaPara(item) {
		if (!isStackable(item)) return null;
		const clave = `${item.type}::${item.name}`;
		return state.warehouse.find((w) => isStackable(w) && `${w.type}::${w.name}` === clave) ?? null;
	}
	/** ¿Cabe este item en el almacén, fundiéndolo en una pila si se puede? */
	function cabeEnAlmacen(item) {
		return !!pilaPara(item) || countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity();
	}
	/**
	* Productos que no meten nada en el almacén: son permisos, no objetos.
	*
	* Ampliar el almacén o añadir huecos de compañero no guarda un item, así que
	* no tiene por qué haber hueco. Lo que no está en esta lista SÍ es un objeto
	* físico y necesita su sitio: llaves y cristales incluidos.
	*/
	const NO_OCUPA_RANURA = [
		"warehouseSlot",
		"backpackExpander",
		"companionSlot1",
		"companionSlot2"
	];
	/**
	* ¿Se puede comprar este producto sin que el almacén se desborde?
	*
	* La respuesta la necesita la TIENDA para decidir si pinta el botón como
	* "Almacén lleno", y la necesita `buyStoreItem` para no cobrar. Son la misma
	* pregunta, y por eso vive aquí: con dos copias, el botón se deshabilitaba para
	* algo que la compra sí dejaba pasar.
	*
	* Y una ranura es una PILA, no una unidad: 19 llaves ocupa la misma ranura que
	* una. La pregunta no es "¿quedan ranuras?" sino "¿cabe ESTE item?". Preguntar
	* solo por el fullness rechazaba comprar una caja con el almacén lleno, aunque
	* se fuera a sumar a la pila de cajas que ya había.
	*/
	function cabeLaCompra(itemKey) {
		if (NO_OCUPA_RANURA.includes(itemKey)) return true;
		return cabeEnAlmacen(previewStoreItem(itemKey));
	}
	/**
	* El nivel de llave y de cristal que entrega la TIENDA.
	*
	* Vive aquí y no en los dos sitios que lo necesitan porque es exactamente la
	* clase de dato que se duplica sin que nadie se entere: `previewStoreItem`
	* anunciaba nivel 0 mientras `buyStoreItem` creaba nivel 1. Con eso, un jugador
	* con el almacén lleno y una pila de "Llave de Cifrado" veía el botón de
	* comprar llave encendido —porque la preview encontraba su pila— y al pulsarlo
	* la compra fallaba, porque lo que de verdad se crea es una "Llave Reforzada",
	* que necesita ranura nueva. Botón y cargo discrepando (R3).
	*
	* El nivel 1 de `STORE_MATERIAL_TIER` ya no afecta a las llaves: cada carta
	* `keyT0`..`keyT3` lleva el suyo (B7). La constante se queda para el cristal de
	* mejora, que es el único material que sigue siendo de un solo nivel.
	*/
	const STORE_MATERIAL_TIER = 1;
	/**
	* Cómo se llamaría y de qué tipo sería el item de una compra, sin crearlo.
	*
	* La comprobación de "¿queda hueco?" va ANTES de cobrar, así que no puede
	* llamar a los generadores: `generateCollectorByTier` y compañía gastan un id
	* único y habría que tirar el item solo por mirarlo. Y no hace falta: para
	* decidir si algo se funde con una pila basta su tipo y su nombre, que es
	* justamente lo único que mira `pilaPara`.
	*
	* Devuelve null para las compras que no meten nada en el almacén (ampliaciones y
	* huecos), que no ocupan ranura por ser permisos.
	*/
	function previewStoreItem(itemKey) {
		if (STORE_KEY_TIER[itemKey] !== void 0) return {
			type: "key",
			name: KEY_DEFS[STORE_KEY_TIER[itemKey]].name,
			stackable: true
		};
		if (itemKey === "upgradeCrystal") return {
			type: "crystal",
			name: CRYSTAL_DEFS[STORE_MATERIAL_TIER].name,
			stackable: true
		};
		if (itemKey.endsWith("Crate") && CRATE_TYPES[itemKey.replace("Crate", "").toLowerCase()]) return {
			type: "crate",
			name: CRATE_TYPES[itemKey.replace("Crate", "").toLowerCase()].name,
			stackable: true
		};
		const consumable = CONSUMABLES[itemKey];
		if (consumable) return {
			type: "consumable",
			name: consumable.name,
			stackable: true
		};
		if (itemKey.startsWith("companionCardT")) return { type: "companion" };
		if (itemKey.startsWith("collectorCardT")) return { type: "collector" };
		return null;
	}
	/**
	* Quita una cantidad de un item del almacén.
	*
	* Es la ÚNICA forma de consumir un item, y por eso vive aquí y no repartida
	* entre las vistas. El bug que arreglar era precisamente ese: cada pantalla
	* mutaba `state.warehouse` por su cuenta con su propia idea de cómo restar una
	* unidad, y después no recalculaba los contadores derivados.
	*
	* Si el item es apilable y le quedan unidades, baja el contador; si se acaba,
	* desaparece del array. Devuelve cuántas unidades quedan, o 0 si no estaba.
	*/
	function consumeWarehouseItem(itemId, amount = 1) {
		const idx = state.warehouse.findIndex((w) => w.id === itemId);
		if (idx < 0) return 0;
		const item = state.warehouse[idx];
		if (item.stackable && (item.stackCount || 1) > amount) {
			item.stackCount = (item.stackCount || 1) - amount;
			return item.stackCount;
		}
		state.warehouse.splice(idx, 1);
		return 0;
	}
	/**
	* Añade N llaves o N cristales del nivel indicado.
	*
	* Si el almacén tiene hueco se mete un item apilado; si está lleno, el botín
	* se pierde. Se avisa por consola porque es el momento donde el jugador pierde
	* algo sin haberlo decidido, y no hay dónde ponerlo en un aviso en pantalla.
	*/
	function grantKeys(tier, amount) {
		grantMaterial("key", tier, amount);
	}
	function grantCrystals(tier, amount) {
		grantMaterial("crystal", tier, amount);
	}
	/**
	* Desbloquea un cosmético. Idempotente: `false` si ya lo tenía.
	*
	* Vive a nivel de módulo, y no como método suelto del objeto del juego, porque
	* lo necesitan dos sitios: el método público `unlockCosmetic` y el `applier` que
	* `openCrateBox` pasa al sorteo de las cajas. Dentro de un objeto, un hermano no
	* se ve a otro por su nombre: habría que escribir `this.unlockCosmetic`, y
	* `this` no existe dentro de una función que se pasa como callback. Con la
	* función aparte, los dos caminos llaman a la misma y no pueden divergir.
	*/
	function desbloquearCosmetico(cosmeticId) {
		if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
		state.cosmetics.unlocked.push(cosmeticId);
		return true;
	}
	function grantMaterial(kind, tier, amount) {
		if (amount <= 0) return;
		const item = createMaterialItem(kind, tier);
		item.stackCount = amount;
		if (!addToWarehouse(item)) console.warn("[inventario] Sin hueco en el almacén: se pierden " + amount + " x " + kind + " T" + tier + ".");
	}
	/**
	* Crea un item de llave o cristal listo para el almacén.
	*
	* Los tres viven aquí y no en `data/items.ts` porque necesitan un id único y
	* un precio de reventa, y el precio depende de `STORE_ITEMS`, que está en este
	* archivo. La tabla de niveles y probabilidades sí está en `data/items.ts`.
	*/
	function createMaterialItem(kind, tier) {
		const esLlave = kind === "key";
		const def = esLlave ? KEY_DEFS[tier] : CRYSTAL_DEFS[tier];
		const prefijo = esLlave ? "key" : "crystal";
		const sellPrice = precioReventaMaterial(kind, tier);
		return {
			id: `${prefijo}_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			name: def.name,
			type: esLlave ? "key" : "crystal",
			details: def.details,
			rarity: def.rarity,
			tier,
			sellPrice,
			stackable: true,
			stackCount: 1
		};
	}
	/**
	* Lo que se recupera al vender una llave o un cristal.
	*
	* Una cuarta parte del precio de la carta de la tienda, que es la MISMA cuenta
	* que ya usan las cajas, los consumibles y las cartas de compañero y recolector
	* (`Math.floor(cost / 4)`). Material, cajas y consumibles son lo mismo: cosas
	* que se gastan. Por eso comparten la regla, y por eso comprar y vender nunca
	* sale rentable.
	*
	* POR QUÉ NO SALE DE `KEY_DEFS` NI DE `CRYSTAL_DEFS`, QUE ES DONDE ESTÁN LOS
	* PRECIOS. Porque en esas tablas `cost` es `null` para todo lo que no se vende
	* en la tienda, y el material que suelta una caja es justo eso. Con un número
	* inventado en el `??` pasaba esto:
	*
	*   - Llave comprada por 250, revendida por 1.200.  +950 por operación.
	*   - Cristal comprado por 60, revendido por 4.320.  +4.260 por operación.
	*
	* Ninguno de los dos es un desajuste de balance: es una máquina de imprimir
	* nanitas comprando y vendiendo en bucle, sin límite y sin ganar nada. Y ningún
	* banco lo veía, porque `buyCheck` comprueba que el botón y el cargo coincidan —
	* que es otra cosa— y no que vender un item sea una pérdida.
	*
	* El precio de venta tampoco sale de aquí, y a propósito: el juego ya sabe lo
	* que el jugador pagó, porque lo acaba de restar. Lo que no puede saber es de
	* dónde vino un item que no compró, y por eso la reventa es una propiedad del
	* item y no un recuerdo de su procedencia. Una llave de la tienda y una llave de
	* una caja son el mismo objeto y valen lo mismo al venderlo.
	*/
	function precioReventaMaterial(kind, tier) {
		const precio = kind === "key" ? KEY_DEFS[tier ?? 0].cost : STORE_ITEMS.upgradeCrystal.cost;
		if (!precio) return 0;
		return Math.floor(precio / 4);
	}
	/**
	* Cuenta el almacén por tipo de material y reconstruye los contadores.
	*
	* Los contadores `state.keys` y `state.upgradeCrystals` ya no son la fuente de
	* verdad —lo es el almacén—, pero se siguen manteniendo porque el árbol de
	* pasivas y las compras los leen, y porque las partidas viejas los traen.
	*
	* Convivir con un valor desincronizado es exactamente el bug que había con las
	* cajas, así que aquí NO hay conversión de "huérfanos a items": si el contador
	* dice más de lo que hay en el almacén, se ajusta el contador. El almacén gana
	* siempre.
	*/
	function syncMaterialCounters() {
		const keyByTier = {
			0: 0,
			1: 0,
			2: 0,
			3: 0
		};
		const crystalByTier = {};
		let crystalTotal = 0;
		state.warehouse.forEach((w) => {
			if (w.type === "key") {
				const t = typeof w.tier === "number" ? w.tier : keyTierFromName(w.name || "");
				keyByTier[t] = (keyByTier[t] || 0) + (w.stackCount || 1);
			} else if (w.type === "crystal") {
				const t = typeof w.tier === "number" ? w.tier : 1;
				crystalByTier[t] = (crystalByTier[t] || 0) + (w.stackCount || 1);
				crystalTotal += w.stackCount || 1;
			}
		});
		state.keys = keyByTier[0] + keyByTier[1] + keyByTier[2] + keyByTier[3];
		state.keysByTier = keyByTier;
		state.crystalsByTier = crystalByTier;
		state.upgradeCrystals = crystalByTier[1] || 0;
		state.crystalTotal = crystalTotal;
		state.warehouse.forEach((w) => {
			if (w.type === "key" && typeof w.tier !== "number") w.tier = keyTierFromName(w.name || "");
			if (w.type === "crystal" && typeof w.tier !== "number") w.tier = crystalPowerFromName(w.name || "") === 1 ? 1 : 2;
		});
	}
	let isAfk = false;
	let lastActiveTimestamp = Date.now();
	let awayAt = 0;
	const AFK_THRESHOLD_MS = 6e4;
	const userRef = doc(db, "users", user.uid);
	const rankingRef = doc(db, "rankings", user.uid);
	/**
	* El último guardado falló.
	*
	* Se usa para avisar UNA vez, no en cada intento. Un `setDoc` sin red reintenta
	* durante unos diez segundos antes de rendirse, y el intervalo de guardado es
	* de quince: sin este flag, una desconexión de un minuto llenaba la pantalla de
	* avisos idénticos superpuestos, tapando el juego.
	*/
	let guardadoFallando = false;
	/**
	* Enciende o apaga el aviso de "sin guardar".
	*
	* No es decoración. Con esta cola, "el número que veo no está en el servidor"
	* pasa a ser una situación real y constante, y el jugador no tiene forma de
	* saberlo: el contador sigue subiendo igual de contento. Un indicador que se
	* enciende al perder la conexión y se apaga al recuperarla convierte la
	* incertidumbre en un dato.
	*/
	function marcarPendiente(pendiente) {
		if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
		const el = document.querySelector("#pending-save-indicator");
		if (!el) return;
		el.classList.toggle("hidden", !pendiente);
	}
	/**
	* El servidor se quedó con el saldo: se avisa y se baja el contador de fallos.
	*
	* Sin este aviso, el jugador que pasó un rato sin red ve como su saldo "de
	* repente" deja de crecer en el servidor y no entiende por qué. Con él, la
	* desconexión tiene final y se siente resuelta en vez de abandonada.
	*/
	function pendingWasFlushed() {
		marcarPendiente(false);
		if (!guardadoFallando) return;
		guardadoFallando = false;
		showToast("Guardado. Tu progreso ya está en la nube.", "success");
	}
	try {
		const docSnap = await getDoc(userRef);
		if (docSnap.exists()) {
			const data = docSnap.data();
			const savedVersion = typeof data.saveVersion === "number" ? data.saveVersion : 0;
			state.saveVersion = SAVE_VERSION;
			state.nanites = data.nanites ?? 0;
			state.totalNanitesProduced = data.totalNanitesProduced ?? data.nanites ?? 0;
			state.totalClicks = data.totalClicks ?? 0;
			state.unlockedAchievements = data.unlockedAchievements ?? [];
			state.totalInfraestructure = data.totalInfraestructure ?? 0;
			state.cratesOpened = data.cratesOpened ?? 0;
			state.keys = data.keys ?? 3;
			state.upgradeCrystals = data.upgradeCrystals ?? 5;
			state.warehouseCapacity = data.warehouseCapacity ?? 15;
			state.maxCompanionSlots = data.maxCompanionSlots ?? 1;
			state.crates = {
				common: data.crates?.common ?? 2,
				rare: data.crates?.rare ?? 0,
				epic: data.crates?.epic ?? 0,
				legendary: data.crates?.legendary ?? 0
			};
			state.equippedCollectorId = data.equippedCollectorId ?? null;
			state.companions = data.companions ?? [];
			state.activeCompanions = data.activeCompanions ?? [];
			state.warehouse = data.warehouse ?? [];
			state.warehouseGaps = Array.isArray(data.warehouseGaps) ? data.warehouseGaps.filter((id) => typeof id === "string" && state.warehouse.some((w) => w.id === id)) : [];
			let warehouseNeedsMigration = false;
			/**
			* Renombre de 'weapon' a 'collector'. Va PRIMERO, antes de cualquier otra
			* migración, porque todas las de abajo decide si tocan un item mirando su
			* `type`: con el tipo viejo no se reconocían ni como recolectores y se
			* pasaban de largo sin arreglar nada.
			*
			* El id del recolector equipado se renombró a la vez. Sin adoptarlo,
			* quien lo tenía puesto se lo perdía en silencio: `equippedWeaponId` no lo
			* leía nadie y el click se quedaba a cero.
			*
			* Se aplica solo al cruzar de la versión 6 a la 7. No por miedo a repetirla
			* —es idempotente— sino porque `equippedWeaponId` se queda en el documento
			* para siempre: `setDoc` con `merge: true` no borra las claves que ya no
			* se envían. Si se leyera siempre, desequipar en la versión 7 no serviría
			* de nada, porque al siguiente arranque el id viejo volvería a equipar el
			* recolector que el jugador acababa de quitar.
			*/
			if (savedVersion < 7) {
				if (migrateItemTypes(state.warehouse)) warehouseNeedsMigration = true;
				if (!state.equippedCollectorId && typeof data.equippedWeaponId === "string") {
					state.equippedCollectorId = data.equippedWeaponId;
					warehouseNeedsMigration = true;
				}
			}
			const equipado = reconcileEquippedCollector(state.warehouse, state.equippedCollectorId);
			state.equippedCollectorId = equipado.id;
			if (equipado.changed) warehouseNeedsMigration = true;
			state.warehouse.forEach((w) => {
				if (w.type === "collector") {
					if (w.damage === void 0) {
						const tier = w.tier || 1;
						const range = TIER_SYSTEM.ranges[tier] || [1, 5];
						w.damage = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
						warehouseNeedsMigration = true;
					}
					const expectedDetails = `Recolección por click: +${w.damage}`;
					if (w.details !== expectedDetails) {
						w.details = expectedDetails;
						warehouseNeedsMigration = true;
					}
				}
				if (w.type === "consumable" && !w.buffId) {
					const buffId = inferBuffIdFromName(w.name || "");
					if (buffId) {
						w.buffId = buffId;
						warehouseNeedsMigration = true;
					}
				}
				if ((w.type === "key" || w.type === "crystal") && typeof w.tier !== "number") {
					w.tier = w.type === "key" ? keyTierFromName(w.name || "") : crystalPowerFromName(w.name || "") === 1 ? 1 : 2;
					warehouseNeedsMigration = true;
				}
			});
			/**
			* MIGRACIÓN: contadores de llaves y cristales a items del almacén.
			*
			* Antes eran contadores sueltos. Si el contador dice 7 llaves y el almacén
			* está vacío, esas 7 llaves existen en la partida y hay que
			* materializarlas: si no, el jugador las pierde en el guardado siguiente,
			* cuando `syncMaterialCounters` ajustaría el contador a cero.
			*
			* Aquí se hace al revés que con las cajas, a propósito. Con las cajas el
			* almacén era la fuente y el contador podía quedar inflado, así que se
			* ajustaba el contador. Con las llaves el saldo es real y no se puede
			* volver a contarlo, porque detrás no hay ningún item.
			*
			* Llaves y cristales se materializan con la MISMA función, y ya no puede
			* ser de otra manera: las llaves se guardaban de una en una, una ranura
			* por llave, y los cristales de golpe en una sola pila. Un jugador con 19
			* llaves de Cifrado tenía 19 ranuras ocupadas por un item que la rejilla
			* pintaba en una sola celda.
			*/
			let materialNeedsMigration = false;
			/**
			* Cuántas unidades de un material HAY ya en el almacén, por nivel.
			*
			* Es lo que hace que esta migración no se ejecute en cada arranque. La
			* migración es para partidas viejas, donde el contador era un número suelto
			* sin ningún item detrás. En una partida que YA tiene items de llave, el
			* contador y el almacén dicen lo mismo, y materializar el contador entero
			* cada vez que se carga metía un item más por unidad: recargar la página
			* duplicaba las llaves, y a la tercera recarga el almacén estaba lleno de
			* llaves que el jugador nunca pidió. Con los cristales, igual.
			*
			* Lo que hay que materializar es la DIFERENCIA entre lo que promete el
			* contador y lo que ya está: los huérfanos. El bucle de arriba acaba de
			* resolver el `tier` de los items viejos, así que aquí ya se puede contar.
			*/
			const yaEnAlmacen = (kind, tier) => {
				let total = 0;
				for (const w of state.warehouse) {
					if (w.type !== kind) continue;
					if ((typeof w.tier === "number" ? w.tier : kind === "key" ? keyTierFromName(w.name || "") : crystalPowerFromName(w.name || "") === 1 ? 1 : 2) !== tier) continue;
					total += w.stackable ? w.stackCount || 1 : 1;
				}
				return total;
			};
			const meterMaterial = (kind, tier, cantidad) => {
				const huerfanos = Math.max(0, cantidad - yaEnAlmacen(kind, tier));
				if (huerfanos <= 0) return;
				const item = createMaterialItem(kind, tier);
				item.stackCount = huerfanos;
				if (!addToWarehouse(item)) return;
				materialNeedsMigration = true;
			};
			meterMaterial("key", 0, data.keysByTier ? data.keysByTier[0] ?? 0 : data.keys ?? 3);
			meterMaterial("key", 1, data.keysByTier?.[1] ?? 0);
			meterMaterial("key", 2, data.keysByTier?.[2] ?? 0);
			meterMaterial("key", 3, data.keysByTier?.[3] ?? 0);
			meterMaterial("crystal", 1, data.upgradeCrystals ?? 5);
			meterMaterial("crystal", 2, data.crystalsByTier?.[2] ?? 0);
			meterMaterial("crystal", 3, data.crystalsByTier?.[3] ?? 0);
			meterMaterial("crystal", 4, data.crystalsByTier?.[4] ?? 0);
			if (materialNeedsMigration) warehouseNeedsMigration = true;
			/**
			* MIGRACIÓN: fusionar las pilas repetidas de las partidas ya jugadas.
			*
			* Cada botín de llave, cristal, caja o consumible se guardaba como un item
			* NUEVO en vez de sumar sus unidades a la pila que ya había. Una partida
			* con 19 llaves de Cifrado tenía 19 entradas: la rejilla las agrupaba en
			* una celda con un "19" y el contador pedía 19 ranuras por ellas. El
			* almacén se llenaba de botín que el jugador nunca había decidido guardar.
			*
			* Esas entradas pasan aquí a ser una sola pila con `stackCount: 19`, que
			* es exactamente lo que el jugador ya veía en la celda. No se pierde
			* ninguna unidad: se suman, y `syncMaterialCounters` sigue leyendo el
			* mismo total de llaves.
			*
			* Va DESPUÉS de materializar los contadores, no antes. `addToWarehouse` ya
			* suma a la pila existente, así que fusionar antes sería deshacer lo que
			* la migración acaba de apilar.
			*/
			const fusionado = mergeStacks(state.warehouse);
			if (fusionado.changed) {
				state.warehouse = fusionado.items;
				warehouseNeedsMigration = true;
			}
			state.afkCards = data.afkCards ?? 0;
			state.afkExpiresAt = data.afkExpiresAt ?? 0;
			state.cores = data.cores ?? 0;
			state.totalCores = data.totalCores ?? 0;
			state.resets = data.resets ?? 0;
			state.unlockedNodes = data.unlockedNodes ?? [];
			state.nodeLevels = data.nodeLevels ?? {};
			state.shards = data.shards ?? 0;
			state.forgedCount = data.forgedCount ?? 0;
			state.cosmetics = {
				title: data.cosmetics?.title ?? "title_default",
				frame: data.cosmetics?.frame ?? "frame_none",
				banner: data.cosmetics?.banner ?? "banner_none",
				unlocked: Array.from(/* @__PURE__ */ new Set([
					"title_default",
					"frame_none",
					"banner_none",
					...data.cosmetics?.unlocked ?? []
				]))
			};
			if (!data.totalCores && (data.resets ?? 0) > 0) state.totalCores = pendingCores(state.totalNanitesProduced);
			state.buffs = {
				clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
				passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0,
				clickX2ExpiresAt: data.buffs?.clickX2ExpiresAt ?? 0,
				clickX3ExpiresAt: data.buffs?.clickX3ExpiresAt ?? 0
			};
			/**
			* COLA DE LA SESIÓN ANTERIOR.
			*
			* Va AQUÍ, al final de la carga, y no donde se leen las nanitas. Cada
			* bloque de arriba rellena su parte del estado desde el documento, así
			* que aplicar la cola a mitad de carga garantiza que algo la pise después:
			* los núcleos se leen treinta líneas más abajo y dejaban a cero los que
			* el prestige había pagado, que es justo lo que la cola existe para
			* evitar.
			*
			* La regla NO es "si hay algo pendiente, súmalo". Es "usa lo que sea más
			* nuevo, y solo eso". La diferencia no es de estilo: el reinicio de
			* prestigio pone el saldo a cero, y una cola que se sumara sin más
			* devolvería ese dinero después de reiniciar — con el agravante de que el
			* jugador conservaría los núcleos, y se podría repetir sin límite.
			*
			* El documento trae `updatedAt` y la cola trae su propia marca. Se
			* comparan y gana la más reciente:
			*
			*   · Gana la cola → el último guardado no llegó (o hubo un reinicio que
			*     tampoco llegó). Se adopta entero, incluido si vale cero.
			*   · Gana el documento → otro dispositivo del jugador ha seguido jugando
			*     más tarde, o la cola es de una sesión vieja. Se descarta entera, y
			*     no se mezclan: quedarse con el mayor de los dos produciría saldos
			*     que ninguna de las dos sesiones vio nunca.
			*/
			const cola = leerCola(user.uid);
			if (cola.existe) {
				if (cola.ts > aMilis(data.updatedAt)) {
					const diferencia = cola.nanites - state.nanites;
					state.nanites = cola.nanites;
					state.totalNanitesProduced = cola.producidas;
					state.totalClicks = cola.clics;
					state.cores = cola.nucleos;
					state.totalCores = cola.totalNucleos;
					state.resets = cola.reinicios;
					if (diferencia > 0) {
						console.info("[cola] Recuperadas " + formatNumber(diferencia) + " nanitas sin confirmar.");
						showToast("Recuperadas " + formatNumber(diferencia) + " nanitas que no se habían guardado.", "success");
					} else if (diferencia < 0) console.info("[cola] Adoptado un saldo más bajo (" + formatNumber(diferencia) + ").");
				} else {
					console.info("[cola] Descartada: el documento del servidor es más reciente.");
					confirmarCola(cola.ts);
				}
			}
			if (warehouseNeedsMigration) saveToFirebase();
			recalculatePassiveIncome();
		} else {
			await setDoc(userRef, {
				saveVersion: SAVE_VERSION,
				userId: user.uid,
				username: displayName,
				nanites: state.nanites,
				totalNanitesProduced: state.totalNanitesProduced,
				totalClicks: 0,
				totalInfraestructure: 0,
				cratesOpened: 0,
				keys: state.keys,
				keysByTier: state.keysByTier,
				crystalsByTier: state.crystalsByTier,
				upgradeCrystals: state.upgradeCrystals,
				warehouseCapacity: state.warehouseCapacity,
				maxCompanionSlots: state.maxCompanionSlots,
				afkCards: state.afkCards,
				afkExpiresAt: state.afkExpiresAt,
				crates: state.crates,
				equippedCollectorId: state.equippedCollectorId,
				companions: state.companions,
				activeCompanions: state.activeCompanions,
				warehouse: state.warehouse,
				warehouseGaps: state.warehouseGaps,
				buffs: state.buffs,
				unlockedAchievements: state.unlockedAchievements,
				cores: state.cores,
				totalCores: state.totalCores,
				resets: state.resets,
				unlockedNodes: state.unlockedNodes,
				nodeLevels: state.nodeLevels,
				shards: state.shards,
				forgedCount: state.forgedCount,
				cosmetics: state.cosmetics,
				updatedAt: /* @__PURE__ */ new Date()
			});
			await setDoc(rankingRef, {
				userId: user.uid,
				username: user.displayName || "Operativo",
				score: state.nanites,
				totalClicks: 0,
				achievements: 0,
				secretAchievements: 0,
				forgedCount: 0,
				updatedAt: /* @__PURE__ */ new Date()
			});
		}
	} catch (error) {
		console.error("Error al sincronizar con Firebase:", error);
	}
	function syncCompanionsToWarehouse() {
		state.companions.forEach((comp) => {
			if (!state.warehouse.some((w) => w.id === comp.id) && countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity()) state.warehouse.push({
				id: comp.id,
				name: comp.name,
				type: "companion",
				details: `Recolección por segundo: +${comp.power}/s`,
				rarity: comp.rarity,
				sellPrice: comp.rarity === "Común" ? 100 : comp.rarity === "Raro" ? 500 : comp.rarity === "Épico" ? 2e3 : 1e4
			});
		});
		enforceWarehouseCapacity();
	}
	/**
	* Forget the gaps anchored to items that are no longer in the warehouse.
	*
	* A gap lives in the VIEW, not in the array: `warehouseGaps` is the list of
	* ids that have a hole painted right before them. The array itself stays
	* packed, so a hole can never be sold, moved or counted as a slot — which is
	* exactly why this cleanup is all it needs. If an item leaves the warehouse
	* (sold, consumed, recycled by a prestige) its gap has nothing to be painted
	* in front of, so it goes with it. Anything left dangling would be a hole
	* that reappears somewhere the player never asked for as soon as an item with
	* that id showed up again.
	*
	* Called from every path that removes an item. Cheap: it only walks a handful
	* of ids, not the whole warehouse.
	*/
	function syncWarehouseGaps() {
		const limpio = normalizaGaps(state.warehouseGaps);
		if (limpio.join(",") !== (state.warehouseGaps || []).join(",")) state.warehouseGaps = limpio;
	}
	/**
	* Limpia la lista de huecos: solo ids que existen en el almacen, y sin pasar
	* de un tope de seguridad.
	*
	* POR QUE NO HAY UN TOPE DE "UN HUECO POR CELDA". Se puso ese limite, y hacia
	* justo lo contrario de lo que el jugador pide: con 3 celdas ocupadas y 18
	* libres, solo dejaba mover un item hasta la celda 5, cuando las 18 celdas
	* vacias son sitios tan validos como las ocupadas. El limite de verdad no es
	* este: es el TABLERO, y lo calcula la vista (`totalCeldasPintadas`), que es la
	* unica que sabe cuantas celdas se dibujan. Por arrastre nunca se pasa de ahi.
	*
	* Lo que queda aqui es un cortafuegos contra un documento manipulado: si
	* alguien edita la partida y mete 100.000 celdas de hueco, aqui se recorta.
	* El recorte no pierde nada —cada hueco es una celda vacia de adorno— pero
	* evita pintar una rejilla gigante.
	*/
	function normalizaGaps(ids) {
		if (!Array.isArray(ids)) return [];
		const existentes = new Set(state.warehouse.map((w) => w.id));
		const salida = [];
		for (const id of ids) {
			if (typeof id !== "string" || !existentes.has(id)) continue;
			salida.push(id);
			if (salida.length >= TOPE_CELDAS_HUECO) break;
		}
		return salida;
	}
	/**
	* Deja las celdas de hueco indicadas, una por repetición de id.
	*
	* `ids` es la lista COMPLETA, no una operación de "añadir": quien llama es la
	* vista, que es la única que sabe qué hueco se está moviendo al soltar un item
	* dentro de otro. El juego solo guarda y limpia, igual que con el orden: la
	* disposición es del jugador, no del juego.
	*
	* LA MULTIPLICIDAD ES EL CONTENIDO. Un hueco puede ocupar varias celdas seguidas
	* y eso se cuenta con repeticiones: `['b','b','c']` son dos celdas vacías antes
	* de `b` y una antes de `c`. Por eso aquí NO se deduplica con un `Set` —que
	* fundiría las repeticiones en una y dejaría al item a la izquierda de donde se
	* soltó—, y por eso la lista se guarda tal cual, en orden.
	*
	* Un hueco NO es una ranura. No cuenta para `warehouse.length`, no bloquea una
	* compra y no se puede vender: solo desplaza lo que se ve. Por eso el array
	* sigue empaquetado y por eso esta función no toca `state.warehouse`.
	*/
	function setWarehouseGaps(ids) {
		const limpio = normalizaGaps(ids);
		const antes = (state.warehouseGaps || []).join(",");
		state.warehouseGaps = limpio;
		if (antes === limpio.join(",")) return false;
		saveToFirebase();
		return true;
	}
	/**
	* Recorta el almacén respetando una prioridad. Antes se hacía
	* `slice(0, capacity)`, que destruía el último item de la lista sin aviso y
	* podía borrar el recolector equipado o un compañero activo.
	*
	* Prioridad de conservación:-inducing el recolector equipado, los compañeros activos
	* y los companions con item. Lo que se descarta es lo más reciente y menos
	* ligado a la progresión.
	*/
	function enforceWarehouseCapacity() {
		const capacity = effectiveWarehouseCapacity();
		if (countOccupiedSlots(state.warehouse) <= capacity) return;
		const score = (w) => {
			if (w.id === state.equippedCollectorId) return 1e3;
			if (state.activeCompanions.includes(w.id)) return 800;
			if (w.type === "collector") return 500 + (w.tier || 0) + (w.potential || 0) * 50;
			if (w.type === "companion") return 400 + (w.tier || 0);
			if (w.type === "crate") return 300;
			if (w.type === "consumable") return 200;
			return 100;
		};
		const kept = state.warehouse.map((w, index) => ({
			w,
			index,
			s: score(w)
		})).sort((a, b) => b.s - a.s || a.index - b.index).slice(0, capacity).sort((a, b) => a.index - b.index).map((x) => x.w);
		state.warehouse = kept;
		syncWarehouseGaps();
	}
	function getCrateTypeFromName(name) {
		const lower = name.toLowerCase();
		if (lower.includes("común")) return "common";
		if (lower.includes("rara")) return "rare";
		if (lower.includes("épica")) return "epic";
		if (lower.includes("legendaria")) return "legendary";
		return null;
	}
	/**
	* Cuántas cajas hay en el almacén, por tipo. Solo lee: no toca nada.
	*
	* Vive aparte de `syncCrateCounters` porque `materializePendingCrates` necesita
	* el recuento ANTES de escribir nada, para no contar dos veces lo que acaba de
	* crear.
	*/
	function countCratesInWarehouse() {
		const counts = {
			common: 0,
			rare: 0,
			epic: 0,
			legendary: 0
		};
		state.warehouse.forEach((w) => {
			if (w.type !== "crate") return;
			const crateType = getCrateTypeFromName(w.name || "");
			if (!crateType) return;
			counts[crateType] += w.stackCount || 1;
		});
		return counts;
	}
	/**
	* `state.crates` es un contador DERIVADO: el almacén es la fuente de verdad.
	* Esta función solo lo recalcula. NO crea items.
	*
	* Antes esta función hacía dos trabajos incompatibles: contar y materializar.
	* La materialización comparaba `state.crates` —el valor del guardado anterior,
	* porque aquí todavía no se había reescrito— contra el almacén recién contada.
	* Después de vender o abrir la ÚLTIMA caja de un tipo, el contador viejo
	* decía 1 y el almacén decía 0, así que `missing` salía positivo y la función
	* metía la caja otra vez en el almacén. El jugador cobraba las nanitas, veía
	* el aviso de vendido, y la caja seguía ahí con otro id. Abrir una caja
	* suffería exactamente lo mismo, y también `updateState()`.
	*
	* Crear items es trabajo de `materializePendingCrates`, que solo se llama
	* donde tiene sentido: al cargar una partida y al reiniciar por prestigio.
	*/
	function syncCrateCounters() {
		state.crates = countCratesInWarehouse();
	}
	/**
	* Convierte en cajas reales lo que el contador dice y el almacén no respalda.
	*
	* Solo tiene sentido en dos momentos concretos, y en ninguno más:
	*
	*   - Al cargar. Una partida antigua puede tener `crates: { common: 5 }` sin
	*     un solo item de caja en el almacén. Si no se materializan, el jugador
	*     las pierde sin haber jugado: es saldo real detrás del que no hay
	*     ningún item.
	*   - Al reiniciar por prestigio, donde `crates: { common: 2 }` son las cajas
	*     de partida nueva, no un residuo de la anterior.
	*
	* En cualquier otro momento, este cálculo es un error: el contador va
	*siempre retrasado una operación respecto al almacén, así que compararlo
	* con el almacén no mide lo que falta, mide lo que se acaba de gastar.
	*/
	function materializePendingCrates() {
		const counts = countCratesInWarehouse();
		Object.keys(CRATE_TYPES).forEach((crateType) => {
			const missing = (state.crates[crateType] || 0) - counts[crateType];
			if (missing <= 0) return;
			const free = effectiveWarehouseCapacity() - countOccupiedSlots(state.warehouse);
			const toCreate = Math.min(missing, Math.max(0, free));
			for (let i = 0; i < toCreate; i++) if (!addToWarehouse(createCrateItem(crateType))) break;
			counts[crateType] += toCreate;
		});
		state.crates = counts;
	}
	/**
	* Recuento de tarjetas AFK que hay en el almacén.
	*
	* Este contador tenía dos fallos, y los dos venían de lo mismo: no trataba el
	* almacén como lo que es.
	*
	* 1. Contaba ITEMS, no unidades. Las tarjetas son apilables, así que tres
	*    tarjetas en una sola pila se contaban como una. `syncMaterialCounters`
	*    suma `stackCount` justo por eso; aquí faltaba.
	* 2. Las localizaba por el NOMBRE. El almacén lleva su `buffId` desde hace
	*    tiempo, y es el mismo campo que usa `useConsumable` para decidir el
	*    efecto: leer el nombre en un sitio y el campo en otro es exactamente la
	*    desincronización que los contadores derivados evitan a propósito. El día
	*    que la tarjeta se renombre, este contador se queda a cero sin avisar. Las
	*    partidas viejas no tienen `buffId`, así que aquí se deduce del nombre
	*    igual que allí, una vez y solo al leer.
	*
	* Se filtra por `type` además de por `buffId`: es lo que hace el resto del
	* archivo y evita que un item de otro tipo con el mismo campo se cuente.
	*/
	function refreshAfkCardCount() {
		let total = 0;
		state.warehouse.forEach((w) => {
			if (w.type !== "consumable") return;
			if ((w.buffId ?? inferBuffIdFromName(w.name || "")) !== "afk") return;
			total += w.stackable ? w.stackCount || 1 : 1;
		});
		state.afkCards = total;
	}
	recomputeBonuses();
	rebuildAchievementBonuses();
	syncCompanionsToWarehouse();
	materializePendingCrates();
	syncMaterialCounters();
	refreshAfkCardCount();
	checkAchievements();
	await saveToFirebase();
	function rebuildAchievementBonuses() {
		achievementState.unlocked = state.unlockedAchievements;
		achievementState.clickBonus = 0;
		achievementState.passiveBonus = 0;
		for (const ach of ACHIEVEMENTS) {
			if (!state.unlockedAchievements.includes(ach.id)) continue;
			achievementState.clickBonus += ach.reward.clickBonus;
			achievementState.passiveBonus += ach.reward.passiveBonus;
		}
	}
	function checkAchievements() {
		const newly = evaluateAchievements(state, achievementState);
		if (newly.length === 0) return;
		for (const ach of newly) {
			if (!state.unlockedAchievements.includes(ach.id)) state.unlockedAchievements.push(ach.id);
			onAchievement?.(ach);
		}
		recalculatePassiveIncome();
		saveToFirebase();
	}
	function calculateCompanionMultiplier() {
		let multiplier = 1;
		state.activeCompanions.forEach((compId) => {
			const comp = state.companions.find((c) => c.id === compId);
			if (comp && comp.type === "multiplier") multiplier += comp.power;
		});
		return Math.max(1, multiplier);
	}
	/**
	* Recalcula `state.bonus` desde los nodos comprados. Se llama en cada cambio
	* de nodos y una vez al cargar.
	*
	* Importante: los derivados (capacidad, slots, duración AFK) se guardan como
	* base en el save y el bonus se aplica encima, en vez de escribirse en el
	* estado. Si se escribieran, comprar un nodo de almacenamiento sería
	* irreversible al reiniciar: el jugador pagaría dos veces.
	*/
	function recomputeBonuses() {
		state.bonus = aggregateBonuses(state.nodeLevels);
		state.unlockedNodes = Object.keys(state.nodeLevels).filter((id) => (state.nodeLevels[id] || 0) > 0);
	}
	/** Capacidad real del almacén: base del save + ranuras del árbol. */
	function effectiveWarehouseCapacity() {
		return state.warehouseCapacity + state.bonus.storageSlots;
	}
	/** Slots de compañero reales: base del save + cuadrilla. */
	function effectiveCompanionSlots() {
		return state.maxCompanionSlots + state.bonus.companionSlots;
	}
	/** Duración de una tarjeta AFK: 10 min base + extra del árbol. */
	function afkCardDurationMs() {
		return AFK_CARD_DURATION_MS + state.bonus.afkHours * 36e5;
	}
	function recalculatePassiveIncome() {
		let base = 0;
		const contributors = [];
		state.activeCompanions.forEach((compId) => {
			const comp = state.companions.find((c) => c.id === compId);
			if (comp && comp.type !== "multiplier") {
				base += comp.power;
				contributors.push(comp);
			}
		});
		if (Date.now() < state.buffs.passiveBoostExpiresAt) base *= 2;
		state.passiveMultiplier = calculateCompanionMultiplier();
		const withAchievements = base * state.passiveMultiplier * (1 + achievementState.passiveBonus) * (1 + state.bonus.passiveMult);
		state.passiveIncome = Math.floor(withAchievements);
		repartirPorCompanion(contributors, state.passiveIncome);
	}
	/**
	* Cuánto del segundo le toca a cada compañero, y que la suma sea EXACTAMENTE
	* el ingreso.
	*
	* POR QUÉ NO SE PUEDE BASTAR CON `Math.floor(power * multiplicadores)` EN CADA
	* UNO. Los floors no suman: con dos compañeros de 3 y multiplicador 1,5 el
	* ingreso real es `floor((3+3) * 1,5) = 9`, pero `floor(3 * 1,5)` son 4 y 4,
	* que son 8. El resultado del panel y el "+N" flotante dirían 8 y el contador
	* subiría 9, y volveríamos a tener dos números para la misma cosa.
	*
	* POR QUÉ EL REPARTO ES PROPORCIONAL Y NO "EL PRIMERO SE QUEDA EL RESTO". Se
	* reparte la unidad sobrante a partes iguales entre todos, y cada compañero
	* redondea a entero. Así el más pequeño nunca se queda sin nada porque el más
	* grande se comió el redondeo, y con dos la unidad sobrante se reparte entre
	* los dos en vez de irse entera al primero de la lista.
	*
	* El resultado se guarda en un mapa y no se calcula al pintar: la vista pide el
	* número, no lo reimplementa (R2). Y si algún día el reparto no cuadra, la
	* diferencia se le da al primero a propósito, para que la suma sea exacta y no
	* "casi exacta", y no un entero que cuadre por casualidad.
	*/
	function repartirPorCompanion(contributors, total) {
		ingresoPorCompanion.clear();
		if (!contributors.length) return;
		const pesos = contributors.map((c) => Math.max(0, c.power || 0));
		const sumaPesos = pesos.reduce((a, b) => a + b, 0);
		if (sumaPesos <= 0) return;
		let asignado = 0;
		const partes = [];
		for (const peso of pesos) {
			const exacto = total * peso / sumaPesos;
			const entero = Math.floor(exacto);
			partes.push(entero);
			asignado += entero;
		}
		let sobrante = total - asignado;
		for (let i = 0; sobrante > 0; i = (i + 1) % partes.length, sobrante--) partes[i]++;
		contributors.forEach((comp, i) => ingresoPorCompanion.set(comp.id, partes[i]));
	}
	/**
	* Bonificaciones de los afijos del recolector equipado. Se suman al daño aquí y no
	* se hornean en `item.damage`: si se guardaran, vender y volver a comprar el
	* mismo objeto cambiaría su estadística.
	*/
	function equippedAffixEffect() {
		const out = {
			clickMult: 0,
			passiveMult: 0,
			flat: 0
		};
		if (!state.equippedCollectorId) return out;
		const item = state.warehouse.find((w) => w.id === state.equippedCollectorId);
		if (!item?.affixes?.length) return out;
		for (const affixId of item.affixes) {
			const affix = AFFIX_BY_ID[affixId];
			if (!affix) continue;
			out.clickMult += affix.effect.clickMult || 0;
			out.passiveMult += affix.effect.passiveMult || 0;
			out.flat += (affix.effect.flatDamage || 0) * (1 + (item.level || 0) * .08);
		}
		return out;
	}
	/**
	* LA CUENTA DEL CLICK, SIN EL BUFF. La fórmula vive aquí y en ningún otro
	* sitio: la consumen el click mismo, el guardado y el desglose del panel.
	*
	* POR QUÉ ESTA FUNCIÓN EXISTE, Y POR QUÉ NO ES "EL DAÑO". El buff de click se
	* aplica FUERA de la cuenta y en tres sitios distintos: al hacer click, al
	* mostrar el panel y al desglosarlo. Si esta función metiera el buff dentro,
	* el buff se aplicaría dos veces y un buff x2 daría x4 — que es exactamente
	* el bug que rompió `playthroughCheck` al meter el buff aquí dentro. Por eso
	* lo que sale de aquí se llama "sin buff", y quien quiera el buff lo multiplica
	* una vez, a su manera.
	*
	* `conNivel` es el daño después del nivel y antes de los demás multiplicadores,
	* y es lo que permite repartir el total sin inventarse números (ver abajo).
	*/
	function cuentaDeClickSinBuff() {
		const cero = {
			total: 0,
			base: 0,
			conNivel: 0
		};
		if (!state.equippedCollectorId) return cero;
		const item = state.warehouse.find((w) => w.id === state.equippedCollectorId);
		if (!item) return cero;
		const affixes = equippedAffixEffect();
		const base = item.damage || 0;
		const levelMultiplier = 1 + (item.level || 0) * .1;
		const conNivel = base * levelMultiplier;
		return {
			total: (base + affixes.flat) * levelMultiplier * calculateCompanionMultiplier() * (1 + achievementState.clickBonus) * (1 + state.bonus.clickMult) * (1 + affixes.clickMult),
			base,
			conNivel
		};
	}
	/** El daño de un click SIN buffs. Quien quiera buffs los aplica encima. */
	function calculateClickDamage() {
		return Math.floor(cuentaDeClickSinBuff().total);
	}
	/**
	* De dónde sale el daño de un click, en tres partes que suman el total.
	*
	* POR QUÉ ESTA FUNCIÓN Y NO QUE LA VISTA RESTE. El jugador pidió ver "5 base +
	* 15 por mejora". Restar en la vista daría un número que no existe en ningún
	* sitio, y además se desincronizaría en cuanto un buff activara o expirara
	* entre el pintado y la lectura. Aquí el desglose sale de la MISMA cuenta que
	* cobra el click, que es lo único que garantiza que las tres partes sumen el
	* total (R1, R3).
	*
	* Y POR QUÉ TRES PARTES Y NO DOS. El detalle que obliga: con solo "base" y
	* "por nivel" las cifras NO cuadran. Un T1 de daño 5 en nivel 4 da 5 × 1,4 = 7
	* por nivel, y el total que ve el jugador es 20, porque por en medio están los
	* compañeros, los logros, el árbol y los afijos. Mostrar 5 + 2 = 7 al lado de
	* un 20 es un descuadre del que el jugador vuelve a informar, y con razón.
	*
	* Las partes son:
	*   · base   — el daño que trae el item, tal cual.
	*   · porNivel — lo que suma el nivel. El techo de niveles NO se cuenta aquí:
	*     es un tope, no una bonificación.
	*   · porBonos — compañeros tipo multiplicador, logros, árbol, afijos y el
	*     buff de click activo.
	*
	* Y las tres suman `total` exactamente, porque `total` se calcula después y
	* las partes se derivan de los mismos pasos intermedios, no al revés.
	*/
	function desgloseDeClick() {
		const cuenta = cuentaDeClickSinBuff();
		const total = Math.floor(cuenta.total * calculateMultiplier());
		const nivelSinBuff = Math.floor(cuenta.conNivel);
		const porNivel = nivelSinBuff - cuenta.base;
		const porBonos = total - nivelSinBuff;
		return {
			total,
			base: cuenta.base,
			porNivel,
			porBonos
		};
	}
	function calculateMultiplier() {
		let multiplier = 1;
		const now = Date.now();
		if (now < state.buffs.clickBoostExpiresAt) multiplier = 2;
		if (now < state.buffs.clickX3ExpiresAt) multiplier = 3;
		else if (now < state.buffs.clickX2ExpiresAt) multiplier = 2;
		return multiplier;
	}
	async function saveToFirebase() {
		if (!user) return;
		/**
		* PASO 1 · LA COLA.
		*
		* Antes de tocar la red. Es una escritura local y síncrona, así que cuando
		* esta línea termina, el saldo está en el disco. Si todo lo que viene
		* después falla —sin red, regla cambiada, pestaña cerrada a medias— el
		* jugador sigue teniendo su dinero, y lo recuperará al recargar.
		*/
		const tsAnotado = anotarPendiente(user.uid, state.nanites, state.totalNanitesProduced, state.totalClicks, state.cores, state.totalCores, state.resets);
		try {
			const gameData = {
				saveVersion: SAVE_VERSION,
				userId: user.uid,
				username: displayName,
				nanites: state.nanites,
				totalNanitesProduced: state.totalNanitesProduced,
				totalClicks: state.totalClicks,
				totalInfraestructure: state.totalInfraestructure,
				cratesOpened: state.cratesOpened,
				keys: state.keys,
				keysByTier: state.keysByTier,
				crystalsByTier: state.crystalsByTier,
				upgradeCrystals: state.upgradeCrystals,
				warehouseCapacity: state.warehouseCapacity,
				maxCompanionSlots: state.maxCompanionSlots,
				afkCards: state.afkCards,
				afkExpiresAt: state.afkExpiresAt,
				crates: state.crates,
				equippedCollectorId: state.equippedCollectorId,
				companions: state.companions,
				activeCompanions: state.activeCompanions,
				warehouse: state.warehouse,
				warehouseGaps: state.warehouseGaps,
				buffs: state.buffs,
				unlockedAchievements: state.unlockedAchievements,
				cores: state.cores,
				totalCores: state.totalCores,
				resets: state.resets,
				unlockedNodes: state.unlockedNodes,
				nodeLevels: state.nodeLevels,
				shards: state.shards,
				forgedCount: state.forgedCount,
				cosmetics: state.cosmetics,
				updatedAt: /* @__PURE__ */ new Date()
			};
			await setDoc(userRef, gameData, { merge: true });
			await setDoc(rankingRef, {
				userId: user.uid,
				username: user.displayName || "Operativo",
				score: state.nanites,
				totalClicks: state.totalClicks,
				achievements: state.unlockedAchievements.filter((id) => !SECRET_ACHIEVEMENTS.includes(id)).length,
				secretAchievements: state.unlockedAchievements.filter((id) => SECRET_ACHIEVEMENTS.includes(id)).length,
				forgedCount: state.forgedCount,
				title: state.cosmetics.title,
				updatedAt: /* @__PURE__ */ new Date()
			}, { merge: true });
			/**
			* PASO 2 · EL SERVIDOR CONFIRMA.
			*
			* Solo aquí, y solo ahora que las dos escrituras han ido bien, se vacía
			* la cola. Este es el punto más delicado de todo el mecanismo: vaciarla
			* antes de tiempo perdería nanitas (el documento se queda con la cifra
			* vieja y la cola con la nueva, y nadie suma las dos), y no vaciarla
			* nunca las duplicaría en la siguiente recarga.
			*
			* Se vacía con `confirmarCola(tsAnotado)` y no a pelo, porque los guardados
			* se solapan: al llegar aquí, este guardado ha confirmado SU saldo, pero
			* puede que otro más nuevo ya haya escrito en la cola. Vaciarla sin mirar
			* borraba la red de seguridad de ese otro, y el jugador perdía saldo sin
			* forma de recuperarlo. Ver `confirmarCola`.
			*/
			if (confirmarCola(tsAnotado)) pendingWasFlushed();
		} catch (error) {
			/**
			* PASO 3 · FALLO.
			*
			* No se hace nada, y esa es la decisión. La cola se escribió antes de
			* intentarlo y sigue ahí con el saldo, así que no hay nada que
			* recuperar. El siguiente guardado lo reintenta solo.
			*
			* Lo que sí se avisa es el estado, porque "no se está guardando" y
			* "no se está jugando" parecen lo mismo desde fuera y no lo son: el
			* jugador puede estar jugando diez minutos que se perderían si cerrara.
			*/
			console.error("Error al guardar en Firebase:", error);
			marcarPendiente(true);
			if (!guardadoFallando) {
				guardadoFallando = true;
				showToast("Sin conexión con el servidor. Tu progreso se guarda en este dispositivo y se subirá solo al volver.", "error");
			}
		}
	}
	function isPlayerPresent() {
		return document.visibilityState === "visible" && document.hasFocus();
	}
	function grantAfkCatchUp(fromAwayAt) {
		const awayMs = performance.now() - fromAwayAt;
		const buffRemainingMs = Math.max(0, state.afkExpiresAt - Date.now());
		const grantMs = Math.min(awayMs, buffRemainingMs, MAX_AFK_BUFF_DURATION_MS);
		if (grantMs <= 0) return;
		recalculatePassiveIncome();
		if (state.passiveIncome <= 0) return;
		state.nanites += grantMs / 1e3 * state.passiveIncome;
	}
	const handlePresenceChange = () => {
		if (!isPlayerPresent()) {
			if (awayAt === 0) {
				awayAt = performance.now();
				isAfk = true;
				if (gameInterval) {
					clearInterval(gameInterval);
					gameInterval = null;
				}
				onUpdate(state, true);
			}
			return;
		}
		if (awayAt > 0) {
			grantAfkCatchUp(awayAt);
			awayAt = 0;
		}
		isAfk = Date.now() - lastActiveTimestamp > AFK_THRESHOLD_MS;
		lastActiveTimestamp = Date.now();
		if (!gameInterval) startGameIntervals();
	};
	const handleUserActivity = (e) => {
		if (e && e instanceof KeyboardEvent && (e.key === "Enter" || e.key === " " || e.key === "Spacebar")) return;
		if (e && e.type === "click") {
			lastActiveTimestamp = Date.now();
			if (isAfk) {
				isAfk = false;
				awaitingClickAfterAfk = true;
				onUpdate(state, false);
			}
		}
	};
	const docWithLifecycle = document;
	document.addEventListener("visibilitychange", handlePresenceChange);
	window.addEventListener("focus", handlePresenceChange);
	window.addEventListener("blur", handlePresenceChange);
	window.addEventListener("pageshow", handlePresenceChange);
	window.addEventListener("pagehide", handlePresenceChange);
	docWithLifecycle.addEventListener("freeze", handlePresenceChange);
	docWithLifecycle.addEventListener("resume", handlePresenceChange);
	window.addEventListener("keydown", handleUserActivity);
	window.addEventListener("click", handleUserActivity);
	const saveInterval = setInterval(saveToFirebase, 15e3);
	const handleUnload = () => {
		saveToFirebase();
	};
	window.addEventListener("beforeunload", handleUnload);
	/**
	* REINTENTOS DE LA COLA.
	*
	* El intervalo de 15 segundos ya reintenta solo, pero hay tres momentos en
	* los que esperar quince segundos no es aceptable:
	*
	*  1. Vuelve la red. El evento `online` del navegador salta en cuanto se
	*     recupera la conexión, y es el momento exacto en que el jugador está a
	*     punto de cerrar la pestaña. Sin esto, esos quince segundos son
	*     exactamente los que se pierden.
	*  2. Vuelve el jugador. Si estuvo en otra pestaña con el wifi apagado, al
	*     enfocar esta se reintenta en el acto.
	*  3. Hay cola de la sesión anterior. Al arrancar, este es el momento de
	*     subarla: el jugador acaba de recuperar esas nanitas y quiere verlas
	*     confirmadas, no dentro de medio minuto.
	*/
	const reintentarSiHayCola = () => {
		if (!user) return;
		if (hayPendientes(user.uid)) saveToFirebase();
	};
	window.addEventListener("online", reintentarSiHayCola);
	window.addEventListener("focus", reintentarSiHayCola);
	window.addEventListener("pageshow", reintentarSiHayCola);
	if (user && hayPendientes(user.uid)) setTimeout(() => {
		saveToFirebase();
	}, 1200);
	const TICK_RATE_MS = 500;
	const MS_POR_SEGUNDO = 1e3;
	let awaitingClickAfterAfk = false;
	let autoClickAccumulator = 0;
	/**
	* Clics automáticos del árbol que aún no se han anunciado, y el tope de la
	* cola.
	*
	* POR QUÉ SOLO LOS DEL ÁRBOL Y NO LOS DE LOS COMPAÑEROS. Los del árbol caen
	* donde caiga el acumulador, a cualquier punto del segundo, así que la vista
	* no puede adivinar cuándo fueron: hace falta que el motor se los cuente. Los
	* compañeros van al bloque entero de cada segundo (ver `msParaCobroPasivo`), y
	* ese bloque es su aviso: no hay evento aparte porque no hay instante aparte.
	*
	* POR QUÉ SOLO ES DE PRESENTACIÓN. El dinero ya está en `state.nanites` cuando
	* el evento se encola, así que perder un evento no cuesta ni un nanita: es una
	* nota que se pierde, no una transacción. Por eso el tope puede recortar sin
	* riesgo, y por eso un banco puede vaciar la cola y no perder nada.
	*
	* El tope existe porque `drainClickEvents()` lo llama quien actualiza la
	* pantalla, y si nadie lo llama —una vista donde no hay recolector— la cola
	* crecería sin límite en una partida larga con muchos nodos de autoClick.
	*/
	const MAX_CLICKS_PENDIENTES = 40;
	let clicksPendientes = [];
	function anotarClickAutomatico(cantidad) {
		if (clicksPendientes.length >= MAX_CLICKS_PENDIENTES) clicksPendientes.shift();
		clicksPendientes.push({ cantidad });
	}
	/**
	* POR QUÉ EL PASIVO SE COBRA POR SEGUNDOS Y NO POR TICKS.
	*
	* `state.passiveIncome` es una cifra POR SEGUNDO —ya viene con `Math.floor`, y el
	* HUD la enseña como "+5 / segundo"—, pero el tick corre a 500 ms. Cobrar la
	* fracción del tick dividía por dos lo que toca en cada vuelta: con un
	* compañero de +5/s el saldo subía 2,5 cada 500 ms, y como `formatNumber` baja
	* el entero, el número grande de la base alternaba +2 y +3 (307 → 309 → 312 →
	* 314 → 317 → 319) mientras al lado ponía "+5 / segundo". El ritmo que enseña el
	* HUD y el que se veían eran dos, y con cualquier ingreso impar el salto era más
	* feo: 7/s daba +3 y +4, 9/s daba +4 y +5.
	*
	* La alternativa descartada era subir el tick a 1000 ms, que también daría +5
	* de golpe, pero a costa de la barra de buffs, los logros y el resto de la
	* interfaz, que también viven del tick: se arreglaba el contador ralentizando
	* media pantalla. Aquí solo cambia el instante en que entra el dinero, y el
	* resto de la UI sigue a 500 ms.
	*
	* Se acumula el tiempo de tick y, cada segundo completo, entra el segundo
	* entero de una vez. Es el mismo patrón del acumulador de clics automáticos de
	* abajo, y por el mismo motivo: redondear por tick pierde producción.
	*/
	let msParaCobroPasivo = 0;
	let gameInterval = null;
	function startGameIntervals() {
		if (gameInterval) clearInterval(gameInterval);
		msParaCobroPasivo = 0;
		clicksPendientes = [];
		gameInterval = setInterval(() => {
			if (!isPlayerPresent()) {
				handlePresenceChange();
				return;
			}
			const inactivoMs = Date.now() - lastActiveTimestamp;
			if (!isAfk && inactivoMs > AFK_THRESHOLD_MS) {
				isAfk = true;
				msParaCobroPasivo = 0;
			}
			recalculatePassiveIncome();
			const now = Date.now();
			const hasPassiveBuffActive = now < state.buffs.passiveBoostExpiresAt;
			const hasAfkBuff = now < state.afkExpiresAt;
			if (isAfk && !hasPassiveBuffActive && !hasAfkBuff) {
				onUpdate(state, true);
				return;
			}
			if (awaitingClickAfterAfk) {
				onUpdate(state, false);
				return;
			}
			msParaCobroPasivo += TICK_RATE_MS;
			while (msParaCobroPasivo >= MS_POR_SEGUNDO) {
				msParaCobroPasivo -= MS_POR_SEGUNDO;
				if (state.passiveIncome > 0) {
					state.nanites += state.passiveIncome;
					state.totalNanitesProduced += state.passiveIncome;
				}
			}
			if (state.bonus.autoClick > 0) {
				autoClickAccumulator += state.bonus.autoClick * (TICK_RATE_MS / 1e3);
				while (autoClickAccumulator >= 1) {
					autoClickAccumulator -= 1;
					const dmg = calculateClickDamage() * calculateMultiplier();
					state.nanites += dmg;
					state.totalNanitesProduced += dmg;
					state.totalClicks += 1;
					anotarClickAutomatico(Math.floor(dmg));
				}
			}
			checkAchievements();
			onUpdate(state, isAfk && (hasPassiveBuffActive || hasAfkBuff));
		}, TICK_RATE_MS);
	}
	if (isPlayerPresent()) startGameIntervals();
	const estado = {
		getState: () => state,
		/**
		* Nombre del jugador ya resuelto (`user.displayName` → nombre de registro →
		* "Operativo"). Vive en la API en vez de en `state` porque no es progreso
		* guardado: es identidad de la SESIÓN.
		*
		* El perfil lo pintaba desde `state.__username`, un campo que no existe en
		* ningún sitio, así que la tarjeta de identidad caía siempre en el texto de
		* reserva "Operativo" aunque el nombre bueno estuviera resuelto. Al ser la
		* misma variable que ya se envía al ranking, ahora no puede desincronizarse.
		*/
		getDisplayName: () => displayName,
		isAfk: () => isAfk,
		isPresent: () => isPlayerPresent(),
		getClickDamage: () => Math.floor(calculateClickDamage() * calculateMultiplier()),
		/**
		* El daño de un click partida en base, nivel y bonos, para que la vista lo
		* enseñe sin tener que deducirlo restando. Ver `desgloseDeClick()`.
		*/
		getClickDamageBreakdown: () => desgloseDeClick(),
		/**
		* Cuánto aporta ESTE compañero al ingreso pasivo, ya con los
		* multiplicadores, y con el reparto justo de la fracción.
		*
		* POR QUÉ ESTA FUNCIÓN EXISTE Y POR QUÉ NO ES `comp.power`. La ficha del
		* panel pintaba `+{power}/s` y el "+N" flotante pintaba `+{power}`, pero el
		* motor cobra `power` después de `passiveMultiplier`, de los logros, del
		* árbol y del buff x2. Con un multiplicador de 1,5 el panel decía "+3 /s"
		* y el contador subía 4,5: dos números para la misma cosa, y el que se
		* equivoca es el que se enseña (R3).
		*
		* El reparto sale de `repartirPorCompanion()`, que reparte el ingreso ENTERO
		* entre los que aportan. Por eso la suma de lo que da esta función es
		* exactamente `state.passiveIncome`, sin un nanita de diferencia: si
		* calculase cada uno por su cuenta, los floors no sumarían y volveríamos al
		* mismo descuadre.
		*
		* Un compañero que no está activo devuelve 0, que es lo que paga.
		*/
		getCompanionOutput: (companionId) => ingresoPorCompanion.get(companionId) ?? 0,
		/**
		* Qué compañeros anuncian su ingreso, y cuánto.
		*
		* POR QUÉ ESTA FUNCIÓN Y NO UN FILTRO EN LA VISTA. Antes la vista recorría
		* los activos buscando los de tipo `click` y pintaba un "+N" para cada uno.
		* El efecto: **los compañeros `passive` no anunciaban nunca**. De los cinco
		* compañeros de caja, tres son `passive` —y entre ellos el Avatar del
		* Vacío, power 65, el mayor ingreso individual del juego—, así que
		* comprarlo y equiparlo no producía ninguna señal. El jugador veía su
		* ingreso en el HUD y los números flotantes de un compañero que no
		* aparecía, y no tenía forma de saber por qué.
		*
		* La regla es "anuncia quien paga directo". Un `passive` paga, con lo que
		* cobra el bloque de cada segundo. Un `multiplier` NO paga: multiplica el
		* de los demás, así que no tiene cifra propia que enseñar, y por eso sigue
		* fuera.
		*
		* Y que la decisión sea del MOTOR y no de la vista es lo que la hace
		* comprobable: la regla queda en un sitio (R2) y `senalCheck` puede mirarla
		* sin DOM, cosa que un filtro dentro de `updateUI()` no permite.
		*/
		getAnunciablesIngreso: () => state.activeCompanions.map((id) => ({
			id,
			cantidad: ingresoPorCompanion.get(id) ?? 0
		})).filter((x) => {
			const comp = state.companions.find((c) => c.id === x.id);
			return comp && comp.type !== "multiplier";
		}),
		/**
		* Los clicks del árbol que aún no se han anunciado, y vacía la cola.
		*
		* Vaciar en el mismo acto es lo que evita el doble anuncio: la nota se
		* entrega una vez y se queda sin copia. Si quien llama está en una vista sin
		* recolector puede no llamarla nunca, y eso no cuesta nada —ver
		* `anotarClickAutomatico()`.
		*/
		drainClickEvents: () => {
			if (!clicksPendientes.length) return [];
			const salida = clicksPendientes;
			clicksPendientes = [];
			return salida;
		},
		getAchievements: () => ACHIEVEMENTS.map((a) => ({
			...a,
			unlocked: state.unlockedAchievements.includes(a.id),
			current: a.progress(state).current,
			target: a.progress(state).target
		})),
		cancelBuff: (buffKey) => {
			handleUserActivity();
			const labels = {
				clickBoost: "Clics x2",
				clickX2: "Clics x2 (tarjeta)",
				clickX3: "Clics x3 (tarjeta)",
				passiveBoost: "Pasivo x2",
				afk: "AFK"
			};
			if (buffKey === "afk") {
				if (state.afkExpiresAt <= Date.now()) return false;
				state.afkExpiresAt = 0;
			} else {
				const field = BUFF_FIELDS[buffKey];
				if (state.buffs[field] <= Date.now()) return false;
				state.buffs[field] = 0;
			}
			recalculatePassiveIncome();
			onUpdate(state, isAfk);
			saveToFirebase();
			return labels[buffKey];
		},
		/**
		* Adopta un estado completo de golpe.
		*
		* `syncCrateCounters` y no `materializePendingCrates`: esto no es importar una
		* partida guardada, es sustituir el estado en caliente. El almacén que llega
		* es el estado real, y de un almacén real no se fabrican cajas que el
		* jugador ya no tiene.
		*/
		updateState: (newState) => {
			Object.assign(state, newState);
			enforceWarehouseCapacity();
			syncCompanionsToWarehouse();
			syncWarehouseGaps();
			syncCrateCounters();
			syncMaterialCounters();
			refreshAfkCardCount();
			rebuildAchievementBonuses();
			recalculatePassiveIncome();
			checkAchievements();
			onUpdate(state, isAfk);
			saveToFirebase();
		},
		/**
		* Reordena el almacén.
		*
		* La libertad de acomodo es del jugador, no del juego, así que aquí no se
		* decide NADA sobre el destino: se le pasa el item al que tiene que quedar
		* pegado el bloque que se mueve y el juego se limita a ponerlo delante. Con
		* `anchorId = null` el bloque va al final del almacén.
		*
		* `lado` dice de qué lado del ancla entra el bloque. No es un detalle: sin
		* él el bloque siempre caía DELANTE del ancla, y como el ancla es el item de
		* la celda señalada, el bloque acababa una celda a la IZQUIERDA de donde el
		* jugador había soltado. Peor: soltar encima del vecino inmediato era un
		* no-op exacto —el bloque ya estaba delante del ancla— así que arrastrar una
		* celda sobre la de al lado no movía absolutamente nada, y la conclusión del
		* jugador era que mover no funcionaba.
		*
		* El que llama sabe en qué dirección se señala el destino (el número de celda
		* de origen y el de destino), así que el juego no tiene que adivinarlo y no
		* puede equivocarse.
		*
		* POR QUÉ UN ANCLA Y NO UN ÍNDICE. El número de celda de la rejilla no es un
		* índice del array: una celda puede representar tres cajas apiladas. Al
		* quitar el grupo arrastrado, todas las celdas que hubiera detrás cambian de
		* sitio, así que un destino traducido a índice ANTES de quitar nada caía
		* una celda más allá de donde se había soltado en cuanto había una pila por
		* medio, y al soltar en uno de los huecos del final directamente no pasaba
		* nada, porque el hueco no tiene índice y se recortaba a la última celda
		* ocupada —que era justo la celda de origen—. Buscando el ancla por id DESPUÉS
		* de quitar, da igual cuántas cosas hubiera detrás.
		*
		* `ids` puede traer varios items porque una pila es una sola celda: si se
		* arrastra una pila de 5, los 5 van juntos y en el mismo orden. Mover solo el
		* que representaba la celda dejaba la celda igual de llena, así que el
		* jugador veía un arrastre que no había movido nada.
		*/
		moveItems: (ids, anchorId, lado = "antes") => {
			const wh = state.warehouse;
			if (!ids.length) return false;
			const origen = ids.map((id) => wh.findIndex((w) => w.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
			if (!origen.length) return false;
			const seMueven = new Set(origen);
			const ancla = anchorId == null ? -1 : wh.findIndex((w) => w.id === anchorId);
			if (anchorId != null && ancla < 0) return false;
			if (ancla >= 0 && seMueven.has(ancla)) return false;
			const bloque = origen.map((i) => wh[i]);
			for (let k = origen.length - 1; k >= 0; k--) wh.splice(origen[k], 1);
			if (ancla < 0) wh.push(...bloque);
			else {
				const i = wh.findIndex((w) => w.id === anchorId);
				wh.splice(lado === "despues" ? i + 1 : i, 0, ...bloque);
			}
			onUpdate(state, isAfk);
			saveToFirebase();
			return true;
		},
		/**
		* Huecos de disposición. Ver `setWarehouseGaps`.
		*
		* Se expone como lista completa porque el intercambio de "item entra en el
		* hueco y el hueco va a donde estaba el item" lo decide la vista, que es la
		* que ve la rejilla. Aquí solo se guarda, se limpia y se persiste.
		*/
		getWarehouseGaps: () => [...state.warehouseGaps || []],
		setWarehouseGaps,
		/**
		* Vende un item del almacén.
		*
		* Todo el borrado ocurre aquí, no en la vista. Antes cada pantalla restaba
		* el item por su cuenta y luego llamaba a `updateState`, que recalculaba
		* los contadores ANTES de que el item se hubiera quitado de verdad en
		* algunos caminos: el item volvía a aparecer en el siguiente guardado.
		*
		* Para las cajas el bucle era más corto: `syncCrateCounters()` recreaba el
		* item recién vendido porque comparaba el contador del guardado anterior
		* contra el almacén. Ver `materializePendingCrates`.
		*/
		/**
		* Vende `units` unidades de un item, o la pila entera si no se dice nada.
		*
		* La cantidad se acepta porque una pila se puede querer a medias: 19 llaves
		* y solo vas a abrir dos cajas, y en los otros 17 quieres otra cosa. Antes
		* la única palanca era vender la pila entera, que para un material de
		* consumo es una decisión equivocada por defecto.
		*
		* `units` llega desde un `<input type=number>`, así que se coacciona y se
		* recorta con `unidadesVendibles()`: el que enseña el botón y el que cobra
		* son la misma expresión, que es lo que R3 exige.
		*/
		sellItem: (itemId, units) => {
			handleUserActivity();
			const idx = state.warehouse.findIndex((w) => w.id === itemId);
			if (idx < 0) return {
				ok: false,
				msg: "Ese item ya no está en el almacén."
			};
			const item = state.warehouse[idx];
			if (item.type === "collector" && state.equippedCollectorId === item.id || item.type === "companion" && state.activeCompanions.includes(item.id)) return {
				ok: false,
				msg: "Desequípalo antes de venderlo."
			};
			const vender = unidadesVendibles(item, units);
			if (vender <= 0) return {
				ok: false,
				msg: "Elige una cantidad mayor que cero."
			};
			if (item.type === "collector" || item.type === "companion") {
				if (state.warehouse.filter((w) => w.type === item.type).length <= 1) return {
					ok: false,
					msg: "No puedes vender el último de su tipo."
				};
			}
			const ganado = Math.floor(getSellPriceFor(item) * vender);
			state.nanites += ganado;
			consumeWarehouseItem(item.id, vender);
			syncWarehouseGaps();
			if (item.type === "companion") {
				state.companions = state.companions.filter((c) => c.id !== item.id);
				state.activeCompanions = state.activeCompanions.filter((id) => id !== item.id);
			}
			syncCrateCounters();
			syncMaterialCounters();
			refreshAfkCardCount();
			syncCompanionsToWarehouse();
			recalculatePassiveIncome();
			checkAchievements();
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				ok: true,
				gained: ganado,
				sold: vender
			};
		},
		/**
		* Consume un consumible del almacén y aplica su efecto.
		*
		* El efecto se calcula con la MISMA función que la vista usaba antes, pero
		* aquí se aplica al estado y después se consume el item. El orden importa:
		* primero se resuelve el buff, y solo si se ha aplicado bien se gasta.
		*/
		useConsumable: (itemId) => {
			handleUserActivity();
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item) return {
				ok: false,
				msg: "Ese item ya no está en el almacén."
			};
			if (item.type !== "consumable") return {
				ok: false,
				msg: "Esto no se puede usar."
			};
			const buffId = item.buffId ?? inferBuffIdFromName(item.name || "");
			if (!buffId) return {
				ok: false,
				msg: "Este consumible no tiene efecto conocido."
			};
			const ahora = Date.now();
			const afkMs = afkCardDurationMs();
			switch (buffId) {
				case "warehouseExpander":
					if (state.warehouseCapacity >= 50) return {
						ok: false,
						msg: "Almacén al máximo."
					};
					state.warehouseCapacity += 1;
					break;
				case "afk": {
					const base = Math.max(ahora, state.afkExpiresAt || 0);
					state.afkExpiresAt = Math.min(base + afkMs, ahora + afkMs * 3);
					break;
				}
				case "clickBoost": {
					const base = Math.max(ahora, state.buffs.clickBoostExpiresAt);
					state.buffs.clickBoostExpiresAt = Math.min(base + 18e5, ahora + 36e5);
					break;
				}
				case "passiveBoost": {
					const base = Math.max(ahora, state.buffs.passiveBoostExpiresAt);
					state.buffs.passiveBoostExpiresAt = Math.min(base + 36e5, ahora + 72e5);
					break;
				}
				case "clickX2": {
					const base = Math.max(ahora, state.buffs.clickX2ExpiresAt);
					state.buffs.clickX2ExpiresAt = Math.min(base + 3e4, ahora + 18e5);
					break;
				}
				case "clickX3": {
					const base = Math.max(ahora, state.buffs.clickX3ExpiresAt);
					state.buffs.clickX3ExpiresAt = Math.min(base + 3e4, ahora + 18e5);
					break;
				}
				case "calibrationStone":
				case "stabilityNano": return {
					ok: false,
					msg: "Este consumible se usa en la Forja."
				};
				default: return {
					ok: false,
					msg: "Este consumible no tiene efecto conocido."
				};
			}
			consumeWarehouseItem(item.id, 1);
			syncWarehouseGaps();
			refreshAfkCardCount();
			recalculatePassiveIncome();
			checkAchievements();
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				ok: true,
				msg: `${item.name}: aplicado`
			};
		},
		click: () => {
			handleUserActivity();
			if (awaitingClickAfterAfk) awaitingClickAfterAfk = false;
			const collectorDamage = calculateClickDamage();
			const multiplier = calculateMultiplier();
			const totalGain = Math.floor(collectorDamage * multiplier);
			state.nanites += totalGain;
			state.totalNanitesProduced += totalGain;
			state.totalClicks += 1;
			checkAchievements();
			onUpdate(state, isAfk);
			return totalGain;
		},
		/**
		* Sintoniza el recolector equipado con un cristal del nivel pedido.
		*
		* EL RESULTADO TIENE TRES ESTADOS, NO DOS, y por eso `rolled` existe.
		*
		* `success` dice si el dado salió bueno, y eso no distingue entre "el dado
		* salió mal" y "no se llegó a tirar el dado". Los dos casos devuelven
		* `success: false`, porque los rechazos (no hay cristal de ese nivel, faltan
		* unidades, ya está en el techo) también son `false`. Para quien llama, sin
		* embargo, son cosas distintas: un fallo del dado GASTA el cristal y la
		* ruleta tiene que girar y decir "has fallado"; un rechazo NO gasta nada y
		* lo que corresponde es un aviso, no un trompo por una operación que no
		* ocurrió.
		*
		* La señal de cuál es cuál es el propio `success`, pero implícita y frágil:
		* dependería de que cada rechazo se olvidara de mandar `success`, y en
		* cuanto uno lo mandara la ruleta giraría por una operación inexistente. Se
		* dice explícitamente con `rolled`, y se dice aquí, en el motor, que es el
		* único que sabe si el dado llegó a tirarse. Que la vista lo deduje
		* mirando si el cristal se gastó sería meter una regla del motor en la
		* vista (R1 y R2), y se rompería en cuanto el consumo dejara de ser una
		* línea recta.
		*/
		upgradeEquippedCollector: (crystalTier = 1) => {
			handleUserActivity();
			if (!state.equippedCollectorId) return {
				success: false,
				rolled: false,
				msg: "No hay ningún recolector equipado."
			};
			const item = state.warehouse.find((w) => w.id === state.equippedCollectorId);
			if (!item) return {
				success: false,
				rolled: false,
				msg: "Recolector no encontrado."
			};
			const level = item.level || 0;
			const tope = collectorMaxLevel(item.maxLevel);
			if (level >= tope) return {
				success: false,
				rolled: false,
				msg: `Recolector al nivel máximo (+${tope * 10}%).`
			};
			const crystal = state.warehouse.find((w) => w.type === "crystal" && (typeof w.tier === "number" ? w.tier : 1) === crystalTier);
			if (!crystal) return {
				success: false,
				rolled: false,
				msg: `No tienes ${CRYSTAL_DEFS[crystalTier]?.name ?? "Cristal"}.`
			};
			const crystalCost = collectorUpgradeCost(level);
			const units = crystal.stackCount || 1;
			if (units < crystalCost) return {
				success: false,
				rolled: false,
				msg: `Necesitas ${crystalCost} x ${CRYSTAL_DEFS[crystalTier].name} (tienes ${units}).`
			};
			consumeWarehouseItem(crystal.id, crystalCost);
			syncWarehouseGaps();
			syncMaterialCounters();
			const successChance = crystalSuccessChance(level, CRYSTAL_DEFS[crystalTier]?.power ?? 1);
			if (Math.random() * 100 <= successChance) {
				item.level = level + 1;
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					success: true,
					rolled: true,
					level: item.level,
					msg: `¡Mejora exitosa! ${item.name} ascendió al nivel ${item.level}.`
				};
			} else {
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					success: false,
					rolled: true,
					level,
					msg: `Fallo en el sintonizador. ${item.name} se mantiene en nivel ${level}. (-${crystalCost} cristales)`
				};
			}
		},
		expandWarehouse: () => {
			handleUserActivity();
			const cost = Math.floor(500 * (1 - state.bonus.costReduction));
			if (state.nanites >= cost && state.warehouseCapacity < 50) {
				state.nanites -= cost;
				state.warehouseCapacity += 5;
				onUpdate(state, isAfk);
				saveToFirebase();
				return true;
			}
			return false;
		},
		unlockCompanionSlot: () => {
			handleUserActivity();
			if (state.maxCompanionSlots >= 5) return false;
			const cost = Math.floor(COMPANION_SLOT_COSTS[effectiveCompanionSlots()] ?? 9e6);
			if (state.nanites >= cost) {
				state.nanites -= cost;
				state.maxCompanionSlots += 1;
				onUpdate(state, isAfk);
				saveToFirebase();
				return true;
			}
			return false;
		},
		/**
		* Alias de `equipCompanion`. Se conserva porque el guardado y el HTML
		* histórico lo nombran así, pero ya no tiene lógica propia: mantener dos
		* implementaciones de "activar/desactivar compañero" es justo lo que dejó
		* los dos caminos haciendo cosas distintas.
		*/
		toggleCompanionActive: (compId) => estado.equipCompanion(compId),
		equipCollector: (itemId) => {
			handleUserActivity();
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item || item.type !== "collector") return false;
			const yaEquipado = state.equippedCollectorId === item.id;
			const { id } = reconcileEquippedCollector(state.warehouse, yaEquipado ? null : item.id, !yaEquipado);
			state.equippedCollectorId = id;
			recalculatePassiveIncome();
			onUpdate(state, isAfk);
			saveToFirebase();
			return true;
		},
		/**
		* Activa o desactiva un compañero.
		*
		* Es la ÚNICA implementación. Antes convivía con `toggleCompanionActive`,
		* que hacía lo mismo con una diferencia: ordenaba la lista por tier al
		* insertar. Dos caminos para lo mismo, y el que usaba la vista era el que
		* no ordenaba, así que el orden de la lista dependía de por dónde se
		* hubiera equipado. Ahora `toggleCompanionActive` es un alias de aquí.
		*
		* El id se valida contra `state.companions` antes de gastarle una ranura:
		* `activeCompanions` es una lista de ids y el ingreso se calcula cruzando
		* con `state.companions`. Sin esta comprobación, un id que no está ahí
		* ocupaba una de las pocas ranuras y no pagaba nada, sin avisar — con tres
		* ranuras, un id colado era un tercio del ingreso pasivo evaporado en
		* silencio.
		*/
		equipCompanion: (compId) => {
			handleUserActivity();
			const index = state.activeCompanions.indexOf(compId);
			if (index > -1) state.activeCompanions.splice(index, 1);
			else {
				if (!state.companions.some((c) => c.id === compId)) return false;
				if (state.activeCompanions.length < effectiveCompanionSlots()) {
					state.activeCompanions.push(compId);
					state.activeCompanions.sort((a, b) => {
						const compA = state.companions.find((c) => c.id === a);
						const compB = state.companions.find((c) => c.id === b);
						return (compA?.tier || 0) - (compB?.tier || 0);
					});
				} else return false;
			}
			recalculatePassiveIncome();
			onUpdate(state, isAfk);
			saveToFirebase();
			return true;
		},
		buyStoreItem: (itemKey) => {
			handleUserActivity();
			const item = STORE_ITEMS[itemKey];
			if (!item) return false;
			const cost = Math.floor(item.cost * (1 - state.bonus.costReduction));
			if (state.nanites < cost) return false;
			const effSlots = effectiveCompanionSlots();
			const compraRanura = RANURA_POR_CARTA[itemKey];
			if (compraRanura && effSlots >= compraRanura.da) return false;
			if (!cabeLaCompra(itemKey)) {
				showToast("Almacén lleno. No puedes comprar más items.", "error");
				return false;
			}
			state.nanites -= cost;
			if (STORE_KEY_TIER[itemKey] !== void 0 || itemKey === "upgradeCrystal") {
				const esLlave = STORE_KEY_TIER[itemKey] !== void 0;
				const tier = esLlave ? STORE_KEY_TIER[itemKey] : STORE_MATERIAL_TIER;
				const item = createMaterialItem(esLlave ? "key" : "crystal", tier);
				if (!addToWarehouse(item)) {
					state.nanites += cost;
					return false;
				}
				syncMaterialCounters();
				onUpdate(state, isAfk);
				saveToFirebase();
				return item;
			} else if (itemKey === "warehouseSlot") {
				state.warehouseCapacity += 5;
				checkAchievements();
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					id: `slot_${Date.now()}`,
					name: "Espacio de Almacén",
					type: "upgrade",
					details: "+5 espacios de almacén",
					rarity: "Raro",
					tier: 0
				};
			} else if (itemKey === "commonCrate" || itemKey === "rareCrate" || itemKey === "epicCrate" || itemKey === "legendaryCrate") {
				const warehouseItem = createCrateItem(itemKey.replace("Crate", "").toLowerCase());
				if (!addToWarehouse(warehouseItem)) {
					state.nanites += cost;
					return false;
				}
				syncCrateCounters();
				onUpdate(state, isAfk);
				saveToFirebase();
				return warehouseItem;
			} else if (CONSUMABLES[itemKey]) {
				const def = CONSUMABLES[itemKey];
				const warehouseItem = {
					id: `cons_${itemKey}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
					name: def.name,
					type: "consumable",
					details: def.details,
					rarity: def.rarity,
					tier: 0,
					sellPrice: Math.floor(item.cost / 4),
					stackable: true,
					stackCount: 1,
					buffId: def.buffId
				};
				if (!addToWarehouse(warehouseItem)) {
					state.nanites += cost;
					return false;
				}
				refreshAfkCardCount();
				onUpdate(state, isAfk);
				saveToFirebase();
				return warehouseItem;
			} else if (RANURA_POR_CARTA[itemKey]) {
				const compra = RANURA_POR_CARTA[itemKey];
				state.maxCompanionSlots = compra.da;
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					id: `slots${compra.da}_${Date.now()}`,
					name: compra.etiqueta,
					type: "upgrade",
					details: `${compra.da} slots de compañero activos`,
					rarity: "Épico",
					tier: 0
				};
			} else if (itemKey.startsWith("companionCardT")) {
				const comp = generateCompanionByTier(parseInt(itemKey.replace("companionCardT", "")));
				state.companions.push(comp);
				const warehouseItem = {
					id: comp.id,
					name: comp.name,
					type: "companion",
					details: `Recolección por segundo: +${comp.power}/s`,
					rarity: comp.rarity,
					tier: comp.tier,
					sellPrice: Math.floor(item.cost / 4)
				};
				if (!addToWarehouse(warehouseItem)) {
					state.companions.pop();
					state.nanites += cost;
					return false;
				}
				onUpdate(state, isAfk);
				saveToFirebase();
				return warehouseItem;
			} else if (itemKey.startsWith("collectorCardT")) {
				const warehouseItem = {
					...generateCollectorByTier(parseInt(itemKey.replace("collectorCardT", ""))),
					sellPrice: Math.floor(item.cost / 4)
				};
				if (!addToWarehouse(warehouseItem)) {
					state.nanites += cost;
					return false;
				}
				onUpdate(state, isAfk);
				saveToFirebase();
				return warehouseItem;
			}
			onUpdate(state, isAfk);
			saveToFirebase();
			return true;
		},
		/**
		* Abre una caja del almacén consumiendo la llave correcta.
		*
		* ANTES: `openCrateBox(crateType)` solo miraba `state.keys`. El almacén no
		* participaba: el botón de la vista restaba una unidad del item Y el juego
		* restaba una del contador, sin que nadie se enterara. Resultado: la caja
		* se quedaba en la rejilla y el contador bajaba, o al revés.
		*
		* AHORA: se pasa el ID de la caja y el de la llave. El game loop busca
		* ambos items, valida que la llave sirva para ese cofre, y los consume a
		* los dos en la misma operación. Si algo falla, no se toca nada.
		*/
		openCrateBox: (crateId, keyId) => {
			handleUserActivity();
			const caja = state.warehouse.find((w) => w.id === crateId && w.type === "crate");
			if (!caja) return {
				ok: false,
				msg: "La caja ya no está en el almacén."
			};
			const crateType = getCrateTypeFromName(caja.name || "");
			if (!crateType) return {
				ok: false,
				msg: "No se reconoce el tipo de esta caja."
			};
			const llave = state.warehouse.find((w) => w.id === keyId && w.type === "key");
			if (!llave) return {
				ok: false,
				msg: "Ya no tienes esa llave."
			};
			const llaveTier = typeof llave.tier === "number" ? llave.tier : keyTierFromName(llave.name || "");
			const necesaria = CRATE_KEY_TIER[crateType];
			if (!keyOpens(llaveTier, necesaria)) return {
				ok: false,
				msg: `${llave.name} no abre ${CRATE_TYPES[crateType].name}. Necesitas ${KEY_DEFS[necesaria].name}.`
			};
			consumeWarehouseItem(caja.id, 1);
			consumeWarehouseItem(llave.id, 1);
			syncWarehouseGaps();
			state.cratesOpened += 1;
			const premio = rollCrateReward(crateType, {
				nanites: (n) => {
					state.nanites += n;
					state.totalNanitesProduced += n;
				},
				crystals: (n, materialTier) => {
					grantCrystals(materialTier, n);
				},
				keys: (n, keyTier) => {
					grantKeys(keyTier, n);
				},
				hasSpace: () => countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity(),
				unlockCosmetic: (cosmeticId) => desbloquearCosmetico(cosmeticId),
				ownedCosmetics: () => state.cosmetics.unlocked,
				addItem: (item) => {
					if (!addToWarehouse(item)) return false;
					if (item.type === "companion" && !state.companions.some((c) => c.id === item.id)) state.companions.push({
						id: item.id,
						name: item.name,
						type: item.companionType || "passive",
						power: typeof item.power === "number" ? item.power : 1,
						rarity: item.rarity,
						tier: item.tier
					});
					return true;
				}
			});
			syncCrateCounters();
			syncMaterialCounters();
			refreshAfkCardCount();
			recalculatePassiveIncome();
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				ok: true,
				reward: premio,
				crateType
			};
		},
		/** Núcleos disponibles y los que daría el siguiente reinicio. */
		getPrestigeInfo: () => ({
			cores: state.cores,
			totalCores: state.totalCores,
			pending: nextCores({
				totalNanitesProduced: state.totalNanitesProduced,
				totalCores: state.totalCores,
				coreGain: state.bonus.coreGain
			}),
			resets: state.resets,
			totalProduced: state.totalNanitesProduced,
			bonus: state.bonus
		}),
		/**
		* Recicla el progreso: devuelve nanitas, recolectores, compañeros e infraestructura
		* a cambio de núcleos.
		*
		* Un detalle que parece obvio y no lo es: las recolectores que el jugador ya
		* forjó también se pierden, porque viven en el almacén. Se conserva a
		* propósito solo lo que importa como identidad (cuántas forjó), no el
		* inventario. Si se conservaran los objetos, la forja dejaría de ser una
		* apuesta y `forgedCount` no significaría nada.
		*
		* Lo que NO se pierde: núcleos, nodos del árbol, cosméticos, logros,
		* esquirlas y el contador de recolectores forjadas. Esa es toda la promesa del
		* reinicio, así que el estado se construye explícitamente en vez de
		* hacer `Object.assign` con un reset parcial: si mañana se añade un campo
		* al save, el reinicio lo limpia solo.
		*/
		prestige: () => {
			handleUserActivity();
			const gained = nextCores({
				totalNanitesProduced: state.totalNanitesProduced,
				totalCores: state.totalCores,
				coreGain: state.bonus.coreGain
			});
			if (gained <= 0) return {
				success: false,
				gained: 0,
				msg: "Necesitas producir más para reciclar."
			};
			const keptShards = state.shards;
			const keptForged = state.forgedCount;
			const keptAchievements = [...state.unlockedAchievements];
			const keptCores = state.cores + gained;
			const keptTotalCores = state.totalCores + gained;
			const keptResets = state.resets + 1;
			const keptNodes = { ...state.nodeLevels };
			const keptCosmetics = {
				...state.cosmetics,
				unlocked: [...state.cosmetics.unlocked]
			};
			Object.assign(state, {
				nanites: 0,
				totalNanitesProduced: 0,
				passiveIncome: 0,
				passiveMultiplier: 1,
				totalClicks: 0,
				totalInfraestructure: 0,
				cratesOpened: 0,
				keys: 3,
				upgradeCrystals: 5,
				warehouseCapacity: 15,
				maxCompanionSlots: 1,
				afkCards: 0,
				afkExpiresAt: 0,
				crates: {
					common: 2,
					rare: 0,
					epic: 0,
					legendary: 0
				},
				equippedCollectorId: null,
				companions: [baseCompanion],
				activeCompanions: [],
				warehouse: [{
					id: "collector_blaster_001",
					name: "Blaster Láser",
					type: "collector",
					details: "Recolección por click: +5",
					rarity: "Común",
					tier: 1,
					level: 0,
					damage: 5,
					sellPrice: 250
				}, {
					id: "companion_base_001",
					name: "Dron Explorador",
					type: "companion",
					details: "Recolección por segundo: +5/s",
					rarity: "Común",
					tier: 1,
					sellPrice: 250
				}],
				buffs: {
					clickBoostExpiresAt: 0,
					passiveBoostExpiresAt: 0,
					clickX2ExpiresAt: 0,
					clickX3ExpiresAt: 0
				},
				cores: keptCores,
				totalCores: keptTotalCores,
				resets: keptResets,
				nodeLevels: keptNodes,
				unlockedNodes: Object.keys(keptNodes),
				shards: keptShards,
				forgedCount: keptForged,
				unlockedAchievements: keptAchievements,
				cosmetics: keptCosmetics
			});
			recomputeBonuses();
			rebuildAchievementBonuses();
			syncCompanionsToWarehouse();
			materializePendingCrates();
			recalculatePassiveIncome();
			checkAchievements();
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				success: true,
				gained,
				msg: `+${gained} núcleos`
			};
		},
		/** Compra un nivel de un nodo del árbol. */
		buyNode: (nodeId) => {
			handleUserActivity();
			const check = canBuyNode(nodeId, state.nodeLevels, state.cores);
			if (!check.ok) return {
				success: false,
				msg: check.reason ?? "No se puede comprar."
			};
			const node = TREE_BY_ID[nodeId];
			const level = state.nodeLevels[nodeId] || 0;
			const cost = nodeCost(node, level);
			state.cores -= cost;
			state.nodeLevels[nodeId] = level + 1;
			recomputeBonuses();
			recalculatePassiveIncome();
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				success: true,
				msg: `${node.name} → nivel ${level + 1}`
			};
		},
		/**
		* Fusiona 3 recolectores del mismo tier en una de tier+1.
		* `stonesUsed` es cuántas Piedras de Calibración se consumen: cada una
		* sube 12 puntos la probabilidad, hasta 5.
		*/
		forgeCollector: (materialIds, stonesUsed = 0, nanoUsed = 0) => {
			handleUserActivity();
			if ((state.nodeLevels.blueprint || 0) < 1) return {
				success: false,
				msg: "Necesitas el nodo \"Planos Viejos\" para craftear."
			};
			if (materialIds.length !== 3) return {
				success: false,
				msg: "Selecciona exactamente 3 recolectores."
			};
			const materials = materialIds.map((id) => state.warehouse.find((w) => w.id === id)).filter((w) => !!w);
			if (materials.length !== 3) return {
				success: false,
				msg: "Material no encontrado."
			};
			if (materials.some((m) => m.type !== "collector")) return {
				success: false,
				msg: "Solo se pueden fusionar recolectores."
			};
			const tier = materials[0].tier || 1;
			if (materials.some((m) => (m.tier || 1) !== tier)) return {
				success: false,
				msg: "Las 3 recolectores deben ser del mismo tier."
			};
			if (materials.some((m) => m.equipped || m.id === state.equippedCollectorId)) return {
				success: false,
				msg: "No puedes fusionar el recolector equipado. Desequípala primero."
			};
			if (tier >= 11) return {
				success: false,
				msg: "T11 es el techo de la forja."
			};
			const stonesToUse = Math.max(0, Math.min(5, stonesUsed));
			if (stonesToUse > 0) {
				const stone = state.warehouse.find((w) => w.type === "consumable" && w.buffId === "calibrationStone");
				if (!stone) return {
					success: false,
					msg: "No tienes Piedras de Calibración."
				};
				const available = stone.stackCount || 1;
				if (available < stonesToUse) return {
					success: false,
					msg: `Solo tienes ${available} Piedra(s) de Calibración.`
				};
				stone.stackCount = available - stonesToUse;
				if (stone.stackCount <= 0) state.warehouse = state.warehouse.filter((w) => w.id !== stone.id);
			}
			const nanoToUse = nanoUsed > 0 ? 1 : 0;
			if (nanoToUse > 0) {
				const nano = state.warehouse.find((w) => w.type === "consumable" && w.buffId === "stabilityNano");
				if (!nano) return {
					success: false,
					msg: "No tienes Nanopartículas de Estabilidad."
				};
				const available = nano.stackCount || 1;
				if (available < nanoToUse) return {
					success: false,
					msg: `Solo tienes ${available} Nanopartícula(s).`
				};
				nano.stackCount = available - nanoToUse;
				if (nano.stackCount <= 0) state.warehouse = state.warehouse.filter((w) => w.id !== nano.id);
			}
			const result = attemptForge(materials, tier, user.displayName || username || "Anónimo", {
				craftLuck: state.bonus.craftLuck,
				shardBonus: state.bonus.shardBonus,
				stonesUsed: stonesToUse,
				nanoUsed: nanoToUse
			});
			if (result.error) return {
				success: false,
				msg: result.error
			};
			if (result.success && result.collector) {
				const w = result.collector;
				w.sellPrice = sellPrice(w, { sellMult: 1 + state.bonus.sellMult });
				const keep = materials.reduce((a, m) => a.damage < m.damage ? a : m, materials[0]);
				state.warehouse = state.warehouse.filter((x) => !materialIds.includes(x.id) || x.id === keep.id);
				state.warehouse.push(w);
				state.forgedCount += 1;
				recalculatePassiveIncome();
				checkAchievements();
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					success: true,
					collector: w,
					chance: result.chanceUsed,
					msg: `${w.name} forjada`
				};
			}
			state.warehouse = state.warehouse.filter((x) => !materialIds.includes(x.id));
			state.shards += result.shards || 0;
			onUpdate(state, isAfk);
			saveToFirebase();
			return {
				success: false,
				shards: result.shards,
				chance: result.chanceUsed,
				msg: `Fallo en la forja: +${result.shards} esquirlas`
			};
		},
		/** Cuántas esquirlas hacen falta para garantizar el próximo intento. */
		getForgeInfo: () => ({
			shards: state.shards,
			craftLuck: state.bonus.craftLuck,
			forgeUnlocked: (state.nodeLevels.blueprint || 0) > 0,
			baseChance: (fromTier) => {
				const b = .78 - (fromTier - 1) * .05;
				return Math.min(.95, Math.max(.3, b) + state.bonus.craftLuck);
			}
		}),
		/**
		* Precio de venta de UNA UNIDAD, con la bonificación del árbol.
		*
		* Ojo al nombre: es el precio unitario. Para una pila de 19 llaves son 480,
		* no lo que se cobra por venderla. Para el total está `getSellTotal`.
		*/
		getSellPrice: (itemId) => {
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item) return 0;
			return getSellPriceFor(item);
		},
		/**
		* Lo que cobra `sellItem` por este item: unidad × unidades.
		*
		* Existe porque `getSellPrice` es el UNITARIO y esa distinción se ha
		* perdido ya una vez: el botón "Vender" pintaba `getSellPrice` sin
		* multiplicar, así que con una pila de 20 llaves decía "Vender · 480 ◆" y el
		* modal de al lado decía "por 9.600 nanitas". El jugador ve un número, lo
		* acepta y se le cobra otro (R3).
		*
		* `units` es la cantidad a cotizar. Sin él, la pila entera: es lo que
		* pintan la ficha y el botón. Con él, lo que el jugador está a punto de
		* vender, y lo pinta el selector de cantidad en vivo mientras teclea.
		*
		* Vive aquí y no en la vista para que el botón, el modal y el cobro no puedan
		* discrepar por redondeo o por una pila olvidada: es la misma expresión que
		* usa `sellItem`, y si algún día cambia la fórmula cambia en los tres sitios
		* porque son el mismo código.
		*/
		getSellTotal: (itemId, units) => {
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item) return 0;
			const vender = unidadesVendibles(item, units);
			return vender > 0 ? Math.floor(getSellPriceFor(item) * vender) : 0;
		},
		getCollectorValue: (itemId) => {
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item || item.type !== "collector") return 0;
			return collectorValue(item, { sellMult: 1 + state.bonus.sellMult });
		},
		equipCosmetic: (slot, cosmeticId) => {
			handleUserActivity();
			if (!state.cosmetics.unlocked.includes(cosmeticId)) return false;
			state.cosmetics[slot] = cosmeticId;
			onUpdate(state, isAfk);
			saveToFirebase();
			return true;
		},
		/** Marca un cosmético como desbloqueado. Idempotente. */
		unlockCosmetic: (cosmeticId) => desbloquearCosmetico(cosmeticId),
		getCapacity: () => effectiveWarehouseCapacity(),
		/**
		* ¿Cabe este producto en el almacén?
		*
		* Lo lee la tienda para decidir si el botón va como "Almacén lleno". Va aquí
		* y no en la vista porque es la misma pregunta que se hace `buyStoreItem`
		* antes de cobrar: si las dos no coinciden, el jugador ve un botón apagado
		* para algo que sí podría comprar, o uno encendido que al pulsarlo no da
		* nada.
		*/
		canBuyStoreItem: (itemKey) => {
			const ranura = RANURA_POR_CARTA[itemKey];
			if (ranura && effectiveCompanionSlots() >= ranura.da) return false;
			return cabeLaCompra(itemKey);
		},
		getCompanionSlots: () => effectiveCompanionSlots(),
		getAfkDurationMs: () => afkCardDurationMs(),
		cleanup: async () => {
			if (gameInterval) clearInterval(gameInterval);
			clearInterval(saveInterval);
			window.removeEventListener("beforeunload", handleUnload);
			document.removeEventListener("visibilitychange", handlePresenceChange);
			window.removeEventListener("focus", handlePresenceChange);
			window.removeEventListener("blur", handlePresenceChange);
			window.removeEventListener("pageshow", handlePresenceChange);
			window.removeEventListener("pagehide", handlePresenceChange);
			docWithLifecycle.removeEventListener("freeze", handlePresenceChange);
			docWithLifecycle.removeEventListener("resume", handlePresenceChange);
			window.removeEventListener("keydown", handleUserActivity);
			window.removeEventListener("click", handleUserActivity);
			window.removeEventListener("online", reintentarSiHayCola);
			window.removeEventListener("focus", reintentarSiHayCola);
			window.removeEventListener("pageshow", reintentarSiHayCola);
			await saveToFirebase();
		},
		/**
		* Guarda sin detener nada.
		*
		* Existe para el cierre de sesión: `cleanup` para los timers, pero ahí el
		* guardado ocurre DESPUÉS de quitar los escuchas y justo antes de cerrar
		* la sesión de Firebase, que ya deja `setDoc` sin permiso. `flush` fuerza
		* la escritura mientras la sesión sigue viva.
		*/
		flush: () => {
			saveToFirebase();
		}
	};
	return estado;
}
//#endregion
//#region verify/kit.ts
/**
* Filas de las comprobaciones del banco EN CURSO.
*
* `kit.ts` se comparte entre bancos (Vite lo mete en un chunk comun), asi que
* `rows` es UN array para todos. `resumen()` lo vacia al terminar cada banco: sin
* eso, los fallos del banco anterior salen otra vez en el siguiente y parece que
* falla lo que no ha fallado.
*/
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
/**
* Arranca el game loop con la partida dada puesta en la base de datos.
*
* `extra` es el cuarto argumento de `createGameLoop` —el mismo que `main.ts` le
* pasa a `showAchievementPopup`—, y existe porque sin él no hay forma de mirar si
* el motor **emite** un logro. Antes solo se podía mirar si se desbloqueaba en el
* estado, y son dos cosas distintas: el cartel depende de la primera y del cableado
* hasta la vista, y esa segunda mitad no es comprobable desde un banco (B3).
*/
async function boot(save, extra) {
	await new Promise((r) => setTimeout(r, 0));
	await new Promise((r) => setTimeout(r, 0));
	limpiarCola();
	globalThis.__MEM_DB__ = {};
	if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
	return await createGameLoop(USER, () => {}, void 0, extra?.onAchievement);
}
/**
* Borra la cola de nanitas pendientes.
*
* Vive aquí y no en el runner porque el problema no era solo entre bancos: cada
* `boot()` dentro de un mismo banco parte de un documento nuevo, y si la cola
* de una partida anterior siguiera ahí, `createGameLoop` la adoptaría por ser
* más reciente y arrancaría con un saldo que el test no ha puesto nunca.
*/
function limpiarCola() {
	try {
		globalThis.localStorage?.clear?.();
	} catch {}
}
var s = (g) => g.getState();
var collector = (id, tier = 3, over = {}) => ({
	id,
	name: `Recolector T${tier}`,
	type: "collector",
	details: `Recolección por click: +${20 * tier}`,
	rarity: "Épico",
	tier,
	level: 0,
	damage: 20 * tier,
	sellPrice: 500,
	...over
});
/**
* Partida base con los contadores ya en paz con el almacén.
*
* Los contadores se derivan del almacén al cargar, así que una partida de test
* que los traiga descuadrados mide el recorte, no lo que quiere medir.
*/
function baseSave(items, extra = {}) {
	const crates = {
		common: 0,
		rare: 0,
		epic: 0,
		legendary: 0
	};
	const keysByTier = {
		0: 0,
		1: 0,
		2: 0,
		3: 0
	};
	const crystalsByTier = {};
	let upgradeCrystals = 0;
	let afkCards = 0;
	for (const w of items) if (w.type === "crate") {
		const t = w.name.includes("Legendaria") ? "legendary" : w.name.includes("Épica") ? "epic" : w.name.includes("Rara") ? "rare" : "common";
		crates[t] += w.stackCount || 1;
	} else if (w.type === "key") keysByTier[w.tier ?? 0] += w.stackCount || 1;
	else if (w.type === "crystal") {
		crystalsByTier[w.tier ?? 1] += w.stackCount || 1;
		if ((w.tier ?? 1) === 1) upgradeCrystals += w.stackCount || 1;
	} else if (w.type === "consumable" && w.buffId === "afk") afkCards += w.stackCount || 1;
	return {
		saveVersion: 7,
		nanites: 1e3,
		totalNanitesProduced: 0,
		warehouse: items,
		crates,
		keys: keysByTier[0] + keysByTier[1] + keysByTier[2] + keysByTier[3],
		keysByTier,
		crystalsByTier,
		upgradeCrystals,
		afkCards,
		companions: [],
		activeCompanions: [],
		equippedCollectorId: null,
		warehouseCapacity: 30,
		maxCompanionSlots: 3,
		warehouseGaps: [],
		buffs: {
			clickBoostExpiresAt: 0,
			passiveBoostExpiresAt: 0,
			clickX2ExpiresAt: 0,
			clickX3ExpiresAt: 0
		},
		nodeLevels: {},
		unlockedNodes: [],
		cores: 0,
		totalCores: 0,
		shards: 0,
		forgedCount: 0,
		cosmetics: {
			title: "title_default",
			frame: "frame_none",
			banner: "banner_none",
			unlocked: []
		},
		unlockedAchievements: [],
		...extra
	};
}
function resumen(titulo) {
	const mio = rows.splice(0, rows.length);
	const fallos = mio.filter((r) => !r.ok);
	mio.forEach((r) => console.log(`${r.ok ? "PASA" : "FALLA"}  ${r.name}${r.detail ? "   [" + r.detail + "]" : ""}`));
	console.log(`\n${mio.length - fallos.length}/${mio.length} pruebas correctas (${titulo})`);
	if (fallos.length) {
		console.log("\nFALLOS:");
		fallos.forEach((r) => console.log("  - " + r.name + (r.detail ? "  [" + r.detail + "]" : "")));
		process.exitCode = 1;
	}
}
//#endregion
//#region verify/renderB12.ts
async function main() {
	const g = await boot(baseSave([collector("r1")], {
		totalNanitesProduced: 1e6,
		cores: 0,
		totalCores: 0,
		resets: 0
	}));
	g.prestige();
	g.getState().totalNanitesProduced = 1e6;
	const st = s(g);
	const args = {
		totalNanitesProduced: st.totalNanitesProduced,
		totalCores: st.totalCores,
		coreGain: st.bonus.coreGain
	};
	const pending = nextCores(args);
	const texto = pending > 0 ? "(rama reciclar)" : `Produce ${formatNumber(nanitesToNextCore(args))} más para el ${st.totalCores > 0 ? "siguiente" : "primer"} núcleo`;
	const barra = pending > 0 ? 100 : Math.round(coreProgress(args) * 100);
	console.log(`PANTALLA: "${texto}"  barra=${barra}%  boton=${pending > 0 ? "RECICLAR" : "AUN NO PUEDES RECICLAR"}`);
	check("render: no dice \"0 mas\"", !texto.includes("0 más"), texto);
	check("render: dice \"siguiente\", no \"primer\"", texto.includes("siguiente"), texto);
	check("render: la barra avanza (ni 0 ni 100 clavados)", barra > 0 && barra < 100, `barra=${barra}%`);
	check("render: sin overflow de texto (una linea corta)", texto.length < 60, `${texto.length} chars`);
	resumen("render B12");
}
var renderB12_default = main();
//#endregion
export { renderB12_default as default };
