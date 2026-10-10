// ==========================================================================
// Árbol de Pasivas · Núcleos
//
// Por qué existe: sin un término exponencial en el ingreso, cualquier curva de
// precios topa. El árbol es ese término. Los nodos no dan "números grandes",
// dan multiplicadores que se aplican a otros multiplicadores, así que el
// crecimiento es compuesto en vez de aditivo.
//
// Estructura deliberada (F97, columnas en F102):
//   - 4 RAMAS (Asalto / Manada / Fortuna / Forja), una por forma de jugar. La
//     pestaña enseña una rama y sus flechas no salen de ella: lo que se ve es
//     lo que hay que decidir.
//   - 3 COLUMNAS por rama: dos lados a elegir y un centro común. Cada lado
//     tira de una mecánica (Filo/Máquina, Enjambre/Colmena, Cajas/Comercio,
//     Probabilidad/Potencial) y el centro trae lo compartido, los keystones y
//     los nodos cruzados que sirven a otra build. Elegir lado es elegir
//     camino: el fondo de un lado no pide el del otro.
//   - 7 TIERS por rama (0..6). El tier NO se abre por nodos sueltos sino por PUNTOS
//     gastados en la rama (niveles comprados): 0/1/3/6/9/12/15. La columna vertebral
//     de cada rama es barata y el fondo es caro.
//   - Cada rama tiene un nodo raíz sin requisitos, así que siempre hay algo
//     comprable desde el primer reinicio: nunca hay un minuto sin objetivo.
//   - Los `requires` son intra-rama a propósito: un requisito de otra pestaña
//     obligaría a comprar a ciegas lo que no se ve. Los cruces murieron con las
//     columnas; lo que obliga a decidir ahora es repartir los núcleos entre
//     ramas, porque completar las cuatro cuesta cuatro veces.
//
// Económicamente: el coste crece 1.55x por nivel, pero los niveles 2..5 de un
// nodo cuestan la mitad por unidad de bonificación que el nivel 1. Se premia
// seguir en una rama sin castigar la primera decisión.
// ==========================================================================

import type { TreeNode } from '../types/domain';

const G = 1.55;

export const TREE_NODES: TreeNode[] = [
  // ---------------------------------------------------------------- TIER 0
  {
    id: 'core_sink', name: 'Sumidero de Núcleos', description: '+6% al ingreso pasivo por nivel.',
    lore: 'Un pozo que no se llena: todo lo que cae por el, se queda. Cuanto mas hondo, mas fondo traga.',
    icon: 'chip', category: 'manada', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { passiveMult: 0.06 }, x: 0, y: 0, columna: 'izq'
  },
  {
    id: 'core_edge', name: 'Filo Afilado', description: '+8% al daño de click por nivel.',
    lore: 'El filo se afila solo. Solo hay que acordarse de no cortarse con el.',
    icon: 'collector', category: 'asalto', tier: 0, requires: [],
    baseCost: 1, costGrowth: G, maxLevel: 10,
    bonus: { clickMult: 0.08 }, x: 0, y: 1, columna: 'izq'
  },
  {
    id: 'scrapyard', name: 'Chatarrería', description: '+10% al precio de venta por nivel.',
    lore: 'Nada sobra si sabes donde mirar. El mismo monton de acero vale mas si buscas donde toca.',
    icon: 'trash', category: 'fortuna', tier: 0, requires: [],
    baseCost: 2, costGrowth: G, maxLevel: 5,
    bonus: { sellMult: 0.10 }, x: 0, y: 2, columna: 'der'
  },
  {
    id: 'refinery', name: 'Refinado', description: '-4% al coste de la tienda por nivel.',
    lore: 'La chatarra cruda no se vende: se depura. Lo que sale de aqui pesa menos y vale mas.',
    icon: 'crystal', category: 'fortuna', tier: 0, requires: [],
    baseCost: 3, costGrowth: G, maxLevel: 5,
    bonus: { costReduction: 0.04 }, x: 0, y: 3, columna: 'der'
  },
  //
  // ---------------------------------------------------------------------------
  //  `blueprint` YA NO ESTA, Y EL PORQUE ESTA AQUI PORQUE SE VA A PREGUNTAR
  // ---------------------------------------------------------------------------
  //
  // Era la raiz de la rama de crafteo: `forge_luck` y `shard_sifter` lo tenian en
  // `requires`. Antes de eso habia sido la PUERTA de la forja, y cuando la forja se
  // abrio desde el inicio se convirtio en un nodo de 4 nucleos al que no le quedaba
  // nada que abrir, asi que se le puso un +3% de `craftLuck` para que no fuera una
  // trampa.
  //
  // **SE HA BORRADO PORQUE SU TRABAJO YA NO EXISTE.** El nodo pagaba por una
  // restriccion que se borro, y una restriccion que ya no esta no puede seguir cobrando
  // por quitarla: el jugador ve una condicion que nunca se cumple.
  //
  // **LO IMPORTANTE: A LOS DOS HIJOS NO SE LES HA QUITADO LA PUERTA, SE LES HA QUITADO
  // LA CONDICION.** `requires: []` en vez de `requires: ['blueprint']`. Borrar el nodo
  // sin tocar eso deja los dos **inalcanzables** para el que no lo tenia comprado, con
  // sus bonificaciones desaparecidas de golpe --y `shard_sifter` todavia es la clave
  // guardada de un arbol de esquirlas que ya no existe, asi que ese identificador no
  // se toca--. Los dos siguen dando lo que dan y ahora se compran directamente.
  //
  // **Y QUIEN LO TUVIERA COMPRADO PIERDE EL 3%**, y eso es lo correcto: era el
  // precio de una puerta que ya no esta. Si alguna vez se quiere compensar, el sitio
  // es este parrafo y no una excepcion en el codigo.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------- TIER 1
  {
    id: 'auto_clicker', name: 'Autómata de Clicks', description: '+0.5 clics automáticos por segundo.',
    lore: 'Un brazo mecanico que golpea aunque nadie este delante. No se cansa y no mira el reloj.',
    icon: 'bolt', category: 'asalto', tier: 1, requires: ['core_edge'],
    baseCost: 3, costGrowth: 1.6, maxLevel: 10,
    bonus: { autoClick: 0.5 }, x: 1, y: 0, columna: 'der'
  },
  {
    id: 'passive_loop', name: 'Bucle de Extracción', description: '+8% al ingreso pasivo por nivel.',
    lore: 'El circuito se cierra solo: lo que extrae vuelve a entrar en vez de quedarse en el suelo.',
    icon: 'companion', category: 'manada', tier: 1, requires: ['core_sink'],
    baseCost: 3, costGrowth: G, maxLevel: 6,
    bonus: { passiveMult: 0.08 }, x: 1, y: 1, columna: 'izq'
  },
  {
    id: 'forge_luck', name: 'Instinto de Forja', description: '+2% a la probabilidad de crafteo por nivel.',
    lore: 'Treinta anos de golpear metal frio hasta que el hierro decide colaborar.',
    icon: 'sparkle', category: 'forja', tier: 1, requires: [],
    baseCost: 4, costGrowth: 1.5, maxLevel: 5,
    bonus: { craftLuck: 0.02 }, x: 1, y: 2, columna: 'izq'
  },
  {
    // EL IDENTIFICADOR SE LLAMA TODAVÍA `shard_sifter` Y NO SE CAMBIA, PORQUE ES UNA
    // LLAVE GUARDADA. `nodeLevels` guarda el nivel por identificador, así que renombrarlo
    // le quitaría la bonificación de golpe a quien ya lo tenga comprado. El nombre y lo
    // que hace sí cambian: las esquirlas ya no existen, y lo que este nodo multiplica es
    // el premio del fallo de forja, que son los cristales.
    id: 'shard_sifter', name: 'Alcornoque', description: '+25% de cristales por fallo de forja.',
    lore: 'Ceniza de un horno que fallo. Toda ceniza guarda algo: solo hay que cribarla.',
    icon: 'crystal', category: 'forja', tier: 0, requires: [],
    baseCost: 3, costGrowth: G, maxLevel: 4,
    bonus: { consolationBonus: 0.25 }, x: 1, y: 3, columna: 'centro'
  },
  {
    id: 'storage_rack', name: 'Estantería Extra', description: '+3 ranuras de almacén por nivel.',
    lore: 'Otro estante. El problema nunca fue el espacio, era que no habia donde colgarlo.',
    icon: 'warehouse', category: 'fortuna', tier: 1, requires: ['scrapyard'],
    baseCost: 3, costGrowth: G, maxLevel: 6,
    bonus: { storageSlots: 3 }, x: 1, y: 4, columna: 'centro'
  },

  // ---------------------------------------------------------------- TIER 2
  {
    id: 'auto_clicker2', name: 'Dedo de Acero', description: '+1 clic automático por segundo.',
    lore: 'Cuatro brazos mas y el mismo gesto. La cadencia ya no la marca una persona.',
    icon: 'bolt', category: 'asalto', tier: 2, requires: ['auto_clicker'],
    baseCost: 10, costGrowth: 1.7, maxLevel: 6,
    bonus: { autoClick: 1 }, x: 2, y: 0, columna: 'der'
  },
  {
    id: 'multiplier_amp', name: 'Amplificador de Asalto', description: '+5% al daño de click por nivel.',
    lore: 'Todo el ruido del taller metido en un solo golpe. No hace más cosas: hace una, más fuerte.',
    icon: 'sparkle', category: 'asalto', tier: 2, requires: ['core_edge'],
    baseCost: 12, costGrowth: 1.65, maxLevel: 6,
    bonus: { clickMult: 0.05 }, x: 2, y: 1, columna: 'izq'
  },
  {
    id: 'crate_sight', name: 'Ojo de Caja', description: '+10% de probabilidad de que la caja dé un tier más por nivel.',
    lore: 'Ver la costura antes de que se abra. La caja siempre ha dado lo que tenia; ahora lo ves venir.',
    icon: 'crate', category: 'fortuna', tier: 2, requires: ['bulk_buy'],
    baseCost: 8, costGrowth: G, maxLevel: 5,
    bonus: { crateLuck: 0.10 }, x: 2, y: 2, columna: 'izq'
  },
  {
    id: 'bulk_buy', name: 'Compra a Granel', description: '-5% adicional al coste de tienda.',
    lore: 'Comprar por docenas mejora el precio de la unidad sin tocar el de venta. El margen esta en el medio.',
    icon: 'store', category: 'fortuna', tier: 2, requires: ['refinery', 'scrapyard'],
    baseCost: 9, costGrowth: G, maxLevel: 4,
    bonus: { costReduction: 0.05 }, x: 2, y: 3, columna: 'der'
  },
  {
    id: 'squad_slots', name: 'Cuadrilla', description: '+1 ranura de compañero activa.',
    lore: 'Uno mas que dispara. No es un Companero nuevo: es sitio para el que ya tienes.',
    icon: 'companion', category: 'manada', tier: 2, requires: ['passive_loop'],
    baseCost: 25, costGrowth: 1, maxLevel: 4,
    bonus: { companionSlots: 1 }, x: 2, y: 4, columna: 'centro'
  },
  // ---------------------------------------------------------------- MANADA EXTRA (F97 Lote 2d)
  //
  // Los compañeros iban desnudos frente al recolector: sin poderes propios, sin
  // mejora barata y sin afijos. Estos cuatro son su rama de verdad: poder por
  // tipo y descuento de mejora. Los afijos innatos (pool propio, magnitud por
  // tier) vienen del sorteo, no de un nodo, y la forja sigue en potencial.
  {
    id: 'comp_pasivo', name: 'Enjambre', description: '+12% al poder de pasivos por nivel.',
    lore: 'Más bocas comiendo del mismo cable: cada una muerde más fuerte.',
    icon: 'companion', category: 'manada', tier: 2, requires: ['passive_loop'],
    baseCost: 10, costGrowth: 1.6, maxLevel: 5,
    bonus: { compPasivo: 0.12 }, x: 2, y: 5, columna: 'centro'
  },
  {
    id: 'comp_click', name: 'Sincronía', description: '+12% al poder de clicks por nivel.',
    lore: 'Los que golpean aprenden el ritmo de los que golpean al lado.',
    icon: 'companion', category: 'manada', tier: 2, requires: ['passive_loop'],
    baseCost: 10, costGrowth: 1.6, maxLevel: 5,
    bonus: { compClick: 0.12 }, x: 2, y: 6, columna: 'centro'
  },
  {
    id: 'comp_descuento', name: 'Cuidador', description: '−10% al coste de mejora de compañeros por nivel.',
    lore: 'Conoce cada dron por su ruido. Arreglarlo sale más barato.',
    icon: 'wrench', category: 'manada', tier: 2, requires: ['passive_loop'],
    baseCost: 8, costGrowth: 1.6, maxLevel: 3,
    bonus: { compDescuento: 0.10 }, x: 2, y: 7, columna: 'centro'
  },
  {
    id: 'comp_multi', name: 'Mando', description: '+15% al efecto multiplier por nivel.',
    lore: 'Alguien tiene que gritar las órdenes. Grita mejor cada vez.',
    icon: 'companion', category: 'manada', tier: 3, requires: ['squad_slots'],
    baseCost: 40, costGrowth: 1.7, maxLevel: 4,
    bonus: { compMulti: 0.15 }, x: 3, y: 5, columna: 'centro'
  },

  // ---------------------------------------------------------------- TIER 3
  //
  // ---------------------------------------------------------------------------
  //  `offline_ops` YA NO ESTA, Y EL PORQUE ESTA AQUI
  // ---------------------------------------------------------------------------
  //
  // Era "Operaciones Offline": +2 min de clics automaticos al volver, con
  // `bonus: { offlineClicks: 120 }`. **Era una promesa de ingreso sin mirar**, que es
  // justo lo que R10 prohibe, y ademas nunca se consumia: el campo `offlineClicks`
  // existia en el estado y en `PassiveBonuses` y no lo leia el motor. Un nodo que
  // cobra nucleos por una bonificacion que no hace nada es una trampa.
  //
  // Se borra el nodo, no el campo: las partidas viejas que lo tuvieran comprado
  // conservan su nivel guardado (igual que con `blueprint`), y el campo
  // `offlineClicks` se queda en el tipo para no romper su carga. Lo que desaparece es
  // la forma de comprarlo.
  //
  // **`full_automation` NO SE QUEDA HUERFANO.** Lo tenia en `requires`, asi que se le
  // cambia la puerta por la que tenia `offline_ops` (`auto_clicker2`), que es su rama:
  // sin eso, el nodo seria inalcanzable para quien no lo tuviera ya comprado.
  // ---------------------------------------------------------------------------
  {
    id: 'quantum_amp', name: 'Amplificador de Manada', description: '+8% al ingreso pasivo por nivel.',
    lore: 'El gemelo tranquilo del de asalto: no toca tu mano, toca tu enjambre.',
    icon: 'crystal', category: 'manada', tier: 3, requires: ['passive_loop'],
    baseCost: 60, costGrowth: 1.75, maxLevel: 5,
    bonus: { passiveMult: 0.08 }, x: 3, y: 1, columna: 'izq'
  },
  {
    id: 'afk_extend', name: 'Suspensión Prolongada', description: '+30 min de buff AFK por tarjeta por nivel.',
    lore: 'La tarjeta caducaba siempre a mitad del segundo que mas falta hacia. Ahora dura un poco mas.',
    icon: 'card', category: 'fortuna', tier: 3, requires: ['refinery'],
    baseCost: 20, costGrowth: G, maxLevel: 4,
    bonus: { afkHours: 0.5 }, x: 3, y: 2, columna: 'centro'
  },
  {
    id: 'master_smith', name: 'Maestro Forjador', description: '+2% a la probabilidad de crafteo por nivel.',
    lore: 'El taller ya no es un homogeneity con dos cosas. Hay alguien que ha tardado.',
    icon: 'collector', category: 'forja', tier: 3, requires: ['forge_luck'],
    baseCost: 45, costGrowth: 1.7, maxLevel: 4,
    bonus: { craftLuck: 0.02 }, x: 3, y: 3, columna: 'izq'
  },
  {
    id: 'core_yield', name: 'Rendimiento del Núcleo', description: '+10% de núcleos por reinicio, sobre lo producido después de comprarlo.',
    lore: 'Reciclar no es tirar: es traducir. Con el mismo monton sale mas si sabes lo que haces.',
    icon: 'sparkle', category: 'fortuna', tier: 3, requires: ['bulk_buy'],
    baseCost: 40, costGrowth: 1.8, maxLevel: 3,
    bonus: { coreGain: 0.10 }, x: 3, y: 4, columna: 'der'
  },

  // ---------------------------------------------------------------- TIER 4
  {
    id: 'singularity', name: 'Singularidad', description: '+10% al daño de click y al ingreso pasivo por nivel.',
    lore: 'El ultimo nodo del arbol. Ponerlo es una decision: para por aqui.',
    icon: 'sparkle', category: 'asalto', tier: 4, requires: ['multiplier_amp'],
    baseCost: 220, costGrowth: 2.0, maxLevel: 5,
    bonus: { clickMult: 0.10, passiveMult: 0.10 }, x: 4, y: 1, columna: 'centro'
  },
  {
    id: 'full_automation', name: 'Automatización Total', description: '+1 clic automático por segundo.',
    lore: 'Que la base juegue sola. Se ha arreglado todo lo que hacia falta para dejarlo.',
    icon: 'bolt', category: 'asalto', tier: 4, requires: ['auto_clicker2'],
    baseCost: 180, costGrowth: 1.9, maxLevel: 3,
    bonus: { autoClick: 1 }, x: 4, y: 0, columna: 'der'
  },
  {
    id: 'void_hoard', name: 'Almacén del Vacío', description: '+8 ranuras de almacén por nivel.',
    lore: 'Un almacen que no necesita ranuras porque no guarda: Fabrica el hueco.',
    icon: 'warehouse', category: 'fortuna', tier: 4, requires: ['storage_rack', 'core_yield'],
    baseCost: 90, costGrowth: 1.7, maxLevel: 5,
    bonus: { storageSlots: 8 }, x: 4, y: 2, columna: 'centro'
  },
  {
    id: 'chaos_forge', name: 'Forja del Caos', description: '+2% a la probabilidad de crafteo por nivel.',
    lore: 'La forja ya sin red de seguridad. Sale lo que sale.',
    icon: 'collector', category: 'forja', tier: 4, requires: ['master_smith'],
    baseCost: 260, costGrowth: 2.1, maxLevel: 2,
    bonus: { craftLuck: 0.02 }, x: 4, y: 3, columna: 'izq'
  },
  // ---------------------------------------------------------------- TIER 4 · KEYSTONES (F97 Lote 2b)
  //
  // Uno por rama, al fondo de cada una: son la maestría de la rama, no un
  // número más. Cada uno trae UNA mecánica con sus cifras dentro del bonus —
  // la descripción las nombra y el banco las lee de ahí—, y todos son de un
  // solo nivel: un keystone no se sube, se consigue.
  {
    id: 'sobrecarga', name: 'Sobrecarga', description: 'Cada 50 clics, el siguiente critica ×3.',
    lore: 'Cincuenta golpes cargando el mismo condensador. El cincuenta y uno no golpea: detona.',
    icon: 'bolt', category: 'asalto', tier: 4, requires: ['singularity'],
    baseCost: 300, costGrowth: 1, maxLevel: 1,
    bonus: { sobrecargaCada: 50, sobrecargaMult: 3 }, x: 4, y: 4, columna: 'centro'
  },
  {
    id: 'colmena', name: 'Mente Colmena', description: '+4% al ingreso por cada compañero activo además del primero.',
    lore: 'Ninguna abeja hace miel sola. Cada una que se suma endulza el trabajo de las demás.',
    icon: 'companion', category: 'manada', tier: 4, requires: ['quantum_amp'],
    baseCost: 280, costGrowth: 1, maxLevel: 1,
    bonus: { colmenaPorComp: 0.04 }, x: 4, y: 4, columna: 'der'
  },
  {
    id: 'jackpot', name: 'Jackpot', description: 'Un 1% de las cajas sube un tier su premio.',
    lore: 'A veces la caja se equivoca a tu favor. Nadie reclama.',
    icon: 'crate', category: 'fortuna', tier: 4, requires: ['void_hoard'],
    baseCost: 320, costGrowth: 1, maxLevel: 1,
    bonus: { jackpotChance: 0.01 }, x: 4, y: 4, columna: 'izq'
  },
  {
    id: 'obra_maestra', name: 'Obra Maestra', description: 'Fundir dos potenciales máximos en otro firma una Obra Maestra.',
    lore: 'El yunque también firma. Cuando dos perfectos se vuelven uno, lo saben todos.',
    icon: 'collector', category: 'forja', tier: 4, requires: ['chaos_forge'],
    baseCost: 350, costGrowth: 1, maxLevel: 1,
    bonus: { obraMaestra: 1 }, x: 4, y: 4, columna: 'centro'
  },
  // ---------------------------------------------------------------- FORTUNA EXTRA (F97 Lote 2c)
  //
  // Las licencias abren la tienda y el Eco dobla el botín: las dos mitades de
  // jugar con cajas. Son nodos de un solo nivel porque son permisos, no
  // bonificaciones: un permiso no se sube, se consigue.
  {
    id: 'licencia_t2', name: 'Licencia T2', description: 'Desbloquea la compra de cajas del tier dos en la tienda.',
    lore: 'Un papel sellado que dice que puedes comprar lo que ya sabías abrir.',
    icon: 'crate', category: 'fortuna', tier: 2, requires: ['crate_sight'],
    baseCost: 25, costGrowth: 1, maxLevel: 1,
    bonus: { licenciaT2: 1 }, x: 2, y: 4, columna: 'izq'
  },
  {
    id: 'licencia_t3', name: 'Licencia T3', description: 'Desbloquea la compra de cajas del tier tres en la tienda.',
    lore: 'El de antes, pero para la caja que de verdad cuesta.',
    icon: 'crate', category: 'fortuna', tier: 3, requires: ['licencia_t2'],
    baseCost: 80, costGrowth: 1, maxLevel: 1,
    bonus: { licenciaT3: 1 }, x: 3, y: 5, columna: 'izq'
  },
  {
    id: 'eco_caja', name: 'Eco de Caja', description: '+2% de botín doble por nivel.',
    lore: 'A veces la caja hace eco y lo de dentro viene dos veces.',
    icon: 'gem', category: 'fortuna', tier: 3, requires: ['crate_sight'],
    baseCost: 30, costGrowth: 1.55, maxLevel: 5,
    bonus: { ecoDoble: 0.02 }, x: 3, y: 6, columna: 'izq'
  },
  // ---------------------------------------------------------------- TIER 5 (Lote 3)
  //  Nodos que llenan el hueco entre el tier 4 y los keystones: saltos de poder
  //  intermedios para que la rama no muera al llegar a T4.
  {
    id: 'crit_master', name: 'Maestría Crítica', description: '+15% a la probabilidad de crítico por nivel.',
    lore: 'El golpe perfecto no es suerte: es practicar el mismo golpe hasta que sale solo.',
    icon: 'bolt', category: 'asalto', tier: 5, requires: ['singularity'],
    baseCost: 400, costGrowth: 1.6, maxLevel: 2,
    bonus: { critChance: 0.15 }, x: 4, y: 5, columna: 'centro'
  },
  {
    id: 'click_storm', name: 'Tormenta de Clicks', description: '+1.5 clics automáticos por segundo por nivel.',
    lore: 'Cuando los dedos no dan más, que sigan las máquinas.',
    icon: 'bolt', category: 'asalto', tier: 5, requires: ['full_automation'],
    baseCost: 500, costGrowth: 1.6, maxLevel: 4,
    bonus: { autoClick: 1.5 }, x: 4, y: 6, columna: 'der'
  },
  {
    id: 'swarm_mind', name: 'Mente Enjambre', description: '+8% al poder de todos los compañeros por nivel.',
    lore: 'Piensa como uno, trabaja como cien.',
    icon: 'companion', category: 'manada', tier: 5, requires: ['quantum_amp'],
    baseCost: 450, costGrowth: 1.6, maxLevel: 4,
    bonus: { compPasivo: 0.08, compClick: 0.08 }, x: 4, y: 5, columna: 'centro'
  },
  {
    id: 'deep_storage', name: 'Almacén Profundo', description: '+8 ranuras de almacén por nivel.',
    lore: 'Las paredes del almacén son una sugerencia.',
    icon: 'warehouse', category: 'fortuna', tier: 5, requires: ['void_hoard'],
    baseCost: 480, costGrowth: 1.6, maxLevel: 5,
    bonus: { storageSlots: 8 }, x: 4, y: 5, columna: 'centro'
  },
  {
    id: 'insurance', name: 'Seguro', description: 'Paga 100 nanitas al abrir una caja por nivel.',
    lore: 'Por si la caja sale vacía, que no salga gratis.',
    icon: 'gem', category: 'fortuna', tier: 5, requires: ['eco_caja'],
    baseCost: 420, costGrowth: 1.6, maxLevel: 3,
    bonus: { nanoPerCrate: 100 }, x: 4, y: 6, columna: 'izq'
  },
  {
    id: 'anvil_song', name: 'Canto del Yunque', description: '+2% a la subida de potencial por nivel.',
    lore: 'El yunque canta mientras trabaja. Cuando calla, algo sale mal.',
    icon: 'collector', category: 'forja', tier: 5, requires: ['master_smith'],
    baseCost: 460, costGrowth: 1.6, maxLevel: 3,
    bonus: { forgePotential: 0.02 }, x: 4, y: 5, columna: 'der'
  },
  // ---------------------------------------------------------------- TIER 6 (Lote 3)
  //  El fondo de cada rama. Requisitos intra-rama: lo que se ve es lo que hay que comprar.
  {
    id: 'furia', name: 'Furia', description: '+10% al daño de click por nivel.',
    lore: 'Cuando el brazo se cansa, queda la rabia.',
    icon: 'bolt', category: 'asalto', tier: 6, requires: ['crit_master'],
    baseCost: 900, costGrowth: 1.65, maxLevel: 3,
    bonus: { clickMult: 0.10 }, x: 5, y: 4, columna: 'izq'
  },
  {
    id: 'martillo', name: 'Martillo Pesado', description: '+10% al daño de click por nivel.',
    lore: 'Cada golpe cae como si fuera el primero.',
    icon: 'collector', category: 'asalto', tier: 6, requires: ['click_storm'],
    baseCost: 950, costGrowth: 1.65, maxLevel: 4,
    bonus: { clickMult: 0.10 }, x: 5, y: 5, columna: 'izq'
  },
  {
    id: 'ejecutor', name: 'Ejecutor', description: '+12% al daño de click por nivel.',
    lore: 'El último golpe no se negocia.',
    icon: 'sparkle', category: 'asalto', tier: 6, requires: ['furia'],
    baseCost: 1000, costGrowth: 1.65, maxLevel: 3,
    bonus: { clickMult: 0.12 }, x: 5, y: 6, columna: 'izq'
  },
  {
    id: 'sinergia', name: 'Manada Cazadora', description: '+6% al daño de click por nivel.',
    lore: 'La manada que caza junta aprende a golpear junta: cada colmillo cuenta también en tu mano.',
    icon: 'companion', category: 'manada', tier: 6, requires: ['swarm_mind'],
    baseCost: 850, costGrowth: 1.65, maxLevel: 4,
    bonus: { clickMult: 0.06 }, x: 5, y: 4, columna: 'centro'
  },
  {
    id: 'colmena_final', name: 'Colmena Obrera', description: '−8% al coste de mejora de compañeros por nivel.',
    lore: 'Obreras que conocen cada dron por su zumbido: lo que ellas cuidan sale más barato arreglar.',
    icon: 'wrench', category: 'manada', tier: 6, requires: ['sinergia'],
    baseCost: 900, costGrowth: 1.65, maxLevel: 3,
    bonus: { compDescuento: 0.08 }, x: 5, y: 5, columna: 'centro'
  },
  {
    id: 'funda', name: 'Funda del Yunque', description: '+2% a la probabilidad de crafteo por nivel.',
    lore: 'Cada golpe del martillo despierta al yunque.',
    icon: 'collector', category: 'forja', tier: 6, requires: ['anvil_song'],
    baseCost: 880, costGrowth: 1.65, maxLevel: 2,
    bonus: { craftLuck: 0.02 }, x: 5, y: 4, columna: 'izq'
  },
  {
    id: 'temple', name: 'Temple', description: '+3% a la probabilidad de crafteo por nivel.',
    lore: 'El acero se temple en agua fría. El jugador en paciencia.',
    icon: 'sparkle', category: 'forja', tier: 6, requires: ['funda'],
    baseCost: 920, costGrowth: 1.65, maxLevel: 2,
    bonus: { craftLuck: 0.03 }, x: 5, y: 5, columna: 'izq'
  },
  {
    id: 'alma', name: 'Alma de la Forja', description: '+15% de cristales por fallo de forja.',
    lore: 'La forja recuerda cada golpe que ha dado.',
    icon: 'collector', category: 'forja', tier: 6, requires: ['temple'],
    baseCost: 960, costGrowth: 1.65, maxLevel: 3,
    bonus: { consolationBonus: 0.15 }, x: 5, y: 6, columna: 'centro'
  },
  {
    id: 'yunque_vivo', name: 'Yunque Vivo', description: '+8% al precio de venta por nivel.',
    lore: 'El yunque sueña con ser espada.',
    icon: 'sparkle', category: 'forja', tier: 6, requires: ['alma'],
    baseCost: 1000, costGrowth: 1.65, maxLevel: 3,
    bonus: { sellMult: 0.08 }, x: 5, y: 7, columna: 'centro'
  },
  //  Ramas que van justas: tres más de Asalto, cuatro de Manada y dos de Forja
  //  para que las cuatro lleguen a 15.
  {
    id: 'golpe_bajo', name: 'Manos Calientes', description: '+25% de tu forja como daño de click por nivel.',
    lore: 'El martillo enseña a la mano y la mano al martillo: golpear bien sirve en los dos lados del yunque.',
    icon: 'bolt', category: 'asalto', tier: 5, requires: ['crit_master'],
    baseCost: 420, costGrowth: 1.6, maxLevel: 4,
    bonus: { clickPorForja: 0.25 }, x: 4, y: 7, columna: 'centro'
  },
  {
    id: 'sangre_fria', name: 'Botín de Guerra', description: '+20 nanitas al abrir una caja por nivel.',
    lore: 'Del campo no se vuelve con las manos vacías: hasta la caja más pobre deja algo para el que sabe mirar.',
    icon: 'crate', category: 'asalto', tier: 5, requires: ['golpe_bajo'],
    baseCost: 440, costGrowth: 1.6, maxLevel: 3,
    bonus: { nanoPerCrate: 20 }, x: 4, y: 8, columna: 'der'
  },
  {
    id: 'enjambre_total', name: 'Enjambre Total', description: '+12% al ingreso pasivo por nivel.',
    lore: 'Cada pieza se mueve y cuenta. Cuando todas se mueven a la vez, el enjambre entero rinde más que la suma de sus partes.',
    icon: 'companion', category: 'manada', tier: 5, requires: ['swarm_mind'],
    baseCost: 430, costGrowth: 1.6, maxLevel: 4,
    bonus: { passiveMult: 0.12 }, x: 4, y: 7, columna: 'izq'
  },
  {
    id: 'manada_unida', name: 'Manada Unida', description: '+10% al ingreso pasivo por nivel.',
    lore: 'Se avisan antes de entrar. Nadie se queda atrás.',
    icon: 'chip', category: 'manada', tier: 6, requires: ['enjambre_total'],
    baseCost: 870, costGrowth: 1.65, maxLevel: 4,
    bonus: { passiveMult: 0.10 }, x: 5, y: 7, columna: 'izq'
  },
  {
    id: 'manada_viva', name: 'Manada Alfa', description: '+10% al efecto multiplier por nivel.',
    lore: 'Un alfa no manda más fuerte: manda mejor, y la orden rinde en cada dron.',
    icon: 'companion', category: 'manada', tier: 6, requires: ['manada_unida'],
    baseCost: 890, costGrowth: 1.65, maxLevel: 3,
    bonus: { compMulti: 0.10 }, x: 5, y: 8, columna: 'centro'
  },
  {
    id: 'llama', name: 'Temple Cruzado', description: '+25% de tu forja como daño de click por nivel.',
    lore: 'El acero templado enseña paciencia, y la paciencia enseña a golpear donde duele.',
    icon: 'bolt', category: 'forja', tier: 5, requires: ['anvil_song'],
    baseCost: 470, costGrowth: 1.6, maxLevel: 3,
    bonus: { clickPorForja: 0.25 }, x: 4, y: 8, columna: 'centro'
  },
  {
    id: 'yunque_frio', name: 'Chispa Compartida', description: '+6% de probabilidad de que la caja dé un tier más por nivel.',
    lore: 'Una chispa del yunque salta a la caja de al lado: a veces la costura se ve antes.',
    icon: 'crate', category: 'forja', tier: 6, requires: ['llama'],
    baseCost: 980, costGrowth: 1.65, maxLevel: 3,
    bonus: { crateLuck: 0.06 }, x: 5, y: 10, columna: 'centro'
  },
  {
    id: 'colneta', name: 'Tasador', description: '−5% al coste de mejora de compañeros por nivel.',
    lore: 'Años regateando en el mercado sirven también con el Cuidador: el precio baja donde pidas.',
    icon: 'store', category: 'fortuna', tier: 5, requires: ['deep_storage'],
    baseCost: 490, costGrowth: 1.6, maxLevel: 4,
    bonus: { compDescuento: 0.05 }, x: 4, y: 7, columna: 'der'
  },
  {
    id: 'punhal', name: 'Puñalada', description: '+12% al daño de click por nivel.',
    lore: 'Un solo lugar donde duele. Y el puñal lo encuentra siempre.',
    icon: 'bolt', category: 'asalto', tier: 6, requires: ['ejecutor'],
    baseCost: 1050, costGrowth: 1.65, maxLevel: 3,
    bonus: { clickMult: 0.12 }, x: 5, y: 8, columna: 'izq'
  },
  {
    id: 'martillo_sagrado', name: 'Martillo Sagrado', description: '+2% a la subida de potencial por nivel.',
    lore: 'Bendice lo que golpea. Y lo que golpea, bendice.',
    icon: 'collector', category: 'forja', tier: 6, requires: ['yunque_frio'],
    baseCost: 1020, costGrowth: 1.65, maxLevel: 3,
    bonus: { forgePotential: 0.02 }, x: 5, y: 9, columna: 'der'
  },
  {
    id: 'mano_de_obra', name: 'Mano de Obra', description: '+2% a la subida de potencial por nivel.',
    lore: 'Las manos saben más que las máquinas.',
    icon: 'sparkle', category: 'forja', tier: 5, requires: ['llama'],
    baseCost: 450, costGrowth: 1.6, maxLevel: 3,
    bonus: { forgePotential: 0.02 }, x: 4, y: 9, columna: 'der'
  },
  {
    id: 'fragua', name: 'Fragua Eterna', description: '+3% a la subida de potencial por nivel.',
    lore: 'La fragua que nunca se apaga. El fuego no descansa, y el acero tampoco.',
    icon: 'collector', category: 'forja', tier: 6, requires: ['mano_de_obra'],
    baseCost: 1100, costGrowth: 1.65, maxLevel: 3,
    bonus: { forgePotential: 0.03 }, x: 5, y: 11, columna: 'der'
  }
];

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(
  TREE_NODES.map(n => [n.id, n])
);

export const TREE_TIERS = [0, 1, 2, 3, 4, 5, 6];

/**
 * NOMBRES DE LAS TRES COLUMNAS DE CADA RAMA (F102). Los pinta la pestaña
 * encima de cada lado: sin ellos, tres grupos de nodos son tres grupos que
 * el jugador tiene que bautizar solo para hablar de su build.
 */
export const COLUMNA_META: Record<string, { izq: string; centro: string; der: string }> = {
  asalto: { izq: 'Filo', centro: 'Crítico', der: 'Máquina' },
  manada: { izq: 'Enjambre', centro: 'Mando', der: 'Colmena' },
  fortuna: { izq: 'Cajas', centro: 'Base', der: 'Comercio' },
  forja: { izq: 'Probabilidad', centro: 'Oficio', der: 'Potencial' }
};

export const TREE_CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  asalto: { label: 'Asalto', color: 'text-red-400', icon: 'bolt' },
  manada: { label: 'Manada', color: 'text-emerald-400', icon: 'companion' },
  fortuna: { label: 'Fortuna', color: 'text-amber-400', icon: 'store' },
  forja: { label: 'Forja', color: 'text-rose-400', icon: 'collector' }
};

/** Coste del siguiente nivel de un nodo. */
export function nodeCost(node: TreeNode, currentLevel: number): number {
  return Math.ceil(node.baseCost * Math.pow(node.costGrowth, currentLevel));
}

/** Coste de subir al siguiente nivel teniendo `level` niveles comprados. */
export function nextCost(node: TreeNode, level: number): number | null {
  if (level >= node.maxLevel) return null;
  return nodeCost(node, level);
}

/**
 * Cuántos núcleos se han GASTADO en el árbol, nivel a nivel.
 *
 * Es la contraparte exacta de la cartera: **todo núcleo que el jugador ha ganado
 * está en un sitio u otro**, así que `cartera + gastado` es el histórico
 * completo. Y es lo que permite reconstruir el `totalCores` de las partidas
 * viejas, que no lo guardaban.
 *
 * Por qué tiene que ser EXACTO y no una estimación: `nextCores` resta el
 * histórico de lo que daría la producción. Si el histórico se pasa, al jugador
 * se le.apagan las Ascensiones **para siempre** —no es que salga un número raro,
 * es que el Ascenso queda en 0 y no vuelve a salir. Si se queda corto, el
 * siguiente Ascenso lo corrige solo. Un error de un núcleo en este número decide
 * si un jugador veteran puede seguir jugando.
 *
 * El coste de cada nivel sale de `nodeCost`, la misma función que usa la tienda
 * de pasivas para cobrar, así que lo gastado y lo cobrado no pueden separarse.
 */
export function coresGastadosEnArbol(nodeLevels: Record<string, number> | undefined): number {
  if (!nodeLevels) return 0;
  let total = 0;
  for (const nodo of TREE_NODES) {
    const nivel = Math.floor(Number(nodeLevels[nodo.id]) || 0);
    if (nivel <= 0) continue;
    // Los niveles que existen de verdad, no los que diga el save: un guardado
    // manipulado con 99 niveles de un nodo que llega a 5 no puede costar 99
    // niveles, porque nunca se pudieron pagar.
    const comprados = Math.min(nivel, nodo.maxLevel);
    for (let i = 0; i < comprados; i++) total += nodeCost(nodo, i);
  }
  return total;
}
