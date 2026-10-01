import { d as collectorUpgradeCost } from "./gameLoop-DA2943Xb.js";
import { S as resumen, a as check, c as conRoll, d as crystal, h as find, n as baseSave, o as collector, r as boot, x as reload } from "./kit-By6xxhWQ.js";
import { t as tuningRoll } from "./tuningRoulette-BK0PqpT9.js";
//#region src/components/rouletteSpin.ts
/**
* La curva del frenado: `cubic-bezier(0.425, 0.85, 0.775, 1)`.
*
* No es un `ease-out` elegido a ojo. Es el ajuste de la parábola `d = 2t - t²`,
* que es el modelo de una rueda a la que se le quita la energía poco a poco:
* velocidad constante al principio y deceleración constante hasta pararse. El
* error medio del ajuste es de 0.0004, o sea que es indistinguible de la física
* que imita.
*
* Y esto decide lo que el jugador siente. Con la curva anterior
* (`0.16, 1, 0.3, 1`) el 90% del camino se recorría en el primer 25% del
* tiempo, y los tres segundos que quedaban eran un arrastre sin salida: el ojo
* abandona la tirada mucho antes de que termine y el final se lee como "esto
* que dura tanto no está pasando nada". Frenar por física deja el último
* segundo lleno de casillas lentas, que es la anticipación.
*
* El array es de cuatro números para poder interpolarlo tal cual en el
* `cubic-bezier()` de la transición CSS. Que sea la MISMA curva en CSS y en
* los chasquidos es la razón de ser de `instante()`.
*/
var FRENADO = [
	.425,
	.85,
	.775,
	1
];
/**
* Iteraciones de bisección para invertir la curva.
*
* 32 bastan de sobra: cada una parte el intervalo a la mitad, así que 32
* dejan un error de 2^-32. Con 24 ya era invisible y cuesta lo mismo.
*/
var ITERACIONES = 32;
function coordenadaX(t, x1, x2) {
	const mt = 1 - t;
	return 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
}
function coordenadaY(t, y1, y2) {
	const mt = 1 - t;
	return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
}
/**
* Cuánto se ha recorrido cuando ha pasado `p` del tiempo, de 0 a 1.
*
* La x y la y de una `cubic-bezier` no comparten fórmula, así que para pedir el
* recorrido hay que encontrar primero el `t` cuya x es `p`. Se busca por
* bisección y no con la fórmula cerrada de Newton porque en estos puntos de
* control la x siempre crece: la bisección no puede fallar y son treinta
* multiplicaciones, que a esta escala es nada.
*/
function avance(p) {
	if (p <= 0) return 0;
	if (p >= 1) return 1;
	const [x1, y1, x2, y2] = FRENADO;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < ITERACIONES; i++) {
		const t = (lo + hi) / 2;
		if (coordenadaX(t, x1, x2) < p) lo = t;
		else hi = t;
	}
	return coordenadaY((lo + hi) / 2, y1, y2);
}
/**
* El revés de `avance()`: qué instante del giro toca para haber recorrido `f`
* del camino, de 0 a 1.
*
* Es lo que permite chasquear en el instante exacto en que una casilla
* atraviesa el marcador. La alternativa descartada es repartir los chasquidos
* por el tiempo (`setTimeout` cada `duracion / casillas`), que es lo que había
* y lo que hacía que el sonido no cuadrase con lo que se veía: en el frenado un
* intervalo constante suena a metrónomo, y además el primer tramo, que es
* donde la cinta vuela, se quedaba sin un solo chasquido.
*/
function instante(f) {
	if (f <= 0) return 0;
	if (f >= 1) return 1;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < ITERACIONES; i++) {
		const p = (lo + hi) / 2;
		if (avance(p) < f) lo = p;
		else hi = p;
	}
	return (lo + hi) / 2;
}
/**
* Reparte las casillas del giro y dice hasta dónde tiene que ir la pista.
*
* POR QUÉ LAS VUELTAS SE CUENTAN EN VENTANAS Y NO EN CASILLAS FIJAS. La
* ventana visible mide `max-w-2xl` en escritorio y el ancho de la pantalla en
* móvil, así que en el móvil caben cuatro casillas y en el escritorio seis. Un
* número de vueltas constante en casillas daría en el móvil un trompo corto y
* en el escritorio uno largo; contando ventanas visibles el trompo dura lo
* mismo en los dos, que es lo que el jugador percibe como normal.
*
* POR QUÉ LA CASILLA GANADORA VA AL FINAL DE LA VUELTA. Viaja
* `(vueltas * visibles) + visibles` casillas: tres vueltas enteras más la
* última, para que el trompo no pare en un sitio distinto cada vez y para que
* al frenar quede cinta por delante de la aguja. Sin eso la cinta se acaba antes
* de tiempo y el premio se para en el aire, o se ve el borde vacío de la cinta
* debajo del marcador.
*
* `viaje` va en positivo y quien mueve la pista le pone el signo: el
* desplazamiento y la aritmética de la línea se leen mejor así.
*/
function geometria(opts) {
	const { ventanaPx, pasoPx, casillaPx } = opts;
	const vueltas = opts.vueltas ?? 3;
	const visibles = Math.max(3, Math.floor(ventanaPx / pasoPx));
	const winIndex = vueltas * visibles + visibles;
	return {
		visibles,
		winIndex,
		casillas: winIndex + visibles + 1,
		viaje: winIndex * pasoPx + casillaPx / 2 - ventanaPx / 2
	};
}
/**
* Los instantes, en milisegundos, en que una frontera de casilla pasa por el
* marcador. Uno por chasquido.
*
* La cuenta sale de la geometría y no de un reparto: la frontera de la casilla
* `j` está bajo la aguja cuando la pista se ha desplazado
* `j * pasoPx - ventanaPx / 2`, así que los chasquidos caen en las fronteras y
* no en un paso por casilla medido a ojo.
*
* El último cruce se deja fuera a propósito (`d < viaje`): en el final el
* chasquido sonaría encima del sonido del premio, que es un acorde, y se
* pisarían.
*/
function crucesDeCasilla(opts) {
	const { viajePx, pasoPx, ventanaPx, duracionMs } = opts;
	if (viajePx <= 0 || pasoPx <= 0 || duracionMs <= 0) return [];
	const primera = Math.ceil(ventanaPx / 2 / pasoPx);
	const ultima = Math.floor((viajePx + ventanaPx / 2) / pasoPx);
	const cruces = [];
	for (let j = primera; j <= ultima; j++) {
		const d = j * pasoPx - ventanaPx / 2;
		if (d <= 0 || d >= viajePx) continue;
		cruces.push(Math.round(instante(d / viajePx) * duracionMs));
	}
	return cruces;
}
//#endregion
//#region verify/rouletteCheck.ts
/** Ventanas reales: el movil de 390 px y el escritorio de 1440 px. */
var MOVIL = 358;
var ESCRITORIO = 672;
var CASILLA_MOVIL = 78;
var CASILLA_ESCRITORIO = 96;
/** Las dos geometrias del juego, tal y como las monta `rouletteStrip`. */
function geometrias() {
	return [{
		nombre: "movil",
		ventana: MOVIL,
		casilla: CASILLA_MOVIL,
		paso: 86
	}, {
		nombre: "escritorio",
		ventana: ESCRITORIO,
		casilla: CASILLA_ESCRITORIO,
		paso: 104
	}];
}
/** El trompo de las cajas: 5200 ms, el valor de `crateRoulette.ts`. */
var DURACION = 5200;
async function main() {
	{
		check("curva: los extremos son exactos", avance(0) === 0 && avance(1) === 1, `avance(0)=${avance(0)} avance(1)=${avance(1)}`);
		let saltos = 0;
		let anterior = -1;
		for (let i = 0; i <= 200; i++) {
			const y = avance(i / 200);
			if (y <= anterior) saltos++;
			anterior = y;
		}
		check("curva: crece en todos los puntos, sin mesetas", saltos === 0, "puntos que no avanzan=" + saltos);
		let peor = 0;
		for (let i = 0; i <= 100; i++) {
			const p = i / 100;
			peor = Math.max(peor, Math.abs(avance(p) - (2 * p - p * p)));
		}
		check("curva: frena como una rueda con desaceleracion constante", peor < .002, "error maximo contra 2t-t2 = " + peor.toFixed(5));
		const velocidades = [];
		for (let i = 0; i < 10; i++) velocidades.push(avance((i + 1) / 10) - avance(i / 10));
		let crecientes = 0;
		for (let i = 1; i < velocidades.length; i++) if (velocidades[i] >= velocidades[i - 1]) crecientes++;
		check("curva: la velocidad baja en todos los tramos", crecientes === 0, "tramos que aceleran=" + crecientes + "  velocidades=" + velocidades.map((v) => v.toFixed(3)).join(" "));
		check("curva: el frenado se nota, no es teorico", velocidades[0] > velocidades[9] * 8, `primer tramo=${velocidades[0].toFixed(3)} ultimo=${velocidades[9].toFixed(3)}`);
		check("curva: se recorre rapido al principio y lento al final", avance(.25) > .3 && avance(.5) > .7 && avance(.9) > .95, `25%=${avance(.25).toFixed(3)} 50%=${avance(.5).toFixed(3)} 90%=${avance(.9).toFixed(3)}`);
	}
	{
		let peor = 0;
		for (let i = 1; i < 100; i++) {
			const f = i / 100;
			peor = Math.max(peor, Math.abs(avance(instante(f)) - f));
		}
		check("curva: instante() deshace avance()", peor < 1e-6, "error maximo al deshacer = " + peor.toExponential(2));
		let peorVuelta = 0;
		for (let i = 1; i < 100; i++) {
			const p = i / 100;
			peorVuelta = Math.max(peorVuelta, Math.abs(instante(avance(p)) - p));
		}
		check("curva: y al reves, sin perderse por el camino", peorVuelta < 1e-6, "error maximo = " + peorVuelta.toExponential(2));
		check("curva: los extremos de la inversa estan clavados", instante(0) === 0 && instante(1) === 1, `${instante(0)} / ${instante(1)}`);
	}
	{
		for (const g of geometrias()) {
			const giro = geometria({
				ventanaPx: g.ventana,
				pasoPx: g.paso,
				casillaPx: g.casilla
			});
			const centro = giro.winIndex * g.paso + g.casilla / 2 - giro.viaje;
			check(`geometria (${g.nombre}): la casilla ganadora para en el marcador`, Math.abs(centro - g.ventana / 2) < 1e-9, `centro=${centro} aguja=${g.ventana / 2}`);
			check(`geometria (${g.nombre}): queda cinta por delante del premio`, giro.casillas - giro.winIndex >= giro.visibles, `casillas=${giro.casillas} winIndex=${giro.winIndex} visibles=${giro.visibles}`);
			const vueltasVistas = (giro.viaje + g.ventana / 2) / g.ventana;
			check(`geometria (${g.nombre}): da al menos 3 vueltas de la ventana`, vueltasVistas >= 3, `vueltas=${vueltasVistas.toFixed(2)}`);
			check(`geometria (${g.nombre}): la ganadora no es la primera casilla`, giro.winIndex > 0, "winIndex=" + giro.winIndex);
		}
		const vueltas = geometrias().map((g) => {
			return (geometria({
				ventanaPx: g.ventana,
				pasoPx: g.paso,
				casillaPx: g.casilla
			}).viaje + g.ventana / 2) / g.ventana;
		});
		check("geometria: el trompo dura igual en movil y en escritorio", Math.abs(vueltas[0] - vueltas[1]) < .35, `movil=${vueltas[0].toFixed(2)} escritorio=${vueltas[1].toFixed(2)}`);
		const corto = geometria({
			ventanaPx: MOVIL,
			pasoPx: 86,
			casillaPx: CASILLA_MOVIL,
			vueltas: 1
		});
		check("geometria: con una vuelta sigue habiendo cinta que cruzar", corto.winIndex > 0 && corto.casillas > corto.winIndex && corto.viaje > 0, `winIndex=${corto.winIndex} casillas=${corto.casillas} viaje=${corto.viaje}`);
	}
	{
		for (const g of geometrias()) {
			const giro = geometria({
				ventanaPx: g.ventana,
				pasoPx: g.paso,
				casillaPx: g.casilla
			});
			const cruces = crucesDeCasilla({
				viajePx: giro.viaje,
				pasoPx: g.paso,
				ventanaPx: g.ventana,
				duracionMs: DURACION
			});
			check(`chasquidos (${g.nombre}): hay uno por casilla que pasa`, cruces.length >= 12, "chasquidos=" + cruces.length);
			let desordenados = 0;
			for (let i = 1; i < cruces.length; i++) if (cruces[i] <= cruces[i - 1]) desordenados++;
			check(`chasquidos (${g.nombre}): van en orden y no se pisan`, desordenados === 0 && cruces.every((ms) => ms > 0 && ms < DURACION), "fuera de orden=" + desordenados + " rango=" + cruces[0] + ".." + cruces[cruces.length - 1]);
			const intervalos = cruces.slice(1).map((ms, i) => ms - cruces[i]);
			let seEspacian = 0;
			for (let i = 1; i < intervalos.length; i++) if (intervalos[i] > intervalos[i - 1]) seEspacian++;
			check(`chasquidos (${g.nombre}): los intervalos se van espaciando al frenar`, seEspacian >= intervalos.length - 3, "intervalos=" + intervalos.map((v) => Math.round(v)).join(","));
			check(`chasquidos (${g.nombre}): el ultimo tramo es el mas lento`, intervalos[intervalos.length - 1] > intervalos[0] * 3, `primero=${intervalos[0]}ms ultimo=${intervalos[intervalos.length - 1]}ms`);
			const desfases = [];
			for (const ms of cruces) {
				const d = avance(ms / DURACION) * giro.viaje;
				const frontera = Math.round((d + g.ventana / 2) / g.paso) * g.paso - g.ventana / 2;
				desfases.push(Math.abs(d - frontera));
			}
			const peorDesfase = Math.max(...desfases);
			check(`chasquidos (${g.nombre}): cada uno cae en una frontera de casilla`, peorDesfase < 1, "desfase maximo=" + peorDesfase.toFixed(3) + "px");
		}
		const parado = crucesDeCasilla({
			viajePx: 0,
			pasoPx: 104,
			ventanaPx: MOVIL,
			duracionMs: DURACION
		});
		check("chasquidos: sin viaje no hay chasquidos", parado.length === 0, "n=" + parado.length);
		const negativo = crucesDeCasilla({
			viajePx: -50,
			pasoPx: 104,
			ventanaPx: MOVIL,
			duracionMs: 0
		});
		check("chasquidos: un giro sin duracion ni camino no rompe nada", negativo.length === 0, "n=" + negativo.length);
	}
	check("curva: FRENADO son cuatro numeros para el cubic-bezier", FRENADO.length === 4 && FRENADO.every((n) => typeof n === "number" && n >= 0 && n <= 1), "FRENADO=" + JSON.stringify(FRENADO));
	check("curva: los puntos de control estan dentro del rango", FRENADO[0] <= FRENADO[2] && FRENADO[1] <= FRENADO[3], FRENADO.join(", "));
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 4
		}), crystal("x1", 1, 9)], { nanites: 0 }));
		g.equipCollector("r1");
		const nivelAntes = find(g, "r1").level;
		const res = conRoll(0, () => g.upgradeEquippedCollector(1));
		const roll = tuningRoll(res, nivelAntes, find(g, "r1").level);
		check("contrato: en el acierto se tira el dado", res.rolled === true, `rolled=${res.rolled}`);
		check("contrato: y la ruleta lo enseña como acierto", roll.rolled === true && roll.success === true, `rolled=${roll.rolled} success=${roll.success}`);
		check("contrato: la flecha del acierto es \"4 -> 5\"", roll.levelBefore === 4 && roll.levelAfter === 5, `${roll.levelBefore} -> ${roll.levelAfter}`);
		const g2 = await reload();
		check("contrato: el acierto sobrevive a la recarga", find(g2, "r1")?.level === 5, "nivel=" + find(g2, "r1")?.level);
	}
	{
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 4
		}), crystal("x1", 1, 9)], { nanites: 0 }));
		g.equipCollector("r1");
		const nivelAntes = find(g, "r1").level;
		const res = conRoll(.999, () => g.upgradeEquippedCollector(1));
		const roll = tuningRoll(res, nivelAntes, find(g, "r1").level);
		check("contrato: el fallo del dado tambien es una tirada", res.rolled === true, `rolled=${res.rolled}`);
		check("contrato: y la ruleta lo enseña como fallo", roll.rolled === true && roll.success === false, `rolled=${roll.rolled} success=${roll.success}`);
		check("contrato: el fallo deja el nivel donde estaba", roll.levelAfter === roll.levelBefore && find(g, "r1").level === 4, `${roll.levelBefore} -> ${roll.levelAfter}, el item esta en ${find(g, "r1").level}`);
		check("contrato: el fallo se paga con el cristal", find(g, "x1").stackCount === 9 - collectorUpgradeCost(4), "x1=" + find(g, "x1").stackCount);
	}
	{
		const rechazos = [
			{
				nombre: "sin cristales de ese nivel",
				save: baseSave([collector("r1", 3, {
					damage: 60,
					level: 4
				}), crystal("x1", 3, 5)], { nanites: 0 })
			},
			{
				nombre: "con menos cristales de los necesarios",
				save: baseSave([collector("r1", 3, {
					damage: 60,
					level: 10
				}), crystal("x1", 1, 1)], { nanites: 0 })
			},
			{
				nombre: "en el techo de niveles",
				save: baseSave([collector("r1", 3, {
					damage: 60,
					level: 20,
					maxLevel: 20
				}), crystal("x1", 1, 99)], { nanites: 0 })
			},
			{
				nombre: "sin recolector equipado",
				save: baseSave([crystal("x1", 1, 9)], { nanites: 0 })
			}
		];
		for (const caso of rechazos) {
			const g = await boot(caso.save);
			if (caso.equipo !== null) g.equipCollector("r1");
			const crystalsAntes = g.getState().warehouse.filter((w) => w.type === "crystal").reduce((a, w) => a + (w.stackCount || 1), 0);
			const nivelAntes = find(g, "r1")?.level;
			const res = g.upgradeEquippedCollector(1);
			const roll = tuningRoll(res, nivelAntes ?? 0, find(g, "r1")?.level ?? 0);
			const crystalsDespues = g.getState().warehouse.filter((w) => w.type === "crystal").reduce((a, w) => a + (w.stackCount || 1), 0);
			check(`rechazo (${caso.nombre}): el motor dice que no se tiro el dado`, res.success === false && res.rolled === false, `success=${res.success} rolled=${res.rolled} msg=${res.msg ?? ""}`);
			check(`rechazo (${caso.nombre}): y la ruleta no lo presenta como tirada`, roll.rolled === false, `rolled=${roll.rolled}: con esto el selector avisa por toast y no gira nada`);
			check(`rechazo (${caso.nombre}): no se gasta ni un cristal`, crystalsDespues === crystalsAntes, `antes=${crystalsAntes} despues=${crystalsDespues}`);
			check(`rechazo (${caso.nombre}): el nivel no se mueve`, (find(g, "r1")?.level ?? 0) === (nivelAntes ?? 0), `antes=${nivelAntes} ahora=${find(g, "r1")?.level}`);
		}
	}
	{
		const viejo = tuningRoll({
			success: true,
			msg: "x"
		}, 4, 5);
		check("contrato: sin `rolled` no se gira la ruleta", viejo.rolled === false && viejo.success === false, `rolled=${viejo.rolled} success=${viejo.success}`);
		const g = await boot(baseSave([collector("r1", 3, {
			damage: 60,
			level: 4
		}), crystal("x1", 1, 9)], { nanites: 0 }));
		g.equipCollector("r1");
		const ok = conRoll(0, () => g.upgradeEquippedCollector(1));
		const mal = conRoll(.999, () => g.upgradeEquippedCollector(1));
		check("contrato: el motor devuelve el nivel con el que se queda", ok.level === 5 && mal.level === 5, `acierto=${ok.level} fallo=${mal.level}: el fallo no retrocede, asi que los dos suben`);
	}
	resumen("giro de la ruleta");
}
var rouletteCheck_default = main();
//#endregion
export { rouletteCheck_default as default };
