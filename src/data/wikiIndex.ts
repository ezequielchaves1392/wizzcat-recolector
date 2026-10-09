// ==========================================================================
//  Índice de búsqueda de la Wiki
//
//  La Wiki vive en pestaña aparte sin game loop, así que su buscador no puede
//  preguntarle nada al motor: busca sobre este índice, que se construye de las
//  mismas tablas que la Wiki enseña (`store`, `crateLoot`, `tiers`, `bases`,
//  `crafting`, `achievements`, `tree`, `patchNotes`). Un concepto que el juego
//  añade y nadie indexa sale en rojo en `wikiCheck`, igual que un nombre sin
//  lore sale en rojo en `loreCheck`.
//
//  POR QUÉ NO REUSA EL BUSCADOR DEL ALMACÉN. `normalizaBusqueda()` y el "y"
//  entre términos son la misma técnica, pero la regla de coincidencia es de
//  cada superficie: el almacén distingue "t1" de "t10" porque confunde el
//  tier con un prefijo (F45), y aquí un "t1" que devuelva la caja T1, el tier
//  1 y las bases T1 es justo lo que se quiere. Importar `warehouse.ts` para
//  reusar tres líneas arrastraría `toast`, `modal`, `audio` y las ruletas al
//  bundle de la Wiki, que hoy pesa 24 KB porque no depende de nada del juego.
// ==========================================================================

import {
  CRATE_TIERS, CRATE_TYPES, CONSUMABLES, EXPANSOR_TIERS
} from './store';
import { CRATE_META, CRATE_ONLY_COMPANIONS } from '../components/crateLoot';
import { TIER_SYSTEM, rarezaDeTier } from './tiers';
import { BASES_RECOLECTOR, BASES_COMPANERO } from './bases';
import { AFFIXES } from './crafting';
import { ACHIEVEMENTS } from '../achievements';
import { LOGROS_DIFICILES } from './achievements';
import { TREE_NODES } from './tree';
import { NOTAS } from './patchNotes';

/** Las siete secciones, en el mismo orden en que la Wiki las enseña. */
export type SeccionWiki =
  | 'mecanicas' | 'cajas' | 'bases' | 'items'
  | 'logros' | 'pasivas' | 'versiones';

/** Una entrada buscable: a qué sección lleva y a qué ancla dentro de ella. */
export interface EntradaWiki {
  seccion: SeccionWiki;
  /** El `id` del elemento al que se hace scroll. Lo ponen la página y el índice con los mismos ayudantes de abajo: una sola fuente por ancla. */
  ancla: string;
  titulo: string;
  /** Texto buscable: nombres y palabras clave. Sin cifras a mano (R32). */
  texto: string;
}

// --------------------------------------------------------------------------
//  Anclas: la única fuente de los `id` a los que se salta
// --------------------------------------------------------------------------
//  La página (`wikiPage.ts`) los escribe en el HTML y este índice los lee
//  para buscar: si cada uno inventara su formato, el enlace llevaría a un
//  `id` que no existe y el salto caería en silencio al principio de la
//  sección. Por eso el formato vive aquí y en un solo sitio.

export const anclaCaja = (tier: number): string => `caja-T${tier}`;
export const anclaGrupoBases = (lado: 'rec' | 'com', tier: number): string =>
  `bases-${lado}-T${tier}`;
export const anclaBase = (id: string): string => `base-${id}`;
export const anclaTier = (tier: number): string => `tier-${tier}`;
export const anclaExclusivo = (i: number): string => `exclusivo-${i}`;
export const anclaConsumible = (buffId: string): string => `consumible-${buffId}`;
export const anclaExpansor = (i: number): string => `expansor-${i}`;
export const anclaAfijo = (id: string): string => `afijo-${id}`;
export const anclaLogro = (id: string): string => `logro-${id}`;
export const anclaNodo = (id: string): string => `nodo-${id}`;
export const anclaVersion = (version: string): string =>
  `v-${version.replace(/\./g, '-')}`;

/**
 * Las anclas de los bloques fijos (los que no salen de una tabla). También
 * viven aquí y no en la página: el índice las nombra para buscar y la página
 * las escribe en el HTML, y si cada uno las inventara el salto caería en un
 * `id` que no existe.
 */
export const ANCLA = {
  mecanicaGanar: 'mecanica-ganar',
  mecanicaForja: 'mecanica-forja',
  mecanicaSinto: 'mecanica-sinto',
  mecanicaAscension: 'mecanica-ascension',
  mecanicaVender: 'mecanica-vender',
  cajasIntro: 'cajas-intro',
  basesCaza: 'bases-caza',
  itemsTiers: 'items-tiers',
  itemsExclusivos: 'items-exclusivos',
  itemsConsumibles: 'items-consumibles',
  itemsExpansores: 'items-expansores',
  itemsAfijos: 'items-afijos',
  logrosQueDan: 'logros-que-dan',
  pasivasArbol: 'pasivas-arbol',
  versionesHistorial: 'versiones-historial'
} as const;

// --------------------------------------------------------------------------
//  Normalización y búsqueda
// --------------------------------------------------------------------------

/**
 * Minúsculas y sin tildes: el teclado del móvil no siempre pone las tildes
 * y "calibracion" tiene que encontrar "Calibración". Misma técnica que el
 * almacén, copiada a mano a propósito (ver cabecera).
 */
export function normalizaWiki(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Busca en el índice con "y" entre términos: cada palabra tiene que aparecer
 * en el título o el texto de la entrada. Vacío o solo espacios no es buscar
 * nada y devuelve vacío, no el índice entero.
 *
 * El tope de 40 no es un capricho: una lista de doscientas bases no es
 * navegar, es hacer scroll. Quien busca "base" ya sabe a qué sección ir.
 */
export function buscarEnWiki(q: string, indice: EntradaWiki[] = INDICE_WIKI): EntradaWiki[] {
  const terminos = normalizaWiki(q).split(/[\s,·]+/).map(t => t.trim()).filter(t => t.length > 0);
  if (terminos.length === 0) return [];
  const halladas: EntradaWiki[] = [];
  for (const e of indice) {
    const bolsa = normalizaWiki(`${e.titulo} ${e.texto}`);
    if (terminos.every(t => bolsa.includes(t))) {
      halladas.push(e);
      if (halladas.length >= 40) break;
    }
  }
  return halladas;
}

// --------------------------------------------------------------------------
//  Construcción del índice, desde las tablas del juego
// --------------------------------------------------------------------------

function mecanicas(): EntradaWiki[] {
  const bloques: Array<[string, string, string]> = [
    [ANCLA.mecanicaGanar, 'Cómo se gana', 'click pasivo ingreso recolector compañero daño mirar pantalla afk tarjeta'],
    [ANCLA.mecanicaForja, 'La forja: dos entran, uno sale', 'forja fusion fusionar materiales yunque potencial media probabilidad piedra calibracion nanoparticula estabilidad eter refinamiento estrella cristales fallo'],
    [ANCLA.mecanicaSinto, 'Sintonizar con cristales', 'sintonizar cristal nivel intento probabilidad coste techo'],
    [ANCLA.mecanicaAscension, 'La Ascensión', 'ascension reciclar nucleos prestigio conservar perder arbol'],
    [ANCLA.mecanicaVender, 'Vender', 'vender reventa precio nanitas'],
  ];
  return bloques.map(([ancla, titulo, texto]) => ({ seccion: 'mecanicas' as const, ancla, titulo, texto }));
}

function cajas(): EntradaWiki[] {
  const intro: EntradaWiki = {
    seccion: 'cajas', ancla: ANCLA.cajasIntro, titulo: 'Diez cajas, una por tier',
    texto: 'caja cajas tier sorteo reparto probabilidad suerte expansor consumible cosmetico salto'
  };
  const tarjetas: EntradaWiki[] = (CRATE_TIERS as readonly number[]).map(t => ({
    seccion: 'cajas' as const,
    ancla: anclaCaja(t),
    titulo: (CRATE_META as Record<number, { name: string }>)[t]?.name ?? `Caja T${t}`,
    texto: `caja tier ${t} ${(CRATE_TYPES as Record<number, { rarity: string }>)[t]?.rarity ?? ''} abrir premio botin`
  }));
  return [intro, ...tarjetas];
}

function bases(): EntradaWiki[] {
  const intro: EntradaWiki = {
    seccion: 'bases', ancla: ANCLA.basesCaza, titulo: 'La caza',
    texto: 'base bases oculta stat sorteo caza forja promedio techo nivel'
  };
  const lados: Array<['rec' | 'com', Record<number, Array<{ nombre: string; id: string }>>]> = [
    ['rec', BASES_RECOLECTOR as Record<number, Array<{ nombre: string; id: string }>>],
    ['com', BASES_COMPANERO as Record<number, Array<{ nombre: string; id: string }>>]
  ];
  const entradas: EntradaWiki[] = [intro];
  for (const [lado, tabla] of lados) {
    const quien = lado === 'rec' ? 'recolector recolectores arma armas' : 'compañero compañeros escuadron';
    for (let tier = 1; tier <= 10; tier++) {
      const lista = tabla[tier] ?? [];
      entradas.push({
        seccion: 'bases',
        ancla: anclaGrupoBases(lado, tier),
        titulo: `${lado === 'rec' ? 'Recolectores' : 'Compañeros'} T${tier}`,
        texto: `base bases tier ${tier} ${quien} ${rarezaDeTier(tier)}`
      });
      for (const b of lista) {
        entradas.push({
          seccion: 'bases',
          ancla: anclaBase(b.id),
          titulo: b.nombre,
          texto: `base tier ${tier} ${quien} ${rarezaDeTier(tier)}`
        });
      }
    }
  }
  return entradas;
}

function items(): EntradaWiki[] {
  const entradas: EntradaWiki[] = [
    { seccion: 'items', ancla: ANCLA.itemsTiers, titulo: 'Los diez tiers', texto: 'tier tiers rango dano ingreso carta comprar forja caja' },
    { seccion: 'items', ancla: ANCLA.itemsExclusivos, titulo: 'Exclusivos de caja', texto: 'exclusivo exclusivos caja tienda multiplicador' },
    { seccion: 'items', ancla: ANCLA.itemsConsumibles, titulo: 'Consumibles', texto: 'consumible consumibles tarjeta buff afk click piedra nanoparticula eter forja' },
    { seccion: 'items', ancla: ANCLA.itemsExpansores, titulo: 'Expansores y cristal', texto: 'expansor expansores ranura capacidad cristal recurso' },
    { seccion: 'items', ancla: ANCLA.itemsAfijos, titulo: 'Afijos: los pone la rareza', texto: 'afijo afijos forja rareza tienda caja linaje' }
  ];
  for (let t = 1; t <= 10; t++) {
    const nombres = (TIER_SYSTEM.collectorNames as Record<number, string[]>)[t] ?? [];
    const compas = (TIER_SYSTEM.companionNames as Record<number, string[]>)[t] ?? [];
    entradas.push({
      seccion: 'items', ancla: anclaTier(t), titulo: `Tier ${t}`,
      texto: `tier ${t} ${rarezaDeTier(t)} ${nombres.join(' ')} ${compas.join(' ')}`
    });
  }
  (CRATE_ONLY_COMPANIONS as readonly any[]).forEach((c: any, i: number) => {
    entradas.push({
      seccion: 'items', ancla: anclaExclusivo(i), titulo: c.name,
      texto: `exclusivo caja compañero ${c.rarity ?? ''}`
    });
  });
  Object.values(CONSUMABLES as Record<string, any>)
    .filter(c => !(EXPANSOR_TIERS as any[]).some(e => e.buffId === c.buffId))
    .forEach(c => {
      entradas.push({
        seccion: 'items', ancla: anclaConsumible(c.buffId), titulo: c.name,
        texto: `consumible tarjeta buff ${c.details ?? ''}`
      });
    });
  (EXPANSOR_TIERS as any[]).forEach((e, i) => {
    entradas.push({
      seccion: 'items', ancla: anclaExpansor(i), titulo: e.name,
      texto: 'expansor ranura capacidad almacen'
    });
  });
  for (const a of AFFIXES) {
    entradas.push({
      seccion: 'items', ancla: anclaAfijo(a.id), titulo: a.name,
      texto: `afijo forja ${a.description ?? ''} ${a.rarity ?? ''}`
    });
  }
  return entradas;
}

function logros(): EntradaWiki[] {
  const intro: EntradaWiki = {
    seccion: 'logros', ancla: ANCLA.logrosQueDan, titulo: 'Qué dan',
    texto: 'logro logros bonus click pasivo cosmetico dificil secreto'
  };
  const filas: EntradaWiki[] = ACHIEVEMENTS.map(a => {
    const dificil = (LOGROS_DIFICILES as Array<{ id: string; porQue: string }>).find(d => d.id === a.id);
    return {
      seccion: 'logros' as const,
      ancla: anclaLogro(a.id),
      titulo: a.title,
      texto: `logro ${a.description ?? ''} ${a.rewardText ?? ''} ${dificil ? `dificil ${dificil.porQue}` : ''}`
    };
  });
  return [intro, ...filas];
}

function pasivas(): EntradaWiki[] {
  const intro: EntradaWiki = {
    seccion: 'pasivas', ancla: ANCLA.pasivasArbol, titulo: 'El árbol',
    texto: 'arbol pasiva pasivas nodo nodos nucleo nucleos columna requisito rama click tienda forja caja almacen'
  };
  const nodos: EntradaWiki[] = TREE_NODES.map(n => ({
    seccion: 'pasivas' as const,
    ancla: anclaNodo(n.id),
    titulo: n.name,
    texto: `nodo pasiva arbol ${n.description ?? ''} ${(n as any).category ?? ''}`
  }));
  return [intro, ...nodos];
}

function versiones(): EntradaWiki[] {
  const intro: EntradaWiki = {
    seccion: 'versiones', ancla: ANCLA.versionesHistorial, titulo: 'Historial del juego',
    texto: 'version versiones parche parches historial notas novedad'
  };
  const notas: EntradaWiki[] = NOTAS.map(n => ({
    seccion: 'versiones' as const,
    ancla: anclaVersion(n.version),
    titulo: `v${n.version} · ${n.titulo}`,
    texto: `version parche ${n.version} ${n.titulo} ${(n.lineas ?? []).join(' ')}`
  }));
  return [intro, ...notas];
}

/** El índice entero, en el orden en que la Wiki lo enseña. */
export function construirIndiceWiki(): EntradaWiki[] {
  return [...mecanicas(), ...cajas(), ...bases(), ...items(), ...logros(), ...pasivas(), ...versiones()];
}

export const INDICE_WIKI: EntradaWiki[] = construirIndiceWiki();
