import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export function renderRankings(container: HTMLElement, currentUser: any, onBack: () => void) {
  let currentCategory = 'score';

  const renderTemplate = () => {
    container.innerHTML = `
      <div class="w-screen h-dvh app-bg flex flex-col items-center p-4 md:p-6 font-sans select-none overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[var(--accent)]/10 via-[var(--bg-app)] to-[var(--bg-app)] pointer-events-none"></div>
        
        <div class="relative z-10 max-w-2xl w-full flex flex-col gap-6 my-auto max-h-full">
          <div class="flex items-center justify-between flex-shrink-0">
            <button id="back-btn" class="px-4 py-2 card-glass border border-[var(--border-color)] rounded-xl text-xs font-mono accent-text hover:border-[var(--accent)] transition cursor-pointer">
              ← Volver al Comando
            </button>
            <h2 class="text-lg md:text-2xl font-['Orbitron'] font-black accent-text tracking-wider text-right">RANKING GLOBAL</h2>
          </div>
          
          <div class="grid grid-cols-3 gap-2 flex-shrink-0">
            <button data-cat="score" class="cat-btn py-2.5 px-3 rounded-xl border text-xs font-mono transition cursor-pointer ${currentCategory === 'score' ? 'accent-bg text-slate-950 font-bold border-[var(--accent)] accent-glow' : 'card-glass border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}">
              ⚡ Nanitas
            </button>
            <button data-cat="totalClicks" class="cat-btn py-2.5 px-3 rounded-xl border text-xs font-mono transition cursor-pointer ${currentCategory === 'totalClicks' ? 'accent-bg text-slate-950 font-bold border-[var(--accent)] accent-glow' : 'card-glass border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}">
              🖱️ Disparos
            </button>
            <button data-cat="totalInfraestructure" class="cat-btn py-2.5 px-3 rounded-xl border text-xs font-mono transition cursor-pointer ${currentCategory === 'totalInfraestructure' ? 'accent-bg text-slate-950 font-bold border-[var(--accent)] accent-glow' : 'card-glass border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}">
              🏭 Flota
            </button>
          </div>

          <div id="rankings-list" class="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[55vh]">
            <div class="card-glass border rounded-2xl p-6 text-center text-xs font-mono text-[var(--text-muted)] animate-pulse">
              Sincronizando red global...
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#back-btn')?.addEventListener('click', onBack);

    container.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat');
        if (cat) {
          currentCategory = cat;
          renderTemplate();
          subscribeToRankings();
        }
      });
    });
  };

  renderTemplate();
  subscribeToRankings();

  function subscribeToRankings() {
    const listContainer = container.querySelector('#rankings-list') as HTMLElement;
    if (!listContainer) return;

    const q = query(collection(db, 'rankings'), orderBy(currentCategory, 'desc'), limit(100));
    
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        listContainer.innerHTML = `<div class="card-glass border rounded-2xl p-6 text-center text-xs font-mono text-[var(--text-muted)]">No hay registros en la red todavía.</div>`;
        return;
      }

      const allDocs: any[] = [];
      snapshot.forEach((docSnap) => {
        allDocs.push({ id: docSnap.id, ...docSnap.data() });
      });

      const top20 = allDocs.slice(0, 20);
      let html = '';
      let rank = 1;

      top20.forEach((data) => {
        const isMe = currentUser && data.userId === currentUser.uid;
        const primaryValue = currentCategory === 'score' ? (data.score || 0) :
                             currentCategory === 'totalClicks' ? (data.totalClicks || 0) :
                             (data.totalInfraestructure || 0);

        const valueFormatted = currentCategory === 'totalInfraestructure' ? `Flota ${primaryValue}` : formatNumber(primaryValue);

        html += `
          <div class="card-glass border rounded-xl p-3.5 flex items-center justify-between gap-4 shadow-md ${isMe ? 'accent-border accent-glow' : ''}">
            <div class="flex items-center gap-3 min-w-0">
              <div class="font-['Orbitron'] font-black text-sm md:text-base w-8 text-center flex-shrink-0 accent-text">#${rank}</div>
              <div class="text-[var(--text-main)] font-bold font-mono text-sm truncate flex items-center gap-2">
                <span class="truncate">${data.username || 'Operativo'}</span>
                ${isMe ? '<span class="text-[9px] accent-bg text-slate-950 px-2 py-0.5 rounded-full font-bold flex-shrink-0">TÚ</span>' : ''}
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="font-['Orbitron'] font-bold accent-text text-sm">${valueFormatted}</div>
            </div>
          </div>
        `;
        rank++;
      });

      listContainer.innerHTML = html;
    });
  }
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + ' K';
  return Math.floor(num).toLocaleString();
}