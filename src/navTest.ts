// ==========================================================================
//  Recorrido automático de la navegación
//
//  Se pulsa cada control real y se comprueba a dónde lleva. Probar el módulo
//  del router por separado no sirve: el fallo que había era de cableado —el
//  `go` que no llegaba a dos páginas, y el `mountInto` que dejaba a `main.ts`
//  con una referencia a un nodo desconectado—, y eso solo aparece al pulsar.
//
//  `?recorrido=1` en la URL lo arranca. Los errores se acumulan en
//  `window.__erroresRecorrido` para poder leerlos desde fuera.
// ==========================================================================

// Los estilos SÍ se importan: sin ellos, `getBoundingClientRect` mide el HTML
// desnudo y no se puede comprobar ni el centrado ni el tamaño táctil.
import './style.css';
import './style.modules.css';

import { renderRankings } from './components/rankings';
import { renderStoreTab } from './components/store';
import { renderForgePage } from './ui/forgePage';
import { renderProfilePage } from './ui/profilePage';
import { renderPrestigePage } from './ui/prestigePage';
import { renderWarehouseTab } from './components/warehouse';
import { Router, type Route } from './ui/router';
import { renderLayoutHTML } from './ui/layout';
import { renderPanel } from './ui/playerPanel';
import { wirePreviewAudio } from './previewAudio';

// Estado mínimo para que las páginas pinten algo.
const noop = () => {};
const MOCK: any = {
  displayName: 'Recorrido',
  nanites: 46900000, totalNanitesProduced: 46900000, totalClicks: 8420,
  keys: 3, keysByTier: { 0: 3, 1: 0, 2: 0, 3: 0 },
  upgradeCrystals: 5, crystalsByTier: { 1: 5 }, crystalTotal: 5,
  warehouseCapacity: 20, maxCompanionSlots: 3, cratesOpened: 12,
  crates: { common: 1, rare: 0, epic: 0, legendary: 0 },
  equippedCollectorId: 'w1', activeCompanions: [],
  companions: [], buffs: {},
  core: 0, cores: 12, totalCores: 40, resets: 3,
  cosmetic: { title: '', frame: '', banner: '' },
  cosmetics: { unlocked: [], title: '', frame: '', banner: '' },
  unlockedAchievements: ['first_click', 'collector_10', 'rich', 'crate_opener'],
  forgedCount: 4, shards: 3, nodeLevels: { blueprint: 1 },
  bonus: { clickMult: 0, passiveMult: 0, sellMult: 0, costReduction: 0, companionSlots: 0, coreGain: 0, afkBonus: 0 },
  achievements: 0, secretAchievements: 0,
  warehouse: [
    { id: 'w1', name: 'Blaster Láser', type: 'collector', details: '+5', rarity: 'Común', tier: 1, level: 3, damage: 5, sellPrice: 250, equipped: true },
    { id: 'c1', name: 'Caja Común', type: 'crate', details: 'x', rarity: 'Común', tier: 0, stackable: true, stackCount: 2, sellPrice: 120 },
    { id: 'c2', name: 'Caja Legendaria', type: 'crate', details: 'x', rarity: 'Legendario', tier: 0, stackable: true, stackCount: 1, sellPrice: 4500 },
    { id: 'k1', name: 'Llave de Cifrado', type: 'key', details: 'Abre Cofres Comunes y Raros', rarity: 'Común', tier: 0, stackable: true, stackCount: 3, sellPrice: 480 },
    { id: 'k2', name: 'Llave del Vacío', type: 'key', details: 'Abre cualquier cofre', rarity: 'Legendario', tier: 3, stackable: true, stackCount: 1, sellPrice: 9000 },
    { id: 'x1', name: 'Cristal de Afino', type: 'crystal', details: 'x1', rarity: 'Común', tier: 1, stackable: true, stackCount: 5, sellPrice: 720 },
    { id: 'x2', name: 'Cristal Singular', type: 'crystal', details: 'x4', rarity: 'Legendario', tier: 4, stackable: true, stackCount: 2, sellPrice: 30000 },
    { id: 'p1', name: 'Dron Explorador', type: 'companion', details: '+2/s', rarity: 'Común', tier: 1, sellPrice: 250 }
  ]
};

const fakeGame: any = {
  getState: () => MOCK,
  getDisplayName: () => MOCK.displayName,
  getCapacity: () => MOCK.warehouseCapacity,
  getCompanionSlots: () => MOCK.maxCompanionSlots,
  getSellPrice: (id: string) => MOCK.warehouse.find((w: any) => w.id === id)?.sellPrice ?? 0,
  getCollectValue: () => 1000,
  isAfk: () => false,
  getAchievements: () => [
    { id: 'first_click', title: 'Primer Enlace', description: 'x', icon: 'bolt', rewardText: '+2%', unlocked: true, current: 100, target: 100 },
    { id: 'rich', title: 'Magnate', description: 'x', icon: 'graph', rewardText: '+15%', unlocked: true, current: 250000, target: 250000 },
    { id: 'jackpot', title: 'Fortuna Divina', description: 'x', icon: 'crown', rewardText: '+15%', unlocked: false, current: 0, target: 1 },
    { id: 'hidden', title: '???', description: 'x', icon: 'crate', rewardText: 'x', unlocked: false, current: 4, target: 100 }
  ],
  getForgeInfo: () => ({ unlocked: true, candidates: [], canForge: false, levels: {} }),
  getPrestigeInfo: () => ({ cores: 12, totalCores: 40, pending: 3, resets: 3, nextAt: 100 }),
  getCollectorUpgradeCost: () => 4,
  updateState: () => {},
  getAfkDurationMs: () => 600000
};

// ==========================================================================
//  App mínima con el MISMO cableado que `main.ts`
// ==========================================================================

const app = document.querySelector('#app') as HTMLElement;
const router = new Router();

function renderRoute(route: Route) {
  app.innerHTML = '';

  const go = (r: Route) => { router.goTo(r); renderRoute(router.current); };

  switch (route) {
    case 'base': {
      app.innerHTML = renderLayoutHTML(MOCK, 'cyber-dark', route, {
        onNavigate: go, onLogout: noop,
        onToggleMute: noop, onToggleMusic: noop, onThemeChange: noop
      });
      app.onclick = (e) => {
        const t = e.target as HTMLElement;
        const nav = t.closest('[data-nav]') as HTMLElement | null;
        if (!nav) return;
        e.preventDefault();
        go(nav.dataset.nav as Route);
      };
      wirePreviewAudio(app);
      renderPanel(MOCK, 1962, 3);
      break;
    }
    case 'almacen':
      renderWarehouseTab(app, fakeGame, noop, go);
      break;
    case 'forja':
      renderForgePage(app, fakeGame, go);
      break;
    case 'tienda':
      renderStoreTab(app, fakeGame, go);
      break;
    case 'perfil':
      renderProfilePage(app, fakeGame, () => go('prestigio'), go);
      break;
    case 'ranking':
      renderRankings(app, { uid: 'me' }, go);
      break;
    case 'prestigio':
      renderPrestigePage(app, fakeGame, go);
      break;
  }
}

renderRoute(router.current);
(window as any).__recorridoRouter = router;
(window as any).__recorridoGo = (r: Route) => { router.goTo(r); renderRoute(router.current); };
