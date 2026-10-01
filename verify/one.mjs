// Arranque de un banco suelto, sin DOM ni Firebase.
// Uso: node verify/one.mjs <nombreDelBanco>
const listeners = () => ({ addEventListener() {}, removeEventListener() {} });

globalThis.__MEM_DB__ = {};
globalThis.document = {
  visibilityState: 'visible',
  hasFocus: () => true,
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({ className: '', style: {}, appendChild() {}, remove() {} }),
  body: { appendChild() {} }
};
globalThis.window = { ...listeners() };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.performance ??= { now: () => Date.now() };
globalThis.setInterval = () => 0;

process.on('unhandledRejection', (e) => { console.error('RECHAZO SIN CAPTURAR', e); process.exit(2); });
process.on('uncaughtException', (e) => { console.error('EXCEPCION', e); process.exit(3); });

const banco = process.argv[2] ?? 'sellCheck';
const { default: pruebas } = await import(`./out-one/${banco}.js`);
await pruebas;
process.exit(process.exitCode ?? 0);
