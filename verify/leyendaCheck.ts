import { dirname, resolve as resolver } from 'node:path';
import { VERSION, NOTAS, notaDeEstaVersion } from '../src/data/patchNotes';
import { getPatchNotes, setPatchNotes, getNotasVistas, setNotasVistas } from '../src/patchNotesPrefs';
import { check, resumen } from './kit';
import { TREE_NODES, TREE_BY_ID } from '../src/data/tree';
import { chanceDeSintonizacion } from '../src/data/items';
import { AFIX_MIN_POR_RARIDAD, AFIX_MAX, explicacionDeAfijos, fraseDeSueloDeAfijos, aporteDeAfijos, rangoDeAfijosForjados, costeDeNivel } from '../src/data/crafting';
import { CRATE_TYPES, COMPANION_SLOT_BUY, STORE_ITEMS } from '../src/data/store';
import { ACHIEVEMENTS } from '../src/achievements';
import { CRATE_LOOT } from '../src/components/crateLoot';
import { DESCRIPTIONS } from '../src/components/store';

/**
 * LAS LEYENDAS DICEN LA REGLA, NO UNA COPIA.
 *
 * **POR QUÉ ESTE BANCO EXISTE.** Pediste verificar que ninguna leyenda pida una
 * cosa distinta de la que el juego hace. Hay decenas de leyendas, y revisarlas a
 * ojo es una forma garantizada de que la siguiente se vuelva vieja. Aquí **se
 * contrasta cada leyenda con su regla, una por una**, y el banco falla el día que
 * una se desvíe.
 *
 * **EL ERROR QUE ESTABA CAGADO, Y ES EL MISMO DE SIEMPRE:** una leyenda escrita al
 * lado de la tabla que genera esa lista. Cuando la tabla cambia, el texto no, y no
 * hay nada que se entere.
 *
 * La leyenda enumerando el botín es el caso peor, y en `data/store.ts` ya se
 * arregló para las cajas con un comentario que explica por qué. **Pero la tarjeta
 * de la caja T1 en la tienda seguía enumerándolo**, y con una entrada de menos: el
 * recolector. El jugador leía que la caja podía darle nanitas, un cristal, un
 * compañero, una llave y otra caja — y nunca un arma. Esa caja sí puede, y por
 * eso el mismo jugador reportaba que las cajas T1 no tiraban armas de T1: no era
 * el botín, era la carta.
 *
 * Y el segundo, del mismo género pero al revés: un nodo **promete una penalización
 * que el juego no aplica**. "Recolectores más caras de reparar" describe un sistema
 * de reparación que no existe en ninguna parte del proyecto. Una leyenda que
 * promete algo es peor que una que no dice nada: el jugador mide su decisión por
 * ella.
 */

/** Los números de un texto, con los signos de porcentaje separados. */
function numerosDe(texto: string): number[] {
  return (texto.match(/\d+(?:[.,]\d+)?/g) || []).map(s => Number(s.replace(',', '.')));
}

/** Solo los números que el texto da como porcentaje. */
function porcentajesDe(texto: string): number[] {
  return (texto.match(/(\d+(?:[.,]\d+)?)\s*%/g) || []).map(s => Number(s.replace('%', '').trim().replace(',', '.')));
}

async function main() {
  // =========================================================================
  //  1. EL ÁRBOL: CADA PORCENTAJE DE LA LEYENDA ES ALGO DEL BONUS
  // =========================================================================
  //  Un nodo dice "+8%" y su bonus es `passiveMult: 0.08`. La comparación tiene que
  //  tener en cuenta esa diferencia de escala, que es donde un banco escrito mal
  //  acepta cualquier cosa o no encuentra ninguna.
  {
    const malos: string[] = [];
    for (const nodo of TREE_NODES as any[]) {
      const delBonus = Object.values(nodo.bonus ?? {}).flat().filter((v: any) => typeof v === 'number') as number[];
      for (const pct of porcentajesDe(nodo.description)) {
        if (!delBonus.some(b => Math.abs(b * 100 - pct) < 1e-9)) {
          malos.push(`${nodo.id}: dice ${pct}% y tiene ${JSON.stringify(nodo.bonus)}`);
        }
      }
    }
    check('leyenda: cada porcentaje del árbol sale de su bonus',
      malos.length === 0, malos.join(' | ') || `${TREE_NODES.length} nodos`);
  }

  // =========================================================================
  //  2. EL ÁRBOL: CADA CANTIDAD DURA O DECIMAL ESTÁ TAMBIÉN
  // =========================================================================
  //  Los que no son porcentaje: ranuras, clics por segundo, minutos. Y aquí hay dos
  //  conversiones que son la mitad de por qué las leyendas han podido mentir:
  //  `afkHours: 0.5` son 30 minutos y `offlineClicks: 120` son 2 minutos.
  {
    const malos: string[] = [];
    const CONVERTIDAS: Record<string, number> = { afkHours: 30, offlineClicks: 2 };
    for (const nodo of TREE_NODES as any[]) {
      const sinPorcentaje = nodo.description.replace(/\d+(?:[.,]\d+)?\s*%/g, '');
      const delBonus: number[] = [];
      for (const [clave, v] of Object.entries(nodo.bonus ?? {}) as [string, any][]) {
        if (typeof v === 'number') delBonus.push(v, (CONVERTIDAS[clave] ?? NaN));
      }
      for (const n of numerosDe(sinPorcentaje)) {
        if (!delBonus.some(b => Math.abs(b - n) < 1e-9)) {
          malos.push(`${nodo.id}: dice ${n} y tiene ${JSON.stringify(nodo.bonus)}`);
        }
      }
    }
    check('leyenda: cada cantidad del árbol sale de su bonus, con sus unidades',
      malos.length === 0, malos.join(' | ') || `${TREE_NODES.length} nodos`);
  }

  // =========================================================================
  //  3. EL ÁRBOL: NINGUNA LEYENDA PROMETE UNA MECÁNICA QUE NO EXISTE
  // =========================================================================
  //  No se puede automatizar del todo —"reparar" podría existir mañana—, pero sí se
  //  puede fijar la lista de mecánicas que hoy **no** existen: es la forma de que
  //  cuando una aparezca sea porque alguien la borró de aquí a propósito.
  {
    const NO_EXISTEN = ['reparar', 'reparación', 'repara'];
    const promesas: string[] = [];
    for (const nodo of TREE_NODES as any[]) {
      const texto = `${nodo.name} ${nodo.description}`.toLowerCase();
      for (const palabra of NO_EXISTEN) {
        if (texto.includes(palabra)) promesas.push(`${nodo.id} dice "${palabra}"`);
      }
    }
    check('leyenda: ningún nodo promete una reparación que el juego no tiene',
      promesas.length === 0, promesas.join(' | ') || 'ninguno lo menciona');
  }

  // =========================================================================
  //  4. EL CRISTAL: UNA LEYENDA, Y CONTRA LA REGLA QUE SÍ HAY
  // =========================================================================
  //
  //  **LO QUE HAY AQUÍ ANTES, Y POR QUÉ NO SE PUEDE ADAPTAR TAL CUAL.** Recorría los
  //  diez niveles de la tabla y comparaba la "x" de cada leyenda con el multiplicador
  //  de ese nivel. Eso solo tenía sentido con una tabla que ya no existe: ahora hay
  //  **un** cristal, sin nivel y sin multiplicador, y su texto es el de la carta de
  //  la tienda.
  //
  //  Pero un texto sin tabla al lado sigue siendo un texto que puede mentir, así que
  //  lo útil se reparte en las dos mitades que quedan y que sí se pueden comprobar:
  //
  //    · Que el texto **no prometa** nada de lo que ya no hay: ni niveles de cristal
  //      que comprar, ni multiplicador, ni la regla de F26.
  //    · Y que lo que **sí** dice —que el coste sube con el nivel del item y que la
  //      probabilidad baja con el nivel— sea exactamente lo que aplican
  //      `costeDeNivel()` y `chanceDeSintonizacion()`.
  {
    const carta = STORE_ITEMS.upgradeCrystal;
    const desc = (DESCRIPTIONS as any).upgradeCrystal;
    const texto = [carta?.label, desc?.what, desc?.detail].filter(Boolean).join(' ');

    // Lo que ya no existe. **NO SE PROHÍBE QUE DIGA "T10"**: eso es verdad y es
    // exactamente lo que quiere decir, porque ahora el tier del ITEM es lo que
    // pone el precio. Lo que se prohíbe es prometer una elección de cristal.
    const PROHIBIDO: [RegExp, string][] = [
      [/multiplicador/i, 'un multiplicador que ya no existe'],
      [/\bx\s?\d/i, 'la "x" del nivel de cristal que ya no existe'],
      [/cristal\s+(de\s+nivel\s+)?t\d/i, 'niveles de cristal que ya no existen'],
      [/su\s+mismo\s+tier/i, 'F26: el cristal ya no es del tier del item, el precio sale de el'],
      [/su\s+propio\s+nivel/i, 'niveles de cristal que ya no existen']
    ];
    const promesas: string[] = [];
    for (const [re, que] of PROHIBIDO) {
      if (re.test(texto)) promesas.push(`dice "${que}" (${texto})`);
    }
    check('leyenda: el cristal no promete niveles ni multiplicador, porque ya no los hay',
      !!texto && promesas.length === 0, promesas.join(' | ') || `la carta dice "${carta?.label}"`);

    // Y la regla que el texto SÍ afirma, medida contra la regla que el juego aplica.
    // "La probabilidad de acierto baja con el nivel" es una afirmación comprobable:
    // tiene que ser verdad para todos los niveles, no para los que alguien probó.
    let algunoQueSube = -1;
    let fueraDeRango = 0;
    let anterior = chanceDeSintonizacion(0);
    for (let nivel = 0; nivel <= 60; nivel++) {
      const ahora = chanceDeSintonizacion(nivel);
      if (ahora > anterior) algunoQueSube = nivel;
      if (ahora < 35 || ahora > 95) fueraDeRango++;
      anterior = ahora;
    }
    check('leyenda: "la probabilidad baja con el nivel" es lo que hace la regla',
      algunoQueSube === -1 && fueraDeRango === 0 && chanceDeSintonizacion(0) === 95,
      `nivel 0 = ${chanceDeSintonizacion(0)}, nivel 20 = ${chanceDeSintonizacion(20)}, ` +
      `nivel 60 = ${chanceDeSintonizacion(60)}, niveles que suben = ${algunoQueSube}`);

    // **Y QUE NO HAYA FORMA DE COMPRARSE SUERTE.** El texto promete eso, y la forma
    // de que un cristal vuelva a multiplicar la probabilidad es volver a meterle un
    // argumento. Se comprueba la aridad de la función, que es lo único que la ata:
    // con un solo parámetro no hay nada que elegir, y si algún día lo hay, el banco
    // lo dice el mismo día.
    check('leyenda: y no hay forma de comprarse más suerte, porque la regla solo recibe el nivel',
      chanceDeSintonizacion.length === 1,
      `chanceDeSintonizacion recibe ${chanceDeSintonizacion.length} argumento(s)`);

    // "Cada nivel cuesta más, y más cuanto mayor es el item": las dos mitades del
    // precio. La primera es la curva del nivel; la segunda, el factor del tier, que
    // es lo único que se lee del item que se sube.
    let costeQueNoSube = 0;
    for (const tier of [1, 3, 10, 30]) {
      for (let nivel = 0; nivel < 40; nivel++) {
        if (costeDeNivel(tier, nivel + 1) <= costeDeNivel(tier, nivel)) costeQueNoSube++;
      }
    }
    const porTier = costeDeNivel(10, 0) > costeDeNivel(1, 0);
    check('leyenda: "cada nivel cuesta más" y el tier del item es lo que lo hace caro',
      costeQueNoSube === 0 && porTier,
      `T1 nivel 0 = ${costeDeNivel(1, 0)}, T10 nivel 0 = ${costeDeNivel(10, 0)}, ` +
      `niveles que no encarecen = ${costeQueNoSube}`);
  }

  // =========================================================================
  //  5. LOS LOGROS: NINGUNO PIDE MÁS DE LO QUE EL JUEGO PERMITE
  // =========================================================================
  //  Un logro con la descripción cambiada y el objetivo viejo es un logro
  //  imposible, y **eso no lo canta nadie**: el progreso se queda en 2 de 3 para
  //  siempre y parece que el jugador va lento.
  //
  //  La clase de logro que importa aquí es la de los **topes cerrados**: no se puede
  //  "acumula 250.000 nanitas" nunca es imposible, pero "equipa 3 compañeros" sí,
  //  porque las ranuras tienen un máximo. Ese máximo se calcula con los datos del
  //  juego, no con un número escrito aquí — y por eso el banco lo avisa el día que
  //  el tope baje, que es justo cuando el logro se vuelve inalcanzable sin que
  //  nadie haya tocado su texto.
  {
    // Un estado vacío **completo**. Cada `progress()` lee lo que necesita y no
    // siempre lo mismo —cosmetics, historial, contadores—, y un `{}` a medias revienta
    // con "no se puede leer X de undefined" en vez de decir lo que quiere decir.
    const vacio = () => ({
      warehouse: [], companions: [], activeCompanions: [], cosmetics: { ownedCosmetics: [] },
      nanites: 0, totalNanitesProduced: 0, totalClicks: 0, cratesOpened: 0, forgedCount: 0,
      cores: 0, resets: 0, unlockedAchievements: [], passiveIncome: 0
    } as any);

    const sinObjetivo = ACHIEVEMENTS.filter((a: any) => {
      const t = a.progress(vacio()).target;
      return !Number.isFinite(t) || t < 1;
    }).map((a: any) => `${a.id}=${a.progress(vacio()).target}`);
    check('leyenda: todos los logros tienen un objetivo alcanzable',
      sinObjetivo.length === 0, sinObjetivo.join(' | ') || `${ACHIEVEMENTS.length} logros`);

    // **LAS RANURAS DE COMPAÑERO, QUE ES EL TOPE QUE MÁS SE MUEVE.**
    const porTienda = (COMPANION_SLOT_BUY as any[]).reduce((a, b) => a + (b.da || 0), 0);
    const porArbol = ((TREE_BY_ID as any)['squad_slots']?.maxLevel ?? 0);
    const ranurasMaximas = 1 + porTienda + porArbol;

    const deCompanios = ACHIEVEMENTS.filter((a: any) => /compa/i.test(a.description));
    const imposibles = deCompanios.filter((a: any) => a.progress(vacio()).target > ranurasMaximas);
    check('leyenda: ningún logro pide más compañeros activos que ranuras existen',
      imposibles.length === 0,
      imposibles.map((a: any) => `${a.id}=${a.progress(vacio()).target}`).join(' | ')
        || `máximo ${ranurasMaximas} ranuras (1 base + ${porTienda} de tienda + ${porArbol} del árbol)`);
  }

  // =========================================================================
  //  6. LAS CAJAS: SU LEYENDA NO ENUMERA EL BOTÍN NI HABLA DE LLAVES
  // =========================================================================
  //  Ya estaba en `potencialCheck`, y es la regla de `data/store.ts`: la leyenda
  //  dice **qué la abre**, no qué trae.
  //
  //  **Y EL "QUÉ LA ABRE" ES LO QUE CAMBIÓ AL QUITARLAS.** El texto nuevo —"Se
  //  abre sola."— está escrito al lado de la tabla, que es exactamente donde nace
  //  el tipo de mentira que este banco existe para cazar. La caja ya no pide nada
  //  para abrirse, así que su leyenda no puede seguir hablando de un requisito:
  //  si un día alguien deja "se abre con la llave de su tier" en el texto, el
  //  jugador leerá que tiene que buscar una llave que ya no existe, y no hay
  //  ninguna otra prueba que se entere.
  {
    const textos = Object.keys(CRATE_TYPES).map(t => (CRATE_TYPES as any)[t].details);
    const enumera = textos.filter(d => /cristal|compa|recolector|arma|nanitas/i.test(d));
    check('leyenda: la leyenda de las cajas no enumera el botín',
      enumera.length === 0, enumera[0] || `${textos.length} cajas`);
    check('leyenda: y las diez dicen la MISMA cosa, que es la prueba de que no es una copia',
      new Set(textos).size === 1, `${new Set(textos).size} textos distintos`);

    // La comprobación nueva, y más fuerte que las dos de arriba: **ninguna de las
    // diez cajas puede decir que se abre con una llave.** No basta con que el texto
    // sea único —un único texto equivocado sigue siendo mentira para el jugador
    // que lo lee—, así que se busca la palabra en las diez por separado.
    //
    // Y se mira también la tarjeta de la tienda, que es el otro sitio donde se
    // escribía el requisito (apartado 7).
    const conLlave: string[] = [];
    for (const t of Object.keys(CRATE_TYPES)) {
      const d = String((CRATE_TYPES as any)[t].details);
      if (/llave/i.test(d)) conLlave.push(`T${t}: ${d}`);
    }
    check('leyenda: ninguna caja dice que se abra con una llave',
      conLlave.length === 0, conLlave.join(' | ') || `${Object.keys(CRATE_TYPES).length} cajas`);
  }

  // =========================================================================
  //  7. LA TARJETA DE LA TIENDA: TAMPOCO, Y AQUÍ ESTABA EL QUE SE PASÓ
  // =========================================================================
  {
    const carta: any = (DESCRIPTIONS as any).crateT1;
    check('leyenda: la tarjeta de la caja T1 no enumera el botín',
      !!carta && !/nanitas|cristal|compa|recolector|llave|caja T2/i.test(carta.detail),
      carta?.detail ?? 'no hay tarjeta');
  }

  // =========================================================================
  //  8. LA TABLA DE BOTÍN SIGUE SIENDO LA VERDAD
  // =========================================================================
  //  Si las leyendas ya no la enumeran, esta tabla es la única fuente. Se comprueba
  //  que sigue teniendo lo que el juego reparte, para que nadie la vacíe pensando
  //  que nadie la lee.
  //
  //  **HACE FALTA LLAMAR A `build()`.** Cada fila es una fábrica, no un premio: lo
  //  que dice qué es está dentro de la función, que es también donde se tira el
  //  dado. Mirar `fila.kind` sobre una fábrica daría `undefined` para todas, que
  //  es como se escribe un banco que pasa sin comprobar nada.
  {
    const clases = new Set<string>();
    for (const tier of Object.keys(CRATE_LOOT)) {
      for (const fila of (CRATE_LOOT as any)[tier]) {
        clases.add(String(fila.build({ ownedCosmetics: [] } as any).kind));
      }
    }
    check('leyenda: la tabla de botín sigue teniendo lo que el juego reparte',
      clases.has('collector') && clases.has('companion') && clases.has('crystals') && clases.has('nanites'),
      [...clases].sort().join(', '));
  }

  // =========================================================================
  //  9. QUEDABA AQUÍ, Y YA NO HAY NADA QUE MEDIR
  // =========================================================================
  //
  //  Aquí se comprobaba que un cristal caro subiera la probabilidad frente a uno
  //  barato: `crystalSuccessChance` con el multiplicador de un T1 y con el de un
  //  T10, y que los dos salieran distintos.
  //
  //  **MEDÍA QUE GASTAR UN CRISTAL MEJORADO VALÍA MÁS QUE GASTAR UNO BARATO**, que
  //  era la razón de ser de la tabla de diez niveles. Esa regla se borró a
  //  propósito al convertir el cristal en un recurso: con un solo cristal no hay
  //  "cuál gasto", y la probabilidad depende únicamente del nivel al que ya se está
  //  subiendo.
  //
  //  **POR QUÉ NO SE ADAPTA MANTENIENDO EL SIGNIFICADO.** Se podría escribir la
  //  misma comprobación contra `chanceDeSintonizacion`, pero contra dos números
  //  cualesquiera: no mediría nada, y además mediría una regla que el juego no
  //  tiene. Un banco que afirma comprobar algo que ya no existe es peor que un
  //  banco que no lo comprueba, porque el primero da verde mientras el jugador
  //  gasta creyendo en una elección que ya no puede hacer.
  //
  //  Lo que la sustituye está en el apartado 4, y sí mide la regla de hoy: la
  //  probabilidad baja con el nivel y no depende de nada que se pueda elegir.
  // =========================================================================

  // =========================================================================
  //  10. QUEDABA AQUÍ, Y SE HA IDO CON LAS LLAVES: SU LEYENDA ERA SU ALCANCE
  // =========================================================================
  //
  //  Aquí se comprobaba que cada llave dijera hasta qué nivel abría —"una llave
  //  T4 abre esta y las menores"— contra `KEY_DEFS` y `KEY_TIERS`. Con las
  //  llaves fuera ya no hay a qué alcance aspirar, así que la regla entera se va con
  //  ellas: no hay sustituto posible, porque el alcance de un objeto que ya no
  //  existe no se puede deducir de nada.
  //
  //  **LO QUE LO SUSTITUYE ESTÁ EN EL APARTADO 6**, y es más fuerte por un motivo
  //  concreto: aquí comparaba la leyenda de las llaves con la regla de las
  //  llaves, dos cosas que iban juntas. Ahora las llaves no existen y su leyenda no
  //  puede mentir porque no hay texto que leer. El texto que sí queda, el de las
  //  cajas, es el que el jugador tiene delante y el que **todavía podría estar
  //  hablando de llaves**, así que es el que hay que contrastar con la regla que
  //  ahora hay: la caja se abre sola.
  // =========================================================================

  // ---------------------------------------------------------------------------
  //  F51 · LA EXPLICACIÓN DE LOS AFIJOS DICE LA REGLA QUE EL JUEGO APLICA.
  //
  //  Es el quinto bloque de este banco por el mismo motivo que los otros cuatro:
  //  **una línea que describe una regla puede quedarse diciendo la regla vieja** y no
  //  hay forma de verlo leyendo el texto, porque el texto está bien escrito. Lo que lo
  //  delata es que el código haga otra cosa.
  //
  //  Y el que se encontró aquí era de los gordos. La forja decía "El recolector forjado
  //  hereda los afijos de la rareza de sus materiales", y son dos cosas falsas en una
  //  frase:
  //
  //    · **El suelo lo pone la rareza del item que sale**, no la de los materiales. Los
  //      materiales no tienen una rareza de afijos: tienen afijos, y de eso dan el techo.
  //    · **Lo que se hereda son los afijos en sí** —los buenos se transmiten de verdad—,
  //      no "los afijos de una rareza".
  //
  //  Un jugador que lo leyera y comprobara la forja con dos materiales sin afijos
  //  concluiría que la rareza no hace nada, y la rareza es justamente la mitad de la
  //  regla.
  // ---------------------------------------------------------------------------
  {
    // La explicación sale de la tabla, no de un número escrito aquí.
    const texto = explicacionDeAfijos();
    check('leyenda: la explicación de los afijos nombra el suelo de cada rareza',
      Object.entries(AFIX_MIN_POR_RARIDAD).every(([rareza, n]) => texto.includes(`${rareza} ${n}`)),
      texto);

    check('leyenda: y nombra el tope del juego, que es donde acaba la regla',
      texto.includes(String(AFIX_MAX)), texto);

    // **Y QUE DIGA "FORJADO", QUE NO ES UN ADVERBIO.** Los afijos solo los da la forja:
    // ni la tienda ni las cajas los dan, porque `pickAffixes()` es el único sitio que los
    // escribe. Un texto que dice "un Mítico lleva 4 afijos" sin ese matiz es una mentira
    // comprobable en diez segundos, y un jugador que pilla una mentira en un texto deja
    // de fiarse de los otros veinte.
    const conSuelo = fraseDeSueloDeAfijos('Mítico');
    check('leyenda: el suelo de afijos dice forjado y promete un mínimo con nombre y apellidos',
      conSuelo.includes('forjado') && conSuelo.includes('4'), conSuelo);

    // La rareza desconocida no tiene suelo: inventar uno sería peor que no decir nada.
    check('leyenda: una rareza que no existe no tiene suelo de afijos que explicar',
      fraseDeSueloDeAfijos('Rarisima') === '', JSON.stringify(fraseDeSueloDeAfijos('Rarisima')));

    // **Y QUE EL NÚMERO DE LA PANTALLA SEA LA MISMA PIEZA QUE USA LA REGLA.** No que
    // coincida con el resultado final —no puede, el suelo depende del dado— sino que sea
    // exactamente la parte que la regla llama "lo que arrastra el linaje". Es lo que
    // impide que la vista tenga su propia cuenta: el día que la media cambie, la vista y
    // la forja se separan en silencio.
    const conAfijos = (n: number) => [
      { affixes: Array.from({ length: n }, () => 'a') }, { affixes: [] as string[] }
    ];
    const desajustes: string[] = [];
    for (const [n, rareza] of [[0, 'Común'], [4, 'Legendario'], [6, 'Divino']] as const) {
      const m = conAfijos(n) as any;
      const rango = rangoDeAfijosForjados(m, rareza, false);
      // La regla, escrita con la aportación de la vista en medio: el suelo de la
      // rareza más lo que aportan los materiales, acotado por el tope del juego.
      //
      // **Y EL ACOTE IMPORTA CON UN DIVINO.** Su suelo ya es el tope entero, así que
      // sumar la aportación da más de seis y la regla se queda en seis. Por eso la
      // comprobación no es "más" sino "exactamente igual": un item con ocho afijos
      // sería el mismo bug que este, al revés.
      const esperado = Math.min(AFIX_MAX, (AFIX_MIN_POR_RARIDAD[rareza] ?? 0) + (aporteDeAfijos(m) ?? 0));
      if (rango.maximo !== esperado) desajustes.push(`${rareza}: la vista y la regla dan ${esperado} y ${rango.maximo}`);
    }
    check('leyenda: el número de afijos de la forja es la parte que usa la regla',
      desajustes.length === 0, desajustes.join(' | ') || 'aportación = parte de linaje de la regla');

    // Sin dos materiales no hay linaje: es preferible no enseñar nada a enseñar un cero.
    check('leyenda: sin dos materiales no se enseña una aportación de afijos',
      aporteDeAfijos([] as any) === null && aporteDeAfijos([{ affixes: [] }] as any) === null,
      String(aporteDeAfijos([] as any)));

    // **Y QUE NUNCA SE PASE DEL TOPE.** Con dos materiales de seis afijos cada uno la media
    // da seis, y el tope del juego es seis: no puede salir un siete por mucho que los
    // padres lleven, porque un item con siete afijos no existe.
    const tope = aporteDeAfijos([
      { affixes: Array.from({ length: 6 }, () => 'a') },
      { affixes: Array.from({ length: 6 }, () => 'a') }
    ] as any);
    check('leyenda: la aportación de afijos nunca pasa del tope del juego',
      tope === AFIX_MAX, `aportación=${tope} tope=${AFIX_MAX}`);
  }


  // ---------------------------------------------------------------------------
  //  LAS NOTAS DE PARCHE DICEN LO QUE SE VE, NO CÓMO ESTÁ HECHO
  //
  //  Es un banco de contenido, y su regla es la del encargo: **macro**. "Se añadieron
  //  doce logros nuevos" informa; "se subió el suelo de afijos de la rareza Mítica de tres
  //  a cuatro" solo le importa a quien mantiene el juego.
  //
  //  Y hay una razón de fondo para que la regla sea esta y no "que sean cortas": un
  //  commit log es exactamente una lista de cambios internos, y todo el mundo lo deja de
  //  leer al segundo commit. Un cartel de parche lleno de internals se vuelve ruido en la
  //  cuarta actualización, y un cartel que se ha vuelto ruido no vuelve a avisar de
  //  nada. Las tres comprobaciones de abajo son las tres formas de que esto se convierta
  //  en un commit log.
  // ---------------------------------------------------------------------------
  {
    const version = VERSION;
    const nota = notaDeEstaVersion();

    // 1) **HAY NOTA DE LA VERSIÓN QUE SE ESTÁ JUGANDO.** Sin esto el cartel no sale, y
    //    no sale en silencio: se ve bien que no sale. Publicar es subir la versión en
    //    `package.json` **y** añadir la línea aquí, y esta comprobación es la que avisa de
    //    que falta la segunda.
    check('notas: la versión del juego tiene su nota de parche',
      nota !== null, `${version} · ${NOTAS.length} notas, ninguna de ${version}`);
    check('notas: y la nota es la primera, que es la que se enseña',
      NOTAS[0]?.version === version, `primera=${NOTAS[0]?.version} version=${version}`);

    // 2) **LA VERSIÓN VIENE DE `package.json`.** El número del cartel no puede tener su
    //    propia copia: una constante escrita a mano se queda vieja el día que se sube la
    //    versión y nadie se entera, que es justo el fallo que este módulo vino a
    //    arreglar. La prueba es que coincidan, y la coincidencia es lo único que se
    //    comprueba —no reescribimos `package.json` desde un banco.
    // **Y NO HAY UNA COPIA DEL NÚMERO EN NINGÚN SITIO.** El módulo lo importa del
    // `package.json` del proyecto, así que la única forma de que el cartel diga una
    // versión que no es la del juego es que alguien escriba el número a mano en las
    // notas, y eso lo pilla el check de arriba. Comprobar que el módulo lee bien el
    // fichero no tiene sentido: leerían los dos el mismo —y el bundler de los bancos
    // sustituye `node:fs` por un stub, así que ni siquiera se podría.
    //
    // Y **la lista no tiene versiones repetidas**: dos notas con el mismo número
    // significan que se subió la versión dos veces sin decidir cuál se enseña, y
    // `find()` se quedaría con la primera sin decir nada.
    const versionesRepetidas = NOTAS.map(n => n.version).filter((v, k, l) => l.indexOf(v) !== k);
    check('notas: ninguna versión está repetida, y el número del cartel es el de la nota',
      versionesRepetidas.length === 0 && version === NOTAS[0]?.version,
      versionesRepetidas.length ? `repetidas: ${versionesRepetidas.join(',')}` : version);

    // 3) **NINGUNA NOTA HABLA DE CÓMO ESTÁ HECHO.** Las tres formas que se cuelan:
    //    un fichero, un identificador en camelCase y una función. Es una lista negra y no
    //    es perfecta —una nota podría decir "AFIX_MAX" sin querer y pasar si no está en
    //    la lista—, pero pilla las tres que se han colado, y **más importante**: hace que
    //    quien escribe la nota se pregunte si lo que va a escribir es para el jugador.
    const INTERNOS = /\b\w+\.(ts|tsx|css|html)\b|\b[a-z]+[A-Z][a-zA-Z]*\s*[(:=]|\bfunction\b|\bconst\b|\bif\s*\(/;
    const conInternos: string[] = [];
    for (const n of NOTAS) {
      for (const linea of n.lineas) {
        if (INTERNOS.test(linea)) conInternos.push(`${n.version}: "${linea}"`);
      }
    }
    check('notas: ninguna nota habla de ficheros, funciones ni identificadores internos',
      conInternos.length === 0, conInternos.slice(0, 2).join(' | ') || `${NOTAS.length} notas`);

    // Y el reverso, que es la regla de verdad: **cada nota es una frase, no un trozo de
    // commit.** Lo que se puede comprobar sin soit-máquina sobre si algo "se ve" son cuatro
    // cosas mecánicas, y son las cuatro que se rompen cuando alguien pega un diff:
    //
    //   · Que la línea sea una frase: empieza en mayúscula y acaba en punto.
    //   · Que no lleve cifras internas —un 12 %, un ×3, un "de 3 a 4"—. Las notas hablan
    //     de cosas que se ven, y un porcentaje es una regla, no una cosa que se vea.
    //   · Que no haya dos líneas iguales: una repetida es una línea que no dice nada.
    //   · Que la nota tenga un tamaño de nota: ni dos líneas ni cincuenta. Un cartel de
    //     parche con cincuenta líneas no se lee, y uno que no se lee no avisa de nada.
    //
    // Lo que **no** se comprueba es si cada línea nombra algo que exista en la pantalla:
    // eso no es decidible, y un banco que finge comprobarlo da la impresión de que
    // comprueba algo que no comprueba.
    const frases = NOTAS.flatMap(n => n.lineas.filter(
      l => !/^[A-ZÁÉÍÓÚÑ¿¡].*\.$/.test(l.trim())
    ));
    check('notas: cada línea es una frase, con mayúscula y punto',
      frases.length === 0, frases.slice(0, 2).join(' | ') || 'todas son frases');

    const conCifras = NOTAS.flatMap(n => n.lineas.filter(
      l => /\d\s*(%|x|×)|\bde\s+\d+\s+a\s+\d+/.test(l)
    ));
    check('notas: ninguna línea lleva una cifra interna',
      conCifras.length === 0, conCifras.slice(0, 2).join(' | ') || 'ninguna cifra');

    const repetidas = NOTAS.flatMap(n => {
      const vistas = n.lineas.filter((l, i) => n.lineas.indexOf(l) !== i);
      return vistas.map(l => `${n.version}: "${l}"`);
    });
    check('notas: y ninguna nota repite una línea',
      repetidas.length === 0, repetidas.slice(0, 2).join(' | ') || 'sin repeticiones');

    const cortas = NOTAS.filter(n => n.lineas.length < 3 || n.lineas.length > 12);
    check('notas: cada nota tiene tamaño de nota, ni dos líneas ni un changelog',
      cortas.length === 0,
      cortas.map(n => `${n.version}=${n.lineas.length} líneas`).join(', ')
        || NOTAS.map(n => `${n.version}=${n.lineas.length}`).join(' · '));

    // 4) **LA CASILLA DE AJUSTES EXISTE Y ES DE LOS AJUSTES.** Un cartel que no se puede
    //    desactivar es una decisión de diseño, no un ajuste, y el encargo la llamaba
    //    ajuste: tiene que haber un sitio donde apagarlo.
    check('notas: el ajuste existe y es una preferencia de las que se guardan',
      typeof getPatchNotes() === 'boolean' && typeof setPatchNotes === 'function',
      `por defecto=${getPatchNotes()}`);

    // 5) **LA MARCA DE "YA VISTO" GUARDA UNA VERSIÓN, NO UN "SÍ".** Con un booleano,
    //    desactivar y volver a activar las notas no las devolvería nunca, y un jugador
    //    que las apagó dos meses las perdería sin enterarse de que existían. Y como no
    //    se guarda nada al desactivar, reactivarlas muestra lo pendiente.
    const anterior = getNotasVistas();
    try {
      setNotasVistas(version);
      check('notas: la marca de visto guarda la versión y solo esa',
        getNotasVistas() === version, `guardado="${getNotasVistas()}"`);
    } finally {
      localStorage.setItem('cyberforge_patch_notes_visto', anterior);
    }
  }
  resumen('leyendas: cada texto dice la regla que el juego aplica');
}

export default main();