// ==========================================================================
//  La pila de avisos flotantes (`showToast`)
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE, Y POR QUÉ NO ES UN BANCO DE RENDER.
//
//  `showToast` es el overlay más llamado del juego: lo usan las siete pantallas,
//  la terminal de administración y el propio game loop. Y antes de este banco
//  no estaba cubierto por NADA, ni siquiera de refilón.
//
//  Lo que se rompió la última vez no era el aspecto del aviso: era que todos
//  los avisos se pintaban en `fixed top-4 right-4`, uno por nodo. Dos avisos
//  seguidos caían en el mismo píxel y solo se leía el último. Y esa esquina es
//  la de la cabecera, así que además de taparse entre sí se metían debajo de los
//  controles de arriba. Con una acción repetitiva no era que faltara espacio:
//  era que el último aviso se comía todos los anteriores.
//
//  Eso tiene tres reglas comprobables y ninguna necesita un navegador de
//  verdad:
//
//    · UNA pila, no N nodos sueltos → se mide el número de hijos del contenedor.
//    · DEBAJO de la cabecera, medida → se lee `style.top` y se compara con el
//      borde que publica el banco en `__DOM__`.
//    · LO REPETIDO SE CUENTA → tres llamadas iguales son un aviso con `×3`, y
//      el tope de cuatro vivos se respeta.
//
//  Y no se reimplementa ninguna regla aquí, que es lo que prohíbe `kit.ts`: aquí
//  no hay ninguna fórmula ni ningún umbral del juego, solo se llama a
//  `showToast` y se mira lo que deja en el DOM. Si el tope de cuatro cambia en
//  `toast.ts`, esto falla; si lo cambiamos en la prueba para que pase, el banco
//  no valdría nada.
//
//  LO QUE NO CUBRE, A PROPÓSITO.
//
//  · Que el aviso se vea bonito. Eso es de `preview.html`, a 390×844 y a
//    1440×900, con los avisos de verdad en pantalla.
//  · El temporizador de 3 s EN PARTE. Se espera una vez, al final, y se
//    comprueba lo que de verdad importa: que el aviso se va y que no se
//    accumulate en memoria el doble de lo que se ve.
//  · Tocar el aviso para retirarlo: `addEventListener` es una sinonima en el
//    stub, así que un manejador no se puede ni registrar ni disparar. El aviso
//    tiene salida sola, y eso es lo que se comprueba.
// ==========================================================================

import { showToast, syncToastOffset } from '../src/utils/toast';
import { check, resumen, boot, baseSave } from './kit';

/** El contenedor donde se apilan los avisos. */
const pila = () => (globalThis as any).document.querySelector('#toast-stack');

/** Los avisos ahora mismo, en orden de aparición. */
const vivos = () => (pila()?.children ?? []) as any[];

/**
 * Vacía la pila y espera a que lo esté de verdad.
 *
 * POR QUÉ HACE FALTA, Y POR QUÉ NO ES EXÓTICO.
 *
 * Los bancos se ejecutan todos en el mismo proceso y el módulo de avisos es UNO
 * solo para todos, así que al empezar este banco la pila ya tiene dentro lo que
 * fue dejando la cola de nanitas de los bancos anteriores: "Guardado. Tu
 * progreso ya está en la nube", "Recuperadas 3.24 K nanitas...", "Almacén
 * lleno...". No es un residuo del stub: es el juego funcionando.
 *
 * Antes no se notaba porque `appendChild` era una sinonima y nadie miraba los
 * hijos. Ahora que sí, cualquier aserción sobre el número de avisos empieza
 * midiendo los de otro banco.
 *
 * Se espera a que se vayan solos en vez de vaciarlos a golpes, porque borrarlos
 * a golpes dejaría los avisos de otro banco a medias de su desvanecido y el
 * estado seguiría sin ser el de una pila recién creada. Con el tope de espera
 * hay red: si algún día un aviso viviera más de lo que debería, el banco
 * fallaría diciendo cuántos quedaban en vez de quedarse colgado.
 */
async function vaciarPila() {
  for (let intento = 0; intento < 40 && vivos().length; intento++) {
    await dormir(100);
  }
}

/** El texto de cada aviso, sin el contador de repeticiones. */
const textos = () => vivos().map(t => t.children[0]?.textContent ?? '');

/** El contador `×N` de cada aviso, o `null` si no tiene. */
const contadores = () => vivos().map(t => {
  const c = t.children[1];
  return c?.classList?.contains('hidden') ? null : (c?.textContent ?? null);
});

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Publica una cabecera con un borde inferior conocido y devuelve su nodo. */
function cabecera(borde: number) {
  const el = (globalThis as any).document.createElement('header');
  el.getBoundingClientRect = () => ({ top: 0, bottom: borde, height: borde, left: 0, right: 0, width: 0 });
  (globalThis as any).__DOM__.header = el;
  return el;
}

// ==========================================================================
//  LOGROS: que el cartel llegue a algún sitio (B3)
// ==========================================================================
//  POR QUÉ ESTE BLOQUE ESTÁ EN EL BANCO DE LOS AVISOS.
//
//  El cartel de logro es un aviso más, y comparte el mismo problema que la pila:
//  es una función que busca su contenedor y se va si no lo encuentra. La cola de
//  nanitas que hay en `main.ts` no es comprobable desde aquí —es una función local
//  de un módulo que importa Firebase—, así que lo que se comprueba es lo que sí
//  se puede comprobar: **que `onAchievement` recibe el logro, y que el logro se
//  desbloquea de verdad**.
//
//  Y eso no es poco, porque era justo lo que fallaba. Dos causas distintas, ambas
//  reales, y ningunavisible mirando el cartel:
//
//    1. La vía de ampliar no evaluaba logros: `buyStoreItem('warehouseSlot')`
//       subía la capacidad y salía sin llamar a `checkAchievements()`. Justo la
//       acción que cumple "Almacén Masivo" era la única de las diez rutas que no
//       evaluaba logros. Con F27 ampliar es usar un expansor, y esa ruta sí
//       evalúa: este banco ata que siga siendo así.
//    2. El cartel se descartaba al no existir todavía `#achievement-stack`: el
//       motor evalúa logros durante la carga, dentro del `await`, y el layout se
//       pinta en el `requestAnimationFrame` siguiente.
//
//  La segunda no se puede probar aquí —no hay `main.ts` en un banco— y por eso
//  está documentada en el código con la cola, no aquí. Lo que se ata aquí es lo
//  que sí es comprobable: el logro llega al callback y el almacén refleja la vía
//  que lo cumple.
//
//  LO QUE NO CUBRE: que se pinte. Eso es `preview.html` con viewport real, y un
//  banco de números no lo vería aunque seCorrigiese la cola.
// ==========================================================================

/** Los logros que el motor ha anunciado, en orden. */
function logroGrabado(t: any, a: any): string {
  return `${t}:${a.title}`;
}

/**
 * Arranca el motor recogiendo los logros que anuncia.
 *
 * `createGameLoop` acepta un cuarto argumento, `onAchievement`, que es lo que
 * `main.ts` pasa a `showAchievementPopup`. Aquí se mira ese mismo gancho, y no la
 * función de la vista: el banco comprueba **que el motor emite**, que es la mitad
 * comprobable del bug. La otra mitad (que la vista tenga dónde pintarlo) es la
 * cola de `main.ts`, y esa se documenta allí.
 */
async function motorConLogros(save: any) {
  const vistos: string[] = [];
  const g = await boot(save, { onAchievement: (a: any) => vistos.push(a.title) });
  return { g, vistos };
}

/** Una partida con `capacidadBase` slots y dinero de sobra para ampliar. */
function saveParaAmpliar(capacidadBase = 15) {
  return baseSave([], {
    nanites: 10_000_000,
    warehouseCapacity: capacidadBase
  });
}

async function main() {
  await vaciarPila();

  // ---------------------------------------------------------------------
  // 1 · UN CONTENEDOR, NO UN NODO POR AVISO
  // ---------------------------------------------------------------------
  showToast('Primero', 'info');
  check('un aviso crea la pila', !!pila(), 'id=' + (pila()?.id ?? 'ninguno'));

  showToast('Segundo', 'success');
  showToast('Tercero', 'error');
  check(
    'tres avisos NO crean tres contenedores',
    vivos().length === 3,
    'hijos=' + vivos().length
  );
  check(
    'el contenedor vive en body, no en la vista',
    (globalThis as any).document.body.children.includes(pila()),
    'body=' + (globalThis as any).document.body.children.length
  );
  check(
    'y se sale de los de abajo al final, en orden',
    textos().join('|') === 'Primero|Segundo|Tercero',
    textos().join('|')
  );

  // ---------------------------------------------------------------------
  // 2 · LO REPETIDO SE CUENTA
  // ---------------------------------------------------------------------
  showToast('Primero', 'info');
  check(
    'repetir un aviso NO añade otro',
    vivos().length === 3,
    'hijos=' + vivos().length
  );
  check(
    'sube su contador a ×2',
    contadores()[0] === '×2',
    'contador=' + contadores()[0]
  );

  showToast('Primero', 'info');
  check('y a ×3', contadores()[0] === '×3', 'contador=' + contadores()[0]);
  check(
    'un aviso sin repetir no enseña contador',
    contadores()[1] === null,
    'contador=' + contadores()[1]
  );

  // El mismo texto con otro tipo es OTRO aviso. Si no lo fuera, un error que se
  // repite debajo de un "comprado" se comería el "comprado" y solo se vería el
  // error, que es justo la confusión que el contador de repeticiones vino a
  // arreglar.
  showToast('Primero', 'error');
  check(
    'el mismo texto con otro tipo es otro aviso',
    vivos().length === 4 && contadores()[3] === null,
    'hijos=' + vivos().length + ' contador=' + contadores()[3]
  );
  check(
    'los espacios de más no crean avisos nuevos',
    (() => { showToast('   ', 'info'); return vivos().length === 4; })(),
    'hijos=' + vivos().length
  );

  // ---------------------------------------------------------------------
  // 3 · EL TOPE DE CUATRO
  // ---------------------------------------------------------------------
  // Llegamos aquí con cuatro vivos: Primero (×3), Segundo, Tercero y Primero
  // (error). Cada aviso nuevo tiene que expulsar al más viejo de la lista.
  //
  // Y aquí está lo que no es obvio: el expulsado NO se borra en el acto, se va
  // desvaneciéndose 300 ms. While dura eso el DOM tiene uno más, y en la
  // pantalla están cinco un instante. Comprobar el tope en ese instante mide el
  // desvanecido, no el tope. El desvanecido es lo correcto —si el nodo se
  // borrara al momento, el aviso desaparecería de golpe—, así que la prueba
  // mira DESPUÉS de que termine.
  showToast('Cuarto', 'info');
  check(
    'el que se expulsa sigue en pantalla desvaneciéndose',
    vivos().length === 5 && textos()[0] === 'Primero',
    textos().join('|')
  );

  await dormir(400);
  check(
    'pasado el desvanecido quedan cuatro, no cinco',
    vivos().length === 4,
    'hijos=' + vivos().length
  );
  check(
    'y el que se fue es el más viejo de la lista, no el último',
    textos().join('|') === 'Segundo|Tercero|Primero|Cuarto',
    textos().join('|')
  );

  showToast('Quinto', 'info');
  showToast('Sexto', 'info');
  await dormir(400);
  check(
    'una racha larga no deja una columna de veinte',
    vivos().length === 4,
    'hijos=' + vivos().length
  );
  check(
    'y se quedan los últimos, no los primeros',
    textos()[vivos().length - 1] === 'Sexto',
    textos().join('|')
  );

  // ---------------------------------------------------------------------
  // 4 · DEBAJO DE LA CABECERA, MEDIDA
  // ---------------------------------------------------------------------
  // Antes de medir la posición hay que vaciar la pila otra vez: lo que importa
  // aquí es dónde CAE el primer aviso, y con cuatro vivos debajo la medición
  // seguiría siendo correcta pero no comparable con nada.
  await vaciarPila();

  // La posición vertical se lee del `<header>` de verdad porque su alto no es
  // fijo: en móvil le crece una fila con los buffs. Una constante escrita a ojo
  // se vuelve a solapar en cuanto la cabecera cambia, y nadie se entera.
  check(
    'sin cabecera se queda en el margen por defecto',
    pila().style.top === '12px',
    'top=' + pila().style.top
  );

  cabecera(66); // móvil con la fila de buffs
  syncToastOffset();
  check(
    'con la cabecera de 66 px queda por debajo, con hueco',
    pila().style.top === '78px',
    'top=' + pila().style.top
  );

  cabecera(79); // escritorio, con el margen superior del header
  syncToastOffset();
  check(
    'y se recoloca al cambiar de vista (lo llama renderRoute)',
    pila().style.top === '91px',
    'top=' + pila().style.top
  );

  // Una cabecera sin medir vale cero (pestaña en segundo plano). Confiar en ese
  // cero pegaba los avisos al borde superior justo cuando se vuelve a mirar la
  // pantalla, que es cuando más falta hacen.
  const sinMedir = (globalThis as any).document.createElement('header');
  (globalThis as any).__DOM__.header = sinMedir;
  syncToastOffset();
  check(
    'una cabecera sin medir no pega los avisos al borde',
    pila().style.top === '12px',
    'top=' + pila().style.top
  );

  // ---------------------------------------------------------------------
  // 5 · CADA AVISO DICE SI ES ERROR
  // ---------------------------------------------------------------------
  // La sección 4 seuede la pila vacía, así que hay que volver a llenarla: aquí
  // importa el aviso que hay en pantalla, y hace falta uno de cada tipo.
  showToast('Primero', 'info');
  showToast('Segundo', 'success');
  showToast('Tercero', 'error');

  // `role="alert"` es lo que distingue un "no te deja" de un "comprado" para
  // quien usa lector de pantalla: los dos se ven en la misma esquina y se van a
  // los 3 s igual.
  const roles = vivos().map(t => t.getAttribute('role'));
  check(
    'los errores se anuncian como alerta',
    roles.includes('alert'),
    roles.join(',')
  );
  check(
    'y el resto, con normalidad',
    roles.filter(r => r === 'status').length === roles.length - 1,
    roles.join(',')
  );
  // El hueco que hay entre avisos no puede tragarse un toque que iba a otra
  // cosa, y por eso la columna entera es `pointer-events-none` y cada aviso
  // `pointer-events-auto`. Con la columna transparente, el gutter de 8 px
  // entre dos avisos se comería clics directedos a lo que hay detrás.
  check(
    'la columna no intercepta toques, pero los avisos sí',
    pila().className.includes('pointer-events-none')
      && vivos()[0].className.includes('pointer-events-auto'),
    'columna=' + pila().className.slice(0, 40)
  );
  check(
    'y cada aviso tiene zona táctil de 44 px',
    vivos().every(t => t.className.includes('min-h-[44px]')),
    vivos()[0].className.match(/min-h-\[44px\]/) ? 'min-h-44px' : 'no'
  );

  // ---------------------------------------------------------------------
  // 6 · SE VA SOLO, Y NO SE QUEDA EN MEMORIA
  // ---------------------------------------------------------------------
  // Esta es la parte lenta del banco y va al final a propósito: son 3,4 s de
  // reloj real. Comprueba las dos cosas que importan de la retirada, y la
  // segunda es la que no se vería mirando la pantalla.
  //
  //
  // La sección 5 dejó tres avisos vivos a propósito, para mirar sus roles. Se
  // vacían aquí: la cuenta tiene que ser sobre una pila que solo tiene lo que
  // puso este banco, o "antes=5 ahora=0" mezclaría los avisos de la sección 5
  // con los dos de aquí y no comprobaría nada.
  // Antes, vaciar: la sección 5 dejó tres avisos en pantalla, y si se cuentan
  // ellos la aserción de "se van solos" mezcla dos cosas. Se mide sobre una
  // pila que solo tiene lo que este banco puso.
  await vaciarPila();
  showToast('Guardado de mentira', 'info');
  showToast('Recuperadas 3.24 K', 'info');
  const antes = vivos().length;
  await dormir(3400);
  check(
    'los avisos se van solos',
    antes === 2 && vivos().length === 0,
    'antes=' + antes + ' ahora=' + vivos().length
  );

  // Si el retirado se quedara apuntado en la pila de vivos, el siguiente aviso
  // con el mismo texto se contaría como repetición de uno que ya no está en
  // pantalla: aparecería un `×2` sin que hubiera habido dos. Es la forma
  // silenciosa de que este banco pase mientras el módulo se comporta mal.
  showToast('Guardado de mentira', 'info');
  check(
    'un texto que ya estaba no vuelve con contador puesto',
    vivos().length === 1 && contadores()[0] === null,
    'contador=' + contadores()[0]
  );

  // ---------------------------------------------------------------------
  // 7 · LOGROS: QUE EL CARTEL TENGA ALGO QUE MOSTRAR (B3)
  //
  //  Aquí no se pinta el cartel —eso necesita el `#achievement-stack` de verdad—,
  //  pero sí se comprueba la mitad que no estaba: **que el motor emita el logro**.
  // ---------------------------------------------------------------------

  // 7a · Usar un expansor, que es la acción que cumple "Almacén Masivo" por la
// 7a · Usar un expansor, que es la acción que cumple "Almacén Masivo" por la
  // vía de la tienda (F27: la compra mete el item y ampliar es usarlo). La
  // emisión del logro vive en `useConsumable`, como en las demás rutas.
  //
  // **EL EXPANSOR T1 DA +5 Y SOLO SE USA UNA VEZ**, porque a partir de 20 deja de
  // servir. Antes daba +2 y se podía usar tres veces seguidas, y esta comprobación
  // miraba que con 17 todavía no hubiera logro. Ese caso ya no existe: con un
  // solo uso el almacén llega a 20 y el logro salta, que es lo correcto.
  //
  // Lo que se comprueba ahora es lo que se puede comprobar: **que el logro salte
  // al llegar a 20 y que el expansorutzado no sirva para nada más**. La segunda
  // mitad es la que importa, porque es la que convierte el techo en una regla y no
  // en un número decorativo.
  {
    const { g, vistos } = await motorConLogros(saveParaAmpliar(15));
    const e = g.buyStoreItem('expansorT1', 3) as any;
    g.useConsumable(e.id);
    check(
      'logros: ampliar el almacen hasta 20 desbloquea el logro',
      g.getState().unlockedAchievements.includes('deep_pockets'),
      'logros=' + JSON.stringify(g.getState().unlockedAchievements)
    );
    check(
      'y lo ANUNCIA, que es lo que hace el cartel',
      vistos.includes('Almacén Masivo'),
      'anunciados=' + JSON.stringify(vistos)
    );
    // Y el segundo expansor T1 ya no sirve: el techo está alcanzado. El item
    // sigue en el almacén, porque no se gasta un item que no hace nada.
    const otro = g.useConsumable(e.id);
    check('logros: el segundo expansor T1 no sirve de nada',
      otro.ok === false && g.getState().warehouseCapacity === 20,
      `ok=${otro.ok} cap=${g.getState().warehouseCapacity} msg=${otro.msg ?? ''}`);
  }
  // 7b · Y que se anuncie UNA VEZ. Con más usos, el logro ya está
// 7b · Y que se anuncie UNA VEZ. Con más usos, el logro ya está
  // desbloqueado y no debe volver a salir: un "×2" en el cartel sería el mismo
  // bug que el del "×5" de los avisos, y aquí no hay forma de verlo mirando.
  //
  // **Y AQUÍ NO SE PUEDE REPETIR EL MISMO EXPANSOR**, porque con la escalera de
  // diez el T1 se queda muerto en el primer uso: usarlo tres veces seguidas
  // solo daría dos rechazos y el logro no volvería a saltar, que no es lo que
  // esta comprobación mide. Lo que mide es "el cartel no repite", y para eso
  // hacen falta dos AMPLIOSIONES DISTINTAS que sí sirvan: el T1 y el T2.
  {
    const { g, vistos } = await motorConLogros(saveParaAmpliar(15));
    g.buyStoreItem('expansorT1', 1);
    g.buyStoreItem('expansorT2', 1);
    const t1 = (g.getState().warehouse as any[]).find((w: any) => w.buffId === 'expansorT1');
    const t2 = (g.getState().warehouse as any[]).find((w: any) => w.buffId === 'expansorT2');
    g.useConsumable(t1.id);
    const trasLaPrimera = vistos.length;
    g.useConsumable(t2.id);
    const t3 = g.buyStoreItem('expansorT3', 1) as any;
    g.useConsumable(t3.id);

    check(
      'logros: un logro anunciado no se vuelve a anunciar aunque amplia despues',
      vistos.length === trasLaPrimera,
      'antes=' + trasLaPrimera + ' despues=' + JSON.stringify(vistos)
    );
  }

  // 7c · B4 · LA PISTA MIDE LA CAPACIDAD QUE EL JUGADOR VE.
  //
  // El árbol de pasivas da ranuras aparte, así que la capacidad real es la base
  // MÁS `bonus.storageSlots`. Medir solo la base hacía que con el árbol comprado el
  // logro enseñara 15/20 para siempre con el almacén lleno de verdad. Y lo que se
  // comprueba no es el número bonito: es que la pista y `getCapacity()` digan lo
  // mismo, que es R3 aplicado a un logro.
  {
    const { g } = await motorConLogros(saveParaAmpliar(15));
    const conArbol = await motorConLogros(baseSave([], {
      nanites: 10_000_000,
      warehouseCapacity: 15,
      nodeLevels: { storage_rack: 1, void_hoard: 1 }
    }));

    // OJO CON LA COMPARACIÓN: la pista va topeada a 20 y la capacidad no. Con el
    // árbol comprado la capacidad real es 26, así que comparar las dos cifras
    // enteras da 20 contra 26 y el banco falla con un bug que no existe: el tope
    // es correcto —de nada sirve un progreso de 26/20— y lo que tiene que ser
    // cierto es que el tope se alcanza, es decir, que la pista mide lo mismo que
    // la capacidad y llega antes. Por eso aquí se comparan ambas cosas por
    // separado en vez de igualarlas.
    const pista = (gg: any) => gg.getAchievements().find((a: any) => a.id === 'deep_pockets')?.current;

    check(
      'logros: la pista llega al tope de 20 por el árbol, no por la tienda',
      pista(conArbol.g) === 20 && conArbol.g.getCapacity() === 26,
      `pista=${pista(conArbol.g)} capacidad=${conArbol.g.getCapacity()} (base=15 +3+8 del árbol)`
    );
    check(
      'y sin árbol la pista es la base, sin tocar el tope',
      pista(g) === 15 && g.getCapacity() === 15,
      `pista=${pista(g)} capacidad=${g.getCapacity()}`
    );
    check(
      'y con el árbol lleno, el logro SÍ se cumple por la vía del árbol',
      conArbol.g.getState().unlockedAchievements.includes('deep_pockets'),
      'logros=' + JSON.stringify(conArbol.g.getState().unlockedAchievements)
    );
  }

  delete (globalThis as any).__DOM__.header;
  resumen('avisos flotantes');
}

export default main();
