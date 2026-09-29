export function renderCratesTab(container: HTMLElement, game: any, onBack: () => void) {
  const renderTemplate = () => {
    const state = game.getState();
    container.innerHTML = `
      <div class="w-screen h-dvh app-bg flex flex-col items-center p-4 md:p-6 font-sans select-none overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
        
        <div class="relative z-10 max-w-3xl w-full flex flex-col gap-5 my-auto max-h-full">
          <div class="flex items-center justify-between flex-shrink-0">
            <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
              ← Volver al Comando
            </button>
            <h2 class="text-base md:text-xl font-['Orbitron'] font-black accent-text tracking-wider text-right">MÓDULO DE CAJAS Y LLAVES</h2>
          </div>

          <!-- Cabecera de Llaves -->
          <div class="card-glass border rounded-2xl p-4 flex items-center justify-between gap-4 flex-shrink-0 shadow-lg">
            <div class="flex items-center gap-3">
              <span class="text-2xl">🔑</span>
              <div>
                <div class="text-[10px] text-[var(--text-muted)] font-mono">LLAVES DISPONIBLES</div>
                <div id="keys-count" class="font-['Orbitron'] font-bold text-base accent-text">${state.keys}</div>
              </div>
            </div>
            <button id="buy-key-btn" class="px-4 py-2 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
              Comprar Llave (250 ⚡)
            </button>
          </div>

          <!-- Contenedor con Scroll Interno Estricto -->
          <div class="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[50vh] flex-grow">
            <!-- Común -->
            <div class="card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg">📦</span>
                  <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">Caja Común</div>
                  <span class="text-[10px] font-mono accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold">Inventario: ${state.crates.common}</span>
                </div>
                <div class="text-xs text-[var(--text-muted)] font-mono mt-1">Contiene cristales y compañeros exploradores básicos.</div>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <button data-crate="common" class="open-crate-action flex-1 md:flex-initial px-4 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
                  Abrir (1 🔑)
                </button>
              </div>
            </div>

            <!-- Rara -->
            <div class="card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg">📦</span>
                  <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">Caja Rara</div>
                  <span class="text-[10px] font-mono accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold">Inventario: ${state.crates.rare}</span>
                </div>
                <div class="text-xs text-[var(--text-muted)] font-mono mt-1">Cristales abundantes y artilleros tácticos.</div>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <button data-crate="rare" class="open-crate-action flex-1 md:flex-initial px-4 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
                  Abrir (1 🔑)
                </button>
              </div>
            </div>

            <!-- Épica -->
            <div class="card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg">📦</span>
                  <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">Caja Épica</div>
                  <span class="text-[10px] font-mono accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold">Inventario: ${state.crates.epic}</span>
                </div>
                <div class="text-xs text-[var(--text-muted)] font-mono mt-1">IA Cuántica y mejoras de alto rendimiento.</div>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <button data-crate="epic" class="open-crate-action flex-1 md:flex-initial px-4 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
                  Abrir (1 🔑)
                </button>
              </div>
            </div>

            <!-- Legendaria -->
            <div class="card-glass border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-lg">📦</span>
                  <div class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">Caja Legendaria</div>
                  <span class="text-[10px] font-mono accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold">Inventario: ${state.crates.legendary}</span>
                </div>
                <div class="text-xs text-[var(--text-muted)] font-mono mt-1">Comandantes supremos y recompensas de jackpot supremo.</div>
              </div>
              <div class="flex items-center gap-2 w-full md:w-auto">
                <button data-crate="legendary" class="open-crate-action flex-1 md:flex-initial px-4 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer accent-glow">
                  Abrir (1 🔑)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Animación de Ruleta -->
      <div id="roulette-modal" class="hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="card-glass border rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5 text-center relative">
          <h3 class="font-['Orbitron'] font-bold text-base accent-text">SORTEO CUÁNTICO</h3>
          
          <div class="relative w-full h-28 app-bg border border-[var(--border-color)] rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
            <div id="roulette-strip" class="absolute flex gap-3 transition-all duration-1000 ease-out px-4">
              <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">📦 Caja</div>
              <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">⚡ Nanitas</div>
              <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">💎 Cristales</div>
              <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">🤖 Compañero</div>
            </div>
            <div class="absolute inset-y-0 w-1.5 accent-bg z-10 shadow-[0_0_15px_var(--accent)]"></div>
          </div>

          <div id="roulette-result" class="hidden text-xs font-mono accent-text font-bold py-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl animate-bounce"></div>

          <button id="close-roulette" class="hidden py-3 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl transition accent-glow cursor-pointer tracking-wider">
            RECLAMAR PREMIO
          </button>
        </div>
      </div>
    `;

    container.querySelector('#back-btn')?.addEventListener('click', onBack);

    container.querySelector('#buy-key-btn')?.addEventListener('click', () => {
      const success = game.buyStoreItem('key');
      if (success) {
        renderTemplate();
      } else {
        alert('Nanitas insuficientes para comprar una Llave de Cifrado (Requiere 250).');
      }
    });

    container.querySelectorAll('.open-crate-action').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const crateType = (e.currentTarget as HTMLElement).getAttribute('data-crate') as any;
        const currentState = game.getState();

        if (currentState.keys < 1) {
          alert('No tienes llaves suficientes. Compra una llave en la parte superior.');
          return;
        }
        if (currentState.crates[crateType] < 1) {
          alert(`No tienes cofres de tipo ${crateType} en tu inventario.`);
          return;
        }

        const reward = game.openCrateBox(crateType);
        if (!reward) return;

        const rouletteModal = container.querySelector('#roulette-modal');
        const strip = container.querySelector('#roulette-strip') as HTMLElement;
        const resultBox = container.querySelector('#roulette-result');
        const closeBtn = container.querySelector('#close-roulette');

        resultBox?.classList.add('hidden');
        closeBtn?.classList.add('hidden');
        rouletteModal?.classList.remove('hidden');

        if (strip) {
          strip.innerHTML = `
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">📦 Caja</div>
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">⚡ Nanitas</div>
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">💎 Cristales</div>
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">🔑 Llaves</div>
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono accent-border accent-text font-bold">${reward.label}</div>
            <div class="card-glass border rounded-xl p-3 min-w-[110px] flex flex-col items-center justify-center text-xs font-mono">📦 Caja</div>
          `;
          strip.style.transition = 'none';
          strip.style.transform = 'translateX(0px)';

          setTimeout(() => {
            strip.style.transition = 'transform 1.8s cubic-bezier(0.15, 0.85, 0.35, 1)';
            strip.style.transform = 'translateX(-260px)';
          }, 50);

          setTimeout(() => {
            if (resultBox) {
              resultBox.textContent = `🎉 ¡Recompensa obtenida: ${reward.label}!`;
              resultBox.classList.remove('hidden');
            }
            closeBtn?.classList.remove('hidden');
          }, 1900);
        }
      });
    });

    container.querySelector('#close-roulette')?.addEventListener('click', () => {
      container.querySelector('#roulette-modal')?.classList.add('hidden');
      renderTemplate();
    });
  };

  renderTemplate();
}