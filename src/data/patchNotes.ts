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
    version: '1.12.0',
    fecha: '7 de octubre de 2026',
    titulo: 'La forja en serie se lee mejor',
    lineas: [
      'La confirmación de forjar en serie ahora enseña cada dato en su fila: qué entra, cuántas tiradas, qué sobra y qué se gasta.',
      'Lo que advierte —que cada tirada consume sus materiales— va arriba del todo.',
      'Los números son los mismos de siempre: solo cambia cómo se leen.'
    ]
  },
  {
    version: '1.11.0',
    fecha: '7 de octubre de 2026',
    titulo: 'La build ajena se ve',
    lineas: [
      'Al ver el perfil de otro jugador ahora se ven sus pasivas pagadas, agrupadas por lo que hacen.',
      'Con la cuenta de nodos y niveles se lee qué build se está armando sin abrir su árbol.',
      'Si todavía no pagó ninguna, la tarjeta lo dice en vez de esconder el bloque.'
    ]
  },
  {
    version: '1.10.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Forzar afijos en la forja',
    lineas: [
      'Si los dos materiales comparten rareza, el resultado la conserva casi siempre: dos Comunes dan un Común.',
      'Si los dos traen el mismo afijo, entra el primero: pon dos con Baluarte y sale con Baluarte.',
      'La forja avisa de las dos cosas antes de tirar, con lo que hay en el yunque.'
    ]
  },
  {
    version: '1.9.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Ordenar por tipo en el almacén',
    lineas: [
      'El almacén tiene un orden nuevo: por tipo, con los compañeros primero, después los recolectores y después las cajas.',
      'El selector de orden ahora enseña solo lo que sirve con el filtro puesto: con recolectores no sale el por segundo, y al revés.',
      'Si cambias de filtro y el orden deja de valer, vuelve solo al orden de llegada.'
    ]
  },
  {
    version: '1.8.2',
    fecha: '7 de octubre de 2026',
    titulo: 'Con tarjeta no hay pausa',
    lineas: [
      'Con una tarjeta AFK puesta ya no sale el cartel de pausa ni el contador se pone a cero: el juego sigue cobrando hasta que se acaba la tarjeta.',
      'El botón tampoco se para mientras la tarjeta siga viva.',
      'Sin tarjeta todo sigue igual: al dejar de mirar, el juego se detiene y te espera.'
    ]
  },
  {
    version: '1.8.1',
    fecha: '7 de octubre de 2026',
    titulo: 'Ojo de Caja con efecto',
    lineas: [
      'El nodo Ojo de Caja ahora hace lo que dice: cada nivel da más probabilidad de que la caja dé un item del tier siguiente.',
      'El texto del nodo y el resumen de bonificaciones ya dicen ese efecto en vez de una suerte sin explicar.',
      'Sin el nodo, las cajas dan lo mismo de siempre.'
    ]
  },
  {
    version: '1.8.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Sin ruleta: directo al premio',
    lineas: [
      'Abrir cajas, sintonizar y forjar ya no giran nada: el resultado sale directo en su cartel.',
      'El premio es el mismo de siempre y sale igual que antes, solo que sin la espera.',
      'El ajuste de saltar la animación desaparece con ella, porque ya no hay nada que saltar.',
      'El ajuste de notas ahora sí guarda lo que eliges: antes se desmarcaba solo al volver a pintar la pantalla.'
    ]
  },
  {
    version: '1.7.3',
    fecha: '7 de octubre de 2026',
    titulo: 'El crítico ya pega',
    lineas: [
      'Los afijos de crítico ahora hacen lo que dicen: cada click puede salir crítico y pegar el doble.',
      'El crítico se ve distinto en la pantalla: sale marcado en dorado para reconocerlo sin leer la cifra.',
      'Vale para los clicks que pulsas tú sobre el recolector.'
    ]
  },
  {
    version: '1.7.2',
    fecha: '7 de octubre de 2026',
    titulo: 'Buscador que no pierde el foco',
    lineas: [
      'El buscador del almacén decía una frase larga que no cabía: ahora dice Buscar y la explicación va en su ayuda.',
      'Al escribir la primera letra el campo ya no pierde el foco: se puede seguir escribiendo sin volver a tocarlo.',
      'El cursor se queda al final del texto en cada letra, como en cualquier buscador.'
    ]
  },
  {
    version: '1.7.1',
    fecha: '7 de octubre de 2026',
    titulo: 'Núcleos sin duplicar',
    lineas: [
      'En Ascensión los núcleos salían dos veces en la misma pantalla: ahora salen una sola, arriba en la cabecera.',
      'La cifra de la cabecera es la misma en los siete sectores y se actualiza sola al comprar cada nodo.',
      'Si al comprar un nodo el saldo no te alcanza, la hoja te dice cuántos te faltan antes de confirmar.'
    ]
  },
  {
    version: '1.7.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Stock en el mercado y packs de cristal',
    lineas: [
      'Las cartas del mercado dicen cuántas tienes guardadas: cajas, tarjetas y piedras enseñan su stock antes de comprar.',
      'La carta de cristal ahora se llama pack y dice cuántos cristales trae cada uno, y al comprar varios el diálogo dice el total que te llevas.',
      'Los cosméticos y los logros del perfil van de diez en diez, con las flechas arriba de cada lista.',
      'El nodo de operaciones offline sale del árbol: prometía clics al volver y no hacía nada.'
    ]
  },
  {
    version: '1.6.0',
    fecha: '6 de octubre de 2026',
    titulo: 'El banner es el fondo y el marco es tu icono',
    lineas: [
      'El banner y el marco ahora son dos cosas separadas: el banner es el fondo del avatar y el marco es tu icono de perfil.',
      'Cada marco tiene su propio fondo, su propia figura y su color: se ve tal cual es, sin que el fondo lo tina.',
      'Cambiar de banner ya no cambia tu icono: el fondo y la cara son independientes.',
      'Los marcos se rediseñaron con una figura acorde a su nombre: Acero es un hexagono, Cuantico un atomo, Prisma un prisma, Cascada lluvia, Espectro un arcoiris.',
      'Los marcos especiales tienen animacion: Neon late, Brasa respira, Cuantico y Espectro giran, Cascada cae.',
      'Los banners tambien ganaron animacion sutil, pero sin girar: el fondo nunca se mueve como una caja.',
      'En el perfil, el nombre y el titulo ya no empujan el icono: se queda en su sitio aunque el titulo sea largo.'
    ]
  },
  {
    version: '1.5.0',
    fecha: '6 de octubre de 2026',
    titulo: 'Banners con carácter y el AFK que de verdad funciona',
    lineas: [
      'Cada banner trae ahora su propio borde, su forma y el color de su icono: cambiar de banner cambia el marco y la figura de dentro.',
      'Los marcos dejan de ser todos circulos: cada uno tiene la forma que promete su nombre.',
      'El banner rellena todo el fondo del avatar, no un halo alrededor, y su borde va sobre el fondo sin taparlo.',
      'Arreglado: con una tarjeta AFK puesta puedes cambiar de pestaña o de ventana y el juego sigue produciendo, sin cartel de pausa.',
      'El tiempo de la tarjeta corre igual aunque no estes mirando, y sigue parando exactamente cuando se acaba.',
      'Sin tarjeta, cambiar de pestaña sigue deteniendo la produccion como antes.'
    ]
  },
  {
    version: '1.4.0',
    fecha: '6 de octubre de 2026',
    titulo: 'La forja en serie',
    lineas: [
      'La forja tiene un boton nuevo: forja de una sentada todo lo que tengas del tier, de dos en dos y siempre por potencial, de mayor a menor.',
      'Con cuatro materiales del mismo tier salen dos tiradas. Con un numero impar, el que sobra se queda en el almacen.',
      'Los resultados salen en una lista, uno por tirada, con lo que se gasto en piedras y nanoparticulas arriba del todo.',
      'El boton pide confirmacion y dice cuantos materiales entran, cuantas tiradas salen y cuanto se va a gastar.',
      'Las piedras ya no tienen un tope que corte antes de tiempo: se gastan las que hagan falta para llegar al maximo de probabilidad, y en los tiers altos antes no se podia llegar.',
      'En la forja en serie las piedras se ponen solas, sin que elijas cuantas, y se ajustan a cada pareja por sus afijos.',
      'El equipado no se puede fusionar nunca, ni a mano ni en serie.',
      'ElCompanero del historial ya enseña su potencial y su nivel, y brilla como los demas cuando le toca.',
      'Arreglado: el avatar y el movil en el ranking, y el alto de las paginas, que en pantallas cortas cortaban el contenido por arriba.',
      'En la forja de a uno puedes seguir bajando las piedras a mano, y avisa cuando no te llegan en vez de dejar el boton en silencio.'
    ]
  },
  {
    version: '1.3.0',
    fecha: '6 de octubre de 2026',
    titulo: 'Brillos, escuadrón y acceso rápido',
    lineas: [
      'Los recolectores y los compañeros más afortunados brillan: cuanto más potencial y más nivel, más halo, y en el máximo llevan un destello propio.',
      'El brillo se ve en el almacén, en la ficha del inicio y en la tarjeta del ranking, y siempre con el color de su rareza.',
      'En la ficha del recolector hay un solo número grande, y al posar el ratón salen las dos partes que lo componen.',
      'El recolector y el escuadrón son ahora dos pestañas en la columna derecha, para no tener que hacer scroll.',
      'Hay tres huecos de acceso rápido en la base para los consumibles: eliges tú qué va en cada uno y puedes quitarlo cuando quieras.',
      'Los compañeros ya pagan su rareza y su potencial: un compañero Divino rinde bastante más que uno Común de la misma carta.',
      'En el almacén hay filtro de Cajas, y "Otros" se queda con llaves, cristales y consumibles.',
      'Las notas de parche se pueden ver a demanda desde Ajustes, no solo al entrar.',
      'El contador de visitas del perfil cuenta ahora cada vez que alguien entra, no solo la primera.'
    ]
  },
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