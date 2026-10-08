// ==========================================================================
// Banco de pruebas visual
//
// Monta cualquier pantalla del juego con datos de ejemplo, sin Firebase y sin
// tocar la partida real. Sirve para revisar el diseño en varios tamaños,
// temas y estados.
//
//   /preview.html                              → vista de la base
//   /preview.html?vista=almacen                → una pantalla concreta
//   /preview.html?vista=forja&w=390&h=844      → con viewport móvil
//   /preview.html?tema=matrix                  → tema concreto
//
// Vistas disponibles: base, almacen, forja, tienda, perfil, ranking, prestigio
//
// El <iframe> da un viewport real. Ajustar el ancho del documento NO sirve:
// las media queries siguen viendo el ancho de la ventana del navegador, así que
// los `md:`/`lg:` de Tailwind no se activan y la revisión móvil miente.
// ==========================================================================

import './style.css';
import { CRATE_TYPES, RANURAS_BARRA, consumibleAsignable } from './data/store';
import { CRISTAL_NOMBRE, CRISTAL_RAREZA } from './data/items';
import './style.modules.css';
import { renderLayoutHTML } from './ui/layout';
import { wirePreviewAudio } from './previewAudio';
import { renderPanel } from './ui/playerPanel';
import { renderBuffHudForPreview } from './ui/buffHud';
import { renderWarehouseTab, pintarBarraDeConsumibles } from './components/warehouse';
import { cambiaDePestana } from './ui/fichas';
import { renderStoreTab } from './components/store';
import { renderForgePage } from './ui/forgePage';
import { showPatchNotes } from './ui/patchNotes';
import { renderProfilePage } from './ui/profilePage';
import { renderPrestigePage } from './ui/prestigePage';
import { renderRankings } from './components/rankings';
import { renderCuotaAgotada } from './components/blocked';
import { muestraTarjetaDeEjemplo } from './previewTarjeta';
import { TIER_SYSTEM } from './data/tiers';
import { sellPrice } from './data/valuation';
import { AUTO_VENTA_POR_DEFECTO, coaccionaAutoVenta } from './data/autoventa';
import { baseSuccessChance, multiplicadorDeNivel, poderEfectivoDeCompanio, potencialNormalizado, desgloseDeStat } from './data/crafting';

const params = new URLSearchParams(location.search);
const width = params.get('w');
const height = params.get('h');
const vista = params.get('vista') || 'base';

if (width && height && !params.get('embedded')) {
  // El iframe no puede ser más ancho que la ventana del navegador, así que un
  // viewport de 1440px sobre una ventana de 800 se escalaría a la mitad y los
  // breakpoints dejarían de evaluarse bien. Para escritorio grande se permite
  // reducir la escala del iframe: el layout se calcula al ancho real y luego se
  // encoge visualmente, que es justo lo que se quiere ver.
  const scale = Number(params.get('scale') || '1');
  document.body.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:center;padding:16px;background:#0b0d12;min-height:100vh;overflow:auto">
      <div style="transform:scale(${scale});transform-origin:top center;flex-shrink:0">
        <iframe src="${location.pathname}?embedded=1&vista=${vista}&tema=${params.get('tema') || 'cyber-dark'}"
          width="${width}" height="${height}"
          style="border:1px solid #2a2f3a;border-radius:16px;background:#000;display:block;box-shadow:0 24px 70px -24px #000"></iframe>
      </div>
    </div>`;
  throw new Error('__preview_iframe__');
}

// El tema debe fijarse en el <body> ANTES de montar el layout: las clases
// .app-bg leen las variables CSS del tema, y sin esto se ve el tema por defecto
document.body.setAttribute('data-theme', params.get('tema') || 'cyber-dark');

// ==========================================================================
//  Datos de ejemplo
// ==========================================================================

const collector = (tier: number, over: Partial<any> = {}) => {
  const range = (TIER_SYSTEM.ranges as Record<number, [number, number]>)[tier] ?? [1, 5];
  const rarity = (TIER_SYSTEM.rarityByTier as Record<number, string>)[tier] ?? 'Común';
  return {
    id: `w${tier}_${over.id || 'x'}`,
    name: `Cañón de Datos T${tier}`,
    type: 'collector',
    details: `Recolección por click: +${range[1]}`,
    rarity,
    tier,
    // El potencial **suele venir**, porque en la partida lo tiene todo item
    // forjado o de caja y la carga lo pone. El mock no lo traia y las estrellas de
    // la ficha salian del valor por defecto de la funcion, no del item: eso es un
    // banco visual aprobando una pantalla que el producto no tiene.
    potential: 3,
    level: Math.min(20, tier * 2),
    damage: range[1],
    stackable: false,
    ...over
  };
};

const MOCK: any = {
  displayName: 'CyberKnight',
  nanites: 46_851_234,
  totalNanitesProduced: 412_000_000,
  passiveIncome: 1420,
  passiveMultiplier: 1.75,
  equippedCollectorId: 'forged_1',
  maxCompanionSlots: 5,
  warehouseCapacity: 20,
  totalClicks: 4820,
  totalInfraestructure: 0,
  cratesOpened: 128,
  // El cristal es un recurso. La cifra se elige para que la carta de la tienda
  // muestre un n�mero de intentos de T1 con decimales, que es lo que un jugador ve de
  // verdad: un saldo redondo no ense�ar�a si el redondeo funciona.
  crystals: 2_480,
  warehouse: [
    {
      id: 'forged_1',
      name: 'Forja de Éter PRIMIGENIA·Absoluta',
      type: 'collector',
      details: 'Daño base: +340',
      rarity: 'Divino',
      tier: 11,
      level: 12,
      maxLevel: 35,
      damage: 340,
      potential: 5,
      affixes: ['aff_prime', 'aff_focus', 'aff_eternal'],
      forgedBy: 'CyberKnight',
      forgedAt: Date.now() - 86_400_000 * 3,
      lineage: ['Legendario', 'Mítico', 'Mítico'],
      equipped: true
    },
    // **UN DIVINO AL TECHO DE NIVEL, Y ES PARA PODER REVISAR EL EFECTO PROPIO.** El otro
    // Divino de la lista está en 12 de 35, así que su brillo se queda en 2 y **con él
    // solo el almacén no alcanza ni para ver el escalón 4**. Sin un item al máximo, el
    // barrido y el doble anillo no se pueden mirar en ninguna pantalla, que es justo lo
    // que se pidió y lo único que no se puede comprobar con un número.
    collector(10, {
      id: 'forja_1',
      name: 'Forja de Éter ABSOLUTA',
      level: 35,
      maxLevel: 35,
      damage: 320,
      potential: 5,
      rarity: 'Divino',
      affixes: ['aff_prime', 'aff_focus'],
      forgedBy: 'CyberKnight',
      lineage: ['Legendario', 'Mítico', 'Mítico', 'Mítico', 'Mítico', 'Mítico'],
    }),
    collector(8, { id: 'a', name: 'Embestida Cuántica', level: 18, damage: 62 }),
    collector(7, { id: 'b', name: 'Lanza de Plasma', level: 9, damage: 44, potential: 2, affixes: ['aff_sharp'] }),
    collector(7, { id: 'c', name: 'Riel de Iones', level: 12, damage: 51 }),
    collector(7, { id: 'g', name: 'Martillo de Fase', level: 3, damage: 30 }),
    collector(6, { id: 'd', name: 'Pulso Nebula', level: 6, damage: 35 }),
    collector(5, { id: 'e', name: 'Cincel Orbital', level: 20, damage: 28, maxLevel: 20 }),
    collector(4, { id: 'f', name: 'Bastón de Chispas', level: 8, damage: 20 }),
    { id: 'c1', name: 'Avatar del Vacío', type: 'companion', potential: 3, details: 'Recolección por segundo: +65/s', rarity: 'Divino', tier: 10, power: 65 },
    { id: 'c2', name: 'Oráculo Tribal', type: 'companion', potential: 3, details: 'Multiplicador global +75%', rarity: 'Legendario', tier: 8, power: 0.75 },
    { id: 'c3', name: 'Titán de Acero', type: 'companion', potential: 3, details: 'Recolección por segundo: +68/s', rarity: 'Legendario', tier: 9, power: 68 },
    { id: 'c4', name: 'Dron Explorador', type: 'companion', potential: 3, details: 'Recolección por segundo: +6/s', rarity: 'Común', tier: 1, power: 6 },
    { id: 'c5', name: 'Fénix de Datos', type: 'companion', potential: 3, details: 'Recolección por segundo: +40/s', rarity: 'Mítico', tier: 9, power: 40 },
    // F52 · EL MOCK USA LOS NOMBRES DE VERDAD, Y ANTES NO.
    //
    // Decía "Caja Legendaria", que fue el nombre que tenían las cajas antes de F31:
    // entonces había cuatro, una por rareza. Desde que hay una caja por tier, la caja
    // legendaria se llama "Caja T8", y el motor la crea con el nombre de
    // `CRATE_TYPES[tier]`, que es de donde sale el lore.
    //
    // **El síntoma no es que el preview se quedara viejo: es que hacía imposible
    // revisar F52.** Con este nombre el objeto no encuentra su lore, la ficha sale sin
    // él y no hay forma de saber si el fallo es del mock o del juego. Un mock que
    // fabrica un objeto que el juego no fabrica mide un objeto que no existe — el mismo
    // criterio que se aplicó a los bancos, y por el mismo motivo.
    { id: 'cr1', name: CRATE_TYPES[8].name, type: 'crate', details: CRATE_TYPES[8].details, rarity: CRATE_TYPES[8].rarity, stackable: true, stackCount: 3 },
    { id: 'st1', name: 'Piedra de Calibración', type: 'consumable', details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', buffId: 'calibrationStone', stackable: true, stackCount: 7 },
    { id: 'nn1', name: 'Nanopartícula de Estabilidad', type: 'consumable', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', buffId: 'stabilityNano', stackable: true, stackCount: 2 },
    { id: 'af1', name: 'Tarjeta AFK', type: 'consumable', details: 'Permite juego sin la ventana activa 10 min (acumulable x3)', rarity: 'Raro', buffId: 'afk', stackable: true, stackCount: 2 },
    // La Click x2 está porque la barra de acceso rápido tiene una ranura puesta con ella, y
    // sin el item esa ranura saldría con el nombre y un 0: exactamente el estado que hay que
    // poder revisar, pero por el motivo equivocado.
    { id: 'cx2', name: 'Tarjeta Click x2', type: 'consumable', details: 'Otorga x2 al click por 30 segundos', rarity: 'Raro', buffId: 'clickX2', stackable: true, stackCount: 25 },
    // Y la Click x3 por un motivo más fino: con solo AFK y x2 en el almacén, la ranura
    // vacía del ejemplo abría el selector con **las tres opciones apagadas** —dos ya
    // estaban en otras ranuras y la tercera no la tenías—, y el preview no deja revisar el
    // caso que de verdad importa: elegir una y ver cerrarse la hoja.
    { id: 'cx3', name: 'Tarjeta Click x3', type: 'consumable', details: 'Otorga x3 al click por 30 segundos', rarity: 'Épico', buffId: 'clickX3', stackable: true, stackCount: 4 },
    // Cristales de mejora, y no por decoración: sin ellos el botón "Mejorar con
    // cristales" del almacén responde "No tienes cristales de mejora." y la
    // ruleta del sintonizador no se puede recorrer. El preview es la única
    // forma de mirar esa pantalla sin jugar una partida hasta el nivel 12, así
    // que si el ejemplo no trae cristales, la pantalla no existe para el que
    // la quiere mirar.
    // F52 · 'Cristal de Afino' y 'Cristal de Fase' eran los nombres ANTES de que los
    // cristales dejaran de tener nivel. Hoy hay uno solo, `CRISTAL_NOMBRE`, y el juego
    // no crea items de cristal: son un contador. El mock los trae igualmente porque sin
    // ellos el botón de mejorar con cristales y la ruleta del sintonizador no se pueden
    // revisar —lo dice el comentario de abajo—, pero los trae **con el nombre de
    // verdad**, que es lo único que hace que sirvan para mirar el lore.
    { id: 'xt1', name: CRISTAL_NOMBRE, type: 'crystal', details: 'Una unidad por intento de sintonización.', rarity: CRISTAL_RAREZA, tier: 1, stackable: true, stackCount: 40 },
  ],
  companions: [
    { id: 'c1', name: 'Avatar del Vacío', type: 'passive', power: 65, rarity: 'Divino', tier: 10 },
    { id: 'c2', name: 'Oráculo Tribal', type: 'multiplier', power: 0.75, rarity: 'Legendario', tier: 8 },
    { id: 'c3', name: 'Titán de Acero', type: 'passive', power: 68, rarity: 'Legendario', tier: 9 },
    { id: 'c5', name: 'Fénix de Datos', type: 'passive', power: 40, rarity: 'Mítico', tier: 9 }
  ],
  // **LOS CUATRO ACTIVOS, PERO NO LOS DOS T9 A LA VEZ.**
  //
  // `c3` y `c5` son los dos únicos compañeros de tier 9, y son también los dos
  // únicos con los que se puede **enseñar una fusión de compañeros en la
  // forja**: los demás tiers tienen uno solo. Con los cuatro activos, los dos
  // salen marcados "EQ", el yunque los rechaza con "desequípalo" y la pantalla
  // que se quería mirar no se puede llegar a ver.
  //
  // El motivo de fondo es el mismo que ya se escribió para los cristales: **el
  // `preview` es la única forma de mirar una pantalla sin jugar una partida hasta
  // el nivel 12**, así que si el ejemplo no trae la combinación que hace falta,
  // esa parte de la pantalla no existe para quien quiere mirarla.
  activeCompanions: ['c1', 'c2', 'c3'],
  unlockedAchievements: [
    'first_click', 'collector_10', 'crate_opener', 'jackpot', 'rich',
    'first_forge', 'smith_25', 'ascendant', 'hidden'
  ],
  // Prestigio
  cores: 24,
  totalCores: 61,
  resets: 3,
  forgedCount: 9,
  unlockedNodes: ['core_sink', 'core_edge', 'scrapyard', 'blueprint', 'auto_clicker', 'passive_loop', 'forge_luck'],
  nodeLevels: {
    core_sink: 4, core_edge: 3, scrapyard: 2, blueprint: 1,
    auto_clicker: 2, passive_loop: 3, forge_luck: 2, refinery: 1
  },
  bonus: {
    clickMult: 0.32, passiveMult: 0.42, costReduction: 0.04, sellMult: 0.12,
    craftLuck: 0.12, consolationBonus: 0, autoClick: 1, afkHours: 0, offlineClicks: 0,
    crateLuck: 0, coreGain: 0, storageSlots: 3, companionSlots: 1
  },
  // Cosméticos
  cosmetics: {
    title: 'title_smith_master',
    frame: 'frame_neon',
    banner: 'banner_abyss',
    unlocked: [
      'title_default', 'frame_none', 'banner_none',
      'title_recruited', 'title_smith', 'title_smith_master', 'title_ascended',
      'frame_steel', 'frame_neon', 'frame_ember',
      'banner_grid', 'banner_sunset', 'banner_abyss', 'banner_toxic'
    ]
  },
  buffs: {
    clickBoostExpiresAt: Date.now() + 24 * 60 * 1000 + 39000,
    passiveBoostExpiresAt: Date.now() + 39 * 60 * 1000 + 12000,
    clickX2ExpiresAt: 0,
    clickX3ExpiresAt: 0
  },
  afkCards: 2,
  afkExpiresAt: Date.now() + 8 * 60 * 1000 + 48000
};

// ==========================================================================
//  Juego de mentira
//
// Las páginas llaman al game loop real. En el preview se sustituye por un
// objeto con la misma forma y métodos que no tocan nada, para poder navegar
// y comprar sin Firebase.
// ==========================================================================

const noop = () => {};

// El estado se expone al window SOLO en el preview. Sirve para probar a mano
// los estados que son incómodos de alcanzar jugando: sin nanitas, con el
// almacén lleno, con la forja bloqueada.
if (import.meta.env.DEV) (window as any).__previewState = MOCK;

/** El filtro del preview. Vive fuera del estado a proposito: ver `getAutoVenta()`.
 */
const AUTO_VENTA_PREVIEW = { ...AUTO_VENTA_POR_DEFECTO, tipos: { ...AUTO_VENTA_POR_DEFECTO.tipos } };

/** Si el boton de apilar ya se ha pulsado en el preview. Ver `apilar()`. */
let PILAS_APILADAS = false;

/**
 * Lo que hay puesto en la barra de acceso rápido del ejemplo.
 *
 * **UNA PUESTA, UNA VACÍA Y OTRA PUESTA, A PROPÓSITO.** Con las tres puestas solo se ve el
 * botón que gasta, que es el estado que menos información da. Con una vacía se ve el hueco
 * punteado, y sin él no se puede revisar ni el ancho del hueco ni que abra la hoja.
 */
const PREVIEW_BARRA: (string | null)[] = ['afk', null, 'clickX2'];

const fakeGame: any = {
  getState: () => MOCK,
  getDisplayName: () => MOCK.displayName,
  isAfk: () => false,
  isPresent: () => true,
  getClickDamage: () => 1962,
  getAchievements: () => [
    { id: 'first_click', title: 'Primer Contacto', description: 'Recolecta por primera vez', icon: 'bolt', rewardText: '+2% daño de click', reward: { clickBonus: .02, passiveBonus: 0 }, unlocked: true, current: 1, target: 1 },
    { id: 'collector_10', title: 'Coleccionista', description: 'Equipa 10 recolectores', icon: 'collector', rewardText: '+5% daño de click', reward: { clickBonus: .05, passiveBonus: 0 }, unlocked: true, current: 10, target: 10 },
    { id: 'crate_opener', title: 'Rompechaves', description: 'Abre 10 cajas', icon: 'crate', rewardText: '+12% ingreso pasivo', reward: { clickBonus: 0, passiveBonus: .12 }, unlocked: true, current: 128, target: 10 },
    { id: 'first_forge', title: 'Primera Chispa', description: 'Forja tu primera recolector', icon: 'hammer', rewardText: '+5% click · Título', reward: { clickBonus: .05, passiveBonus: 0 }, unlocked: true, current: 1, target: 1 },
    { id: 'smith_25', title: 'Maestro de Forja', description: 'Forja 25 recolectores con éxito', icon: 'anvil', rewardText: '+10% click y +10% pasivo', reward: { clickBonus: .1, passiveBonus: .1 }, unlocked: true, current: 9, target: 25 },
    { id: 'ascendant', title: 'Ascendido', description: 'Recicla tu progreso 5 veces', icon: 'recycle', rewardText: '+20% click y +20% pasivo', reward: { clickBonus: .2, passiveBonus: .2 }, unlocked: true, current: 3, target: 5 },
    { id: 'tycoon', title: 'Barón de Nanobots', description: 'Alcanza 5.000 Nanitas por segundo', icon: 'sparkle', rewardText: '+30% click y +30% pasivo', reward: { clickBonus: .3, passiveBonus: .3 }, unlocked: false, current: 1420, target: 5000 },
    { id: 'hidden', title: '???', description: 'Cien cajas. Ni una más.', icon: 'crate', rewardText: 'Banner oculto', reward: { clickBonus: 0, passiveBonus: 0 }, unlocked: true, current: 128, target: 100 }
  ],
  getCapacity: () => MOCK.warehouseCapacity + MOCK.bonus.storageSlots,
  getCompanionSlots: () => MOCK.maxCompanionSlots + MOCK.bonus.companionSlots,
  getAfkDurationMs: () => 600_000,
  getSellPrice: (id: string) => {
    const w = MOCK.warehouse.find((x: any) => x.id === id);
    if (!w) return 0;
    // Usa la valoracion real, no un numero inventado: asi lo que se ve en
    // el preview es lo mismo que se vera en la partida.
    if (w.type === 'collector') return sellPrice(w, { sellMult: 1 + MOCK.bonus.sellMult });
    return Math.floor((w.sellPrice || 1500) * (1 + MOCK.bonus.sellMult));
  },
  // El stat principal de la ficha, con las MISMAS funciones que el motor. Si aquí se
  // pusiera un numero inventado, el preview enseñaria una ficha que el producto no tiene,
  // que es el mismo fallo que el recolector equipado que faltaba en el mock.
  getStatPrincipal: (id: string) => {
    const w: any = MOCK.warehouse.find((x: any) => x.id === id);
    if (!w) return null;
    if (w.type === 'collector') {
      return {
        tipo: 'collector',
        valor: Math.round((w.damage || 0) * multiplicadorDeNivel(w.level)),
        etiqueta: 'Recolección por click',
        prefijo: '+',
        sufijo: '',
        desglose: desgloseDeStat(w.tier, w.damage || 0, potencialNormalizado(w.potential), w.level,
          Math.round((w.damage || 0) * multiplicadorDeNivel(w.level)))
      };
    }
    if (w.type === 'companion') {
      const comp: any = MOCK.companions.find((c: any) => c.id === w.id);
      const tipo = comp?.type ?? w.companionType ?? 'click';
      const power = Number(comp?.power ?? w.power) || 0;
      const esMult = tipo === 'multiplier';
      return {
        tipo: 'companion',
        subtipo: tipo,
        valor: esMult
          ? Math.round((1 + power) * 100) / 100
          : poderEfectivoDeCompanio({ power, level: w.level }),
        etiqueta: esMult ? 'Multiplica el ingreso'
          : tipo === 'passive' ? 'Producción por segundo'
            : 'Ingreso por segundo',
        prefijo: esMult ? '×' : '+',
        sufijo: esMult ? '' : '/s',
        desglose: esMult ? [] : desgloseDeStat(w.tier, power, potencialNormalizado(w.potential), w.level,
          esMult ? 0 : poderEfectivoDeCompanio({ power, level: w.level }))
      };
    }
    return null;
  },
  /**
   * Las filas aditivas del stat, con la misma cuenta que el motor: base del item, y
   * una fila por cada multiplicador que mueva el suelo. Sin el grupo de la partida,
   * porque el número grande de al lado es el del objeto.
   *
   * Sin esto el hover del almacén no sale en el preview —la cuarta vez que el preview se
   * queda corto por un método que el producto tiene—. La cuenta se hace aquí porque en un
   * mock no hay motor al que preguntarle, pero **la forma es la misma**: sin la fila del
   * potencial y la del nivel, el hover del preview enseñaría una base pelada.
   */
  getStatFilas: (id: string) => {
    const w: any = MOCK.warehouse.find((x: any) => x.id === id);
    const vacio = { base: 0, total: 0, filas: [] as any[] };
    if (!w) return vacio;
    const nivel = Math.max(0, Math.floor(Number(w.level) || 0));
    const pot = Math.max(1, Math.min(5, Math.round(Number(w.potential) || 3)));
    const multPot = 1 + 0.2 * pot;
    const esRecolector = w.type === 'collector';
    const base = esRecolector
      ? (Number(w.damage) || 0) / multPot
      : (Number(w.power) || 0);
    const filas: any[] = [];
    let acum = base;
    let mostrado = Math.floor(acum);
    const anota = (nombre: string, detalle: string, mult: number) => {
      if (Math.abs(mult - 1) <= 0.0001) return;
      acum *= mult;
      const ahora = Math.floor(acum);
      if (ahora === mostrado) return;
      filas.push({ nombre, detalle, suma: ahora - mostrado });
      mostrado = ahora;
    };
    anota(`Potencial ${pot}★`, `${Math.round((multPot - 1) * 100)}% más`, multPot);
    if (nivel > 0) anota(`Nivel ${nivel}`, esRecolector ? 'del recolector' : 'del compañero', multiplicadorDeNivel(nivel));
    return { base: Math.floor(base), total: Math.floor(acum), filas };
  },
  /**
   * El filtro de auto-venta, **en memoria y no en el estado del mock**.
   *
   * Va en una variable del módulo y no en `MOCK` porque el preview se reinicia con la
   * página: un filtro que se queda puesto entre navegaciones del preview haría creer que
   * está guardado, y en el producto sí lo está. Aquí solo hace falta que la casilla se
   * pueda encender y ver el texto, que es lo que se está revisando.
   */
  getAutoVenta: () => coaccionaAutoVenta(AUTO_VENTA_PREVIEW),
  setAutoVenta: (parcial: any) => {
    Object.assign(AUTO_VENTA_PREVIEW, coaccionaAutoVenta({
      ...AUTO_VENTA_PREVIEW,
      ...parcial,
      tipos: { ...AUTO_VENTA_PREVIEW.tipos, ...(parcial?.tipos ?? {}) }
    }));
    return AUTO_VENTA_PREVIEW;
  },
  /**
 * Apilar, en el preview. El boton de la pantalla lo lee con `planApilar()`, asi que sin
 * estos dos metodos sale apagado y no se puede ni revisar.
 *
 * El preview **simula** el efecto en vez de reordenar el almacen de verdad: el boton tiene
 * que verse, encenderse y apagar, que es lo que se revisa; lo que hace con las celdas es
 * del motor y lo comprueban sus bancos.
 */
planApilar: () => (PILAS_APILADAS
  ? { liberadas: 0, grupos: [] }
  : { liberadas: 3, grupos: [{ nombre: 'Piedra de Calibración', unidades: 26 }] }),
apilar: () => {
  const r = PILAS_APILADAS
    ? { ok: false as const, liberadas: 0, msg: 'Ya esta todo apilado.' }
    : { ok: true as const, liberadas: 3, msg: 'Apilado. 3 celdas libres.' };
  PILAS_APILADAS = true;
  return r;
},
getPrestigeInfo: () => ({ cores: MOCK.cores, totalCores: MOCK.totalCores, pending: 8, resets: MOCK.resets, bonus: MOCK.bonus }),
  // -------------------------------------------------------------------------
  //  LA VENTA EN LOTE, Y POR QUÉ FALTA ESTO EN EL MOCK.
  //
  //  Sin estos dos métodos, `multiSelBar()` lanza al pintar y el almacén entero se queda
  //  sin repintar: se ve el interruptor, se pulsa y no pasa absolutamente nada, sin
  //  error en pantalla. Es la **tercera** vez que el preview se queda corto por un
  //  método que el producto tiene —la primera fue el recolector equipado, la segunda el
  //  stat principal— y las tres se$[...]  same: el banco visual aprueba una pantalla que
  //  el producto no puede pintar.
  //
  //  La regla que se cumple aquí es la misma que en el juego: el plan y la venta leen la
  //  MISMA cuenta, así que el botón no puede anunciar una cifra y el cobro otra.
  // -------------------------------------------------------------------------
  /**
   * El plan del consumible en el preview, **y porque hay que verlo.**
   *
   * El boton se apaga cuando no cabe ni una, asi que sin esto el dialogo de usar un
   * consumible no aparece nunca en el banco de pruebas y el selector de cantidad no se
   * puede revisar. El tope sale de la propia pila: **una tarjeta AFK da tres y un expansor
   * da uno**, que es lo que hace que se vea el caso de "solo cabe una" sin selector.
   */
  planUseConsumable: (id: string) => {
    const w = (MOCK.warehouse as any[]).find((x: any) => x.id === id);
    if (!w) return { unidades: 0, max: 0, motivo: 'Ese item ya no esta en el almacen.' };
    if (w.type !== 'consumable') return { unidades: 0, max: 0, motivo: 'Esto no se puede usar.' };
    if (w.buffId === 'calibrationStone' || w.buffId === 'stabilityNano') {
      return { unidades: 0, max: 0, motivo: 'Este consumible se usa en la Forja.' };
    }
    const n = w.stackable ? (w.stackCount || 1) : 1;
    const tope = w.buffId === 'afk' ? 3 : 1;
    const unidades = Math.min(n, tope);
    return {
      unidades,
      max: unidades,
      motivo: unidades > 0 ? null : 'El efecto ya esta al tope.'
    };
  },
  /** El gasto en lote del preview: uno por unidad, que es lo que ve el banco. */
  useConsumable: (id: string, units = 1) => {
    const plan = fakeGame.planUseConsumable(id);
    if (plan.unidades <= 0) return { ok: false, usadas: 0, msg: plan.motivo };
    const usadas = Math.max(1, Math.min(units, plan.unidades));
    return { ok: true, usadas, msg: usadas === 1 ? 'aplicado' : usadas + ' aplicados' };
  },

  /**
   * La barra de acceso rápido, con sus tres métodos, **y por qué están los tres**.
   *
   * El preview tiene su propio stub de juego y no llama a `updateUI()`, así que la barra
   * se pinta contra `fakeGame` y **necesita los tres métodos que el producto tiene**. Sin
   * ellos la barra sale vacía o con tres huecos muertos, y el banco visual aprueba una
   * pantalla que el producto no puede usar: es la cuarta vez que el preview se queda corto
   * por un método que falta, y siempre por el mismo motivo —no se mira lo que se pinta.
   *
   * El reparto del ejemplo pone **una ranura con AFK, una vacía y otra con Click x2**,
   * porque son los tres estados que hay que poder revisar: el botón que gasta, el hueco
   * punteado que abre el selector y el que muestra el número. Con las tres puestas solo se
   * vería uno de ellos.
   */
  getBarraConsumibles: () => {
    const reparto = [PREVIEW_BARRA[0], PREVIEW_BARRA[1], PREVIEW_BARRA[2]];
    return reparto.map((buffId: string | null, ranura: number) => {
      const ficha = consumibleAsignable(buffId);
      const item: any = ficha
        ? (MOCK.warehouse as any[]).find(
            (x: any) => x.type === 'consumable' && x.buffId === ficha.buffId)
        : null;
      return {
        ranura,
        buffId: ficha ? ficha.buffId : null,
        itemId: item ? item.id : null,
        item,
        nombre: ficha ? ficha.name : '',
        detalles: ficha ? ficha.details : '',
        unidades: item ? (item.stackable ? (item.stackCount || 1) : 1) : 0,
        plan: item
          ? fakeGame.planUseConsumable(item.id)
          : { unidades: 0, max: 0, motivo: null },
      };
    });
  },
  asignarBarraConsumible: (ranura: number, buffId: string | null) => {
    const i = Math.floor(Number(ranura));
    if (!Number.isInteger(i) || i < 0 || i >= RANURAS_BARRA) {
      return { ok: false, msg: 'Esa ranura no existe.' };
    }
    if (buffId === null) { PREVIEW_BARRA[i] = null; return { ok: true }; }
    const ficha = consumibleAsignable(buffId);
    if (!ficha) return { ok: false, msg: 'Ese consumible no se puede asignar aquí.' };
    const otra = PREVIEW_BARRA.indexOf(ficha.buffId);
    if (otra !== -1 && otra !== i) {
      return { ok: false, msg: `${ficha.name} ya está en la ranura ${otra + 1}.` };
    }
    PREVIEW_BARRA[i] = ficha.buffId;
    return { ok: true };
  },
  usarBarraConsumible: (ranura: number) => {
    const h = fakeGame.getBarraConsumibles()[Math.floor(Number(ranura))];
    if (!h) return { ok: false, msg: 'Esa ranura no existe.' };
    if (!h.buffId) return { ok: false, msg: 'No hay nada asignado en esa ranura.' };
    if (!h.itemId) return { ok: false, msg: `No tienes ninguna ${h.nombre} en el almacén.` };
    return fakeGame.useConsumable(h.itemId);
  },
  planSellMany: (ids: string[]) => {
    const vendibles: any[] = [];
    const bloqueados: any[] = [];
    const quedan = new Map<string, number>();
    for (const w of MOCK.warehouse) quedan.set(w.type, (quedan.get(w.type) ?? 0) + 1);
    for (const id of (ids || [])) {
      const w: any = MOCK.warehouse.find((x: any) => x.id === id);
      if (!w) { bloqueados.push({ id, motivo: 'ya no está en el almacén' }); continue; }
      const equipado = (w.type === 'collector' && MOCK.equippedCollectorId === w.id) ||
        (w.type === 'companion' && (MOCK.activeCompanions || []).includes(w.id));
      if (equipado) { bloqueados.push({ id, motivo: 'está equipado' }); continue; }
      if (w.type === 'collector' || w.type === 'companion') {
        const queda = (quedan.get(w.type) ?? 0) - 1;
        quedan.set(w.type, queda);
        if (queda <= 0) { bloqueados.push({ id, motivo: 'es el último de su tipo' }); continue; }
      }
      const units = Math.max(1, Math.floor(Number(w.stackCount) || 1));
      vendibles.push({ id, units, total: units * 100 });
    }
    return { vendibles, bloqueados, total: vendibles.reduce((a, v) => a + v.total, 0) };
  },
  sellMany: (ids: string[]) => {
    const plan = fakeGame.planSellMany(ids);
    if (plan.vendibles.length === 0) {
      return { ok: false, msg: 'No se puede vender nada.', gained: 0, sold: 0, bloqueados: plan.bloqueados };
    }
    MOCK.warehouse = MOCK.warehouse.filter((w: any) => !plan.vendibles.some((v: any) => v.id === w.id));
    MOCK.nanites += plan.total;
    return { ok: true, gained: plan.total, sold: plan.vendibles.length, bloqueados: plan.bloqueados };
  },
  getForgeInfo: () => ({ craftLuck: MOCK.bonus.craftLuck, baseChance: (t: number) => baseSuccessChance(t) + MOCK.bonus.craftLuck }),
  /**
   * Que da la carta, para que la ficha del mercado enseñe el producto y no solo el
   * precio: con "Precio 200" y "Tienes 213" al lado no hay forma de saber cual es cual.
   * El preview usa la misma regla que el motor --una carta de cristal da un intento
   * entero de subida--, porque un numero inventado en el banco es peor que ninguno.
   */
  getStoreItemYield: (itemKey: string) => (itemKey === 'upgradeCrystal'
    ? { unidades: 200, recurso: 'cristales' }
    : { unidades: 0, recurso: null }),
  buyStoreItem: () => true,
  buyNode: () => ({ success: true, msg: 'Nodo comprado' }),
  prestige: () => ({ success: true, gained: 8, msg: '+8 núcleos' }),
  forgeCollector: () => ({ success: true, collector: MOCK.warehouse[0], chance: 0.5, msg: 'ok' }),
  // La fusión de compañeros también necesita su propio tropo en el `preview`, o el
  // botón FORJAR de la pestaña de compañeros daría `undefined` y la ruleta se
  // quedaría en blanco sin decir por qué. Un tropo que devuelve algo raro es peor
  // que uno que no existe: parece un fallo de la pantalla.
  forgeCompanion: () => ({
    success: true,
    companion: { id: 'mock_forjado', name: 'Dron Explorador', type: 'click', power: 214, rarity: 'Épico', tier: 4, potential: 4 },
    chance: 0.5,
    msg: 'ok'
  }),
  equipCollector: noop,
  equipCompanion: noop,
  equipCosmetic: () => true,
  updateState: noop,
  cancelBuff: noop,
  expandWarehouse: () => true,
  unlockCompanionSlot: () => true,
  openCrateBox: () => null,
  // El mock tiene que respetar el CONTRATO del motor entero, no solo devolver
  // algo. `upgradeEquippedCollector` devuelve `rolled` para que el selector sepa
  // si hubo tirada, y además SUBE el nivel cuando acierta. Lo segundo parece
  // un detalle y no lo es: la ruleta pinta tres cosas sobre un mismo hecho —la
  // casilla, el titular y el mensaje— y las tres tienen que concordar. Un mock
  // que dice "éxito" sin subir el nivel deja la pantalla diciendo "FALLO" en la
  // casilla y "¡Mejora exitosa!" en el mensaje, que es una ruleta mintiendo a
  // propósito en el sitio donde el jugador mira para comprobar que miente.
  upgradeEquippedCollector: () => {
    const eq = MOCK.warehouse.find((w: any) => w.id === MOCK.equippedCollectorId);
    const antes = eq?.level ?? 0;
    if (eq) eq.level = antes + 1;
    return {
      success: true,
      rolled: true,
      level: antes + 1,
      msg: `¡Mejora exitosa! ${eq?.name ?? 'El recolector'} ascendió al nivel ${antes + 1}.`
    };
  }
};

// ==========================================================================
//  Montaje
// ==========================================================================

/**
 * Reparte el ingreso de los compañeros como lo hace el game loop.
 *
 * POR QUÉ ESTA FUNCIÓN ESTÁ AQUÍ Y NO SE IMPORTA DEL MOTOR. `getCompanionOutput`
 * vive en la API de `createGameLoop()`, que arrastra Firebase y todo el estado:
 * el preview no tiene game loop, y montear uno aquí sería un segundo motor que
 * no es el de verdad. Lo que se quiere del preview es comprobar que la ficha
 * pinta la cifra que le llega, y eso se comprueba pasándole una.
 *
 * El reparto es proporcional al `power` con el resto redondeado hacia arriba, que
 * es la misma regla que `repartirPorCompanion()`: la suma da exactamente el
 * ingreso y ningún compañero se queda sin su parte. Que sea una COPIA y no la
 * original es lo que obliga a que el banco siga mirándola, y por eso el
 * `senalCheck` es el que ata la regla de verdad.
 */
function repartoProporcional(mock: any): (id: string) => number {
  const aportan = (mock.activeCompanions || [])
    .map((id: string) => (mock.companions || []).find((c: any) => c.id === id))
    .filter((c: any) => c && c.type !== 'multiplier') as any[];
  const pesos = aportan.map(c => Math.max(0, c.power || 0));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  if (!sumaPesos) return () => 0;

  // Sin multiplicadores en el mock: el ingreso es la suma de los pesos.
  const total = sumaPesos;
  const salida = new Map<string, number>();
  let asignado = 0;
  const partes = pesos.map(p => {
    const entero = Math.floor((total * p) / sumaPesos);
    asignado += entero;
    return entero;
  });
  for (let i = 0; total - asignado > 0; i = (i + 1) % partes.length, asignado++) {
    partes[i]++;
  }
  aportan.forEach((c, i) => salida.set(c.id, partes[i]));
  return (id: string) => salida.get(id) ?? 0;
}

const app = document.querySelector('#app') as HTMLElement;

// En el preview la navegación se simula: cada botón lleva a la vista que
// tenga en la URL, para poder recorrerlas todas sin Firebase.
//
// **ESTO ES UNA FUNCIÓN QUE NAVEGA, NO UNA QUE DEVUELVE UNA FUNCIÓN**, y antes era
// al revés. `wireNav` llama `go(ruta)` esperando que navegue; con la fábrica,
// `ir('tienda')` devolvía otra función sin hacer nada y el clic se perdía en
// silencio.
//
// Solo se notaba ahora porque **antes las páginas no tenían botones de `data-nav`
// que no fueran el `‹` de volver**, que iba por su propio camino. Al poner las
// barras en todas las pantallas, cada página ha recibido seis botones nuevos que
// usan `go`, y el `preview` —que es lo que se usa para mirar cómo queda— era el
// único sitio donde no funcionaban. El juego real usa `router.goTo()`, que sí
// tiene la firma correcta: esto era un cable mal puesto en el mostrador, no en el
// motor.
const ir = (destino: string) => {
  const q = new URLSearchParams(location.search);
  q.set('vista', destino);
  location.href = location.pathname + '?' + q.toString();
};

switch (vista) {
  case 'cuota':
    // B34 · La pantalla de cuota agotada, con datos de ejemplo.
    //
    // **POR QUÉ NECESITA UNA VISTA PROPIA Y NO SE PUEDE REVISAR EN EL BANCO.** `verify/`
    // sustituye el DOM por un `domStub`, así que una prueba **no puede pintarla ni medir si
    // cabe en un móvil**: una comprobación ahí pasaría en verde sin haber mirado un solo
    // píxel. Y esta pantalla es **la que el jugador ve cuando algo va mal**, o sea que es
    // justo la que menos conviene mirar a ciegas: si el texto no cabe a 390 px, se sale de
    // la pantalla y el jugador no lee la parte que explica que su partida está bien.
    //
    // **Y POR QUÉ SE PIDE CON EL ANCHO Y EL ALTO EN LA URL.** Porque lo que hay que mirar
    // es el móvil, no el escritorio. En un monitor todo cabe; en 390×844 es donde falla.
    renderCuotaAgotada(app, () => { /* el botón recarga; aquí no recarga nada */ });
    break;
  case 'almacen':
    renderWarehouseTab(app, fakeGame, noop, ir);
    break;
  case 'tienda':
    renderStoreTab(app, fakeGame, ir);
    break;
  case 'forja':
    renderForgePage(app, fakeGame, ir);
    break;
  case 'perfil':
    renderProfilePage(app, fakeGame, () => ir('prestigio'), ir);
    break;
  case 'prestigio':
    renderPrestigePage(app, fakeGame, ir);
    break;
  case 'notas':
    // El cartel de notas de parche, y solo el cartel. Vive en `main.ts`, que es donde se
    // llama al entrar, así que sin esta vista **no hay forma de mirarlo sin jugar**:
    // `verify/` no puede pintarlo —necesita DOM de verdad— y la pantalla de acceso no lo
    // enseña. Con esta vista se puede revisar el texto, el ancho y que en un móvil de
    // 390 px la lista de ocho líneas cabe con su botón.
    //
    // Y sale aunque el jugador ya lo haya visto: la preferencia vive en el
    // almacenamiento local y aquí interesa verla, no respetar el estado de nadie.
    showPatchNotes();
    break;
  case 'ranking':
    renderRankings(app, { uid: 'me' }, ir, MOCK);
    break;
  case 'tarjeta':
    // La hoja de la tarjeta de otro jugador, con datos de ejemplo. Va en su propia vista
    // porque **es una hoja encima de otra pantalla**, no una página: lo que hay que
    // revisar es si tapa la pantalla de debajo y si el fondo se ve como debe.
    app.innerHTML = renderLayoutHTML(MOCK, 'cyber-dark', 'base', {
      onNavigate: noop, onLogout: noop,
      onToggleMute: noop, onToggleMusic: noop, onThemeChange: noop
    }, undefined, MOCK);
    // La barra se pinta aqui porque el preview no llama a updateUI(): tiene su propio
    // render. Sin esto la barra sale vacia en el preview y no hay forma de revisarla.
    pintarBarraDeConsumibles(fakeGame, noop);
    //
    // barra sale vacía en el preview y **no hay forma de revisarla**, que es exactamente
    muestraTarjetaDeEjemplo();
    break;
  default:
    // El estado va porque la cabecera pinta la franja de recursos desde él. Sin esto,
    // el `preview` salía con la cabecera vacía de saldos y no se podía revisar cómo se
    // ven —que es la mitad de lo que se escribe aquí—, y el fallo era invisible: se
    // veía "no hay recursos", no "falta el argumento".
    app.innerHTML = renderLayoutHTML(MOCK, 'cyber-dark', 'base', {
      onNavigate: noop, onLogout: noop,
      onToggleMute: noop, onToggleMusic: noop, onThemeChange: noop
    }, undefined, MOCK);
    // La barra se pinta aqui porque el preview no llama a updateUI(): tiene su propio
    // render. Sin esto la barra sale vacia en el preview y no hay forma de revisarla.
    pintarBarraDeConsumibles(fakeGame, noop);
    //
    // barra sale vacía en el preview y **no hay forma de revisarla**, que es exactamente

    // El cuarto argumento es la cifra REAL que aporta cada compañero, con los
    // multiplicadores ya puestos. Sin él, `renderPanel` cae a `comp.power` y el
    // preview enseñaría "+65/s" donde el juego pinta otra cosa: el banco visual
    // estaría mirando un número que el juego nunca enseña, que es la forma más
    // fácil de aprobar un cambio roto.
    //
    // Aquí no se replica el reparto del game loop (R2): el preview no tiene
    // motor, así que se le da el mismo `power` repartido en la misma proporción
    // y el efecto que se revisa es el de que la cifra viene del motor.
    const ingresoDe = repartoProporcional(MOCK);
    // **Y LA LISTA DE BONOS, QUE SIN ELLA NO SE REVISA NADA DE ESA TARJETA.** El mock no
    // tiene motor, así que los multiplicadores salen de su propio estado y en el MISMO
    // orden que la fórmula: nivel, compañeros, logros, árbol, afijos, buff. Un mock que no
    // coincide con el producto es un banco visual aprobando una pantalla que el juego no
    // tiene, y ya ha pasado cuatro veces con esta tarjeta.
    // **LAS DOS PARTES DEL DANO, CON LA MISMA REGLA QUE EL MOTOR.** El preview no tiene
    // motor, asi que los multiplicadores salen de su propio estado; lo que no puede
    // cambiar es la estructura: la base se deduce del dano guardado porque este ya
    // lleva el potencial, las filas van en el MISMO orden que la formula, y el
    // acumulado va en float mientras lo que se pinta es el suelo. Un mock que no
    // coincide con el producto es un banco visual aprobando una pantalla que el juego
    // no tiene, y con esta tarjeta ya ha pasado cinco veces.
    const damagePartsDe = () => {
      const w: any = MOCK.warehouse.find((x: any) => x.id === MOCK.equippedCollectorId);
      const pot = w?.potential ?? 3;
      const multPot = 1 + 0.2 * pot;
      const base = (w?.damage || 0) / multPot;
      const filas: Array<{ nombre: string; detalle: string; suma: number; grupo: 'item' | 'partida' }> = [];
      let acum = base;
      let mostrado = Math.floor(acum);
      let delItem = 0;
      const anota = (nombre: string, detalle: string, mult: number, grupo: 'item' | 'partida') => {
        if (Math.abs(mult - 1) <= 0.0001) return;
        acum *= mult;
        const ahora = Math.floor(acum);
        if (ahora === mostrado) return;
        const salto = ahora - mostrado;
        filas.push({ nombre, detalle, suma: salto, grupo });
        if (grupo === "item") delItem += salto;
        mostrado = ahora;
      };
      anota(`Potencial ${pot}★`, `${Math.round((multPot - 1) * 100)}% más de daño`, multPot, "item");
      anota(`Nivel ${w?.level || 0}`, 'del recolector', multiplicadorDeNivel(w?.level), 'item');
      anota("Afijos", "del item", 1.26, "item");
      anota('Compañeros', 'de la partida', 1 + (MOCK.activeCompanions?.length || 0) * 0.05, 'partida');
      anota('Logros', 'de la partida', 1.28, 'partida');
      anota('Árbol de pasivas', 'de la partida', 1 + MOCK.bonus.clickMult, 'partida');
      anota('Buff de click', 'temporal', 1, 'partida');
      const total = Math.floor(acum);
      return {
        base: Math.floor(base),
        intrinseco: Math.floor(base) + delItem,
        partida: total - Math.floor(base) - delItem,
        total,
        filas
      };
    };
    // Y el numero grande sale de la MISMA cadena que el desglose, no de un literal:
    // pasaba 1962 a mano y la tarjeta ensenaba un total arriba y una lista que no
    // llegaba a ese total.
    renderPanel(MOCK, damagePartsDe().total, MOCK.maxCompanionSlots + MOCK.bonus.companionSlots, ingresoDe, damagePartsDe);
    renderBuffHudForPreview(MOCK);
}

// LA DELEGACIÓN DE LA CABECERA, UNA VEZ Y PARA LAS SIETE VISTAS.
//
// El juego la monta `renderBase`, con un solo `app.onclick` que cubre `data-nav`,
// `data-audio`, `data-logout` y la hoja de ajustes. El preview pinta las mismas
// cabeceras sin esa delegación, así que sin esto los botones se veían bien y no
// hacían nada.
//
// **ESTO ESTABA DENTRO DEL `DEFAULT`, Y ESO ERA OTRO BUG.** Solo la base quedaba
// cableada: en el almacén, en la Forja o en el mercado los interruptores y la hoja de
// ajustes no respondían. Es el mismo fallo que se vio con el recolector equipado que
// faltaba en el mock —el banco visual aprobando cosas que el producto no hace— y se
// repite porque las dos veces estaba en el sitio que se daba por supuesto.
wirePreviewAudio(app);

// **LAS PESTAÑAS DE LA COLUMNA DERECHA, EN EL PREVIEW TAMBIÉN.**
//
// El manejador del producto vive en `main.ts`, que el preview **no carga**: tiene su
// propio render. Sin esta línea las pestañas se ven y no hacen nada, y el banco visual
// aprueba una pantalla que el producto sí puede usar pero que aquí no se puede revisar.
// Es la misma clase de fallo que el de los interruptores de arriba, y por el mismo
// motivo: cableado donde se daba por supuesto en vez de donde se monta.
document.addEventListener('click', (ev) => {
  const destino = (ev.target as HTMLElement | null)?.closest('[data-pestana]');
  if (!destino) return;
  cambiaDePestana(destino.getAttribute('data-pestana') as string);
});

// Navegación entre vistas del preview: permite recorrer todas sin volver a la
// barra de direcciones. No existe en el juego real.
if (!params.get('embedded')) {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;z-index:9999;left:50%;transform:translateX(-50%);top:6px;display:flex;gap:4px;background:#111;border:1px solid #2a2f3a;border-radius:9999px;padding:4px 8px;font:11px ui-monospace,monospace';
  for (const v of ['base', 'almacen', 'forja', 'tienda', 'perfil', 'ranking', 'prestigio']) {
    const b = document.createElement('a');
    b.href = `${location.pathname}?${new URLSearchParams(
      Object.fromEntries([...params].filter(([k]) => k !== 'vista'))
    ).toString()}${params.toString() ? '&' : ''}vista=${v}`;
    b.textContent = v;
    b.style.cssText = `color:${v === vista ? '#38bdf8' : '#7c8798'};text-decoration:none;padding:2px 6px;border-radius:9999px`;
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
}
