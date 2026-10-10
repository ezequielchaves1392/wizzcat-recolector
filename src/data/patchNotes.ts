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
    version: '1.15.43',
    fecha: '10 de octubre de 2026',
    titulo: 'Uso de red visible en Ajustes',
    lineas: [
      'En Ajustes hay una sección nueva que enseña cuántas operaciones con el servidor hiciste en el último minuto y en total.',
      'Dice qué lo movió con nombres normales y avisa si hubo un pico: en beta nos ayuda a cazarlos.',
      'Abrir el ranking trae muchas lecturas de golpe y es normal: ese salto no es un pico.'
    ]
  },
  {
    version: '1.15.42',
    fecha: '10 de octubre de 2026',
    titulo: 'Entrar nuevo en el otro servidor ya funciona',
    lineas: [
      'Entrar por primera vez en el otro servidor ya no te deja en mantenimiento.',
      'El problema era que la cuenta se reservaba antes de crear tu partida y la lectura la veía a medias.',
      'Si te pasó, vuelve a entrar y empiezas de cero como toca.'
    ]
  },
  {
    version: '1.15.41',
    fecha: '10 de octubre de 2026',
    titulo: 'Guardado en bloque para cuidar la cuota',
    lineas: [
      'La partida se guarda en bloque cada poco tiempo en vez de con cada cosa que haces, para que la cuota no se agote a mitad del día.',
      'La tabla de posiciones va con algo de retraso: lo que consigas ahora aparece al rato.',
      'Mirar el perfil de otro jugador ya no deja contador de visitas y la tabla ya no dice quién está en línea.'
    ]
  },
  {
    version: '1.15.40',
    fecha: '10 de octubre de 2026',
    titulo: 'Elige tu servidor al entrar',
    lineas: [
      'Al abrir el juego eliges en qué servidor jugar antes de identificarte.',
      'Cada servidor tiene sus jugadores y sus partidas: lo de uno no aparece en el otro.',
      'Desde el acceso y desde el aviso de mantenimiento puedes cambiar de servidor.'
    ]
  },
  {
    version: '1.15.39',
    fecha: '10 de octubre de 2026',
    titulo: 'Núcleos: lo que ganas y lo que te falta',
    lineas: [
      'El botón de Ascensión dice siempre los núcleos que te va a dar esta vuelta.',
      'Arriba ves los que tienes y dentro de la página, tu histórico.',
      'El nodo de núcleos premia solo lo que produces después de comprarlo.'
    ]
  },
  {
    version: '1.15.38',
    fecha: '10 de octubre de 2026',
    titulo: 'Salida al otro servidor desde el cartel',
    lineas: [
      'Si tu servidor está en mantenimiento, el cartel te ofrece seguir jugando en el otro servidor.',
      'En el otro servidor empiezas de cero: tu partida sigue intacta donde estaba.',
      'Volver al primer servidor es abrirlo de nuevo: cada uno guarda lo suyo.'
    ]
  },
  {
    version: '1.15.37',
    fecha: '10 de octubre de 2026',
    titulo: 'La barra de Ascensión dice lo que falta',
    lineas: [
      'La barra de la Ascensión ya no se queda al máximo: siempre dice cuánto falta para el siguiente núcleo.',
      'Con núcleos por ganar, también dice cuántos ganarías produciendo un poco más.',
      'Así siempre sabes si te conviene seguir produciendo o reciclar ya.'
    ]
  },
  {
    version: '1.15.36',
    fecha: '10 de octubre de 2026',
    titulo: 'Segundo servidor para jugadores nuevos',
    lineas: [
      'Hay un segundo servidor del juego, para jugadores que empiezan desde cero.',
      'Cada servidor tiene sus partidas y su ranking: lo de uno no aparece en el otro.',
      'Tu partida no se mueve: sigues jugando donde estabas.'
    ]
  },
  {
    version: '1.15.35',
    fecha: '10 de octubre de 2026',
    titulo: 'La Wiki con los colores del juego',
    lineas: [
      'La sección de Pasivas pinta cada rama con su color del juego, como las pestañas de la Ascensión.',
      'El simulador de base enseña el icono con su brillo, las estrellas en amarillo y cada afijo con su color.',
      'La rareza del simulador la pone el tier y cada nodo del árbol dice lo que lleva pagado.',
      'Las dos herramientas viven en subpestañas propias dentro de la sección.'
    ]
  },
  {
    version: '1.15.34',
    fecha: '10 de octubre de 2026',
    titulo: 'Pasivas de la Wiki por ramas',
    lineas: [
      'La sección de Pasivas de la Wiki se ordena por ramas, como las pestañas del juego, con lo que enfoca cada una.',
      'Cada rama lista todos sus nodos por fila, con su coste en núcleos y sus requisitos.',
      'Las filas se abren por puntos en su rama, igual que en la pantalla de Ascensión.'
    ]
  },
  {
    version: '1.15.33',
    fecha: '10 de octubre de 2026',
    titulo: 'Herramientas en la Wiki: dos simuladores',
    lineas: [
      'La Wiki tiene una sección nueva de Herramientas, con dos simuladores para probar sin gastar nada.',
      'El simulador de árbol deja armar una build con núcleos de mentira y ver lo que otorga, lo que cuesta y lo que habría que producir para pagarla.',
      'El simulador de base enseña cómo quedaría cualquier base con el potencial, el nivel y los afijos que elijas.'
    ]
  },
  {
    version: '1.15.32',
    fecha: '10 de octubre de 2026',
    titulo: 'Cinco logros nuevos del árbol',
    lineas: [
      'Cinco logros nuevos celebran el árbol: tu primer keystone, una rama completa, una Obra Maestra, un premio subido y un botín doble.',
      'Cada uno trae su banner para el perfil.',
      'Si el juego no puede cargar tu partida por mantenimiento, el aviso ahora también lo dice así y te deja abrir la Wiki mientras esperas.'
    ]
  },
  {
    version: '1.15.31',
    fecha: '10 de octubre de 2026',
    titulo: 'El árbol llega a quince nodos por rama',
    lineas: [
      'Cada rama del árbol ahora tiene quince nodos, hasta el fondo.',
      'Nuevos nodos que suben la probabilidad de crítico.',
      'Abrir una caja ahora también paga nanitas si tienes el Seguro.'
    ]
  },
  {
    version: '1.15.30',
    fecha: '9 de octubre de 2026',
    titulo: 'Pantalla de mantenimiento',
    lineas: [
      'El aviso de cuota agotada ahora dice que el servidor está en mantenimiento.',
      'La pantalla de mantenimiento tiene un botón para abrir la Wiki.',
      'La Wiki ya no tiene el botón de cerrar que volvía al juego.'
    ]
  },
  {
    version: '1.15.29',
    fecha: '9 de octubre de 2026',
    titulo: 'Las cajas dan buffers de compañero',
    lineas: [
      'Las cajas dan tres buffers que suben el ingreso de un tipo de compañero.',
      'Cada buffer dura 30 minutos y se gasta desde el almacén.',
      'El buffer global sube el ingreso de todos los compañeros.'
    ]
  },
  {
    version: '1.15.28',
    fecha: '9 de octubre de 2026',
    titulo: 'Los compañeros llevan afijos',
    lineas: [
      'Los compañeros ahora tienen afijos según su rareza, como los recolectores.',
      'Cada tipo usa los suyos: los pasivos leen afijos de pasivo y los de clic, de clic.',
      'Las fichas viejas reciben sus afijos al cargar la partida.'
    ]
  },
  {
    version: '1.15.27',
    fecha: '9 de octubre de 2026',
    titulo: 'La tienda vende cajas altas con licencia y las cajas hacen eco',
    lineas: [
      'La tienda vende cajas T2 y T3 si tienes su licencia del árbol de Fortuna.',
      'El Eco puede doblar el botín de una caja: nanitas, cristales y cartas apilables.',
      'Las tarjetas de caja dicen si piden licencia antes de que las compres.'
    ]
  },
  {
    version: '1.15.26',
    fecha: '9 de octubre de 2026',
    titulo: 'Cuatro keystones, uno por rama',
    lineas: [
      'Cada rama tiene su maestría al fondo: Sobrecarga, Mente Colmena, Jackpot y Obra Maestra.',
      'Sobrecarga asegura un crítico triple cada cincuenta clics, tuyos y de la máquina.',
      'Mente Colmena hace que cada compañero activo mejore a los demás.',
      'Jackpot puede subir un tier el premio de una caja, y la forja de dos perfectos firma una Obra Maestra.'
    ]
  },
  {
    version: '1.15.25',
    fecha: '9 de octubre de 2026',
    titulo: 'El árbol se divide en cuatro ramas',
    lineas: [
      'Las pasivas ahora viven en cuatro ramas con su nombre: Asalto, Manada, Fortuna y Forja.',
      'Cada rama se abre por puntos: compra niveles en ella para bajar de fila.',
      'Al entrar verás tus núcleos devueltos y el árbol vacío: es para recomprarlo en las ramas nuevas.',
      'La suerte de forja del árbol suma menos que antes: las piedras vuelven a importar.'
    ]
  },
  {
    version: '1.15.24',
    fecha: '9 de octubre de 2026',
    titulo: 'La forja en serie gasta menos cuota',
    lineas: [
      'Forjar toda una fila de compañeros de golpe escribía la partida una vez por pareja; ahora la escribe una sola vez al terminar.',
      'El resultado es el mismo y se enseña igual: la lista de lo que salió de cada par no cambia.',
      'Si forjas mucho seguido lo notas en el numerito de operaciones: ya no se dispara, sube una vez por serie.'
    ]
  },
  {
    version: '1.15.23',
    fecha: '9 de octubre de 2026',
    titulo: 'Los clics automáticos rinden menos y no usan tus tarjetas',
    lineas: [
      'La Automatización Total da un clic por segundo en vez de cuatro, y llega a tres niveles en vez de cinco.',
      'Los clics automáticos ya no usan tus tarjetas de clics: esas son para tu dedo, la máquina cobra lo suyo.',
      'Si tenías niveles de más en ese nodo, se quedan guardados pero cuentan hasta el techo nuevo.'
    ]
  },
  {
    version: '1.15.22',
    fecha: '9 de octubre de 2026',
    titulo: 'Los afijos salen en todos lados y pesan según el tier',
    lineas: [
      'Los recolectores de tienda y de caja traen afijos como los forjados: cada rareza lleva siempre los suyos.',
      'El mismo afijo pega más en un tier alto, así que un tier alto con buenos afijos vale doble.',
      'El afijo de suerte de forja se fue del juego: prometía una probabilidad que nunca daba.',
      'Los Comunes forjados pierden sus afijos, que ahora son cero por regla.'
    ]
  },
  {
    version: '1.15.21',
    fecha: '9 de octubre de 2026',
    titulo: 'La Wiki busca y el juego enseña su ritmo',
    lineas: [
      'La Wiki ahora tiene buscador: escribes lo que buscas y te lleva a la sección que lo explica.',
      'Los conceptos se enlazan entre sí, así que desde una explicación saltas a la que sigue sin perderte.',
      'Mientras juegas ves un numerito con el ritmo de operaciones de la partida, en verde, naranja o rojo.'
    ]
  },
  {
    version: '1.15.20',
    fecha: '9 de octubre de 2026',
    titulo: 'Un modo para probar sin gastar',
    lineas: [
      'Hay un modo de pruebas escondido para quien prueba el juego sin parar: con el puesto, tu partida se guarda igual pero tu fila del ranking y tu ficha dejan de publicarse.',
      'Pasear el ranking y abrir perfiles deja de sumar operaciones mientras dure la prueba.',
      'Se enciende desde la consola del navegador y viene apagado: no es un ajuste del juego, es una herramienta para no gastar la cuota probando.'
    ]
  },
  {
    version: '1.15.19',
    fecha: '9 de octubre de 2026',
    titulo: 'La Wiki del juego',
    lineas: [
      'La Wiki se abre en una pestaña aparte, desde el acceso o la cabecera, y explica el juego en un solo sitio: mecánicas, cajas, bases, items, logros, pasivas y versiones.',
      'Cada caja enseña lo que puede traer y con qué probabilidad, con los números del sorteo de verdad.',
      'Las bases ocultas tienen su lista completa, con lo que multiplica cada una y lo raro que sale.',
      'Los logros dicen qué piden y qué dan, y el árbol enseña cada nodo con su coste y sus requisitos.',
      'El probador de builds queda anotado como lo siguiente y todavía no está.'
    ]
  },
  {
    version: '1.15.18',
    fecha: '9 de octubre de 2026',
    titulo: 'El ranking y los perfiles gastan menos',
    lineas: [
      'Abrir el ranking varias veces seguidas ya no lo vuelve a pedir cada vez: la tabla se queda un rato en tu pantalla.',
      'Mirar el perfil de otro jugador cuenta la visita igual que antes, pero pide su ficha una sola vez en vez de dos.',
      'La partida se guarda cada minuto cuando no haces nada, en vez de cada medio minuto: lo producido se recupera al recargar igual que antes.',
      'Tu puesto en el ranking tarda un poco más en moverse: la tabla se actualiza cada diez minutos.'
    ]
  },
  {
    version: '1.15.17',
    fecha: '9 de octubre de 2026',
    titulo: 'Diez bases ocultas por tier, y a cazar',
    lineas: [
      'Cada arma y cada compañero tiene ahora una base oculta propia: dos del mismo tier y estrellas pueden pegar distinto, y la mejor sale menos.',
      'Lo que ya tenías también sorteó su base al cargar: tus números se movieron un poco, para arriba o para abajo.',
      'El techo de nivel ahora mira la base además del potencial: una base buena sube más niveles.',
      'Forjar promedia las bases de los padres: dos bases buenas dan base buena.'
    ]
  },
  {
    version: '1.15.16',
    fecha: '9 de octubre de 2026',
    titulo: 'El daño final suma arma y pasivos',
    lineas: [
      'El daño del arma ahora suma tus pasivos: la ficha enseña el daño final, no solo el del arma.',
      'Al apoyar el número se parte en dos: cuánto es del arma y cuánto de la partida.',
      'El perfil y el ranking enseñan ese mismo final; los buffs temporales solo se cuentan donde se cobran.'
    ]
  },
  {
    version: '1.15.15',
    fecha: '8 de octubre de 2026',
    titulo: 'La forja anuncia la rareza y el compañero explica su número',
    lineas: [
      'La forja ahora dice qué rareza trae lo que vas a forjar, al lado del potencial: en recolectores la calculada, en compañeros la del tier.',
      'La ficha del compañero explica de dónde sale su número, fila por fila: potencial, rareza y nivel, con los mismos números que cobra.',
      'Su desglose decía de más: usaba la cuenta del recolector y no traía la rareza. Ahora cuadra con el ingreso.'
    ]
  },
  {
    version: '1.15.14',
    fecha: '8 de octubre de 2026',
    titulo: 'Bases ocultas, la forja reequilibrada y el Éter de Refinamiento',
    lineas: [
      'Cada arma y cada compañero tiene ahora una base propia y oculta: dos del mismo tier y las mismas estrellas pueden doler distinto.',
      'La Piedra de Calibración aporta menos por unidad, y el botón de las necesarias te dice cuántas hacen falta de verdad.',
      'La Nanopartícula de Estabilidad sube la rareza del resultado la mitad de las veces, y solo funciona forjando recolectores.',
      'Nuevo en la forja: el Éter de Refinamiento, que sube las posibilidades de ganar una estrella de potencial, y se gasta aunque la tirada falle.',
      'Las cajas altas pueden soltar nanopartículas y Éter, y una caja T2 ya puede soltar piedras.'
    ]
  },
  {
    version: '1.15.13',
    fecha: '8 de octubre de 2026',
    titulo: 'La Tarjeta AFK ya anula todos los cortes',
    lineas: [
      'Con la Tarjeta AFK puesta, al volver de estar ausente el juego te paraba el ingreso hasta que hicieras clic. Era un cobro que no tocaba: el ingreso nunca se habia cortado, asi que no habia nada que compensar.',
      'Ahora la Tarjeta AFK anula los cuatro cortes a la vez: por pestana, por ventana, por no estar mirando y por la espera al volver.',
      'Si la tarjeta se acaba mientras estas fuera, el corte vuelve con ella y el peaje tambien. Solo deja de existir mientras esta viva.',
      'Sin tarjeta no cambia nada: el juego sigue cobrando solo cuando lo estas mirando.'
    ]
  },
  {
    version: '1.15.12',
    fecha: '8 de octubre de 2026',
    titulo: 'El amplificador retirado te explica por que',
    lineas: [
      'Si tenias en el almacen un amplificador de click o de pasivo, al usarlo te decia que no tenia efecto conocido. No era un fallo tuyo ni del item: esos amplificadores se retiraron del juego.',
      'Ahora el mensaje dice que se retiraron, que multiplicaba cada uno y que no vuelven. Se quitem de la tienda hace tiempo y el item seguia sin explicar nada.',
      'El motivo de retirarlos: multiplicaban tu ingreso mientras no miraras la pantalla. Esa es justo la regla que el juego no rompe.',
      'El resto de consumibles y los cuatro expansores nunca han tenido este problema, y ahora hay pruebas que lo confirman.'
    ]
  },
  {
    version: '1.15.11',
    fecha: '8 de octubre de 2026',
    titulo: 'El ingreso de los companeros sigue sin dados',
    lineas: [
      'Los clicks del arbol ya critiquen. Los companeros no cambian, y es a proposito: su ingreso es por segundo, no son clicks.',
      'Un critico ahi seria cobrarte de mas sin que se vea por que, y ese ingreso se cobra aunque no estes mirando la pantalla.',
      'Para verlo necesitas un recolector con afijo de critico equipado: sin afijo no hay probabilidad que tirar, ni a mano ni en el arbol.'
    ]
  },
  {
    version: '1.15.10',
    fecha: '8 de octubre de 2026',
    titulo: 'Los clics del arbol ya critican',
    lineas: [
      'Los nodos que sueltan clicks automaticos ahora tiran critico, con la misma probabilidad y el mismo doble de dano que tu click.',
      'Y se ven igual que el tuyo: sale un "CRIT" en dorado cuando pegan fuerte.',
      'Tus afijos de critico ahora valen para los dos. Antes solo mejoraban tu click a mano.',
      'El ingreso de los companeros no cambia: sigue siendo por segundo y sin dados, porque se cobra aunque no estes mirando.'
    ]
  },
  {
    version: '1.15.9',
    fecha: '8 de octubre de 2026',
    titulo: 'La tarjeta AFK ya no se pasa del tiempo prometido',
    lineas: [
      'Compraste "+30 min por tarjeta" y te daba casi el doble. El extra estababien puesto en lo que alarga cada tarjeta, y otra vez en el tope, asi que se contaba dos veces.',
      'Con el pase a un nivel, el limite de AFK es de una hora, como decia el nodo. Con el pase al maximo, dos horas y media, no las seis y media que salian antes.',
      'Tambien se arreglo que el limite se multiplicaba en dos sitios distintos: uno arreglado, el otro seguia aplicando tres tarjetas. Ahora los dos preguntan a la misma regla.',
      'Lo que ya tengas puesto no se toca. Las tarjetas que no caben en el limite ya no se gastan.'
    ]
  },
  {
    version: '1.15.8',
    fecha: '8 de octubre de 2026',
    titulo: 'Un comando para probar sin gastar cuota',
    lineas: [
      'Probar el juego en local ya no escribe en el servidor de verdad: hay un comando que levanta todo contra un almacen de datos en tu maquina.',
      'Antes habia que acordarse de dos terminales y de una variable de entorno. Ahora el comando dice que falta Java si falta, lo busca si esta instalado pero no esta en el PATH, y avisa si hay un emulador viejo abierto que te haria ver datos de la sesion anterior.',
      'La interfaz web del emulador no esta: se probo y no levanta con esta configuracion, asi que no se anuncia. Para ver los documentos, la consola del navegador.',
      'La partida de verdad no se toca. Para volver a ella, abre el juego sin la variable y todo sigue igual.'
    ]
  },
  {
    version: '1.15.7',
    fecha: '8 de octubre de 2026',
    titulo: 'El almacen vacio era una lectura a medias, no tu cuenta',
    lineas: [
      'Si el servidor se pasa, el juego se montaba con el almacen vacio y tu saldo encima. Parecia que habias perdido tus cosas. No era asi: estaban a salvo en el servidor, lo que llegaba era una carga a medias.',
      'Ahora, cuando la carga llega incompleta, el juego no arranca y te enseña la pantalla de limite con un boton para reintentar, en vez de dejarte jugar sobre una partida fantasma que tampoco se guardaba.',
      'Los jugadores nuevos siguen jugando igual: su almacen vacio de verdad no se confunde con una lectura cortada.',
      'Tus cosas no se han perdido en ningun momento. Nada se ha escrito encima.'
    ]
  },
  {
    version: '1.15.6',
    fecha: '7 de octubre de 2026',
    titulo: 'Cuando el servidor se pasa, te lo explica en serio',
    lineas: [
      'Si el juego llega a su limite de uso del dia, ahora te sale una pantalla completa en vez de un aviso que se va a los segundos.',
      'La pantalla dice las tres cosas que importan: que no es un fallo de tu equipo, que tu partida esta intacta y que el limite se repone solo al dia siguiente.',
      'Tambien tienes un boton para reintentar por si ya ha pasado.',
      'Solo sale cuando el servidor dice de verdad que se acabo el limite. Una perdida de conexion o una espera normal siguen mostrando lo de siempre, que es lo que toca.'
    ]
  },
  {
    version: '1.15.5',
    fecha: '7 de octubre de 2026',
    titulo: 'La pestana dormida deja de guardarte la cuenta',
    lineas: [
      'Con el juego abierto en una pestana que no estabas mirando, el juego seguia guardando "estoy aqui" cada 22 segundos. Ahora se calla cuando la pantalla esta oculta y se retoma cuando vuelves.',
      'Tambien se nota en el punto del ranking: se actualiza cada cinco minutos en vez de cada minuto. Lo unico que enseña es si estas conectado.',
      'Esto arregla algo que te podia pasar: si dejabas el portatil abierto, la cuenta se quedaba reservada toda la noche y no habia forma de entrar desde el movil. Ahora la cuenta se libera en cuanto cierras o minimizas.',
      'Si vuelves y resulta que la partida se ha abierto en otro sitio, esta pestana te lo dice y deja pasar a la otra en vez de guardar encima.'
    ]
  },
  {
    version: '1.15.4',
    fecha: '7 de octubre de 2026',
    titulo: 'Probar ya no gasta cuota',
    lineas: [
      'Cuando probabas el juego en local, cada recarga escribia en el proyecto de verdad. Recargar para ver un cambio gastaba parte del presupuesto diario que comparten los jugadores.',
      'Ahora hay un emulador local: levantalo con `npm run dev:emulador` en una terminal y arranca el juego con la variable VITE_EMULADOR en la otra. Los datos se quedan en tu maquina y no se gastan.',
      'Solo funciona en desarrollo. En la version publicada nunca se activa, ni aunque la variable este puesta.',
      'Tambien se corrigio que las pruebas del juego desarrollo se ejecutaban una sola vez y con el numero guardado, en vez de con el reloj de verdad.'
    ]
  },
  {
    version: '1.15.3',
    fecha: '7 de octubre de 2026',
    titulo: 'Menos guardado y el bloqueo entre pestañas intacto',
    lineas: [
      'El juego decia "estoy aqui" con su propio guardado cada 22 segundos. Ahora lo dice aprovechant el guardado de la partida, que ya se hacia igual: una pestana abierta un dia entero pasa de 8.160 guardados a 5.280.',
      'El bloqueo entre pestanas sigue igual: abrir el juego en otro movil te dice lo de siempre y el tiempo de espera es el mismo.',
      'Tambien se arreglo un fallo que hacia el doble de consultas al esperar por una sesion ocupada, y que se quedaba consultando despues de haber entrado.'
    ]
  },
  {
    version: '1.15.2',
    fecha: '7 de octubre de 2026',
    titulo: 'La partida no se vuelve a guardar si no ha cambiado nada',
    lineas: [
      'El juego te guardaba la partida cada medio minuto aunque no hubieras hecho nada. Con la pestaña abierta mirando el almacén, eso eran 120 guardados por hora sin que ganaras ni una nanita.',
      'Ahora solo se guarda cuando algo cambia de verdad. Una hora mirando la partida no cuesta ni una escritura.',
      'Tus clics, tu ingreso automatico y las tarjetas que uses se siguen guardando igual: si algo cambia, se guarda en el acto.',
      'Tambien se arreglo un fallo que hacia justo lo contrario: si se caia la conexion al guardar, la partida se quedaba sin subir hasta que tocabas algo.'
    ]
  },
  {
    version: '1.15.1',
    fecha: '7 de octubre de 2026',
    titulo: 'Una partida que no se puede leer ya no se pierde',
    lineas: [
      'Cuando la forja se cancelaba por algo que no habías puesto, el cartel decia que habias fallado y que los materiales se gastaban igual. No era verdad: no se habia tirado nada y tus materiales seguian ahi.',
      'Ahora esos casos tienen su propio cartel, dicen el motivo y te enseñan que el yunque quedo intacto.',
      'Al abrir las cajas, cada compañero y cada recolector enseña su tier al lado de la rareza. Las estrellas te dicen dónde cayó dentro de su tier; el tier te dice cuál es.',
      'Si el servidor te devuelve la partida a medias, el juego deja de guardarla en vez de escribir una vacía encima. Tu partida sigue intacta: solo avisa y espera.',
      'El contador de ranuras del almacén va en un tamaño más grande, y con el signo que separa lo que da el expansor de lo que da el árbol.'
    ]
  },
  {
    version: '1.15.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Títulos que se ven, serie a la carta y última conexión',
    lineas: [
      'Los títulos con degradado se veían en su carta pero no junto a tu nombre: ahora salen en el perfil, en la cabecera y en el ranking.',
      'La forja en serie trae dos checks: usar piedras de calibración y usar nanopartículas, cada uno por su cuenta.',
      'En el ranking, el punto rojo ahora dice hace cuánto se vio a cada jugador: minutos, horas o días.'
    ]
  },
  {
    version: '1.14.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Expansores de mochila unificados',
    lineas: [
      'La tienda vende un solo expansor inicial, que amplía el almacén hasta dejarlo en un tamaño cómodo para empezar.',
      'Los tramos siguientes salen de las cajas: cada caja trae el expansor que toca según lo lejos que hayas llegado.',
      'Quien ya tenía expansores de los de antes los conserva, y se siguen usando igual.'
    ]
  },
  {
    version: '1.13.0',
    fecha: '7 de octubre de 2026',
    titulo: 'Estrellas al abrir cajas',
    lineas: [
      'Al abrir cajas, los recolectores y los compañeros enseñan sus estrellas en la misma fila.',
      'Ya no hace falta ir al almacén para ver qué potencial te tocó.',
      'Las filas de monedas y materiales siguen igual: solo los objetos llevan estrellas.'
    ]
  },
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