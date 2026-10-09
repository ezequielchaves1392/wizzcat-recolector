// ==========================================================================
//  La tarjeta pública de un jugador: QUÉ SE PUBLICA Y QUÉ NO
// ==========================================================================
//
//  ## POR QUÉ HAY UNA TARJETA Y NO SE ABRE EL DOCUMENTO DE LA PARTIDA
//
//  `users/{uid}` es la partida entera, y las reglas lo cierran al owner y a un admin
//  a propósito. Abrirlo a lectura sería más fácil y sería un error: **en un incremental,
//  teach el gasto y el inventario de tu competencia** —si tiene un colector T9 es porque
//  ha reiniciado cuatro veces, y el número de reinicios es la partida entera leída al
//  revés. La tarjeta es un documento NUEVO que se escribe a propósito, con dentro solo
//  lo que alguien quiere que se vea de su partida.
//
//  Y por eso la tarjeta no se deduce de `state` al pintar: **se construye una vez, se
//  escribe en la nube, y lo que se lee es lo que el dueño decidió publicar**. Si el
//  dueño deja de jugar, su tarjeta se queda como estaba, que es justo lo que un perfil
//  tiene que hacer.
//
//  ## LO QUE NO SE PUBLICA, Y POR QUÉ
//
//  · **El saldo de nanitas.** Es el dinero que queda sin gastar. El ranking ya publica
//    `totalNanitesProduced` —que es un histórico y siempre sube—, y con eso hay para
//    compararse. El saldo es la parte que sí dice "cuánto le ha sobrado".
//  · **Los cristales del almacén.** Son el mismo dinero en item, y además son la única
//    forma de saber cuánto tiene guardado sin gastarlo.
//  · **Qué nodos del árbol están comprados, en detalle.** Se publica **cuántos** y hasta
//    dónde ha llegado, no el detalle de en qué los gastó: el árbol se paga con núcleos,
//    que son progreso, no dinero.
//  · **Los logros secretos.** `SECRET_ACHIEVEMENTS` existe para que no se Tawcan, y un
//    perfil público es el peor sitio para revelarlos sin querer.
//
//  ## POR QUÉ ESTO ESTÁ EN UN FICHERO DE DATOS Y NO EN EL SERVICIO
//
//  Porque es una regla —qué se publica— y porque **el banco tiene que poder comprobarla
//  sin red**: que la tarjeta no lleve el saldo es una afirmación sobre un objeto, y se
//  comprueba mirándolo. Si la regla viviera dentro de la escritura a Firestore, la única
//  forma de comprobarla sería escribir y leer, que es un banco que depende de la red.
//
//  Y porque el recorte tiene un tope: una partida con doscientasexpanders no puede
//  escribir una tarjeta de doscientos objetos, y el límite tiene que ser uno y escrito.

import { SECRET_ACHIEVEMENTS, type AchievementId } from './achievements';
import { TREE_BY_ID, TREE_NODES } from './tree';
import { aggregateBonuses } from './prestige';
import { ACHIEVEMENTS } from '../achievements';
import { efectoDeAfijos, danoFinalDeRecolector, multiplicadorDeNivel, DANIO_MINIMO_SIN_RECOLECTOR } from './crafting';
import { formatNumber } from '../utils/format';

// --------------------------------------------------------------------------
//  Los topes de la tarjeta
// --------------------------------------------------------------------------

/** Tope de seguridad de la lista de recolectores.normally solo hay uno equipado. */
/**
 * LO QUE VA EN LA TARJETA: SOLO LO QUE EL JUGADOR TIENE PUESTO.
 *
 * ## POR QUÉ SOLO LO EQUIPADO Y NO LA COLECCIÓN ENTERA
 *
 * Porque la ficha pública se abrió para ver **cómo juega alguien**, y eso lo dice lo que
 * tiene puesto: su recolector y sus compañeros activos. La lista de los veinte
 * recolectores que tiene guardados no dice cómo juega, dice cuántas horas ha jugado —y en
 * un incremental, enseñar el inventario completo a tu competencia es justo lo que no se
 * quería—.
 *
 * Y sale más corto y más legible: una ficha con cuatro líneas se lee de un vistazo y una
 * con veinte se pasa por alto, que es peor que no tenerla.
 *
 * **NO ES QUE NO TENGAMOS MÁS DATOS: es que no se publican.** El recorte es aquí, antes
 * de escribir, y no en la pantalla. Filtrar al pintar significaría mantener en el
 * documento datos que nadie va a ver.
 */
/** Tope de seguridad: solo hay un recolector equipado, pero la lista no depende de eso. */
export const TOPE_RECOLECTORES = 4;
/** Cuántos compañeros se publican. */
export const TOPE_COMPANEROS = 16;
/** Cuántas categorías del árbol se detallan. */
export const TOPE_NODOS = 40;
/** Cuántos logros se publican, de los que tenga. */
export const TOPE_LOGROS = 60;

// --------------------------------------------------------------------------
//  La forma de la tarjeta
// --------------------------------------------------------------------------

export interface RecolectorPublico {
  id: string;
  name: string;
  tier: number;
  level: number;
  maxLevel: number;
  potential: number;
  rarity: string;
  /**
   * El daño por clic, con el potencial ya aplicado.
   *
   * **NO ES DATO NUEVO:** el `details` del item ya lo dice en texto ("Recolección por
   * click: +267"). Lo que se publica es el número suelto, para poder ponerlo en grande al
   * lado del nombre en vez de leerlo de una frase.
   */
  damage?: number;
  /** Si es el recolector que este jugador tiene equipado ahora mismo. */
  equipado?: boolean;
  /** Los afijos del arma, que cuentan al equiparla (F83: el recálculo los usa). */
  affixes?: string[];
}

export interface CompanionPublico {
  id: string;
  name: string;
  tier: number;
  power: number;
  rarity: string;
  /** Si este compañero está en la lista de activos. */
  equipado?: boolean;
  /** 'click', 'passive' o 'multiplier': el de la ficha, que es el que multiplica. */
  tipo: string;
  /**
   * Nivel y potencial, publicados solo para el brillo.
   *
   * Los dos son públicos en el sentido de que ya se enseñan: el nivel se ve en el
   * almacén y el potencial sale en las estrellas. Lo que se publica aquí es para que
   * **el halo del compañero se calcule igual en la tarjeta que en la base**, y sin esto
   * sale siempre en cero: la tarjeta no tiene el item con su nivel, tiene el número que
   * esta función escribe.
   *
   * Y no es información que salga de aquí: el dueño ya puede verlos en su propio inventario, y quien
   * mira su perfil ve lo que ha invertido, que es lo mismo que se ve en su base.
   */
  nivel?: number;
  potencial?: number;
  maxLevel?: number;
}

export interface NodoPublico {
  id: string;
  name: string;
  nivel: number;
  maxLevel: number;
  categoria: string;
}

export interface TarjetaPublica {
  userId: string;
  username: string;
  // --- Los números grandes ---
  nanitasProducidas: number;
  totalClicks: number;
  cores: number;
  totalCores: number;
  resets: number;
  cajasAbiertas: number;
  forjadas: number;
  // --- La colección ---
  recolectores: RecolectorPublico[];
  companeros: CompanionPublico[];
  /** Cuántos nodos del árbol ha comprado, de los que hay. */
  nodosComprados: number;
  nodosTotales: number;
  nivelesDeArbol: number;
  nodos: NodoPublico[];
  // --- Los logros y la apariencia ---
  logros: AchievementId[];
  totalLogros: number;
  cosmetics: { title: string; frame: string; banner: string };
  // --- El contador de visitas ---
  //
  // **ESTOS DOS NO LOS ESCRIBE EL DUEÑO.** Los pone quien entra a mirar, y por eso no
  // están en `documentoDeTarjeta()`: si estuvieran, cada publicación los pondría a cero
  // con `merge: true` y el contador valdría siempre 1. Son las dos únicas claves del
  // documento que el dueño no toca, y las reglas lo permiten así a propósito.
  visitas: number;
  /** Uids distintos que han mirado esta tarjeta. */
  visitantes: string[];
  updatedAt: number;

  /**
   * Si la ficha se construyó con TODO o solo con lo que el ranking ya sabía.
   *
   * **Opcional y sin valor por defecto a propósito.** Una tarjeta real no lo lleva
   * (o lo lleva a `true`), y la que sale del ranking lleva `false`. La pantalla lo usa
   * para **decir que la colección no está publicada** en vez de pintar secciones vacías,
   * que es lo que hace que una ficha a medias no parezca una ficha sin contenido.
   */
  completa?: boolean;
  /** Por qué no hay tarjeta, cuando no la hay. Solo en la ficha a medias. */
  /** Por qué esta tarjeta no es la entera. Ver `MotivoDeAusencia`. */
  motivo?: 'no-existe' | 'permiso' | 'error';
}

/** Un documento que no se ha escrito nunca. Se pinta como "nunca ha jugado". */
export const TARJETA_VACIA: TarjetaPublica = {
  userId: '', username: 'Operativo',
  nanitasProducidas: 0, totalClicks: 0, cores: 0, totalCores: 0,
  resets: 0, cajasAbiertas: 0, forjadas: 0,
  recolectores: [], companeros: [],
  nodosComprados: 0, nodosTotales: TREE_NODES.length, nivelesDeArbol: 0, nodos: [],
  logros: [], totalLogros: 0,
  cosmetics: { title: '', frame: 'frame_none', banner: 'banner_none' },
  visitas: 0, visitantes: [], updatedAt: 0
};

/**
 * Construye la tarjeta a partir del estado del dueño.
 *
 * **COHERIZA AL CARGAR, NO AL PINTAR** (R8): los números que vienen de un documento de
 * la nube pueden no existir, y una tarjeta con un `undefined` en medio enseña
 * "undefined" en la cara del jugador que está mirando.
 */
export function tarjetaDesdeEstado(state: any, userId: string, username: string): TarjetaPublica {

  // Los compañeros activos se calculan **una vez** y no por cada compañero: la lista
  // puede ser de cuatro o cinco, y preguntar a `state.activeCompanions` dentro del
  // `map` es la forma de recorrer el mismo array para cada elemento sin obtener nada.
  const activos = new Set<string>(
    Array.isArray(state?.activeCompanions) ? state.activeCompanions : []
  );
  const almacen: any[] = Array.isArray(state?.warehouse) ? state.warehouse : [];

  // **SOLO EL EQUIPADO.** `state.equippedCollectorId` es el que el jugador tiene puesta la
  // mano; los demás filtrados son los que tiene en el almacén y no dice nada de cómo
  // juega.
  const recolectores = ordenados(
    almacen.filter(w => w?.type === 'collector' && w.id === state?.equippedCollectorId)
      .map(w => ({
        id: String(w.id ?? ''),
        name: String(w.name ?? 'Recolector'),
        tier: num(w.tier), level: num(w.level), maxLevel: num(w.maxLevel),
        potential: num(w.potential), rarity: String(w.rarity ?? ''),
        damage: num(w.damage),
        equipado: true,
        affixes: Array.isArray(w.affixes) ? w.affixes.map(String) : [],
        forgedBy: String(w.forgedBy ?? ''),
        details: String(w.details ?? '')
      }))
  ).slice(0, TOPE_RECOLECTORES);

  // **SOLO LOS ACTIVOS**, por el mismo motivo que arriba, y porque la rejilla del inicio
  // enseña los activos y las ranuras vacías: la ficha pública enseña las que están
  // ocupadas.
  // **EL PODER DEL COMPAÑERO ESTÁ EN LA FICHA, NO EN EL ITEM DEL ALMACÉN.** Hay dos
  //  objetos con el mismo id: el item del almacén, que es lo que se ve y lo que tiene
  //  nombre, rareza y tier, y la ficha de `state.companions`, que es la que paga. El
  //  ingreso sale de `ficha.power` y el item no lo lleva.
  //
  //  **ANTES SE LEÍA `w.power` DEL ITEM Y SALÍA 0 EN TODOS.** La ficha enseñaba seis
  //  compañeros con "INGRESO +0/s". Y no lo detectó el banco, porque el fixture de
  //  pruebas tampoco lleva `power` en el item y el preview lo llevaba escrito a mano:
  //  los dos probaban una forma que el juego nunca construye.
  //
  //  **SE LEE IGUAL QUE LO LEE EL MOTOR**, que es `state.companions` primero y el
  //  item de vuelta. Copiar esa línea a mano es pedir que las dos se separen.
  const fichas = Array.isArray(state?.companions) ? state.companions : [];
  /** La ficha del compañero por id, que es la que guarda el nivel y el potencial. */
  const fichaDe = (id: any) => (fichas as any[]).find((c: any) => c?.id === id);


  const companeros = ordenados(
    almacen.filter(w => w?.type === 'companion' && activos.has(w.id))
      .map(w => ({
        id: String(w.id ?? ''),
        name: String(w.name ?? 'Compañero'),
        tier: num(w.tier),
        // **EL INGRESO ES EL DE LA FICHA.** Hay dos objetos con el mismo id: el item del
        // almacén, que es lo que se ve, y la ficha de `state.companions`, que es la que
        // paga. El item no lleva `power`, así que leerlo de ahí sale **0 en todos** y la
        // ficha enseña seis compañeros con "INGRESO +0/s". Es el mismo orden que usa el
        // motor al desglosar el daño, y se copia a propósito para que no se separen.
        power: num(fichaDe(w.id)?.power ?? w?.power),
        equipado: true,
        rarity: String(w.rarity ?? ''),
        // **EL TIPO DE LA FICHA, NO EL DEL ITEM (F83).** El item del almacén es
        // 'companion' para todos; lo que multiplica el clic es el 'multiplier' de
        // la ficha. Antes se publicaba el del item y todos salían 'companion': el
        // recálculo del daño ajeno no tenía de dónde sacar el multiplicador de
        // compañeros. Se coacciona al conjunto conocido; lo desconocido es 'click',
        // que es lo que no multiplica.
        tipo: (['click', 'passive', 'multiplier'] as string[]).includes(String(fichaDe(w.id)?.type))
          ? String(fichaDe(w.id)?.type)
          : 'click',
        // **DE LA FICHA, COMO EL POWER.** El nivel y el potencial del compañero viven en
        // `state.companions`; el item del almacén es otra copia y puede no traerlos. Leerlos
        // del item daría 0 y el halo de la tarjeta saldría siempre apagado.
        nivel: num(fichaDe(w.id)?.level ?? w?.level),
        potencial: num(fichaDe(w.id)?.potential ?? w?.potential),
        maxLevel: num(fichaDe(w.id)?.maxLevel)
      }))
  ).slice(0, TOPE_COMPANEROS);

  const niveles: Record<string, number> = (state?.nodeLevels ?? {}) as Record<string, number>;
  const nodos: NodoPublico[] = Object.keys(niveles)
    .filter(id => num(niveles[id]) > 0 && TREE_BY_ID[id])
    .map(id => ({
      id,
      name: TREE_BY_ID[id].name,
      nivel: num(niveles[id]),
      maxLevel: num(TREE_BY_ID[id].maxLevel),
      categoria: String(TREE_BY_ID[id].category ?? '')
    }))
    .sort((a, b) => b.nivel - a.nivel)
    .slice(0, TOPE_NODOS);

  const logros: AchievementId[] = (Array.isArray(state?.unlockedAchievements)
    ? state.unlockedAchievements
    : []) as AchievementId[];

  return {
    userId,
    username: username || 'Operativo',
    nanitasProducidas: num(state?.totalNanitesProduced),
    totalClicks: num(state?.totalClicks),
    cores: num(state?.cores),
    totalCores: num(state?.totalCores),
    resets: num(state?.resets),
    cajasAbiertas: num(state?.cratesOpened),
    forjadas: num(state?.forgedCount),
    recolectores,
    companeros,
    nodosComprados: nodos.length,
    nodosTotales: TREE_NODES.length,
    nivelesDeArbol: nodos.reduce((a, n) => a + n.nivel, 0),
    nodos,
    // **LOS SECRETOS NO SALEN.** Y el total que se enseña es el de TODOS los logros, no
    // el de los publicados: si no, se sabría que a alguien le faltan dos secretos sin
    // saber cuáles.
    logros: logros.filter(id => !SECRET_ACHIEVEMENTS.includes(id)).slice(0, TOPE_LOGROS),
    totalLogros: logros.length,
    cosmetics: {
      title: String(state?.cosmetics?.title ?? ''),
      frame: String(state?.cosmetics?.frame ?? 'frame_none'),
      banner: String(state?.cosmetics?.banner ?? 'banner_none')
    },
    visitas: 0,
    visitantes: [],
    updatedAt: Date.now()
  };
}

/**
 * EL BONO DE CLIC DE UNOS LOGROS CONCRETOS (F83).
 *
 * El motor suma `ACHIEVEMENTS[].reward` sobre sus desbloqueados; para recalculuar
 * el daño de OTRO jugador hay que sumar la misma tabla sobre los que trae su
 * tarjeta. Los ids que no están en el catálogo no suman: una tarjeta vieja o
 * corrupta no puede multiplicar.
 */
export function bonoDeClickDeLogros(ids: Array<string> | undefined | null): number {
  let bonus = 0;
  const lista = Array.isArray(ids) ? ids : [];
  for (const ach of ACHIEVEMENTS) {
    if (!lista.includes(ach.id)) continue;
    bonus += ach.reward?.clickBonus || 0;
  }
  return bonus;
}

/**
 * EL DAÑO FINAL DEL ARMA EQUIPADA DE UNA TARJETA, SIN BUFFS TEMPORALES (F83).
 *
 * Es lo que pega ese jugador por clic sin temporales: su daño por nivel por
 * afijos por compañeros por logros por árbol, con el suelo abajo. Cada entrada
 * sale de la tarjeta —el arma equipada, los compañeros activos, los nodos con
 * su nivel y los logros— y por las mismas funciones puras que usa el motor para
 * lo propio, en el mismo orden. Si la tarjeta no trae arma, es cero: un perfil
 * sin recolector no pega, y pintarlo como otra cosa sería inventar un dato.
 *
 * **SIN TEMPORALES PORQUE NO SE PUBLICAN.** `state.buffs` no va en la tarjeta a
 * propósito (es volátil: un x2 caducado en una foto de hace minutos es un número
 * que nadie pega). Quien enseñe este número lo rotula sin temporales.
 *
 * Devuelve el trío como `danosDeClick()`: el total y cuánto es del arma y cuánto
 * de la partida, que es lo que el hover parte al apoyar.
 */
export function danoFinalDeTarjeta(
  t: TarjetaPublica | null | undefined
): { total: number; intrinseco: number; partida: number } {
  const vacio = { total: 0, intrinseco: 0, partida: 0 };
  const arma = t?.recolectores?.[0];
  if (!arma) return vacio;
  const nivel = Math.max(0, Math.floor(Number(arma.level) || 0));
  const base = Math.max(DANIO_MINIMO_SIN_RECOLECTOR, Number(arma.damage) || 0);
  const multAfijos = 1 + efectoDeAfijos(arma.affixes, nivel).clickMult;
  let multCompaneros = 1;
  for (const c of t?.companeros ?? []) {
    if (c?.tipo === 'multiplier' && c?.equipado) multCompaneros += Number(c?.power) || 0;
  }
  multCompaneros = Math.max(1, multCompaneros);
  const multLogros = 1 + bonoDeClickDeLogros(t?.logros);
  const niveles: Record<string, number> = {};
  for (const n of t?.nodos ?? []) {
    if (!n?.id) continue;
    niveles[String(n.id)] = Math.max(0, Math.floor(Number(n?.nivel) || 0));
  }
  const multArbol = 1 + (aggregateBonuses(niveles).clickMult || 0);
  const intrinseco = Math.floor(base * multiplicadorDeNivel(nivel) * multAfijos);
  const total = danoFinalDeRecolector(arma.damage, nivel, multAfijos, multCompaneros, multLogros, multArbol);
  return { total, intrinseco, partida: total - intrinseco };
}

/**
 * Qué se escribe en la nube.
 *
 * **FUERA DE AQUÍ NO SE ESCRIBE NADA, Y ESTA FUNCIÓN ES LA QUE LO GARANTIZA.**
 * Devuelve un objeto nuevo con solo las claves públicas, así que aunque el estado
 * tenga mil campos, el documento no los lleva. El banco lo comprueba comparando las
 * claves.
 */
export function documentoDeTarjeta(tarjeta: TarjetaPublica): Record<string, unknown> {
  return {
    userId: tarjeta.userId,
    username: tarjeta.username,
    nanitasProducidas: tarjeta.nanitasProducidas,
    totalClicks: tarjeta.totalClicks,
    cores: tarjeta.cores,
    totalCores: tarjeta.totalCores,
    resets: tarjeta.resets,
    cajasAbiertas: tarjeta.cajasAbiertas,
    forjadas: tarjeta.forjadas,
    recolectores: tarjeta.recolectores,
    companeros: tarjeta.companeros,
    nodosComprados: tarjeta.nodosComprados,
    nodosTotales: tarjeta.nodosTotales,
    nivelesDeArbol: tarjeta.nivelesDeArbol,
    nodos: tarjeta.nodos,
    logros: tarjeta.logros,
    totalLogros: tarjeta.totalLogros,
    cosmetics: tarjeta.cosmetics,
    // **NI `visitas` NI `visitantes`, A PROPÓSITO.** Van con `merge: true`, así que
    // escribirlos aquí los pondría a cero en cada publicación y el contador de visitas
    // marcaría siempre 1. Los pone quien mira, y son las dos únicas claves del documento
    // que el dueño no toca.
    updatedAt: tarjeta.updatedAt
  };
}

/** Las claves que un documento de tarjeta puede tener. Ni una más. */
export const CLAVES_DE_TARJETA = Object.keys(documentoDeTarjeta(TARJETA_VACIA));

/**
 * Normaliza lo que llega de la nube, porque un documento viejo o escrito a mano puede
 * no tener lo que la pantalla espera. Coaccionar aquí y no en la vista (R8).
 */
export function coaccionaTarjeta(bruto: any, userId: string): TarjetaPublica {
  if (!bruto || typeof bruto !== 'object') return { ...TARJETA_VACIA, userId };
  const base = { ...TARJETA_VACIA, ...bruto, userId } as TarjetaPublica;

  // **LOS NÚMEROS SE COACCIONAN UNO A UNO, Y NO CON UN `...bruto`.** Un documento de
  // la nube puede traer cualquier cosa en esos campos —una tarjeta vieja sin ellos, una
  // escrita a mano desde la consola, un `nanitasProducidas` que llegó como cadena— y
  // con el reparto tal cual ese valor llega a la pantalla tal cual. La comprobación del
  // banco que lo cubre con una cadena a propósito: sale un texto en el sitio de una
  // cifra, en la cara del jugador que está mirando a otro.
  for (const clave of NUMERICAS) base[clave] = num(bruto[clave]);

  base.recolectores = Array.isArray(bruto.recolectores) ? bruto.recolectores : [];
  base.companeros = Array.isArray(bruto.companeros) ? bruto.companeros : [];
  base.nodos = Array.isArray(bruto.nodos) ? bruto.nodos : [];
  base.logros = Array.isArray(bruto.logros) ? bruto.logros : [];
  base.visitantes = Array.isArray(bruto.visitantes) ? bruto.visitantes : [];
  base.username = typeof bruto.username === 'string' && bruto.username ? bruto.username : 'Operativo';
  base.cosmetics = { ...TARJETA_VACIA.cosmetics, ...(bruto.cosmetics ?? {}) };
  return base;
}

/** Las claves de la tarjeta que son números. Se coercian todas, una a una. */
const NUMERICAS = [
  'nanitasProducidas', 'totalClicks', 'cores', 'totalCores', 'resets',
  'cajasAbiertas', 'forjadas', 'nodosComprados', 'nodosTotales',
  'nivelesDeArbol', 'totalLogros', 'visitas', 'updatedAt'
] as const;

// --------------------------------------------------------------------------
//  Ayudas
// --------------------------------------------------------------------------

const num = (v: any): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * El orden de la lista, y por qué lo equipado va primero.
 *
 * **LO PUESTO, PRIMERO.** Un jugador tiene veinte recolectores y uno equipado: el que
 * decide cómo juega es el equipado, y esconderlo en medio de la lista es tener que
 * buscarlo. Que salga primero es información, no decoración. Y detrás, lo de siempre —
 * tier, nivel, poder— para que el resto siga siendo el mejor primero.
 */
function ordenados<T extends {
  tier: number; equipado?: boolean; level?: number; power?: number; potential?: number
}>(lista: T[]): T[] {
  return lista.slice().sort((a, b) =>
    Number(!!b.equipado) - Number(!!a.equipado)
    || (b.tier - a.tier)
    || ((b.level ?? 0) - (a.level ?? 0))
    || ((b.power ?? 0) - (a.power ?? 0))
    || ((b.potential ?? 0) - (a.potential ?? 0))
  );
}

/** Un número grande como texto, para las etiquetas de la tarjeta. */
export function cifraDeTarjeta(n: number): string {
  return formatNumber(n);
}