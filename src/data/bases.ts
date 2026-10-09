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
