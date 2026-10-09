// ==========================================================================
//  El desglose del daño: que las partes sumen lo que se ve
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  El jugador pidió ver "5 base +15 por mejora" en el panel principal. La idea
//  suena a una línea de texto, y es una regla: **las partes tienen que sumar el
//  total**, siempre, sin excepción.
//
//  Y hay un modo de fallo muy concreto aquí, que es el que hace falta cazar.
//     Si el desglose se calculara con tres redondeos independientes, el panel
//  enseñaría "5 base, +2 nivel, +13 bonos" mientras el total es 20, y la suma de
//  las partes daría 20 pero por casualidad. En cualquier otro caso —un buff que
//  expira, un afijo de más, un power que no es redondo— la suma se abriría en un
//  nanita, y el jugador volvería a informar del mismo bug.
//
//  Por eso el banco no comprueba que "se ve un número": comprueba que LA SUMA DE
//  LAS PARTES ES EL TOTAL, en muchos casos, y que un buff de click lo cambia
//  entero.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que el panel lo pinte en el sitio correcto y que
//  no se salga en móvil. Eso se mira en `preview.html` con viewport real.
// ==========================================================================

import { check, resumen, boot, baseSave, collector } from './kit';
import { danioDeRango } from '../src/data/crafting';

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA REGLA: base + nivel + bonos === total. Siempre.
  // -----------------------------------------------------------------------
  {
    const casos = [
      { nombre: 'nivel 0, sin nada más', damage: 5, level: 0, over: {} },
      { nombre: 'nivel 4', damage: 5, level: 4, over: {} },
      { nombre: 'nivel 19 (el tope habitual)', damage: 5, level: 19, over: {} },
      { nombre: 'daño que no es redondo', damage: 13, level: 7, over: {} },
      { nombre: 'daño grande', damage: 466, level: 12, over: {} }
    ];

    for (const c of casos) {
      const g = await boot(baseSave([
        collector('r1', 3, { damage: c.damage, level: c.level })
      ], { nanites: 0 }));
      g.equipCollector('r1');

      const d = g.getClickDamageBreakdown?.();
      check(`${c.nombre}: el desglose existe`,
        d && typeof d.total === 'number', `desglose=${JSON.stringify(d)}`);

      if (d) {
        check(`${c.nombre}: base + nivel + bonos === total`,
          d.base + d.porNivel + d.porBonos === d.total,
          `${d.base} + ${d.porNivel} + ${d.porBonos} = ${d.base + d.porNivel + d.porBonos} pero el total es ${d.total}`);

        check(`${c.nombre}: el total es el mismo que cobra el click`,
          d.total === g.getClickDamage(),
          `desglose=${d.total} getClickDamage=${g.getClickDamage()}`);

        // Y que ninguna parte sea negativa. Un `porNivel` negativo significaría
        // que el buff de click se aplicó dos veces o que se restó algo.
        check(`${c.nombre}: ninguna parte es negativa`,
          d.base >= 0 && d.porNivel >= 0 && d.porBonos >= 0,
          JSON.stringify(d));
      }
    }
  }

  // -----------------------------------------------------------------------
  //  2. EL NIVEL APARECE, Y SOLO CUANDO HAY NIVEL.
  //
  //     La parte "nivel" es la que pidió el jugador. Si no puede ser distinta de
  //     cero con un nivel alto, el desglose es decorativo.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      collector('r1', 3, { damage: danioDeRango(3, 3), level: 10, potential: 3, baseId: 'base_rec_t3_6' })
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const d = g.getClickDamageBreakdown?.();

    check('con nivel 10, la parte de nivel es REAL y no cero',
      (d?.porNivel ?? 0) > 0,
      `porNivel=${d?.porNivel} total=${d?.total}`);

    // OJO CON EL NIVEL: el multiplicador es `1 + nivel * 0,10`, así que nivel 10
    // es x2,0 sobre el daño base, no x1,1. Este test se escribió primero con
    // 1,10, falló, y la culpa era del test y no del código.
    //
    // **Y EL DAÑO Y EL POTENCIAL SALEN DE LA REGLA, NO DE NÚMEROS SUELTOS.** Estaba
    // en `damage: 100` sin potencial, y un T3 con ★3 vale
    // `danioDeRango(3, 3)`: un item con 100 de daño en un T3 es un item que el
    // juego no puede generar. La migración de G4 lo bajó a su sitio al cargar y
    // esta comprobación medía el 100 del fixture, no el juego.
    check('y vale exactamente lo que dice la fórmula (nivel 10 = x2,0 sobre el daño base)',
      d?.porNivel === danioDeRango(3, 3),
      `porNivel=${d?.porNivel} base=${danioDeRango(3, 3)} total=${d?.total}`);

    // Un nivel 0 no puede aportar nada. Mostrar "0 nivel" no es mentira, pero
    // ocupa una línea para decir que no hay nada, y por eso la vista lo oculta.
    const g0 = await boot(baseSave([
      collector('r1', 3, { damage: 100, level: 0 })
    ], { nanites: 0 }));
    g0.equipCollector('r1');
    const d0 = g0.getClickDamageBreakdown?.();
    check('con nivel 0 la parte de nivel es 0, para que la vista pueda ocultarla',
      d0?.porNivel === 0, `porNivel=${d0?.porNivel}`);
  }

  // -----------------------------------------------------------------------
  //  3. EL BUFF DE CLICK ENTRA ENTERO Y SE VE.
  //
  //     Es el caso donde el desglose se separaría de la realidad si alguien
  //     calculara al montar el panel en vez de al pintar: el buff caduca, el
  //     total baja y el texto sigue diciendo lo de antes.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 100, level: 5 })
    ], { nanites: 0 }));
    g.equipCollector('r1');

    const antes = g.getClickDamageBreakdown?.();
    check('sin buff, el total es el mismo que cobra el click',
      antes?.total === g.getClickDamage(),
      `total=${antes?.total} damage=${g.getClickDamage()}`);

    // Se activa el buff de click x2: el total dobla y la parte de bonos sube.
    g.getState().buffs.clickBoostExpiresAt = Date.now() + 60_000;
    const conBuff = g.getClickDamageBreakdown?.();

    check('con el buff x2 el total sube',
      conBuff?.total > (antes?.total ?? 0),
      `antes=${antes?.total} conBuff=${conBuff?.total}`);

    // ESTA ES LA QUE ATRAPA EL BUG REAL, y no es Cosmetics. El buff de click
    // multiplica el daño entero, así que la tentación es adjudicarlo a "nivel",
    // que es la última multiplicación antes de él. Con buff puesto, el panel
    // decía "+200 nivel" para un item cuyo nivel solo vale 50, y el jugador
    // leía que subir de nivel rendía el doble de lo que rinde.
    //
    // "Nivel" tiene que decir SIEMPRE lo mismo, buffs puestos o no, y el buff
    // entero tiene que aparecer en "bonos", que es donde uno lo espera. Por eso
    // la parte de nivel se mide sin el multiplicador de buff.
    check('con buff, la parte de NIVEL no se mueve',
      conBuff?.porNivel === antes?.porNivel,
      `nivel antes=${antes?.porNivel} conBuff=${conBuff?.porNivel}`);

    check('y el efecto entero del buff cae en BONOS',
      (conBuff?.porBonos ?? 0) - (antes?.porBonos ?? 0) === (conBuff?.total ?? 0) - (antes?.total ?? 0),
      `bonos ${antes?.porBonos}->${conBuff?.porBonos} mientras el total ${antes?.total}->${conBuff?.total}`);

    check('y las partes siguen cuadrando con el buff puesto',
      (conBuff?.base ?? 0) + (conBuff?.porNivel ?? 0) + (conBuff?.porBonos ?? 0) === conBuff?.total,
      `${conBuff?.base} + ${conBuff?.porNivel} + ${conBuff?.porBonos} vs ${conBuff?.total}`);

    // Y al expirar, vuelve al valor de antes. Esta es la que importa: el desglose
    // se lee AHORA, no se guardó al pintar.
    g.getState().buffs.clickBoostExpiresAt = 0;
    const tras = g.getClickDamageBreakdown?.();
    check('al expirar el buff, el desglose vuelve al que había',
      tras?.total === antes?.total, `antes=${antes?.total} tras=${tras?.total}`);
  }

  // -----------------------------------------------------------------------
  //  4. SIN RECOLECTOR, NO HAY DESGLOSE QUE INVENTAR.
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([], { nanites: 0 }));
    const d = g.getClickDamageBreakdown?.();
    // **ANTES AFIRMABA QUE EL DESGLOSE ERA TODO CERO Y QUE LA VISTA NO PINTABA NADA.**
    // Era el mismo bloqueo que en el resto de bancos, y aquí tenía una consecuencia
    // visible que no se había visto: **la vista esconde las líneas de desglose cuando el
    // total es cero**, así que un jugador sin recolector se encontraba con un número
    // muerto y sin una sola línea que lo explicara.
    //
    // Con el suelo, el total es 1 y las líneas vuelven. Y la comprobación sigue valiendo
    // para lo que estaba mirando: que el desglose **no venga undefined** cuando no hay
    // recolector, que era el punto real de la prueba.
    check('sin recolector el desglose viene relleno, con la base del suelo',
      !!d && d.total >= 1 && d.base >= 1 && d.porNivel === 0 && d.porBonos === 0,
      `desglose=${JSON.stringify(d)}`);
    check('y por eso la vista vuelve a pintar sus lineas',
      (d?.total ?? 0) >= 1, `total=${d?.total}`);
  }

  resumen('desglose: las partes suman el total');
}

export default main();