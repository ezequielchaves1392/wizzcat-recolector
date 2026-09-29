export function showConfirmModal(message: string, onConfirm: () => void): void {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
  overlay.id = 'confirm-modal-overlay';

  // Crear modal
  const modal = document.createElement('div');
  modal.className = 'card-glass border rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4';

  // Mensaje
  const messageEl = document.createElement('p');
  messageEl.className = 'text-sm font-mono text-[var(--text-main)] text-center';
  messageEl.textContent = message;

  // Contenedor de botones
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-3';

  // Botón cancelar
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'flex-1 py-2.5 bg-slate-700/50 border border-slate-600/50 text-slate-300 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  // Botón aceptar
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'flex-1 py-2.5 accent-bg text-slate-950 font-[\'Orbitron\'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer';
  confirmBtn.textContent = 'Aceptar';
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(confirmBtn);

  modal.appendChild(messageEl);
  modal.appendChild(buttonContainer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Cerrar con Escape
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}
