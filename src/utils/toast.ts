export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error: 'bg-red-500/20 border-red-500/40 text-red-300',
    info: 'bg-blue-500/20 border-blue-500/40 text-blue-300'
  };
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-mono shadow-2xl transform transition-all duration-300 translate-x-full ${colors[type]}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animar entrada
  setTimeout(() => toast.classList.remove('translate-x-full'), 10);

  // Auto-eliminar después de 3 segundos
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
