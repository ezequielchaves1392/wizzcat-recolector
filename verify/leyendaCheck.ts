import { check, resumen } from './kit';
import { TREE_NODES, TREE_BY_ID } from '../src/data/tree';
import { CRYSTAL_DEFS, KEY_DEFS, KEY_TIERS, crystalSuccessChance } from '../src/data/items';
import { CRATE_TYPES, COMPANION_SLOT_BUY } from '../src/data/store';
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
  //  4. LOS CRISTALES: LA "x" DE LA LEYENDA ES EL POWER
  // =========================================================================
  {
    const malos: string[] = [];
    for (const tier of Object.keys(CRYSTAL_DEFS)) {
      const def: any = (CRYSTAL_DEFS as any)[tier];
      const x = /x(\d+(?:[.,]\d+)?)/.exec(def.details);
      if (!x) { malos.push(`T${tier}: la leyenda no dice la x (${def.details})`); continue; }
      const dicho = Number(x[1].replace(',', '.'));
      if (Math.abs(dicho - def.power) > 1e-9) malos.push(`T${tier}: dice x${dicho} y su power es ${def.power}`);
    }
    check('leyenda: la x de cada cristal es su power',
      malos.length === 0, malos.join(' | ') || `${Object.keys(CRYSTAL_DEFS).length} cristales`);
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
  //  6. LAS CAJAS: SU LEYENDA NO ENUMERA EL BOTÍN
  // =========================================================================
  //  Ya estaba en `potencialCheck`, y es la regla de `data/store.ts`: la leyenda
  //  dice **qué la abre**, no qué trae.
  {
    const textos = Object.keys(CRATE_TYPES).map(t => (CRATE_TYPES as any)[t].details);
    const enumera = textos.filter(d => /cristal|compa|recolector|arma|nanitas/i.test(d));
    check('leyenda: la leyenda de las cajas no enumera el botín',
      enumera.length === 0, enumera[0] || `${textos.length} cajas`);
    check('leyenda: y las diez dicen la MISMA cosa, que es la prueba de que no es una copia',
      new Set(textos).size === 1, `${new Set(textos).size} textos distintos`);
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
  //  9. EL CRISTAL SIGUE MOVIENDO LA PROBABILIDAD
  // =========================================================================
  //  No es una leyenda, es el suelo: si el cristal no moviera nada, el sintonizador
  //  sería una tirada que no tiene nada que ver con lo que se gasta.
  {
    const conT1 = crystalSuccessChance(10, CRYSTAL_DEFS[1].power);
    const conT10 = crystalSuccessChance(10, CRYSTAL_DEFS[10].power);
    check('leyenda: el cristal sigue moviendo la probabilidad, no es decorativo',
      conT1 !== conT10, `T1=${conT1} T10=${conT10}`);
  }

  // =========================================================================
  //  10. LAS LLAVES: SU LEYENDA ES SU ALCANCE
  // =========================================================================
  {
    const malos: string[] = [];
    for (const tier of KEY_TIERS) {
      const def: any = (KEY_DEFS as any)[tier];
      // Una llave de tier n abre n cajas. Todas menos la T1 tienen que decirlo.
      if (tier > 1 && !def.details.includes('menor')) {
        malos.push(`T${tier} abre ${tier} cajas y su leyenda no lo dice`);
      }
    }
    check('leyenda: cada llave dice hasta dónde abre',
      malos.length === 0, malos.join(' | ') || `${KEY_TIERS.length} llaves`);
  }

  resumen('leyendas: cada texto dice la regla que el juego aplica');
}

export default main();