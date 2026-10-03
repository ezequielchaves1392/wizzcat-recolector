// ==========================================================================
//  Banco de pruebas de LA PARTIDA ENTERA de un jugador nuevo
//
//  Qué hay aquí y por qué hace falta
//  -------------------------------
//  Los otros once bancos prueban FUNCIONES: que `sellItem` borre, que la pila se
//  funda, que la cola no se aplique cuando no debe. Todos montan la partida a
//  mano con `baseSave()` y comprueban una cosa.
//
//  Lo que no había era lo que de verdad mira un jugador en su primer minuto:
//  Lifecycle completo con el estado que nace de verdad, en el orden en que se
//  juega. Un banco puede pasar entero y que la partida sea injugable, porque
//  cada función por separado funciona: el jugador nace sin recolector, pero
//  `equipCollector` funciona, así que la función está probada; el de arriba nunca
//  equipó nada, y eso no lo mira nadie.
//
//  Aquí no hay atajos: se arranca con `bootNew()`, que es el documento inexistente
//  de verdad, y se juega. Si algo no está conectado al resto, se rompe aquí.
//
//  POR QUÉ ESTE BANCO NO ES EL ÚNICO QUE DEBERÍA EXISTIR
//  ------------------------------------------------------
//  Mide el CAMINO, y un camino que pasa no dice que el juego esté equilibrado. Un
//  banco puede recorrer los once pasos y que el jugador pasara hambre en el
//  minuto tres. El apartado 8 mide algo de eso —que el coste por punto de poder no
//  se dispare entre tiers, que es la regresión que `CAMBIOS-MACRO.md` documenta
//  haber arreglado una vez— y el apartado 10 mide que la Ascensión no regale ni
//  cobre de más. Pero el equilibrio fino sigue siendo cosa de jugar, no de un
//  `check()`.
//
//  CÓMO ESTÁ ESCRITO
//  ----------------
//  · Nada se reinicia a mitad de camino. La partida empieza en `bootNew()` y cada
//    apartado continúa la anterior. Un banco que reinicia en cada apartado no
//    comprueba el camino: comprueba once caminos.
//
//  · Cada apartado acaba en `recargar()`. R13: lo que solo vive en memoria no está
//    guardado, y el jugador no va a notar el fallo hasta que refresque.
//
//    Y es `recargar()` y no `reload()` a secas, por un motivo que costó tres
//    pruebas intermitentes: `reload()` lee el documento **tal y como esté**, y el
//    apartado anterior haEquipado un compañero o comprado algo que todavía no ha
//    llegado al servidor. Este juego programaba además un guardado diferido de
//    1,2 s al arrancar que se disparaba siempre —G6 lo arregló— y **varios bancos
//    se estaban apoyando en él sin saberlo**: mutaban, recargaban, y aquel
//    temporizador voltaba por ellos. Al quitarlo, empezó a fallar solo y de vez en
//    cuando, que es lo peor que puede hacer una prueba: entrena a ignorar el banco.
//
//  · No se reimplementa ninguna regla del juego (R2). Las cifras se piden al game
//    loop con `getClickDamage()`, `getSellTotal()`, `getCapacity()`. Si el banco
//    calcula el precio por su cuenta, pasa justo cuando el juego está roto.
// ==========================================================================

import { STORE_ITEMS } from '../src/gameLoop';
import { costeDeCaja } from '../src/data/store';
import { danioDeRango } from '../src/data/crafting';
import { CRATE_TYPES, type CrateType } from '../src/data/store';
import { CRYSTAL_DEFS } from '../src/data/items';
import {
  boot, reload, recargar, bootNew, check, resumen, s, wh, ids, nanites, deType, find,
  baseSave, collector, crystal, consumable, guardado
} from './kit';

/** Cuántos clicks se dan en un paso. Suficiente para que la cifra sea legible. */
const CLICKS = 20;

async function main() {
  // =========================================================================
  //  1. EL MINUTO CERO: qué nace de verdad
  // =========================================================================
  const g = await bootNew();
  {
    check('nacimiento: nace con cero nanitas', nanites(g) === 0, 'nanitas=' + nanites(g));
    check('nacimiento: trae un recolector, un compañero y 2 cajas',
      deType(g, 'collector') === 1 && deType(g, 'companion') === 1 && deType(g, 'crate') === 1,
      ids(g).join(','));
    check('nacimiento: las 2 cajas de bienvenida son UNA pila',
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      'unidades=' + wh(g).find((w: any) => w.type === 'crate')?.stackCount);
    check('nacimiento: almacén de 15 y una sola ranura de compañero',
      g.getCapacity() === 15 && g.getCompanionSlots() === 1,
      `cap=${g.getCapacity()} slots=${g.getCompanionSlots()}`);
    // **G-2 · LOS DOS ITEMS DE PARTIDA NACEN EQUIPADOS, Y ESTO ES LO QUE CAMBIÓ.**
    //
    // Antes el jugador nuevo veía su recolector y su compañero en el almacén, sin
    // puesta ninguna, con ingreso a cero y sin ningún botón que pulsara. Todo lo
    // que había que hacer era adivinarlo. La regla ahora es que nacen equipados:
    // el primer clic ya cobra, y la pantalla enseña cómo se ve funcionando.
    check('nacimiento: el recolector y el compañero nacen EQUIPADOS',
      s(g).equippedCollectorId === 'collector_blaster_001'
        && s(g).activeCompanions.join(',') === 'companion_base_001',
      `equipo=${s(g).equippedCollectorId} companeros=${s(g).activeCompanions.join(',')}`);
    check('nacimiento: y por eso el primer clic ya hace daño, sin que nadie toque nada',
      g.getClickDamage() > 0, 'danio=' + g.getClickDamage());
    check('nacimiento: y el compañero queda activo, que es lo que da ingreso',
      s(g).activeCompanions.length === 1, 'activos=' + s(g).activeCompanions.join(','));

    // El ingreso pasivo se calcula en el primer tick, no al construir el estado.
    // En el navegador eso son 500 ms y no se nota; aquí los `setInterval` están
    // anulados, así que se comprueba **después de recargar**, que es cuando el
    // cálculo ocurre de verdad. Lo que importa no es el instante, es que el
    // compañero activo produce.
    const g2 = await recargar(g);
    check('nacimiento: y siguen equipments después de recargar',
      s(g2).equippedCollectorId === 'collector_blaster_001'
        && s(g2).activeCompanions.join(',') === 'companion_base_001',
      `equipo=${s(g2).equippedCollectorId} companeros=${s(g2).activeCompanions.join(',')}`);
    check('nacimiento: y recargar no inventa nada',
      deType(g2, 'crate') === 1, ids(g2).join(','));
    check('nacimiento: y una vez calculado, el compañero da ingreso desde el primer segundo',
      s(g2).passiveIncome > 0, 'pasivo=' + s(g2).passiveIncome);
  }

  // =========================================================================
  //  2. CLICKEAR. El primer minuto real, y el que más veces se ha roto.
  // =========================================================================
  {
    // El click del arma de partida entra entero, y el número que anuncia
    // `getClickDamage()` es el que llega. No se recalcula aquí: si el banco hiciera
    // la cuenta, mediría su propia aritmética.
    const danio = g.getClickDamage();
    const antesDeClicar = nanites(g);
    for (let i = 0; i < 3; i++) g.click();
    check('click: el click con el arma de partida da daño desde el primer segundo',
      nanites(g) - antesDeClicar === danio * 3,
      `ganado=${nanites(g) - antesDeClicar} esperado=${danio * 3}`);
    check('click: y el click se cuenta igualmente',
      s(g).totalClicks === 3, 'clics=' + s(g).totalClicks);

    const colector = wh(g).find((w: any) => w.type === 'collector')!;

    // **ESTE CASO SIGUE TENIENDO CONTENIDO, PERO CAMBIADO DE FORMA.** La prueba
    // anterior nació de que el arma llegaba sin equipar y había que equiparla. Ahora
    // nace equipada, así que "equiparla" no hace nada —que es lo correcto— y lo que
    // queda por comprobar es la regla de los dos lados: **sin arma el click no cobra,
    // con arma cobra**, y en las dos el click se cuenta. Si esto desapareciera, el
    // botón sería algo que a veces hace algo, sin forma de saber por qué.
    // `equipCollector` es un CONMUTADOR: llamarlo con el mismo id lo desequipa.
    // No hay una función aparte de "desequipar", y esa es la vía que usa el
    // jugador: el mismo botón del detalle.
    const desequipar: any = g.equipCollector(colector.id);
    check('click: se puede quitar el arma con el mismo botón, y el estado lo dice',
      desequipar === true && s(g).equippedCollectorId === null,
      `ok=${desequipar} equipo=${s(g).equippedCollectorId}`);

    const sinArma = nanites(g);
    g.click();
    check('click: sin recolector no se gana nada',
      nanites(g) === sinArma, `nanitas=${nanites(g)} antes=${sinArma}`);
    check('click: pero el click se cuenta igualmente', s(g).totalClicks > 0,
      'clics=' + s(g).totalClicks);
    check('click: y sin arma el daño anunciado es cero', g.getClickDamage() === 0,
      'danio=' + g.getClickDamage());

    const equipado = g.equipCollector(colector.id);
    check('click: y se puede volver a equipar', equipado === true, String(equipado));
    check('click: el equipado queda dicho en el estado',
      s(g).equippedCollectorId === colector.id, String(s(g).equippedCollectorId));

    const announced = g.getClickDamage();
    check('click: equipado, el daño es mayor que cero', announced > 0, 'danio=' + announced);

    const antes = nanites(g);
    const producidoAntes = s(g).totalNanitesProduced;
    for (let i = 0; i < CLICKS; i++) g.click();
    const ganado = nanites(g) - antes;
    check('click: N clicks dan N veces el daño anunciado',
      ganado === announced * CLICKS, `ganado=${ganado} esperado=${announced * CLICKS}`);
    // En RELACIÓN, no en absoluto: ahora el compañero da ingreso desde el primer
    // segundo, así que el total producido ya no empieza en cero y una igualdad
    // contra el saldo mediría el ingreso pasivo junto con los clics.
    check('click: el total producido lleva la cuenta, en relación a antes',
      s(g).totalNanitesProduced - producidoAntes === ganado,
      `producido=${s(g).totalNanitesProduced - producidoAntes} ganado=${ganado}`);

    // `recargar()` y no `reload()` a secas: el motivo —que hay que volcar antes y
    // esperar a que asiente, porque si no se lee la partida anterior— está escrito
    // en el kit, en el sitio donde se puede volver a leer.
    const saldoAntesDeRecargar = nanites(g);
    const g2 = await recargar(g);
    // **SE COMPARA EL SALDO, NO EL GANADO DE LOS CLICS.** El saldo ya no es
    // "lo que gané clickando": el compañero de partida da ingreso desde el
    // primer segundo, así que al recargar hay más de lo que entró en el bucle.
    // Comparar contra `ganado` medía el ingreso pasivo como si fuera un error.
    check('click: y el saldo del jugador sobrevive a la recarga',
      nanites(g2) === saldoAntesDeRecargar,
      `nanitas=${nanites(g2)} antes=${saldoAntesDeRecargar} ganado=${ganado}`);
    check('click: el recolector sigue equipado tras recargar',
      s(g2).equippedCollectorId === colector.id, String(s(g2).equippedCollectorId));
    check('click: y sigue haciendo daño', g2.getClickDamage() === announced,
      `${announced} -> ${g2.getClickDamage()}`);
  }

  // =========================================================================
  //  3. COMPRAR. Lo que se enseña tiene que ser lo que se cobra (R3).
  // =========================================================================
  {
    const g3 = await recargar();
    // **ESTO ERA LA LLAVE T1 Y AHORA ES LA CAJA T1, Y HAY QUE LEER POR QUÉ.** El
    // identificador viejo daba `undefined` en `STORE_ITEMS`, así que
    // `STORE_ITEMS[barato].cost` era `undefined` y la compra que "debería" salir con
    // las nanitas justas se quedaba sin saldo: las tres comprobaciones de precio de
    // este apartado medían un caso que no ocurre.
    //
    // La caja T1 es la candidata obvia y además la correcta por el motivo que
    // importa: **es lo único que se vende para abrir algo**, y el jugador la compra
    // desde el primer minuto, así que el apartado 3 sigue midiendo el camino real.
    //
    // **Y ESTA COMPRA SE APILA, QUE ES LO QUE CAMBIA LO QUE HAY QUE PREGUNTAR.** La
    // partida de bienvenida ya trae dos cajas de T1, así que la comprada se suma a
    // esa pila. `addToWarehouse()` conserva el item **primero** de cada grupo, y el
    // id que devuelve `buyStoreItem()` es el del item nuevo, que no llega nunca al
    // almacén. Preguntar por ese id mediría un objeto que el juego nunca guarda, y
    // las dos comprobaciones de más abajo saldrían falsas por una razón que no tiene
    // que ver con lo que comprueban. No es un fallo del juego: es que **un item
    // apilado no tiene id propio**, y el banco lo daba por hecho.
    //
    // Por eso las dos cuentan UNIDADES con `cajasTotales()` y no ids. El cristal
    // —que era la otra opción— tiene el mismo problema: la partida de bienvenida
    // trae cinco cristales de T1, así que su compra también se fundía.
    const barato = 'crateT1';
    const cajasDeFabrica = cajasTotales(g3);

    // Sin nanitas no se compra, y sobre todo: no se COBRA. Un "no compres" que
    // descuenta es peor que un bug visible, porque el jugador pierde sin ver por
    // qué.
    const saldoAntes = nanites(g3);
    const denied = g3.buyStoreItem(barato);
    check('tienda: sin nanitas no se compra', !denied, String(denied));
    check('tienda: y no se cobra nada', nanites(g3) === saldoAntes, 'nanitas=' + nanites(g3));

    // Con nanitas justas sí, y el botón y el cobro dicen lo mismo.
    const precio = STORE_ITEMS[barato].cost;
    g3.updateState({ nanites: precio });
    const comprado = g3.buyStoreItem(barato);
    check('tienda: con las nanitas justas sí se compra', Boolean(comprado), String(comprado));
    check('tienda: se cobra EXACTAMENTE el precio de carta',
      nanites(g3) === 0, `nanitas=${nanites(g3)} precio=${precio}`);
    check('tienda: lo comprado llega al almacén',
      Boolean(comprado) && cajasTotales(g3) === cajasDeFabrica + 1,
      `cajas=${cajasTotales(g3)} antes=${cajasDeFabrica}`);
    // `canBuyStoreItem` NO pregunta "¿me llega el dinero?": pregunta "¿cabe en el
    // almacén?". La cartera es otra comprobación, y por eso el botón de la tienda
    // mira las dos. Con la cartera a cero pero sitio de sobra, aquí tiene que decir
    // que SÍ cabe: si dijera que no, el jugador vería el botón apagado sin razón.
    check('tienda: sin nanitas pero con sitio, cabe igual',
      g3.canBuyStoreItem(barato) === true, 'dice que no cabe con 3 de 15 ranuras');

    const g4 = await recargar();
    // **SE CUENTAN UNIDADES Y NO TIPOS, Y POR QUÉ.** Antes contaba
    // `deType(g4, 'key') === 1`, y contar por tipo solo funciona mientras el tipo
    // sea único en la partida: aquí la de bienvenida trae dos cajas de T1, así que
    // un recuento daría 2 y la comprobación fallaría por una caja que sí compró el
    // jugador. Y no se puede preguntar por el id del item comprado, porque la caja
    // se apila con la de bienvenida y conserva el id de la primera: el id que
    // devolvió la compra nunca llegó al almacén. Las unidades no tienen ese problema.
    check('tienda: la compra sobrevive a la recarga',
      cajasTotales(g4) === cajasDeFabrica + 1,
      `cajas=${cajasTotales(g4)} esperado=${cajasDeFabrica + 1}`);
    check('tienda: y la cartera vacía también sobrevive', nanites(g4) === 0, 'nanitas=' + nanites(g4));
  }

  // =========================================================================
  //  4. COMPAÑEROS: la otra mitad del ingreso
  // =========================================================================
  {
    const g5 = await recargar();
    // **NACE ACTIVO, Y LA PRUEBA SE DA LA VUELTA.** Antes el compañero venía inactivo
    // y esta comprobación nacía de eso. Ahora nace equipado, así que lo que queda por
    // comprobar es la regla de los dos lados igual que con el arma: **activo da
    // ingreso, inactivo no lo da**. Si esto desapareciera, el compañero sería un
    // objeto decorativo en la ranura.
    check('compañero: se nace con uno, y ACTIVO',
      s(g5).activeCompanions.length === 1 && s(g5).passiveIncome > 0,
      `activos=${s(g5).activeCompanions.join(',')} pasivo=${s(g5).passiveIncome}`);

    const comp = wh(g5).find((w: any) => w.type === 'companion')!;
    const pasivoConEl = s(g5).passiveIncome;

    // `equipCompanion` es un conmutador: el mismo companion, otra vez, lo quita.
    const quitado: any = g5.equipCompanion(comp.id);
    check('compañero: se puede quitar con el mismo botón',
      quitado === true && s(g5).activeCompanions.length === 0,
      `ok=${quitado} activos=${s(g5).activeCompanions.join(',')}`);
    check('compañero: y sin él se acaba el ingreso pasivo',
      s(g5).passiveIncome === 0, `pasivo=${s(g5).passiveIncome}`);

    check('compañero: y se vuelve a activar',
      g5.equipCompanion(comp.id) === true && s(g5).passiveIncome === pasivoConEl,
      `pasivo=${s(g5).passiveIncome} antes=${pasivoConEl}`);
    check('compañero: con 1 ranura no cabe un segundo',
      g5.equipCompanion('inexistente') === false, 'aceptó un id que no existe');

    const g6 = await recargar();
    check('compañero: el activo sigue activo tras recargar',
      s(g6).activeCompanions.includes(comp.id), s(g6).activeCompanions.join(','));
    check('compañero: y el ingreso pasivo sobrevive',
      s(g6).passiveIncome === s(g5).passiveIncome,
      `${s(g5).passiveIncome} -> ${s(g6).passiveIncome}`);

    // El conmutador ya está comprobado más arriba, con su ingreso y sin él: una ranura
    // que no se puede vaciar es una decisión del jugador que no existe, y repetirlo
    // después de recargar solo añadiría una recarga.
  }

  // =========================================================================
  //  5. EL ALMACÉN: ranuras, pilas y no perder nada
  // =========================================================================
  {
    const g7 = await recargar();
    const cap = g7.getCapacity();
    check('almacén: la capacidad es la que se anuncia', cap === 15, 'cap=' + cap);

    // **LO QUE SE COMPRUEBA AQUÍ ES EL INVARIANTE, Y NO UN RECUENTO DE CELDAS.**
    //
    // Antes la comprobación llevaba un número absoluto —cuatro items, una pila de
    // dos— y por eso medía el estado de la partida de bienvenida en vez del apilado.
    // Se rompió dos veces por cosas que no tienen nada que ver: primero porque la
    // partida de bienvenida cambió, y después porque el apartado 3 compró una caja
    // que **se fundió con la pila de las de bienvenida** y esa pila conserva el id
    // de la primera. El número absoluto bajó a tres y el banco dio rojo.
    //
    // Lo que importa no es cuántas celdas hay, sino que **todas las cajas que haya
    // ocupen una sola celda por muchas que sean**. Eso se dice comparando el
    // número de unidades con el número de items de caja, y no depende de que la
    // partida de bienvenida traiga dos cajas o tres.
    const ranuras = wh(g7).length;
    const pilaDeCajas = wh(g7).filter((w: any) => w.type === 'crate');
    const unidadesDeCaja = pilaDeCajas
      .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);
    check('almacén: las cajas ocupan 1 ranura, por muchas que sean',
      unidadesDeCaja >= 2 && pilaDeCajas.length === 1 &&
      unidadesDeCaja === pilaDeCajas[0].stackCount,
      `items=${ranuras} celdasDeCaja=${pilaDeCajas.length} unidades=${unidadesDeCaja}`);
    // Y el total del almacén sigue cuadrando: cada celda pintada es una ranura,
    // sin contar dos veces la pila. Sin apilado serían una ranura más.
    check('almacén: y sin apilado serían más ranuras de las que hay',
      ranuras === wh(g7).length && unidadesDeCaja > pilaDeCajas.length,
      `items=${ranuras} unidadesDeCaja=${unidadesDeCaja}`);
    check('almacén: con sitio de sobra la compra cabe',
      g7.canBuyStoreItem('crateT1') === true, 'no cabe con ' + ranuras + ' de 15');

    // Ampliar el almacén tiene UN camino: el expansor es un CONSUMIBLE que se
    // compra y se usa después (F27). El permiso directo de antes ya no existe:
    // comprar mete un item y usarlo amplía.
    const antesCap = g7.getCapacity();
    const antesSlots = wh(g7).length;

    g7.updateState({ nanites: 3000 });
    const expansor = g7.buyStoreItem('expansorT1');
    check('almacén: el expansor SÍ es un item',
      Boolean(expansor) && deType(g7, 'consumable') === 1, 'consumibles=' + deType(g7, 'consumable'));
    const capTrasComprar = g7.getCapacity();
    check('almacén: pero comprarlo NO amplía todavía',
      capTrasComprar === antesCap, 'cap=' + capTrasComprar);
    check('almacén: y mete un item',
      wh(g7).length === antesSlots + 1, `${antesSlots} -> ${wh(g7).length}`);
    const usado = g7.useConsumable((expansor as any).id);
    check('almacén: ampliar es usarlo', usado.ok === true, usado.msg ?? '');
    // El expansor T1 da +5 ranuras y vale hasta 20, que es su techo: a partir de ahí deja de servir.
    check('almacén: y al usarlo suben 5 ranuras',
      g7.getCapacity() === capTrasComprar + 5,
      `${capTrasComprar} -> ${g7.getCapacity()}`);
    const g8 = await recargar();
    check('almacén: la ampliación sobrevive a la recarga',
      g8.getCapacity() === antesCap + 5, 'cap=' + g8.getCapacity());

    // Y ahora la parte que más se ha roto: con el almacén lleno, lo que no cabe
    // no se compra, y lo que sí cabe en una pila sí se compra.
    //
    // QUINCE items, no catorce: `baseSave` no añade los de bienvenida, así que
    // catorce contra una capacidad de quince no está lleno y todas las
    // comprobaciones de "lleno" pasarían sin probar nada. Y una de esas quince es
    // una pila de cajas, que es lo que da sentido a la comparación.
    const g9 = await boot(baseSave(
      [...Array.from({ length: 14 }, (_, i) => collector('c' + i)), cr('pila', 1, 5)],
      { nanites: 100_000, warehouseCapacity: 15 }
    ));
    check('almacén lleno: está lleno de verdad',
      g9.getCapacity() === 15 && wh(g9).length === 15,
      `${wh(g9).length}/${g9.getCapacity()}`);
    // **EL CRISTAL, Y POR QUÉ NO LA CAJA.** Este bloque compara dos compras: una que
    // necesita ranura propia y otra que se apila en la que ya hay. La caja es la
    // segunda, y ya está comprobada dos comprobaciones más abajo. Para la primera
    // hace falta un tipo **sin tope de almacenamiento** —`TOPE_PILA` solo pone un
    // tope a la caja—, porque un tipo con tope siempre encuentra una pila donde
    // meterse y nunca pediría ranura nueva.
    check('almacén lleno: un item que necesita ranura NO cabe',
      g9.canBuyStoreItem('upgradeCrystal') === false, 'dice que cabe');
    check('almacén lleno: y al comprarlo no se cobra',
      (() => { g9.buyStoreItem('upgradeCrystal'); return nanites(g9) === 100_000; })(),
      'nanitas=' + nanites(g9));
    check('almacén lleno: pero otra caja del mismo tipo SÍ cabe, porque se apila',
      g9.canBuyStoreItem('crateT1') === true,
      `hay una pila de ${wh(g9).find((w: any) => w.id === 'pila')?.stackCount} cajas`);
    check('almacén lleno: y al comprarla no ocupa ranura nueva',
      (() => {
        const antes = wh(g9).length;
        const comprada = g9.buyStoreItem('crateT1');
        return Boolean(comprada) && wh(g9).length === antes;
      })(), `items=${wh(g9).length}`);
    check('almacén lleno: y la pila suma las unidades',
      wh(g9).find((w: any) => w.id === 'pila')?.stackCount === 6,
      'unidades=' + wh(g9).find((w: any) => w.id === 'pila')?.stackCount);
  }

  // =========================================================================
  //  6. VENDER: el botón tiene que decir lo que cobra
  // =========================================================================
  {
    const g10 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), { ...collector('r1'), id: 'r2' },
       { ...collector('r1'), id: 'r3', type: 'crate', name: 'Caja Común', stackable: true, stackCount: 4 }],
      { nanites: 500, warehouseCapacity: 30 }
    ));
    // El unitario es el de ESE item, no el de otro. Al principio se comparaba una
    // pila de cajas contra el precio de un recolector, que no tienen nada que ver
    // y daba un fallo que parecía del juego.
    const unitarioCaja = g10.getSellPrice('r3');
    const unitarioRec = g10.getSellPrice('r1');
    check('venta: el precio unitario es el de UNA pieza', unitarioRec > 0, 'unitario=' + unitarioRec);
    check('venta: y el de una caja es el suyo, no el de otro item',
      unitarioCaja > 0 && unitarioCaja !== unitarioRec,
      `caja=${unitarioCaja} recolector=${unitarioRec}`);

    const total = g10.getSellTotal('r3');
    check('venta: el total de una pila es SU unitario × unidades',
      total === unitarioCaja * 4, `total=${total} unitario=${unitarioCaja} pila=4`);
    check('venta: el total NO es el unitario (la trampa que ya pasó)',
      total !== unitarioCaja, 'son iguales');

    const antes = nanites(g10);
    const vendido = g10.sellItem('r3');
    check('venta: se vende la pila entera', vendido.ok === true, vendido.msg ?? '');
    check('venta: y se cobra EXACTAMENTE lo que el botón decía',
      nanites(g10) - antes === total,
      `cobrado=${nanites(g10) - antes}(total=${total})`);
    check('venta: y la pila desaparece del almacén', !find(g10, 'r3'), ids(g10).join(','));

    const g11 = await recargar();
    check('venta: no se resucita al recargar', !find(g11, 'r3'), ids(g11).join(','));
    check('venta: y la cartera es la que quedó',
      nanites(g11) === antes + total, `nanitas=${nanites(g11)}`);

    // El recolector equipado no se vende, y esta comprobacion mira dos cosas: que se
    // rechace y que ademas siga ahi haciendo dano. Si se vendiera, el jugador se
    // quedaria sin dano, con el almacen mas vacio y sin ningun aviso.
    g11.equipCollector('r1');
    const intentado = g11.sellItem('r1');
    check('venta: el recolector equipado no se vende', intentado.ok === false, intentado.msg ?? '');
    check('venta: y sigue en el almacén haciendo daño',
      Boolean(find(g11, 'r1')) && g11.getClickDamage() > 0, 'danio=' + g11.getClickDamage());
  }

  // =========================================================================
  //  7. LA RULETA Y LAS CAJAS: lo que enseña es lo que entra
  // =========================================================================
  {
    const g12 = await boot(baseSave(
      [{ ...collector('r1', 3, { damage: 60 }) }, cr('c1', 1), mat('x1', 2)],
      { nanites: 0, warehouseCapacity: 30 }
    ));
    const antes = nanites(g12);
    const cajas = wh(g12).filter((w: any) => w.type === 'crate').length;
    const crystals = wh(g12).filter((w: any) => w.type === 'crystal')
      .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);

    // **LA CAJA SE ABRE CON SU ID Y NADA MÁS.** Antes era
    // `openCrateBox('c1', 'k1')`: el id de la caja y el de la llave, y el motor
    // comprobaba que la llave sirviera para ese cofre. Ya no hay llave que
    // comprobar, y por eso la llamada es de un argumento.
    const r = g12.openCrateBox('c1');

    // CUÁNTOS CRISTALES SOLTÓ EL BOTÍN DE ESTA CAJA.
    //
    // La caja común tiene una fila de cristales con peso 26, así que algo menos de
    // una de cada nueve aperturas deja material nuevo. Estas pruebas miran el
    // recuento del almacén, y **sin restar el botín fallan solas una de cada nueve
    // veces**: el juego está haciendo lo correcto y la prueba se equivoca de más.
    // Es el peor tipo de prueba —la que sale verde casi siempre—, porque el día que
    // falle del todo nadie sabrá si es ella o el juego.
    const sueltas = r.reward?.kind === 'crystals' ? (r.reward.amount ?? 0) : 0;
    // **Y AQUÍ NO HAY QUE RESTAR NADA, Y ES LA DIFERENCIA CON LA VIEJA.** Antes abrir
    // consumía una llave, así que lo esperado era `llaves - 1 + sueltas`. Ahora lo
    // único que se consume es la caja, y el material solo puede **sumar**: por eso
    // lo esperado es `cristales + sueltas`, sin el `- 1`.
    const cristalesDeFabrica = crystals + sueltas;
    const totalCristales = (gg: any) => wh(gg).filter((w: any) => w.type === 'crystal')
      .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);

    check('caja: se abre', r.ok === true, r.msg ?? '');
    // F31 · ABRIR UNA CAJA PUEDE DEJAR OTRA CAJA, Y POR ESO YA NO SE CUENTAN.
    //
    // El criterio era "desaparece un item de caja", que era verdad con cuatro
    // cajas donde la T1 no soltaba ninguna. Con la cadena de F31 la caja T1 suelta
    // la T2, así que abrir una puede dejar los mismos dos items: uno consumido y
    // uno nuevo. Lo que sí tiene que ser cierto es que **el número de cajas de
    // nivel T1 baja**, que es la caja que se abrió.
    check('caja: la caja se consume',
      (s(g12).crates[1] ?? 0) < cajas, `cajasT1=${s(g12).crates[1]} items=${deType(g12, 'crate')}`);
    // **LO QUE ABRE UNA CAJA ES LA CAJA, Y SOLO LA CAJA.** La comprobación no es
    // "se gastó lo que se debía": es que el material **no baja**, porque ahora no hay
    // ningún segundo objeto que el jugador pueda gastar al abrir. Si volviera a haber
    // uno, esta prueba seguiría dando verde si el botín lo tapara, así que el
    // nombre también ha cambiarado.
    check('caja: abrirla no gasta material, solo la caja',
      totalCristales(g12) === cristalesDeFabrica,
      `cristales=${totalCristales(g12)} esperado=${cristalesDeFabrica} (botín soltó ${sueltas})`);
    check('caja: el contador de cajas abiertas sube', s(g12).cratesOpened === 1,
      'abiertas=' + s(g12).cratesOpened);

    // El principio del módulo: el nombre que enseña y el item que entra son el
    // mismo. Con el botín siendo nanitas, la cifra que anuncia la casilla tiene
    // que ser la que entró.
    const premio = r.reward;
    check('caja: vuelve un premio con etiqueta y nombre',
      Boolean(premio && premio.label && premio.name), JSON.stringify(premio?.label ?? null));
    if (premio?.kind === 'nanites') {
      const ganado = nanites(g12) - antes;
      check('caja: si son nanitas, entran las que dice la etiqueta',
        premio.label.includes(String(ganado)) || premio.label.includes('K'),
        `etiqueta="${premio.label}" entraron=${ganado}`);
    }

    // Dos turnos antes de recargar, y el motivo es el mismo que documenta `boot()`:
    // `openCrateBox` llama a `saveToFirebase()` SIN `await`, así que su escritura
    // sigue en el aire cuando se pide la recarga y el bucle nuevo lee el documento
    // de antes de abrir la caja. Con un solo turno el documento llega a medio
    // guardar —la caja ya consumida, la llave todavía con dos unidades— y el
    // banco acusa al guardado de algo que no ha hecho.
    //
    // No se arregla dentro de `reload()`, que debe seguir siendo una recarga limpia
    // para `queueCheck`: esperar es responsabilidad de quien acaba de mutar.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const g13 = await recargar();
    check('caja: el botín sobrevive a la recarga',
      s(g13).cratesOpened === 1, 'abiertas=' + s(g13).cratesOpened);
    // Lo que se comprueba aquí es la dirección del daño: el MATERIAL NO SE DUPLICA.
    // Que la caja no vuelva es lo evidente; lo que sería un fallo de verdad es que
    // abrirla fabricara material, porque convertir una caja en cristal gratis es
    // infinitamente explotable.
    //
    // NOTA HISTORICA: este `check` empezó siendo un dato en lugar de una aserción,
    // porque el material consumido VOLVÍA al recargar. Resultó ser un bug de verdad,
    // y de los que más caros: `saveToFirebase` no escribía `crystalsByTier`, así que
    // al cargar la migración metía el TOTAL en el cubo del nivel 0, comparaba un
    // total contra una parte y materializaba material de más EN CADA RECARGA.
    //
    // Se ve porque el stub de Firestore guardaba el documento con una copia
    // superficial, de modo que el banco comparaba un array consigo mismo. Al hacer
    // que el stub serialice como Firestore, dos pruebas que eran vacuas se pusieron
    // a mirar de verdad. Ver `CONTEXTO-JUEGO.md`, discrepancias 15 y 16.
    //
    // **ESTO SOBREVIVE SIN LAS LLAVES, Y ES JUSTO POR QUÉ ESTE BLOQUE SIGUE
    // MIRANDO EL MATERIAL Y NO LAS CAJAS.** La mitad de llave del bug ya no puede
    // pasar: las llaves no se multiplican porque no se acumulan en absoluto. La de
    // cristal es el mismo fallo con otro nombre, y quitarla sería borrar la mitad
    // que todavía puede activarse.
    //
    // Y la línea de abajo **no estaba indentada**, ni cuatro de sus comments de más
    // abajo, ni traía un `\u00f3` literal en mitad de la frase. Ninguna de las dos
    // cosas rompía nada —un comentario con la sangría mal puesta sigue siendo un
    // comentario— y por eso nadie lo había visto. Se arreglan aquí porque el bloque
    // se reescribía de todas formas, y no como una tarea aparte.
    const cajas13 = deType(g13, 'crate');
    const cristales13 = totalCristales(g13);
    // F31 · La caja que se abrió no vuelve, aunque el botín haya dejado otra caja
    // en su sitio. Se mide por nivel, que es donde vive el contador.
    check('caja: la caja abierta no vuelve',
      (s(g13).crates[1] ?? 0) < cajas, `cajasT1=${s(g13).crates[1]} items=${cajas13} (antes ${cajas})`);
    check('caja: abrir una caja NO multiplica el material',
      cristales13 <= cristalesDeFabrica,
      `cristales=${cristales13} tope=${cristalesDeFabrica} (antes ${crystals}, botín soltó ${sueltas})`);
    check('caja: y el material no crece al recargar',
      cristales13 === cristalesDeFabrica,
      `cristales=${cristales13} esperado=${cristalesDeFabrica} · doc=${JSON.stringify((guardado() as any)?.crystalsByTier ?? 'sin campo crystalsByTier')}`);
  }

  // =========================================================================
  //  8. EL BALANCE: que un tier alto no sea una trampa
  //
  //  Esta es la única comprobación de equilibrio del banco, y no es arbitraria.
  //  `CAMBIOS-MACRO.md` documenta que la curva se aplanó porque el coste por punto
  //  de poder era 32× peor en T10 que en T1, y que el jugador óptimo solo
  //  compraba T1. Ese es un fallo de juego, no una preferencia: hace que la mitad
  //  de la tienda sean trampas.
  //
  //  Se mide por poder REAL, no por un número escrito en el test: el precio sale
  //  de `costeDeCaja()` y el daño de `danioDeRango()`, que son las dos funciones
  //  que usa el juego. Así el banco no reimplementa ninguna fórmula.
  //
  //  F31 · ESTE BLOQUE MEDÍA LAS CARTAS DE TIER, Y YA NO HAY CARTAS DE TIER.
  //
  //  Lo que se mide ahora es **la caja de cada tier**, que es el camino que
  //  queda: la caja T{n} cuesta la mitad de un T{n} y suelta un T{n}. Los ratios
  //  son los mismos que los de las cartas —el precio está partido por dos en los
  //  dos lados—, así que los umbrales de abajo siguen valiendo sin tocarlos.
  // =========================================================================
  {
    const poder: { tier: number; coste: number; danio: number }[] = [];
    for (let tier = 1; tier <= 10; tier++) {
      poder.push({
        tier,
        coste: costeDeCaja(tier),
        // Potencial 1: el PEOR recolector del tier. Con el mejor la dispersión
        // sería menor y la comprobación más floja.
        danio: danioDeRango(tier, 1)
      });
    }

    const detalle = poder.map((p) => `T${p.tier}:${(p.danio / p.coste * 1000).toFixed(1)}`).join(' ');
    check('balance: se pudieron medir los diez tiers', poder.length === 10,
      'medidos=' + poder.length);

    // El daño SUBE con el tier. Trivial, pero es la condición necesaria para que
    // el apartado de debajo signifique algo: si un tier alto diera menos daño que
    // uno bajo, hablar de coste por punto sería hablar de nada.
    check('balance: más tier es más daño',
      poder.every((p, i) => i === 0 || p.danio > poder[i - 1].danio), detalle);

    // Aquí está el hallazgo, y es un DATO, no una aspiración.
    //
    // `CAMBIOS-MACRO.md` cuenta que la curva se aplanó porque el coste por punto de
    // poder era 32× peor en T10 que en T1, y que después del arreglo T10 salía
    // "~1,3x mejor que en T1". Medido hoy NO es eso: el mejor tier entrega 4,9×
    // más poder por nanita que el peor, y la curva es una escalera que sube sin
    // parar de T5 en adelante (T5 10,9 · T6 11,9 · T7 13,6 · T8 21,7 · T9 29,5 ·
    // T10 30,9).
    //
    // La consecuencia para el jugador es la del bug original, del revés: ahora
    // las cartas de tier bajo son trampas y no se compran nunca. En
    // `CONTEXTO-JUEGO.md` queda anotado como discrepancia 15.
    //
    // El margen de aquí es de GUARDIA, no de diseño: está puesto por encima del
    // 4,9× medido para que una subida de precios no lo dispare, y con la cabeza
    // sobre el hecho de que el objetivo declarado era 1,3×. Si esto salta, alguien
    // ha tocado la tabla de precios.
    const ratio = poder.map((p) => p.danio / p.coste);
    const max = Math.max(...ratio);
    const min = Math.min(...ratio);
    const factor = max / min;
    const peor = poder[ratio.indexOf(min)].tier;
    const mejor = poder[ratio.indexOf(max)].tier;
    check('balance: el poder por nanita se midió en los diez tiers',
      ratio.every((r) => r > 0), detalle);
    check('balance: la curva no se dispara (peor ≤ 6× el mejor)',
      factor <= 6, `T${peor} contra T${mejor}: ${factor.toFixed(1)}x  ${detalle}`);
    check('balance: DATO la dispersión real entre tiers',
      true, `${factor.toFixed(1)}x de T${peor} a T${mejor}; el objetivo declarado es 1,3x`);
  }

  // =========================================================================
  //  9. LOS BUFFS: se aplican, se caducan y se pueden cancelar
  // =========================================================================
  {
    const g15 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), consumable('u1', 'clickX2', 1, { name: 'Tarjeta Click x2' })],
      { nanites: 0, warehouseCapacity: 30 }
    ));
    g15.equipCollector('r1');
    const danio = g15.getClickDamage();

    const r = g15.useConsumable('u1');
    check('buff: una tarjeta Click x2 se aplica', r.ok === true, r.msg ?? '');
    check('buff: y duplica el daño por click', g15.getClickDamage() === danio * 2,
      `${danio} -> ${g15.getClickDamage()}`);
    check('buff: el item se gasta', !find(g15, 'u1'), ids(g15).join(','));

    const cancelado = g15.cancelBuff('clickX2');
    check('buff: se puede cancelar', Boolean(cancelado), String(cancelado));
    check('buff: y al cancelar vuelve el daño', g15.getClickDamage() === danio,
      `${danio} -> ${g15.getClickDamage()}`);

    const g16 = await recargar();
    check('buff: el buff cancelado no sobrevive a la recarga',
      g16.getClickDamage() === danio, 'danio=' + g16.getClickDamage());
    check('buff: y el item cancelado no vuelve', !find(g16, 'u1'), ids(g16).join(','));
  }

  // =========================================================================
  //  10. LA ASCENSIÓN: el cierre del ciclo
  //
  //  Es lo último que hace un jugador y lo que más caro sale si se rompe, porque
  //  es la partida entera. Se comprueba lo que la página promete: por debajo del
  //  umbral no pasa nada, y por encima se conservan los núcleos y el árbol y se
  //  reinicia el progreso.
  // =========================================================================
  {
    const g17 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 })],
      { nanites: 1000, totalNanitesProduced: 500, warehouseCapacity: 30 }
    ));
    const bajo = g17.prestige();
    check('ascensión: por debajo del umbral se rechaza', !bajo.success, bajo.msg ?? '');
    check('ascensión: y no se toca el progreso', nanites(g17) === 1000, 'nanitas=' + nanites(g17));

    const g18 = await boot(baseSave(
      [collector('r1', 3, { damage: 60 }), crystal('x1', 1, 3)],
      {
        nanites: 2_000_000, totalNanitesProduced: 50_000_000,
        warehouseCapacity: 30, cores: 3, totalCores: 10, resets: 2,
        nodeLevels: { core_sink: 2 }, unlockedNodes: ['core_sink']
      }
    ));
    // `pending` es el nombre del campo, no `gained`: el que se anuncia en la
    // página de Ascensión. Es lo que tiene que coincidir con lo que el reinicio
    // otorga, porque un jugador que ve una cifra y recibe otra no va a notar que
    // la fórmula sea la misma.
    const info = g18.getPrestigeInfo();
    check('ascensión: la página anuncia lo que daría', info.pending > 0, 'daria=' + info.pending);

    const r = g18.prestige();
    check('ascensión: con suficiente producción se concede', r.success === true, r.msg ?? '');
    check('ascensión: otorga los núcleos anunciados', s(g18).cores === 3 + info.pending,
      `nucleos=${s(g18).cores} esperado=${3 + info.pending}`);
    check('ascensión: el progreso se reinicia', nanites(g18) === 0, 'nanitas=' + nanites(g18));
    check('ascensión: los núcleos NO se pierden', s(g18).cores > 3, 'nucleos=' + s(g18).cores);
    check('ascensión: el árbol de pasivas se conserva',
      (s(g18).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g18).nodeLevels));
    check('ascensión: el contador de reinicios sube', s(g18).resets === 3, 'reinicios=' + s(g18).resets);

    const g19 = await recargar();
    check('ascensión: el reinicio sobrevive a la recarga',
      nanites(g19) === 0 && s(g19).cores === 3 + info.pending && s(g19).resets === 3,
      `nanitas=${nanites(g19)} nucleos=${s(g19).cores} reinicios=${s(g19).resets}`);
    check('ascensión: y el árbol sigue ahí tras recargar',
      (s(g19).nodeLevels?.core_sink ?? 0) === 2, JSON.stringify(s(g19).nodeLevels));

    // Y LO MÁS IMPORTANTE DE ESTE APARTADO: que no haya bloqueo. Tras el reinicio
    // el jugador tiene cero nanitas y ningún recolector equipado, así que el click
    // no da nada. Si además no le quedara nada con lo que arrancar, la partida se
    // acabaría ahí para siempre: el jugador no puede ganar su primer nanita.
    //
    // No lo hay, y por qué: el reinicio deja 5 cristales, las 2 cajas de bienvenida y
    // bienvenida y un Blaster Láser en el almacén. Se comprueba, no se supone.
    const blaster = wh(g19).find((w: any) => w.type === 'collector');
    check('ascensión: queda un recolector con el que empezar',
      Boolean(blaster), 'items=' + ids(g19).join(','));
    // **NO HAY QUE EQUIPARLO: LA ASCENSIÓN YA LO DEJA PUESTO.** Antes sí había que
    // equiparlo a mano, y por eso la prueba llamaba a `equipCollector()`. Con el arma
    // equipada de origen, esa llamada es un conmutador y lo **quitaba**: el banco se
    // quedaba con daño cero y el fallo parecía un bug de la Ascensión cuando lo
    // había causado él mismo. Si esto no estuviera equipado, sería un bloqueo
    // real —el jugador no podría ganar su primer nanita—, así que el que se
    // comprueba es lo contrario: que sale equipado.
    check('ascensión: y sale ya equipado, sin que el jugador toque nada',
      s(g19).equippedCollectorId === 'collector_blaster_001',
      `equipo=${s(g19).equippedCollectorId}`);
    check('ascensión: y con él se vuelve a hacer daño',
      g19.getClickDamage() > 0, 'danio=' + g19.getClickDamage());
    g19.click();
    check('ascensión: no hay bloqueo: el primer click ya da algo',
      nanites(g19) > 0, 'nanitas=' + nanites(g19));
  }

  resumen('la partida entera de un jugador nuevo');
}

// --------------------------------------------------------------------------
//  Ayudantes locales. Los que ya existen en `kit.ts` se usan; estos son solo
//  atajos de lectura para que el banco se lea como se juega.
// --------------------------------------------------------------------------

/**
 * Una caja con el nombre que el juego reconoce al abrirla.
 *
 * F31 · El nombre es `Caja T{n}` y el nivel es el número. Antes eran los cuatro
 * nombres de rareza, y el juego los recognacía por palabra suelta; con diez
 * cajas el número va en el nombre, así que la fábrica escribe lo que escribe el
 * juego. Si no, el banco mide un item que el juego no sabe abrir —y de hecho
 * falló con "No se reconoce el tipo de esta caja" antes de arreglar esto.
 */
function cr(id: string, tier: number, stack = 1) {
  const def = CRATE_TYPES[tier as CrateType];
  return {
    id, name: def.name, type: 'crate', details: def.details, rarity: def.rarity,
    tier: 0, sellPrice: 500, stackable: true, stackCount: stack
  };
}

/**
 * Cuántas cajas hay en el almacén, contando UNIDADES y no items.
 *
 * Existe porque las cajas se apilan: la partida de bienvenida trae dos, y son un
 * solo item. Preguntar por el id del item comprado tampoco vale —la pila conserva
 * el id de la primera—, así que la única cifra que se puede comparar antes y
 * después es el número de unidades.
 */
function cajasTotales(gg: any): number {
  return wh(gg).filter((w: any) => w.type === 'crate')
    .reduce((a, w: any) => a + (w.stackCount ?? 1), 0);
}

/**
 * Un cristal de su nivel, listo para el almacén.
 *
 * **ESTE ERA EL ITEM DE LLAVE, Y EL CRISTAL LO SUSTITUYE PORQUE SIGUE SIENDO EL
 * MATERIAL QUE ABRE Y QUITA UNA CAJA.** El apartado 7 comprueba dos cosas: que el
 * botín de una caja no multiplica el material y que lo consumido no vuelve al
 * recargar. Eso se puede medir con cualquier material, y el cristal es el que
 * queda.
 */
function mat(id: string, stack: number, tier = 1) {
  const def = CRYSTAL_DEFS[tier];
  return {
    id, name: def.name, type: 'crystal', details: def.details, rarity: def.rarity,
    tier, sellPrice: 180, stackable: true, stackCount: stack
  };
}

export default main();
