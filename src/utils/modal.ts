// ==========================================================================
// Modal de confirmación
//
// Antes era un `div` con clases sueltas pegadas directamente en el
// constructor, con colores fijos de Tailwind (slate-700, slate-600) que no
// existían en los otros cinco temas: el diálogo se veía oscuro sobre el tema
// Naturaleza y correcto sobre Cyber Dark. Ahora usa las variables de tema.
//
// Extiende la firma con dos parámetros opcionales (`sublabel` y `confirmText`)
// en vez de crear un segundo tipo de diálogo: en la forja y en el reciclaje la
// consecuencia de equivocarse es irreversible, y "Aceptar" a secas no dice
// nada de lo que se está aceptando.
// ==========================================================================

export interface ConfirmOptions {
  /** Título corto arriba del mensaje. */
  sublabel?: string;
  /** Texto del botón de confirmar. Por defecto "Confirmar". */
  confirmText?: string;
  /** Texto del botón de cancelar. Por defecto "Cancelar". */
  cancelText?: string;
  /** Estilo de peligro: el botón de confirmar pasa a rojo. */
  danger?: boolean;
}

export function showConfirmModal(
  message: string,
  onConfirm: () => void,
  options: ConfirmOptions = {}
): void {
  const {
    sublabel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = false
  } = options;

  // Si ya hay un diálogo abierto, se sustituye en vez de apilarse
  document.querySelector('#confirm-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'confirm-modal-overlay';
  overlay.className = 'fixed inset-0 z-[80] flex items-center justify-center p-4';
  overlay.style.cssText = 'background: rgb(0 0 0 / 0.62); backdrop-filter: blur(6px);';
  overlay.style.animation = 'riseIn 220ms ease both';

  const modal = document.createElement('div');
  modal.className = 'card-glass-elevated rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const content = document.createElement('div');
  content.className = 'flex flex-col gap-1.5 text-center';

  if (sublabel) {
    const sub = document.createElement('span');
    sub.className = 'label-caps';
    sub.style.color = danger ? '#f87171' : 'var(--accent)';
    sub.textContent = sublabel;
    content.appendChild(sub);
  }

  const messageEl = document.createElement('p');
  messageEl.className = 'text-[13px] font-sans leading-relaxed text-[var(--text-main)]';
  messageEl.textContent = message;
  content.appendChild(messageEl);
  modal.appendChild(content);

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-2.5';

  const mkBtn = (label: string, primary: boolean) => {
    const b = document.createElement('button');
    b.className = primary
      ? 'flex-1 h-11 rounded-xl font-[\'Orbitron\'] font-bold text-[11px] cursor-pointer transition active:scale-[0.98]'
      : 'flex-1 h-11 rounded-xl btn-ghost font-[\'Orbitron\'] font-bold text-[11px] cursor-pointer transition active:scale-[0.98]';
    b.textContent = label;
    if (primary) {
      if (danger) {
        b.style.cssText =
          'background: linear-gradient(to bottom, #ef4444, #dc2626); color: #fff;' +
          'box-shadow: 0 6px 18px -6px rgb(239 68 68 / 0.7);';
      } else {
        b.classList.add('btn-primary');
      }
    }
    return b;
  };

  const cancelBtn = mkBtn(cancelText, false);
  const confirmBtn = mkBtn(confirmText, true);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleEscape);
  };

  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', () => {
    close();
    onConfirm();
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(confirmBtn);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Cerrar con Escape o tocando el fondo
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleEscape);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // El foco arranca en confirmar: con teclado, Enter es la acción esperada.
  confirmBtn.focus();
}
