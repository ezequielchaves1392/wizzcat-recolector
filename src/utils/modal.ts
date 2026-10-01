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
//
// Y luego con un tercero (`quantity`), por el mismo motivo: el selector de
// cantidad y la confirmación son el MISMO diálogo visto en dos momentos, y
// hacerlos aparte duplicaría el armazón, el foco y el Escape por dos veces.
//
// ==========================================================================
// POR QUÉ EL MENSAJE PUEDE SER UN NODO, Y POR QUÉ NO SE INTERPRETA EL HTML
// ==========================================================================
//
// El mensaje se pinta con `textContent`, y no es descuido: también lo escriben
// el admin (R25) y los datos del guardado, y este módulo no es el sitio donde
// aparezca HTML. Por eso un `<b>` metido en la cadena salía LITERAL en
// pantalla —"Se gastará <b>Llave Reforzada</b>"— y no como letra negrita.
//
// La salida es que el mensaje admita un nodo: quien necesita énfasis lo
// construye y lo pasa, y el texto que lo rodea se sigue QCOMPAREciendo por
// `textContent` en su sitio. Un argumento de tipo `Node` no se puede
// decodificar como HTML por accidente, que es justo lo que pasaba con el
// `innerHTML` que NO se ha puesto aquí.
// ==========================================================================

export interface QuantityPrompt {
  /** Unidades disponibles. Es el máximo y también el valor inicial. */
  max: number;
  /** Nombre de lo que se vende, para el texto: "Llave Reforzada". */
  itemName: string;
  /** La unidad en singular: "llave", "caja", "cristal", "tarjeta". */
  unitName: string;
  /**
   * El importe para una cantidad dada, YA FORMATEADO.
   *
   * Lo recibe un callback y no se calcula aquí a propósito: el precio de venta
   * vive en el game loop y depende de la bonificación del árbol. Si este módulo
   * multiplicara por su cuenta volvería a haber dos fórmulas del mismo número,
   * que es exactamente el bug que R3 prohíbe (y el que ya rompió el botón
   * "Vender" una vez: pintaba el unitario y cobraba el total).
   */
  amount: (units: number) => string;
}

export interface ConfirmOptions {
  /** Título corto arriba del mensaje. */
  sublabel?: string;
  /** Texto del botón de confirmar. Por defecto "Confirmar". */
  confirmText?: string;
  /** Texto del botón de cancelar. Por defecto "Cancelar". */
  cancelText?: string;
  /** Estilo de peligro: el botón de confirmar pasa a rojo. */
  danger?: boolean;
  /** Pide cuántas unidades, en vez de confirmar de golpe. */
  quantity?: QuantityPrompt;
}

export function showConfirmModal(
  message: string | Node,
  onConfirm: (units?: number) => void,
  options: ConfirmOptions = {}
): void {
  const {
    sublabel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = false,
    quantity
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
  // Una cadena NUNCA se interpreta: aunque traiga `<b>` dentro, sale literal. El
  // que quiera énfasis trae el nodo ya montado (ver la cabecera del fichero).
  if (typeof message === 'string') messageEl.textContent = message;
  else messageEl.appendChild(message);
  content.appendChild(messageEl);

  /**
   * El selector de cantidad, si lo hay.
   *
   * `fijar()` se declara a nivel de `showConfirmModal` y no dentro del `if` que
   * construye el selector: se llama después de crear los botones, y una
   * `function` dentro de un bloque solo se ve dentro de ese bloque.
   */
  let input: HTMLInputElement | null = null;
  let totalEl: HTMLElement | null = null;
  let unidades = quantity ? quantity.max : 0;

  /**
   * Fija la cantidad y repinta lo que depende de ella.
   *
   * Recorta a `[1, max]` en vez de fiarse de lo que hay en el campo: un
   * `type=number` deja teclear cualquier cosa, incluidos negativos y decimales,
   * y el recorte es la misma cuenta que hace el game loop en
   * `unidadesVendibles()`. Si el modal dejara pasar un 40 en una pila de 19, el
   * botón prometería 40 y el cargo serían 19.
   */
  function fijar(n: number, repintarCampo = true) {
    const q = quantity!;
    unidades = Math.min(q.max, Math.max(1, Math.floor(n) || 1));
    if (repintarCampo && input) input.value = String(unidades);
    const importe = q.amount(unidades);
    if (totalEl) totalEl.textContent = `${unidades} × ${q.unitName} · ${importe} ◆`;
    confirmBtn.textContent = `${confirmText} · ${importe} ◆`;
  }

  if (quantity) {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col gap-2.5 mt-1';

    // --- Stepper: menos, campo, más ---
    const stepper = document.createElement('div');
    stepper.className = 'flex items-center gap-2';

    const mkStep = (glyph: string, delta: number, aria: string) => {
      const b = document.createElement('button');
      b.className = 'h-11 w-11 flex-shrink-0 rounded-xl btn-ghost font-[\'Orbitron\'] font-bold text-[15px] cursor-pointer transition active:scale-[0.98]';
      b.textContent = glyph;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', () => fijar(unidades + delta));
      return b;
    };

    input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(quantity.max);
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = String(quantity.max);
    input.setAttribute('aria-label', `Unidades de ${quantity.itemName} a vender`);
    input.className = 'flex-1 min-w-0 h-11 app-bg border border-[var(--border-color)] rounded-xl px-3 ' +
      'text-center font-mono text-[14px] font-bold tabular text-[var(--text-main)]';

    stepper.appendChild(mkStep('−', -1, 'Vender una unidad menos'));
    stepper.appendChild(input);
    stepper.appendChild(mkStep('+', 1, 'Vender una unidad más'));
    wrap.appendChild(stepper);

    // --- Atajo "Todo" y el total en vivo ---
    const foot = document.createElement('div');
    foot.className = 'flex items-center justify-between gap-2';

    const todoBtn = document.createElement('button');
    todoBtn.className = 'h-9 px-3 flex-shrink-0 rounded-lg btn-ghost font-mono text-[10px] cursor-pointer transition';
    todoBtn.textContent = `Todo (${quantity.max})`;
    todoBtn.addEventListener('click', () => fijar(quantity.max));

    const live = document.createElement('span');
    live.className = 'font-mono text-[11px] tabular text-[var(--text-muted)] text-right';
    totalEl = live;

    foot.appendChild(todoBtn);
    foot.appendChild(live);
    wrap.appendChild(foot);
    content.appendChild(wrap);

    // `repintarCampo=false` al teclear: el campo ya tiene lo que se ha escrito
    // y reasignarlo mientras se teclea mueve el cursor al final.
    input.addEventListener('input', () => {
      const n = Math.floor(Number(input!.value));
      fijar(Number.isFinite(n) && n >= 1 ? n : 1, false);
    });
    // Enter confirma, como en cualquier formulario: teclear la cantidad y dar a
    // Enter es el camino rápido, y el `click` del botón no lo dispara.
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      confirmar();
    });
  }

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

  /**
   * Confirmar. Se declara como `function` y no como `const` porque la manejan
   * el `keydown` del campo y el `click` del botón, que se ligan antes de que
   * exista la constante.
   *
   * Sin selector, `onConfirm` no recibe nada: los tres diálogos que ya lo usaban
   * (forja, Ascensión, aplicar consumible) no saben qué hacer con un número.
   */
  function confirmar() {
    close();
    onConfirm(quantity ? unidades : undefined);
  }

  // El primer pintado del selector, ahora que ya existe el botón a retocar.
  if (quantity) fijar(quantity.max);

  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', confirmar);

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

  // Sin selector, el foco arranca en confirmar: con teclado, Enter es la
  // acción esperada. Con selector, en el campo: la primera intención de quien
  // ha abierto "cuántas" es cambiar el número, y saltar al botón le obliga a
  // tabular para volver.
  if (input) input.focus();
  else confirmBtn.focus();
}
