// ==========================================================================
//  Wiki en pestaña aparte · entrada propia
//
//  No hay game loop, no hay Firebase, no hay auth: es solo lectura sobre
//  `src/data/` y `src/components/crateLoot.ts`. Por eso puede vivir en su
//  propio HTML y construirse hasta para despliegue público: no concede nada,
//  no escribe nada y no toca la partida.
//
//  Y al abrirse en otra pestaña, la del juego queda oculta y el juego se
//  pausa solo (la regla de presencia): leer la Wiki no produce ni gasta.
// ==========================================================================

import './style.css';
import './style.modules.css';
import { applyTheme, getSavedTheme } from './theme';
import { renderWikiStandalone } from './ui/wikiPage';

applyTheme(getSavedTheme());

const app = document.querySelector('#app') as HTMLElement;
renderWikiStandalone(app);
