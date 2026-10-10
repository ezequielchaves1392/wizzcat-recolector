// ==========================================================================
//  Cyber-Forge · Cola de nanitas pendientes
//
//  EL PROBLEMA QUE RESUELVE
//
//  `saveToFirebase()` guarda el saldo COMPLETO del jugador cada 15 segundos con
//  `setDoc(userRef, {nanites: state.nanites, ...}, {merge: true})`. Eso está
//  bien mientras haya red, y no sirve de nada cuando no la hay:
//
//    · Un `setDoc` con la red caída tarda unos diez segundos en fallar (Firebase
//      reintenta por dentro). Diez segundos en los que el jugador sigue jugando
//      y el error solo se ve en la consola.
//    · Cuando por fin falla, las nanitas ganadas desde el último guardado
//      correcto se quedan solo en la memoria. Si cierra la pestaña ahí, se
//      pierden. No hay red de seguridad.
//    · `beforeunload` dispara un `setDoc` asíncrono que el navegador cancela al
//      cerrar: la petición sale, la respuesta no. En la práctica no llega a
//      tiempo casi nunca.
//
//  LA COLA
//
//  Se invierte el orden. En vez de "guardar el estado y rezar", cada nanita
//  ganada se anota en una cola local, en `localStorage`, de forma SÍNCRONA. La
//  cola se descarga contra Firestore cuando se puede; si no, sigue ahí
//  acumulando. Al recargar se lee y se aplica.
//
//
//  LA PREGUNTA QUE HACE FALTA CONTESTAR, Y NO ES "¿CUÁNTO PENDIENTE?"
//
//  Lo tentador es guardar "suma 500 a este jugador" y aplicarlo encima de lo
//  que hay en el documento. Es un error, y no por poco.
//
//  El juego hace dos cosas más sobre ese mismo campo:
//
//    · El reinicio de prestigio pone `nanites: 0`.
//    · La terminal de administración puede "fijar saldo" a una cifra exacta.
//
//  Con una cola que solo suma, el prestige se deshace: el documento queda a
//  cero, la cola devuelve las 500 posteriores y el jugador reinicia sin perder
//  nada. Y el síntoma sería el PEOR de todos —dar núcleos infinitos—.
//
//  Lo que hay que responder no es "cuánto falta", sino:
//
//      ¿El documento del servidor o la cola local, cuál es más reciente?
//
//  La respuesta es la marca de tiempo. Cada anotación lleva `ts`, y el
//  documento lleva su `updatedAt`. Al cargar:
//      · ts > updatedAt  → la cola es más nueva. Se adopta (hay un guardado en
//                          vuelo que no llegó, o un reinicio que tampoco).
//      · ts <= updatedAt → el documento manda. La cola se descarta.
//
//  Esto resuelve los dos casos que importan:
//
//    · El prestige sin red. La cola queda a 0 con `ts` de ahora, el documento
//      sigue con el millón de antes y su `updatedAt` es más viejo. Al recargar
//      se adopta el 0 y el reinicio se respeta. Sin la comparación por fecha,
//      este caso era un truco para farmear núcleos sin limite.
//
//    · El jugador con dos dispositivos. Juega en el móvil y en el portátil. La
//      cola del portátil es de ayer, el documento se actualizó hoy desde el
//      móvil: la cola es más vieja y se tira. Sin esto, volver al portátil
//      rebobinaría la partida a la posición de ayer.
//
//  POR QUÉ UN COMENDIO Y NO UN INCREMENTO
//
//  Guardar el saldo que el jugador DEBERÍA tener y escribirlo con `setDoc` es
//  la misma operación que ya hace el guardado normal, solo que más a menudo y
//  con reintentos. Es idempotente: volver a escribir 1.234.567 mil veces
//  siempre da 1.234.567. Un `increment` en el servidor, en cambio, no lo es:
//  reintentarlo tras un fallo que en realidad sí llegó duplicaría el dinero.
// ==========================================================================

const CLAVE = 'cyberforge_nanitas_pendientes';
const VERSION = 2;

/**
 * F104 · LA PIMIENTA DE LA FIRMA, Y POR QUÉ ESTO NO ES SEGURIDAD.
 *
 * Cada anotación lleva un hash de sus campos. Si alguien edita el saldo a mano
 * en DevTools, el hash no cuadra y la cola se descarta: el juego tira del
 * servidor en vez de adoptar un número tocado.
 *
 * **Y ESO FRENA AL CURIOSO, NO AL TRAMPOSO.** La función y la pimienta viven
 * en el JS que el navegador se descarga, así que quien sabe refirmar refirma.
 * Y quien escribe directo en Firestore ni pasa por aquí. Un antibloqueo de
 * verdad necesita servidor (una Function que valide el delta contra el
 * tiempo), que este proyecto no tiene a propósito. Esto es un disuasorio
 * barato con cero escrituras, no un anticheat.
 */
const PIMIENTA = 'forja-firma-local-v2';

/**
 * Huella síncrona de la anotación (cyrb53). Síncrona a propósito: la cola se
 * anota en caliente y un `await` abriría la ventana en la que un cierre deja
 * la operación a medias, que es justo lo que la cola existe para evitar.
 */
function huellaLocal(canonical: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function firmaDeRegistro(r: {
  uid: string; nanites: number; producidas: number; clics: number;
  nucleos: number; totalNucleos: number; reinicios: number; ts: number;
}): string {
  return huellaLocal(
    [r.uid, r.nanites, r.producidas, r.clics, r.nucleos, r.totalNucleos, r.reinicios, r.ts, PIMIENTA].join('|')
  );
}

/**
 * F104 · LA ÚLTIMA ANOMALÍA VISTA, PARA AVISAR Y NO PARA BLOQUEAR.
 *
 * Si la firma no cuadra, `leerCola()` descarta el registro y deja aquí el
 * motivo. El juego lo enseña (el disco local no es de fiar, se tira del
 * servidor) y sigue: un autobloqueo desde el cliente lo quita quien lo pone
 * borrando la llamada, y un falso positivo dejaría a un honesto fuera.
 */
let anomaliaCola = '';

/** El motivo del último descarte por firma, o cadena vacía si no hubo. */
export function detalleAnomaliaCola(): string {
  return anomaliaCola;
}

/**
 * Lo que se guarda en `localStorage`.
 *
 * `nanites`, `producidas` y `clics` son el estado que el jugador tenía en el
 * último instante conocido por este dispositivo, no un incremento. Los tres
 * van juntos porque los tres los borra el reinicio de prestigio a la vez.
 *
 * Y `nucleos` va con ellos por un motivo que se tardó en ver: el reinicio de
 * prestigio PAGA con núcleos y pone las nanitas a cero. Si un jugador reinicia
 * sin conexión y cierra la pestaña, la cola restaura su saldo a cero —correcto—
 * pero los núcleos que se llevó se quedaban solo en la memoria de la partida
 * anterior. Al recargar se encontraba con las dos manos vacías: había reiniciado
 * para nada. Los núcleos son lo único que el reinicio no borra, así que son lo
 * único que la cola tiene que saber devolver.
 */
interface Registro {
  v: number;
  /** Dueño de la cola. Dos cuentas en el mismo navegador no mezclan saldos. */
  uid: string;
  nanites: number;
  producidas: number;
  clics: number;
  /** Núcleos disponibles. El prestige los paga, así que no se pueden perder. */
  nucleos: number;
  /** Núcleos ganados de por vida, que son los que fija la barra de progreso. */
  totalNucleos: number;
  /** Reinicios hechos. Sin esto, un prestige sin red no se contaría nunca. */
  reinicios: number;
  /**
   * Cuándo se anotó.
   *
   * Es el campo más importante del archivo. Sin él no hay forma de saber si la
   * cola o el documento es el más nuevo, y sin eso el reinicio de prestigio se
   * puede usar para farmear núcleos sin conexión.
   */
  ts: number;
  /**
   * F104 · La firma de los campos de arriba (v2). Los registros v1 no la
   * traen y se aceptan igual: invalidarlos todos en la actualización sería
   * tirar el progreso sin subir de quien tenía cola pendiente, que es justo
   * lo que la cola existe para evitar.
   */
  h?: string;
}

/** Lo que se devuelve al juego. `existe` distingue "cola vacía" de "sin cola". */
export interface EstadoCola {
  /** El registro existe en `localStorage` y es utilizable. */
  existe: boolean;
  nanites: number;
  producidas: number;
  clics: number;
  nucleos: number;
  totalNucleos: number;
  reinicios: number;
  /** Marca de la anotación. */
  ts: number;
}

const NADA: EstadoCola = {
  existe: false, nanites: 0, producidas: 0, clics: 0,
  nucleos: 0, totalNucleos: 0, reinicios: 0, ts: 0
};

/**
 * Lee la cola guardada para esta cuenta.
 *
 * NUNCA lanza y devuelve `existe: false` ante cualquier cosa inesperada: un
 * `localStorage` corrupto, un registro de otra versión del juego o un
 * `JSON.parse` fallando no pueden impedir que el juego arranque. Perder la cola
 * es un bug de hace tres versiones; no arrancar es perder la partida.
 *
 * Que devuelva `existe: false` para un registro corrupto es deliberado: un
 * registro ilegible no se puede comparar por fecha, así que no hay manera de
 * saber si es más nuevo que el documento. Ante la duda se queda el documento,
 * que es el estado que el jugador reconoce y el que todas las demás sesiones
 * han visto. Inventarse una fecha sería apostar por un saldo que nadie ha visto.
 */
export function leerCola(uid: string): EstadoCola {
  // F104 · El flag se recalcula en cada lectura: una vez descartado lo tocado
  // y anotado lo válido, la siguiente lectura ya no ve anomalía y no se avisa
  // dos veces por lo mismo.
  anomaliaCola = '';
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return NADA;

    const r = JSON.parse(crudo) as Registro;
    if (!r || (r.v !== VERSION && r.v !== VERSION - 1)) return NADA;
    // La cola es de una cuenta concreta. Si el mismo navegador entra con otra,
    // lo guardado no le pertenece y aplicarlo sería regalar o quitar dinero.
    if (r.uid !== uid) return NADA;
    if (typeof r.ts !== 'number' || !isFinite(r.ts) || r.ts <= 0) return NADA;
    if (![r.nanites, r.producidas, r.clics, r.nucleos, r.totalNucleos, r.reinicios]
      .every((n) => typeof n === 'number' && isFinite(n))) {
      return NADA;
    }
    // F104 · La firma solo se exige a los registros que dicen traerla (v2).
    // Un v2 sin firma o con firma rota es un disco tocado a mano: se descarta
    // y se deja el motivo para avisar, y el juego tira del servidor.
    if (r.v === VERSION) {
      const esperada = firmaDeRegistro(r as {
        uid: string; nanites: number; producidas: number; clics: number;
        nucleos: number; totalNucleos: number; reinicios: number; ts: number;
      });
      if (typeof r.h !== 'string' || r.h !== esperada) {
        anomaliaCola = 'firma';
        return NADA;
      }
    }

    return {
      existe: true,
      nanites: r.nanites,
      producidas: r.producidas,
      clics: r.clics,
      nucleos: r.nucleos,
      totalNucleos: r.totalNucleos,
      reinicios: r.reinicios,
      ts: r.ts
    };
  } catch {
    return NADA;
  }
}

/**
 * Anota el estado actual como pendiente de confirmar.
 *
 * Se llama desde el propio guardado, antes de tocar la red. Es una escritura
 * SÍNCRONA a propósito: el objetivo es que esté en el disco antes de que el
 * jugador pueda cerrar la pestaña, y un `await` abre una ventana en la que un
 * cierre deja la operación a medias.
 *
 * Se anota INCLUSO cuando los tres valores son cero, y esa es la parte
 * delicada. El reinicio de prestigio pone las nanitas a cero: si aquí se
 * escribiera "sin cola" por no haber nada pendiente, el documento del servidor
 * se quedaría con el saldo previo y el reinicio se perdería. Escribir el cero
 * es precisamente lo que lo hace desaparecer.
 */
export function anotarPendiente(
  uid: string,
  nanites: number,
  producidas: number,
  clics: number,
  nucleos: number,
  totalNucleos: number,
  reinicios: number
): number {
  try {
    const ts = Date.now();
    const base = {
      uid,
      nanites: Math.floor(nanites),
      producidas: Math.floor(producidas),
      clics: Math.floor(clics),
      nucleos: Math.floor(nucleos),
      totalNucleos: Math.floor(totalNucleos),
      reinicios: Math.floor(reinicios),
      ts
    };
    const registro: Registro = { v: VERSION, ...base, h: firmaDeRegistro(base) };
    localStorage.setItem(CLAVE, JSON.stringify(registro));
    return registro.ts;
  } catch {
    // Modo privado, cuota llena o `localStorage` bloqueado. El juego sigue
    // funcionando como antes de esta cola: sin red de seguridad, pero sin
    // romperse.
    return 0;
  }
}

/**
 * Vacía la cola SOLO si lo que hay dentro sigue siendo lo que se acaba de
 * confirmar, y devuelve si la vació.
 *
 * POR QUÉ NO BASTA CON `vaciarCola()` AL CONFIRMAR. `saveToFirebase` no se espera
 * en ninguno de los treinta sitios que la llaman, así que dos guardados se
 * solapan de forma normal: el jugador compra mientras el guardado anterior sigue
 * en el aire. Y entonces:
 *
 *   · El guardado A anota 100 y sale hacia la red.
 *   · El guardado B anota 200 y sale detrás.
 *   · B falla. A llega después, su operación salió bien, y vacía la cola.
 *
 * El documento se queda con 100, la cola ya no está, y el jugador ha perdido 200
 * nanitas sin ninguna forma de recuperarlas. Para A la operación fue un éxito,
 * y con razón: lo que A confirman es que A llegó. Lo que no puede afirmar es que
 * lo suyo sea lo último que se anotó.
 *
 * La marca de tiempo lo resuelve sin cambiar nada de la temporización: se vacía
 * solo si el registro que hay dentro es el mismo —o uno más viejo— que el que
 * este guardado confirmó. Si otro guardado escribió después, su saldo sigue ahí,
 * que es justo lo que hay que dejar vivo.
 *
 * Lo que NO arregla esto: dos guardados que los dos terminan bien pueden
 * escribirse en orden inverso, y el `setDoc` del que lleva el snapshot viejo se
 * escribiría después, dejando el documento unos segundos por detrás. Esa carrera
 * se cura sola en el siguiente guardado (cada compra y el intervalo de quince
 * segundos), mientras que la que arregla esta función no se curaba nunca, porque
 * la red de seguridad ya no estaba.
 */
export function confirmarCola(tsConfirmado: number): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return true;
    const r = JSON.parse(crudo) as Registro;
    // Si no se puede leer la marca, no se vacía. Ante un registro ilegible lo que
    // se protege es la red de seguridad, igual que en `leerCola`.
    if (!r || typeof r.ts !== 'number' || !isFinite(r.ts)) return false;
    if (r.ts > tsConfirmado) return false;
    localStorage.removeItem(CLAVE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Vacía la cola.
 *
 * Se llama SOLO cuando el servidor ha confirmado que ya tiene ese saldo.
 * Vaciarla antes de tiempo perdería nanitas: el documento se quedaría con la
 * cifra vieja y la cola con la nueva, y nadie sumaría las dos.
 */
export function vaciarCola(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer: si no se puede borrar, el siguiente `anotarPendiente`
    // lo sobrescribe con el estado actual.
  }
}

/**
 * ¿Queda algo por subir?
 *
 * Solo mira si el registro existe. NO compara contra el documento ni decide si
 * el saldo es cero: un registro a cero puede ser el reinicio de prestigio, y
 * esa es precisamente la razón de que siga ahí. Este "¿hay cola?" sirve para
 * decidir si merece la pena reintentar un guardado, no para decidir qué saldo
 * es el bueno.
 */
export function hayPendientes(uid: string): boolean {
  return leerCola(uid).existe;
}
