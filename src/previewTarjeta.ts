/**
 * La tarjeta de otro jugador, con datos de ejemplo, para poder mirarla.
 *
 * **POR QUÉ HACE FALTA, Y POR QUÉ NO ES "TRUCO".** La hoja real pide su documento a
 * Firestore, y sin reglas publicadas —o sin red— lo único que sale es el estado de
 * "todavía no tiene tarjeta pública", que es correcto. Con esa pantalla como única vista,
 * **nadie habría visto nunca cómo se ve una tarjeta con contenido**, que es justo lo que
 * hay que revisar: que un jugador con cuarenta recolectores no rompe la rejilla, que una
 * etiqueta no se pisa con un nombre larguísimo y que los números grandes no se salen de su
 * caja.
 *
 * Los datos pasan por `coaccionaTarjeta()`, la misma función que usa la hoja real, o sea
 * que lo que se ve aquí es lo que se vería con un documento de verdad.
 */
import { abreTarjetaDe } from './ui/tarjetaAjena';
import { coaccionaTarjeta } from './data/profile';

/**
 * Un jugador de ejemplo con las tres secciones llenas y los nombres largos a propósito:
 * **un nombre corto no enseña nada.** Los nombres van largos porque un nombre corto
 * ocupa media línea y siempre cabe; el que no cabe es el que se sale.
 */
const TARJETA_DE_EJEMPLO = {
  userId: 'ejemplo',
  username: 'Blanqui el Insaciable',
  nanitasProducidas: 4820000000,
  totalClicks: 1284000,
  cores: 640,
  totalCores: 918,
  resets: 23,
  cajasAbiertas: 1402,
  forjadas: 87,
  recolectores: [
    // **SOLO EL EQUIPADO**, que es lo que se publica. El resto sigue en su almacén.
    { id: 'a', name: 'Espuela de Confín', tier: 9, level: 14, maxLevel: 29, potential: 5, rarity: 'Divino', equipado: true,
      damage: 340, affixes: ['aff_crit', 'aff_focus'], forgedBy: 'CyberKnight', details: 'Daño base: +340' }
  ],
  companeros: [
    { id: 'p', name: 'Vigía', tier: 6, power: 42, rarity: 'Legendario', equipado: true, tipo: 'companion' },
    { id: 'q', name: 'Bruto', tier: 4, power: 18, rarity: 'Épico', equipado: true, tipo: 'companion' }
  ],
  nodosComprados: 7,
  nodosTotales: 24,
  nivelesDeArbol: 31,
  nodos: [
    { id: 'core_sink', name: 'Sumidero de Núcleos', nivel: 10, maxLevel: 10, categoria: 'multiplicador' },
    { id: 'passive_loop', name: 'Bucle de Extracción', nivel: 8, maxLevel: 10, categoria: 'automatizacion' },
    { id: 'scrapyard', name: 'Chatarrería', nivel: 7, maxLevel: 10, categoria: 'economia' },
    { id: 'forge_luck', name: 'Instinto de Forja', nivel: 6, maxLevel: 10, categoria: 'crafteo' }
  ],
  logros: ['first_click', 'collector_10', 'first_forge', 'ascendant', 'jackpot', 'tycoon'],
  totalLogros: 34,
  // **EL TÍTULO VA POR ID, NO POR NOMBRE.** El juego guarda el identificador del cosmético
  // (`title_recruited`), que es lo que va en el documento y lo que llega desde el ranking.
  // Aquí se ponía el nombre, así que la vista previa no ejercitaba nada: la traducción
  // devolvía vacío y el título desaparecía en lugar de salir mal. Con un id de verdad se ve
  // el nombre con su color y su fuente, que es lo que hay que mirar.
  cosmetics: { title: 'title_recruited', frame: 'frame_neon', banner: 'banner_pulse' },
  visitas: 12,
  visitantes: ['a', 'b', 'c', 'd', 'e'],
  updatedAt: 1750000000000
};

export function muestraTarjetaDeEjemplo(): void {
  const tarjeta = coaccionaTarjeta(TARJETA_DE_EJEMPLO, 'ejemplo');
  // El uid de ejemplo es el de la hoja real, así que **el contador no se toca**: con
  // `deEjemplo` no hay visita que anotar, y un preview que sumara visitas de mentira sería
  // la primera forma de que el contador dejara de ser de fiar.
  abreTarjetaDe('ejemplo', tarjeta.username, tarjeta);
}