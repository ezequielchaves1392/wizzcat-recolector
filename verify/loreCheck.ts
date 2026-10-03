// ==========================================================================
//  El lore cubre todos los nombres, y ningún lore sobra
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Es la regla de D4 aplicada al contenido: cuando se declara una cosa con
//  nombre, tiene que haber un banco que pregunte de dónde sale. Aquí es al
//  revés —el nombre ya existe y lo que se declara es su lore—, pero el fallo
//  es el mismo: un nombre sin lore es una ficha a medias, y un lore sin
//  nombre es contenido inalcanzable que nadie verá nunca. Los dos son gratis
//  de evitar si se preguntan juntos.
//
//  LO QUE NO SE COMPRUEBA, A PROPÓSITO: que el modal y la ficha lo pinten.
//  Eso necesita DOM de verdad y es `preview.html` con viewport real.
// ==========================================================================

import { TIER_SYSTEM, LORE, lorePara, lineaTipoCompanion } from '../src/data/tiers';
import { CRATE_ONLY_COMPANIONS } from '../src/components/crateLoot';
import { check, resumen } from './kit';

async function main() {
  const deTier = (tabla: Record<number, readonly string[]>) =>
    Object.values(tabla).flat();
  const nombresTier = [
    ...deTier(TIER_SYSTEM.companionNames as any),
    ...deTier(TIER_SYSTEM.collectorNames as any),
  ];
  const nombresCaja = CRATE_ONLY_COMPANIONS.map(c => c.name);
  const extra = ['Artillero Táctico'];
  const todos = [...nombresTier, ...nombresCaja, ...extra];

  // -----------------------------------------------------------------------
  //  1. TODO NOMBRE TIENE LORE.
  // -----------------------------------------------------------------------
  {
    const sinLore = todos.filter(n => lorePara(n) === null);
    check('lore: los 60 nombres de tier tienen lore',
      deTier(TIER_SYSTEM.companionNames as any).every(n => lorePara(n) !== null) &&
      deTier(TIER_SYSTEM.collectorNames as any).every(n => lorePara(n) !== null),
      `nombres=${nombresTier.length}`);
    check('lore: los 6 exclusivos de caja tienen lore',
      nombresCaja.every(n => lorePara(n) !== null),
      nombresCaja.filter(n => lorePara(n) === null).join(','));
    check('lore: el Artillero Táctico (solo sale de la rara) tiene lore',
      lorePara('Artillero Táctico') !== null,
      String(lorePara('Artillero Táctico')));
    check('lore: ningún nombre se queda sin nada',
      sinLore.length === 0, sinLore.join(','));
  }

  // -----------------------------------------------------------------------
  //  2. NINGÚN LORE SOBRA.
  //
  //     Un lore cuya clave no es ningún nombre es la otra mitad de D4: está
  //     definido y nadie lo enseña. La comparación es contra todos los nombres
  //     que pueden llegar al almacén, no solo contra los de tier.
  // -----------------------------------------------------------------------
  {
    const conocidos = new Set(todos);
    const huerfanos = Object.keys(LORE).filter(k => !conocidos.has(k));
    check('lore: ningún lore es de un nombre que no existe',
      huerfanos.length === 0, huerfanos.join(','));
  }

  // -----------------------------------------------------------------------
  //  3. EL LORE AGUANTA LO RARO.
  // -----------------------------------------------------------------------
  {
    // **UN NOMBRE ES SU LORE O NO LO ES.** Antes esta función hacía un `replace()`
    // para quitarle el sufijo "SOBRECARGADO" al nombre y buscar el lore del de
    // verdad, porque el item sobrecargado llevaba el nombre de su base más ese
    // sufijo. Como el sobrecargado ya no existe, el `replace()` se va con él: lo
    // que se comprueba ahora es que **un nombre con sufijo no tiene lore**, que
    // es lo que hace un item mal escrito: que se muestre sin historia en vez de
    // con la de otro.
    check('lore: un nombre con sufijo no se inventa el lore de otro',
      lorePara('Desintegrador Táctico SOBRECARGADO') === null &&
      lorePara('Desintegrador Táctico') !== null,
      `${String(lorePara('Desintegrador Táctico SOBRECARGADO'))} / base=${String(lorePara('Desintegrador Táctico'))}`);
    check('lore: un nombre inventado no tiene lore, no un texto roto',
      lorePara('Cosa Que No Existe') === null,
      String(lorePara('Cosa Que No Existe')));
    check('lore: ningún lore es una línea vacía',
      Object.values(LORE).every(t => t.trim().length > 20),
      `entradas=${Object.keys(LORE).length}`);
  }

  // -----------------------------------------------------------------------
  //  4. LA LÍNEA DE TIPO DICE LO QUE SE COBRA.
  // -----------------------------------------------------------------------
  {
    check('tipo: el passive enseña su +N/s',
      lineaTipoCompanion('passive', 65).includes('+65/s'),
      lineaTipoCompanion('passive', 65));
    check('tipo: el click enseña el suyo',
      lineaTipoCompanion('click', 32).includes('+32/s'),
      lineaTipoCompanion('click', 32));
    check('tipo: el multiplier enseña su × y no un +N que nadie cobra',
      lineaTipoCompanion('multiplier', 0.35).includes('×1.35') &&
      !lineaTipoCompanion('multiplier', 0.35).includes('+'),
      lineaTipoCompanion('multiplier', 0.35));
  }

  resumen('lore: cada nombre tiene el suyo y ninguno sobra');
}

export default main();
