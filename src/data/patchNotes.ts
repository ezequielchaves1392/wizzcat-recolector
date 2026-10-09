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