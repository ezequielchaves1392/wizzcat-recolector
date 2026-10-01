// ==========================================================================
//  Escena del acceso: prueba aislada
//
//  `preview.html?vista=...` monta el juego entero contra un estado falso, y el
//  acceso no tiene vista propia porque se pinta antes de que exista partida.
//  Para poder revisarlo sin crear una cuenta de Firebase, esta página monta
//  `renderAuth()` con un `onLoginSuccess` que no hace nada: la pantalla se ve y
//  se puede tocar igual, y el formulario llega hasta donde puede.
//
//  Solo en desarrollo: el archivo está en `src/`, así que entra en `tsc`, pero
//  `auth-preview` no está en ninguna ruta del juego.
// ==========================================================================

import './style.css';
import './style.modules.css';
import { applyTheme, getSavedTheme } from './theme';
import { renderAuth } from './components/auth';

applyTheme(getSavedTheme());

const app = document.getElementById('app')!;

renderAuth(app, () => {
  // A propósito vacío: sin Firebase detrás no hay a dónde entrar.
  document.getElementById('auth-error')?.classList.remove('hidden');
  const err = document.getElementById('auth-error');
  if (err) err.textContent = 'Vista de prueba: no hay Firebase detrás, así que el envío no continúa.';
});