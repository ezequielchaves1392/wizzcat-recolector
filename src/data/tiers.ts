// ==========================================================================
// Tiers de companeros y recolectores.
//
// Curva de poder POR TIER (no por nivel). Antes cada tier daba +5 fijos mientras
// el coste se duplicaba: el coste por punto de poder pasaba de 667 (T1) a 21.333
// (T10), 32x peor, asi que el jugador optimo solo compraba T1 y los tiers altos
// eran trampas. Ahora el poder crece ~1.62x por tier, ligeramente por encima
// del 1.5x del coste, para que subir de tier siga mereciendo la pena.
//
// Vive en data/ porque lo usan el crafteo, el mercado y la valoracion, ademas
// del game loop.
// ==========================================================================

export const TIER_POWER = [
  { tier: 1, base: 6 },
  { tier: 2, base: 10 },
  { tier: 3, base: 16 },
  { tier: 4, base: 26 },
  { tier: 5, base: 42 },
  { tier: 6, base: 68 },
  { tier: 7, base: 110 },
  { tier: 8, base: 178 },
  { tier: 9, base: 288 },
  { tier: 10, base: 466 }
];

export const TIER_SYSTEM = {
  // Rango de poder por tier: [min, max]
  ranges: {
    1: [5, 7],
    2: [8, 12],
    3: [13, 19],
    4: [21, 31],
    5: [34, 50],
    6: [55, 81],
    7: [88, 132],
    8: [142, 214],
    9: [230, 346],
    10: [373, 559]
  } as Record<number, [number, number]>,
  // Nombres de compañeros por tier (de base a imponente)
  companionNames: {
    1: ['Dron Explorador', 'Dron Centinela', 'Dron Mensajero'],
    2: ['Cazador Nocturno', 'Rastreador Fantasma', 'Explorador Estelar'],
    3: ['Guerrero Mecánico', 'Titán de Acero', 'Coloso de Batalla'],
    4: ['Señor de la Guerra', 'Destruyente Imperial', 'Aniquilador Prime'],
    5: ['Avatar del Caos', 'Heraldo del Vacío', 'Portador del Trueno'],
    6: ['Supremo Estratega', 'Maestro de Batallas', 'General Supremo'],
    7: ['Forjador de Mundos', 'Creador de Imperios', 'Arquitecto Cósmico'],
    8: ['Devorador de Estrellas', 'Señor del Tiempo', 'Amo del Espacio'],
    9: ['Entidad Primordial', 'Ser Trascendente', 'Conciencia Universal'],
    10: ['Dios de la Guerra', 'El Omnipotente', 'El Infinito']
  },
  // Nombres de recolectores por tier
  collectorNames: {
    1: ['Blaster Láser', 'Pistola de Plasma', 'Rifle de Pulso'],
    2: ['Cañón de Partículas', 'Lanzador de Energía', 'Desintegrador Táctico'],
    3: ['Aniquilador Cuántico', 'Devorador de Materia', 'Coloso de Fuego'],
    4: ['Guadaña del Vacío', 'Maldición Estelar', 'Juicio Final'],
    5: ['Apocalipsis', 'Armagedón', 'Ragnarök'],
    6: ['Excalibur', 'Mjolnir', 'Gungnir'],
    7: ['Lanza del Destino', 'Espada del Crepúsculo', 'Hacha del Caos'],
    8: ['Corte del Tiempo', 'Filo del Infinito', 'Navaja Cósmica'],
    9: ['Recolector del Apocalipsis', 'Instrumento de la Muerte', 'Herencia de los Dioses'],
    10: ['El Principio y El Fin', 'La Última Palabra', 'El Todo y La Nada']
  },
  // Rareza por tier
  rarityByTier: {
    1: 'Común',
    2: 'Común',
    3: 'Raro',
    4: 'Raro',
    5: 'Épico',
    6: 'Épico',
    7: 'Legendario',
    8: 'Legendario',
    9: 'Mítico',
    10: 'Divino'
  }
};

/**
 * Rango de poder de un tier, con fórmula más allá del 10 (forja infinita).
 *
 * 1-10: la tabla literal, que es el balance medido y no se toca. 11+: ×1,62
 * por tier desde el T10, la misma razón a la que crece el poder del 1 al 10.
 * Sin esta fórmula, un T11 forjado no tendría rango y caería en el `[1, 5]`
 * de reserva: un T11 con daño de T1.
 */
export function rangoDePoder(tier: number): [number, number] {
  const t = Math.max(1, Math.floor(tier) || 1);
  const literal = (TIER_SYSTEM.ranges as Record<number, [number, number]>)[t];
  if (literal) return literal;
  const RAZON = 1.62;
  const [min10, max10] = TIER_SYSTEM.ranges[10];
  const k = Math.pow(RAZON, t - 10);
  return [Math.max(1, Math.round(min10 * k)), Math.max(2, Math.round(max10 * k))];
}

/**
 * Rareza de un tier: la tabla hasta el 10, Divino de ahí en adelante.
 *
 * Antes se recortaba con `Math.min(tier, 10)` en cada sitio que la leía, y
 * cada recorte era una copia de la misma regla. La rareza máxima sigue siendo
 * la máxima: un T15 es Divino, no una rareza nueva que nadie enseña.
 */
export function rarezaDeTier(tier: number): string {
  const t = Math.max(1, Math.floor(tier) || 1);
  return (TIER_SYSTEM.rarityByTier as Record<number, string>)[t] ?? 'Divino';
}

// ==========================================================================
// Lore · una línea por nombre
//
// F13. Cada nombre de compañero y de recolector tiene su descripción, con la
// misma clave exacta que las tablas de arriba. Los exclusivos de caja y el
// Artillero Táctico (que solo sale de la caja rara) también tienen la suya:
// si un nombre puede llegar al almacén, tiene que tener lore (D4).
//
// El TIPO del compañero no va en el texto: lo pone la ficha al lado, con la
// cifra que cobra (`lineaTipoCompanion`). Un texto sobre "la tierra se
// quiebra" no dice si produce sin mirar o solo al clickear, y eso es lo que
// el jugador necesita para decidir si lo equipa.
// ==========================================================================

export const LORE: Record<string, string> = {
  // ---------------------------------------------------------- COMPAÑEROS T1
  'Dron Explorador': 'Cartografía cada rincón de la base antes de que amanezca.',
  'Dron Centinela': 'No parpadea. No duerme. Vigila tu producción.',
  'Dron Mensajero': 'Lleva tus nanitas de un nodo a otro sin perder ni una.',
  // ---------------------------------------------------------- COMPAÑEROS T2
  'Cazador Nocturno': 'Caza vetas de nanitas dormidas bajo la Cyber Base.',
  'Rastreador Fantasma': 'Sigue rastros de energía que nadie más puede ver.',
  'Explorador Estelar': 'Trae polvo de estrellas para fundir en tu reserva.',
  // ---------------------------------------------------------- COMPAÑEROS T3
  'Guerrero Mecánico': 'Un veterano de cien batallas de chatarra.',
  'Titán de Acero': 'Su sola presencia ordena la línea de extracción.',
  'Coloso de Batalla': 'Donde pisa, la tierra entrega lo que esconde.',
  'Artillero Táctico': 'Calcula cada salva para no desperdiciar ni un gramo.',
  // ---------------------------------------------------------- COMPAÑEROS T4
  'Señor de la Guerra': 'Conquistó tres sectores y los puso a producir.',
  'Destruyente Imperial': 'Desmonta defensas rivales y se queda el botín.',
  'Aniquilador Prime': 'El primero de su serie. Los demás son copias.',
  // ---------------------------------------------------------- COMPAÑEROS T5
  'Avatar del Caos': 'Siembra desorden y cosecha lo que cae al suelo.',
  'Heraldo del Vacío': 'Anuncia la nada, y la nada paga bien.',
  'Portador del Trueno': 'Cada tormenta deja un reguero de nanitas.',
  // ---------------------------------------------------------- COMPAÑEROS T6
  'Supremo Estratega': 'Gana la partida antes de que empiece el turno.',
  'Maestro de Batallas': 'Convierte cada escaramuza en materia prima.',
  'General Supremo': 'Sus tropas extraen incluso dormidas.',
  // ---------------------------------------------------------- COMPAÑEROS T7
  'Forjador de Mundos': 'Su poder de extracción no se había visto nunca: la tierra se quiebra a su paso.',
  'Creador de Imperios': 'Levanta fundiciones donde otros ven desierto.',
  'Arquitecto Cósmico': 'Dibuja la base en las estrellas y la base obedece.',
  // ---------------------------------------------------------- COMPAÑEROS T8
  'Devorador de Estrellas': 'Se alimenta de soles y devuelve nanitas.',
  'Señor del Tiempo': 'Recoge hoy lo que producirás mañana.',
  'Amo del Espacio': 'Dobla la distancia entre la veta y tu almacén.',
  // ---------------------------------------------------------- COMPAÑEROS T9
  'Entidad Primordial': 'Existía antes que la primera nanita.',
  'Ser Trascendente': 'Opera en un plano donde todo ya es tuyo.',
  'Conciencia Universal': 'Piensa en tu producción y la producción ocurre.',
  // ---------------------------------------------------------- COMPAÑEROS T10
  'Dios de la Guerra': 'La batalla es su culto y el botín su ofrenda.',
  'El Omnipotente': 'No necesita razones. Solo resultados.',
  'El Infinito': 'Su turno no termina nunca. Tu ingreso tampoco.',
  // --------------------------------------------------------- RECOLECTORES T1
  'Blaster Láser': 'El primer clic de todo operativo.',
  'Pistola de Plasma': 'Calienta la veta antes de partirla.',
  'Rifle de Pulso': 'Dispara al ritmo de tu dedo.',
  // --------------------------------------------------------- RECOLECTORES T2
  'Cañón de Partículas': 'Acelera lo pequeño hasta romper lo grande.',
  'Lanzador de Energía': 'Cada descarga abre una grieta nueva.',
  'Desintegrador Táctico': 'Desarma la materia pieza por pieza.',
  // --------------------------------------------------------- RECOLECTORES T3
  'Aniquilador Cuántico': 'Borra la distancia entre tu mano y la veta.',
  'Devorador de Materia': 'Mastica roca y escupe nanitas.',
  'Coloso de Fuego': 'Funde la montaña y recoge lo que brilla.',
  // --------------------------------------------------------- RECOLECTORES T4
  'Guadaña del Vacío': 'Siega lo que el vacío deja atrás.',
  'Maldición Estelar': 'Una estrella apagada con rencor productivo.',
  'Juicio Final': 'Dicta sentencia sobre cada veta.',
  // --------------------------------------------------------- RECOLECTORES T5
  'Apocalipsis': 'El fin del mundo, en tu mano.',
  'Armagedón': 'La última batalla se libra en cada clic.',
  'Ragnarök': 'Los dioses cayeron. Sus restos rinden.',
  // --------------------------------------------------------- RECOLECTORES T6
  'Excalibur': 'Solo un digno la empuña. Eres tú.',
  'Mjolnir': 'El trueno obedece a quien la levanta.',
  'Gungnir': 'Nunca falla. Literalmente.',
  // --------------------------------------------------------- RECOLECTORES T7
  'Lanza del Destino': 'Apunta al futuro y el futuro paga.',
  'Espada del Crepúsculo': 'Corta entre el día y la noche de la veta.',
  'Hacha del Caos': 'El desorden, bien dirigido, produce.',
  // --------------------------------------------------------- RECOLECTORES T8
  'Corte del Tiempo': 'Extrae del ayer para gastar hoy.',
  'Filo del Infinito': 'No tiene borde. Tiene propósito.',
  'Navaja Cósmica': 'Afeita nebulosas enteras.',
  // --------------------------------------------------------- RECOLECTORES T9
  'Recolector del Apocalipsis': 'Cosecha el fin de los tiempos.',
  'Instrumento de la Muerte': 'Toca la melodía que abre la roca.',
  'Herencia de los Dioses': 'Lo que dejaron atrás, ahora es tuyo.',
  // -------------------------------------------------------- RECOLECTORES T10
  'El Principio y El Fin': 'Todo empieza y termina en tu clic.',
  'La Última Palabra': 'Después de ella no hay más veta.',
  'El Todo y La Nada': 'Extrae del todo. Guarda la nada.',
  // ------------------------------------------------- EXCLUSIVOS DE CAJA
  'Fantasma Cuántico': 'Existe y no existe, y en ambos estados multiplica.',
  'Oráculo Tribal': 'Los ancianos predijeron tu riqueza.',
  'Avatar del Vacío': 'El mayor ingreso individual del juego: la nada, trabajando.',
  'Fénix de Datos': 'Renace de cada reinicio con más hambre.',
  'Centinela Eterno': 'Juró guardar tu base hasta el fin de los ciclos.',
  'Espectro Azulado': 'Solo sale de la legendaria. Por eso brilla.',
};

/**
/**
 * El lore de un nombre, o `null` si no tiene.
 *
 * **ANTES TENÍA QUE CONOCER EL SUFIJO "SOBRECARGADO".** Un item sobrecargado
 * llevaba el nombre de su base más ese sufijo, así que la función hacía un
 * `replace()` para quitarlo y buscar el lore del nombre de verdad. Como el
 * sobrecargado ya no existe, el `replace()` se va con él: un nombre es su lore o
 * no lo es.
 *
 * Cualquier nombre sin entrada no tiene lore, y eso es lo que el banco
 * `loreCheck` vigila: un nombre sin lore es contenido a medias (D4).
 */
export function lorePara(nombre: string): string | null {
  if (!nombre) return null;
  return LORE[nombre] ?? null;
}

/**
 * Lo que hace un compañero, en una línea con su cifra.
 *
 * Va AL LADO del lore y no dentro: el lore es sabor y esto es la decisión de
 * equiparlo. Un `multiplier` no tiene cifra propia —multiplica a los demás—,
 * así que enseña su × en vez de un +N que nadie cobra.
 */
export function lineaTipoCompanion(tipo: string, power: number): string {
  if (tipo === 'multiplier') {
    const mult = Math.round((1 + power) * 100) / 100;
    return `Multiplica el ingreso ×${mult}`;
  }
  if (tipo === 'passive') return `Produce +${power}/s en pasivo`;
  return `Aporta +${power}/s al clickear`;
}
