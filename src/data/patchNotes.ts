// ==========================================================================
//  Las notas de parche, y la versión del juego
// ==========================================================================
//  POR QUÉ ESTO EXISTE.
//
//  Un incremental cambia todas las semanas, y el jugador que vuelve después de unos
//  días necesita saber **qué ha cambiado sin haber estado**. Sin eso, el síntoma es
//  "hay un botón nuevo y no sé para qué", y el comentario de un código no le sirve a
//  nadie que no lo abra.
//
//  Y el contenido tiene una regla que no es de estilo sino de veracidad: **las notas
//  dicen qué se ve, no cómo está hecho**. "Se añadieron doce logros difíciles y trece
//  cosméticos nuevos" es verdad útil. "Se subió el suelo de afijos de la rareza Mítica de
//  tres a cuatro" es verdad que solo le importa a quien mantiene el juego, y una nota
//  de parche llena de eso se lee como un commit log: el jugador deja de leerla el día
//  que se parece a un commit log. Por eso `leyendaCheck` vigila que ninguna nota
//  nombre un fichero, una función ni un número interno.
//
//  LA VERSIÓN VIENE DE `package.json`, NO DE AQUÍ.
//
//  Es el único sitio donde el número puede ser verdad a la vez: una constante escrita
//  a mano se queda vieja el día que se sube la versión y nadie se entera, que es
//  exactamente el fallo que este módulo vino a arreglar. `import.meta` no lo da, y
//  `resolveJsonModule` ya estaba activado en `tsconfig.json`.
//
//  LO QUE HAY QUE HACER PARA PUBLICAR UN PARCHE, Y SOLO ESTO:
//
//   1. Subir la versión en `package.json`.
//   2. Añadir una entrada al principio de `NOTAS` con las líneas de ese parche.
//
//  Ni más. El cartel aparece solo, se marca como visto solo y las notas no se enseñan
//  dos veces. `versionActual()` es la que compara, así que un parche sin nota es
//  invisible y una nota sin subida de versión no se ve nunca.
// ==========================================================================

import { version as VERSION_PACKAGE } from '../../package.json';

/** La versión del juego, leída de `package.json`. */
export const VERSION = VERSION_PACKAGE;

export interface NotaDeParche {
  version: string;
  /** Fecha de publicación, tal y como se enseña: "4 de octubre de 2026". */
  fecha: string;
  /** Un titular corto: lo que se lee en la lista si algún día hay más de una. */
  titulo: string;
  /** Las líneas del parche. Macro: qué se ve, no cómo está hecho. */
  lineas: string[];
}

/**
 * LAS NOTAS, DE MÁS RECIENTE A MÁS ANTIGUA.
 *
 * La primera entrada es la que se enseña y **tiene que ser la de la versión actual**.
 * El banco lo comprueba, así que una nota huérfana —de una versión que no existe— o un
 * parche sin nota salen en rojo antes de que lo vea nadie.
 */
export const NOTAS: NotaDeParche[] = [
  {
    version: '1.2.0',
    fecha: '4 de octubre de 2026',
    titulo: 'Cosmetics, logros y lotes',
    lineas: [
      'Se añadieron doce logros nuevos, todos difíciles, y sus recompensas: nuevos marcos, banners y títulos.',
      'Se rediseñaron los marcos, los banners y los títulos: ahora cada uno se ve como dice su nombre.',
      'Se amplió la ficha de los objetos del almacén: ahora también cuentan su historia, no solo sus números.',
      'La forja explica cuántos afijos da un item y de dónde sale ese número.',
      'Ahora se pueden abrir hasta 99 cajas de una vez, siempre que quede espacio en el almacén.',
      'Se añadió la sintonización automática: gasta los cristales seguidos hasta que no llega para más.',
      'El Perfil cuenta con una galería de todos los cosméticos, con lo que aún no se ha conseguir.',
      'Se corrigieron varios errores de la forja: el selector de orden no se podía usar y la página saltaba hacia arriba al cambiar algo.'
    ]
  },
  {
    version: '1.1.0',
    fecha: '3 de octubre de 2026',
    titulo: 'La reescritura',
    lineas: [
      'Se reescribieron las seis pantallas del juego sobre una base común.',
      'Se añadieron los doce nodos de la Ascensión y el árbol de pasivas.',
      'Se sustituyeron las llaves de las cajas por un sistema de apertura en cadena.',
      'El almacén se puede ampliar con expansores, y cada expansor tiene su propio nivel.',
      'Se añadió el guardado automático y la sincronización entre dispositivos.',
      'Aparecieron los rankings por tabla y por recaída.'
    ]
  }
];

/** La nota de la versión que se está jugando, o `null` si no hay ninguna. */
export function notaDeEstaVersion(): NotaDeParche | null {
  return NOTAS.find(n => n.version === VERSION) ?? null;
}