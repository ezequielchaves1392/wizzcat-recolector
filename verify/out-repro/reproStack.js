//#region verify/domStub.ts
var nodo = () => ({
	innerHTML: "",
	className: "",
	style: {},
	dataset: {},
	attributes: {},
	children: [],
	textContent: "",
	setAttribute(k, v) {
		this.attributes[k] = v;
	},
	getAttribute(k) {
		return this.attributes[k];
	},
	removeAttribute(k) {
		delete this.attributes[k];
	},
	hasAttribute(k) {
		return k in this.attributes;
	},
	addEventListener() {},
	removeEventListener() {},
	appendChild(c) {
		this.children.push(c);
		return c;
	},
	removeChild(c) {
		this.children = this.children.filter((x) => x !== c);
	},
	replaceChild() {},
	replaceWith() {},
	querySelector() {
		return null;
	},
	querySelectorAll() {
		return [];
	},
	closest() {
		return null;
	},
	get firstChild() {
		return this.children[0] ?? null;
	},
	get parentElement() {
		return null;
	}
});
/** El contenedor de la app: `mountInto` le pide `ownerDocument`. */
var contenedor = () => {
	const c = nodo();
	c.ownerDocument = globalThis.document;
	return c;
};
var listeners = () => ({
	addEventListener() {},
	removeEventListener() {}
});
globalThis.__MEM_DB__ = {};
globalThis.document = {
	visibilityState: "visible",
	hasFocus: () => true,
	addEventListener() {},
	removeEventListener() {},
	createElement: () => nodo(),
	body: nodo()
};
globalThis.window = { ...listeners() };
globalThis.localStorage = {
	getItem: () => null,
	setItem() {}
};
globalThis.performance ??= { now: () => Date.now() };
globalThis.setInterval = () => 0;
//#endregion
//#region src/utils/toast.ts
function showToast(message, type = "info") {
	const toast = document.createElement("div");
	toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-mono shadow-2xl transform transition-all duration-300 translate-x-full ${{
		success: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
		error: "bg-red-500/20 border-red-500/40 text-red-300",
		info: "bg-blue-500/20 border-blue-500/40 text-blue-300"
	}[type]}`;
	toast.textContent = message;
	document.body.appendChild(toast);
	setTimeout(() => toast.classList.remove("translate-x-full"), 10);
	setTimeout(() => {
		toast.classList.add("translate-x-full");
		setTimeout(() => toast.remove(), 300);
	}, 3e3);
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
		data: () => doc
	};
};
var setDoc = async (ref, data, options) => {
	if (globalThis.__MEM_DB__?.fallar) throw new Error("FirestoreError: unavailable: Sin conexión (simulado)");
	const db = globalThis.__MEM_DB__;
	const previo = options?.merge ? db[ref.id] : void 0;
	db[ref.id] = previo ? {
		...previo,
		...data
	} : data;
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
	} catch {}
}
/**
* Vacía la cola.
*
* Se llama SOLO cuando el servidor ha confirmado que ya tiene ese saldo.
* Vaciarla antes de tiempo perdería nanitas: el documento se quedaría con la
* cifra vieja y la cola con la nueva, y nadie sumaría las dos.
*/
function vaciarCola() {
	try {
		localStorage.removeItem(CLAVE);
	} catch {}
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
//#endregion
//#region src/components/crateLoot.ts
var RARITY_TEXT = {
	"Común": "text-slate-400",
	"Raro": "text-blue-400",
	"Épico": "text-purple-400",
	"Legendario": "text-amber-400",
	"Mítico": "text-rose-400",
	"Divino": "text-yellow-300",
	"Sobrecargado": "text-fuchsia-300"
};
var RARITY_BORDER = {
	"Común": "border-slate-500/40",
	"Raro": "border-blue-500/40",
	"Épico": "border-purple-500/40",
	"Legendario": "border-amber-500/50",
	"Mítico": "border-rose-500/50",
	"Divino": "border-yellow-400/60",
	"Sobrecargado": "border-fuchsia-400/60"
};
/** Clase de glow. Se escriben completas para que Tailwind las vea. */
var RARITY_GLOW = {
	"Común": "",
	"Raro": "rarity-glow-raro",
	"Épico": "rarity-glow-epico",
	"Legendario": "rarity-glow-legendario",
	"Mítico": "rarity-glow-mitico",
	"Divino": "rarity-glow-divino",
	"Sobrecargado": "rarity-glow-sobrecargado"
};
/** Atajo: color + borde en una sola clase, para las casillas de la ruleta. */
function rarityClass(rarity) {
	return `${RARITY_TEXT[rarity] || RARITY_TEXT["Común"]} ${RARITY_BORDER[rarity] || RARITY_BORDER["Común"]}`;
}
/**
* Slug de rareza para las clases `.ring-*` y `.rarity-*` del CSS.
*
* Existe porque `rarityClass()` devuelve utilidades de Tailwind
* (`text-blue-400 border-blue-500/40`) y no se pueden componer: no hay forma
* de extraer de ahí el nombre "raro" para escribir `ring-raro`. Antes de
* esto el almacén construía `ring-text-blue-400`, una clase que no existe, y
* todas las celdas salían sin el halo de rareza.
*
* `normalize('NFD')` + diacríticos porque 'Épico' y 'Mítico' llevan tilde y la
* clase CSS no la lleva.
*/
function raritySlug(rarity) {
	return (rarity || "Común").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
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
		cost: 400
	},
	rare: {
		name: "Caja Rara",
		icon: "crate",
		cost: 1200
	},
	epic: {
		name: "Caja Épica",
		icon: "crystal",
		cost: 4500
	},
	legendary: {
		name: "Caja Legendaria",
		icon: "trophy",
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
var rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
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
		{
			id: "keys",
			weight: 12,
			build: () => {
				const a = rand(1, 2);
				return {
					kind: "keys",
					amount: a,
					name: "Llave de Cifrado",
					label: `+${a} Llave${a > 1 ? "s" : ""}`,
					details: "Abre Cofres Comunes y Raros",
					rarity: "Raro",
					icon: "key",
					keyTier: 0
				};
			}
		},
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
		{
			id: "keys",
			weight: 14,
			build: () => {
				const a = rand(2, 4);
				return {
					kind: "keys",
					amount: a,
					name: "Llave Reforzada",
					label: `+${a} Llaves Reforzadas`,
					details: "Abre Cofres Raros, Épicos y Legendarios",
					rarity: "Épico",
					icon: "key",
					keyTier: 1
				};
			}
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
			id: "keys",
			weight: 8,
			build: () => {
				const a = rand(5, 8);
				return {
					kind: "keys",
					amount: a,
					name: "Llave Rúnica",
					label: `+${a} Llaves Rúnicas`,
					details: "Abre Cofres Épicos y Legendarios",
					rarity: "Legendario",
					icon: "key",
					keyTier: 2
				};
			}
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
* ¿Este premio tiene una cifra que el jugador debería ver?
*
* Las monedas y los materiales siempre (aunque caiga uno solo: "1 llave" sigue
* siendo una cantidad, y el jugador la contaría con los dedos). Los objetos,
* solo cuando caen varios de una vez: un "+1 Dron" es ruido, el nombre ya lo
* dice.
*/
function isCountedLoot(reward) {
	if (reward.kind === "nanites" || reward.kind === "crystals" || reward.kind === "keys") return true;
	if (reward.kind === "crate" || reward.kind === "consumable") return reward.amount > 1;
	return false;
}
/**
* La cifra del premio, formateada para pantalla: `+250`, `+8.33 K`.
*
* Usa el mismo `formatNumber` que los contadores del juego a propósito: si la
* ruleta escribiera `8.332` y el saldo `8.33 K`, el jugador leería dos números
* distintos para la misma cantidad.
*
* Vive aquí y no en la ruleta porque la usan los tres sitios que enseñan botín
* (la casilla que gana, el cartel del resultado y las distracciones de la tira).
* Tres copias de un `toLocaleString` divergen tarde: una se olvidaría del `+` y
* el jugador leería un gasto donde tenía un premio.
*/
function lootAmountText(reward) {
	return `+${formatNumber(reward.amount)}`;
}
/**
* Decide el premio y lo aplica. Si el almacén está lleno y el drop es un item,
* se compensa en nanitas para no perderlo nunca.
*/
function rollCrateReward(crateType, applier) {
	const reward = resolveLootAmount(crateType, pickLoot(crateType).build());
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
		default: {
			if (reward.item ? applier.addItem(reward.item) : false) return reward;
			const compensation = Math.round(CRATE_META[crateType].cost * 1.5);
			applier.nanites(compensation);
			return {
				...reward,
				kind: "nanites",
				item: void 0,
				amount: compensation,
				name: "Compensación",
				label: `Almacén lleno: +${compensation} Nanitas`,
				details: "No cabía el objeto, se compensó en nanitas",
				rarity: "Común",
				icon: "bolt"
			};
		}
	}
}
/**
* Tira de casillas para la ruleta. El premio real va en `winIndex`; el resto son
* distracciones sacadas de la misma tabla, con los exclusivos diluidos para que
* el jackpot se sienta ganado y no regalado.
*/
function buildRouletteStrip(crateType, length = 26) {
	const table = CRATE_LOOT[crateType];
	const tiles = [];
	const exclusiveIds = [
		"ghost",
		"phoenix",
		"avatar",
		"oracle",
		"sentinel",
		"collector_oc6",
		"collector_oc8",
		"collector_t4"
	];
	const exclusiveEntries = table.filter((e) => exclusiveIds.includes(e.id));
	for (let i = 0; i < length; i++) {
		const src = exclusiveEntries.length > 0 && Math.random() < .07 ? exclusiveEntries[Math.floor(Math.random() * exclusiveEntries.length)] : table[Math.floor(Math.random() * table.length)];
		tiles.push(makeRouletteTile(resolveLootAmount(crateType, src.build())));
	}
	return { tiles };
}
/** Casilla de la ruleta: nombre, cifra si el botín se cuenta, y rareza. */
function makeRouletteTile(reward) {
	return {
		label: reward.name.length > 16 ? reward.name.slice(0, 15) + "…" : reward.name,
		amount: isCountedLoot(reward) ? lootAmountText(reward) : void 0,
		sub: reward.rarity,
		rarity: reward.rarity,
		icon: reward.icon
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
			current: Math.min(s.warehouseCapacity ?? 0, 20),
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
			maxLevel: 20 + potential * 3,
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
	const levelMult = levelValueMult(collector.level || 0, collector.maxLevel ?? 20);
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
/** Resumen legible para la tarjeta del item. */
function valuationBreakdown(collector, opts = {}) {
	const out = [];
	const base = TIER_BASE_VALUE[Math.max(1, Math.min(collector.tier, 11))] ?? 200;
	out.push(`Base T${collector.tier}: ${fmt(base)}`);
	if (collector.level) out.push(`Nivel ${collector.level}: ×${levelValueMult(collector.level, collector.maxLevel ?? 20).toFixed(2)}`);
	out.push(`Rareza ${collector.rarity}: ×${(RARITY_VALUE_MULT[collector.rarity] ?? 1).toFixed(2)}`);
	if (collector.potential) out.push(`Potencial ${collector.potential}★: ×${potentialValueMult(collector.potential).toFixed(2)}`);
	if (collector.affixes?.length) out.push(`${collector.affixes.length} afijo(s): ×${affixValueMult(collector).toFixed(2)}`);
	if (opts.authorRank != null) out.push(`Autor top ${opts.authorRank}: ×${fameValueMult(opts.authorRank).toFixed(2)}`);
	return out;
}
function fmt(n) {
	if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
	if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
	return String(Math.round(n));
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
/**
* Unidades que caben en la esquina de una celda antes de recortar el número.
*
* Es un tope DE PINTADO, no de almacenamiento: una pila puede llevar 25 cajas
* detrás y el detalle sigue enseñando las 25. Lo que no se puede prometer es un
* número más grande del que cabe en la celda. Llave y cristal admiten 99 porque
* se gastan de uno en uno y 99 es de sobra; caja y consumible, 20, porque se
* recognize en un vistazo.
*/
var MAX_STACK = {
	consumable: 20,
	crate: 20,
	key: 99,
	crystal: 99
};
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
//#region src/data/items.ts
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
var KEY_DEFS = {
	0: {
		tier: 0,
		name: "Llave de Cifrado",
		details: "Abre Cofres Comunes y Raros.",
		rarity: "Común",
		buyable: true,
		cost: 480,
		dropRate: 0
	},
	1: {
		tier: 1,
		name: "Llave Reforzada",
		details: "Abre Cofres Raros, Épicos y Legendarios.",
		rarity: "Raro",
		buyable: false,
		cost: null,
		dropRate: 22
	},
	2: {
		tier: 2,
		name: "Llave Rúnica",
		details: "Abre Cofres Épicos y Legendarios.",
		rarity: "Épico",
		buyable: false,
		cost: null,
		dropRate: 14
	},
	3: {
		tier: 3,
		name: "Llave del Vacío",
		details: "Abre cualquier cofre. La más rara.",
		rarity: "Legendario",
		buyable: false,
		cost: null,
		dropRate: 4
	}
};
/** Qué llave necesita cada cofre. */
var CRATE_KEY_TIER = {
	common: 0,
	rare: 1,
	epic: 2,
	legendary: 3
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
*/
function keyOpens(keyHeld, keyNeeded) {
	return KEY_TIER_ORDER.indexOf(keyHeld) >= KEY_TIER_ORDER.indexOf(keyNeeded);
}
/** Mismo criterio, sobre nombres. Pensado para pintar el botón de abrir. */
function keyNameOpensCrate(keyName, crateType) {
	return keyOpens(keyTierFromName(keyName), CRATE_KEY_TIER[crateType]);
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
var AFK_CARD_DURATION_MS = 6e5;
var MAX_AFK_BUFF_DURATION_MS = 18e5;
var BUFF_FIELDS = {
	clickBoost: "clickBoostExpiresAt",
	clickX2: "clickX2ExpiresAt",
	clickX3: "clickX3ExpiresAt",
	passiveBoost: "passiveBoostExpiresAt"
};
var STORE_ITEMS = {
	key: {
		cost: 250,
		label: "Llave de Cifrado"
	},
	upgradeCrystal: {
		cost: 60,
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
	clickBuff: {
		cost: 800,
		durationMs: 18e5,
		label: "Buff Clicks x2 (30m)"
	},
	passiveBuff: {
		cost: 1500,
		durationMs: 36e5,
		label: "Buff Pasivo x2 (1h)"
	},
	backpackExpander: {
		cost: 1400,
		label: "Expansor de Almacén (+1 slot)"
	},
	companionSlot1: {
		cost: 1200,
		label: "Slot de Compañero 2"
	},
	companionSlot2: {
		cost: 16e3,
		label: "Ranura de Escuadrón (+3 slots)"
	},
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
		cost: 1600,
		label: "Compañero Tier 2"
	},
	companionCardT3: {
		cost: 2700,
		label: "Compañero Tier 3"
	},
	companionCardT4: {
		cost: 4500,
		label: "Compañero Tier 4"
	},
	companionCardT5: {
		cost: 7400,
		label: "Compañero Tier 5"
	},
	companionCardT6: {
		cost: 12e3,
		label: "Compañero Tier 6"
	},
	companionCardT7: {
		cost: 19500,
		label: "Compañero Tier 7"
	},
	companionCardT8: {
		cost: 31e3,
		label: "Compañero Tier 8"
	},
	companionCardT9: {
		cost: 49e3,
		label: "Compañero Tier 9"
	},
	companionCardT10: {
		cost: 77e3,
		label: "Compañero Tier 10"
	},
	collectorCardT1: {
		cost: 850,
		label: "Recolector Tier 1"
	},
	collectorCardT2: {
		cost: 1600,
		label: "Recolector Tier 2"
	},
	collectorCardT3: {
		cost: 2500,
		label: "Recolector Tier 3"
	},
	collectorCardT4: {
		cost: 3700,
		label: "Recolector Tier 4"
	},
	collectorCardT5: {
		cost: 5300,
		label: "Recolector Tier 5"
	},
	collectorCardT6: {
		cost: 7200,
		label: "Recolector Tier 6"
	},
	collectorCardT7: {
		cost: 9400,
		label: "Recolector Tier 7"
	},
	collectorCardT8: {
		cost: 11900,
		label: "Recolector Tier 8"
	},
	collectorCardT9: {
		cost: 14600,
		label: "Recolector Tier 9"
	},
	collectorCardT10: {
		cost: 17500,
		label: "Recolector Tier 10"
	}
};
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
function collectorUpgradeCost(level) {
	return Math.max(1, Math.floor(1.2 * Math.pow(1.14, level)));
}
/**
* Probabilidad de éxito con un cristal concreto, en porcentaje.
*
* Es el mismo número que usa `upgradeEquippedCollector`, expuesto para que las
* vistas puedan enseñarlo ANTES de que el jugador gaste. La regla del juego es
* que ninguna probabilidad se muestra después de confirmar.
*/
function previewUpgradeChance(level, crystalPower) {
	return crystalSuccessChance(level, crystalPower);
}
/**
* Coste de la sintonización al nivel dado, en unidades de cristal.
*
* Igual que el anterior: el juego cobra esto, la vista lo enseña. Duplicar el
* cálculo en la interfaz sería una forma de que el botón dijera una cifra y el
* cobro otra.
*/
function previewUpgradeCost(level) {
	return collectorUpgradeCost(level);
}
var CONSUMABLES = {
	clickBuff: {
		name: "Buff Clicks x2",
		details: "Otorga x2 al click por 30 minutos",
		rarity: "Raro",
		buffId: "clickBoost"
	},
	passiveBuff: {
		name: "Buff Pasivo x2",
		details: "Otorga x2 al ingreso pasivo por 60 minutos",
		rarity: "Épico",
		buffId: "passiveBoost"
	},
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
		details: "Recompensas de partida temprana: nanitas, cristales, algún dron T1. Abre con una Llave de Cifrado."
	},
	rare: {
		name: "Caja Rara",
		rarity: "Raro",
		details: "Material de forja y compañeros T3, con algún recolector T4 sobrecargado. Abre con una Llave Reforzada."
	},
	epic: {
		name: "Caja Épica",
		rarity: "Épico",
		details: "Compañeros T6 y recolectores T6, con piedras de calibración. Abre con una Llave Rúnica."
	},
	legendary: {
		name: "Caja Legendaria",
		rarity: "Legendario",
		details: "Recolectores T8 y compañeros Divinos que no se compran. Sale la Nanopartícula de Estabilidad. Abre con una Llave del Vacío."
	}
};
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
function generateCompanionByTier(tier) {
	const range = TIER_SYSTEM.ranges[tier] || [1, 5];
	const power = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
	const names = TIER_SYSTEM.companionNames[tier] || ["Dron Explorador"];
	const name = names[Math.floor(Math.random() * names.length)];
	const rarity = TIER_SYSTEM.rarityByTier[tier] || "Común";
	return {
		id: `comp_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		name,
		type: "click",
		power,
		rarity,
		tier
	};
}
function generateCollectorByTier(tier) {
	const range = TIER_SYSTEM.ranges[tier] || [1, 5];
	const power = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
	const names = TIER_SYSTEM.collectorNames[tier] || ["Blaster Láser"];
	const name = names[Math.floor(Math.random() * names.length)];
	const rarity = TIER_SYSTEM.rarityByTier[tier] || "Común";
	return {
		id: `collector_t${tier}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
		name,
		type: "collector",
		details: `Recolección por click: +${power}`,
		rarity,
		tier,
		level: 0,
		damage: power
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
	*/
	function getSellPriceFor(item) {
		if (item.type === "collector") return sellPrice(item, { sellMult: 1 + state.bonus.sellMult });
		return Math.floor((item.sellPrice || 0) * (1 + state.bonus.sellMult));
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
		if (itemKey === "key") return {
			type: "key",
			name: KEY_DEFS[0].name,
			stackable: true
		};
		if (itemKey === "upgradeCrystal") return {
			type: "crystal",
			name: CRYSTAL_DEFS[1].name,
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
		const sellPrice = esLlave ? Math.floor(def.cost ?? 1200) : Math.floor(def.cost ?? 2400) * 3;
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
	const AFK_THRESHOLD_MS = 45e3;
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
		if (typeof document === "undefined") return;
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
			/**
			* COLA DE LA SESIÓN ANTERIOR.
			*
			* La regla NO es "si hay algo pendiente, súmalo". Es "usa lo que sea más
			* nuevo, y solo eso". La diferencia no es de estilo: el reinicio de
			* prestigio pone el saldo a cero, y una cola que se sumara sin más
			* devolvería ese dinero después de reiniciar — con elAggravante de que el
			* jugador conservaría los núcleos, y se podría repetir sin límite.
			*
			* El documento trae `updatedAt` y la cola trae su propia marca. Se
			* comparan y gana la más reciente:
			*
			*   · Gana la cola → el último guardado no llegó (o hubo un reinicio que
			*     tampoco llegó). Se adopta entero, incluido si vale cero.
			*   · Gana el documento → otro dispositivo del jugador ha seguido jugando
			*     más tarde, o la cola es de una sesión vieja. Se descarta entera, y
			*     no se mezclan: coger el máximo de los dos produciría saldos que
			*     ninguna de las dos sesiones vio nunca.
			*/
			const cola = leerCola(user.uid);
			const guardadoEn = aMilis(data.updatedAt);
			if (cola.existe) {
				if (cola.ts > guardadoEn) {
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
					vaciarCola();
				}
			}
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
			if (warehouseNeedsMigration) saveToFirebase();
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
			if (!data.totalCores) state.totalCores = pendingCores(state.totalNanitesProduced);
			state.buffs = {
				clickBoostExpiresAt: data.buffs?.clickBoostExpiresAt ?? 0,
				passiveBoostExpiresAt: data.buffs?.passiveBoostExpiresAt ?? 0,
				clickX2ExpiresAt: data.buffs?.clickX2ExpiresAt ?? 0,
				clickX3ExpiresAt: data.buffs?.clickX3ExpiresAt ?? 0
			};
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
		state.activeCompanions.forEach((compId) => {
			const comp = state.companions.find((c) => c.id === compId);
			if (comp && comp.type !== "multiplier") base += comp.power;
		});
		if (Date.now() < state.buffs.passiveBoostExpiresAt) base *= 2;
		state.passiveMultiplier = calculateCompanionMultiplier();
		const withAchievements = base * state.passiveMultiplier * (1 + achievementState.passiveBonus) * (1 + state.bonus.passiveMult);
		state.passiveIncome = Math.floor(withAchievements);
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
	function calculateClickDamage() {
		if (!state.equippedCollectorId) return 0;
		const item = state.warehouse.find((w) => w.id === state.equippedCollectorId);
		if (!item) return 0;
		const affixes = equippedAffixEffect();
		const total = ((item.damage || 0) + affixes.flat) * (1 + (item.level || 0) * .1) * calculateCompanionMultiplier() * (1 + achievementState.clickBonus) * (1 + state.bonus.clickMult) * (1 + affixes.clickMult);
		return Math.floor(total);
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
		anotarPendiente(user.uid, state.nanites, state.totalNanitesProduced, state.totalClicks, state.cores, state.totalCores, state.resets);
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
			*/
			vaciarCola();
			pendingWasFlushed();
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
	const handleMouseMove = () => {
		lastActiveTimestamp = Date.now();
	};
	const docWithLifecycle = document;
	document.addEventListener("visibilitychange", handlePresenceChange);
	window.addEventListener("focus", handlePresenceChange);
	window.addEventListener("blur", handlePresenceChange);
	window.addEventListener("pageshow", handlePresenceChange);
	window.addEventListener("pagehide", handlePresenceChange);
	docWithLifecycle.addEventListener("freeze", handlePresenceChange);
	docWithLifecycle.addEventListener("resume", handlePresenceChange);
	window.addEventListener("mousemove", handleMouseMove);
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
	const TICKS_PER_SECOND = 1e3 / TICK_RATE_MS;
	let awaitingClickAfterAfk = false;
	let autoClickAccumulator = 0;
	let gameInterval = null;
	function startGameIntervals() {
		if (gameInterval) clearInterval(gameInterval);
		gameInterval = setInterval(() => {
			if (!isPlayerPresent()) {
				handlePresenceChange();
				return;
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
			if (state.passiveIncome > 0) {
				const gained = state.passiveIncome / TICKS_PER_SECOND;
				state.nanites += gained;
				state.totalNanitesProduced += gained;
			}
			if (state.bonus.autoClick > 0) {
				autoClickAccumulator += state.bonus.autoClick * (TICK_RATE_MS / 1e3);
				while (autoClickAccumulator >= 1) {
					autoClickAccumulator -= 1;
					const dmg = calculateClickDamage() * calculateMultiplier();
					state.nanites += dmg;
					state.totalNanitesProduced += dmg;
					state.totalClicks += 1;
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
		sellItem: (itemId) => {
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
			if (item.type === "collector" || item.type === "companion") {
				if (state.warehouse.filter((w) => w.type === item.type).length <= 1) return {
					ok: false,
					msg: "No puedes vender el último de su tipo."
				};
			}
			const qty = item.stackable ? item.stackCount || 1 : 1;
			const unitario = getSellPriceFor(item);
			const ganado = Math.floor(unitario * qty);
			state.nanites += ganado;
			consumeWarehouseItem(item.id, qty);
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
				gained: ganado
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
		},
		upgradeEquippedCollector: (crystalTier = 1) => {
			handleUserActivity();
			if (!state.equippedCollectorId) return {
				success: false,
				msg: "No hay ningún recolector equipado."
			};
			const item = state.warehouse.find((w) => w.id === state.equippedCollectorId);
			if (!item) return {
				success: false,
				msg: "Recolector no encontrado."
			};
			const level = item.level || 0;
			if (level >= 20) return {
				success: false,
				msg: `Recolector al nivel máximo (+200%).`
			};
			const crystal = state.warehouse.find((w) => w.type === "crystal" && (typeof w.tier === "number" ? w.tier : 1) === crystalTier);
			if (!crystal) return {
				success: false,
				msg: `No tienes ${CRYSTAL_DEFS[crystalTier]?.name ?? "Cristal"}.`
			};
			const crystalCost = collectorUpgradeCost(level);
			const units = crystal.stackCount || 1;
			if (units < crystalCost) return {
				success: false,
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
					msg: `¡Mejora exitosa! ${item.name} ascendió al nivel ${item.level}.`
				};
			} else {
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					success: false,
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
			if (itemKey === "companionSlot1" && effSlots >= 2) return false;
			if (itemKey === "companionSlot2" && effSlots >= 5) return false;
			if (!cabeLaCompra(itemKey)) {
				showToast("Almacén lleno. No puedes comprar más items.", "error");
				return false;
			}
			state.nanites -= cost;
			if (itemKey === "key" || itemKey === "upgradeCrystal") {
				const item = createMaterialItem(itemKey === "key" ? "key" : "crystal", 1);
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
			} else if (itemKey === "companionSlot1") {
				state.maxCompanionSlots = 2;
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					id: `slot2_${Date.now()}`,
					name: "Slot de Compañero 2",
					type: "upgrade",
					details: "2 slots de compañero activos",
					rarity: "Épico",
					tier: 0
				};
			} else if (itemKey === "companionSlot2") {
				state.maxCompanionSlots = 5;
				onUpdate(state, isAfk);
				saveToFirebase();
				return {
					id: `slot5_${Date.now()}`,
					name: "Ranura de Escuadrón",
					type: "upgrade",
					details: "5 slots de compañero activos",
					rarity: "Legendario",
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
				crystals: (n) => {
					grantCrystals(1, n);
				},
				keys: (n) => {
					grantKeys(1, n);
				},
				hasSpace: () => countOccupiedSlots(state.warehouse) < effectiveWarehouseCapacity(),
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
			if (!state.totalCores) state.totalCores = pendingCores(state.totalNanitesProduced);
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
		/** Precio de venta actual del item, con la bonificación del árbol. */
		getSellPrice: (itemId) => {
			const item = state.warehouse.find((w) => w.id === itemId);
			if (!item) return 0;
			return getSellPriceFor(item);
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
		unlockCosmetic: (cosmeticId) => {
			if (state.cosmetics.unlocked.includes(cosmeticId)) return false;
			state.cosmetics.unlocked.push(cosmeticId);
			return true;
		},
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
		canBuyStoreItem: (itemKey) => cabeLaCompra(itemKey),
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
			window.removeEventListener("mousemove", handleMouseMove);
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
//#region src/ui/icons.ts
var svg = (paths, viewBox = "0 0 24 24") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0">${paths}</svg>`;
var ICONS = {
	warehouse: svg("<path d=\"M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z\"/><path d=\"M9 21v-7h6v7\"/>"),
	store: svg("<path d=\"M4 8h16l-1 3a3 3 0 0 1-5.5 1.6A3 3 0 0 1 12 13a3 3 0 0 1-1.5-.4A3 3 0 0 1 5 11L4 8Z\"/><path d=\"M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7\"/><path d=\"M10 20v-5h4v5\"/>"),
	podium: svg("<path d=\"M7 4h10v5a5 5 0 0 1-10 0V4Z\"/><path d=\"M7 6H4v1a3 3 0 0 0 3 3\"/><path d=\"M17 6h3v1a3 3 0 0 1-3 3\"/>"),
	trophy: svg("<path d=\"M7 4h10v5a5 5 0 0 1-10 0V4Z\"/><path d=\"M7 6H4v1a3 3 0 0 0 3 3\"/><path d=\"M17 6h3v1a3 3 0 0 1-3 3\"/><path d=\"M12 14v3\"/><path d=\"M9 20h6\"/><path d=\"M10 17h4l.5 3h-5l.5-3Z\"/>"),
	power: svg("<path d=\"M12 3v9\"/><path d=\"M6.6 6.6a8 8 0 1 0 10.8 0\"/>"),
	menu: svg("<path d=\"M4 7h16M4 12h16M4 17h16\"/>"),
	close: svg("<path d=\"M6 6l12 12M18 6 6 18\"/>"),
	back: svg("<path d=\"M15 5l-7 7 7 7\"/>"),
	chevronDown: svg("<path d=\"M6 9l6 6 6-6\"/>"),
	nanite: svg("<path d=\"M13 3 4 14h7v7l9-11h-7V3Z\"/>"),
	bolt: svg("<path d=\"M11 3 5 13h5v8l7-10h-5l-1-8Z\" fill=\"currentColor\" stroke=\"none\"/>"),
	crystal: svg("<path d=\"M12 2 6 9l6 13 6-13-6-7Z\"/><path d=\"M6 9h12\"/><path d=\"M12 2v20\"/>"),
	key: svg("<circle cx=\"8\" cy=\"14\" r=\"4\"/><path d=\"M11 11l8-8\"/><path d=\"M17 5l2 2\"/><path d=\"M15 7l2 2\"/>"),
	clock: svg("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3.5 2\"/>"),
	shield: svg("<path d=\"M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z\"/>"),
	card: svg("<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M3 10h18\"/>"),
	globe: svg("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18\"/><path d=\"M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z\"/>"),
	collector: svg("<path d=\"M14.5 3.5 20 9l-2 2-1.5-1.5-6 6L8 18l-2.5.5L6 16l1.5-3.5-2-2L4 9\"/><path d=\"M9 12l3 3\"/>"),
	companion: svg("<rect x=\"4\" y=\"7\" width=\"16\" height=\"12\" rx=\"3\"/><path d=\"M12 7V4\"/><circle cx=\"9\" cy=\"13\" r=\"1.2\" fill=\"currentColor\"/><circle cx=\"15\" cy=\"13\" r=\"1.2\" fill=\"currentColor\"/><path d=\"M9.5 16.5h5\"/>"),
	crate: svg("<path d=\"M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z\"/><path d=\"M3 8.5 12 13l9-4.5\"/><path d=\"M12 13v7\"/>"),
	achievement: svg("<circle cx=\"12\" cy=\"9\" r=\"5\"/><path d=\"m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7\"/>"),
	chip: svg("<rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"2\"/><path d=\"M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4\"/>"),
	gear: svg("<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1\"/>"),
	user: svg("<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>"),
	anvil: svg("<path d=\"M3 9h7l3 3h8\"/><path d=\"M3 9v3h6\"/><path d=\"M6 12v3a3 3 0 0 0 3 3h6l2-6\"/><path d=\"M8 21h8\"/>"),
	tree: svg("<circle cx=\"12\" cy=\"5\" r=\"2.5\"/><circle cx=\"6\" cy=\"18\" r=\"2.5\"/><circle cx=\"18\" cy=\"18\" r=\"2.5\"/><path d=\"M12 7.5 6 15.5M12 7.5l6 8M8.5 18h7\"/>"),
	layers: svg("<path d=\"m12 3 9 5-9 5-9-5 9-5Z\"/><path d=\"m3 13 9 5 9-5\"/><path d=\"m3 17.5 9 5 9-5\"/>"),
	crown: svg("<path d=\"M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z\"/><path d=\"M5.5 21h13\"/>"),
	medal: svg("<circle cx=\"12\" cy=\"15\" r=\"5\"/><path d=\"m8.5 10.5-3-7.5h4l2 5M15.5 10.5l3-7.5h-4l-2 5\"/><path d=\"m12 13 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2L9.1 15l2-.3L12 13Z\"/>"),
	recycle: svg("<path d=\"M7 7h3l-2.5-2.5\"/><path d=\"M4 9a8 8 0 0 1 13.5-3\"/><path d=\"M17 17h-3l2.5 2.5\"/><path d=\"M20 15a8 8 0 0 1-13.5 3\"/>"),
	core: svg("<circle cx=\"12\" cy=\"12\" r=\"3.2\"/><circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5\"/>"),
	graph: svg("<path d=\"M4 19V5\"/><path d=\"M4 19h16\"/><path d=\"m7 15 3.5-4 3 2.5L20 7\"/>"),
	flask: svg("<path d=\"M10 3h4\"/><path d=\"M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3\"/><path d=\"M8 15h8\"/>"),
	hammer: svg("<path d=\"m14 5 5 5\"/><path d=\"m12.5 6.5 5 5\"/><path d=\"M17.5 3.5 21 7l-2 2-3.5-3.5 2-2Z\"/><path d=\"m11 8-8 8 4 4 8-8\"/>"),
	scroll: svg("<path d=\"M6 4h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"/><path d=\"M5 6a2 2 0 0 0-2 2v1h4\"/><path d=\"M9 9h7M9 13h7M9 17h4\"/>"),
	lock: svg("<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/>"),
	unlock: svg("<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 7.5-2\"/>"),
	drag: svg("<circle cx=\"9\" cy=\"6\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"6\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"18\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"18\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>"),
	arrowUp: svg("<path d=\"M12 19V5\"/><path d=\"m5 12 7-7 7 7\"/>"),
	eye: svg("<path d=\"M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/>"),
	flame: svg("<path d=\"M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c1.5 0 1-4 2-8Z\"/>"),
	snow: svg("<path d=\"M12 2v20M2 12h20\"/><path d=\"m5 5 14 14M19 5 5 19\"/>"),
	plus: svg("<path d=\"M12 5v14M5 12h14\"/>"),
	check: svg("<path d=\"m5 13 4 4 10-10\"/>"),
	trash: svg("<path d=\"M4 7h16\"/><path d=\"M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2\"/><path d=\"M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7\"/>"),
	info: svg("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5\"/><circle cx=\"12\" cy=\"8\" r=\".6\" fill=\"currentColor\"/>"),
	warning: svg("<path d=\"M12 4 2.5 20h19L12 4Z\"/><path d=\"M12 10v4\"/><circle cx=\"12\" cy=\"17\" r=\".6\" fill=\"currentColor\"/>"),
	sparkle: svg("<path d=\"M12 3v5M12 16v5M3 12h5M16 12h5\"/><path d=\"M6.5 6.5 9 9M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5\"/>"),
	sound: svg("<path d=\"M4 9v6h4l5 4V5L8 9H4Z\"/><path d=\"M16.5 8.5a5 5 0 0 1 0 7\"/><path d=\"M19 6a8.5 8.5 0 0 1 0 12\"/>"),
	music: svg("<path d=\"M9 18V6l10-2v12\"/><circle cx=\"6.5\" cy=\"18\" r=\"2.5\"/><circle cx=\"16.5\" cy=\"16\" r=\"2.5\"/>"),
	logout: svg("<path d=\"M14 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7\"/><path d=\"M17 8l4 4-4 4\"/><path d=\"M21 12H10\"/>"),
	mute: svg("<path d=\"M4 9v6h4l5 4V5L8 9H4Z\"/><path d=\"m17 10 4 4M21 10l-4 4\"/>")
};
/** Igual que `icon()`, pero acepta nombres venidos de datos y nunca falla. */
function icon(name, className = "w-4 h-4") {
	return `<span class="inline-flex ${className}">${ICONS[name]}</span>`;
}
/** Atajo para usar dentro de plantillas: `html`${ic('bolt')}`` */
function ic(name, className = "w-4 h-4") {
	return icon(name, className);
}
//#endregion
//#region src/ui/pageShell.ts
/**
* Monta el HTML de una página devolviendo el nodo vivo, y limpia los listeners
* que el anterior hubiera acumulado.
*
* Por qué hace falta: `#app` no se recrea al cambiar de vista, así que cada
* `addEventListener('click', ...)` que añadía una página se acumulaba. En la
* cuarta interacción una acción se ejecutaba cuatro veces: en la Forja, marcar
* tres piedras se alternaba tres veces y acababa en cero.
*
* La solución es meter dentro del contenedor un nodo NUEVO cada vez y tirar el
* anterior. `cloneNode` no era necesario para limpiar listeners: basta con
* crear un elemento de cero y vaciar dentro de él, porque los listeners viven
* en el nodo que se descarta.
*
* POR QUÉ NO SE SUSTITUYE EL CONTENEDOR.
*
* La versión anterior hacía `prev.replaceWith(fresh)`, es decir, cambiaba el
* propio `#app` por un clon. Eso rompía la navegación entera: `main.ts` guarda
* `const app = document.querySelector('#app')` una vez al arrancar, y después
* del primer `mountInto` esa variable apuntaba a un nodo ya desconectado del
* documento. Volver a la base escribía el HTML en un nodo invisible, y
* `app.onclick = ...` escuchaba en un nodo que ya no estaba en pantalla. El
* síntoma era "no me deja volver atrás": la barra seguía dibujada en la
* pantalla anterior, pero los botones no hacían nada porque el manejador
* estaba colgado de un nodo que nadie veía.
*
* El contenedor se respeta. Lo único que se reemplaza es el nodo interior que
* aloja la página, y ese sí se busca por atributo en cada montaje, así que
* `app.innerHTML = ''` entre render y render no lo deja desincronizado.
*/
/** Marca el nodo interior que `mountInto` va sustituyendo. */
var MOUNT_ATTR = "data-page-root";
function mountInto(container, html) {
	const prev = container.querySelector(`:scope > [${MOUNT_ATTR}]`);
	const fresh = container.ownerDocument.createElement("div");
	fresh.setAttribute(MOUNT_ATTR, "");
	fresh.className = "page-root";
	fresh.innerHTML = html;
	if (prev) prev.replaceWith(fresh);
	else container.appendChild(fresh);
	return fresh;
}
/**
* Conecta la navegación de una página: botón de volver, botón de inicio y
* cualquier elemento con `data-nav`.
*
* Se delega en el contenedor en vez de registrar un manejador por botón,
* porque los botones se recrean en cada render y un listener por botón se
* acumularía sobre nodos muertos. Un solo listener en la raíz, y la raíz se
* recrea limpia con `mountInto`.
*/
function wireNav(root, cb) {
	root.addEventListener("click", (e) => {
		const nav = e.target.closest("[data-nav]");
		if (nav) {
			e.stopPropagation();
			cb.go?.(nav.dataset.nav);
			return;
		}
		if (e.target.closest("[data-nav-back]")) {
			e.stopPropagation();
			cb.back?.();
			return;
		}
		if (e.target.closest("[data-nav-home]")) {
			e.stopPropagation();
			cb.home?.();
		}
	});
}
function pageShell(opts, body) {
	const backBtn = opts.onBack ? `<button data-nav-back
         class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0
                transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" aria-label="Volver">
         <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${ic("back")}</span>
       </button>` : "";
	const homeBtn = opts.onHome ? `<button data-nav-home
         class="hit-expand hidden lg:inline-flex w-9 h-9 rounded-lg btn-ghost items-center justify-center
                cursor-pointer flex-shrink-0 transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" title="Volver a la base" aria-label="Volver a la base">
         <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic("chip")}</span>
       </button>` : "";
	const nanites = opts.state && !opts.hideNanites ? `<span id="page-nanites"
             class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border flex-shrink-0 tabular
                    border-[var(--border-color)]"
             style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
         <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
         <span class="font-mono text-[11px] text-[var(--text-main)]" id="page-nanites-val">${formatNumber(opts.state.nanites || 0)}</span>
       </span>` : "";
	return `
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <header
        class="card-glass flex-shrink-0 flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        ${backBtn}
        ${opts.icon ? `<span class="accent-text flex-shrink-0 hidden sm:block [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(opts.icon)}</span>` : ""}
        <div class="min-w-0 flex-1">
          <h1 class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">
            ${opts.title}
          </h1>
          ${opts.subtitle ? `<p class="text-[10px] md:text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5 hidden sm:block">${opts.subtitle}</p>` : ""}
        </div>
        ${nanites}
        ${opts.actions ? `<div class="flex items-center gap-1.5 flex-shrink-0">${opts.actions}</div>` : ""}
        ${homeBtn}
      </header>

      <main class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                  px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain
                  -webkit-overflow-scrolling:touch ${opts.bodyClass || ""}"
           style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        ${body}
      </main>
    </div>
  `;
}
/** Sección con título y contador opcional. */
function sectionHead(title, iconName, right = "") {
	return `
    <div class="flex items-center justify-between gap-2 mb-2.5">
      <h2 class="label-caps flex items-center gap-1.5">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(iconName)}</span>
        ${title}
      </h2>
      ${right}
    </div>
  `;
}
//#endregion
//#region src/utils/modal.ts
function showConfirmModal(message, onConfirm, options = {}) {
	const { sublabel, confirmText = "Confirmar", cancelText = "Cancelar", danger = false } = options;
	document.querySelector("#confirm-modal-overlay")?.remove();
	const overlay = document.createElement("div");
	overlay.id = "confirm-modal-overlay";
	overlay.className = "fixed inset-0 z-[80] flex items-center justify-center p-4";
	overlay.style.cssText = "background: rgb(0 0 0 / 0.62); backdrop-filter: blur(6px);";
	overlay.style.animation = "riseIn 220ms ease both";
	const modal = document.createElement("div");
	modal.className = "card-glass-elevated rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4";
	modal.setAttribute("role", "dialog");
	modal.setAttribute("aria-modal", "true");
	const content = document.createElement("div");
	content.className = "flex flex-col gap-1.5 text-center";
	if (sublabel) {
		const sub = document.createElement("span");
		sub.className = "label-caps";
		sub.style.color = danger ? "#f87171" : "var(--accent)";
		sub.textContent = sublabel;
		content.appendChild(sub);
	}
	const messageEl = document.createElement("p");
	messageEl.className = "text-[13px] font-sans leading-relaxed text-[var(--text-main)]";
	messageEl.textContent = message;
	content.appendChild(messageEl);
	modal.appendChild(content);
	const buttonContainer = document.createElement("div");
	buttonContainer.className = "flex gap-2.5";
	const mkBtn = (label, primary) => {
		const b = document.createElement("button");
		b.className = primary ? "flex-1 h-11 rounded-xl font-['Orbitron'] font-bold text-[11px] cursor-pointer transition active:scale-[0.98]" : "flex-1 h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer transition active:scale-[0.98]";
		b.textContent = label;
		if (primary) {
			if (danger) b.style.cssText = "background: linear-gradient(to bottom, #ef4444, #dc2626); color: #fff;box-shadow: 0 6px 18px -6px rgb(239 68 68 / 0.7);";
			else b.classList.add("btn-primary");
		}
		return b;
	};
	const cancelBtn = mkBtn(cancelText, false);
	const confirmBtn = mkBtn(confirmText, true);
	const close = () => {
		overlay.remove();
		document.removeEventListener("keydown", handleEscape);
	};
	cancelBtn.addEventListener("click", close);
	confirmBtn.addEventListener("click", () => {
		close();
		onConfirm();
	});
	buttonContainer.appendChild(cancelBtn);
	buttonContainer.appendChild(confirmBtn);
	modal.appendChild(buttonContainer);
	overlay.appendChild(modal);
	document.body.appendChild(overlay);
	const handleEscape = (e) => {
		if (e.key === "Escape") close();
	};
	document.addEventListener("keydown", handleEscape);
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});
	confirmBtn.focus();
}
//#endregion
//#region src/utils/audio.ts
var ctx = null;
var sfxBus = null;
var musicBus = null;
var compressor = null;
/** Nivel de referencia de cada bus. El ajuste fino se hace sobre el bus. */
var SFX_LEVEL = .5;
var MUSIC_LEVEL = .16;
var sfxEnabled = localStorage.getItem("cyberforge_sfx") !== "0";
var musicEnabled = localStorage.getItem("cyberforge_music") !== "0";
function ensureContext() {
	if (ctx) {
		if (ctx.state === "suspended") ctx.resume().catch(() => {});
		return ctx;
	}
	try {
		const Ctor = window.AudioContext || window.webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
		ctx.setMaxLatency?.(.05);
		compressor = ctx.createDynamicsCompressor();
		compressor.threshold.value = -14;
		compressor.knee.value = 22;
		compressor.ratio.value = 5;
		compressor.attack.value = .004;
		compressor.release.value = .2;
		compressor.connect(ctx.destination);
		sfxBus = ctx.createGain();
		sfxBus.gain.value = sfxEnabled ? SFX_LEVEL : 0;
		sfxBus.connect(compressor);
		musicBus = ctx.createGain();
		musicBus.gain.value = musicEnabled ? MUSIC_LEVEL : 0;
		musicBus.connect(compressor);
		return ctx;
	} catch {
		return null;
	}
}
/** Un tono con envolvente ADSR corta. Se desconecta sola al terminar. */
function blip(freq, duration, type = "sine", volume = 1, delay = 0) {
	if (!sfxEnabled) return;
	const audio = ensureContext();
	if (!audio || !sfxBus) return;
	const t0 = audio.currentTime + delay;
	const osc = audio.createOscillator();
	const gain = audio.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	gain.gain.setValueAtTime(1e-4, t0);
	gain.gain.exponentialRampToValueAtTime(Math.max(2e-4, volume), t0 + .006);
	gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
	osc.connect(gain);
	gain.connect(sfxBus);
	osc.start(t0);
	osc.stop(t0 + duration + .02);
	osc.onended = () => {
		osc.disconnect();
		gain.disconnect();
	};
}
var sfx = {
	click: (streak = 0) => {
		const base = 620 * Math.pow(1.022, Math.min(streak, 22));
		blip(base, .055, "square", .42);
		blip(base * 2, .03, "sine", .16);
	},
	buy: () => {
		blip(523.25, .09, "triangle", .6);
		blip(783.99, .12, "triangle", .5, .075);
	},
	error: () => {
		blip(174.61, .14, "sawtooth", .35);
		blip(155.56, .16, "sawtooth", .3, .05);
	},
	use: () => {
		blip(880, .08, "sine", .55);
		blip(1318.5, .1, "sine", .4, .05);
	},
	equip: () => {
		blip(392, .07, "square", .4);
		blip(587.33, .1, "square", .35, .05);
	},
	tick: (progress = 0) => blip(1500 - progress * 500, .022, "square", .22 * (1 - progress * .6)),
	spinStart: () => {
		blip(196, .3, "sawtooth", .3);
		blip(293.66, .34, "triangle", .22, .1);
	},
	reward: (rare) => {
		const base = rare ? 523.25 : 392;
		blip(base, .18, "triangle", .65);
		blip(base * 1.26, .18, "triangle", .55, .085);
		blip(base * 1.5, .3, "triangle", .5, .17);
		if (rare) blip(base * 2, .42, "sine", .35, .26);
	},
	jackpot: () => {
		[
			523.25,
			659.25,
			783.99,
			1046.5,
			1318.5
		].forEach((n, i) => blip(n, .4, "triangle", .62 - i * .05, i * .075));
		blip(1567.98, .6, "sine", .3, .38);
	},
	achievement: () => {
		[
			659.25,
			830.61,
			987.77
		].forEach((n, i) => blip(n, .3, "sine", .5, i * .07));
	},
	levelUp: () => {
		[
			392,
			523.25,
			659.25,
			784
		].forEach((n, i) => blip(n, .28, "triangle", .5, i * .06));
	},
	nodeBuy: () => {
		blip(1046.5, .06, "square", .4);
		blip(1396.91, .1, "square", .32, .055);
	},
	prestige: () => {
		blip(880, .5, "sawtooth", .4);
		blip(440, .6, "sine", .35, .12);
		[
			261.63,
			392,
			523.25
		].forEach((n, i) => blip(n, .5, "triangle", .42, .24 + i * .08));
		blip(1046.5, .7, "sine", .25, .5);
	},
	hammer: () => {
		blip(110, .22, "square", .55);
		blip(82.41, .26, "sine", .4, .02);
	},
	forgeSuccess: () => {
		[
			329.63,
			415.3,
			493.88,
			659.25
		].forEach((n, i) => blip(n, .45, "triangle", .55, i * .07));
		blip(1318.5, .55, "sine", .3, .3);
	},
	forgeFail: () => {
		blip(146.83, .2, "sawtooth", .4);
		blip(110, .3, "sawtooth", .35, .14);
	},
	forgeTick: (progress = 0) => blip(900 - progress * 420, .03, "square", .2 * (1 - progress * .55)),
	nav: () => blip(660, .035, "sine", .22),
	place: () => blip(320, .045, "square", .16),
	pick: () => blip(480, .035, "sine", .14)
};
//#endregion
//#region src/components/crateRoulette.ts
var TILE_W = 96;
var TILE_W_MOBILE = 78;
var SPIN_MS = 4200;
/**
* Cómo se llama la unidad de cada botín, para el rótulo bajo la cifra.
*
* Vive aquí y no en la tabla porque solo la ruleta lo necesita, pero tiene que
* ser el MISMO diccionario para todos: si las nanitas se anunciaran como
* "Nanitas" en un sitio y como "Monedas" en otro, el jugador leería dos juegos
* distintos en la misma pantalla.
*/
var LOOT_UNITS = {
	nanites: "Nanitas",
	crystals: "Cristales",
	keys: "Llaves",
	crate: "Cajas",
	consumable: "Unidades"
};
function tileHtml(t, width) {
	return `
    <div class="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl
                border ${rarityClass(t.rarity)} card-glass"
         style="width:${width}px;height:${width + 24}px">
      <span class="[&>span>svg]:w-6 [&>span>svg]:h-6 ${RARITY_TEXT[t.rarity] || ""} leading-none">${ic(t.icon)}</span>
      <span class="text-[9px] font-mono text-center leading-tight px-1 line-clamp-2 w-full ${RARITY_TEXT[t.rarity] || ""}">${t.label}</span>
      ${t.amount ? `<span class="text-[10px] font-mono font-bold leading-none ${RARITY_TEXT[t.rarity] || ""}">${t.amount}</span>` : ""}
      <span class="text-[9px] font-mono uppercase tracking-wider ${RARITY_TEXT[t.rarity] || ""} opacity-70">${t.sub}</span>
    </div>
  `;
}
/**
* Muestra la ruleta y al terminar el cartel del objeto.
* `onClose` se llama cuando el jugador acepta el premio.
*/
function showCrateRoulette(reward, crateType, onClose) {
	const tileW = window.innerWidth < 640 ? TILE_W_MOBILE : TILE_W;
	const stripLen = 26;
	const winIndex = 20;
	const { tiles } = buildRouletteStrip(crateType, stripLen);
	tiles[winIndex] = makeRouletteTile(reward);
	const meta = CRATE_META[crateType];
	const rarityColor = rarityClass(reward.rarity);
	const rarityGlow = RARITY_GLOW[reward.rarity] || "";
	const isJackpot = (RARITY_RANK[reward.rarity] ?? 0) >= 4;
	const alreadyStored = Boolean(reward.item);
	const showAmount = isCountedLoot(reward);
	const unit = LOOT_UNITS[reward.kind] ?? "";
	const nameIsUnit = unit !== "" && reward.name.trim().toLowerCase() === unit.toLowerCase();
	const overlay = document.createElement("div");
	overlay.className = "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto";
	overlay.innerHTML = `
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${ic(meta.icon)}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">${meta.name.toUpperCase()}</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">DESBLOQUEANDO CARGA…</p>
    </div>

    <div class="relative w-full max-w-2xl select-none flex-shrink-0">
      <!-- Ventana de la ruleta con mask -->
      <div class="relative overflow-hidden rounded-2xl border py-4"
           style="border-color: var(--border-color); background: color-mix(in srgb, var(--bg-app) 70%, transparent)">
        <div id="roulette-track" class="flex gap-2 px-1 will-change-transform">
          ${tiles.map((t) => tileHtml(t, tileW)).join("")}
        </div>
        <!-- Máscara de degradados en los extremos -->
        <div class="pointer-events-none absolute inset-y-0 left-0 w-16" style="background: linear-gradient(to right, var(--bg-app), transparent)"></div>
        <div class="pointer-events-none absolute inset-y-0 right-0 w-16" style="background: linear-gradient(to left, var(--bg-app), transparent)"></div>
        <!-- Marcador central -->
        <div class="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px]" style="background: var(--accent); box-shadow: 0 0 14px var(--accent)"></div>
        <div class="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--accent)"></div>
      </div>
    </div>

    <div id="roulette-result" class="opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2">
      <div id="result-card" class="card-glass-elevated border ${rarityColor} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 ${rarityGlow} max-w-sm text-center">
        <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${RARITY_TEXT[reward.rarity] || ""}">${ic(reward.icon)}</div>
        ${showAmount ? `
        <div class="font-['Orbitron'] font-black text-3xl leading-none tabular-nums ${RARITY_TEXT[reward.rarity] || ""}">
          ${lootAmountText(reward)}
        </div>
        <div class="text-[9px] font-mono uppercase tracking-[0.2em] -mt-1" style="color: var(--text-muted)">${unit}</div>` : ""}
        ${nameIsUnit ? "" : `<div class="font-['Orbitron'] font-bold text-base ${RARITY_TEXT[reward.rarity] || ""}">${reward.name}</div>`}
        <div class="text-[11px] font-mono uppercase tracking-wider ${RARITY_TEXT[reward.rarity] || ""} opacity-80">${reward.rarity}${reward.exclusive ? " · EXCLUSIVO" : ""}</div>
        <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${reward.details}</div>
        ${alreadyStored ? `<div class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">✓ Guardado en el almacén</div>` : ""}
      </div>
      <button id="roulette-close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
        CONTINUAR
      </button>
    </div>
  `;
	document.body.appendChild(overlay);
	const track = overlay.querySelector("#roulette-track");
	const resultBox = overlay.querySelector("#roulette-result");
	const step = tileW + 8;
	const targetX = -(winIndex * step + tileW / 2 - track.parentElement.clientWidth / 2);
	sfx.spinStart();
	track.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
	track.style.transform = `translate3d(${targetX}px,0,0)`;
	const totalMs = SPIN_MS;
	const totalSteps = Math.max(1, Math.floor(Math.abs(targetX) / step));
	const tickEvery = Math.max(28, Math.floor(totalMs / totalSteps));
	for (let t = tickEvery; t < totalMs; t += tickEvery) setTimeout(() => sfx.tick(), t);
	const finished = { value: false };
	const onTransitionEnd = (e) => {
		if (e.propertyName !== "transform" || finished.value) return;
		finished.value = true;
		showResult();
	};
	track.addEventListener("transitionend", onTransitionEnd);
	setTimeout(() => {
		if (!finished.value) {
			finished.value = true;
			showResult();
		}
	}, 4550);
	function showResult() {
		const winEl = track.children[winIndex];
		if (winEl) {
			winEl.classList.add("scale-110", "z-10");
			winEl.style.transition = "transform 220ms ease-out, box-shadow 220ms";
			winEl.style.boxShadow = "0 0 28px var(--accent)";
		}
		if (isJackpot) sfx.jackpot();
		else sfx.reward((RARITY_RANK[reward.rarity] ?? 0) >= 2);
		resultBox.classList.remove("opacity-0");
		resultBox.classList.add("opacity-100");
	}
	const closeBtn = overlay.querySelector("#roulette-close");
	const finish = () => {
		document.removeEventListener("keydown", onKey);
		overlay.remove();
		onClose();
	};
	closeBtn?.addEventListener("click", finish);
	const onKey = (e) => {
		if (e.key === "Escape" && finished.value) finish();
	};
	document.addEventListener("keydown", onKey);
}
//#endregion
//#region src/components/crystalPicker.ts
/**
* Abre el selector de cristal para sintonizar el recolector equipado.
*
* Se llama desde la hoja de detalle, con el recolector ya equipado. La lista
* sale del almacén real, así que solo ofrece lo que el jugador tiene.
*/
function showCrystalPicker(game, redraw) {
	const state = game.getState();
	const equipo = state.warehouse.find((w) => w.id === state.equippedCollectorId);
	if (!equipo) {
		showToast("Equipa un recolector primero.", "info");
		return;
	}
	if (equipo.level >= 35) {
		showToast("El recolector ya está al nivel máximo.", "info");
		return;
	}
	const disponibles = (state.warehouse || []).filter((w) => w.type === "crystal").sort((a, b) => (b.tier || 1) - (a.tier || 1));
	if (disponibles.length === 0) {
		showToast("No tienes cristales de mejora.", "error");
		return;
	}
	const overlay = document.createElement("div");
	overlay.className = "fixed inset-0 z-[70] flex items-end justify-center pointer-events-none";
	overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="relative card-glass-elevated w-full max-w-md rounded-t-2xl pointer-events-auto p-4
                max-h-[80dvh] overflow-y-auto overscroll-contain animate-rise-in"
         style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic("crystal")}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${equipo.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${equipo.level || 0} · coste ${crystalCost(equipo.level || 0)} x cristal
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic("close")}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${disponibles.map((k, i) => {
		const def = CRYSTAL_DEFS[typeof k.tier === "number" ? k.tier : 1];
		const unidades = k.stackCount || 1;
		const coste = crystalCost(equipo.level || 0);
		const alcanza = unidades >= coste;
		const prob = previewUpgradeChance(equipo.level || 0, def?.power ?? 1);
		return `
            <button data-crystal="${k.id}" data-idx="${i}" ${alcanza ? "" : "disabled style=\"opacity:.45\""}
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                           ${alcanza ? "cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]" : ""}
                           border-[var(--border-color)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${rarityClass(k.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic("crystal")}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${k.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] mt-0.5">
                  ${def?.power ?? 1}x · ${prob}% de éxito
                </span>
              </span>
              <span class="text-right flex-shrink-0">
                <span class="block text-[11px] font-mono accent-text tabular">×${unidades}</span>
                <span class="block text-[9px] font-mono ${alcanza ? "text-[var(--text-muted)]" : "text-rose-400"}">
                  ${alcanza ? `-${coste}` : "faltan"}
                </span>
              </span>
            </button>`;
	}).join("")}
      </div>
    </div>
  `;
	const cerrar = () => overlay.remove();
	overlay.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", cerrar));
	overlay.querySelectorAll("[data-crystal]:not([disabled])").forEach((b) => {
		b.addEventListener("click", () => {
			const idx = Number(b.dataset.idx);
			cerrar();
			sfx.use();
			const res = game.upgradeEquippedCollector(disponibles[idx].tier || 1);
			if (!res.ok) {
				sfx.error();
				showToast(res.msg || "No se pudo sintonizar.", "error");
			} else showToast(res.msg, "success");
			redraw();
		});
	});
	document.body.appendChild(overlay);
}
/**
* Coste en unidades de cristal para subir del nivel dado.
*
* Delega en el game loop, no lo recalcula. La fórmula del coste tiene que estar
* en un solo sitio: con dos copias, cambiar el coste en el juego dejaba el
* selector enseñando la cifra vieja.
*/
function crystalCost(level) {
	return previewUpgradeCost(level);
}
//#endregion
//#region src/components/warehouse.ts
var TYPE_ICON = {
	collector: "collector",
	companion: "companion",
	crate: "crate",
	key: "key",
	crystal: "crystal",
	consumable: "flask"
};
var TYPE_LABEL = {
	collector: "Recolector",
	companion: "Compañero",
	crate: "Caja",
	key: "Llave",
	crystal: "Cristal de Mejora",
	consumable: "Consumible"
};
var ui = {
	selectedId: null,
	filter: "all",
	sort: "default",
	sheetOpen: false
};
function renderWarehouseTab(container, game, onBack, onStateChange, onHome, go) {
	draw(container, game, onBack, onStateChange, onHome, go);
}
function draw(container, game, onBack, onStateChange, onHome, go) {
	const state = game.getState();
	const warehouse = state.warehouse || [];
	const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;
	const occupied = countOccupiedSlots(warehouse);
	const celdas = visibleStacks(game, state);
	if (ui.selectedId && !warehouse.some((w) => w.id === ui.selectedId)) {
		ui.selectedId = null;
		ui.sheetOpen = false;
	}
	const selected = ui.selectedId ? warehouse.find((w) => w.id === ui.selectedId) : null;
	const cell = (g, i) => {
		const w = g.item;
		const isSel = w.id === ui.selectedId;
		const isEquipped = esEquipado(w, state);
		const count = g.count;
		return `
      <button class="inv-cell ${isSel ? "is-selected" : ""} ${count > 0 ? "is-stackable" : ""}"
              data-cell="${i}" data-id="${w.id}" data-count="${count}"
              style="${isEquipped ? "border-color:#fbbf24; box-shadow: inset 0 0 0 1px #fbbf24;" : ""}"
              aria-label="${w.name}">
        <span class="ring-${raritySlug(w.rarity)} w-8 h-8 rounded-lg grid place-items-center
                     ${rarityClass(w.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">
          ${ic(TYPE_ICON[w.type] ?? "crate")}
        </span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full px-0.5">
          ${w.name}
        </span>
        <span class="text-[9px] font-mono ${isEquipped ? "text-amber-400" : "text-[var(--text-muted)]"}">
          ${w.tier ? `T${w.tier}` : w.rarity ?? ""}
          ${w.potential ? ` ${"★".repeat(w.potential)}` : ""}
        </span>
        ${isEquipped ? `<span class="absolute bottom-0.5 left-1 text-[9px] font-mono text-amber-400">EQ</span>` : ""}
      </button>
    `;
	};
	/**
	* Una celda de capacidad libre.
	*
	* `data-cell` es el índice de celda, que aquí es "más allá de la última", y
	* `data-painted` es la posición REAL en la rejilla, con los huecos ya
	* intercalados. Las dos cosas se necesitan y no son la misma: soltar en una
	* celda vacía tiene que poner el item en la posición que el jugador señaló, y
	* esa posición solo la sabe el índice pintado. Antes, con un hueco por celda,
	* bastaba con "al final" y no hacia falta nada mas.
	*/
	const emptyCell = (celda, pintado) => `
    <div class="inv-cell opacity-25" data-cell="${celda}" data-painted="${pintado}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic("plus")}</span>
    </div>
  `;
	/**
	* Un hueco que ha dejado el jugador a propósito.
	*
	* Se ve igual que la capacidad libre a propósito: para el jugador es la misma
	* cosa —"aquí no hay nada y puedo soltar"—, y distinguirlo por el estilo
	* convertiría una diferencia que no le importa en un concepto más que
	* recordar. Lo que sí cambia es el marcado: un hueco lleva `data-gap` con el
	* id del item al que precede y NO lleva `data-cell`.
	*
	* POR QUÉ NO LLEVA `data-cell`. `data-cell` es el índice dentro de `celdas`, y
	* se usa para traducir lo que el jugador señala a un item. Un hueco no
	* representa ningún item, así que no puede llevar ese índice. Si lo llevara,
	* `closest('[data-cell]')` lo encontraría como si fuera una celda real y el
	* arrastre traduciría la señalada a un item que no existe —que es exactamente
	* el desfase de una celda que ya se corrigió una vez, caminos distintos por el
	* mismo error de concepto: confundir "posición pintada" con "celda del
	* almacén".
	*/
	const gapCell = (anclaId) => `
    <div class="inv-cell opacity-25" data-gap="${anclaId}" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${ic("plus")}</span>
    </div>
  `;
	const gaps = visibleGaps(game, state);
	const totalCells = totalCeldasPintadas(celdas.length, capacity);
	const cells = [];
	let pintados = 0;
	for (let i = 0; i < celdas.length; i++) {
		const cuantas = gaps.get(celdas[i].item.id) ?? 0;
		for (let h = 0; h < cuantas; h++) {
			cells.push(gapCell(celdas[i].item.id));
			pintados++;
		}
		cells.push(cell(celdas[i], i));
		pintados++;
	}
	for (let n = 0; pintados < totalCells; n++, pintados++) cells.push(emptyCell(celdas.length + n, pintados));
	const body = `
    <!--
      Dos columnas a partir de lg. Antes el panel de detalle era un overlay
      fixed que en escritorio se convertia en un hijo mas del contenedor en
      columna: caia DEBAJO de la rejilla, pegado a la esquina inferior
      derecha y flotando sobre el vacio. Ahora es una columna de verdad.
    -->
    <div class="flex flex-col lg:flex-row lg:gap-4 lg:items-start">

      <div class="min-w-0 flex-1">
        ${sectionHead("Almacén", "warehouse", `
          <div class="flex items-center gap-2.5">
            <!--
              El contador de nanitas vive aquí y no en la cabecera de la página.
              En el almacén la decisión es siempre local —vender, ampliar, usar
              una llave— y el número que la acompaña queda en la misma línea que
              las ranuras, no en una esquina a la que hay que llegar con la
              vista. Arriba quedaba demasiado lejos de donde se decide.
            -->
            <span id="wh-nanites"
                  class="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border tabular flex-shrink-0
                         border-[var(--border-color)]"
                  style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
              <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
              <span class="font-mono text-[11px] text-[var(--text-main)]" id="wh-nanites-val">${formatNumber(state.nanites || 0)}</span>
            </span>
            <span class="text-[10px] font-mono tabular ${occupied >= capacity ? "text-rose-400" : "text-[var(--text-muted)]"}">
              ${occupied}/${capacity} ranuras
            </span>
          </div>
        `)}

        <div class="flex flex-wrap items-center gap-1.5 mb-3">
          ${[
		{
			id: "all",
			label: "Todo"
		},
		{
			id: "collector",
			label: "Recolectores"
		},
		{
			id: "companion",
			label: "Compañeros"
		},
		{
			id: "otros",
			label: "Otros"
		}
	].map((f) => `
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition
                           ${ui.filter === f.id ? "accent-bg text-slate-950 font-bold" : "btn-ghost text-[var(--text-muted)]"}"
                    data-filter="${f.id}">${f.label}</button>
          `).join("")}
          <select id="wh-sort" aria-label="Ordenar"
            class="ml-auto h-10 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
            <option value="default" ${ui.sort === "default" ? "selected" : ""}>Mi orden</option>
            <option value="value" ${ui.sort === "value" ? "selected" : ""}>Mayor valor</option>
            <option value="rarity" ${ui.sort === "rarity" ? "selected" : ""}>Rareza</option>
            <option value="tier" ${ui.sort === "tier" ? "selected" : ""}>Tier</option>
            <option value="name" ${ui.sort === "name" ? "selected" : ""}>Nombre</option>
          </select>
        </div>

        <div class="inv-grid mb-2" id="inv-grid">${cells.join("")}</div>

        <p class="text-[9px] text-[var(--text-muted)] text-center leading-relaxed mt-3">
          Arrastra una celda sobre otra para reordenar. Toca para ver detalles.
        </p>
      </div>

      <aside class="hidden lg:block w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-2">
        ${selected ? detailPanel(selected, state, game) : `<div class="card-glass border rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
               <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-9 [&>span>svg]:h-9">${ic("eye")}</span>
               <span class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                 Selecciona un item de la rejilla para ver su descripcion
               </span>
             </div>`}
      </aside>
    </div>

    ${selected ? detailSheet(selected, state, game) : ""}
  `;
	const root = mountInto(container, pageShell({
		title: "Almacén",
		subtitle: "Arrastra para reordenar · toca para inspeccionar",
		icon: "warehouse",
		onBack,
		onHome,
		state,
		hideNanites: true
	}, body));
	wireNav(root, {
		back: onBack,
		home: onHome,
		go
	});
	wire(root, game, onBack, onStateChange, onHome, go);
}
/** Hoja de detalle. En móvil va abajo con arrastre de salida; en escritorio, arriba. */
function detailSheet(item, state, game) {
	return `
    <div class="fixed inset-0 z-[60] lg:hidden flex items-end justify-center pointer-events-none">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-act="close"></div>
      <div class="relative card-glass-elevated w-full rounded-t-2xl pointer-events-auto
                  p-4 max-h-[78dvh] overflow-y-auto overscroll-contain animate-rise-in"
           style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
        ${detailContent(item, state, game)}
      </div>
    </div>
  `;
}
/** Panel de detalle fijo en la columna derecha, solo en escritorio. */
function detailPanel(item, state, game) {
	return `
    <div class="card-glass border rounded-2xl p-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
      ${detailContent(item, state, game)}
    </div>
  `;
}
/**
* Contenido del detalle, compartido por la hoja móvil y el panel de escritorio.
*
* Antes eran dos plantillas casi idénticas que se desincronizaron: el botón de
* cerrar solo existía en una, y el panel de escritorio no tenía forma de
* cerrarse. Un solo origen para el contenido hace que eso no vuelva a pasar.
*/
function detailContent(item, state, game) {
	const isCollector = item.type === "collector";
	const isCompanion = item.type === "companion";
	const isEquipped = esEquipado(item, state);
	const sellPrice = game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0;
	const maxStack = MAX_STACK[item.type] ?? 1;
	const aquitienehueco = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []).includes(item.id);
	const maxLevel = item.maxLevel ?? 20;
	const affixList = (item.affixes || []).map((id) => {
		const a = AFFIX_BY_ID[id];
		if (!a) return "";
		return `<li class="text-[10px] flex items-start gap-1.5">
      <span class="${rarityClass(a.rarity)} flex-shrink-0 mt-[3px]">◆</span>
      <span><span class="${rarityClass(a.rarity)}">${a.name}</span>
      <span class="text-[var(--text-muted)]"> — ${a.description}</span></span>
    </li>`;
	}).join("");
	const valuation = isCollector ? valuationBreakdown(item) : [];
	return `
        <div class="flex items-start gap-2.5 mb-3">
          <span class="ring-${raritySlug(item.rarity)} w-11 h-11 rounded-xl grid place-items-center
                       flex-shrink-0 ${rarityClass(item.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">
            ${ic(TYPE_ICON[item.type] ?? "crate")}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate leading-tight">
              ${item.name}
            </h3>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="text-[10px] font-mono ${rarityClass(item.rarity)}">${item.rarity}</span>
              ${item.tier ? `<span class="text-[10px] font-mono text-[var(--text-muted)]">T${item.tier}</span>` : ""}
              <span class="text-[10px] font-mono text-[var(--text-muted)]">${TYPE_LABEL[item.type] ?? "Objeto"}</span>
              ${item.potential ? `<span class="text-[10px] text-amber-400">${"★".repeat(item.potential)}</span>` : ""}
            </div>
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-act="close" title="Cerrar detalle" aria-label="Cerrar detalle">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic("close")}</span>
          </button>
        </div>

        <!-- Autoría: lo que hace único al objeto -->
        ${item.forgedBy ? `
          <div class="rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center gap-1.5"
               style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-3 h-3">${ic("anvil")}</span>
            <span class="text-[10px] font-mono text-[var(--text-main)] truncate">
              Forjada por <span class="accent-text">${item.forgedBy}</span>
            </span>
          </div>
        ` : ""}

        <p class="text-[11px] text-[var(--text-main)] leading-relaxed mb-2.5">
          ${item.details || "Sin descripción"}
        </p>

        ${item.stackable ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Cantidad</div>
            <div class="flex items-baseline gap-1.5">
              <span class="font-['Orbitron'] font-bold text-base accent-text tabular">${item.stackCount || 1}</span>
              <span class="text-[10px] font-mono text-[var(--text-muted)]">/ ${maxStack}</span>
            </div>
          </div>
        ` : ""}

        ${isCollector && (item.level ?? 0) > 0 ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Nivel ${item.level} / ${maxLevel}</div>
            <div class="meter is-tall"><span style="width:${item.level / maxLevel * 100}%"></span></div>
          </div>
        ` : ""}

        ${affixList ? `
          <div class="mb-2.5">
            <div class="label-caps mb-1">Afijos heredados</div>
            <ul class="space-y-1">${affixList}</ul>
          </div>
        ` : ""}

        ${valuation.length ? `
          <details class="mb-2.5">
            <summary class="label-caps cursor-pointer select-none">Valoración</summary>
            <ul class="mt-1.5 space-y-0.5">
              ${valuation.map((v) => `<li class="text-[10px] font-mono text-[var(--text-muted)]">${v}</li>`).join("")}
            </ul>
          </details>
        ` : ""}

        <div class="flex flex-col gap-1.5 mt-3">
          ${isCollector || isCompanion ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="equip">
              ${isEquipped ? "Desequipar" : "Equipar"}
            </button>
          ` : ""}

          ${item.type === "crate" ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="open">
              ${llavesQueSirven(state, item).length > 0 ? "Abrir caja" : "Falta la llave"}
            </button>
          ` : ""}

          ${item.type === "crystal" ? `
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="nada" title="Los cristales se gastan desde la Sintonización del recolector">
              Se usa en Sintonización
            </button>
          ` : ""}

          ${item.type === "consumable" ? `
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="use">Usar</button>
          ` : ""}

          ${isCollector ? `
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade" ${isEquipped ? "" : "disabled style=\"opacity:.4\""}
                    title="${isEquipped ? "" : "Equípala primero"}">
              Mejorar con cristales
            </button>
          ` : ""}

          <button class="w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px] cursor-pointer
                         border border-amber-500/30 text-amber-400"
                  style="background: color-mix(in srgb, #f59e0b 12%, transparent)"
                  data-act="sell" ${isEquipped ? "disabled style=\"opacity:.4\"" : ""}>
            Vender · ${formatNumber(sellPrice)} ◆
          </button>

          <!--
            El UNICO gesto que crea un hueco.

            Por que existe y por que es un boton: un hueco solo puede aparecer ENTRE
            dos items, y una lista empaquetada no tiene ninguna posicion libre entre
            dos items: toda celda vacia esta detras de la ultima. Asi que arrastrar
            nunca puede dejar un hueco en medio, solo rellenar uno que ya exista. Sin
            este boton el primer hueco es imposible de crear y la funcion entera
            no se podria alcanzar.

            Y esta en la ficha del item y no en la rejilla porque "dejar un hueco
            AQUI" es una frase sobre un item, y un boton en la rejilla seria una
            segunda cosa que acertar en una celda pequena.
          -->
          <button class="w-full h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer
                         border border-dashed ${aquitienehueco ? "accent-border" : ""}"
                  data-act="${aquitienehueco ? "quitarhueco" : "dejarhueco"}"
                  style="${aquitienehueco ? "background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent);" : ""}">
            ${aquitienehueco ? "Quitar el hueco de aquí" : "Dejar un hueco aquí"}
          </button>
        </div>

        ${isEquipped ? `<p class="text-[9px] text-amber-400 text-center mt-2">Desequípalo para venderlo o mejorarlo.</p>` : ""}
  `;
}
/** Los tipos cuyos items se acumulan en una sola celda. Ver `data/stacking`. */
/**
* Si un item está equipado, leyendo el estado y no su bandera.
*
* Antes se leía `w.equipped`, que es una COPIA que el game loop mantiene
* junto a `equippedCollectorId`. Son la misma información en dos sitios y nada
* los emparejaba en caliente: `equipCollector` decide por la bandera, así que
* si un guardado viejo traía la bandera puesta y el id vacío, la rejilla
* pintaba "Desequipar" sobre un recolector que nadie tenía puesto —y pulsar
* ese botón se llevaba por delante el equipado de verdad, porque el toggle
* borraba `equippedCollectorId` sin mirar cuál era.
*
* El id manda porque es lo que lee el cálculo de daño. La bandera es su
* proyección, y como dato de solo lectura para el guardado.
*/
function esEquipado(w, state) {
	if (w.type === "collector") return state.equippedCollectorId === w.id;
	if (w.type === "companion") return state.activeCompanions.includes(w.id);
	return false;
}
/**
* Los manejadores van sobre `root`, el nodo interior que `mountInto` recrea en
* cada repintado, y NUNCA sobre `container`.
*
* `container` es `#app` y sobrevive a todos los renders. Un
* `container.addEventListener('click', ...)` en cada `draw()` deja el anterior
* vivo, y el mismo clic llega N veces. Aquí N era el número de repintados
* desde que se entró al almacén, así que equipar y desequipar se ejecutaban
* tantas veces como listeners hubiera: como el toggle es su propia inversa,
* con un número par el estado acababa igual que estaba y el jugador pulsaba
* "Desequipar" sin que pasara nada. Con un número impar sí cambiaba. De ahí
* el "a veces funciona y a veces no".
*
* Los botones de filtro y el `select` de orden sí se consultan por atributo
* sobre `root`: viven en nodos nuevos, así que no acumulan, y por cada uno hay
* un solo elemento.
*/
function wire(root, game, onBack, onStateChange, onHome, go) {
	const container = root.parentElement;
	const redraw = () => draw(container, game, onBack, onStateChange, onHome, go);
	root.querySelectorAll("[data-filter]").forEach((btn) => {
		btn.addEventListener("click", () => {
			sfx.nav();
			ui.filter = btn.dataset.filter;
			redraw();
		});
	});
	root.querySelector("#wh-sort")?.addEventListener("change", (e) => {
		ui.sort = e.target.value;
		redraw();
	});
	const grid = root.querySelector("#inv-grid");
	if (grid) setupDragAndDrop(grid, game, redraw);
	root.addEventListener("click", (e) => {
		const btn = e.target.closest("[data-act]");
		if (!btn) return;
		const act = btn.dataset.act;
		const item = ui.selectedId ? game.getState().warehouse.find((w) => w.id === ui.selectedId) : null;
		switch (act) {
			case "close":
				sfx.pick();
				ui.selectedId = null;
				redraw();
				break;
			case "equip":
				if (!item) return;
				sfx.equip();
				if (item.type === "collector") game.equipCollector(item.id);
				else if (item.type === "companion") {
					if (!game.equipCompanion(item.id)) showToast("No hay slots de compañero libres.", "error");
				}
				redraw();
				onStateChange?.();
				break;
			case "open":
				if (!item) return;
				openCrate(game, item, redraw);
				break;
			case "use":
				if (!item) return;
				useConsumable(game, item, redraw);
				break;
			case "upgrade":
				if (!item) return;
				if (item.id !== game.getState().equippedCollectorId) {
					showToast("Equipa el recolector primero.", "info");
					return;
				}
				showCrystalPicker(game, redraw);
				break;
			case "nada": return;
			case "dejarhueco":
				if (!item) return;
				alternaHueco(game, item.id, true);
				sfx.pick();
				ui.sort = "default";
				redraw();
				break;
			case "quitarhueco":
				if (!item) return;
				alternaHueco(game, item.id, false);
				sfx.pick();
				redraw();
				break;
			case "sell":
				if (!item) return;
				sellItem(game, item, redraw);
		}
	});
}
/**
* Pone o quita el hueco que va justo delante de `itemId`.
*
* La lista de huecos se lee, se toca un elemento y se devuelve ENTERA. Es
* deliberado: quien sabe qué hueco se está moviendo es la vista, que es la que
* ve la rejilla, y el juego no tiene por qué saber reinterpretar un "quita este y
* pon aquel" como si fuera suyo decidir cuál se borra.
*/
function alternaHueco(game, itemId, dejar) {
	const actuales = game.getWarehouseGaps?.() ?? [];
	const siguiente = dejar ? [...actuales, itemId] : actuales.filter((id) => id !== itemId);
	game.setWarehouseGaps?.(siguiente);
}
function setupDragAndDrop(grid, game, redraw) {
	let dragId = null;
	let fromIndex = -1;
	let ghost = null;
	let activePointer = null;
	let startX = 0;
	let startY = 0;
	const THRESHOLD = 8;
	const cleanupGhost = () => {
		ghost?.remove();
		ghost = null;
	};
	grid.addEventListener("pointerdown", (e) => {
		const cell = e.target.closest("[data-cell]");
		if (!cell || e.target.closest("select, button[data-act]")) return;
		if (activePointer !== null) return;
		const id = cell.dataset.id;
		if (!id) return;
		activePointer = e.pointerId;
		dragId = id;
		fromIndex = Number(cell.dataset.cell);
		startX = e.clientX;
		startY = e.clientY;
		cell.dataset.pendingDrag = "1";
	});
	grid.addEventListener("pointermove", (e) => {
		if (activePointer !== e.pointerId || !dragId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!ghost && Math.hypot(dx, dy) < THRESHOLD) return;
		const cell = grid.querySelector(`[data-cell="${fromIndex}"]`);
		if (!cell) return;
		if (!ghost) {
			sfx.pick();
			cell.classList.add("is-dragging");
			delete cell.dataset.pendingDrag;
			ghost = document.createElement("div");
			ghost.className = "drag-ghost";
			ghost.style.background = "color-mix(in srgb, var(--bg-app) 88%, transparent)";
			ghost.style.border = "1px solid var(--accent)";
			ghost.innerHTML = cell.innerHTML;
			document.body.appendChild(ghost);
			cell.setPointerCapture?.(e.pointerId);
		}
		e.preventDefault();
		ghost.style.left = `${e.clientX}px`;
		ghost.style.top = `${e.clientY}px`;
		const over = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell],[data-gap]") ?? null;
		grid.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
		if (over && over.dataset.cell !== String(fromIndex) && over.dataset.gap === void 0) over.classList.add("is-over");
	});
	const finish = (e) => {
		if (activePointer !== e.pointerId) return;
		activePointer = null;
		const wasDragging = !!ghost;
		cleanupGhost();
		grid.querySelectorAll(".is-over, .is-dragging").forEach((el) => el.classList.remove("is-over", "is-dragging"));
		if (!dragId) return;
		const draggedId = dragId;
		dragId = null;
		const src = fromIndex;
		fromIndex = -1;
		if (!wasDragging) {
			sfx.pick();
			ui.selectedId = ui.selectedId === draggedId ? null : draggedId;
			redraw();
			return;
		}
		const under = document.elementFromPoint(e.clientX, e.clientY);
		const hueco = under?.closest("[data-gap]") ?? null;
		const target = under?.closest("[data-cell]") ?? null;
		if (hueco?.dataset.gap) {
			if (moveIntoGap(game, draggedId, hueco.dataset.gap, ui.filter, ui.sort)) {
				sfx.place();
				ui.sort = "default";
			} else showToast("Ese hueco ya está donde toca.", "info");
		} else if (target?.dataset.empty) {
			if (moveToFreeCell(game, draggedId, target.dataset.painted !== void 0 ? Number(target.dataset.painted) : Number(target.dataset.cell), ui.filter, ui.sort)) {
				sfx.place();
				ui.sort = "default";
			} else showToast("Ya está en la última posición: no hay más sitio libre detrás.", "info");
		} else {
			const dst = target ? Number(target.dataset.cell) : -1;
			if (dst >= 0 && dst !== src) {
				const antes = (game.getState().warehouse || []).map((w) => w.id).join(",");
				if (moveItem(game, draggedId, dst)) {
					if ((game.getState().warehouse || []).map((w) => w.id).join(",") === antes) showToast("Ya estaba en ese sitio.", "info");
					else {
						sfx.place();
						ui.sort = "default";
					}
				}
			}
		}
		redraw();
	};
	grid.addEventListener("pointerup", finish);
	grid.addEventListener("pointercancel", (e) => {
		cleanupGhost();
		grid.querySelectorAll(".is-over, .is-dragging").forEach((el) => el.classList.remove("is-over", "is-dragging"));
		if (activePointer === e.pointerId) activePointer = null;
		dragId = null;
		fromIndex = -1;
	});
	grid.addEventListener("click", (e) => e.stopPropagation());
}
/**
* Los grupos de items en el mismo orden en que los pinta la rejilla.
*
* Devuelve una entrada por celda: el item que representa la celda y la lista de
* ids que hay detrás. Se agrupan los apilables igual que en el pintado, así que
* una celda con 20 tarjetas sigue siendo una celda y sigue teniendo 20 items
* detrás.
*
* `item` es el que se pinta, `count` el número de la esquina y `ids` todos los
* items que hay detrás de la celda. Los tres van juntos porque son tres vistas
* del MISMO grupo: el pintado necesita el representative y el contador, y el
* arrastre necesita la lista entera, porque arrastrar una celda arrastra la
* pila completa y no uno de los items que hay dentro.
*/
function visibleStacks(game, state) {
	return visibleStacksFor(game, state, ui.filter, ui.sort);
}
/**
* Las celdas de la rejilla para un filtro y un orden concretos.
*
* Es `visibleStacks` sin el estado de pantalla. La versión que leía `ui.filter` y
* `ui.sort` no se podía comprobar sin montar la pantalla entera, y el agrupado de
* pilas es justo lo que hay que verificar: de él dependen a la vez lo que se pinta
* y los índices que el arrastre usa como destino, así que un error ahí mueve el
* item a un sitio distinto del que el jugador señaló.
*/
function visibleStacksFor(game, state, filtro, sort) {
	let items = (state.warehouse || []).filter((w) => matchesFilter(w, filtro));
	if (sort === "name") items = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
	else if (sort === "rarity") items = [...items].sort((a, b) => (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0));
	else if (sort === "tier") items = [...items].sort((a, b) => (b.tier || 0) - (a.tier || 0));
	else if (sort === "value") {
		const precio = (w) => game.getSellPrice?.(w.id) ?? w.sellPrice ?? 0;
		items = [...items].sort((a, b) => precio(b) - precio(a));
	}
	const grupos = [];
	const celdaDe = /* @__PURE__ */ new Map();
	for (const w of items) {
		if (isStackable(w)) {
			const clave = `${w.type}_${w.name}`;
			const tope = MAX_STACK[w.type] ?? 20;
			const previa = celdaDe.get(clave);
			if (previa !== void 0) {
				grupos[previa].ids.push(w.id);
				grupos[previa].count = Math.min(grupos[previa].count + (w.stackCount || 1), tope);
				continue;
			}
			celdaDe.set(clave, grupos.length);
			grupos.push({
				item: w,
				ids: [w.id],
				count: Math.min(w.stackCount || 1, tope)
			});
			continue;
		}
		grupos.push({
			item: w,
			ids: [w.id],
			count: 0
		});
	}
	return grupos;
}
/**
* Cuántas celdas tiene el tablero.
*
* El jugador ve estas celdas y puede soltar en CUALQUIERA, ocupada o no. Es un
* tablero de verdad, no una lista: por eso una celda vacía es un sitio libre
* válido y no un adorno. El mínimo de 12 es para que una mochila recién estrenada
* no salga con tres celdas y un resto de sitio invisible, y el múltiplo de tres
* es para que las filas cierren en la rejilla.
*
* Vive en una función y no en línea porque el arrastre necesita el MISMO número.
* Si el pintado y el destino calcularan distinto, un item podría acabar
* empujado fuera de la rejilla y desaparecer de la vista sin que se hubiera
* vendido: lo peor que puede pasarle a un inventario.
*/
function totalCeldasPintadas(celdas, capacity) {
	return Math.max(celdas, Math.min(capacity, Math.max(12, Math.ceil(capacity / 3) * 3)));
}
/**
* Los huecos que se pintan en la rejilla ahora mismo.
*
* Un hueco guardado es un id de item, y solo se pinta si la vista es la del
* jugador —sin filtro y con su orden—, porque un hueco describe una disposición
* concreta. Con un filtro activo, la celda que ocupa un item es otra, y el hueco
* caería en medio de una disposición que el jugador no ha elegido nunca.
*
* También se filtra por "el item existe": un hueco anclado a algo que ya no está
* no se pinta, y esconderlo es preferible a romper el arrastre. El juego limpia
* los que sobran, pero la vista no confía en que lo haya hecho.
*/
function visibleGaps(game, state) {
	const porItem = /* @__PURE__ */ new Map();
	if (ui.filter !== "all" || ui.sort !== "default") return porItem;
	const ids = game.getWarehouseGaps?.() ?? state.warehouseGaps ?? [];
	const vivos = new Set((state.warehouse || []).map((w) => w.id));
	for (const id of ids) {
		if (!vivos.has(id)) continue;
		porItem.set(id, (porItem.get(id) ?? 0) + 1);
	}
	return porItem;
}
/**
* Solta el grupo de `draggedId` dentro del hueco que precede a `gapBeforeId`.
*
* Es un INTERCAMBIO, no una inserción: el item entra en el hueco y el hueco se
* queda donde estaba el item. Es lo que hace que arrastrar a un hueco tenga
* sentido —si solo rellenara el hueco, el item desapareciería de donde estaba y
* el almacén se compactaría hacia arriba, que es justo lo contrario de lo que se
* acaba de pedir— y es la razón de que el número de huecos no cambie al
* arrastrar.
*
* Se deja justo delante de su ancla, asi que si el grupo ya estaba ahi no hay
* movimiento posible: el gesto no significa nada y se rechaza con un motivo,
* para que el jugador no se quede pensando que el arrastre se ha roto.
*/
function moveIntoGap(game, draggedId, gapBeforeId, filtro, sort) {
	const state = game.getState();
	const celdas = visibleStacksFor(game, state, filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const grupo = celdas[origen];
	if (grupo.ids.includes(gapBeforeId)) return false;
	if (celdas.findIndex((c) => c.ids.includes(gapBeforeId)) === origen + 1) return false;
	if (!game.moveItems(grupo.ids, gapBeforeId, "antes")) return false;
	const siguiente = celdas[origen + 1];
	const huecos = (game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []).filter((id) => id !== gapBeforeId);
	if (siguiente) huecos.push(siguiente.item.id);
	game.setWarehouseGaps?.(huecos);
	return true;
}
/**
* Suelta el grupo de `draggedId` en la celda VACIA `dstPainted`, que es la
* posicion PINTADA que el jugador senalo -con los huecos ya intercalados, no el
* indice de celda.
*
* LA REGLA, tal y como la entiende el jugador: **mientras queden celdas vacias,
* cualquier objeto se puede mover a cualquiera de ellas.** Tambien el ultimo, que
* es el caso que antes se rechazaba con "no hay mas sitio libre detras": hay
* sitio, lo que no habia era forma de representarlo.
*
* COMO SE REPRESENTA. El array sigue siendo una lista empaquetada, asi que el
* item solo tiene un sitio: el final. Para que se VEA en la celda 5 hay que poner
* celdas de hueco por delante que lo empujen hasta ahi, y por eso un hueco puede
* ocupar varias celdas seguidas.
*
* DONDE VAN LOS HUECOS: todos en el item que se mueve, y ninguno en los demas.
* Es lo que hace que los otros items se queden donde estaban. Repartirlos desde
* la izquierda -que es lo que habia antes- metia huecos en medio de un almacen
* lleno y desplazaba cosas que el jugador no habia tocado: al soltar un item en
* una celda vacia se movian tres mas.
*
* CUANTOS. Con `K` celdas, `E` celdas de hueco ya puestas delante del item y `H`
* nuevas, su posicion pintada es `(K - 1) + E + H`. Para que caiga en
* `dstPainted`: `H = dstPainted - (K - 1) - E`. El tope es `2K - 1` posiciones,
* porque no puede haber mas celdas de hueco que celdas ocupadas: cada hueco
* necesita un item al que anclarse. Mas alla de ese tope se recorta en vez de
* inventar una posicion.
*/
function moveToFreeCell(game, draggedId, dstPainted, filtro, sort) {
	const state = game.getState();
	const celdas = visibleStacksFor(game, state, filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const capacity = game.getCapacity?.() ?? state.warehouseCapacity ?? 15;
	const K = celdas.length;
	if (!K) return false;
	const yaPuestos = /* @__PURE__ */ new Map();
	for (const id of game.getWarehouseGaps?.() ?? state.warehouseGaps ?? []) yaPuestos.set(id, (yaPuestos.get(id) ?? 0) + 1);
	const totalPuestos = [...yaPuestos.values()].reduce((a, b) => a + b, 0);
	const grupo = celdas[origen];
	const hayQueMover = origen !== K - 1;
	if (hayQueMover && !game.moveItems(grupo.ids, null, "despues")) return false;
	const delante = celdas.filter((_, i) => i !== origen).reduce((sum, c) => sum + (yaPuestos.get(c.item.id) ?? 0), 0);
	const wanted = Math.max(0, dstPainted - (K - 1) - delante);
	const caben = Math.max(0, totalCeldasPintadas(K, capacity) - K - totalPuestos);
	const H = Math.min(wanted, caben);
	if (!hayQueMover && H === 0) return false;
	const salida = [];
	for (const c of celdas) {
		if (c.ids.includes(draggedId)) {
			salida.push(...Array(H).fill(c.item.id));
			continue;
		}
		salida.push(...Array(yaPuestos.get(c.item.id) ?? 0).fill(c.item.id));
	}
	game.setWarehouseGaps?.(salida);
	return true;
}
/**
* Lleva el grupo que ocupa la celda de `draggedId` a la celda `dstViewIndex`.
*
* El destino se traduce a un ANCLA —el item que tiene que quedar detrás— y se
* deja que el juego la busque por id DESPUÉS de quitar el grupo. No se traduce
* a un índice del array porque la cuenta de celdas que hay detrás cambia en
* cuanto se quita el grupo arrastrado: por eso, con una pila en medio, soltar
* sobre una celda ocupada dejaba el item una celda más a la derecha de donde se
* había soltado, y soltar sobre un hueco del final no movía nada, porque todos
* los huecos se recortaban a la última celda ocupada, que era justo la celda de
* origen.
*/
function moveItem(game, draggedId, dstViewIndex) {
	return moveItemTo(game, draggedId, dstViewIndex, ui.filter, ui.sort);
}
/**
* El mismo traslado, con el filtro y el orden como parámetros en vez de leídos
* del estado de pantalla. La rejilla que el jugador está viendo y la que usa el
* arrastre tienen que ser LA MISMA: si divergen, el número de celda que señala no
* es el sitio que se mueve. Se puede comprobar sin DOM, que es lo que hace este
* banco de pruebas.
*/
function moveItemTo(game, draggedId, dstViewIndex, filtro, sort) {
	if (dstViewIndex < 0) return false;
	const celdas = visibleStacksFor(game, game.getState(), filtro, sort);
	const origen = celdas.findIndex((c) => c.ids.includes(draggedId));
	if (origen < 0) return false;
	const grupo = celdas[origen];
	if (dstViewIndex === origen) return false;
	const destino = dstViewIndex >= celdas.length ? null : celdas[dstViewIndex];
	if (destino && grupo.ids.includes(destino.ids[0])) return false;
	const irDespues = dstViewIndex > origen;
	const ancla = destino ? irDespues ? destino.ids[destino.ids.length - 1] : destino.ids[0] : null;
	return game.moveItems(grupo.ids, ancla, irDespues ? "despues" : "antes");
}
/** ¿El item pasa el filtro activo de la rejilla? */
function matchesFilter(w, filtro) {
	if (filtro === "all") return true;
	if (filtro === "otros") return !["collector", "companion"].includes(w.type);
	return w.type === filtro;
}
/**
* Abre una caja.
*
* La llave la elige el jugador de las que tiene, y solo se ofrecen las que
* sirven para ese cofre. El filtro no es una comodidad: es lo que comunica que
* hay cuatro tipos de llave y que cada cofre pide el suyo.
*/
function openCrate(game, item, redraw) {
	const crateType = inferCrateType(item.name);
	const llaves = llavesQueSirven(game.getState(), item);
	if (llaves.length === 0) {
		const necesaria = KEY_DEFS[CRATE_KEY_TIER[crateType]];
		showToast(`Necesitas ${necesaria?.name ?? "una llave"} para abrir ${item.name}.`, "info");
		return;
	}
	const conUnidad = (k) => k.stackCount || 1;
	const total = llaves.reduce((a, k) => a + conUnidad(k), 0);
	if (llaves.length === 1) {
		confirmarYabrir(game, item, crateType, llaves[0], redraw);
		return;
	}
	showKeyPicker(llaves, total, (elegida) => {
		confirmarYabrir(game, item, crateType, elegida, redraw);
	});
}
function confirmarYabrir(game, item, crateType, llave, redraw) {
	showConfirmModal(`Se gastará <b>${llave.name}</b> y la caja. El botín ya está decidido: la ruleta solo lo enseña.`, () => {
		const res = game.openCrateBox(item.id, llave.id);
		if (!res.ok) {
			sfx.error();
			showToast(res.msg || "No se pudo abrir la caja.", "error");
			return;
		}
		ui.selectedId = null;
		showCrateRoulette(res.reward, res.crateType ?? crateType, redraw);
	}, {
		sublabel: item.name,
		confirmText: "Abrir"
	});
}
/** Selector de llave. Solo aparece cuando hay más de una opción válida. */
function showKeyPicker(llaves, total, onPick) {
	const overlay = document.createElement("div");
	overlay.className = "fixed inset-0 z-[70] flex items-end justify-center pointer-events-none";
	overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="relative card-glass-elevated w-full max-w-md rounded-t-2xl pointer-events-auto p-4
                max-h-[80dvh] overflow-y-auto overscroll-contain animate-rise-in"
         style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic("key")}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
            ¿Con qué llave?
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            ${llaves.length} tipos disponibles · ${total} llaves en total
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic("close")}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${llaves.map((k, i) => {
		const def = KEY_DEFS[typeof k.tier === "number" ? k.tier : keyTierFromName(k.name || "")];
		return `
            <button data-key="${k.id}" data-idx="${i}"
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer
                           transition active:scale-[0.99] border-[var(--border-color)] hover:border-[var(--accent)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${rarityClass(k.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic("key")}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${k.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] truncate mt-0.5">${k.details || def?.details || ""}</span>
              </span>
              <span class="text-[11px] font-mono accent-text tabular flex-shrink-0">×${k.stackCount || 1}</span>
            </button>`;
	}).join("")}
      </div>
    </div>
  `;
	const cerrar = () => {
		overlay.remove();
	};
	overlay.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", cerrar));
	overlay.querySelectorAll("[data-key]").forEach((b) => {
		b.addEventListener("click", () => {
			sfx.pick();
			const idx = Number(b.dataset.idx);
			cerrar();
			onPick(llaves[idx]);
		});
	});
	document.body.appendChild(overlay);
}
/**
* Las llaves del almacén que sirven para abrir este cofre.
*
* Vive aquí y no en el game loop porque es una lectura: el juego solo necesita
* saber si hay alguna y cuál es, y el selector de llave es cosa de la vista.
*/
function llavesQueSirven(state, caja) {
	const crateType = inferCrateType(caja.name);
	return (state.warehouse || []).filter((w) => w.type === "key" && keyNameOpensCrate(w.name || "", crateType)).sort((a, b) => {
		return (typeof a.tier === "number" ? a.tier : keyTierFromName(a.name || "")) - (typeof b.tier === "number" ? b.tier : keyTierFromName(b.name || ""));
	});
}
function inferCrateType(name) {
	const l = name.toLowerCase();
	if (l.includes("común")) return "common";
	if (l.includes("rara")) return "rare";
	if (l.includes("épica")) return "epic";
	return "legendary";
}
/** Aplica un consumible. Toda la lógica vive en el game loop. */
function useConsumable(game, item, redraw) {
	showConfirmModal(item.details || "Aplicar el efecto de este consumible.", () => {
		const res = game.useConsumable(item.id);
		if (!res.ok) {
			sfx.error();
			showToast(res.msg || "No se pudo usar.", "error");
			return;
		}
		sfx.use();
		ui.selectedId = null;
		showToast(res.msg || `${item.name}: aplicado`, "success");
		redraw();
	}, {
		sublabel: item.name,
		confirmText: "Usar"
	});
}
/** Vende un item. El precio y el borrado los decide el game loop. */
function sellItem(game, item, redraw) {
	const qty = item.stackable ? item.stackCount || 1 : 1;
	const total = (game.getSellPrice?.(item.id) ?? item.sellPrice ?? 0) * qty;
	showConfirmModal(`Vendes ${item.name}${qty > 1 ? ` ×${qty}` : ""} por ${formatNumber(total)} nanitas.`, () => {
		const res = game.sellItem(item.id);
		if (!res.ok) {
			sfx.error();
			showToast(res.msg || "No se pudo vender.", "error");
			return;
		}
		sfx.buy();
		showToast(`Vendido por ${formatNumber(res.gained ?? total)} ◆`, "success");
		ui.selectedId = null;
		redraw();
	}, {
		sublabel: "Vender",
		confirmText: `+${formatNumber(total)} ◆`
	});
}
//#endregion
//#region verify/reproStack.ts
var USER = {
	uid: "test",
	displayName: "P"
};
var DB = "users/test";
var collector = (id, name, tier) => ({
	id,
	name,
	type: "collector",
	details: "+20",
	rarity: "Común",
	tier,
	level: 1,
	damage: 20,
	sellPrice: 250
});
var key = (i) => ({
	id: `k${i}`,
	name: "Llave de Cifrado",
	type: "key",
	details: "x",
	rarity: "Común",
	tier: 0,
	sellPrice: 480,
	stackable: true,
	stackCount: 1
});
var llaves = Array.from({ length: 19 }, (_, i) => key(i));
globalThis.__MEM_DB__ = { [DB]: {
	saveVersion: 7,
	nanites: 34400,
	totalNanitesProduced: 34400,
	warehouse: [
		collector("r1", "Dron Explorador", 1),
		collector("r2", "Blaster Láser", 1),
		...llaves
	],
	crates: {
		common: 0,
		rare: 0,
		epic: 0,
		legendary: 0
	},
	keys: 19,
	keysByTier: {
		0: 19,
		1: 0,
		2: 0,
		3: 0
	},
	crystalsByTier: {},
	upgradeCrystals: 0,
	afkCards: 0,
	companions: [],
	activeCompanions: [],
	equippedCollectorId: null,
	warehouseCapacity: 21,
	maxCompanionSlots: 3,
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
	unlockedAchievements: []
} };
var g = await createGameLoop(USER, () => {});
var st = g.getState();
var container = contenedor();
renderWarehouseTab(container, g, () => {}, () => {}, () => {}, () => {});
var html = container.children[0]?.innerHTML ?? "";
var contador = html.match(/(\d+)\/(\d+) ranuras/);
var celdasPintadas = (html.match(/class="inv-cell /g) ?? []).length;
var celdaLlaves = /data-id="(k\d+)" data-count="(\d+)"/.exec(html);
var unidades = st.warehouse.filter((w) => w.type === "key").reduce((a, w) => a + (w.stackCount ?? 1), 0);
console.log("\n================ LO QUE VE EL JUGADOR ================");
console.log("  contador de ranuras .......", contador ? `${contador[1]}/${contador[2]}` : "NO ENCONTRADO");
console.log("  celdas pintadas ............", celdasPintadas, "(3 ocupadas + huecos hasta la capacidad)");
console.log("  celda de las llaves ........", celdaLlaves ? `id=${celdaLlaves[1]} insignia="${celdaLlaves[2]}"` : "NO ENCONTRADA");
console.log("\n================ LO QUE HAY DEBAJO ================");
console.log("  entradas en el array .......", st.warehouse.length, "<-- lo que contaba el contador antes");
console.log("  items de llave .............", st.warehouse.filter((w) => w.type === "key").length);
console.log("  unidades de llave ..........", unidades, "(contador del juego:", st.keys, ")");
console.log("  ranuras (countOccupiedSlots)", countOccupiedSlots(st.warehouse));
console.log("=====================================================\n");
var ok = contador?.[1] === "3" && celdaLlaves?.[2] === "19" && unidades === 19 && st.keys === 19 && st.warehouse.filter((w) => w.type === "key").length === 1;
console.log(ok ? "OK  la pila de 19 llaves cuenta como 1 ranura, dice 19 en la insignia y no se pierde ninguna unidad" : "FALLO");
console.log("\n================ BOTIN CON EL ALMACEN LLENO ================");
{
	globalThis.__MEM_DB__[DB].warehouse = [
		collector("r1", "Dron Explorador", 1),
		collector("r2", "Blaster Láser", 1),
		{
			id: "k0",
			name: "Llave de Cifrado",
			type: "key",
			details: "x",
			rarity: "Común",
			tier: 0,
			sellPrice: 480,
			stackable: true,
			stackCount: 60
		},
		{
			id: "c1",
			name: "Caja Común",
			type: "crate",
			details: "x",
			rarity: "Común",
			tier: 0,
			sellPrice: 125,
			stackable: true,
			stackCount: 60
		}
	];
	globalThis.__MEM_DB__[DB].keys = 60;
	globalThis.__MEM_DB__[DB].keysByTier = {
		0: 60,
		1: 0,
		2: 0,
		3: 0
	};
	globalThis.__MEM_DB__[DB].crates = {
		common: 60,
		rare: 0,
		epic: 0,
		legendary: 0
	};
	globalThis.__MEM_DB__[DB].warehouseCapacity = 4;
	const g2 = await createGameLoop(USER, () => {});
	console.log("  antes: ranuras =", countOccupiedSlots(g2.getState().warehouse), "/", g2.getCapacity(), " (lleno)");
	let abiertas = 0;
	let perdidas = 0;
	for (let i = 0; i < 40; i++) {
		const id = g2.getState().warehouse.find((w) => w.type === "key")?.id;
		if (g2.openCrateBox("c1", id).ok) abiertas++;
		else perdidas++;
	}
	const st2 = g2.getState();
	const llaves2 = st2.warehouse.filter((w) => w.type === "key");
	const usadas = st2.warehouse.reduce((a, w) => a + (w.stackCount ?? 1), 0);
	console.log("  aperturas correctas .......", abiertas, perdidas ? `(+${perdidas} rechazadas)` : "");
	console.log("  pilas de llave .............", llaves2.length);
	console.log("  unidades de llave ..........", llaves2.reduce((a, w) => a + (w.stackCount ?? 1), 0));
	console.log("  unidades de caja ...........", st2.warehouse.filter((w) => w.type === "crate").reduce((a, w) => a + (w.stackCount ?? 1), 0), `(-${60 - usadas} gastadas)`);
	console.log("  ranuras ocupadas ...........", countOccupiedSlots(st2.warehouse), "/", g2.getCapacity());
	console.log("  desbordado .................", countOccupiedSlots(st2.warehouse) > g2.getCapacity() ? "SI" : "no");
	const ok2 = abiertas === 40 && llaves2.length === 1 && countOccupiedSlots(st2.warehouse) <= g2.getCapacity();
	console.log(ok2 ? "\nOK  40 cajas seguidos con el almacen lleno: el botin se apila y no se desborda" : "\nFALLO");
	if (!ok2) process.exitCode = 1;
	console.log("\n================ CON UNA RANURA LIBRE ================");
	{
		globalThis.__MEM_DB__[DB].warehouse = [
			collector("r1", "Dron Explorador", 1),
			{
				id: "k0",
				name: "Llave de Cifrado",
				type: "key",
				details: "x",
				rarity: "Común",
				tier: 0,
				sellPrice: 480,
				stackable: true,
				stackCount: 60
			},
			{
				id: "c1",
				name: "Caja Común",
				type: "crate",
				details: "x",
				rarity: "Común",
				tier: 0,
				sellPrice: 125,
				stackable: true,
				stackCount: 60
			}
		];
		globalThis.__MEM_DB__[DB].keys = 60;
		globalThis.__MEM_DB__[DB].keysByTier = {
			0: 60,
			1: 0,
			2: 0,
			3: 0
		};
		globalThis.__MEM_DB__[DB].crystalsByTier = {};
		globalThis.__MEM_DB__[DB].upgradeCrystals = 0;
		globalThis.__MEM_DB__[DB].crates = {
			common: 60,
			rare: 0,
			epic: 0,
			legendary: 0
		};
		globalThis.__MEM_DB__[DB].warehouseCapacity = 4;
		const g3 = await createGameLoop(USER, () => {});
		const origWarn = console.warn;
		const avisos = [];
		console.warn = (m) => {
			avisos.push(m);
		};
		for (let i = 0; i < 40; i++) {
			const id = g3.getState().warehouse.find((w) => w.type === "key")?.id;
			g3.openCrateBox("c1", id);
		}
		console.warn = origWarn;
		const st3 = g3.getState();
		const cristales = st3.warehouse.filter((w) => w.type === "crystal");
		const lostas = avisos.filter((a) => /crystal/.test(a)).reduce((a, s) => a + parseInt(s.match(/se pierden (\d+)/)?.[1] ?? "0"), 0);
		console.log("  capacidad .................", g3.getCapacity());
		console.log("  ranuras ocupadas ..........", countOccupiedSlots(st3.warehouse));
		console.log("  pilas de cristal ..........", cristales.length, "con", cristales.reduce((a, w) => a + (w.stackCount ?? 1), 0), "unidades");
		console.log("  cristales perdidos ........", lostas, "(solo hasta abrir la pila)");
		console.log("  desbordado .................", countOccupiedSlots(st3.warehouse) > g3.getCapacity() ? "SI" : "no");
		const ok3 = cristales.length <= 1 && countOccupiedSlots(st3.warehouse) <= g3.getCapacity();
		console.log(ok3 ? "\nOK  los cristales caben en una sola pila en cuanto hay ranura para abrirla" : "\nFALLO");
		if (!ok3) process.exitCode = 1;
	}
}
process.exit(ok ? 0 : 1);
//#endregion
