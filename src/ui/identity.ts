// ==========================================================================
//  Identidad mínima: avatar con marco + nombre + título
//
//  Una sola fuente para los sitios que enseñan quién eres en pequeño: la
//  cabecera (F16) y las filas del ranking (F8). Antes cada una pintaba su
//  versión a mano, y por eso el marco llegó a una y no a la otra. El Perfil
//  usa `identityCard()`, más grande, para la tarjeta completa.
//
//  El estilo del título vive aquí (`titleStyleFor`) y el Perfil lo reutiliza:
//  el degradado con texto transparente y el brillo son la misma regla en los
//  dos tamaños, y con dos copias se separan en cuanto se toca una.
// ==========================================================================

import { COSMETICS_BY_ID, cosmeticStyle } from '../data/cosmetics';
import type { Cosmetic } from '../types/domain';

export interface IdentityCosmetics {
  title?: string;
  frame?: string;
  banner?: string;
}

/** El color del título: su estilo, el degradado y el brillo. */
export function titleStyleFor(title: Cosmetic | undefined): string {
  if (!title) return '';
  return [
    cosmeticStyle(title),
    title.style.gradient ? 'background-clip:text;-webkit-background-clip:text;color:transparent' : '',
    title.style.glow === 'true' ? 'text-shadow:0 0 16px currentColor' : ''
  ].filter(Boolean).join(';');
}

/**
 * Avatar de 32 px con marco y halo del banner, nombre y título.
 *
 * El título por defecto ("Sin título") se enseña o no según `hideDefaultTitle`:
 * en el ranking sale lo equipado tal cual, y en la cabecera se esconde porque
 * es ruido al lado del nombre. Los `*_none` no pintan marco ni halo: un anillo
 * invisible ocupando píxeles desplazaría el avatar sin decir nada.
 */
export function miniIdentity(
  name: string,
  cosmetics: IdentityCosmetics | undefined,
  opts: {
    hideDefaultTitle?: boolean;
    avatarClass?: string;
    glyphClass?: string;
    nameClass?: string;
    titleClass?: string;
  } = {}
): string {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  const title = cosmetics?.title ? COSMETICS_BY_ID[cosmetics.title] : undefined;
  const frame = cosmetics?.frame ? COSMETICS_BY_ID[cosmetics.frame] : undefined;
  const banner = cosmetics?.banner ? COSMETICS_BY_ID[cosmetics.banner] : undefined;
  const showTitle = !!title && (!opts.hideDefaultTitle || title.id !== 'title_default');

  return `
    <div class="flex items-center gap-2 min-w-0">
      <div class="avatar-stack ${opts.avatarClass ?? 'w-8 h-8'} flex-shrink-0" aria-hidden="true">
        ${banner && banner.id !== 'banner_none'
          ? `<span class="avatar-frame w-full h-full rounded-full" style="transform:scale(1.9);opacity:.5;${cosmeticStyle(banner)}"></span>`
          : ''}
        <span class="avatar-core w-[78%] h-[78%] ${opts.glyphClass ?? 'text-[11px]'}">${initials}</span>
        ${frame && frame.id !== 'frame_none'
          ? `<span class="avatar-frame w-full h-full rounded-full" style="${cosmeticStyle(frame)}"></span>`
          : ''}
      </div>
      <div class="min-w-0">
        <div class="${opts.nameClass ?? 'text-[12px] font-bold text-[var(--text-main)]'} truncate">${name}</div>
        ${showTitle ? `<div class="title-display ${opts.titleClass ?? 'text-[9px]'} truncate" style="${titleStyleFor(title)}">${title!.name}</div>` : ''}
      </div>
    </div>
  `;
}
