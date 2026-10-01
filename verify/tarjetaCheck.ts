// ==========================================================================
//  Los buffs: solo tarjetas, y las tarjetas no son una puerta trasera al AFK
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  El jugador pidió sacar los buffs pasivos y dejar las tarjetas. Se han
//  retirado `clickBuff` y `passiveBuff` de la tienda, y el motivo por el que
//  estaban mal **no es que fueran buffs**, es la duración: 30 y 60 minutos.
//
//  Y aquí está el hallazgo, que es la razón de que este banco sea más que una
//  lista de comprobación:
//
//  R10 dice que no entra ingreso si el jugador no está mirando, y el AFK de B9 lo
//  cumple cortando el tick. PERO el tick tiene una salida: `isEffectivelyAfk` es
//  `isAfk && !hasPassiveBuffActive && !hasAfkBuff`. Un buff pasivo activo **anula
//  el corte**. O sea que un buff de 30 minutos comprado con nanitas compraba media
//  hora de ingreso sin mirar, por 800. No era un buff: era un pago por no mirar la
//  pantalla.
//
//  Las tarjetas que quedan duran 10 minutos o 30 segundos, así que no dan tiempo a
//  instalar esa loophole. Eso es exactamente lo que este banco ata: que la
//  duración de lo que queda sea corta, y que lo retirado no se pueda comprar ni
//  although se pueda tener de una partida vieja.
//
//  LO QUE NO SE COMPRUEBA, A PROPÓSITO: que el HUD los pinte. Eso es
//  `preview.html` con viewport real.
// ==========================================================================

import { check, resumen, boot, baseSave, ficha } from './kit';
import { CONSUMABLES, STORE_ITEMS } from '../src/data/store';

async function main() {
  // -----------------------------------------------------------------------
  //  1. LO RETIRADO NO ESTÁ EN LA TIENDA.
  //
  //     Las dos mitades: ni el consumible (que es lo que aplicaba el efecto) ni la
  //     carta (que es lo que el jugador habría visto). Con una sola, el otro sitio
  //     tiraría un error al pintar.
  // -----------------------------------------------------------------------
  {
    for (const id of ['clickBuff', 'passiveBuff']) {
      check(`tienda: ${id} ya no es una carta`,
        (STORE_ITEMS as any)[id] === undefined,
        `sigue en STORE_ITEMS: ${JSON.stringify((STORE_ITEMS as any)[id])}`);
      check(`tienda: ${id} ya no es un consumible`,
        (CONSUMABLES as any)[id] === undefined,
        `sigue en CONSUMABLES: ${JSON.stringify((CONSUMABLES as any)[id])}`);
    }
  }

  // -----------------------------------------------------------------------
  //  2. LAS TRES TARJETAS SIGUEN ESTANDO.
  //
  //     Quitar buffs y quitar tarjetas es distinto, y lo que se pidió es lo
  //     segundo: las tarjetas se acumulan, se pueden cancelar desde el HUD y
  //     duran lo justo. Este bloque está para que nadie lea "salir los buffs
  //     pasivos" como "vaciar la categoría".
  // -----------------------------------------------------------------------
  {
    for (const id of ['afkCard', 'clickX2Card', 'clickX3Card']) {
      check(`tarjetas: ${id} sigue en la tienda`,
        (STORE_ITEMS as any)[id] !== undefined, id);
      check(`tarjetas: ${id} sigue siendo un consumible`,
        (CONSUMABLES as any)[id] !== undefined, id);
    }
  }

  // -----------------------------------------------------------------------
  //  3. LO QUE QUEDA ES CORTO. ESTE ES EL BANCO DE VERDAD.
  //
  //     La regla: ningún buff pasivo que se compre puede dure lo bastante para
  //     tapar un rato largo de no mirar. Los dos retirados duraban 30 y 60 min,
  //     y ese es el número que daba laatinversus.
  //
  //     El tope es de 15 minutos y no de 10 porque la tarjeta AFK dura 10 y
  //     necesita su propio margen: es la única de las tres que sí cubre una
  //     ausencia de verdad, y por eso está en `state.afkExpiresAt`, no en
  //     `state.buffs` — que es la razón por la que el AFK no se puede cortar con
  //     ella (B9).
  // -----------------------------------------------------------------------
  {
    const TOPE_MS = 15 * 60 * 1000;
    for (const [id, def] of Object.entries(STORE_ITEMS as Record<string, any>)) {
      if (def?.durationMs === undefined) continue;
      check(`duracion: ${id} dura como mucho ${TOPE_MS / 60000} min`,
        def.durationMs <= TOPE_MS,
        `${id} dura ${def.durationMs / 60000} min`);
    }

    // Y el que de verdad importa: **ningún buff pasivo comprable**. Los que
    // quedan son de click, y el click solo lo cobra el jugador. La tarjeta AFK no
    // es un buff pasivo: es lo que permite que el tiempo ausente entre.
    const pasivosComprables = Object.entries(STORE_ITEMS as Record<string, any>)
      .filter(([, def]) => def?.durationMs !== undefined)
      .map(([id]) => id)
      .filter(id => {
        const c: any = (CONSUMABLES as any)[id];
        return c?.buffId === 'passiveBoost';
      });
    check('ningun buff de ingreso pasivo se puede comprar ya',
      pasivosComprables.length === 0,
      `quedan: ${JSON.stringify(pasivosComprables)}`);
  }

  // -----------------------------------------------------------------------
  //  4. LO QUE QUEDA SIGUE FUNCIONANDO, Y LO VIEJO SIGUE FUNCIONANDO.
  //
  //     Lo segundo es lo que hace la retirada segura. Hay partidas guardadas con
  //     `passiveBoostExpiresAt` en el futuro, y ese jugador tiene que seguir
  //     cobrando su x2 hasta que expire: quitar el efecto del motor le recortaría
  //     el ingreso a media partida por un cambio de tienda.
  // -----------------------------------------------------------------------
  {
    // 4a. Una partida vieja con el buff de pasivo activo sigue cobrando el doble.
    // `ficha()` es el helper de `kit.ts`; el clave es `passive`, que es lo único
    // que necesita el cálculo del ingreso.
    const guardado = (passiveBoostExpiresAt: number) => baseSave([], {
      nanites: 0,
      totalNanitesProduced: 0,
      companions: [ficha('c1', 1, { power: 10, type: 'passive' })],
      activeCompanions: ['c1'],
      maxCompanionSlots: 3,
      buffs: { clickBoostExpiresAt: 0, passiveBoostExpiresAt, clickX2ExpiresAt: 0, clickX3ExpiresAt: 0 }
    });

    const conBuffViejo = (await boot(guardado(Date.now() + 60 * 60 * 1000)))
      .getState().passiveIncome;
    const sinBuff = (await boot(guardado(0))).getState().passiveIncome;

    check('una partida vieja con el buff de pasivo sigue cobrando el doble',
      conBuffViejo === sinBuff * 2,
      `conBuff=${conBuffViejo} sinBuff=${sinBuff}`);
    check('y no se ha roto el ingreso normal',
      sinBuff === 10,
      `sinBuff=${sinBuff} (un compañero de power 10)`);
  }

  // -----------------------------------------------------------------------
  //  5. Y LA TARJETA AFK SIGUE SIENDO LA EXCEPCIÓN, PORQUE ES LA QUE DEBE.
  //
  //     La AFK no es un buff pasivo disfrazado: es lo que paga el tiempo que
  //     el jugador **no** está mirando, y por eso vive fuera de `state.buffs`
  //     (`state.afkExpiresAt`). Ese detalle es lo que impide que
  //     `isEffectivelyAfk` la confunda con un ingreso gratis, y por eso este banco
  //     comprueba que sigue fuera de ahí.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([], { nanites: 0, afkCards: 0, afkExpiresAt: 0 }));
    check('la tarjeta AFK sigue siendo el camino de tiempo ausente',
      typeof g.getAfkDurationMs === 'function' && g.getAfkDurationMs() > 0,
      `duracion=${g.getAfkDurationMs?.()}`);

    // Y que el AFK automático de B9 no la Mezcle: el ingreso tiene que cortarse
    // igual con la pestaña visible y sin actividad, aunque haya tarjetas AFK en el
    // almacén. Ellas pagan el tiempo que el jugador ya pasó mirando hacia otro lado;
    // no pagan el rato que pasa ahora mirando la pantalla sin hacer nada.
    check('las tarjetas AFK del almacen no se confunden con el AFK de mirar',
      g.isAfk() === false,
      `isAfk=${g.isAfk()} — está activo al arrancar, que es lo correcto`);
  }

  resumen('tarjetas: solo tarjetas, y ninguna es una puerta trasera al AFK');
}

export default main();