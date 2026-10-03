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
import './style.modules.css';
import { renderLayoutHTML } from './ui/layout';
import { wirePreviewAudio } from './previewAudio';
import { renderPanel } from './ui/playerPanel';
import { renderBuffHudForPreview } from './ui/buffHud';
import { renderWarehouseTab } from './components/warehouse';
import { renderStoreTab } from './components/store';
import { renderForgePage } from './ui/forgePage';
import { renderProfilePage } from './ui/profilePage';
import { renderPrestigePage } from './ui/prestigePage';
import { renderRankings } from './components/rankings';
import { TIER_SYSTEM } from './data/tiers';
import { sellPrice } from './data/valuation';
import { baseSuccessChance } from './data/crafting';

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
  upgradeCrystals: 31,
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
    collector(8, { id: 'a', name: 'Embestida Cuántica', level: 18, damage: 62 }),
    collector(7, { id: 'b', name: 'Lanza de Plasma', level: 9, damage: 44, potential: 2, affixes: ['aff_sharp'] }),
    collector(7, { id: 'c', name: 'Riel de Iones', level: 12, damage: 51 }),
    collector(7, { id: 'g', name: 'Martillo de Fase', level: 3, damage: 30 }),
    collector(6, { id: 'd', name: 'Pulso Nebula', level: 6, damage: 35 }),
    collector(5, { id: 'e', name: 'Cincel Orbital', level: 20, damage: 28, maxLevel: 20 }),
    collector(4, { id: 'f', name: 'Bastón de Chispas', level: 8, damage: 20 }),
    { id: 'c1', name: 'Avatar del Vacío', type: 'companion', details: 'Recolección por segundo: +65/s', rarity: 'Divino', tier: 10, power: 65 },
    { id: 'c2', name: 'Oráculo Tribal', type: 'companion', details: 'Multiplicador global +75%', rarity: 'Legendario', tier: 8, power: 0.75 },
    { id: 'c3', name: 'Titán de Acero', type: 'companion', details: 'Recolección por segundo: +68/s', rarity: 'Legendario', tier: 9, power: 68 },
    { id: 'c4', name: 'Dron Explorador', type: 'companion', details: 'Recolección por segundo: +6/s', rarity: 'Común', tier: 1, power: 6 },
    { id: 'c5', name: 'Fénix de Datos', type: 'companion', details: 'Recolección por segundo: +40/s', rarity: 'Mítico', tier: 9, power: 40 },
    { id: 'cr1', name: 'Caja Legendaria', type: 'crate', details: 'Contiene recompensas máximas', rarity: 'Legendario', stackable: true, stackCount: 3 },
    { id: 'st1', name: 'Piedra de Calibración', type: 'consumable', details: 'Sube 12 puntos la probabilidad de la próxima fusión', rarity: 'Raro', buffId: 'calibrationStone', stackable: true, stackCount: 7 },
    { id: 'nn1', name: 'Nanopartícula de Estabilidad', type: 'consumable', details: 'Deja el recolector forjado con un afijo garantizado', rarity: 'Legendario', buffId: 'stabilityNano', stackable: true, stackCount: 2 },
    { id: 'af1', name: 'Tarjeta AFK', type: 'consumable', details: 'Permite juego sin la ventana activa 10 min (acumulable x3)', rarity: 'Raro', buffId: 'afk', stackable: true, stackCount: 2 },
    // Cristales de mejora, y no por decoración: sin ellos el botón "Mejorar con
    // cristales" del almacén responde "No tienes cristales de mejora." y la
    // ruleta del sintonizador no se puede recorrer. El preview es la única
    // forma de mirar esa pantalla sin jugar una partida hasta el nivel 12, así
    // que si el ejemplo no trae cristales, la pantalla no existe para el que
    // la quiere mirar.
    { id: 'xt1', name: 'Cristal de Afino', type: 'crystal', details: 'x1 a la probabilidad de mejora.', rarity: 'Común', tier: 1, stackable: true, stackCount: 40 },
    { id: 'xt2', name: 'Cristal de Fase', type: 'crystal', details: 'x1.75 a la probabilidad de mejora.', rarity: 'Raro', tier: 2, stackable: true, stackCount: 12 }
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
  shards: 118,
  forgedCount: 9,
  unlockedNodes: ['core_sink', 'core_edge', 'scrapyard', 'blueprint', 'auto_clicker', 'passive_loop', 'forge_luck'],
  nodeLevels: {
    core_sink: 4, core_edge: 3, scrapyard: 2, blueprint: 1,
    auto_clicker: 2, passive_loop: 3, forge_luck: 2, refinery: 1
  },
  bonus: {
    clickMult: 0.32, passiveMult: 0.42, costReduction: 0.04, sellMult: 0.12,
    craftLuck: 0.12, shardBonus: 0, autoClick: 1, afkHours: 0, offlineClicks: 0,
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
  getPrestigeInfo: () => ({ cores: MOCK.cores, totalCores: MOCK.totalCores, pending: 8, resets: MOCK.resets, bonus: MOCK.bonus }),
  getForgeInfo: () => ({ shards: MOCK.shards, craftLuck: MOCK.bonus.craftLuck, baseChance: (t: number) => baseSuccessChance(t) + MOCK.bonus.craftLuck }),
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
  case 'ranking':
    renderRankings(app, { uid: 'me' }, ir);
    break;
  default:
    app.innerHTML = renderLayoutHTML(MOCK, 'cyber-dark', 'base', {
      onNavigate: noop, onLogout: noop,
      onToggleMute: noop, onToggleMusic: noop, onThemeChange: noop
    });

    // Los interruptores de audio se conectan aquí también. En el juego lo hace
    // `renderBase` con un listener delegado en `#app`; el preview pinta la
    // misma cabecera pero sin esa delegación, así que sin esto los botones se
    // ven bien y no hacen nada, que es justo lo que hay que comprobar al
    // revisar un cambio de audio.
    wirePreviewAudio(app);
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
    renderPanel(MOCK, 1962, MOCK.maxCompanionSlots + MOCK.bonus.companionSlots, ingresoDe);
    renderBuffHudForPreview(MOCK);
}

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
