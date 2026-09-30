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
