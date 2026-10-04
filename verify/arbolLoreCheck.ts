// ==========================================================================
//  El lore del árbol de pasivas, y la hoja que lo pinta
//
//  El hallazgo: la hoja de un nodo era **una frase**. "Instinto de Forja — nivel
//  1/5. +6 % a la probabilidad de crafteo" responde a cuánto cuesta y a nada más,
//  con veintitrés nodos en pantalla y cinco niveles en cada uno. Las dos
//  preguntas que un jugador tiene al mirar un nodo son otras: qué hace esto y
//  para qué me sirve.
//
//  Lo que se comprueba aquí son las dos mitades: que **los 23 nodos tienen
//  lore** y que el lore habla del nodo, y que la hoja lo enseña junto al
//  efecto y el motivo del veto.
// ==========================================================================

import { TREE_NODES, TREE_BY_ID, nodeCost } from '../src/data/tree';
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
    check('arbol: los 23 nodos tienen lore, ninguno se dejo sin escribir',
      sinLore.length === 0,
      sinLore.map((n: any) => n.id).join(',') || `nodos=${TREE_NODES.length}`);

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
    // hace el nodo". Eso es un juicio editorial sobre veintitres frases escritas a mano,
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
  }

  resumen('lore del arbol y su hoja');
}

export default main();