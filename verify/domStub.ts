// El mínimo de DOM que necesitan la vista y el game loop en Node.
//
// Va en un archivo aparte porque se importa ANTES que nada más: con ESM las
// importaciones se evalúan en orden, así que este cuerpo corre antes que el de
// `audio.ts`, que lee `localStorage` al cargarse. Ponerlo dentro del propio
// archivo de la prueba llega tarde y revienta con "localStorage is not defined".

export const nodo = (): any => ({
  innerHTML: '',
  className: '',
  style: {},
  dataset: {},
  attributes: {} as Record<string, string>,
  children: [] as any[],
  textContent: '',
  setAttribute(k: string, v: string) { this.attributes[k] = v; },
  getAttribute(k: string) { return this.attributes[k]; },
  removeAttribute(k: string) { delete this.attributes[k]; },
  hasAttribute(k: string) { return k in this.attributes; },
  addEventListener() {}, removeEventListener() {},
  appendChild(c: any) { this.children.push(c); return c; },
  removeChild(c: any) { this.children = this.children.filter(x => x !== c); },
  replaceChild() {}, replaceWith() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  closest() { return null; },
  get firstChild() { return this.children[0] ?? null; },
  get parentElement() { return null; }
});

/** El contenedor de la app: `mountInto` le pide `ownerDocument`. */
export const contenedor = (): any => {
  const c = nodo();
  c.ownerDocument = globalThis.document;
  return c;
};

const listeners = () => ({ addEventListener() {}, removeEventListener() {} });

globalThis.__MEM_DB__ = {};
globalThis.document = {
  visibilityState: 'visible',
  hasFocus: () => true,
  addEventListener() {}, removeEventListener() {},
  createElement: () => nodo(),
  body: nodo()
} as any;
globalThis.window = { ...listeners() } as any;
globalThis.localStorage = { getItem: () => null, setItem() {} } as any;
globalThis.performance ??= { now: () => Date.now() };
// El game loop arranca un `setInterval` de juego; en Node Keeps vivo el proceso.
globalThis.setInterval = () => 0;
