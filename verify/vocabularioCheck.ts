// ==========================================================================
//  Q1 · EL VOCABULARIO DEL JUGADOR: LA LISTA DE PALABRAS QUE NO PUEDEN VOLVER
// ==========================================================================
//
//  **POR QUÉ EXISTE ESTE BANCO Y NO UNA REVISIÓN A MANO.** El 10 de octubre el
//  jugador pidió unificar el vocabulario: "clic" y "click" eran la misma acción
//  escrita de dos formas, "daño", "potencia de click" e "ingreso pasivo" nombraban
//  la misma magnitud que ya se llamaba "recolección por click" y "recolección por
//  segundo". En esa pasada se tocaron veinticuatro ficheros. **La lista de palabras
//  prohibidas solo vive en una conversación si no vive aquí**: el siguiente texto que
//  alguien escriba, con la palabra vieja y sin acordarse, llega a la pantalla y
//  nadie se entera hasta que el jugador vuelve a quejarse. Este banco es la lista.
//
//  **Y MIRA TEXTOS, NO CÓDIGO.** Los identificadores no entran: `'clics'` sigue
//  siendo la clave del ranking, `passiveBoost` sigue siendo el campo del guardado y
//  `clickPorForja` sigue siendo la clave del bono. Renombrarlos cambiaría el
//  guardado de las partidas que ya existen, y no lo leen ni un jugador ni un
//  rótulo. Aquí solo entran los campos que acaban en pantalla: `name`,
//  `description`, `details`, `titulo`, `lineas`, `rewardText`, `porQue`, `lore`,
//  `label`, `texto`, `etiqueta`.
//
//  **Y POR QUÉ NO SE COMPRUEBA SOBRE LA PANTALLA.** Los bancos no prueban DOM (R19):
//  esto es un banco de datos, y los datos son los que se pintan. Un rótulo que
//  existe en un módulo de datos existe en la wiki, en la ficha, en el árbol y en el
//  toast del mismo golpe, y comprobarlo aquí cuesta lo mismo que comprobarlo en una
//  pantalla y no se rompe con un render.
// ==========================================================================

import { check, resumen } from './kit';
import { TREE_NODES } from '../src/data/tree';
import { AFFIXES } from '../src/data/crafting';
import { LORE, lineaTipoCompanion } from '../src/data/tiers';
import { CONSUMABLES_SIN_EXPANSOR, CRATE_TYPES, STORE_ITEMS, EXPANSOR_TIERS } from '../src/data/store';
import { DESCRIPTIONS as TIENDA } from '../src/components/store';
import { BUFF_LABELS, type BuffKey } from '../src/data/buffs';
import { COSMETICS } from '../src/data/cosmetics';
import { NOTAS } from '../src/data/patchNotes';
import { ACHIEVEMENTS } from '../src/achievements';
import { LOGROS_DIFICILES } from '../src/data/achievements';
import { bonusLabel } from '../src/ui/bonusLabels';
import { baseSimHTML, arbolSimHTML } from '../src/ui/wikiTools';

type Texto = { donde: string; dice: string };

/** Los campos que acaban en pantalla. Todo lo demás es interno y no se mira. */
const EN_PANTALLA = new Set([
  'name', 'description', 'details', 'detail', 'what', 'titulo', 'lineas', 'title',
  'rewardText', 'porQue', 'lore', 'label', 'texto', 'etiqueta'
]);

/**
 * Recoge **todos** los campos de texto de un objeto, sin tener que enumerarlos a
 * mano. Un `CONSUMABLES_SIN_EXPANSOR` tiene `name` y `details`, un `NOTAS` tiene
 * `titulo` y `lineas`, y enumerar campo a campo es la forma de que el siguiente que
 * se añada no se compruebe: si está en el objeto y el campo es de los de arriba,
 * entra.
 *
 * **Y `campo` SE ARRASTRA A TRAVÉS DE LOS ARRAYS, QUE ES LO QUE COSTÓ ENCONTRAR.**
 * `lineas` es un campo de texto que trae varios, y la primera versión bajaba al
 * array perdiendo el nombre del campo del que venía: las sesenta notas enteras
 * quedaban fuera del barrido y el banco seguía saliendo limpio. Una prueba que no
 * mira lo que cree que mira es peor que no tener prueba, y solo se ve comparando
 * cuánto encuentra —por eso la primera comprobación de este banco cuenta textos.
 */
function recoger(campo: string | null, valor: any, origen: string, fuera: Texto[]): void {
  if (typeof valor === 'string') {
    if (campo && EN_PANTALLA.has(campo)) fuera.push({ donde: origen, dice: valor });
    return;
  }
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => recoger(campo, v, `${origen}[${i}]`, fuera));
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) recoger(k, v, `${origen}.${k}`, fuera);
  }
}

/**
 * Lo que NO se puede decir ya, y **por qué cada una está aquí**. La regla es una y
 * se escribe una vez: dos ortografías para la misma acción son dos respuestas
 * distintas a la pregunta "¿qué hace mi dedo?", y el jugador con dos dudas decide
 * en función de la que leyó la última.
 */
const PROHIBIDAS: Array<{ que: string; re: RegExp; por: string }> = [
  {
    que: 'clic con esa ortografía',
    re: /clic(?!k)/i,
    por: 'Una acción con dos ortografías es una acción con dos nombres. Siempre "click".'
  },
  {
    que: 'daño',
    re: /dañ|\bdano\b/i,
    por: 'El número del recolector es "recolección por click": "daño" es la palabra del interno.'
  },
  {
    que: 'ingreso',
    re: /ingreso/i,
    por: '"Ingreso" mezcla lo que da el dedo con lo que dan los compañeros en un solo nombre.'
  },
  {
    que: 'salto',
    re: /\bsalto/i,
    por: 'Lo que salta es el premio: en pantalla eso es "Ítem T{n} siguiente".'
  },
  {
    que: 'potencia o poder de click',
    re: /potencia de click|poder de click|poder por click|poder de recolecci/i,
    por: 'La magnitud del recolector es "recolección por click", ni potencia ni poder.'
  },
  {
    que: 'producción o pasivo como magnitud',
    re: /producci.n por segundo|producci.n en pasivo|en pasivo|por pasivo/i,
    por: 'Lo que dan los compañeros se llama "recolección por segundo".'
  },
  {
    que: 'multiplier, la palabra inglesa',
    re: /multiplier/i,
    por: 'Si el tipo del compañero se enseña en castellano, que es "multiplicador", no en la clave del código.'
  }
];

/**
 * El corpus entero, **y cuánto aporta cada fuente**.
 *
 * Los dos van juntos a propósito: la primera versión de este barrido perdió las
 * notas de parche enteras —`lineas` es un array, y al bajar al array se perdía el
 * nombre del campo— y el banco seguía en verde, porque "hay textos que mirar" se
 * cumplía con los otros quinientos. Contar por fuente y poner un mínimo a cada una
 * es lo que convierte un fallo silencioso en un fallo con nombre.
 */
function corpusDe(): { textos: Texto[]; porFuente: Record<string, number> } {
  const textos: Texto[] = [];
  const porFuente: Record<string, number> = {};
  const anadir = (fuente: string, nuevos: Texto[]) => {
    porFuente[fuente] = (porFuente[fuente] ?? 0) + nuevos.length;
    textos.push(...nuevos);
  };
  const meter = (fuente: string, valor: any) => {
    const t: Texto[] = [];
    recoger(null, valor, fuente, t);
    anadir(fuente, t);
  };

  meter('arbol', TREE_NODES);
  meter('afijos', AFFIXES);
  meter('consumibles', CONSUMABLES_SIN_EXPANSOR);
  meter('cajas', CRATE_TYPES);
  meter('tienda', STORE_ITEMS);
  meter('fichasTienda', TIENDA);
  meter('expansores', EXPANSOR_TIERS);
  meter('cosmeticos', COSMETICS);
  meter('notas', NOTAS);
  meter('logros', ACHIEVEMENTS);
  meter('logrosDificiles', LOGROS_DIFICILES);

  // **LOS DOS MAPAS DE TEXTO PURO, A MANO.** Su clave no es un campo de texto sino
  // el nombre de un tier o el de un buff, así que `recoger` los descartaría: aquí
  // el valor entero es el texto y se entra sabiéndolo.
  anadir('lore', Object.entries(LORE).map(([k, v]) => ({ donde: `lore.${k}`, dice: v })));
  anadir('buffs', Object.entries(BUFF_LABELS).map(([k, v]) => ({ donde: `buffs.${k}`, dice: v })));

  // **LOS TEXTOS QUE NO SON DATOS SINO QUE SALEN DE UNA FUNCIÓN.** La línea del
  // compañero y las etiquetas de bono viven en funciones, así que no están en
  // ningún objeto: hay que llamarlas.
  anadir('lineaCompanion', ['multiplier', 'passive', 'click'].map(tipo => ({
    donde: `lineaTipoCompanion(${tipo})`, dice: lineaTipoCompanion(tipo, 0.5)
  })));
  const bonus = [...new Set(TREE_NODES.flatMap((n: any) => Object.keys(n.bonus ?? {})))];
  anadir('bonos', bonus.map(clave => ({
    donde: `bonusLabel(${clave})`, dice: bonusLabel(clave as any, 0.2)
  })));

  // **LA WIKI, PINTADA DE VERDAD.** El jugador pidió que la wiki dijera las cosas
  // con las palabras nuevas, y su texto no está en un módulo de datos: se genera.
  // Aquí se le quitan las etiquetas para quedarse con lo que se lee, porque dentro
  // de una etiqueta hay atributos (`value="multiplier"`) que no son texto. Y si el
  // pintador lanzara una excepción, la fuente queda en 0 y cae su mínimo: el
  // "pintado" no puede dejar de comprobarse en silencio.
  const pintores: Array<[string, () => string]> = [
    ['simuladorBase', baseSimHTML], ['simuladorArbol', arbolSimHTML]
  ];
  for (const [nombre, pinta] of pintores) {
    try {
      const pintado = pinta().replace(/<[^>]*>/g, ' ').trim();
      anadir(nombre, pintado ? [{ donde: nombre, dice: pintado }] : []);
    } catch {
      anadir(nombre, []);
    }
  }

  return { textos, porFuente };
}

/**
 * Cuánto tiene que haber de cada fuente, y **por qué ese número y no otro**.
 *
 * No son números redondos: son lo que cada módulo lleva escrito hoy, redondeado
 * hacia abajo. Si un día `recoger` vuelve a perder un campo —que es lo que le pasó
 * a las notas—, la fuente correspondiente cae por debajo de su mínimo y el fallo
 * dice de qué fichero habla en vez de aprobar en silencio.
 */
const MINIMOS: Record<string, number> = {
  arbol: 100, afijos: 20, consumibles: 15, cajas: 20, tienda: 10, fichasTienda: 25,
  expansores: 3, cosmeticos: 60, notas: 200, logros: 60, logrosDificiles: 10, lore: 50,
  buffs: 8, lineaCompanion: 3, bonos: 20, simuladorBase: 1, simuladorArbol: 1
};

/**
 * Excepciones escritas a mano: **texto exacto, palabra prohibida exacta, y su
 * motivo.** Solo hay una, y es la prueba de que la regla es una regla y no un
 * capricho: la palabra "salto" sigue existiendo en español con otro significado —en
 * una nota de rendimiento, un salto de lecturas es un salto de contador, no el salto
 * de tier de la caja—, y meterla en la misma lista que el "Salto" de la wiki
 * obligaría a reescribir una frase histórica que está diciendo la verdad.
 *
 * Se apunta **el texto entero y no su posición**: el índice se mueve cada vez que
 * entra una nota nueva por arriba, y una excepción que apunta a la línea equivocada
 * deja de proteger a nadie sin que nadie lo vea. Y el banco comprueba además que
 * cada excepción siga correspondiendo a un texto real: si alguien edita la frase,
 * la excepción queda huérfana y el fallo obliga a volver a mirarla.
 */
const EXCEPTOS: Array<{ que: string; dice: string; porque: string }> = [
  {
    que: 'salto',
    dice: 'Abrir el ranking trae muchas lecturas de golpe y es normal: ese salto no es un pico.',
    porque: 'salto de un contador de red, no el salto de tier de la caja'
  }
];

async function main() {
  const { textos: corpus, porFuente } = corpusDe();

  // **CADA FUENTE TIENE LO SUYO, Y ESTE ES EL CHECK QUE PESA.** "Hay textos que
  // mirar" se cumplía con quinientos mientras las notas enteras no entraban; un
  // mínimo por fuente hace que el fallo diga de dónde ha desaparecido el texto.
  const cortas = Object.entries(MINIMOS)
    .filter(([fuente, min]) => (porFuente[fuente] ?? 0) < min)
    .map(([fuente, min]) => `${fuente}=${porFuente[fuente] ?? 0} (mínimo ${min})`);
  check('vocabulario: cada fuente aporta los textos que tiene escritos',
    cortas.length === 0,
    cortas.join(' · ')
    || Object.entries(porFuente).sort((a, b) => b[1] - a[1])
      .map(([f, n]) => `${f} ${n}`).join(' · '));

  for (const prohibida of PROHIBIDAS) {
    const manchas = corpus.filter(t =>
      prohibida.re.test(t.dice) && !EXCEPTOS.some(e => e.que === prohibida.que && e.dice === t.dice));
    check(`vocabulario: ningún texto dice "${prohibida.que}"`,
      manchas.length === 0,
      manchas.slice(0, 6).map(m => `${m.donde}="${m.dice.slice(0, 60)}"`).join(' · ')
      || `limpio (${corpus.length} textos mirados)`);
  }

  // **Y QUE NINGUNA EXCEPCIÓN SE HAYA QUEDADO SIN TEXTO.** Una excepción huérfana
  // es una protección que ya no protege a nada: o la frase se editó —y hay que
  // volver a decidir si la palabra todavía es lícita— o la lista creció sin que
  // nadie la mirara.
  const huerfanas = EXCEPTOS.filter(e => {
    const regla = PROHIBIDAS.find(p => p.que === e.que);
    return !regla || !corpus.some(t => t.dice === e.dice && regla.re.test(t.dice));
  });
  check('vocabulario: cada excepción sigue apuntando a un texto que existe',
    huerfanas.length === 0,
    huerfanas.map(e => `"${e.dice.slice(0, 50)}"`).join(' · ')
    || EXCEPTOS.map(e => `${e.que}: ${e.porque}`).join(' · '));

  // **Y QUE LA REJILLA NO ESTÉ PINTADA DE VERDE.** Una expresión regular que no
  // sabe distinguir "click" de "clics" aprobaría las dos cosas y no diría nada,
  // así que la regla se comprueba contra la regla: si un día alguien "arregla" la
  // lista cambiando el patrón por uno que no cazca nada, esto cae antes que el
  // resto.
  check('vocabulario: la lista de prohibidas sabe distinguir "click" de "clics"',
    PROHIBIDAS[0].re.test('Cien mil clics. Ni uno desperdiciado.')
    && !PROHIBIDAS[0].re.test('Seis mil clicks y sigue contando')
    && PROHIBIDAS[2].re.test('un 12% de ingreso pasivo')
    && !PROHIBIDAS[2].re.test('recolección por segundo'),
    'la rejilla no caza la palabra vieja');

  // **Y QUE LAS PALABRAS NUEVAS SIGAN DONDE TUVIERON QUE ESTAR.** Lo contrario de
  // arriba: si mañana alguien borra las descripciones del árbol enteras, la
  // comprobación de arriba sigue pasando y no habrá dicho nada. Estas dos líneas
  // son la red.
  const tira = corpus.map(t => t.dice).join('\n').toLowerCase();
  check('vocabulario: "recolección por click" está en el juego, que es el nombre del recolector',
    tira.includes('recolección por click'),
    `aparece ${(tira.match(/recolección por click/g) ?? []).length} veces`);
  check('vocabulario: "recolección por segundo" está en el juego, que es el nombre de los compañeros',
    tira.includes('recolección por segundo'),
    `aparece ${(tira.match(/recolección por segundo/g) ?? []).length} veces`);
  check('vocabulario: y "click" aparece por lo menos en diez textos',
    (tira.match(/click/g) ?? []).length >= 10,
    `aparece ${(tira.match(/click/g) ?? []).length} veces`);

  // =========================================================================
  //  EL LOGRO PROMETE LO QUE SU NÚMERO COBRA
  // =========================================================================
  //  No es solo una cuestión de palabras: es que **el texto diga la magnitud que
  //  `reward` aplica**. Un logro que da `clickBonus` y anuncia "recolección por
  //  segundo" (o viceversa) está mintiendo con el vocabulario que acabamos de
  //  unificar, y este es el único sitio donde se miran las dos cosas juntas.
  {
    const malos = ACHIEVEMENTS.filter((a: any) => {
      const texto = String(a.rewardText ?? '').toLowerCase();
      const r = a.reward ?? {};
      if (r.clickBonus && !texto.includes('click')) return true;
      if (r.passiveBonus && !texto.includes('segundo')) return true;
      return false;
    });
    check('vocabulario: el texto de cada logro nombra la magnitud que su número da',
      malos.length === 0,
      malos.map((a: any) => `${a.id}="${a.rewardText}"`).join(' · ') || 'los 43 cuadran');
  }

  // =========================================================================
  //  LOS OCHO NOMBRES DE BUFF: NINGUNO REPITE LA PALABRA VIEJA
  // =========================================================================
  //  Es el único texto que existe en DOS sitios (el dialogo que lo confirma y el
  //  aviso que lo anuncia), así que su comprobación de formato vive en
  //  `consumableCheck` y aquí solo se mira la palabra.
  {
    const claves = Object.keys(BUFF_LABELS) as BuffKey[];
    check('vocabulario: los ocho nombres de buff son el vocabulario nuevo',
      claves.length === 8 && claves.every(k => PROHIBIDAS.every(p => !p.re.test(BUFF_LABELS[k]))),
      claves.map(k => BUFF_LABELS[k]).join(' · '));
  }

  resumen('vocabulario');
}

export default main();
