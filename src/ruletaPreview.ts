// ==========================================================================
//  Las dos ruletas, aisladas y sin gastar nada
// ==========================================================================
//  POR QUÉ ESTE BANCO VISUAL EXISTE.
//
//  Una ruleta no se puede comprobar con un banco: hay que verla girar y hay que
//  medir dónde para la casilla, y eso necesita un navegador. Este fichero monta
//  las dos ruletas con cifras clavadas —`Math.random` está pineado a 0,5— para que
//  dos recargas se parezcan y se puedan comparar.
//
//  LA CAJA. Un botón por entrada de la tabla de botín. El objetivo es mirar que
//  el trompo frena, que la casilla que gana para BAJO la aguja, y que el cartel y
//  la casilla dicen lo mismo. Ese último punto es el que más cuesta ver en el
//  juego: dentro de una partida real, si la ruleta mintiera, el jugador no tendría
//  con qué compararlo.
//
//  EL SINTONIZADOR. Va aquí por el mismo motivo que la de las cajas: es la única
//  forma de mirar el trompo sin gastar un cristal de verdad, y ahora hay dos
//  ruletas que comparten carril. Un botón por desenlace, porque lo que hay que
//  mirar es si la casilla que gana y el cartel dicen LO MISMO — y eso solo se ve
//  con las dos ramas.
//
//  Los niveles van clavados a propósito. La ruleta del sintonizador pinta
//  "4 → 5" en el acierto, y comparar dos recargas donde el azar cambia los
//  números entre ellas no dice nada.
//
//  Uso:
//    ruleta-preview.html                 la de las cajas
//    ruleta-preview.html?caso=3          abre el caso 3 al arrancar
//    ruleta-preview.html?sintonizador=1  abre el sintonizador con acierto
//    ruleta-preview.html?sintonizador=0  abre el sintonizador con fallo
// ==========================================================================

import './style.css';
import { showCrateRoulette } from './components/crateRoulette';
import { showTuningRoulette } from './components/tuningRoulette';
import { CRATE_LOOT, resolveLootAmount, type CrateReward } from './components/crateLoot';
import { crateCosmetics } from './data/cosmetics';
import type { CrateType } from './data/store';

interface Caso {
  titulo: string;
  caja: CrateType;
  /** Id de la entrada de la tabla, o un cosmético concreto. */
  id: string;
}

const CASOS: Caso[] = [
  { titulo: 'Nanitas (T1)', caja: 1, id: 'nanites' },
  { titulo: 'Cristal T2 (caja T2)', caja: 2, id: 'crystals' },
  { titulo: 'Llaves (T1)', caja: 1, id: 'keys' },
  { titulo: 'Caja T4 (caja T3)', caja: 3, id: 'nextCrate' },
  { titulo: 'Piedras x2 (T6)', caja: 6, id: 'calibrationStone' },
{ titulo: 'Recolector de caja (T3)', caja: 3, id: 'collector' },
  { titulo: 'Avatar del Vacío (T10)', caja: 10, id: 'exclusivo_2' },
  { titulo: 'Cosmético: título (T1)', caja: 1, id: 'cosmetic' },
  { titulo: 'Cosmético: marco (T10)', caja: 10, id: 'cosmetic' },
  { titulo: 'Cosmético: banner (T3)', caja: 3, id: 'cosmetic' }
];

/** Construye el premio de un caso sin tocar el azar del resto. */
function premioDe(caso: Caso): CrateReward {
  const original = Math.random;
  Math.random = () => 0.5;
  try {
    const entrada = CRATE_LOOT[caso.caja].find(e => e.id === caso.id);
    if (!entrada) throw new Error(`La caja ${caso.caja} no tiene la entrada "${caso.id}"`);
    // Para los cosméticos se señala UNO del catálogo, que es lo que el jugador
    // recibe: el resto de la caja sería un sorteo que aquí no se quiere.
    if (caso.id === 'cosmetic') {
      const cos = crateCosmetics(caso.caja)[0];
      return {
        kind: 'cosmetic', amount: 1, name: cos.name, label: cos.name,
        details: cos.description, rarity: cos.rarity, icon: 'medal',
        cosmeticId: cos.id, exclusive: true
      };
    }
    const built = entrada.build({ ownedCosmetics: [] });
    if (!built) throw new Error(`La entrada "${caso.id}" no da nada`);
    return resolveLootAmount(caso.caja, built);
  } finally {
    Math.random = original;
  }
}

const app = document.getElementById('app')!;

const titulo = document.createElement('div');
titulo.className = 'label-caps';
titulo.textContent = 'La ruleta, aislada';
app.appendChild(titulo);

const aviso = document.createElement('p');
aviso.className = 'text-[10px] font-mono opacity-60 -mt-2';
aviso.textContent = 'Un botón por premio. Las cifras van clavadas: dos recargas se parecen.';
app.appendChild(aviso);

const botones = document.createElement('div');
botones.className = 'flex flex-wrap gap-2';
app.appendChild(botones);

for (const caso of CASOS) {
  const btn = document.createElement('button');
  btn.className = 'accent-bg text-slate-950 font-[\'Orbitron\'] font-bold text-xs rounded-xl px-4 py-2 cursor-pointer hover:opacity-90 transition';
  btn.textContent = caso.titulo;
  btn.addEventListener('click', () => showCrateRoulette(premioDe(caso), caso.caja, () => {}));
  botones.appendChild(btn);
}

// El "ya los tienes todos" no se puede pedir a la ruleta: es lo que pasa dentro
// del juego cuando el cosmético sorteado ya era tuyo. Se enseña a mano, que es
// justo lo que tiene que hacer el juego cuando ocurre.
const repetido = document.createElement('button');
repetido.className = 'card-glass border rounded-xl px-4 py-2 text-[10px] font-mono cursor-pointer hover:opacity-90 transition';
repetido.textContent = 'Ya los tienes todos (compensa en nanitas)';
repetido.addEventListener('click', () => {
  showCrateRoulette({
    kind: 'nanites', amount: 27000, name: 'Compensación', label: '+27000 Nanitas',
    details: 'Ya tienes todos los cosméticos de esta caja', rarity: 'Común',
    icon: 'bolt', exclusive: false
  }, 10, () => {});
});
botones.appendChild(repetido);

// ==========================================================================
//  La ruleta del sintonizador, también aislada
// ==========================================================================
const separador = document.createElement('div');
separador.className = 'w-full h-px bg-[var(--border-color)] my-2';
botones.appendChild(separador);

for (const caso of [
  { titulo: 'Sintonizador: MEJORA (4 → 5)', ok: true, antes: 4, despues: 5 },
  { titulo: 'Sintonizador: FALLO (sin cambio)', ok: false, antes: 4, despues: 4 },
  { titulo: 'Sintonizador: MEJORA tardía (19 → 20)', ok: true, antes: 19, despues: 20 }
]) {
  const btn = document.createElement('button');
  btn.className = 'card-glass border rounded-xl px-4 py-2 text-[10px] font-mono cursor-pointer hover:opacity-90 transition';
  btn.textContent = caso.titulo;
  btn.addEventListener('click', () => showTuningRoulette(
    {
      rolled: true,
      success: caso.ok,
      levelBefore: caso.antes,
      levelAfter: caso.despues,
      msg: caso.ok
        ? '¡Mejora exitosa! Blaster Láser ascendió al nivel ' + caso.despues + '.'
        : 'Fallo en el sintonizador. Blaster Láser se mantiene en nivel ' + caso.antes + '. (-2 cristales)'
    },
    () => {}
  ));
  botones.appendChild(btn);
}

// `?sintonizador=1` abre la ruleta del sintonizador al arrancar, para recargar
// con ella ya girada. Es el caso que se mira en el móvil, que es donde el trompo
// se ve en menos casillas y donde la rueda corta se nota más.
const sint = new URLSearchParams(location.search).get('sintonizador');
if (sint !== null) {
  setTimeout(() => showTuningRoulette(
    { rolled: true, success: sint !== '0', levelBefore: 4, levelAfter: sint !== '0' ? 5 : 4, msg: sint !== '0'
      ? '¡Mejora exitosa! Blaster Láser ascendió al nivel 5.'
      : 'Fallo en el sintonizador. Blaster Láser se mantiene en nivel 4. (-2 cristales)' },
    () => {}
  ), 150);
}

// `?caso=n` abre uno al arrancar, para recargar con la ruleta ya en pantalla.
const pedido = new URLSearchParams(location.search).get('caso');
if (pedido !== null) {
  const n = Number(pedido);
  const caso = CASOS[n] ?? CASOS[0];
  setTimeout(() => showCrateRoulette(premioDe(caso), caso.caja, () => {}), 150);
}
