// ==========================================================================
// F74 · LAS BASES OCULTAS: 10 POR TIER Y POR LADO, 200 EN TOTAL (T1–T10)
// ==========================================================================
//
// **POR QUÉ ESTE ARCHIVO EXISTE, Y NO EN `tiers.ts`.** Las bases son **la caza**,
// y `tiers.ts` es el techo del tier. Separarlas permite que el balance de la caza
// (pesos, rarezas, nombres) viva en un sitio y el techo del tier en otro, sin
// que un cambio en uno rompa al otro.
//
// **POR LADO, DECIDIDO POR EL JUGADOR.** Recolectores y compañeros cazan en tablas
// separadas: 100 + 100. Compartirlas haría que un nombre de arma saliera en un
// compañero y al revés, y la caza de cada lado tiene su propio tema por tier.
//
// **LO QUE UNA BASE ES, Y LO QUE NO.** Una base **no es un nombre bonito**: es un
// **peso de stat** (cuánto daño/ingreso trae) y un **peso de drop** (qué tan rara
// sale). El nombre y el lore son **contenido**, y viven aquí para que el banco
// pueda verificar que cada base tiene su lore sin tocar el motor.
//
// **LA FÓRMULA, EN UNA LÍNEA:**
//   daño/poder = baseDelTier(tier) × multiplicadorDeBase(base) × multiplicadorDePotencial(★) × multiplicadorDeNivel(nivel)
//
// **LA BASE ES ±10% ALREDEDOR:** de ×0,92 a ×1,10. Suficiente para que dos T1 ★3
// se noten distintos al pegarlos, sin destronar a las estrellas. Si la base moviera
// mucho, el potencial dejaría de importar.
//
// **EL PESO DE DROP ES `11 − posición`:** La mejor base (posición 10) sale con
// peso 1 y la peor (posición 1) con peso 10: diez veces menos. Lineal se nota en
// una tarde de cajas; exponencial se nota en un mes.
// ==========================================================================

/** El lado que caza: recolectores y compañeros tienen su propia tabla. */
export type LadoBase = 'recolector' | 'companero';

/** El lado de un tipo de item ('collector' → 'recolector', lo demás → 'companero'). */
export function ladoDeBase(tipo: string): LadoBase {
  return tipo === 'collector' ? 'recolector' : 'companero';
}
 
export interface BaseOculta {
  /** Identificador único: `base_rec_t{tier}_{posición}` o `base_com_t{tier}_{posición}`. Ej: `base_rec_t1_5`. */
  id: string;
  /** 1..10 dentro del tier. */
  posicion: number;
  /** 1..10. Tier al que pertenece. */
  tier: number;
  /** Multiplicador del stat: 0.92 .. 1.10 (centrado en 1.0 en la posición 5/6). */
  pesoStat: number;
  /** Peso de drop: 11 - posición. La mejor (10) sale 10x menos que la peor (1). */
  pesoDrop: number;
  /** Nombre visible. Se usa en `loreCheck` y en la UI. */
  nombre: string;
  /** Texto de lore. Se usa en `loreCheck` y en la ficha del item. */
  lore: string;
}

/** TODAS LAS BASES DE RECOLECTORES, ÍNDICE POR TIER Y POSICIÓN. */
export const BASES_RECOLECTOR: Record<number, BaseOculta[]> = {
  1: [
    { id: 'base_rec_t1_1',  posicion: 1,  tier: 1, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Núcleo Defectuoso',      lore: 'Un primer intento que apenas calienta. La mayoría lo descarta, pero los coleccionistas saben que cada defecto es una firma única.' },
    { id: 'base_rec_t1_2',  posicion: 2,  tier: 1, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Fragmento Inestable',    lore: 'Vibra con una energía que no termina de decidirse. Quien lo domina, domina el caos.' },
    { id: 'base_rec_t1_3',  posicion: 3,  tier: 1, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Semilla de Chatarra',    lore: 'Parece basura, pero en las manos correctas florece. Los grandes imperios empezaron así.' },
    { id: 'base_rec_t1_4',  posicion: 4,  tier: 1, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Trozo Olvidado',        lore: 'Yació en el olvido hasta que alguien vio su brillo. Ahora late con fuerza contenida.' },
    { id: 'base_rec_t1_5',  posicion: 5,  tier: 1, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Núcleo Estándar',       lore: 'El estándar contra el que se miden todos los demás. No brilla, pero nunca falla.' },
    { id: 'base_rec_t1_6',  posicion: 6,  tier: 1, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Fragmento Pulido',      lore: 'Cada golpe del martillo le quitó lo que sobraba. Lo que queda es puro propósito.' },
    { id: 'base_rec_t1_7',  posicion: 7,  tier: 1, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Núcleo Afilado',        lore: 'Corta el aire con un susurro. Los enemigos no oyen el golpe, solo sienten el frío.' },
    { id: 'base_rec_t1_8',  posicion: 8,  tier: 1, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Fragmento Luminoso',    lore: 'Brilla con una luz que no viene de fuera. Quien la porta camina sin sombra.' },
    { id: 'base_rec_t1_9',  posicion: 9,  tier: 1, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Corazón de Acero',      lore: 'Late con un ritmo que no es de este mundo. Los rivales escuchan su eco y retroceden.' },
    { id: 'base_rec_t1_10', posicion: 10, tier: 1, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Estrella Naciente',     lore: 'Nació de una colisión que no debió ocurrir. Ahora arde con la fuerza de mil soles.' },
  ],
  2: [
    { id: 'base_rec_t2_1',  posicion: 1,  tier: 2, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Restos de Batalla',       lore: 'Sobrevivió a una guerra que no recuerda. Cada grieta cuenta una victoria.' },
    { id: 'base_rec_t2_2',  posicion: 2,  tier: 2, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Eco de Guerra',          lore: 'Aún resuena el rugido de la batalla en su interior. Quien lo empuña oye ecos lejanos.' },
    { id: 'base_rec_t2_3',  posicion: 3,  tier: 2, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Forja de Cenizas',        lore: 'Nació del fuego que lo consumió todo. De las cenizas, surgió más fuerte.' },
    { id: 'base_rec_t2_4',  posicion: 4,  tier: 2, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Metal Curado',           lore: 'El tiempo y el martillo lo curaron. Ahora es más duro que el diamante.' },
    { id: 'base_rec_t2_5',  posicion: 5,  tier: 2, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Acero Templado',         lore: 'El estándar de los veteranos. No brilla, pero aguanta lo que rompe al resto.' },
    { id: 'base_rec_t2_6',  posicion: 6,  tier: 2, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Aleación Fina',          lore: 'La precisión de mil ciclos. Cada molécula está donde debe estar.' },
    { id: 'base_rec_t2_7',  posicion: 7,  tier: 2, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Acero Cantor',           lore: 'Canta al cortar el aire. Sus enemigos oyen la melodía y bajan la guardia.' },
    { id: 'base_rec_t2_8',  posicion: 8,  tier: 2, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Filosa Aurora',          lore: 'Brilla con la primera luz del día. La noche huye ante su filo.' },
    { id: 'base_rec_t2_9',  posicion: 9,  tier: 2, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Corazón de Titanio',     lore: 'Late con la fuerza de una estrella moribunda. Nada resiste su pulso.' },
    { id: 'base_rec_t2_10', posicion: 10, tier: 2, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Alba Eterna',            lore: 'El amanecer que nunca acaba. Quien la porta trae el día a la noche más oscura.' },
  ],
  3: [
    { id: 'base_rec_t3_1',  posicion: 1,  tier: 3, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Restos Cuánticos',         lore: 'Existe en todos los estados a la vez. Medirlo es elegir su destino.' },
    { id: 'base_rec_t3_2',  posicion: 2,  tier: 3, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Entrelazado Inestable',    lore: 'Vibra con su gemelo al otro lado del universo. Separarlos es imposible.' },
    { id: 'base_rec_t3_3',  posicion: 3,  tier: 3, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Superposición Rota',       lore: 'Decidió ser dos cosas a la vez. El universo aún no ha decidido castigarlo.' },
    { id: 'base_rec_t3_4',  posicion: 4,  tier: 3, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Colapso Controlado',       lore: 'Se colapsó a propósito. Ahora es más de lo que la suma de sus partes.' },
    { id: 'base_rec_t3_5',  posicion: 5,  tier: 3, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Estado Estable',           lore: 'El equilibrio perfecto entre caos y orden. Los físicos lo estudian, los guerreros lo codician.' },
    { id: 'base_rec_t3_6',  posicion: 6,  tier: 3, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Entrelazado Perfecto',     lore: 'Su gemelo está en la otra punta del cosmos. Juntos, son invencibles.' },
    { id: 'base_rec_t3_7',  posicion: 7,  tier: 3, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Colapso Dorado',           lore: 'Se colapsó en oro puro. Quien lo toca siente el peso de mil decisiones.' },
    { id: 'base_rec_t3_8',  posicion: 8,  tier: 3, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Singularidad Brillante',   lore: 'La luz se curva a su alrededor. La física se inclina ante su paso.' },
    { id: 'base_rec_t3_9',  posicion: 9,  tier: 3, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Núcleo de Neutrones',      lore: 'La materia más densa que existe. Un cubo pesa más que una montaña.' },
    { id: 'base_rec_t3_10', posicion: 10, tier: 3, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Singularidad Absoluta',    lore: 'Donde el tiempo y el espacio se rinden. El final y el principio, en uno.' },
  ],
  4: [
    { id: 'base_rec_t4_1',  posicion: 1,  tier: 4, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Esquirla Hueca',       lore: 'Prometía filo y trae eco. El vacío también miente.' },
    { id: 'base_rec_t4_2',  posicion: 2,  tier: 4, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Sombra Rota',          lore: 'Se quebró en dos oscuridades. Ninguna alumbra.' },
    { id: 'base_rec_t4_3',  posicion: 3,  tier: 4, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Susurro del Vacío',    lore: 'Dice tu nombre al revés. Mejor no contestar.' },
    { id: 'base_rec_t4_4',  posicion: 4,  tier: 4, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Penumbra Fría',        lore: 'El frío que queda cuando la luz se rinde.' },
    { id: 'base_rec_t4_5',  posicion: 5,  tier: 4, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Sentencia Gris',       lore: 'Ni absuelve ni condena: archiva. Burocracia del abismo.' },
    { id: 'base_rec_t4_6',  posicion: 6,  tier: 4, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Ojo Entrecerrado',     lore: 'Te mira a medias y juzga entero.' },
    { id: 'base_rec_t4_7',  posicion: 7,  tier: 4, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Veredicto Firme',      lore: 'Cuando cae, la veta tiembla. Casi siempre a tu favor.' },
    { id: 'base_rec_t4_8',  posicion: 8,  tier: 4, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Condena Luminosa',     lore: 'Brilla al condenar. Hasta el castigo tiene estilo.' },
    { id: 'base_rec_t4_9',  posicion: 9,  tier: 4, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Juicio Final Menor',   lore: 'El ensayo del fin del mundo. Rinde como el original.' },
    { id: 'base_rec_t4_10', posicion: 10, tier: 4, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Veredicto Absoluto',   lore: 'Inapelable. La veta escucha la sentencia y se abre.' },
  ],
  5: [
    { id: 'base_rec_t5_1',  posicion: 1,  tier: 5, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Ceniza Tardía',        lore: 'Llegó tarde al fin del mundo. Igual alcanzó a rendir.' },
    { id: 'base_rec_t5_2',  posicion: 2,  tier: 5, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Ruina Común',          lore: 'Una ruina más del montón. El montón rinde.' },
    { id: 'base_rec_t5_3',  posicion: 3,  tier: 5, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Presagio Sordo',       lore: 'Anunció el desastre en voz baja. Nadie hizo caso, todos ganaron.' },
    { id: 'base_rec_t5_4',  posicion: 4,  tier: 5, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Catástrofe Anunciada', lore: 'Salió en todos los pronósticos. Cumplió en todos.' },
    { id: 'base_rec_t5_5',  posicion: 5,  tier: 5, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Desastre de Manual',   lore: 'El desastre estándar, capítulo tres. Funciona como dice el libro.' },
    { id: 'base_rec_t5_6',  posicion: 6,  tier: 5, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Hecatombe Medida',     lore: 'Cien por hora, ni uno más. Producción con certificado.' },
    { id: 'base_rec_t5_7',  posicion: 7,  tier: 5, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Apocalipsis Local',    lore: 'El fin del mundo, pero solo de este barrio.' },
    { id: 'base_rec_t5_8',  posicion: 8,  tier: 5, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Fin del Mundo Cercano', lore: 'Se ve en el horizonte y rinde en primer plano.' },
    { id: 'base_rec_t5_9',  posicion: 9,  tier: 5, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Armagedón Personal',   lore: 'Tu propio fin del mundo, a tu medida.' },
    { id: 'base_rec_t5_10', posicion: 10, tier: 5, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Apocalipsis Total',    lore: 'No quedó nada en pie, salvo la producción.' },
  ],
  6: [
    { id: 'base_rec_t6_1',  posicion: 1,  tier: 6, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Palo Afilado',         lore: 'Un palo con pretensiones. A veces alcanzan.' },
    { id: 'base_rec_t6_2',  posicion: 2,  tier: 6, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Espada de Práctica',   lore: 'No corta ni el aire. Enseña a cortar.' },
    { id: 'base_rec_t6_3',  posicion: 3,  tier: 6, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Hoja de Guardia',      lore: 'Custodia puertas y trincheras. Cumple turnos.' },
    { id: 'base_rec_t6_4',  posicion: 4,  tier: 6, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Acero Jurado',         lore: 'Juró servir y sirve. Sin brillo y sin falta.' },
    { id: 'base_rec_t6_5',  posicion: 5,  tier: 6, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Arma Reglamentaria',   lore: 'La que entrega el arsenal. Hace lo reglamentario.' },
    { id: 'base_rec_t6_6',  posicion: 6,  tier: 6, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Hoja Reconocida',      lore: 'Los armeros la saludan al pasar.' },
    { id: 'base_rec_t6_7',  posicion: 7,  tier: 6, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Espada Cantada',       lore: 'Los bardos exageran. La hoja, no tanto.' },
    { id: 'base_rec_t6_8',  posicion: 8,  tier: 6, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Reliquia de Batalla',  lore: 'Estuvo en la batalla que cuentan los abuelos.' },
    { id: 'base_rec_t6_9',  posicion: 9,  tier: 6, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Leyenda Viva',         lore: 'Dicen que eligió a su portador. Nadie lo desmiente.' },
    { id: 'base_rec_t6_10', posicion: 10, tier: 6, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Mito Forjado',         lore: 'No existió hasta que la forjaron. Ahora siempre existió.' },
  ],
  7: [
    { id: 'base_rec_t7_1',  posicion: 1,  tier: 7, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Dado Cargado',         lore: 'Siempre cae del mismo lado. El lado que rinde.' },
    { id: 'base_rec_t7_2',  posicion: 2,  tier: 7, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Moneda al Aire',       lore: 'Cae de canto y sigue girando. Mientras gira, produce.' },
    { id: 'base_rec_t7_3',  posicion: 3,  tier: 7, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Hilo Suelto',          lore: 'Tira de él y se desarma el destino. Con cuidado rinde.' },
    { id: 'base_rec_t7_4',  posicion: 4,  tier: 7, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Nudo Flojo',           lore: 'Se desata solo. Lo atado no era importante.' },
    { id: 'base_rec_t7_5',  posicion: 5,  tier: 7, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Rumbo Marcado',        lore: 'La brújula apunta donde hay. Suele haber.' },
    { id: 'base_rec_t7_6',  posicion: 6,  tier: 7, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Carta Señalada',       lore: 'Marcada, sí. A tu favor, también.' },
    { id: 'base_rec_t7_7',  posicion: 7,  tier: 7, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Destino Entrevisto',   lore: 'Lo viste de lejos y te reconoció.' },
    { id: 'base_rec_t7_8',  posicion: 8,  tier: 7, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Profecía Cumplida',    lore: 'Dijo que rendiría. Rindió.' },
    { id: 'base_rec_t7_9',  posicion: 9,  tier: 7, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Hado Sellado',         lore: 'Firmado y lacrado. El futuro ya pagó por adelantado.' },
    { id: 'base_rec_t7_10', posicion: 10, tier: 7, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Destino Manifiesto',   lore: 'Era inevitable. Lo inevitable, bien llevado, produce.' },
  ],
  8: [
    { id: 'base_rec_t8_1',  posicion: 1,  tier: 8, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Segundo Perdido',      lore: 'Se cayó del reloj. Nadie lo reclama.' },
    { id: 'base_rec_t8_2',  posicion: 2,  tier: 8, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Minuto Gris',          lore: 'Sesenta segundos sin nada que contar. Igual rinden.' },
    { id: 'base_rec_t8_3',  posicion: 3,  tier: 8, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Hora Muerta',          lore: 'El reloj la salta, la producción no.' },
    { id: 'base_rec_t8_4',  posicion: 4,  tier: 8, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Ayer Borroso',         lore: 'Casi no se acuerdan de él. Casi.' },
    { id: 'base_rec_t8_5',  posicion: 5,  tier: 8, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Presente Continuo',    lore: 'Siempre ahora, siempre rindiendo.' },
    { id: 'base_rec_t8_6',  posicion: 6,  tier: 8, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Instante Exacto',      lore: 'Dura lo justo y rinde lo exacto.' },
    { id: 'base_rec_t8_7',  posicion: 7,  tier: 8, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Mañana Claro',         lore: 'Se ve venir y viene cargado.' },
    { id: 'base_rec_t8_8',  posicion: 8,  tier: 8, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Siglo Comprimido',     lore: 'Cien años en un golpe. Eficiencia histórica.' },
    { id: 'base_rec_t8_9',  posicion: 9,  tier: 8, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Eternidad Parcial',    lore: 'No toda, una parte. Alcanza y sobra.' },
    { id: 'base_rec_t8_10', posicion: 10, tier: 8, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Infinito de Bolsillo', lore: 'Cabe en la mano y no se acaba nunca.' },
  ],
  9: [
    { id: 'base_rec_t9_1',  posicion: 1,  tier: 9, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Último Suspiro',       lore: 'Apenas un hilo de aire. Alcanza.' },
    { id: 'base_rec_t9_2',  posicion: 2,  tier: 9, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Tumba Abierta',        lore: 'Sin lápida y sin prisa. Rinde igual.' },
    { id: 'base_rec_t9_3',  posicion: 3,  tier: 9, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Réquiem Sordo',        lore: 'Lo tocan bajito para no despertar a nadie.' },
    { id: 'base_rec_t9_4',  posicion: 4,  tier: 9, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Mortaja Gris',         lore: 'Envoltorio estándar del más allá. Cumple.' },
    { id: 'base_rec_t9_5',  posicion: 5,  tier: 9, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Duelo Reglamentario',  lore: 'Se guarda el luto que toca y se produce el resto.' },
    { id: 'base_rec_t9_6',  posicion: 6,  tier: 9, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Epitafio Tallado',     lore: 'Aquí yace la pereza. Que descanse.' },
    { id: 'base_rec_t9_7',  posicion: 7,  tier: 9, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Ofrenda Aceptada',     lore: 'Los dioses la miraron y asintieron.' },
    { id: 'base_rec_t9_8',  posicion: 8,  tier: 9, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Juicio de Dioses',     lore: 'El tribunal celestial falla a tu favor. Casi siempre.' },
    { id: 'base_rec_t9_9',  posicion: 9,  tier: 9, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Ira Divina',           lore: 'Cuando truena arriba, la veta tiembla abajo.' },
    { id: 'base_rec_t9_10', posicion: 10, tier: 9, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Herencia Eterna',      lore: 'Lo que los dioses dejaron no se agota.' },
  ],
  10: [
    { id: 'base_rec_t10_1',  posicion: 1,  tier: 10, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Punto de Partida',   lore: 'Todo empieza acá. Conviene empezar bien.' },
    { id: 'base_rec_t10_2',  posicion: 2,  tier: 10, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Primera Piedra',     lore: 'La que puso el primero. Pesa como tal.' },
    { id: 'base_rec_t10_3',  posicion: 3,  tier: 10, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Grieta Inicial',     lore: 'Por acá se coló todo lo demás.' },
    { id: 'base_rec_t10_4',  posicion: 4,  tier: 10, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Umbral Ancho',       lore: 'Puerta grande para producción grande.' },
    { id: 'base_rec_t10_5',  posicion: 5,  tier: 10, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Ecuador Eterno',     lore: 'La mitad de todo, para siempre.' },
    { id: 'base_rec_t10_6',  posicion: 6,  tier: 10, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Mitad Justa',        lore: 'Ni más ni menos: lo que toca.' },
    { id: 'base_rec_t10_7',  posicion: 7,  tier: 10, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Cúspide Visible',    lore: 'Se ve desde abajo. Cuesta llegar, rinde al llegar.' },
    { id: 'base_rec_t10_8',  posicion: 8,  tier: 10, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Cima Sin Nieve',     lore: 'Lo alto sin el frío. Vista y producción.' },
    { id: 'base_rec_t10_9',  posicion: 9,  tier: 10, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Fin Anunciado',      lore: 'Termina como avisó: rindiendo.' },
    { id: 'base_rec_t10_10', posicion: 10, tier: 10, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Alfa y Omega',       lore: 'La primera y la última letra. Entre ellas, todo.' },
  ],
  11: [
    { id: 'base_rec_t11_1',  posicion: 1,  tier: 11, pesoStat: 0.92, pesoDrop: 10, nombre: 'Lastre de Órbita',      lore: 'Cayó de algo que ya no está. Lo que arrastra pesa más de lo que parece.' },
    { id: 'base_rec_t11_2',  posicion: 2,  tier: 11, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Escombro Tibio',       lore: 'La roca no muere del todo: respira despacio y da algo cada vez.' },
    { id: 'base_rec_t11_3',  posicion: 3,  tier: 11, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Fragmento de Aurora',  lore: 'Se partió una luz. Cada trozo todavía apunta al mismo sitio.' },
    { id: 'base_rec_t11_4',  posicion: 4,  tier: 11, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Cráter Sellado',       lore: 'Cerraron el agujero por dentro. Lo que había dentro sigue trabajando.' },
    { id: 'base_rec_t11_5',  posicion: 5,  tier: 11, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Baliza de Naufragio',  lore: 'Sigue encendida una ruta que ya nadie recorre. Es lo único que queda.' },
    { id: 'base_rec_t11_6',  posicion: 6,  tier: 11, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Nodo de Retorno',      lore: 'No va a ningún sitio: se queda, y por eso todo lo demás vuelve.' },
    { id: 'base_rec_t11_7',  posicion: 7,  tier: 11, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Eco de Impacto',       lore: 'El golpe todavía se oye, dilatado, desde el interior.' },
    { id: 'base_rec_t11_8',  posicion: 8,  tier: 11, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Piedra de Presión',    lore: 'Pesa más de lo que mide. La gravedad no discute con ella.' },
    { id: 'base_rec_t11_9',  posicion: 9,  tier: 11, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Forja Abisal',         lore: 'Trabaja a una presión que aplastaría a cualquier otra. Trabaja igual.' },
    { id: 'base_rec_t11_10', posicion: 10, tier: 11, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Colmillo de Meteorito', lore: 'Cayó con la fuerza de una estrella y se quedó con las ganas de volver.' },
  ],
  12: [
    { id: 'base_rec_t12_1',  posicion: 1,  tier: 12, pesoStat: 0.92, pesoDrop: 10, nombre: 'Manto Roto',           lore: 'Cayó de algo que ya no da sombra. Se usar igual, y produce más.' },
    { id: 'base_rec_t12_2',  posicion: 2,  tier: 12, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Nube de Ceniza',       lore: 'Lleva siglos cayendo y nunca toca el suelo. Nunca se acaba de caer.' },
    { id: 'base_rec_t12_3',  posicion: 3,  tier: 12, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Rastro de Cometa',     lore: 'Se puede seguir con el dedo. Es la única estela que no se apaga.' },
    { id: 'base_rec_t12_4',  posicion: 4,  tier: 12, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Vórtice Antiguo',      lore: 'Gira desde antes de que hubiera alguien que lo mirara. Sigue girando.' },
    { id: 'base_rec_t12_5',  posicion: 5,  tier: 12, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Ancla de Hypothes',    lore: 'Sostiene algo que ya no existe. Se niega a soltarlo de todas formas.' },
    { id: 'base_rec_t12_6',  posicion: 6,  tier: 12, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Pozo de Gravedad',     lore: 'Un agujero donde la gravedad tira más de lo que debería. Y sigue tirando.' },
    { id: 'base_rec_t12_7',  posicion: 7,  tier: 12, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Ceniza Diamante',      lore: 'Lo que quedó de un sol apagándose, prensado hasta que brilla.' },
    { id: 'base_rec_t12_8',  posicion: 8,  tier: 12, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Sombra de Astro',      lore: 'Un astro que ya no está y todavía tapa la luz de otro.' },
    { id: 'base_rec_t12_9',  posicion: 9,  tier: 12, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Foco de Supernova',    lore: 'Apuntó una vez y el cielo entero se enteró. Ahora apunta a la veta.' },
    { id: 'base_rec_t12_10', posicion: 10, tier: 12, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Última Luz de Nova',  lore: 'La luz de una explosión que ya nadie vio, todavía llegando.' },
  ],
  13: [
    { id: 'base_rec_t13_1',  posicion: 1,  tier: 13, pesoStat: 0.92, pesoDrop: 10, nombre: 'Hueso de Astro',         lore: 'De un cuerpo que ya no orbita. Sigue siendo la parte más dura que había.' },
    { id: 'base_rec_t13_2',  posicion: 2,  tier: 13, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Runa Antigua',           lore: 'Escribió una orden que el tiempo no supo procesar. La sigue cumpliendo.' },
    { id: 'base_rec_t13_3',  posicion: 3,  tier: 13, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Cáliz de Nova Muerta',   lore: 'Recogió lo que sobró de una estrella que se apagó bien.' },
    { id: 'base_rec_t13_4',  posicion: 4,  tier: 13, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Engranaje del Origen',   lore: 'La primera pieza que se movió cuando no había nada que mover.' },
    { id: 'base_rec_t13_5',  posicion: 5,  tier: 13, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Semilla del Cosmos',     lore: 'Lo primero que existió. Todavía no ha decidido en qué convertirse.' },
    { id: 'base_rec_t13_6',  posicion: 6,  tier: 13, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Yunque Primordial',      lore: 'Ahí forjaron el primer objeto. Nada de lo que vino después es más duro.' },
    { id: 'base_rec_t13_7',  posicion: 7,  tier: 13, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Crisol del Alba',        lore: 'El recipiente donde se mezcló la luz con la materia por primera vez.' },
    { id: 'base_rec_t13_8',  posicion: 8,  tier: 13, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Diadema de Fuego Blanco', lore: 'La luz que quema sin calor porque no es de este mundo.' },
    { id: 'base_rec_t13_9',  posicion: 9,  tier: 13, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Sello del Vacío',        lore: 'La marca que dejó el hueco antes de que hubiera algo que lo llenara.' },
    { id: 'base_rec_t13_10', posicion: 10, tier: 13, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Ojo del Principio',     lore: 'Mira hacia atrás, al antes de todo. Lo que ve todavía produce.' },
  ],
  14: [
    { id: 'base_rec_t14_1',  posicion: 1,  tier: 14, pesoStat: 0.92, pesoDrop: 10, nombre: 'Duna de Vidrio',       lore: 'Formada por algo que se solidificó al caer. Todavía se mueve un poco.' },
    { id: 'base_rec_t14_2',  posicion: 2,  tier: 14, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Prisma Difuso',        lore: 'La luz entra y sale distinta. Nunca sabes qué color te va a dar.' },
    { id: 'base_rec_t14_3',  posicion: 3,  tier: 14, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Campo Gravitatorio',   lore: 'Un campo que no se ve pero que empuja todo lo que pasa cerca.' },
    { id: 'base_rec_t14_4',  posicion: 4,  tier: 14, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Géiser de Nanitas',     lore: 'Un chorro que sube solo. Lo que sube es tuyo si lo atrapas.' },
    { id: 'base_rec_t14_5',  posicion: 5,  tier: 14, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Filo del Espacio',     lore: 'El canto más afilado que se puede hacer con la distancia entre dos cosas.' },
    { id: 'base_rec_t14_6',  posicion: 6,  tier: 14, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Membrana',             lore: 'Separa una dimensión de otra. Solo deja pasar lo que ya sabe que debe.' },
    { id: 'base_rec_t14_7',  posicion: 7,  tier: 14, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Núcleo de Fusión',     lore: 'La estrella pequeña que alguien puso aquí a propósito. Trabaja.' },
    { id: 'base_rec_t14_8',  posicion: 8,  tier: 14, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Vórtice Cuántico',     lore: 'Gira en algo que no tiene dimensiones. Sale algo de todos modos.' },
    { id: 'base_rec_t14_9',  posicion: 9,  tier: 14, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Collar de Materia',    lore: 'La materia oscura que sostiene el resto. Pesa y no se ve.' },
    { id: 'base_rec_t14_10', posicion: 10, tier: 14, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Aguja del Infinito',   lore: 'Señala todos los infinitos a la vez. Todavía no ha señalado el tuyo.' },
  ],
  15: [
    { id: 'base_rec_t15_1',  posicion: 1,  tier: 15, pesoStat: 0.92, pesoDrop: 10, nombre: 'Enjambre Silencioso',  lore: 'Muchas cosas pequeñas que no se oyen. Juntas se oyen demasiado.' },
    { id: 'base_rec_t15_2',  posicion: 2,  tier: 15, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Colmillo Antiguo',     lore: 'De un animal tan grande que solo cabe un trozo en el mapa.' },
    { id: 'base_rec_t15_3',  posicion: 3,  tier: 15, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Obsidiana',            lore: 'La roca que corta el tiempo. No te corta a ti: corta el antes y el después.' },
    { id: 'base_rec_t15_4',  posicion: 4,  tier: 15, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Nudo de Hilera',       lore: 'La historia de todas las hilas, atada en un punto. Ese punto produce.' },
    { id: 'base_rec_t15_5',  posicion: 5,  tier: 15, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Vela del Cosmos',      lore: 'Abreza. Toda la luz que ves de lejos salió de alguna vela como esta.' },
    { id: 'base_rec_t15_6',  posicion: 6,  tier: 15, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Cimiento de Marea',    lore: 'Lo que mueve el mar dos veces al día. También mueve tus números.' },
    { id: 'base_rec_t15_7',  posicion: 7,  tier: 15, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Nuez de Apogeo',       lore: 'Guardada cuando todo estaba en su punto más alto. Sigue ahí.' },
    { id: 'base_rec_t15_8',  posicion: 8,  tier: 15, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Lámina de Parpadeo',  lore: 'Existe en el instante exacto entre un blink y otro. Ahí produce más.' },
    { id: 'base_rec_t15_9',  posicion: 9,  tier: 15, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Vórtice Interior',    lore: 'Gira hacia dentro. Todo lo que se acerca, se queda.' },
    { id: 'base_rec_t15_10', posicion: 10, tier: 15, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Sello del Apocalipsis', lore: 'La marca que dejó el final una vez. Se puede usar, pero se nota.' },
  ],
  16: [
    { id: 'base_rec_t16_1',  posicion: 1,  tier: 16, pesoStat: 0.92, pesoDrop: 10, nombre: 'Hueso Común',         lore: 'Fósil de algo que ya no existe. Sigue siendo la estructura más fuerte que hubo.' },
    { id: 'base_rec_t16_2',  posicion: 2,  tier: 16, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Silla Vacía',         lore: 'La dejaste porque todo creció mejor. La silla sigue aquí, ocupando su sitio.' },
    { id: 'base_rec_t16_3',  posicion: 3,  tier: 16, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Neón Residual',       lore: 'La luz que quedó encendida cuando se cortó la corriente. No se apaga.' },
    { id: 'base_rec_t16_4',  posicion: 4,  tier: 16, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Faro de Deriva',      lore: 'Avisa a los que ya no llegan. Lo hace igual, porque avisar es su función.' },
    { id: 'base_rec_t16_5',  posicion: 5,  tier: 16, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Riel del Infinito',   lore: 'Una vía sin fin. Lo que va por ella no vuelve, pero sí produce.' },
    { id: 'base_rec_t16_6',  posicion: 6,  tier: 16, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Cámara Clara',        lore: 'La escena donde se miran las cosas y se vuelven reales.' },
    { id: 'base_rec_t16_7',  posicion: 7,  tier: 16, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Calamo de Autor',     lore: 'Escribe lo que ya pasó. Escribe mejor de lo que registra lo que va a pasar.' },
    { id: 'base_rec_t16_8',  posicion: 8,  tier: 16, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Estandarte Roto',     lore: 'El paño cayó, pero el diseño sigue ahí, y lo que dice el diseño es lo que queda.' },
    { id: 'base_rec_t16_9',  posicion: 9,  tier: 16, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Fanal de Pánico',     lore: 'Suena cuando algo va mal. Suena tanto que ya nadie lo escucha, y sigue sonando.' },
    { id: 'base_rec_t16_10', posicion: 10, tier: 16, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Reina de la Ópera',   lore: 'La función más alta del teatro. Cobra más y trabaja más.' },
  ],
  17: [
    { id: 'base_rec_t17_1',  posicion: 1,  tier: 17, pesoStat: 0.92, pesoDrop: 10, nombre: 'Losa de Fundición',   lore: 'La piedra sobre la que los dioses hacían sus cosas. Aun así trabaja.' },
    { id: 'base_rec_t17_2',  posicion: 2,  tier: 17, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Péndulo Boreal',     lore: 'Describe la misma línea desde antes de que hubiera norte. Marca el ritmo.' },
    { id: 'base_rec_t17_3',  posicion: 3,  tier: 17, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Coro Sin Voz',        lore: 'Muchas entidades cantando sin usar la boca. El sonido igual se mueve.' },
    { id: 'base_rec_t17_4',  posicion: 4,  tier: 17, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Filo de la Afirmación', lore: 'El filo que corta lo que no existe. Primero destruye, luego lo tuyo.' },
    { id: 'base_rec_t17_5',  posicion: 5,  tier: 17, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Reloj de Sal',        lore: 'El tiempo medido en granos. Cada grano era una vida, y produce.' },
    { id: 'base_rec_t17_6',  posicion: 6,  tier: 17, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Ojo del Aval',        lore: 'Vigila el final. Lo que vigila, se lo queda.' },
    { id: 'base_rec_t17_7',  posicion: 7,  tier: 17, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Senda Perpetua',     lore: 'El camino que nunca se ha cerrado. Quien lo pisa, no se queda.' },
    { id: 'base_rec_t17_8',  posicion: 8,  tier: 17, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Grano de Valor',     lore: 'La semilla mínima del dinero. De una sola creció todo un imperio.' },    { id: 'base_rec_t17_9',  posicion: 9,  tier: 17, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Rueda de Tuerca',     lore: 'Ajusta lo que está torcido en el universo. Por eso todo cuadra.' },
    { id: 'base_rec_t17_10', posicion: 10, tier: 17, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Yunque Cósmico',      lore: 'Martilla estrellas. Suena lejos, pero el golpe se siente en la base.' },
  ],
  18: [
    { id: 'base_rec_t18_1',  posicion: 1,  tier: 18, pesoStat: 0.92, pesoDrop: 10, nombre: 'Yunque de Yugos',     lore: 'Apoyó reinos mientras aún los había. Ahora sujeta otra cosa.' },
    { id: 'base_rec_t18_2',  posicion: 2,  tier: 18, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Cumbre Imposible',    lore: 'Nadie llegó. Sigue produciendo desde lo alto de lo inalcanzable.' },
    { id: 'base_rec_t18_3',  posicion: 3,  tier: 18, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Confín de Neón',     lore: 'El borde donde el rojo se vuelve azul. Ahí no hay mapa.' },
    { id: 'base_rec_t18_4',  posicion: 4,  tier: 18, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Altar del Silencio',   lore: 'En él se calla todo. El silencio es lo que produce.' },
    { id: 'base_rec_t18_5',  posicion: 5,  tier: 18, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Filo de Viento Solar', lore: 'Corta con el viento del sol. Fino como el aire, útil como el acero.' },
    { id: 'base_rec_t18_6',  posicion: 6,  tier: 18, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Enjambre Sincronizado', lore: 'Todo se mueve a la vez. Nadie da la orden: se hacen cargo.' },
    { id: 'base_rec_t18_7',  posicion: 7,  tier: 18, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Voz del Abismo',     lore: 'Habla desde debajo de los números. Y lo que dice, sube.' },
    { id: 'base_rec_t18_8',  posicion: 8,  tier: 18, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Libro de la Suma',   lore: 'La suma de todas las sumas. Cada hoja se repite en las siguientes.' },
    { id: 'base_rec_t18_9',  posicion: 9,  tier: 18, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Piedra del Voraz',   lore: 'Se come la roca alrededor y crece. Nunca se ha quedado igual.' },
    { id: 'base_rec_t18_10', posicion: 10, tier: 18, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Cúpula Vacía',       lore: 'Un techo sin nada debajo. Por eso no te choca nada al crecer.' },
  ],
  19: [
    { id: 'base_rec_t19_1',  posicion: 1,  tier: 19, pesoStat: 0.92, pesoDrop: 10, nombre: 'Senda del Tiempo',    lore: 'Un tramo de eternidad. Lo que pasa por él, pasa más rápido.' },
    { id: 'base_rec_t19_2',  posicion: 2,  tier: 19, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Vórtice de Caudal',  lore: 'Gira al revés y todo lo que entra sale cambiado. Y entra más.' },
    { id: 'base_rec_t19_3',  posicion: 3,  tier: 19, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Ceniza de Imperios', lore: 'Quedó de algo que llegó muy lejos. La ceniza también llega.' },
    { id: 'base_rec_t19_4',  posicion: 4,  tier: 19, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Marco Indecidible',  lore: 'La frontera entre dos mundos. Produce justo lo que está en el medio.' },
    { id: 'base_rec_t19_5',  posicion: 5,  tier: 19, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Cipo del Ocaso',     lore: 'El último trocito del último día. Es una estrella que no acaba apagarse.' },
    { id: 'base_rec_t19_6',  posicion: 6,  tier: 19, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Colmillo del Silencio', lore: 'Talla el ruido para dejarla pasar. Por eso produce: quita estorbo.' },
    { id: 'base_rec_t19_7',  posicion: 7,  tier: 19, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Trono de la Ausencia', lore: 'Un asiento para el que no está. Ocupa sitio, y el sitio produce.' },
    { id: 'base_rec_t19_8',  posicion: 8,  tier: 19, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Enchufe de Dos Mundos', lore: 'La pieza que enchufa dos mundos distintos. Sin ella no hay juego.' },
    { id: 'base_rec_t19_9',  posicion: 9,  tier: 19, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Cascote de Leyes',   lore: 'Trozo de una regla que se rompió. Se ha guardado como herramienta.' },
    { id: 'base_rec_t19_10', posicion: 10, tier: 19, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Borde del Indecible', lore: 'Donde acaba lo que se entiende y empieza el suelo de la veta.' },
  ],
  20: [
    { id: 'base_rec_t20_1',  posicion: 1,  tier: 20, pesoStat: 0.92, pesoDrop: 10, nombre: 'Fragmento del Todo',  lore: 'Un trozo de todo. Cuanto más alto el tier, más de todo trae.' },
    { id: 'base_rec_t20_2',  posicion: 2,  tier: 20, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Límite',              lore: 'La primera vez que se dijo que aquí no hay más. Y aun así, más.' },
    { id: 'base_rec_t20_3',  posicion: 3,  tier: 20, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Semilla de las Leyes', lore: 'De donde sale toda regla. Se plantó una vez y sigue dando reglas.' },
    { id: 'base_rec_t20_4',  posicion: 4,  tier: 20, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Filo de la Última',   lore: 'El último filo que quedaba. Después de este, no hay otro: este es.' },
    { id: 'base_rec_t20_5',  posicion: 5,  tier: 20, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Nudo del Infinito',   lore: 'El punto donde el infinito se anuda para no desatarse solo.' },
    { id: 'base_rec_t20_6',  posicion: 6,  tier: 20, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Centro del Tiempo',   lore: 'El motor de todo. Lo que mueve, lo mueve él.' },
    { id: 'base_rec_t20_7',  posicion: 7,  tier: 20, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Abadía del Presente', lore: 'Vive en el ahora, que es el único sitio donde las cosas existen.' },
    { id: 'base_rec_t20_8',  posicion: 8,  tier: 20, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Testigo del Yo',      lore: 'Te vio cuando empezaste. Todavía te está viendo producir.' },
    { id: 'base_rec_t20_9',  posicion: 9,  tier: 20, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Sello del Fundador',  lore: 'La marca de quien puso el primer ladrillo. Sigue sosteniendo el resto.' },
    { id: 'base_rec_t20_10', posicion: 10, tier: 20, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Absoluto',            lore: 'No hay más allá de esto. Todo lo que existe está a este lado.' },
  ],
};

/** TODAS LAS BASES DE COMPAÑEROS, ÍNDICE POR TIER Y POSICIÓN. */
export const BASES_COMPANERO: Record<number, BaseOculta[]> = {
  1: [
    { id: 'base_com_t1_1',  posicion: 1,  tier: 1, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Chispa Perdida',       lore: 'Se apagó antes de aprender a brillar. Aún parpadea cuando nadie mira.' },
    { id: 'base_com_t1_2',  posicion: 2,  tier: 1, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Dron Descompuesto',    lore: 'Le sobran piezas y le falta un motivo. Sigue andando por costumbre.' },
    { id: 'base_com_t1_3',  posicion: 3,  tier: 1, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Eco Servil',           lore: 'Repite lo que oye y obedece lo que entiende. A veces acierta.' },
    { id: 'base_com_t1_4',  posicion: 4,  tier: 1, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Unidad Obsoleta',      lore: 'Su modelo ya no se fabrica. Sus mañas, en cambio, no se olvidan.' },
    { id: 'base_com_t1_5',  posicion: 5,  tier: 1, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Dron Estándar',        lore: 'El que sale en el manual. Hace lo que dice la etiqueta, ni más ni menos.' },
    { id: 'base_com_t1_6',  posicion: 6,  tier: 1, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Centinela Menor',      lore: 'Vigila un pasillo y lo vigila bien. Los pasillos importan.' },
    { id: 'base_com_t1_7',  posicion: 7,  tier: 1, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Explorador Aplicado',  lore: 'Anota todo lo que ve y vuelve con el mapa entero. Casi siempre.' },
    { id: 'base_com_t1_8',  posicion: 8,  tier: 1, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Vigía Incansable',     lore: 'No conoce el relevo. Cuando los demás duermen, él cuenta estrellas.' },
    { id: 'base_com_t1_9',  posicion: 9,  tier: 1, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Guardián Leal',        lore: 'Eligió a quién seguir y no ha cambiado de idea desde entonces.' },
    { id: 'base_com_t1_10', posicion: 10, tier: 1, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Heraldo Naciente',     lore: 'Anuncia lo que viene antes de que pase. Hasta ahora, siempre acertó.' },
  ],
  2: [
    { id: 'base_com_t2_1',  posicion: 1,  tier: 2, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Rastro Frío',          lore: 'Siguió una pista de hace un mes. Volvió con las manos vacías y una historia.' },
    { id: 'base_com_t2_2',  posicion: 2,  tier: 2, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Huella Borrosa',       lore: 'Lee huellas que la lluvia ya borró. La mitad de las veces inventa.' },
    { id: 'base_com_t2_3',  posicion: 3,  tier: 2, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Sabueso Inquieto',     lore: 'No se queda quieto ni dormido. Su olfato compensa sus modales.' },
    { id: 'base_com_t2_4',  posicion: 4,  tier: 2, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Rastreador Gris',      lore: 'Se confunde con la niebla y aparece donde duele. Veterano de lo invisible.' },
    { id: 'base_com_t2_5',  posicion: 5,  tier: 2, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Cazador de Rutina',    lore: 'Sale, caza, vuelve. Sin épica y sin fallos: la rutina que alimenta.' },
    { id: 'base_com_t2_6',  posicion: 6,  tier: 2, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Ojeador Fino',         lore: 'Ve la veta antes de que asome. Sus ojos valen más que sus garras.' },
    { id: 'base_com_t2_7',  posicion: 7,  tier: 2, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Sabueso de Presa',     lore: 'Una vez que muerde una pista, solo la suelta con la presa.' },
    { id: 'base_com_t2_8',  posicion: 8,  tier: 2, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Rastreador Espectral', lore: 'Atraviesa muros siguiendo un eco. Lo que persigue ya está cansado.' },
    { id: 'base_com_t2_9',  posicion: 9,  tier: 2, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Cazador Apex',         lore: 'En su territorio nada caza sin su permiso. Casi nada se atreve.' },
    { id: 'base_com_t2_10', posicion: 10, tier: 2, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Depredador Alfa',      lore: 'La cadena alimentaria empieza en él. Lo saben hasta las piedras.' },
  ],
  3: [
    { id: 'base_com_t3_1',  posicion: 1,  tier: 3, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Recluta Abollado',     lore: 'Llegó ayer y ya tiene tres abolladuras. Aprende deprisa, eso sí.' },
    { id: 'base_com_t3_2',  posicion: 2,  tier: 3, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Soldado Raso',         lore: 'Marcha al paso y dispara a la orden. El ejército se sostiene en los rasos.' },
    { id: 'base_com_t3_3',  posicion: 3,  tier: 3, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Infante Férreo',       lore: 'Aguanta la línea cuando la línea ya no aguanta. Hierro con botas.' },
    { id: 'base_com_t3_4',  posicion: 4,  tier: 3, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Veterano Marcado',     lore: 'Cada cicatriz es una lección que no piensa repetir. Tiene muchas.' },
    { id: 'base_com_t3_5',  posicion: 5,  tier: 3, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Sargento de Línea',    lore: 'Grita menos que los demás y consigue más. La tropa lo sabe.' },
    { id: 'base_com_t3_6',  posicion: 6,  tier: 3, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Capitán Blindado',     lore: 'Su blindaje tiene más batallas que la mayoría de los ejércitos.' },
    { id: 'base_com_t3_7',  posicion: 7,  tier: 3, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Campeón de Fragua',    lore: 'Forjado para ganar y templado para durar. No conoce el tercer puesto.' },
    { id: 'base_com_t3_8',  posicion: 8,  tier: 3, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Coloso Juramentado',   lore: 'Juró no retroceder y el suelo le cree. Donde pisa, la línea avanza.' },
    { id: 'base_com_t3_9',  posicion: 9,  tier: 3, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Titán Coronado',       lore: 'La corona pesa, pero reparte su peso entre los que manda.' },
    { id: 'base_com_t3_10', posicion: 10, tier: 3, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Señor de la Forja',    lore: 'Todo acero que toca vuelve mejor. La forja le obedece como un soldado más.' },
  ],
  4: [
    { id: 'base_com_t4_1',  posicion: 1,  tier: 4, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Recluta Tardío',       lore: 'Llegó tarde al reparto y le tocó lo que sobraba. Aun así vino.' },
    { id: 'base_com_t4_2',  posicion: 2,  tier: 4, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Cabo Corto',           lore: 'Manda poco y lo manda mal. Pero manda.' },
    { id: 'base_com_t4_3',  posicion: 3,  tier: 4, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Fusilero Gris',        lore: 'Dispara al montón y el montón cae. Estadística con botas.' },
    { id: 'base_com_t4_4',  posicion: 4,  tier: 4, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Sargento Ronco',       lore: 'De tanto gritar se quedó sin voz y con autoridad.' },
    { id: 'base_com_t4_5',  posicion: 5,  tier: 4, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Oficial de Trámite',   lore: 'Su guerra se libra en formularios. Los gana todos.' },
    { id: 'base_com_t4_6',  posicion: 6,  tier: 4, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Comandante Serio',     lore: 'No sonríe desde la academia. Sus planes tampoco.' },
    { id: 'base_com_t4_7',  posicion: 7,  tier: 4, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Estratega de Campaña', lore: 'Pierde batallas chicas para ganar las que importan.' },
    { id: 'base_com_t4_8',  posicion: 8,  tier: 4, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Mariscal de Campo',    lore: 'El barro le obedece. Las tropas, casi siempre.' },
    { id: 'base_com_t4_9',  posicion: 9,  tier: 4, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Virrey Imperial',      lore: 'Gobierna en nombre de otro y produce en nombre propio.' },
    { id: 'base_com_t4_10', posicion: 10, tier: 4, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Autócrata Supremo',    lore: 'Su palabra es ley, decreto y pronóstico del tiempo.' },
  ],
  5: [
    { id: 'base_com_t5_1',  posicion: 1,  tier: 5, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Ruido de Fondo',       lore: 'Molesta, distrae y a veces avisa. Hay que escucharlo igual.' },
    { id: 'base_com_t5_2',  posicion: 2,  tier: 5, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Interferencia',        lore: 'Se mete en todas las señales. Deja algo útil al salir.' },
    { id: 'base_com_t5_3',  posicion: 3,  tier: 5, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Chispa Suelta',        lore: 'Salta sin permiso y cae donde más rinde.' },
    { id: 'base_com_t5_4',  posicion: 4,  tier: 5, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Tormenta Chica',       lore: 'Cabe en un vaso y rinde como un río.' },
    { id: 'base_com_t5_5',  posicion: 5,  tier: 5, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Desorden Doméstico',   lore: 'Tiene cada cosa en su desorden. Funciona.' },
    { id: 'base_com_t5_6',  posicion: 6,  tier: 5, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Vendaval Útil',        lore: 'Sopla a favor cuando se lo piden bien.' },
    { id: 'base_com_t5_7',  posicion: 7,  tier: 5, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Caos Administrado',    lore: 'El desorden, con planilla. Rinde el doble.' },
    { id: 'base_com_t5_8',  posicion: 8,  tier: 5, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Vacío Rentable',       lore: 'La nada, bien explotada, deja nanitas.' },
    { id: 'base_com_t5_9',  posicion: 9,  tier: 5, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Tormenta Perfecta',    lore: 'Todo sale mal al mismo tiempo y todo sale bien.' },
    { id: 'base_com_t5_10', posicion: 10, tier: 5, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Ojo del Huracán',      lore: 'Calma total en el centro del desastre. Desde ahí se manda.' },
  ],
  6: [
    { id: 'base_com_t6_1',  posicion: 1,  tier: 6, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Peón Avanzado',        lore: 'Llegó al otro lado del tablero. Pide ascenso.' },
    { id: 'base_com_t6_2',  posicion: 2,  tier: 6, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Alfil Torcido',        lore: 'Se mueve en diagonal torcida. Llega igual.' },
    { id: 'base_com_t6_3',  posicion: 3,  tier: 6, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Torre Inclinada',      lore: 'Se inclina pero no cae. Como las buenas torres.' },
    { id: 'base_com_t6_4',  posicion: 4,  tier: 6, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Caballo Cansado',      lore: 'Salta menos, piensa más. Compensa.' },
    { id: 'base_com_t6_5',  posicion: 5,  tier: 6, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Jugador de Manual',    lore: 'Juega lo que dice el libro. El libro funciona.' },
    { id: 'base_com_t6_6',  posicion: 6,  tier: 6, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Táctico de Café',      lore: 'Gana partidas entre sorbo y sorbo.' },
    { id: 'base_com_t6_7',  posicion: 7,  tier: 6, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Estratega de Salón',   lore: 'Sus planes necesitan salón grande. Los tiene.' },
    { id: 'base_com_t6_8',  posicion: 8,  tier: 6, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Gran Maestro',         lore: 'Ve doce jugadas adelante. Juega la decimotercera.' },
    { id: 'base_com_t6_9',  posicion: 9,  tier: 6, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Oráculo de Guerra',    lore: 'Predice el resultado y después lo produce.' },
    { id: 'base_com_t6_10', posicion: 10, tier: 6, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Mente Maestra',        lore: 'El plan era tan bueno que pareció suerte.' },
  ],
  7: [
    { id: 'base_com_t7_1',  posicion: 1,  tier: 7, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Albañil de Turno',     lore: 'Pega ladrillos y no pregunta. Los ladrillos quedan.' },
    { id: 'base_com_t7_2',  posicion: 2,  tier: 7, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Andamio Firme',        lore: 'Sostiene la obra y al obrero. Sin firmas.' },
    { id: 'base_com_t7_3',  posicion: 3,  tier: 7, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Cimiento Hondo',       lore: 'Nadie lo ve y todo se apoya en él.' },
    { id: 'base_com_t7_4',  posicion: 4,  tier: 7, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Muro Ancho',           lore: 'Para pasar hay que rodear. Rodear cansa al enemigo.' },
    { id: 'base_com_t7_5',  posicion: 5,  tier: 7, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Plano Aprobado',       lore: 'Con sello y sin tachaduras. Se construye solo.' },
    { id: 'base_com_t7_6',  posicion: 6,  tier: 7, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Obra en Curso',        lore: 'El cartel dice disculpen. La producción no se disculpa.' },
    { id: 'base_com_t7_7',  posicion: 7,  tier: 7, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Arquitecto Colegiado', lore: 'Matrícula al día y escuadra calibrada.' },
    { id: 'base_com_t7_8',  posicion: 8,  tier: 7, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Urbanista Visionario', lore: 'Dibuja avenidas donde hay baldíos.' },
    { id: 'base_com_t7_9',  posicion: 9,  tier: 7, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Fundador de Ciudades', lore: 'Puso la primera piedra de tres capitales.' },
    { id: 'base_com_t7_10', posicion: 10, tier: 7, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Demiurgo Titular',     lore: 'Hace mundos de oficio. El turno mañana también.' },
  ],
  8: [
    { id: 'base_com_t8_1',  posicion: 1,  tier: 8, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Polvo Contado',        lore: 'Granito por granito. La paciencia también rinde.' },
    { id: 'base_com_t8_2',  posicion: 2,  tier: 8, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Meteoro Chico',        lore: 'Cayó en el patio. Se aprovecha todo.' },
    { id: 'base_com_t8_3',  posicion: 3,  tier: 8, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Satélite Suelto',      lore: 'Perdió su planeta y encontró tu almacén.' },
    { id: 'base_com_t8_4',  posicion: 4,  tier: 8, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Órbita Estable',       lore: 'Da vueltas sin caerse. Como tiene que ser.' },
    { id: 'base_com_t8_5',  posicion: 5,  tier: 8, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Reloj de Arena',       lore: 'Mide el turno grano a grano. Sin atraso.' },
    { id: 'base_com_t8_6',  posicion: 6,  tier: 8, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Calendario Vivo',      lore: 'Tacha los días buenos y repite la receta.' },
    { id: 'base_com_t8_7',  posicion: 7,  tier: 8, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Astrónomo de Guardia', lore: 'Mira arriba para que rindas abajo.' },
    { id: 'base_com_t8_8',  posicion: 8,  tier: 8, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Navegante Estelar',    lore: 'Conoce atajos entre soles.' },
    { id: 'base_com_t8_9',  posicion: 9,  tier: 8, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Señor del Horizonte',  lore: 'Todo lo que se ve, produce. Y se ve lejos.' },
    { id: 'base_com_t8_10', posicion: 10, tier: 8, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Dueño del Mañana',     lore: 'Lo de mañana ya está contado hoy.' },
  ],
  9: [
    { id: 'base_com_t9_1',  posicion: 1,  tier: 9, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Barro Tibio',          lore: 'Aún no es nada y ya promete.' },
    { id: 'base_com_t9_2',  posicion: 2,  tier: 9, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Primera Célula',       lore: 'Se dividió una vez. Sigue dividiendo producción.' },
    { id: 'base_com_t9_3',  posicion: 3,  tier: 9, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Instinto Viejo',       lore: 'Más viejo que el miedo. Más útil también.' },
    { id: 'base_com_t9_4',  posicion: 4,  tier: 9, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Memoria Honda',        lore: 'Recuerda cuando todo esto era barro.' },
    { id: 'base_com_t9_5',  posicion: 5,  tier: 9, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Rito Antiguo',         lore: 'Se hace como siempre se hizo. Funciona como siempre.' },
    { id: 'base_com_t9_6',  posicion: 6,  tier: 9, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Tradición Viva',       lore: 'Pasó de boca en boca sin perder ni un decimal.' },
    { id: 'base_com_t9_7',  posicion: 7,  tier: 9, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Sabio Anterior',       lore: 'Ya lo vio todo y tomó notas.' },
    { id: 'base_com_t9_8',  posicion: 8,  tier: 9, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Voz Originaria',       lore: 'La primera que habló. Todavía se la escucha.' },
    { id: 'base_com_t9_9',  posicion: 9,  tier: 9, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Presencia Primera',    lore: 'Estaba antes que el turno. Seguirá después.' },
    { id: 'base_com_t9_10', posicion: 10, tier: 9, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Entidad Fundadora',    lore: 'Firmó la escritura del universo. Cobra alquiler.' },
  ],
  10: [
    { id: 'base_com_t10_1',  posicion: 1,  tier: 10, pesoStat: 0.92,  pesoDrop: 10, nombre: 'Feligres Nuevo',       lore: 'Llegó el domingo y se quedó toda la semana.' },
    { id: 'base_com_t10_2',  posicion: 2,  tier: 10, pesoStat: 0.93,  pesoDrop: 9,  nombre: 'Monaguillo Aplicado',  lore: 'Toca la campana a horario. Sin falta.' },
    { id: 'base_com_t10_3',  posicion: 3,  tier: 10, pesoStat: 0.94,  pesoDrop: 8,  nombre: 'Sacristán Puntual',    lore: 'Abre el templo antes que el sol.' },
    { id: 'base_com_t10_4',  posicion: 4,  tier: 10, pesoStat: 0.96,  pesoDrop: 7,  nombre: 'Predicador Ronco',     lore: 'Grita la buena nueva: produce.' },
    { id: 'base_com_t10_5',  posicion: 5,  tier: 10, pesoStat: 0.98,  pesoDrop: 6,  nombre: 'Culto Registrado',     lore: 'Papeles en regla y milagros al día.' },
    { id: 'base_com_t10_6',  posicion: 6,  tier: 10, pesoStat: 1.00,  pesoDrop: 5,  nombre: 'Orden Reconocida',     lore: 'Aprobada por unanimidad celestial.' },
    { id: 'base_com_t10_7',  posicion: 7,  tier: 10, pesoStat: 1.02,  pesoDrop: 4,  nombre: 'Sumo de Guardia',      lore: 'El turno sagrado no se interrumpe.' },
    { id: 'base_com_t10_8',  posicion: 8,  tier: 10, pesoStat: 1.04,  pesoDrop: 3,  nombre: 'Voz del Oráculo',      lore: 'Habla poco y acierta siempre.' },
    { id: 'base_com_t10_9',  posicion: 9,  tier: 10, pesoStat: 1.07,  pesoDrop: 2,  nombre: 'Mano Derecha',         lore: 'El brazo ejecutor de lo inevitable.' },
    { id: 'base_com_t10_10', posicion: 10, tier: 10, pesoStat: 1.10,  pesoDrop: 1,  nombre: 'Casi Dios',            lore: 'Le falta tan poco que ni los dioses notan la diferencia.' },
  ],
  11: [
    { id: 'base_com_t11_1',  posicion: 1,  tier: 11, pesoStat: 0.92, pesoDrop: 10, nombre: 'Órbita Fría',          lore: 'Gira alrededor de algo que no está caliente. Produce por inercia.' },
    { id: 'base_com_t11_2',  posicion: 2,  tier: 11, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Esfera de Deriva',     lore: 'Va sin rumbo fijo y por eso pega con todo. Rara vez falla.' },
    { id: 'base_com_t11_3',  posicion: 3,  tier: 11, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Rotación Residual',    lore: 'Sigue girando aunque le quites el motor. Es lo que más cobra.' },
    { id: 'base_com_t11_4',  posicion: 4,  tier: 11, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Nodo Aislado',         lore: 'No habla con nadie. Trabaja tanto que ni se entera de que está solo.' },
    { id: 'base_com_t11_5',  posicion: 5,  tier: 11, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Cuadrilla Errante',    lore: 'Busca equipo cada turno. Cuando lo encuentra, funciona como el mejor.' },
    { id: 'base_com_t11_6',  posicion: 6,  tier: 11, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Módulo Central',       lore: 'El que conecta todos los demás. Sin él, los otros no hacen nada.' },
    { id: 'base_com_t11_7',  posicion: 7,  tier: 11, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Engranaje de Reserva', lore: 'Nunca es el primero, pero cuando algo cae, es el que queda.' },
    { id: 'base_com_t11_8',  posicion: 8,  tier: 11, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Sensor Silencioso',    lore: 'Detecta lo que se acerca y avisa. Avisa tanto que ya es ruido de fondo.' },
    { id: 'base_com_t11_9',  posicion: 9,  tier: 11, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Impulsor Pesado',      lore: 'Tarda en arrancar y después no para. El esfuerzo se paga.' },
    { id: 'base_com_t11_10', posicion: 10, tier: 11, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Carga de Pico',       lore: 'Trae la energía de golpe, toda junta y de una vez.' },
  ],
  12: [
    { id: 'base_com_t12_1',  posicion: 1,  tier: 12, pesoStat: 0.92, pesoDrop: 10, nombre: 'Enlace de Soporte',    lore: 'Conecta dos bases lejanas. Lo que llega por él llega entero.' },
    { id: 'base_com_t12_2',  posicion: 2,  tier: 12, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Torreta de Vigía',     lore: 'No dispara: mira. Y lo que mira, deja de moverse.' },
    { id: 'base_com_t12_3',  posicion: 3,  tier: 12, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Esfera de Choque',    lore: 'Bloquea lo que pasa cerca. Lo que bloquea, lo retiene para ti.' },
    { id: 'base_com_t12_4',  posicion: 4,  tier: 12, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Zángano de Fusión',    lore: 'Trae pedazos sueltos y los junta. Lo que junta vale más que el todo.' },
    { id: 'base_com_t12_5',  posicion: 5,  tier: 12, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Red de Refuerzo',      lore: 'Sujeta lo que se cae. Nadie la ve hasta que algo no se cae.' },
    { id: 'base_com_t12_6',  posicion: 6,  tier: 12, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Vórtice de Carga',    lore: 'Gira y arranca lo que tiene alrededor. Sigue girando después.' },
    { id: 'base_com_t12_7',  posicion: 7,  tier: 12, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Nodo de Cruce',       lore: 'Está en la unión de tres caminos. Lo que pasa por él va a más sitios.' },
    { id: 'base_com_t12_8',  posicion: 8,  tier: 12, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Bobina de Satélite',   lore: 'Gira alrededor de un planeta imaginario. Produce por centrífuga.' },
    { id: 'base_com_t12_9',  posicion: 9,  tier: 12, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Reflector Doble',     lore: 'No deja pasar lo que viene de arriba. Lo que rebota es tuyo.' },
    { id: 'base_com_t12_10', posicion: 10, tier: 12, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Faro de Apogeo',      lore: 'Avisa de lo que viene, desde arriba de todo. Lo que avisa, lo trae.' },
  ],
  13: [
    { id: 'base_com_t13_1',  posicion: 1,  tier: 13, pesoStat: 0.92, pesoDrop: 10, nombre: 'Antena de Alcance',    lore: 'Alcanza cosas que no se ven. Lo que alcanza, lo trae.' },
    { id: 'base_com_t13_2',  posicion: 2,  tier: 13, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Sensor Primario',     lore: 'El primero en notar que algo no cuadra. Y lo corrige solo.' },
    { id: 'base_com_t13_3',  posicion: 3,  tier: 13, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Cubo de Memoria',     lore: 'Guarda lo que ya pasó. Lo usa para que no vuelva a pasar.' },
    { id: 'base_com_t13_4',  posicion: 4,  tier: 13, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Rotación de Órbita',   lore: 'El movimiento más limpio que existe. No desperdicia nada.' },
    { id: 'base_com_t13_5',  posicion: 5,  tier: 13, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Módulo de Choque',    lore: 'Absorbe el golpe que iba a romperlo. Por eso sobrevive.' },
    { id: 'base_com_t13_6',  posicion: 6,  tier: 13, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Regulador de Potencia', lore: 'Ajusta la fuerza al punto exacto. Ni un punto de más.' },
    { id: 'base_com_t13_7',  posicion: 7,  tier: 13, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Tejedor de Redes',    lore: 'Conecta lo que estaba suelto. Lo conectado rinde más que lo suelto.' },
    { id: 'base_com_t13_8',  posicion: 8,  tier: 13, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Sonda del Vacío',     lore: 'Manda algo al hueco y trae lo que encuentre. Nunca vuelve vacía.' },
    { id: 'base_com_t13_9',  posicion: 9,  tier: 13, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Emisor de Pulso',     lore: 'Emite una vez y ya. Lo que emite, no se recoge.' },
    { id: 'base_com_t13_10', posicion: 10, tier: 13, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Núcleo de Continuidad', lore: 'Lo que mantiene encendido todo lo demás. Si para, para todo.' },
  ],
  14: [
    { id: 'base_com_t14_1',  posicion: 1,  tier: 14, pesoStat: 0.92, pesoDrop: 10, nombre: 'Acomodador',          lore: 'No decide: aplica. Y aplica bien.' },
    { id: 'base_com_t14_2',  posicion: 2,  tier: 14, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Sincronizador',       lore: 'Pone a la misma velocidad lo que iba a distinto ritmo. Y lo hace mejor.' },
    { id: 'base_com_t14_3',  posicion: 3,  tier: 14, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Batería de Fondo',    lore: 'Carga cuando nadie mira. Para cuando todos miran.' },
    { id: 'base_com_t14_4',  posicion: 4,  tier: 14, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Malla de Sustain',    lore: 'Sujeta la estructura entera. Es lo que no se ve cuando todo funciona.' },
    { id: 'base_com_t14_5',  posicion: 5,  tier: 14, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Cámara de Compresión', lore: 'Hace caber más de lo que debería. Lo que cabe, produce más.' },
    { id: 'base_com_t14_6',  posicion: 6,  tier: 14, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Cargador de Umbral',  lore: 'Se enciende justo en el punto donde los demás se rinden.' },
    { id: 'base_com_t14_7',  posicion: 7,  tier: 14, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Vía de Draft',        lore: 'Se lleva lo que sobra y lo pone donde falta. El juego en sí.' },
    { id: 'base_com_t14_8',  posicion: 8,  tier: 14, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Nodo de Recuperación', lore: 'Trae de vuelta lo que se cayó. Lo que recupera, no se pierde.' },
    { id: 'base_com_t14_9',  posicion: 9,  tier: 14, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Filtro de Pureza',    lore: 'Quita lo que no sirve y deja lo que sí. Lo que queda vale más.' },
    { id: 'base_com_t14_10', posicion: 10, tier: 14, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Motor Sin Tope',     lore: 'Funciona sin límite porque no tiene tope. Ni idea de por qué aguanta.' },
  ],
  15: [
    { id: 'base_com_t15_1',  posicion: 1,  tier: 15, pesoStat: 0.92, pesoDrop: 10, nombre: 'Dardo de Rastreo',    lore: 'Encuentra el objetivo donde esté y no suelta hasta llegar.' },
    { id: 'base_com_t15_2',  posicion: 2,  tier: 15, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Enredadera Mecánica', lore: 'Se agarra a lo que pasa y no se deja quitar. Produce agarrada.' },
    { id: 'base_com_t15_3',  posicion: 3,  tier: 15, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Abridor de Rutas',    lore: 'Quita lo que tapaba el camino. Lo que había debajo es suyo.' },
    { id: 'base_com_t15_4',  posicion: 4,  tier: 15, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Centinela de Pozo',  lore: 'Vigila el fondo del pozo. Lo que sube, lo pasa.' },
    { id: 'base_com_t15_5',  posicion: 5,  tier: 15, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Prensor de Rentas',   lore: 'Aprieta lo justo. Ni rompe, ni deja pasar nada.' },
    { id: 'base_com_t15_6',  posicion: 6,  tier: 15, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Sembrador de Posibles', lore: 'Planta una semilla donde no había y espera. Es lento y funciona.' },
    { id: 'base_com_t15_7',  posicion: 7,  tier: 15, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Cascada de Potencia', lore: 'Cae de nivel en nivel. Cada nivel multiplica el anterior.' },
    { id: 'base_com_t15_8',  posicion: 8,  tier: 15, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Cinta de Montaje',    lore: 'No para. Lo que entra por un lado, sale por otro, siempre.' },
    { id: 'base_com_t15_9',  posicion: 9,  tier: 15, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Rega Sin Raíces',     lore: 'Riega sin estar plantado. Lo que riega, crece sin él.' },
    { id: 'base_com_t15_10', posicion: 10, tier: 15, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Filtro de Sueño',    lore: 'Deja pasar lo que sueñas y para el resto. Lo que pasa, produce.' },
  ],
  16: [
    { id: 'base_com_t16_1',  posicion: 1,  tier: 16, pesoStat: 0.92, pesoDrop: 10, nombre: 'Pared de Contención', lore: 'No deja pasar el problema. Y así no pasa.' },
    { id: 'base_com_t16_2',  posicion: 2,  tier: 16, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Faro Interior',      lore: 'Ilumina lo de dentro sin hacerte perder lo de fuera.' },
    { id: 'base_com_t16_3',  posicion: 3,  tier: 16, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Relevo Indefinido',  lore: 'Cuando uno para, empieza otro. No hay momento en que esté parado.' },
    { id: 'base_com_t16_4',  posicion: 4,  tier: 16, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Rueda de los Días',   lore: 'Lo que fue, es y será. Cuando la rueda gira, produce.' },
    { id: 'base_com_t16_5',  posicion: 5,  tier: 16, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Nudo de Sobrecarga',  lore: 'Carga más de lo que debería. Aguanta más de lo que debería.' },
    { id: 'base_com_t16_6',  posicion: 6,  tier: 16, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Punto de Encuentro',  lore: 'Donde todo se junta para seguir. Lo que se junta, produce.' },
    { id: 'base_com_t16_7',  posicion: 7,  tier: 16, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Lector de Nombres',   lore: 'Sabe cómo se llama cada cosa. Lo que nombra, ya es suyo.' },
    { id: 'base_com_t16_8',  posicion: 8,  tier: 16, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Escriba de Turnos',   lore: 'Ordena lo que toca. Lo que está ordenado, rinde.' },
    { id: 'base_com_t16_9',  posicion: 9,  tier: 16, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Ascensor Continuo',  lore: 'Sube lo que le mandan y trae lo que le piden. Sin quejarse.' },
    { id: 'base_com_t16_10', posicion: 10, tier: 16, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Coro del Relevo',    lore: 'Muchos cantando en el mismo compás. Lo que coordinan, suena mayor.' },
  ],
  17: [
    { id: 'base_com_t17_1',  posicion: 1,  tier: 17, pesoStat: 0.92, pesoDrop: 10, nombre: 'Palanca de Vigencia', lore: 'Un gesto mínimo cambia el resultado entero. Y lo hace cada vez.' },
    { id: 'base_com_t17_2',  posicion: 2,  tier: 17, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Vena de la Cuadrícula', lore: 'Conduce por donde pasa todo. Lo que conduce, se produce.' },
    { id: 'base_com_t17_3',  posicion: 3,  tier: 17, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Forja Silente',      lore: 'Fabrica sin ruido. Nadie sabe qué hace hasta que aparece lo hecho.' },
    { id: 'base_com_t17_4',  posicion: 4,  tier: 17, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Ojo del Alba',       lore: 'Espera el momento justo y lo ve venir antes que nadie.' },
    { id: 'base_com_t17_5',  posicion: 5,  tier: 17, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Motor de la Senda',  lore: 'Empuja lo que va por la senda. Lo que empuja, llega.' },
    { id: 'base_com_t17_6',  posicion: 6,  tier: 17, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Tiesa del Torno',    lore: 'Da vueltas y recoge. Lo que recoge, ordena.' },
    { id: 'base_com_t17_7',  posicion: 7,  tier: 17, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Nido de Tesorería',  lore: 'Guarda lo que sobra y lo hace crecer. Lo guardado, produce.' },
    { id: 'base_com_t17_8',  posicion: 8,  tier: 17, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Abanico de Aire',    lore: 'Mueve lo que no se mueve. El aire también empuja.' },
    { id: 'base_com_t17_9',  posicion: 9,  tier: 17, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Torre de Timbre',    lore: 'No vigila: avisa de verdad. Suena distinto a los demás porque es otro.' },
    { id: 'base_com_t17_10', posicion: 10, tier: 17, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Rejilla de Entrada', lore: 'Deja entrar justo lo que debe. Ni una gota más, ni una menos.' },
  ],
  18: [
    { id: 'base_com_t18_1',  posicion: 1,  tier: 18, pesoStat: 0.92, pesoDrop: 10, nombre: 'Molinillo de Niebla', lore: 'Muele lo que no se ve hasta hacerlo visible. Lo visible, produce.' },
    { id: 'base_com_t18_2',  posicion: 2,  tier: 18, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Guardián del Dintel', lore: 'No deja pasar lo que no debe. Y sabe lo que no debe sin que se lo digan.' },
    { id: 'base_com_t18_3',  posicion: 3,  tier: 18, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Rueda de Babel',     lore: 'Traduce lo que no se entiende a lo que sí. Lo traducido, se usa.' },
    { id: 'base_com_t18_4',  posicion: 4,  tier: 18, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Lámina Quieta',     lore: 'Refleja sin ruido. Lo que refleja, vuelve.' },
    { id: 'base_com_t18_5',  posicion: 5,  tier: 18, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Nodo del Despertar', lore: 'Espera a que algo empiece, y entonces está listo. Siempre.' },
    { id: 'base_com_t18_6',  posicion: 6,  tier: 18, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Cámara de Amortiguación', lore: 'Baja el golpe para que no rompa. Sin romper, aguanta más.' },
    { id: 'base_com_t18_7',  posicion: 7,  tier: 18, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Aliento de Cobalto', lore: 'Sostiene lo que se está apagando. No lo revive, pero lo alarga.' },
    { id: 'base_com_t18_8',  posicion: 8,  tier: 18, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Cincel de Aristas',  lore: 'Quita lo que sobra con precisión. Lo que queda, es exactamente justo.' },
    { id: 'base_com_t18_9',  posicion: 9,  tier: 18, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Red de Presión',     lore: 'Mete presión donde hace falta. Lo que presiona, rinde.' },
    { id: 'base_com_t18_10', posicion: 10, tier: 18, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Silbar del Telón',   lore: 'El último sonido antes de empezar. Lo que anuncia, ocurre.' },
  ],
  19: [
    { id: 'base_com_t19_1',  posicion: 1,  tier: 19, pesoStat: 0.92, pesoDrop: 10, nombre: 'Hilo del Reloj',     lore: 'Une todos los momentos. Lo que une, no se separa.' },
    { id: 'base_com_t19_2',  posicion: 2,  tier: 19, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Ónix del Presente',  lore: 'El negro que se puede tocar. No lo puedes tocar, pero produce.' },
    { id: 'base_com_t19_3',  posicion: 3,  tier: 19, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Brújula del Fondo',  lore: 'Siempre apunta a donde hay más. Donde hay más, hay más.' },
    { id: 'base_com_t19_4',  posicion: 4,  tier: 19, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Torno en Espiral',  lore: 'Lleva lo que hay por el sitio donde hace falta. Y por el tuyo.' },
    { id: 'base_com_t19_5',  posicion: 5,  tier: 19, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Materia Densa',     lore: 'Densa por naturaleza. Pesa más y produce más por el mismo sitio.' },
    { id: 'base_com_t19_6',  posicion: 6,  tier: 19, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Susurro del Confín', lore: 'Desde el borde de todo. Lo que viene de ahí, viene grande.' },
    { id: 'base_com_t19_7',  posicion: 7,  tier: 19, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Nucleótido Futuro',  lore: 'La receta de lo que todavía no es. Cuando crezca, es lo que toque.' },
    { id: 'base_com_t19_8',  posicion: 8,  tier: 19, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Diablillo del Minutero', lore: 'Lo pequeño que hace grande. El diablillo, pero del reloj.' },
    { id: 'base_com_t19_9',  posicion: 9,  tier: 19, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Abrazo de la Madre', lore: 'Sostiene sin pedir. Lo que sostiene, no se cae.' },
    { id: 'base_com_t19_10', posicion: 10, tier: 19, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Límite del Uno',     lore: 'El borde del uno. Todo lo que pasa, pasa por aquí.' },
  ],
  20: [
    { id: 'base_com_t20_1',  posicion: 1,  tier: 20, pesoStat: 0.92, pesoDrop: 10, nombre: 'Ser del Antes',      lore: 'Empezó antes que todos y no se acaba nunca. Cobrando mientras tanto.' },
    { id: 'base_com_t20_2',  posicion: 2,  tier: 20, pesoStat: 0.93, pesoDrop: 9,  nombre: 'Número del Principio', lore: 'El primer número. Del que salen todos los demás.' },
    { id: 'base_com_t20_3',  posicion: 3,  tier: 20, pesoStat: 0.94, pesoDrop: 8,  nombre: 'Memoria del Mundo', lore: 'Recuerda todo lo que pasó. Lo que recuerda, existe otra vez.' },
    { id: 'base_com_t20_4',  posicion: 4,  tier: 20, pesoStat: 0.96, pesoDrop: 7,  nombre: 'Filo de los Filos',  lore: 'El filo que corta los demás filos. Con este, no hay discusión.' },
    { id: 'base_com_t20_5',  posicion: 5,  tier: 20, pesoStat: 0.98, pesoDrop: 6,  nombre: 'Mano que Coge',      lore: 'Recoge lo que hay. Lo que coge, es tuyo antes de que lo cojas.' },
    { id: 'base_com_t20_6',  posicion: 6,  tier: 20, pesoStat: 1.00, pesoDrop: 5,  nombre: 'Fuerza del Silencio', lore: 'Trabaja sin ruido y sin que se note. Por eso nadie para.' },
    { id: 'base_com_t20_7',  posicion: 7,  tier: 20, pesoStat: 1.02, pesoDrop: 4,  nombre: 'Cuerpo del Tiempo',  lore: 'El tiempo tiene un cuerpo, y ese cuerpo trabaja.' },
    { id: 'base_com_t20_8',  posicion: 8,  tier: 20, pesoStat: 1.04, pesoDrop: 3,  nombre: 'Ojo que Cierra',     lore: 'Cuando cierra, todo lo que había dentro se guarda.' },
    { id: 'base_com_t20_9',  posicion: 9,  tier: 20, pesoStat: 1.07, pesoDrop: 2,  nombre: 'Abridor del Cierre', lore: 'Abre lo que está cerrado. Y lo que se abre, produce.' },
    { id: 'base_com_t20_10', posicion: 10, tier: 20, pesoStat: 1.10, pesoDrop: 1,  nombre: 'Reden',              lore: 'El todo. Lo único que puede decirse que no tiene parte.' },
  ],
};

/** La tabla del lado pedido. */
export function tablaDe(lado: LadoBase): Record<number, BaseOculta[]> {
  return lado === 'recolector' ? BASES_RECOLECTOR : BASES_COMPANERO;
}

/** Busca una base por su ID, en los dos lados. */
export function basePorId(id: string): BaseOculta | undefined {
  for (const tabla of [BASES_RECOLECTOR, BASES_COMPANERO]) {
    for (const tier of Object.values(tabla)) {
      const b = tier.find(b => b.id === id);
      if (b) return b;
    }
  }
  return undefined;
}

/** Devuelve la base en la posición `pos` (1..10) del `tier` y el lado. */
export function basePorPosicion(tier: number, posicion: number, lado: LadoBase): BaseOculta | undefined {
  return tablaDe(lado)[tier]?.[posicion - 1];
}

/** El multiplicador de base que se aplica en la fórmula. */
export function multiplicadorDeBase(base: BaseOculta): number {
  return base.pesoStat;
}

/** El multiplicador de una base por su ID, o 1 si no se conoce (migración F74). */
export function pesoStatDe(baseId: string | undefined | null): number {
  if (!baseId) return 1;
  return basePorId(baseId)?.pesoStat ?? 1;
}

/** La posición de una base por su ID, o 6 (×1,00, neutro) si no se conoce. */
export function posicionDeBase(baseId: string | undefined | null): number {
  if (!baseId) return 6;
  const pos = basePorId(baseId)?.posicion;
  return typeof pos === 'number' && pos >= 1 && pos <= 10 ? Math.floor(pos) : 6;
}

/**
 * LA POSICIÓN FORJADA ES LA MEDIA, SIN BONUS (F74).
 *
 * Dos bases 10 dan un 10 y dos 5 dan un 5: promediar nunca sube, igual que el
 * potencial. La media se redondea al entero más cercano y se acota a 1..10.
 * Sin base (item viejo sin migrar) cuenta como 6, la neutra de ×1,00.
 */
export function posicionFusionada(
  posA: number | undefined | null,
  posB: number | undefined | null
): number {
  const a = Number(posA);
  const b = Number(posB);
  const pa = Number.isFinite(a) ? a : 6;
  const pb = Number.isFinite(b) ? b : 6;
  return Math.min(10, Math.max(1, Math.round((pa + pb) / 2)));
}

/** Genera una base aleatoria del `tier` y el lado, usando los pesos de drop. */
export function baseAleatoria(
  tier: number,
  lado: LadoBase,
  rng: () => number = Math.random
): BaseOculta {
  const bases = tablaDe(lado)[tier];
  if (!bases || !bases.length) {
    throw new Error(`No hay bases definidas para el tier ${tier}`);
  }
  const total = bases.reduce((s, b) => s + b.pesoDrop, 0);
  let r = rng() * total;
  for (const b of bases) {
    r -= b.pesoDrop;
    if (r <= 0) return b;
  }
  return bases[bases.length - 1]; // fallback
}

/**
 * Como `baseAleatoria()`, pero devuelve `null` si el tier no tiene tabla (T11+)
 * en vez de lanzar. La forja infinita llega donde no hay contenido: el item
 * sale neutro, no roto, y la partida no se interrumpe por una base.
 */
export function baseAleatoriaSegura(
  tier: number,
  lado: LadoBase,
  rng: () => number = Math.random
): BaseOculta | null {
  const bases = tablaDe(lado)[tier];
  if (!bases || !bases.length) return null;
  return baseAleatoria(tier, lado, rng);
}

/** Todas las bases aplanadas, los dos lados, para los bancos. */
export const TODAS_LAS_BASES: BaseOculta[] = [
  ...Object.values(BASES_RECOLECTOR).flat(),
  ...Object.values(BASES_COMPANERO).flat()
];
