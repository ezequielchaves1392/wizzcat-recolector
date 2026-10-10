// ==========================================================================
//  El lore del árbol de pasivas, y la hoja que lo pinta
//
//  El hallazgo: la hoja de un nodo era **una frase**. "Instinto de Forja — nivel
//  1/5. +6 % a la probabilidad de crafteo" responde a cuánto cuesta y a nada más,
//  con veintidós nodos en pantalla y cinco niveles en cada uno. Las dos
//  preguntas que un jugador tiene al mirar un nodo son otras: qué hace esto y
//  para qué me sirve.
//
//  Lo que se comprueba aquí son las dos mitades: que **todos los nodos tienen
//  lore** y que el lore habla del nodo, y que la hoja lo enseña junto al
//  efecto y el motivo del veto.
// ==========================================================================

import { TREE_NODES, TREE_BY_ID, nodeCost } from '../src/data/tree';
import { UMBRAL_PUNTOS_RAMA } from '../src/data/prestige';
import { aggregateBonuses } from '../src/data/prestige';
import { nodeSheetHTML } from '../src/ui/prestigePage';
import { check, resumen } from './kit';

async function main() {
  // -------------------------------------------------------------------------
  //  1. EL LORE, Y QUE SEA DE CADA NODO
  // -------------------------------------------------------------------------
  {
    // **TODOS LOS NODOS TIENEN LORE, Y NO ES UNA OPCIONAL QUE SE PUEDA OLVIDAR.**
    // Es opcional en el tipo porque `TreeNode` lo declara para un bucle genérico, pero
    // un nodo sin lore deja un hueco justo donde debería estar la frase que explica
    // para qué sirve, y un hueco en la hoja es peor que no tener el bloque: el resto
    // sube y parece un fallo de maquetación.
    const sinLore = TREE_NODES.filter((n: any) => !n.lore || !String(n.lore).trim());
    check('arbol: todos los nodos tienen lore, ninguno se dejo sin escribir',
      sinLore.length === 0,
      sinLore.map((n: any) => n.id).join(',') || `nodos=${TREE_NODES.length}`);

    // **`offline_ops` YA NO ESTÁ, Y `full_automation` SIGUE TENIENDO PUERTA.**
    // El nodo de Operaciones Offline se sacó del árbol (prometía ingreso sin
    // mirar y nunca se consumía), y `full_automation` lo tenía como requisito:
    // sin cambiarle la puerta quedaba inalcanzable para quien no lo tuviera.
    check('arbol: offline_ops ya no está en el árbol',
      !TREE_NODES.some((n: any) => n.id === 'offline_ops') && TREE_BY_ID.offline_ops === undefined,
      'sigue en el catálogo');
    check('arbol: full_automation se abre sin offline_ops, por su propia rama',
      (TREE_BY_ID.full_automation?.requires ?? []).includes('auto_clicker2')
        && !(TREE_BY_ID.full_automation?.requires ?? []).includes('offline_ops'),
      `requires=${JSON.stringify(TREE_BY_ID.full_automation?.requires)}`);

    // Y que **no sean todos el mismo texto**, que es como se cumple un campo a base de
    // copiar y pegar sin mirar. Es la comprobación que hace la ley de un campo
    // obligatorio: que tener todos el valor no vale.
    const lores = new Set(TREE_NODES.map((n: any) => n.lore));
    check('arbol: cada nodo tiene su propio lore',
      lores.size === TREE_NODES.length,
      `distintos=${lores.size} de ${TREE_NODES.length}`);

    // **EL LORE NO ES LA DESCRIPCIÓN COPIADA.** Un campo obligatorio se cumple
    // escribiendo cualquier cosa en él, y lo que sale es un nodo con el texto de la función
    // pegado dos veces y media hoja desperdiciada en repetirlo.
    const repetidos = TREE_NODES.filter((n: any) => String(n.lore).trim() === String(n.description).trim());
    check('arbol: ningun lore es la descripcion copiada',
      repetidos.length === 0,
      repetidos.map((n: any) => n.id).join(','));

    // Y que **tengan largo de frase y no de nota**: ni una palabra suelta que ocupa la
    // caja de un párrafo entero, ni un párrafo que empuja el botón de comprar fuera de la
    // pantalla en un móvil. El techo es de lo que cabe; el suelo, de que se lea.
    const cortos = TREE_NODES.filter((n: any) => String(n.lore).trim().length < 30);
    const largos = TREE_NODES.filter((n: any) => String(n.lore).trim().length > 160);
    check('arbol: el lore tiene largo de frase, ni nota ni parrafo',
      cortos.length === 0 && largos.length === 0,
      `cortos=${cortos.map((n: any) => n.id).join(',')} largos=${largos.map((n: any) => n.id).join(',')}`);

    // **LO QUE ESTE BANCO NO PUEDE AFIRMAR, Y NO AFIRMA:** que el lore "hable de lo que
    // hace el nodo". Eso es un juicio editorial sobre veintidós frases escritas a mano,
    // y una prueba que lo exigiera seria una prueba que estropea las frases para poder
    // comprobarlas: obligaria a repetir la mecanica dentro del sabor. Lo que si se
    // comprueba es lo de arriba --que existe, que es de cada nodo, que no repite la
    // funcion y que cabe-- y lo demas lo lee el que lo escribe.
  }

  // -------------------------------------------------------------------------
  //  2. LA HOJA, Y CADA BLOQUE EN SU SITIO
  // -------------------------------------------------------------------------
  {
    const nodo: any = TREE_BY_ID['forge_luck'];
    const comprable = nodeSheetHTML(nodo, 0, { ok: true, coste: nodeCost(nodo, 0), cores: 10 });

    check('arbol hoja: el nombre va en grande y en la tipografia de titulo',
      comprable.includes(nodo.name) && /Orbitron/.test(comprable),
      comprable.slice(0, 160));

    // **EL LORE SALE ENTRECOMILLADO, COMO EL DE LOS ITEMS DEL ALMACÉN.** Es la misma
    // clase de cosa —una frase sobre el objeto que estás mirando— y por eso se
    // escribe igual, para que el jugador la lea como la lee la otra.
    check('arbol hoja: el lore sale entrecomillado',
      /[“”]/.test(comprable),
      /[“”]/.test(comprable) ? 'comillas' : 'sin comillas');
    check('arbol hoja: y es el lore de ESE nodo, no el de otro',
      comprable.includes(nodo.lore),
      comprable.includes(nodo.lore) ? nodo.lore : 'no esta');

    // El efecto con su cifra. El nombre del nodo no dice para qué sirve: "Alcornoque"
    // no dice que son cristales de consolación.
    check('arbol hoja: el efecto sale con su cifra, no solo el nombre',
      /forja/i.test(comprable),
      'busca "forja" en ' + (comprable.includes('forja') ? 'la hoja' : 'la hoja: NO'));
    // **Y QUE DIGA QUE ES POR NIVEL, QUE ES LO QUE FALTABA.** El número que sale del
    // `bonus` del catálogo es el de UN nivel, y sin decirlo la hoja parece prometer el
    // total: un nodo en 7 con "+8 %" se lee como 8 y son 56.
    check('arbol hoja: el efecto dice que es por nivel',
      /por nivel/i.test(comprable),
      /por nivel/i.test(comprable) ? 'lo dice' : 'no lo dice: el +N se lee como el total');

    // El coste y el nivel, cada uno en su pastilla: son las dos preguntas que se
    // hacen al mirar, y una frase larga las mezcla con el resto.
    check('arbol hoja: el nivel y el coste salen en bloque propio',
      /Nivel 1\/5/.test(comprable) && /◆/.test(comprable),
      `nivel=${/Nivel 1\/5/.test(comprable)} coste=${/◆/.test(comprable)}`);

    // --- El veto, que es el caso para el que el diálogo existe ---
    // **Un nodo que no se puede pagar es el que más información necesita**, porque es el
    // que el jugador está mirando para decidir si vale la pena seguir. Por eso el
    // diálogo se abría siempre. Y el motivo va **encima de todo y en su propio color**:
    // debajo del lore se lee después de la explicación y parece una nota al pie.
    const bloqueado = nodeSheetHTML(nodo, 0, {
      ok: false, reason: 'Faltan 3 núcleos', coste: nodeCost(nodo, 0), cores: 0
    });
    check('arbol hoja: el motivo del veto aparece, y con el texto que dio el motor',
      bloqueado.includes('Todavía no') && bloqueado.includes('Faltan 3 núcleos'),
      bloqueado.slice(-200));
    check('arbol hoja: el veto va en su color, no en el del texto normal',
      bloqueado.includes('#f87171'),
      bloqueado.includes('#f87171') ? '#f87171' : 'sin color');
    check('arbol hoja: el lore sale TAMBien cuando no se puede pagar',
      bloqueado.includes(nodo.lore),
      bloqueado.includes(nodo.lore) ? 'sale' : 'no sale');
    // Y el motivo no puede sustituir al lore por un texto genérico: es el dato que el
    // motor calculó y no uno escrito al lado.
    check('arbol hoja: el veto no es un texto fijo sino el motivo del motor',
      !bloqueado.includes('no está disponible') &&
        bloqueado.includes('Faltan 3 núcleos'),
      bloqueado.includes('no está disponible') ? 'SALTA: sale el texto por defecto' : 'ok');

    // El tope: un nodo al máximo lo dice, en vez de ofrecer comprar un nivel que ya no
    // existe. El botón se apaga por `confirmDisabled` cuando no se puede, pero la hoja
    // tiene que decirlo también.
    const tope = nodeSheetHTML(TREE_BY_ID['core_sink'], 10, { ok: true, coste: 0, cores: 999 });
    check('arbol hoja: un nodo al maximo lo dice, y no ofrece un nivel 11',
      /Nivel máximo/.test(tope) && !/Nivel 11/.test(tope),
      `maximo=${/Nivel máximo/.test(tope)} once=${/Nivel 11/.test(tope)}`);

    // **Y QUE EL LORE NO SE INVENTE UNA PANTALLA ENTERA CUANDO NO HAY LORE.** Un nodo
    // sin lore tiene que salir sin el bloque, no con un `undefined` ni con comillas
    // vacías: es la forma de que un campo opcional no rompa la hoja el día que alguien
    // añada un nodo y se olvide de la frase.
    const sinLore: any = { ...TREE_BY_ID['core_sink'], lore: undefined };
    const hojaVacia = nodeSheetHTML(sinLore, 0, { ok: true, coste: 1, cores: 5 });
    check('arbol hoja: un nodo sin lore sale sin el bloque, no con undefined',
      !hojaVacia.includes('undefined') && !/[“”]/.test(hojaVacia),
      hojaVacia.includes('undefined') ? 'SALTA: undefined en la hoja' : 'ok');

    // **LO ACUMULADO, Y LA INVARIENTE QUE LO SOSTIENE.**
    //
    // El número de un nivel salía de `bonusLabel(k, v)` sobre el `bonus` del catálogo,
    // y con el nodo en 7 eso pinchaba el +8 % del nivel 1. La hoja ahora enseña las tres
    // cifras —un nivel, ahora, y al siguiente— y lo que hay que atar es que **la del
    // medio sea la que da el motor**, no una multiplicación hecha en la vista.
    //
    // Y por qué importa tanto atarlo: la hoja es donde el jugador decide si sube. Si
    // el "ahora" no es el número que el agregador aplica, la pantalla está prometen-
    // do un efecto que la partida no cobra — y eso es la clase de bug que R3 dice que
    // no puede pasar, en la pantalla donde más caro sale equivocarse.
    const conNivel = nodeSheetHTML(TREE_BY_ID['core_sink'], 7, { ok: true, coste: 0, cores: 999 });
    const bonusNodo: any = TREE_BY_ID['core_sink'].bonus;
    // El agregado REAL del motor con ese nodo a nivel 7 y nada más comprado. El nodo
    // es `Sumidero de Núcleos`, que da `passiveMult` — y la primera versión de esta
    // comprobación preguntó por `coreGain` y comparó dos ceros: una prueba que pasa
    // porque mira un campo que el nodo no tiene.
    const agregado: any = aggregateBonuses({ core_sink: 7 });
    const aportaNodo: number = agregado.passiveMult ?? 0;
    const esperado = Math.round((bonusNodo.passiveMult ?? 0) * 7 * 100);

    check('arbol hoja: con nivel comprado sale la fila "Ahora (nivel N)"',
      /Ahora \(nivel 7\)/.test(conNivel),
      /Ahora \(nivel 7\)/.test(conNivel) ? 'sale' : 'no sale la fila del acumulado');
    check('arbol hoja: el acumulado no es cero, que sería una prueba que no mira nada',
      esperado > 0 && aportaNodo > 0,
      `esperado=${esperado} motor=${aportaNodo * 100} bonus=${JSON.stringify(bonusNodo)}`);
    check('arbol hoja: y el acumulado es el que aporta el motor, no la vista',
      conNivel.includes(`+${esperado}%`) && Math.round(aportaNodo * 100) === esperado,
      `hoja=+${esperado}% motor=${aportaNodo * 100}%`);
    check('arbol hoja: y el siguiente nivel se enseña tambien',
      /Al nivel 8/.test(conNivel),
      /Al nivel 8/.test(conNivel) ? 'sale' : 'no sale');
    // Con nivel 0 no hay "ahora": sería "+0", que es ruido en un nodo sin comprar.
    const sinNivel = nodeSheetHTML(TREE_BY_ID['core_sink'], 0, { ok: true, coste: 1, cores: 0 });
    check('arbol hoja: sin nivel no hay fila "Ahora", que seria un +0',
      !/Ahora \(/.test(sinNivel),
      /Ahora \(/.test(sinNivel) ? 'SALTA: la fila sale con nivel 0' : 'ok');
  }

  // -------------------------------------------------------------------------
  //  EL NIVEL EFECTIVO TOPA EN EL MÁXIMO (F97)
  // -------------------------------------------------------------------------
  //  Si un techo baja —`full_automation` pasó de 5 niveles a 3—, quien tenga
  //  niveles de más los conserva guardados pero no cobran: una partida vieja no
  //  puede rendir por encima del techo que la hoja enseña. Lo que se comprueba
  //  es el agregador, que es el único que convierte niveles en bonus.
  {
    const capado: any = aggregateBonuses({ full_automation: 5 });
    check('arbol: un nivel por encima del maximo cobra como el maximo, no mas',
      capado.autoClick === 3, `autoClick=${capado.autoClick} (techo=3)`);
    const dentro: any = aggregateBonuses({ full_automation: 2 });
    check('arbol: y por debajo del maximo cada nivel cuenta',
      dentro.autoClick === 2, `autoClick=${dentro.autoClick}`);
  }

  // -------------------------------------------------------------------------
  //  LA ESTRUCTURA DE LAS CUATRO RAMAS (F97)
  // -------------------------------------------------------------------------
  //  El árbol se lee por pestañas y cada pestaña enseña solo su rama: un
  //  requisito de otra rama obligaría a comprar a ciegas lo que no se ve. Lo
  //  que se comprueba es la estructura que lo sostiene: requisitos dentro de
  //  la rama, una raíz comprable en cada una y umbrales que suben por tier.
  {
    const porId: Record<string, any> = Object.fromEntries(TREE_NODES.map(n => [n.id, n]));
    const cruzados = TREE_NODES.filter(n =>
      (n.requires ?? []).some((r: string) => porId[r] && porId[r].category !== n.category));
    check('ramas: ningun requisito cruza de rama (la pestaña enseña lo exigible)',
      cruzados.length === 0, cruzados.map(n => n.id).join(',') || 'ninguno cruza');

    const ramas = [...new Set(TREE_NODES.map(n => n.category))];
    const sinRaiz = ramas.filter(rama =>
      !TREE_NODES.some(n => n.category === rama && n.tier === 0 && (n.requires ?? []).length === 0));
    check('ramas: cada rama tiene una raiz comprable sin puntos ni requisitos',
      ramas.length === 4 && sinRaiz.length === 0,
      `ramas=${ramas.join(',')} sin raiz=${sinRaiz.join(',') || 'ninguna'}`);

    const tiers = [0, 1, 2, 3, 4, 5, 6].map(t => UMBRAL_PUNTOS_RAMA[t] ?? -1);
    check('ramas: los umbrales empiezan en cero y suben por tier',
      tiers[0] === 0 && tiers.every((u, i) => i === 0 || u > tiers[i - 1]),
      `umbrales=${tiers.join(',')}`);
  }

  resumen('lore del arbol y su hoja');
}

export default main();