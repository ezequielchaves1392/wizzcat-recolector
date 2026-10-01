import{A as e,C as t,D as n,E as r,M as i,N as a,O as o,T as s,_ as c,a as l,c as u,f as d,g as f,h as p,i as m,j as h,k as g,l as _,m as v,n as y,o as b,r as x,s as ee,t as S,u as te,v as ne,w as re,y as ie}from"./toast-CLH3vizD.js";var ae=[{key:`clickBoost`,icon:`bolt`,label:`Clics x2`,durationMs:18e5,accent:`border-emerald-500/40 text-emerald-500 dark:text-emerald-400`,bar:`bg-emerald-400`,getExpires:e=>e.buffs.clickBoostExpiresAt},{key:`clickX2`,icon:`bolt`,label:`Clics x2`,tag:`rápida`,durationMs:3e4,accent:`border-cyan-500/40 text-cyan-500 dark:text-cyan-400`,bar:`bg-cyan-400`,getExpires:e=>e.buffs.clickX2ExpiresAt},{key:`clickX3`,icon:`bolt`,label:`Clics x3`,tag:`rápida`,durationMs:3e4,accent:`border-purple-500/40 text-purple-500 dark:text-purple-400`,bar:`bg-purple-400`,getExpires:e=>e.buffs.clickX3ExpiresAt},{key:`passiveBoost`,icon:`shield`,label:`Pasivo x2`,durationMs:36e5,accent:`border-blue-500/40 text-blue-500 dark:text-blue-400`,bar:`bg-blue-400`,getExpires:e=>e.buffs.passiveBoostExpiresAt},{key:`afk`,icon:`card`,label:`AFK`,durationMs:18e5,accent:`border-amber-500/40 text-amber-500 dark:text-amber-400`,bar:`bg-amber-400`,getExpires:e=>e.afkExpiresAt}],oe=!1;function se(e){return`
    <div data-buff="${e.key}"
         class="hidden card-glass border ${e.accent} rounded-xl pl-1.5 pr-1 py-1
                flex items-center gap-1.5 flex-shrink-0">
      <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(e.icon)}</span>
      <span class="flex flex-col gap-1">
        <span class="flex items-baseline gap-1.5 leading-none whitespace-nowrap">
          <span class="text-[10px] font-mono font-bold">${e.label}</span>
          ${e.tag?`<span class="text-[9px] font-mono uppercase tracking-wider opacity-55">${e.tag}</span>`:``}
          <span data-role="time" class="text-[10px] font-mono tabular-nums opacity-75">0:00</span>
        </span>
        <span class="h-[2.5px] w-full rounded-full bg-black/40 overflow-hidden block">
          <span data-role="bar"
                class="block h-full rounded-full ${e.bar}
                       transition-[width] duration-500 ease-linear"
                style="width:100%"></span>
        </span>
      </span>
      <button data-cancel="${e.key}" title="Cancelar ${e.label}" aria-label="Cancelar ${e.label}"
              class="hit-expand w-5 h-5 flex items-center justify-center rounded-md text-[11px] leading-none
                     opacity-40 hover:opacity-100 hover:bg-white/10 active:scale-90
                     transition cursor-pointer shrink-0">${i(`close`,`w-3 h-3`)}</button>
    </div>
  `}function ce(){return ae.map(se).join(``)+`
    <div data-buff="global"
         class="hidden card-glass border border-sky-500/40 rounded-xl px-2 py-1
                text-[10px] font-mono text-sky-500 dark:text-sky-400 flex-shrink-0 whitespace-nowrap">
      ${i(`sparkle`,`w-3 h-3 mr-1`)}Global ×<span data-role="value">1</span>
    </div>
  `}function le(e,t,n=!1){let r=[document.querySelector(`#active-buffs-hud`),document.querySelector(`#buffs-hud-mobile`)].filter(Boolean);if(r.length===0)return;if(!oe||n){let e=ce();r.forEach(t=>{t.innerHTML=e}),oe=!0}for(let n of ae){let i=Math.max(0,n.getExpires(e)-t),a=C(i),o=`${Math.max(0,Math.min(100,i/n.durationMs*100))}%`;for(let e of r){let t=e.querySelector(`[data-buff="${n.key}"]`);if(!t||(t.classList.toggle(`hidden`,i<=0),i<=0))continue;let r=t.querySelector(`[data-role="time"]`);r&&(r.textContent=a);let s=t.querySelector(`[data-role="bar"]`);s&&(s.style.width=o)}}let i=Number(e.passiveMultiplier)||1;for(let e of r){let t=e.querySelector(`[data-buff="global"]`);if(!t)continue;t.classList.toggle(`hidden`,i<=1);let n=t.querySelector(`[data-role="value"]`);n&&(n.textContent=i.toFixed(2).replace(/\.?0+$/,``))}}function ue(){oe=!1}function C(e){let t=Math.max(0,Math.floor(e/1e3)),n=t%60,r=Math.floor(t/60)%60,i=Math.floor(t/3600),a=e=>e.toString().padStart(2,`0`);return i>0?`${i}:${a(r)}:${a(n)}`:`${a(r)}:${a(n)}`}function de(e){return ae.find(t=>t.key===e)?.label??`el buff`}var w={ranges:{1:[5,7],2:[8,12],3:[13,19],4:[21,31],5:[34,50],6:[55,81],7:[88,132],8:[142,214],9:[230,346],10:[373,559]},companionNames:{1:[`Dron Explorador`,`Dron Centinela`,`Dron Mensajero`],2:[`Cazador Nocturno`,`Rastreador Fantasma`,`Explorador Estelar`],3:[`Guerrero Mecánico`,`Titán de Acero`,`Coloso de Batalla`],4:[`Señor de la Guerra`,`Destruyente Imperial`,`Aniquilador Prime`],5:[`Avatar del Caos`,`Heraldo del Vacío`,`Portador del Trueno`],6:[`Supremo Estratega`,`Maestro de Batallas`,`General Supremo`],7:[`Forjador de Mundos`,`Creador de Imperios`,`Arquitecto Cósmico`],8:[`Devorador de Estrellas`,`Señor del Tiempo`,`Amo del Espacio`],9:[`Entidad Primordial`,`Ser Trascendente`,`Conciencia Universal`],10:[`Dios de la Guerra`,`El Omnipotente`,`El Infinito`]},collectorNames:{1:[`Blaster Láser`,`Pistola de Plasma`,`Rifle de Pulso`],2:[`Cañón de Partículas`,`Lanzador de Energía`,`Desintegrador Táctico`],3:[`Aniquilador Cuántico`,`Devorador de Materia`,`Coloso de Fuego`],4:[`Guadaña del Vacío`,`Maldición Estelar`,`Juicio Final`],5:[`Apocalipsis`,`Armagedón`,`Ragnarök`],6:[`Excalibur`,`Mjolnir`,`Gungnir`],7:[`Lanza del Destino`,`Espada del Crepúsculo`,`Hacha del Caos`],8:[`Corte del Tiempo`,`Filo del Infinito`,`Navaja Cósmica`],9:[`Recolector del Apocalipsis`,`Instrumento de la Muerte`,`Herencia de los Dioses`],10:[`El Principio y El Fin`,`La Última Palabra`,`El Todo y La Nada`]},rarityByTier:{1:`Común`,2:`Común`,3:`Raro`,4:`Raro`,5:`Épico`,6:`Épico`,7:`Legendario`,8:`Legendario`,9:`Mítico`,10:`Divino`}},fe=[{id:`aff_sharp`,name:`Afilado`,description:`+18% al daño de click.`,rarity:`Raro`,effect:{clickMult:.18}},{id:`aff_rapid`,name:`Cadencia`,description:`+12% al daño de click.`,rarity:`Raro`,effect:{clickMult:.12}},{id:`aff_yield`,name:`Rendimiento`,description:`+20% al ingreso pasivo.`,rarity:`Raro`,effect:{passiveMult:.2}},{id:`aff_flow`,name:`Flujo`,description:`+14% al ingreso pasivo.`,rarity:`Raro`,effect:{passiveMult:.14}},{id:`aff_bulwark`,name:`Baluarte`,description:`+60 de daño plano.`,rarity:`Épico`,effect:{flatDamage:60}},{id:`aff_core`,name:`Núcleo`,description:`+40 de ingreso pasivo plano.`,rarity:`Épico`,effect:{flatPassive:40}},{id:`aff_crit`,name:`Crítico`,description:`+8% de probabilidad de crítico (×2 daño).`,rarity:`Épico`,effect:{critChance:.08}},{id:`aff_focus`,name:`Foco`,description:`+14% de probabilidad de crítico.`,rarity:`Legendario`,effect:{critChance:.14}},{id:`aff_luck`,name:`Suerte de Forja`,description:`+10% a la probabilidad de crafteo del recolector.`,rarity:`Legendario`,effect:{craftLuck:.1}},{id:`aff_ephemeral`,name:`Efenéreo`,description:`+35% a ambos multiplicadores.`,rarity:`Legendario`,effect:{clickMult:.35,passiveMult:.35}},{id:`aff_eternal`,name:`Eterno`,description:`+8 de daño por cada nivel del recolector.`,rarity:`Mítico`,effect:{flatDamage:8}},{id:`aff_absorb`,name:`Absorción`,description:`+18 de ingreso pasivo por cada 5 niveles.`,rarity:`Mítico`,effect:{flatPassive:18}},{id:`aff_prime`,name:`Primo`,description:`+55% a todos los multiplicadores del recolector.`,rarity:`Mítico`,effect:{clickMult:.55,passiveMult:.55}},{id:`aff_void`,name:`Vacío Devorador`,description:`+25% al daño, +25% al pasivo, +10% crítico.`,rarity:`Divino`,effect:{clickMult:.25,passiveMult:.25,critChance:.1}}],pe=Object.fromEntries(fe.map(e=>[e.id,e])),me=3;function he(e){return typeof e==`number`&&e>0?e:20}function ge(e){return Math.max(1,Math.floor(1.2*1.26**e))}function _e(e){return Math.max(.3,.78-(e-1)*.05)}function ve(e,t,n,r,i=0){let a=_e(e),o=Math.min(5,n)*.12,s=i>0?.08:0,c=a+t+o+r+s;return Math.min(.95,c)}function ye(e,t){let n=1;for(let t of e){let e=be[t.rarity]??0,r=(t.level||0)*.06;n+=e*.4+r}n+=t*.25;let r=(Math.random()-.5)*.8;return Math.max(1,Math.min(5,Math.round(n+r-.5)))}var be={Común:0,Raro:.5,Épico:1,Legendario:1.6,Mítico:2.4,Divino:3.2,Sobrecargado:2.8},xe=[`Forja de`,`Espuela de`,`Nucleo de`,`Herencia de`,`Sello de`,`Yunque de`],Se=[`Vórtice`,`Éclipsis`,`Confín`,`Ceniza`,`Éter`,`Nébula`,`Duna`,`Ónix`,`Zafiro`,`Cobalto`];function Ce(e,t,n=Math.random){return`${xe[Math.floor(n()*xe.length)]} ${Se[Math.floor(n()*Se.length)]}${t>=11?` PRIMIGENIA`:t>=9?` SINGULAR`:``}${e>=5?`·Absoluta`:e>=4?`·Prima`:``}`}function we(e,t,n,r){let i=r.maxTier??11;if(e.length!==3)return{success:!1,error:`Se necesitan 3 recolectores del mismo tier.`};if(t<1||t>=i)return{success:!1,error:`No se pueden forjar recolectores de tier ${t+1}.`};if(e.some(e=>e.tier!==t))return{success:!1,error:`Las 3 recolectores deben ser del mismo tier.`};let a=e.reduce((e,t)=>e+(t.affixes?.length||0)*.02,0),o=r.nanoUsed??0,s=ve(t,r.craftLuck,r.stonesUsed,a,o);if(Math.random()>s){let n=8+t*6,i=e.reduce((e,t)=>e+be[t.rarity]*4,0);return{success:!1,shards:Math.round((n+i)*(1+r.shardBonus)),chanceUsed:s}}let c=ye(e,r.stonesUsed),l=t+1,u=Ce(c,l),d=w.ranges[Math.min(l,10)]??[1,5],f=Math.round((d[0]+d[1])/2),p=Math.min(3,Math.max(1,c-1)),m=Ee(Math.min(4,p+ +(o>0)),e),h=1+(c-1)*.12,g=Math.round(f*h),_=Te(l,c);return{success:!0,collector:{id:`forged_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,name:u,type:`collector`,details:`Daño base: +${g}`,rarity:_,tier:l,level:0,maxLevel:20+c*me,potential:c,damage:g,affixes:m,forgedBy:n,forgedAt:Date.now(),lineage:e.map(e=>e.rarity),sellPrice:0},chanceUsed:s}}function Te(e,t){let n=Math.max(1,Math.min(e,10)),r=w.rarityByTier[n]??`Común`;return t>=5&&e>=9?`Divino`:t>=4&&e>=7?`Mítico`:t>=3&&e>=5?`Legendario`:t>=2&&e>=3?`Épico`:r||`Común`}function Ee(e,t){let n=fe.slice(),r=[];for(let t=0;t<e&&n.length>0;t++){let e=n.map(e=>1/(.5+(be[e.rarity]??1))),t=e.reduce((e,t)=>e+t,0),i=Math.random()*t,a=0;for(;a<e.length-1&&(i-=e[a],!(i<=0));a++);r.push(n[a].id),n.splice(a,1)}return r}var De={1:220,2:480,3:1e3,4:2100,5:4400,6:9200,7:19e3,8:39e3,9:8e4,10:162e3,11:33e4},Oe={Común:1,Raro:1.3,Épico:1.7,Legendario:2.2,Mítico:2.8,Divino:3.6,Sobrecargado:2.4};function ke(e,t=20){if(e<=0)return 1;let n=t/2,r=1;for(let t=0;t<e;t++)r+=t<n?.06:.1;return r}function Ae(e){return e?1+(e-1)*.45:1}function je(e){if(!e.affixes?.length)return 1;let t=1;for(let n of e.affixes){let e=pe[n];if(!e)continue;let r=0;e.effect.clickMult&&(r+=e.effect.clickMult*.8),e.effect.passiveMult&&(r+=e.effect.passiveMult*.8),e.effect.flatDamage&&(r+=Math.min(.5,e.effect.flatDamage/400)),e.effect.flatPassive&&(r+=Math.min(.5,e.effect.flatPassive/400)),e.effect.critChance&&(r+=e.effect.critChance*2.5),e.effect.craftLuck&&(r+=e.effect.craftLuck*1.5),t+=r}return t}function Me(e){return e===null?1:e<=1?2.2:e<=3?1.8:e<=10?1.5:e<=50?1.3:e<=100?1.2:1.05}function Ne(e){if(!e)return 1;let t=(Date.now()-e)/864e5;return t<1?1.35:t<7?1.15:t<30?1:t<90?.94:.88}function Pe(e,t={}){let n=De[Math.max(1,Math.min(e.tier,11))]??200,r=ke(e.level||0,he(e.maxLevel)),i=Oe[e.rarity]??1,a=Ae(e.potential??0),o=je(e),s=Me(t.authorRank??null),c=Ne(e.forgedAt),l=t.sellMult??1,u=n*r*i*a*o*s*c*l,d=10**Math.max(0,Math.floor(Math.log10(u))-2);return Math.round(u/d)*d}function Fe(e,t={}){return Math.max(1,Math.floor(Pe(e,t)*.42))}function T(e,t={}){let n=[],r=De[Math.max(1,Math.min(e.tier,11))]??200;return n.push(`Base T${e.tier}: ${Ie(r)}`),e.level&&n.push(`Nivel ${e.level}: ×${ke(e.level,he(e.maxLevel)).toFixed(2)}`),n.push(`Rareza ${e.rarity}: ×${(Oe[e.rarity]??1).toFixed(2)}`),e.potential&&n.push(`Potencial ${e.potential}★: ×${Ae(e.potential).toFixed(2)}`),e.affixes?.length&&n.push(`${e.affixes.length} afijo(s): ×${je(e).toFixed(2)}`),t.authorRank!=null&&n.push(`Autor top ${t.authorRank}: ×${Me(t.authorRank).toFixed(2)}`),n}function Ie(e){return e>=1e6?`${(e/1e6).toFixed(2)} M`:e>=1e3?`${(e/1e3).toFixed(1)} K`:String(Math.round(e))}function Le(e,t,n,r,a){let o=e.equippedCollectorId?e.warehouse.find(t=>t.id===e.equippedCollectorId):null,s=document.querySelector(`#equipped-collector-container`);if(s){if(o){let e=o.tier||1,n=o.level||0,r=he(o.maxLevel),c=o.rarity||`Común`,l=!!o.overclock,u=o.affixes||[],d=typeof a==`function`?a():null,f=d&&d.total>0?`
        <div class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 flex flex-wrap gap-x-2 tabular">
          <span title="El daño que trae el item">${h(d.base)} base</span>
          ${d.porNivel>0?`<span title="Lo que suma el nivel del recolector">+${h(d.porNivel)} nivel</span>`:``}
          ${d.porBonos>0?`<span title="Compañeros, logros, árbol, afijos y buffs de click">+${h(d.porBonos)} bonos</span>`:``}
        </div>
      `:``,p=T(o),m=p.length?`
        <details class="mt-2.5" open>
          <summary class="label-caps cursor-pointer select-none">Valoración</summary>
          <ul class="mt-1 space-y-0.5">
            ${p.map(e=>`<li class="text-[9px] font-mono text-[var(--text-muted)]">${e}</li>`).join(``)}
          </ul>
        </details>
      `:``;s.innerHTML=`
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                      ${l?`rarity-glow-sobrecargado`:``}"
               style="background: color-mix(in srgb, var(--accent) 12%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="[&>span>svg]:w-5 [&>span>svg]:h-5 accent-text">${i(`collector`)}</span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-['Orbitron'] font-bold text-[13px] md:text-sm
                           text-[var(--text-main)] truncate">${o.name}</span>
              <span class="label-caps px-1.5 py-0.5 rounded"
                    style="background: color-mix(in srgb, var(--accent) 14%, transparent);
                           color: var(--accent)">T${e}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-mono rarity-${E(c)}">${c}</span>
              ${l?`<span class="text-[9px] font-mono rarity-sobrecargado">· SOBRECARGADO</span>`:``}
              ${o.potential?`<span class="text-[9px] text-amber-400">· ${`★`.repeat(o.potential)}</span>`:``}
            </div>
            ${u.length?`
              <div class="flex items-center gap-1 flex-wrap mt-1">
                ${u.map(e=>{let t=pe[e];return t?`<span class="text-[9px] font-mono px-1 py-[1px] rounded border rarity-${E(t.rarity)}"
                              style="border-color: currentColor" title="${t.description}">${t.name}</span>`:``}).join(``)}
              </div>
            `:``}
            ${o.forgedBy?`
              <div class="text-[9px] font-mono text-[var(--text-muted)] mt-1 truncate">
                Forjada por <span class="accent-text">${o.forgedBy}</span>
              </div>
            `:``}
            <!-- Barra de nivel: comunica progreso de un vistazo -->
            <div class="flex items-center gap-2 mt-2">
              <div class="flex-1 h-1 rounded-full overflow-hidden"
                   style="background: color-mix(in srgb, var(--text-main) 10%, transparent)">
                <div class="h-full rounded-full transition-[width] duration-500 ease-out"
                     style="width: ${Math.min(100,n/r*100)}%;
                            background: var(--accent)"></div>
              </div>
              <span class="text-[9px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">
                Nv ${n}/${r}
              </span>
            </div>
          </div>

          <div class="text-right flex-shrink-0">
            <div class="label-caps leading-none">Daño</div>
            <div class="font-['Orbitron'] font-bold text-base md:text-lg
                        leading-tight tabular mt-0.5"
                 style="color: var(--accent)">+${h(t)}</div>
          </div>
        </div>

        ${f}
        ${m}
      `}else s.innerHTML=`
        <div class="text-center py-5">
          <div class="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-2
                      opacity-40 [&>span>svg]:w-5 [&>span>svg]:h-5 text-[var(--text-muted)]">
            ${i(`collector`)}
          </div>
          <div class="text-[11px] font-mono text-[var(--text-muted)]">
            Sin recolector equipado
          </div>
          <div class="text-[10px] font-mono text-[var(--text-muted)] opacity-70 mt-0.5">
            Equipa uno desde el almacén
          </div>
        </div>
      `}let c=document.querySelector(`#companions-slots-container`),l=document.querySelector(`#slots-label`),u=n??e.maxCompanionSlots??1;if(l&&(l.textContent=`${e.activeCompanions.length}/${u} activos`),c){let t=e.activeCompanions.map(t=>e.companions.find(e=>e.id===t)).filter(Boolean),n=``;for(let e=0;e<u;e++){let a=t[e];if(a){let e=a.type===`multiplier`,t=a.rarity||`Común`,o=[`Épico`,`Legendario`,`Mítico`,`Divino`,`Sobrecargado`].includes(t),s=r?.(a.id),c=e?`×${(1+a.power).toFixed(2).replace(/\.?0+$/,``)}`:`+${h(s??a.power)}/s`,l=e?`MULT`:`INGRESO`;n+=`
          <div class="rounded-xl p-2.5 text-center border relative overflow-hidden
                      ${o?`rare-sweep`:``}"
               style="background: var(--bg-app);
                      border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
            <div class="flex justify-center mb-1.5">
              <span class="[&>span>svg]:w-5 [&>span>svg]:h-5"
                    style="color: var(--accent)">${i(e?`sparkle`:`companion`)}</span>
            </div>
            <div class="text-[10px] font-mono text-[var(--text-main)] truncate leading-tight
                        font-semibold">${a.name}</div>
            <div class="text-[9px] font-mono rarity-${E(t)} mt-0.5 truncate">${t}</div>
            <div class="mt-1.5 pt-1.5 border-t"
                 style="border-color: color-mix(in srgb, var(--accent) 20%, transparent)">
              <div class="label-caps" style="font-size:8px">${l}</div>
              <div class="text-[11px] font-mono font-bold tabular mt-0.5"
                   style="color: var(--accent)">${c}</div>
            </div>
          </div>
        `}else n+=`
          <div class="rounded-xl p-2.5 text-center border border-dashed opacity-45
                      flex flex-col items-center justify-center"
               style="border-color: var(--border-color); background: var(--bg-app)">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 text-[var(--text-muted)] mb-1">${i(`plus`)}</span>
            <div class="text-[9px] font-mono text-[var(--text-muted)] leading-tight">Vacío</div>
          </div>
        `}c.innerHTML=n}}function E(e){return e.toLowerCase().normalize(`NFD`).replace(/[\u0300-\u036f]/g,``)}function Re(r,a){r.innerHTML=`
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">

      <!-- Fondo: gradientes en movimiento + rejilla + lluvia + escaneo -->
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-glow auth-glow-2"></div>
        <div class="auth-glow auth-glow-3"></div>
        <div class="auth-grid"></div>
        <canvas class="auth-rain"></canvas>
        <div class="auth-scan"></div>
        <div class="auth-vignette"></div>
      </div>

      <!-- Marca -->
      <div class="auth-brand relative z-10 text-center mb-5">
        <div class="auth-logo mx-auto mb-3">
          <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${i(`chip`)}</span>
        </div>
        <h1 class="font-['Orbitron'] font-black text-xl sm:text-2xl accent-text tracking-[0.2em] leading-none">
          CYBER-FORGE
        </h1>
        <p class="text-[10px] text-[var(--text-muted)] font-mono mt-2 tracking-[0.15em]">
          TERMINAL DE EXTRACCIÓN · v1.0
        </p>
      </div>

      <!-- Tarjeta -->
      <div class="relative z-10 w-full max-w-sm sm:max-w-md">
        <div class="auth-card card-glass rounded-3xl p-5 sm:p-7 flex flex-col gap-4">

          <div class="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
            <span class="auth-dot w-1.5 h-1.5 rounded-full accent-bg flex-shrink-0"></span>
            <span id="auth-status">EN ESPERA DE IDENTIFICACIÓN</span>
          </div>

          <div id="auth-error" role="alert" aria-live="assertive"
               class="hidden rounded-xl border border-red-500/40 bg-red-500/10 text-red-300
                      px-3 py-2.5 text-[11px] font-mono leading-relaxed"></div>

          <form id="auth-form" class="flex flex-col gap-3.5" novalidate>
            <div class="flex flex-col gap-1.5">
              <label for="username-input" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
                NOMBRE DE OPERATIVO
              </label>
              <input type="text" id="username-input" name="username" required autocomplete="username"
                     maxlength="24" spellcheck="false"
                     class="auth-input w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                            text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                            placeholder:text-[var(--text-muted)]"
                     placeholder="CyberKnight">
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="password-input" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
                CONTRASEÑA DE ACCESO
              </label>
              <!--
                El contenedor "relative" no lleva w-full a propósito: es el
                ancla del botón del ojo y se mide contra el input, que ya es
                w-full. El botón va a right-1.5 en vez de right-1 para que el
                icono respire igual que el texto del campo y no parezca haberse
                salido del input.
              -->
              <div class="relative">
                <input type="password" id="password-input" name="password" required
                       autocomplete="current-password"
                       class="auth-input w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                              pr-11 text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]"
                       placeholder="Mínimo 6 caracteres">
                <button type="button" id="toggle-pass"
                        class="hit-expand absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg
                               flex items-center justify-center
                               cursor-pointer text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                        aria-label="Mostrar contraseña" aria-pressed="false">
                  <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`eye`)}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" id="remember-me" checked class="accent-bg rounded cursor-pointer w-3.5 h-3.5">
                <span class="text-[10px] font-mono text-[var(--text-muted)]">Recordar</span>
              </label>
              <select id="theme-select" aria-label="Tema visual"
                      class="app-bg border border-[var(--border-color)] rounded-lg px-2 py-1.5
                             text-[10px] font-mono text-[var(--text-main)] cursor-pointer
                             focus:outline-none focus:border-[var(--accent)] max-w-[8.5rem]">
                ${m.map(e=>`<option value="${e.value}">${e.label}</option>`).join(``)}
              </select>
            </div>

            <button type="submit" id="submit-btn"
                    class="auth-submit relative mt-1 py-3 accent-bg hover:opacity-90 text-slate-950
                           font-['Orbitron'] font-bold text-[12px] rounded-xl accent-glow
                           cursor-pointer tracking-[0.15em] overflow-hidden
                           disabled:opacity-60 disabled:cursor-not-allowed">
              <span class="relative z-10">INICIAR SESIÓN</span>
            </button>
          </form>

          <div class="text-center pt-0.5">
            <button type="button" id="toggle-mode"
                    class="text-[11px] font-mono text-[var(--text-muted)] hover:accent-text transition cursor-pointer">
              ¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>
            </button>
          </div>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] text-center mt-3 leading-relaxed">
          El progreso se guarda en la nube y se restaura al volver.
        </p>
      </div>
    </div>
  `;let c=!1,l=!1,d=e=>r.querySelector(e),f=d(`#toggle-mode`),p=d(`#submit-btn`),h=d(`#auth-error`),g=d(`#auth-status`),_=d(`#theme-select`),v=d(`#username-input`),y=d(`#password-input`),S=d(`#remember-me`),te=(e,t=``)=>{l=e,p&&(p.disabled=e),g&&(g.textContent=t||`EN ESPERA DE IDENTIFICACIÓN`),r.querySelectorAll(`#auth-form input`).forEach(t=>{t.disabled=e})};window.matchMedia(`(prefers-reduced-motion: reduce)`).matches||ne();function ne(){let e=r.querySelector(`.auth-rain`);if(!e)return;let t=e.getContext(`2d`);if(!t)return;let n=e,i=t,a=Math.min(window.devicePixelRatio||1,2),o=()=>{let n=e.getBoundingClientRect();e.width=Math.max(1,Math.floor(n.width*a)),e.height=Math.max(1,Math.floor(n.height*a)),t.setTransform(a,0,0,a,0,0)};o(),window.addEventListener(`resize`,o);let s=Math.ceil(window.innerWidth/22),c=Math.ceil(window.innerHeight/13),l=Array.from({length:s},(e,t)=>({x:t*22,y:Math.random()*c*-1,v:.12+Math.random()*.22})),u=!0,d=0;function f(){u=!1,d&&=(cancelAnimationFrame(d),0),window.removeEventListener(`resize`,o),document.removeEventListener(`visibilitychange`,h)}function p(){i.fillStyle=`rgba(3, 9, 22, 0.14)`,i.fillRect(0,0,window.innerWidth,window.innerHeight),i.font=`13px ui-monospace, monospace`,i.fillStyle=getComputedStyle(r).getPropertyValue(`--accent`).trim()||`#38bdf8`,i.globalAlpha=.15;for(let e of l)i.fillText(`ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01`[Math.floor(Math.random()*22)],e.x,e.y*13),e.y+=e.v,e.y>c+2&&(e.y=Math.random()*-8,e.v=.12+Math.random()*.22);i.globalAlpha=1}let m=()=>{if(u){if(!e.isConnected){f();return}p(),d=requestAnimationFrame(m)}};function h(){if(document.hidden){u=!1,d&&=(cancelAnimationFrame(d),0);return}!u&&n.isConnected&&(u=!0,d=requestAnimationFrame(m))}document.addEventListener(`visibilitychange`,h),d=requestAnimationFrame(m)}let ie=localStorage.getItem(`cyberforge_remember_user`),ae=localStorage.getItem(`cyberforge_remember_pass`);v&&ie&&(v.value=ie),y&&ae&&(y.value=ae),_&&(_.value=b()),ee(b()),_?.addEventListener(`change`,()=>ee(_.value));let oe=d(`#toggle-pass`);oe?.addEventListener(`click`,()=>{if(!y)return;let e=y.type===`text`;y.type=e?`password`:`text`,oe.setAttribute(`aria-pressed`,String(!e)),oe.setAttribute(`aria-label`,e?`Mostrar contraseña`:`Ocultar contraseña`)}),f?.addEventListener(`click`,()=>{c=!c,p&&(p.textContent=c?`REGISTRAR CUENTA`:`INICIAR SESIÓN`),f&&(f.innerHTML=c?`¿Ya tienes cuenta? <span class="accent-text underline">Inicia sesión</span>`:`¿Nuevo operativo? <span class="accent-text underline">Registrar cuenta</span>`),h&&h.classList.add(`hidden`),y?.setAttribute(`autocomplete`,c?`new-password`:`current-password`)}),d(`#auth-form`)?.addEventListener(`submit`,async r=>{if(r.preventDefault(),l)return;h?.classList.add(`hidden`);let i=(v?.value||``).trim(),d=y?.value||``,f=S?.checked??!0;if(!i){se(`Escribe un nombre de operativo.`),v?.focus();return}if(d.length<6){se(`La contraseña necesita al menos 6 caracteres.`),y?.focus();return}let p=i.toLowerCase().replace(/[^a-z0-9]/g,``);if(p.length<3){se(`El nombre necesita al menos 3 letras o números.`),v?.focus();return}let m=p+`@cyberforge.game`;te(!0,c?`CREANDO CUENTA…`:`VERIFICANDO IDENTIDAD…`);try{if(await n(u,f?t:re),f?(localStorage.setItem(`cyberforge_remember_user`,i),localStorage.setItem(`cyberforge_remember_pass`,d)):(localStorage.removeItem(`cyberforge_remember_user`),localStorage.removeItem(`cyberforge_remember_pass`)),c){let t=await s(u,m,d);await e(t.user,{displayName:i}),x(`Cuenta creada. Entras al sistema…`,()=>{sessionStorage.setItem(`pending_username`,i),a(t.user,i)},{confirmText:`Entrar`})}else a((await o(u,m,d)).user,i);te(!1)}catch(e){te(!1),se(ze(e))}});function se(e){h&&(h.textContent=e,h.classList.remove(`hidden`))}v?.focus()}function ze(e){let t=String(e?.code||``),n=String(e?.message||``);return t.includes(`invalid-credential`)||n.includes(`wrong-password`)||n.includes(`user-not-found`)?`Nombre o contraseña incorrectos.`:t.includes(`email-already-in-use`)?`Ese nombre ya está en uso. Prueba con otro o inicia sesión.`:t.includes(`weak-password`)?`La contraseña es demasiado débil. usa al menos 6 caracteres.`:t.includes(`invalid-email`)?`Ese nombre no es válido. Usa solo letras y números.`:t.includes(`too-many-requests`)?`Demasiados intentos. Espera un momento y prueba otra vez.`:t.includes(`network-request-failed`)||t.includes(`unavailable`)?`No hay conexión con el servidor. Revisa tu red y vuelve a intentarlo.`:t.includes(`operation-not-allowed`)?`Este acceso está deshabilitado en la configuración del proyecto.`:n.replace(/^Firebase:\s*/i,``).replace(/\s*\(auth\/[^)]+\)\.?$/,``)||`No se ha podido completar el acceso.`}function D(e,t){let{nombre:n,motivo:r,desde:a}=t,o=(r||``).trim()||`Cuentasuspendida por un administrador.`,s=a?new Date(a).toLocaleString(`es-ES`,{dateStyle:`long`,timeStyle:`short`}):``;e.innerHTML=`
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#ef4444;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${i(`lock`)}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.18em] text-red-400">
              CUENTA BLOQUEADA
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              OPERATIVO · ${n}
            </p>
          </div>

          <div role="alert"
               class="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4
                      flex flex-col gap-2">
            <span class="label-caps" style="color:#f87171">Motivo</span>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)] break-words">
              ${Be(o)}
            </p>
          </div>

          ${s?`
            <p class="text-[10px] font-mono text-[var(--text-muted)]">
              Suspendido el ${Be(s)}
            </p>
          `:``}

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            Tu partida sigue guardada. Un administrador tiene que levantar el
            bloqueo; no hay forma de hacerlo desde aquí.
          </p>

          <button type="button" id="reintentar"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition">
            COMPROBAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  `,e.querySelector(`#reintentar`)?.addEventListener(`click`,()=>location.reload())}function Be(e){return String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e])}var Ve={bloqueado:!1,motivo:``,desde:0};async function He(e){try{let t=await v(d(_,`bloqueos`,e));if(!t.exists())return Ve;let n=t.data();return n.activo===!0?{bloqueado:!0,motivo:String(n.motivo||``),desde:typeof n.desde==`number`?n.desde:0}:Ve}catch(e){return console.warn(`[bloqueo] No se ha podido comprobar el bloqueo; se deja entrar.`,e),Ve}}var Ue=`cyberforge_nanitas_pendientes`,We=1,Ge={existe:!1,nanites:0,producidas:0,clics:0,nucleos:0,totalNucleos:0,reinicios:0,ts:0};function Ke(e){try{let t=localStorage.getItem(Ue);if(!t)return Ge;let n=JSON.parse(t);return!n||n.v!==We||n.uid!==e||typeof n.ts!=`number`||!isFinite(n.ts)||n.ts<=0||![n.nanites,n.producidas,n.clics,n.nucleos,n.totalNucleos,n.reinicios].every(e=>typeof e==`number`&&isFinite(e))?Ge:{existe:!0,nanites:n.nanites,producidas:n.producidas,clics:n.clics,nucleos:n.nucleos,totalNucleos:n.totalNucleos,reinicios:n.reinicios,ts:n.ts}}catch{return Ge}}function qe(e,t,n,r,i,a,o){try{let s={v:We,uid:e,nanites:Math.floor(t),producidas:Math.floor(n),clics:Math.floor(r),nucleos:Math.floor(i),totalNucleos:Math.floor(a),reinicios:Math.floor(o),ts:Date.now()};return localStorage.setItem(Ue,JSON.stringify(s)),s.ts}catch{return 0}}function Je(e){try{let t=localStorage.getItem(Ue);if(!t)return!0;let n=JSON.parse(t);return!n||typeof n.ts!=`number`||!isFinite(n.ts)||n.ts>e?!1:(localStorage.removeItem(Ue),!0)}catch{return!1}}function Ye(e){return Ke(e).existe}var O={border:`1px solid`,borderRadius:`9999px`},Xe=[{id:`title_default`,type:`title`,name:`Sin título`,description:`Operativo novel.`,rarity:`Común`,unlock:{kind:`default`,value:0},style:{color:`var(--text-muted)`}},{id:`title_recruited`,type:`title`,name:`Recluta`,description:`Primera semana en la Cyber Base.`,rarity:`Raro`,unlock:{kind:`achievement`,value:`first_click`},style:{color:`#60a5fa`,font:`mono`}},{id:`title_smith`,type:`title`,name:`Aprendiz de Forja`,description:`Forjaste tu primera recolector.`,rarity:`Raro`,unlock:{kind:`achievement`,value:`first_forge`},style:{color:`#f97316`,font:`mono`}},{id:`title_smith_master`,type:`title`,name:`Maestro de Forja`,description:`Forjaste 25 recolectores.`,rarity:`Épico`,unlock:{kind:`achievement`,value:`smith_25`},style:{color:`#fbbf24`,font:`display`}},{id:`title_ascended`,type:`title`,name:`Ascendido`,description:`Reiniciaste tu progreso 5 veces.`,rarity:`Épico`,unlock:{kind:`achievement`,value:`ascendant`},style:{color:`#c084fc`,font:`display`}},{id:`title_singularity`,type:`title`,name:`Singularidad`,description:`Compraste el nodo Singularidad.`,rarity:`Mítico`,unlock:{kind:`cores`,value:0},style:{color:`#f0abfc`,font:`display`,glow:`true`}},{id:`title_champion`,type:`title`,name:`Campeón`,description:`Permaneciste 7 días en el Top 3.`,rarity:`Legendario`,unlock:{kind:`ranking`,value:3},style:{color:`#fde047`,font:`display`,glow:`true`}},{id:`title_legend`,type:`title`,name:`Leyenda de la Forja`,description:`Permaneciste 7 días en el Top 1.`,rarity:`Divino`,unlock:{kind:`ranking`,value:1},style:{color:`#fde047`,font:`display`,glow:`true`,gradient:`linear-gradient(90deg,#fde047,#fb923c,#f472b6)`}},{id:`title_ghost`,type:`title`,name:`Fantasma`,description:`Un logro secreto. No se explica.`,rarity:`Mítico`,unlock:{kind:`secret`,value:`ghost`,hint:`Haz algo que el juego no te pide.`},style:{color:`#94a3b8`,font:`display`,blur:`true`}},{id:`title_architect`,type:`title`,name:`Arquitecto`,description:`Abreste las 5 ramas del árbol.`,rarity:`Divino`,unlock:{kind:`cores`,value:2e3},style:{color:`#22d3ee`,font:`display`,glow:`true`}},{id:`frame_none`,type:`frame`,name:`Sin marco`,description:`Perfil limpio.`,rarity:`Común`,unlock:{kind:`default`,value:0},style:{}},{id:`frame_steel`,type:`frame`,name:`Acero`,description:`Borde metálico sobrio.`,rarity:`Raro`,unlock:{kind:`achievement`,value:`first_click`},style:{...O,borderColor:`#52525b`}},{id:`frame_neon`,type:`frame`,name:`Neón`,description:`Borde con brillo pulsante.`,rarity:`Épico`,unlock:{kind:`cores`,value:40},style:{...O,borderColor:`var(--accent)`,boxShadow:`0 0 18px color-mix(in srgb, var(--accent) 60%, transparent)`,animation:`framePulse 3s ease-in-out infinite`}},{id:`frame_ember`,type:`frame`,name:`Brasa`,description:`Borde naranja de fundición.`,rarity:`Épico`,unlock:{kind:`achievement`,value:`smith_25`},style:{...O,borderColor:`#f97316`,boxShadow:`0 0 20px #f9731666`}},{id:`frame_void`,type:`frame`,name:`Vacío`,description:`Borde que absorbe la luz.`,rarity:`Legendario`,unlock:{kind:`cores`,value:250},style:{...O,borderColor:`#7c3aed`,boxShadow:`0 0 24px #7c3aed80, inset 0 0 20px #00000080`}},{id:`frame_gold`,type:`frame`,name:`Oro Prohibido`,description:`Solo para el Top 1.`,rarity:`Divino`,unlock:{kind:`ranking`,value:1},style:{...O,borderColor:`#fde047`,boxShadow:`0 0 26px #fde04790`,animation:`frameShimmer 4s linear infinite`}},{id:`frame_matrix`,type:`frame`,name:`Cascada`,description:`Borde con degradado animado.`,rarity:`Legendario`,unlock:{kind:`ranking`,value:10},style:{...O,borderColor:`transparent`,background:`linear-gradient(#09090b,#09090b) padding-box, linear-gradient(90deg,#22c55e,#06b6d4,#a855f7) border-box`,borderWidth:`2px`}},{id:`banner_none`,type:`banner`,name:`Sin fondo`,description:`Fondo transparente.`,rarity:`Común`,unlock:{kind:`default`,value:0},style:{}},{id:`banner_grid`,type:`banner`,name:`Rejilla`,description:`Rejilla técnica tenue.`,rarity:`Raro`,unlock:{kind:`default`,value:0},style:{backgroundImage:`linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)`,backgroundSize:`18px 18px`}},{id:`banner_sunset`,type:`banner`,name:`Atardecer`,description:`Degradado cálido.`,rarity:`Raro`,unlock:{kind:`cores`,value:20},style:{background:`linear-gradient(120deg,#7c2d12,#db2777)`}},{id:`banner_abyss`,type:`banner`,name:`Abismo`,description:`Azul profundo con halo.`,rarity:`Épico`,unlock:{kind:`cores`,value:120},style:{background:`radial-gradient(120% 100% at 50% 0%,#1e3a8a,#020617 60%)`}},{id:`banner_toxic`,type:`banner`,name:`Tóxico`,description:`Verde radioactivo.`,rarity:`Épico`,unlock:{kind:`achievement`,value:`jackpot`},style:{background:`linear-gradient(135deg,#052e16,#10b981)`}},{id:`banner_crimson`,type:`banner`,name:`Carmesí`,description:`Rojo de alarma.`,rarity:`Legendario`,unlock:{kind:`achievement`,value:`ascendant`},style:{background:`linear-gradient(135deg,#450a0a,#dc2626)`}},{id:`banner_crown`,type:`banner`,name:`Corona`,description:`Solo para el primer lugar.`,rarity:`Divino`,unlock:{kind:`ranking`,value:1},style:{background:`conic-gradient(from 180deg at 50% 0%,#fde047,#f97316,#fbbf24,#fef08c,#f97316,#fde047)`}},{id:`banner_hidden`,type:`banner`,name:`Sin Nombre`,description:`Aparece en algunos perfiles. Nadie sabe de dónde sale.`,rarity:`Mítico`,unlock:{kind:`secret`,value:`hidden`,hint:`Cien cajas. Ni una más.`},style:{background:`repeating-linear-gradient(45deg,#0b0b12,#0b0b12 8px,#18181f 8px,#18181f 16px)`}},{id:`title_scraplord`,type:`title`,name:`Señor de Chatarra`,description:`Recicló más chatarra que nadie en la base.`,rarity:`Raro`,unlock:{kind:`crate`,value:`common`},style:{color:`#a3a3a3`,font:`mono`}},{id:`frame_oxy`,type:`frame`,name:`Óxido`,description:`Borde corroído, del montón y sin pulir.`,rarity:`Raro`,unlock:{kind:`crate`,value:`common`},style:{...O,borderColor:`#a16207`,borderStyle:`dashed`}},{id:`title_burnout`,type:`title`,name:`Fundido`,description:`Se quedó sin refrigerante a mitad de una fusión.`,rarity:`Épico`,unlock:{kind:`crate`,value:`rare`},style:{color:`#fb923c`,font:`display`}},{id:`banner_foundry`,type:`banner`,name:`Fundición`,description:`El horno encendido, de noche.`,rarity:`Épico`,unlock:{kind:`crate`,value:`rare`},style:{background:`linear-gradient(160deg,#451a03,#ea580c 55%,#facc15)`}},{id:`title_nightshift`,type:`title`,name:`Turno de Noche`,description:`La Cyber Base nunca está vacía.`,rarity:`Legendario`,unlock:{kind:`crate`,value:`epic`},style:{color:`#818cf8`,font:`display`,glow:`true`}},{id:`banner_datastorm`,type:`banner`,name:`Tormenta de Datos`,description:`Caudal de telemetría sin filtrar.`,rarity:`Épico`,unlock:{kind:`crate`,value:`epic`},style:{backgroundImage:`repeating-linear-gradient(115deg,rgba(56,189,248,.28) 0 2px,transparent 2px 10px),linear-gradient(180deg,#082f49,#0c4a6e)`}},{id:`frame_quantum`,type:`frame`,name:`Cuántico`,description:`Borde que solo está ahí cuando lo miras.`,rarity:`Mítico`,unlock:{kind:`crate`,value:`legendary`},style:{...O,borderColor:`transparent`,borderWidth:`2px`,background:`linear-gradient(#0b0b12,#0b0b12) padding-box, repeating-linear-gradient(90deg,#22d3ee 0 6px,transparent 6px 12px) border-box`}},{id:`banner_aurora`,type:`banner`,name:`Aurora`,description:`El cielo de la Cyber Base visto desde el tejado.`,rarity:`Legendario`,unlock:{kind:`crate`,value:`legendary`},style:{background:`linear-gradient(120deg,#4c1d95,#0e7490 45%,#10b981)`}},{id:`title_signal`,type:`title`,name:`La Señal`,description:`El único cosmético Divino que no se gana en el ranking.`,rarity:`Divino`,unlock:{kind:`crate`,value:`legendary`},style:{color:`#34d399`,font:`display`,glow:`true`,gradient:`linear-gradient(90deg,#34d399,#22d3ee,#a78bfa)`}}],Ze=Object.fromEntries(Xe.map(e=>[e.id,e])),k=e=>Xe.filter(t=>t.type===e),A=e=>Xe.filter(t=>t.unlock.kind===`crate`&&t.unlock.value===e);function j(e){return e?Object.entries(e.style).map(([e,t])=>`${e}:${t}`).join(`;`):``}var Qe={backpackExpander:{name:`Expansor de Almacén`,details:`Aumenta el almacén +1 slot (máx 20)`,rarity:`Raro`,buffId:`warehouseExpander`},afkCard:{name:`Tarjeta AFK`,details:`Permite juego sin la ventana activa 10 min (acumulable x3)`,rarity:`Raro`,buffId:`afk`},clickX2Card:{name:`Tarjeta Click x2`,details:`Otorga x2 al click por 30 segundos`,rarity:`Raro`,buffId:`clickX2`},clickX3Card:{name:`Tarjeta Click x3`,details:`Otorga x3 al click por 30 segundos`,rarity:`Épico`,buffId:`clickX3`},calibrationStone:{name:`Piedra de Calibración`,details:`Sube 12 puntos la probabilidad de la próxima fusión`,rarity:`Raro`,buffId:`calibrationStone`},stabilityNano:{name:`Nanopartícula de Estabilidad`,details:`Deja el recolector forjado con un afijo extra garantizado`,rarity:`Legendario`,buffId:`stabilityNano`}},$e={common:{name:`Caja Común`,rarity:`Común`,details:`Recompensas de partida temprana: nanitas, cristales, algún dron T1.`},rare:{name:`Caja Rara`,rarity:`Raro`,details:`Material de forja y compañeros T3, con algún recolector T4 sobrecargado.`},epic:{name:`Caja Épica`,rarity:`Épico`,details:`Compañeros T6 y recolectores T6, con piedras de calibración.`},legendary:{name:`Caja Legendaria`,rarity:`Legendario`,details:`Recolectores T8 y compañeros Divinos que no se compran. Sale la Nanopartícula de Estabilidad.`}},et=[250,900,3e3,11e3],tt=[0,1200,4500,16e3,55e3,18e4,52e4,14e5,36e5,9e6],nt=[{da:2,etiqueta:`Slot de Compañero 2`},{da:4,etiqueta:`Ranura de Escuadrón (ranuras 3 y 4)`},{da:6,etiqueta:`Ranura de Escuadrón (ranuras 5 y 6)`}];function rt(e){let t=nt[e-1];return{cost:tt[e]??0,label:t?.etiqueta??`Ranura de escuadrón`}}var M=Object.fromEntries(nt.map((e,t)=>[`companionSlot${t+1}`,e])),it={keyT0:{cost:et[0],label:`Llave de Cifrado`},keyT1:{cost:et[1],label:`Llave Reforzada`},keyT2:{cost:et[2],label:`Llave Rúnica`},keyT3:{cost:et[3],label:`Llave del Vacío`},upgradeCrystal:{cost:200,label:`Cristal de Mejora`},warehouseSlot:{cost:6e3,label:`Ampliar Almacén (+5 slots)`},commonCrate:{cost:500,label:`Caja Común`},rareCrate:{cost:1500,label:`Caja Rara`},epicCrate:{cost:5500,label:`Caja Épica`},legendaryCrate:{cost:21e3,label:`Caja Legendaria`},backpackExpander:{cost:1400,label:`Expansor de Almacén (+1 slot)`},companionSlot1:rt(1),companionSlot2:rt(2),companionSlot3:rt(3),afkCard:{cost:1e4,label:`Tarjeta AFK Básica (10 min, acumulable x3)`},clickX2Card:{cost:5e3,durationMs:3e4,label:`Tarjeta Click x2 (30s)`},clickX3Card:{cost:15e3,durationMs:3e4,label:`Tarjeta Click x3 (30s)`},calibrationStone:{cost:45e3,label:`Piedra de Calibración (+12% de éxito)`},stabilityNano:{cost:9e4,label:`Nanopartícula de Estabilidad (+8% y un afijo extra)`},companionCardT1:{cost:900,label:`Compañero Tier 1`},companionCardT2:{cost:1700,label:`Compañero Tier 2`},companionCardT3:{cost:3e3,label:`Compañero Tier 3`},companionCardT4:{cost:5500,label:`Compañero Tier 4`},companionCardT5:{cost:9900,label:`Compañero Tier 5`},companionCardT6:{cost:18e3,label:`Compañero Tier 6`},companionCardT7:{cost:32550,label:`Compañero Tier 7`},companionCardT8:{cost:59050,label:`Compañero Tier 8`},companionCardT9:{cost:106950,label:`Compañero Tier 9`},companionCardT10:{cost:193850,label:`Compañero Tier 10`},collectorCardT1:{cost:900,label:`Recolector Tier 1`},collectorCardT2:{cost:1700,label:`Recolector Tier 2`},collectorCardT3:{cost:3e3,label:`Recolector Tier 3`},collectorCardT4:{cost:5500,label:`Recolector Tier 4`},collectorCardT5:{cost:9900,label:`Recolector Tier 5`},collectorCardT6:{cost:18e3,label:`Recolector Tier 6`},collectorCardT7:{cost:32550,label:`Recolector Tier 7`},collectorCardT8:{cost:59050,label:`Recolector Tier 8`},collectorCardT9:{cost:106950,label:`Recolector Tier 9`},collectorCardT10:{cost:193850,label:`Recolector Tier 10`}},at=[0,1,2,3],ot={common:0,rare:1,epic:2,legendary:3};function st(e){return Object.keys(ot).filter(t=>dt(e,ot[t])).sort((e,t)=>ot[e]-ot[t])}function ct(e){let t=st(e).map(e=>$e[e].name);if(t.length===0)return`No abre ningún cofre.`;if(t.length===1)return`Abre ${t[0]}.`;let n=t.pop();return`Abre ${t.join(`, `)} y ${n}.`}var N={0:{tier:0,name:`Llave de Cifrado`,namePlural:`Llaves de Cifrado`,details:ct(0),rarity:`Común`,buyable:!0,cost:et[0],dropRate:0},1:{tier:1,name:`Llave Reforzada`,namePlural:`Llaves Reforzadas`,details:ct(1),rarity:`Raro`,buyable:!0,cost:et[1],dropRate:22},2:{tier:2,name:`Llave Rúnica`,namePlural:`Llaves Rúnicas`,details:ct(2),rarity:`Épico`,buyable:!0,cost:et[2],dropRate:14},3:{tier:3,name:`Llave del Vacío`,namePlural:`Llaves del Vacío`,details:ct(3),rarity:`Legendario`,buyable:!0,cost:et[3],dropRate:4}},P={keyT0:0,keyT1:1,keyT2:2,keyT3:3},F={1:{tier:1,name:`Cristal de Afino`,details:`x1 a la probabilidad de mejora.`,rarity:`Común`,buyable:!0,cost:1440,power:1,dropRate:0},2:{tier:2,name:`Cristal de Fase`,details:`x1.75 a la probabilidad de mejora.`,rarity:`Raro`,buyable:!1,cost:null,power:1.75,dropRate:20},3:{tier:3,name:`Cristal de Entropía`,details:`x2.75 a la probabilidad de mejora.`,rarity:`Épico`,buyable:!1,cost:null,power:2.75,dropRate:12},4:{tier:4,name:`Cristal Singular`,details:`x4 a la probabilidad de mejora. Casi nunca falla.`,rarity:`Legendario`,buyable:!1,cost:null,power:4,dropRate:4}};function lt(e,t){let n=Math.max(35,95-e*3);return Math.min(95,Math.round(n*t))}function ut(e){let t=(e||``).toLowerCase();return t.includes(`singular`)?F[4].power:t.includes(`entrop`)?F[3].power:t.includes(`fase`)?F[2].power:F[1].power}function I(e){let t=(e||``).toLowerCase();return t.includes(`vacio`)||t.includes(`vacío`)?3:t.includes(`rúnica`)||t.includes(`runica`)?2:+!!t.includes(`reforzada`)}function dt(e,t){return at.indexOf(e)>=at.indexOf(t)}function ft(e,t){return dt(I(e),ot[t])}var pt={Común:`text-slate-400`,Raro:`text-blue-400`,Épico:`text-purple-400`,Legendario:`text-amber-400`,Mítico:`text-rose-400`,Divino:`text-yellow-300`,Sobrecargado:`text-fuchsia-300`},mt={Común:`border-slate-500/40`,Raro:`border-blue-500/40`,Épico:`border-purple-500/40`,Legendario:`border-amber-500/50`,Mítico:`border-rose-500/50`,Divino:`border-yellow-400/60`,Sobrecargado:`border-fuchsia-400/60`},L={Común:``,Raro:`rarity-glow-raro`,Épico:`rarity-glow-epico`,Legendario:`rarity-glow-legendario`,Mítico:`rarity-glow-mitico`,Divino:`rarity-glow-divino`,Sobrecargado:`rarity-glow-sobrecargado`};function R(e){return`${pt[e]||pt.Común} ${mt[e]||mt.Común}`}function ht(e){return(e||`Común`).toLowerCase().normalize(`NFD`).replace(/[\u0300-\u036f]/g,``)}var gt={Común:0,Raro:1,Épico:2,Legendario:3,Mítico:4,Divino:5,Sobrecargado:6},_t={common:{name:`Caja Común`,icon:`crate`,accent:`text-slate-300`,cost:400},rare:{name:`Caja Rara`,icon:`crate`,accent:`text-blue-400`,cost:1200},epic:{name:`Caja Épica`,icon:`crystal`,accent:`text-purple-400`,cost:4500},legendary:{name:`Caja Legendaria`,icon:`trophy`,accent:`text-amber-400`,cost:18e3}},vt=[{name:`Fantasma Cuántico`,type:`multiplier`,power:.35,rarity:`Mítico`,icon:`sparkle`},{name:`Oráculo Tribal`,type:`multiplier`,power:.75,rarity:`Legendario`,icon:`crystal`},{name:`Avatar del Vacío`,type:`passive`,power:65,rarity:`Divino`,icon:`globe`},{name:`Fénix de Datos`,type:`passive`,power:40,rarity:`Mítico`,icon:`bolt`},{name:`Centinela Eterno`,type:`click`,power:32,rarity:`Legendario`,icon:`shield`},{name:`Espectro Azulado`,type:`passive`,power:18,rarity:`Épico`,icon:`companion`}],yt={title:`medal`,frame:`sparkle`,banner:`layers`};function bt(e){let t=(w.ranges[e]||[1,5])[1],n=Math.round(t*1.25),r=w.collectorNames[e]||[`Blaster Láser`],i=r[Math.floor(Math.random()*r.length)];return gt[e>=9?`Divino`:e>=7?`Mítico`:`Legendario`],{name:`${i} SOBRECARGADO`,rarity:`Sobrecargado`,details:`Recolección por click: +${n} (base T${e}: ${t})`,item:{id:`oc_collector_t${e}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`${i} SOBRECARGADO`,type:`collector`,details:`Recolección por click: +${n} (base T${e}: ${t})`,rarity:`Sobrecargado`,tier:e,level:0,damage:n,overclock:!0,sellPrice:Math.round(_t.legendary.cost*.4)}}}function xt(e){let t=`crate_comp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,n=e.type===`multiplier`?`Multiplicador global: x${(1+e.power).toFixed(2).replace(/\.?0+$/,``)}`:`Recolección por segundo: +${e.power}/s`;return{companion:{id:t,name:e.name,type:e.type,power:e.power,rarity:e.rarity},item:{id:t,name:e.name,type:`companion`,details:n,rarity:e.rarity,companionType:e.type,power:e.power,exclusive:!0,sellPrice:0}}}function St(e,t){let n=A(e).filter(e=>!t.includes(e.id));if(n.length===0)return null;let r=n[Math.floor(Math.random()*n.length)];return{kind:`cosmetic`,amount:1,name:r.name,label:r.name,details:r.description,rarity:r.rarity,icon:yt[r.type],cosmeticId:r.id,exclusive:!0}}var z=(e,t)=>Math.floor(Math.random()*(t-e+1))+e;function Ct(e){let t=ot[e],n=N[t];return{id:`keys`,weight:10,build:()=>{let e=z(1,2),r=e>1?n.namePlural:n.name;return{kind:`keys`,amount:e,name:n.name,label:`+${e} ${r}`,details:n.details,rarity:n.rarity,icon:`key`,keyTier:t}}}}function wt(e){return{id:`up`,weight:Tt[e],build:()=>Dt(e,1)}}var Tt={common:6,rare:5,epic:4,legendary:4};function Et(e,t){let n=w.companionNames,r=e===`companion`?n[t]:w.collectorNames[t];return r[z(0,r.length-1)]}function Dt(e,t){let n=Ot[e],r=Math.min(10,n+t);if(Math.random()<.5){let e=w.ranges[r],t=z(e[0],e[1]),n=Et(`companion`,r);return{kind:`companion`,amount:1,name:n,label:n,details:`Recolección por segundo: +${t}/s`,rarity:w.rarityByTier[r],icon:`companion`,tier:r,item:{id:`crate_up_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:n,type:`companion`,details:`Recolección por segundo: +${t}/s`,rarity:w.rarityByTier[r],tier:r,companionType:`passive`,power:t,sellPrice:Math.floor(t*62)},up:!0}}let i=bt(r);return{kind:`collector`,amount:1,name:i.name,label:i.name,details:i.details,rarity:i.rarity,icon:`collector`,tier:r,item:i.item,up:!0}}var Ot={common:1,rare:3,epic:6,legendary:8},kt={common:[{id:`nanites`,weight:34,build:()=>{let e=z(250,400);return{kind:`nanites`,amount:e,name:`Nanitas`,label:`+${e} Nanitas`,details:`Materia prima básica`,rarity:`Común`,icon:`bolt`}}},{id:`crystals`,weight:26,build:()=>{let e=z(2,4);return{kind:`crystals`,amount:e,name:`Cristales de Mejora`,label:`+${e} Cristales`,details:`Sube el nivel del recolector`,rarity:`Raro`,icon:`crystal`,materialTier:1}}},{id:`dron`,weight:22,build:()=>({kind:`companion`,amount:1,name:`Dron Explorador`,label:`Dron Explorador`,details:`Recolección por segundo: +2/s`,rarity:`Común`,icon:`companion`,tier:1,item:{id:`crate_comp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Dron Explorador`,type:`companion`,details:`Recolección por segundo: +2/s`,rarity:`Común`,companionType:`passive`,power:2,sellPrice:100}})},Ct(`common`),wt(`common`),{id:`expander`,weight:6,build:()=>({kind:`consumable`,amount:1,name:`Ranura de Almacén`,label:`+1 ranura de almacén`,details:`Amplía el almacén +1 slot`,rarity:`Raro`,icon:`plus`,item:{id:`crate_slot_${Date.now()}`,name:`Ranura de Almacén`,type:`consumable`,details:`Amplía el almacén +1 slot`,rarity:`Raro`,buffId:`warehouseExpander`,stackable:!0,stackCount:1,sellPrice:125}})},{id:`cosmetic`,weight:5,build:e=>St(`common`,e.ownedCosmetics)}],rare:[{id:`crystals`,weight:26,build:()=>{let e=z(6,10);return{kind:`crystals`,amount:e,name:`Cristales de Mejora`,label:`+${e} Cristales`,details:`Sube el nivel del recolector`,rarity:`Épico`,icon:`crystal`,materialTier:1}}},{id:`companion_t3`,weight:24,build:()=>{let e=w.ranges[3],t=z(e[0],e[1]);return{kind:`companion`,amount:1,name:`Artillero Táctico`,label:`Artillero Táctico`,details:`Recolección por segundo: +${t}/s`,rarity:`Épico`,icon:`bolt`,tier:3,item:{id:`crate_comp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Artillero Táctico`,type:`companion`,details:`Recolección por segundo: +${t}/s`,rarity:`Épico`,tier:3,companionType:`passive`,power:t,sellPrice:400}}}},{id:`collector_t4`,weight:20,build:()=>{let e=bt(4);return{kind:`collector`,amount:1,name:e.name,label:e.name,details:e.details,rarity:e.rarity,icon:`collector`,tier:4,item:e.item}}},{id:`epic_crate`,weight:16,build:()=>({kind:`crate`,amount:1,name:`Caja Épica`,label:`+1 Caja Épica`,details:`Abre una caja de botín superior`,rarity:`Épico`,icon:`crystal`,item:{id:`crate_epic_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Caja Épica`,type:`crate`,details:`Contiene recompensas altas`,rarity:`Épico`,tier:0,sellPrice:1125,stackable:!0,stackCount:1}})},Ct(`rare`),wt(`rare`),{id:`cosmetic`,weight:5,build:e=>St(`rare`,e.ownedCosmetics)}],epic:[{id:`crystals`,weight:22,build:()=>{let e=z(16,24);return{kind:`crystals`,amount:e,name:`Cristales de Mejora`,label:`+${e} Cristales`,details:`Sube el nivel del recolector`,rarity:`Legendario`,icon:`crystal`,materialTier:1}}},{id:`calibration_stone`,weight:18,build:()=>{let e=z(1,2);return{kind:`consumable`,amount:e,name:`Piedra de Calibración`,label:`${e} Piedra${e>1?`s`:``} de Calibración`,details:`Sube 12 puntos la probabilidad de la próxima fusión`,rarity:`Raro`,icon:`flask`,item:{id:`crate_stone_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Piedra de Calibración`,type:`consumable`,details:`Sube 12 puntos la probabilidad de la próxima fusión`,rarity:`Raro`,buffId:`calibrationStone`,stackable:!0,stackCount:e,sellPrice:11250}}}},{id:`companion_t6`,weight:20,build:()=>{let e=w.ranges[6],t=z(e[0],e[1]);return{kind:`companion`,amount:1,name:`Titán de Acero`,label:`Titán de Acero`,details:`Recolección por segundo: +${t}/s`,rarity:`Legendario`,icon:`companion`,tier:6,item:{id:`crate_comp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Titán de Acero`,type:`companion`,details:`Recolección por segundo: +${t}/s`,rarity:`Legendario`,tier:6,companionType:`passive`,power:t,sellPrice:2500}}}},{id:`collector_oc6`,weight:16,build:()=>{let e=bt(6);return{kind:`collector`,amount:1,name:e.name,label:e.name,details:e.details,rarity:e.rarity,icon:`collector`,tier:6,item:e.item}}},{id:`ghost`,weight:12,build:()=>{let e=xt(vt[0]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`sparkle`,item:e.item,exclusive:!0}}},{id:`phoenix`,weight:10,build:()=>{let e=xt(vt[3]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`bolt`,item:e.item,exclusive:!0}}},{id:`legendary_crate`,weight:10,build:()=>({kind:`crate`,amount:1,name:`Caja Legendaria`,label:`+1 Caja Legendaria`,details:`Abre una caja de botín máximo`,rarity:`Legendario`,icon:`trophy`,item:{id:`crate_legendary_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Caja Legendaria`,type:`crate`,details:`Contiene recompensas máximas`,rarity:`Legendario`,tier:0,sellPrice:4500,stackable:!0,stackCount:1}})},Ct(`epic`),wt(`epic`),{id:`cosmetic`,weight:6,build:e=>St(`epic`,e.ownedCosmetics)}],legendary:[{id:`crystals`,weight:20,build:()=>{let e=z(45,65);return{kind:`crystals`,amount:e,name:`Cristales de Mejora`,label:`+${e} Cristales`,details:`Sube el nivel del recolector`,rarity:`Mítico`,icon:`crystal`,materialTier:2}}},{id:`collector_oc8`,weight:18,build:()=>{let e=bt(8);return{kind:`collector`,amount:1,name:e.name,label:e.name,details:e.details,rarity:e.rarity,icon:`collector`,tier:8,item:e.item}}},{id:`stability_nano`,weight:14,build:()=>({kind:`consumable`,amount:1,name:`Nanopartícula de Estabilidad`,label:`Nanopartícula de Estabilidad`,details:`Deja el recolector forjado con un afijo garantizado`,rarity:`Legendario`,icon:`flask`,item:{id:`crate_nano_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:`Nanopartícula de Estabilidad`,type:`consumable`,details:`Deja el recolector forjado con un afijo garantizado`,rarity:`Legendario`,buffId:`stabilityNano`,stackable:!0,stackCount:1,sellPrice:55e3}})},{id:`avatar`,weight:16,build:()=>{let e=xt(vt[2]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`globe`,item:e.item,exclusive:!0}}},{id:`oracle`,weight:14,build:()=>{let e=xt(vt[1]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`crystal`,item:e.item,exclusive:!0}}},{id:`sentinel`,weight:12,build:()=>{let e=xt(vt[4]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`shield`,item:e.item,exclusive:!0}}},{id:`espectro`,weight:5,build:()=>{let e=xt(vt[5]);return{kind:`companion`,amount:1,name:e.companion.name,label:e.companion.name,details:e.item.details,rarity:e.companion.rarity,icon:`sparkle`,item:e.item,exclusive:!0}}},Ct(`legendary`),wt(`legendary`),{id:`cosmetic`,weight:6,build:e=>St(`legendary`,e.ownedCosmetics)}]};function At(e,t){let n=kt[e],r=t??n.map(e=>e.weight),i=r.reduce((e,t)=>e+t,0),a=Math.random()*i;for(let e=0;e<n.length;e++)if(a-=r[e],a<=0)return n[e];return n[n.length-1]}function jt(e,t){let n={...t,exclusive:t.exclusive??!1};if(n.kind===`nanites`){let t=Math.round(n.amount*_t[e].cost/12);return{...n,amount:t,label:`+${t} Nanitas`}}if(n.kind===`crystals`){let e=Math.round(n.amount*(1+gt[n.rarity]*.25));return{...n,amount:e,label:`+${e} Cristales de Mejora`}}return n}function Mt(e){return e.kind===`nanites`||e.kind===`crystals`||e.kind===`keys`?!0:e.kind===`crate`||e.kind===`consumable`?e.amount>1:!1}function Nt(e){return`+${h(e.amount)}`}function Pt(e,t){let n=At(e),r={ownedCosmetics:t.ownedCosmetics()},i=n.build(r);if(!i){let n=Ft(e,`Ya tienes todos los cosméticos de esta caja`);return t.nanites(n.amount),n}let a=jt(e,i);switch(a.kind){case`nanites`:return t.nanites(a.amount),a;case`crystals`:return t.crystals(a.amount,a.materialTier??1),a;case`keys`:return t.keys(a.amount,a.keyTier??0),a;case`cosmetic`:{if(t.unlockCosmetic(a.cosmeticId))return a;let n=Ft(e,`Ya lo tenías`);return t.nanites(n.amount),n}default:{if(a.item&&t.addItem(a.item))return a;let n=Ft(e,`No cabía el objeto, se compensó en nanitas`);return t.nanites(n.amount),{...n,name:`Compensación`,label:`Almacén lleno: +${n.amount} Nanitas`}}}}function Ft(e,t){let n=Math.round(_t[e].cost*1.5);return{kind:`nanites`,amount:n,name:`Compensación`,label:`+${n} Nanitas`,details:t,rarity:`Común`,icon:`bolt`,exclusive:!1}}function It(e,t=26){let n=kt[e],r=[],i={ownedCosmetics:[]},a=[`ghost`,`phoenix`,`avatar`,`oracle`,`sentinel`,`collector_oc6`,`collector_oc8`,`collector_t4`],o=n.filter(e=>a.includes(e.id));for(let a=0;a<t;a++){let t=(o.length>0&&Math.random()<.07?o[Math.floor(Math.random()*o.length)]:n[Math.floor(Math.random()*n.length)]).build(i);t&&r.push(Lt(jt(e,t)))}return{tiles:r}}function Lt(e){return{label:e.name.length>16?e.name.slice(0,15)+`…`:e.name,amount:Mt(e)?Nt(e):void 0,sub:e.rarity,rarity:e.rarity,icon:e.icon}}var Rt=[{id:`first_click`,title:`Primer Enlace`,description:`Extrae 100 Nanitas en total`,icon:`bolt`,rewardText:`+2% poder de click`,reward:{clickBonus:.02,passiveBonus:0},progress:e=>({current:Math.min(e.totalNanitesProduced??0,100),target:100})},{id:`collector_10`,title:`Táctico`,description:`Sube un recolector al nivel 10`,icon:`medal`,rewardText:`+5% poder de click`,reward:{clickBonus:.05,passiveBonus:0},progress:e=>({current:Math.max(0,...(e.warehouse??[]).filter(e=>e.type===`collector`).map(e=>e.level||0)),target:10})},{id:`swarm`,title:`Enjambre Autómata`,description:`Equipa 3 compañeros a la vez`,icon:`companion`,rewardText:`+8% ingreso pasivo`,reward:{clickBonus:0,passiveBonus:.08},progress:e=>({current:Math.min(e.activeCompanions?.length??0,3),target:3})},{id:`overclocked`,title:`Fuera de Especificación`,description:`Consigue un recolector Sobrecargado`,icon:`flame`,rewardText:`+10% poder de click`,reward:{clickBonus:.1,passiveBonus:0},progress:e=>({current:+!!(e.warehouse??[]).some(e=>e.overclock),target:1})},{id:`crate_opener`,title:`Descifrador`,description:`Abre 25 cajas`,icon:`crate`,rewardText:`+12% ingreso pasivo`,reward:{clickBonus:0,passiveBonus:.12},progress:e=>({current:Math.min(e.cratesOpened??0,25),target:25})},{id:`jackpot`,title:`Fortuna Divina`,description:`Consigue un compañero Mítico o Divino de caja`,icon:`crown`,rewardText:`+15% poder de click`,reward:{clickBonus:.15,passiveBonus:0},progress:e=>({current:+!!(e.companions??[]).some(e=>e.rarity===`Mítico`||e.rarity===`Divino`),target:1})},{id:`rich`,title:`M magnate`,description:`Acumula 250.000 Nanitas`,icon:`graph`,rewardText:`+15% ingreso pasivo`,reward:{clickBonus:0,passiveBonus:.15},progress:e=>({current:Math.min(Math.floor(e.nanites??0),25e4),target:25e4})},{id:`full_squad`,title:`Escuadrón Completo`,description:`Equipa 5 compañeros a la vez`,icon:`chip`,rewardText:`+20% ingreso pasivo`,reward:{clickBonus:0,passiveBonus:.2},progress:e=>({current:Math.min(e.activeCompanions?.length??0,5),target:5})},{id:`deep_pockets`,title:`Almacén Masivo`,description:`Amplía el almacén a 20 slots`,icon:`warehouse`,rewardText:`+25% poder de click`,reward:{clickBonus:.25,passiveBonus:0},progress:e=>({current:Math.min((e.warehouseCapacity??0)+(e.bonus?.storageSlots??0),20),target:20})},{id:`tycoon`,title:`Barón de Nanobots`,description:`Alcanza 5.000 Nanitas por segundo`,icon:`sparkle`,rewardText:`+30% poder de click y +30% pasivo`,reward:{clickBonus:.3,passiveBonus:.3},progress:e=>({current:Math.min(Math.floor(e.passiveIncome??0),5e3),target:5e3})},{id:`first_forge`,title:`Primera Chispa`,description:`Forja tu primer recolector`,icon:`collector`,rewardText:`+5% poder de click · Título "Aprendiz de Forja"`,reward:{clickBonus:.05,passiveBonus:0},progress:e=>({current:Math.min(e.forgedCount??0,1),target:1})},{id:`smith_25`,title:`Maestro de Forja`,description:`Forja 25 recolectores con éxito`,icon:`collector`,rewardText:`+10% click y +10% pasivo · Marco "Brasa"`,reward:{clickBonus:.1,passiveBonus:.1},progress:e=>({current:Math.min(e.forgedCount??0,25),target:25})},{id:`ascendant`,title:`Ascendido`,description:`Recicla tu progreso 5 veces`,icon:`sparkle`,rewardText:`+20% click y +20% pasivo · Banner "Carmesí"`,reward:{clickBonus:.2,passiveBonus:.2},progress:e=>({current:Math.min(e.resets??0,5),target:5})},{id:`ghost`,title:`???`,description:`Un logro que nadie te pidió completar.`,icon:`sparkle`,rewardText:`Título oculto`,reward:{clickBonus:0,passiveBonus:0},progress:e=>({current:+!!(e.warehouse??[]).some(e=>(e.affixes||[]).includes(`aff_void`)),target:1})},{id:`hidden`,title:`???`,description:`Cien cajas. Ni una más.`,icon:`crate`,rewardText:`Banner oculto`,reward:{clickBonus:0,passiveBonus:0},progress:e=>({current:Math.min(e.cratesOpened??0,100),target:100})}];function zt(){return{unlocked:[],clickBonus:0,passiveBonus:0}}function Bt(e,t){let n=[];for(let r of Rt){if(t.unlocked.includes(r.id))continue;let{current:i,target:a}=r.progress(e);i>=a&&(t.unlocked.push(r.id),t.clickBonus+=r.reward.clickBonus,t.passiveBonus+=r.reward.passiveBonus,n.push(r))}return n}var Vt=[`ghost`,`hidden`],B=1.55,Ht=[{id:`core_sink`,name:`Sumidero de Núcleos`,description:`+8% al ingreso pasivo por nivel.`,icon:`chip`,category:`multiplicador`,tier:0,requires:[],baseCost:1,costGrowth:B,maxLevel:10,bonus:{passiveMult:.08},x:0,y:0},{id:`core_edge`,name:`Filo Afilado`,description:`+8% al daño de click por nivel.`,icon:`collector`,category:`multiplicador`,tier:0,requires:[],baseCost:1,costGrowth:B,maxLevel:10,bonus:{clickMult:.08},x:0,y:1},{id:`scrapyard`,name:`Chatarrería`,description:`+12% al precio de venta por nivel.`,icon:`trash`,category:`economia`,tier:0,requires:[],baseCost:2,costGrowth:B,maxLevel:5,bonus:{sellMult:.12},x:0,y:2},{id:`refinery`,name:`Refinado`,description:`-4% al coste de la tienda por nivel.`,icon:`crystal`,category:`economia`,tier:0,requires:[],baseCost:3,costGrowth:B,maxLevel:6,bonus:{costReduction:.04},x:0,y:3},{id:`blueprint`,name:`Planos Viejos`,description:`Desbloquea el Crafteo de recolectores.`,icon:`sparkle`,category:`exclusivo`,tier:0,requires:[],baseCost:4,costGrowth:1,maxLevel:1,bonus:{},x:0,y:4},{id:`auto_clicker`,name:`Autómata de Clicks`,description:`+0.5 clics automáticos por segundo.`,icon:`bolt`,category:`automatizacion`,tier:1,requires:[`core_edge`],baseCost:3,costGrowth:1.6,maxLevel:10,bonus:{autoClick:.5},x:1,y:0},{id:`passive_loop`,name:`Bucle de Extracción`,description:`+10% al ingreso pasivo por nivel.`,icon:`companion`,category:`multiplicador`,tier:1,requires:[`core_sink`],baseCost:3,costGrowth:B,maxLevel:8,bonus:{passiveMult:.1},x:1,y:1},{id:`forge_luck`,name:`Instinto de Forja`,description:`+6% a la probabilidad de crafteo.`,icon:`sparkle`,category:`crafteo`,tier:1,requires:[`blueprint`],baseCost:4,costGrowth:1.5,maxLevel:5,bonus:{craftLuck:.06},x:1,y:2},{id:`shard_sifter`,name:`Criba de Esquirlas`,description:`+25% de esquirlas por fallo.`,icon:`crystal`,category:`crafteo`,tier:1,requires:[`blueprint`],baseCost:3,costGrowth:B,maxLevel:4,bonus:{shardBonus:.25},x:1,y:3},{id:`storage_rack`,name:`Estantería Extra`,description:`+3 ranuras de almacén por nivel.`,icon:`warehouse`,category:`economia`,tier:1,requires:[`scrapyard`],baseCost:3,costGrowth:B,maxLevel:6,bonus:{storageSlots:3},x:1,y:4},{id:`auto_clicker2`,name:`Dedo de Acero`,description:`+1.5 clics automáticos por segundo.`,icon:`bolt`,category:`automatizacion`,tier:2,requires:[`auto_clicker`],baseCost:10,costGrowth:1.7,maxLevel:8,bonus:{autoClick:1.5},x:2,y:0},{id:`multiplier_amp`,name:`Amplificador Global`,description:`+6% a TODOS los multiplicadores por nivel.`,icon:`sparkle`,category:`multiplicador`,tier:2,requires:[`passive_loop`,`core_edge`],baseCost:12,costGrowth:1.65,maxLevel:8,bonus:{clickMult:.06,passiveMult:.06},x:2,y:1},{id:`crate_sight`,name:`Ojo de Caja`,description:`+10% de suerte en las cajas por nivel.`,icon:`crate`,category:`economia`,tier:2,requires:[`shard_sifter`],baseCost:8,costGrowth:B,maxLevel:5,bonus:{crateLuck:.1},x:2,y:2},{id:`bulk_buy`,name:`Compra a Granel`,description:`-5% adicional al coste de tienda.`,icon:`store`,category:`economia`,tier:2,requires:[`refinery`,`scrapyard`],baseCost:9,costGrowth:B,maxLevel:5,bonus:{costReduction:.05},x:2,y:3},{id:`squad_slots`,name:`Cuadrilla`,description:`+1 ranura de compañero activa.`,icon:`companion`,category:`exclusivo`,tier:2,requires:[`passive_loop`],baseCost:25,costGrowth:1,maxLevel:4,bonus:{companionSlots:1},x:2,y:4},{id:`offline_ops`,name:`Operaciones Offline`,description:`Los clics automáticos siguen funcionando 2 min al volver.`,icon:`clock`,category:`automatizacion`,tier:3,requires:[`auto_clicker2`],baseCost:25,costGrowth:1.8,maxLevel:5,bonus:{offlineClicks:120},x:3,y:0},{id:`quantum_amp`,name:`Amplificador Cuántico`,description:`+10% a todos los multiplicadores.`,icon:`crystal`,category:`multiplicador`,tier:3,requires:[`multiplier_amp`,`crate_sight`],baseCost:60,costGrowth:1.75,maxLevel:6,bonus:{clickMult:.1,passiveMult:.1},x:3,y:1},{id:`afk_extend`,name:`Suspensión Prolongada`,description:`+30 min de buff AFK por tarjeta por nivel.`,icon:`card`,category:`automatizacion`,tier:3,requires:[`shard_sifter`,`refinery`],baseCost:20,costGrowth:B,maxLevel:4,bonus:{afkHours:.5},x:3,y:2},{id:`master_smith`,name:`Maestro Forjador`,description:`+12% a la probabilidad de crafteo.`,icon:`collector`,category:`crafteo`,tier:3,requires:[`forge_luck`,`multiplier_amp`],baseCost:45,costGrowth:1.7,maxLevel:5,bonus:{craftLuck:.12},x:3,y:3},{id:`core_yield`,name:`Rendimiento del Núcleo`,description:`+20% de núcleos por reinicio.`,icon:`sparkle`,category:`economia`,tier:3,requires:[`core_sink`,`bulk_buy`],baseCost:40,costGrowth:1.8,maxLevel:5,bonus:{coreGain:.2},x:3,y:4},{id:`singularity`,name:`Singularidad`,description:`+18% a todos los multiplicadores. No tiene tope.`,icon:`sparkle`,category:`multiplicador`,tier:4,requires:[`quantum_amp`,`master_smith`],baseCost:220,costGrowth:2,maxLevel:5,bonus:{clickMult:.18,passiveMult:.18},x:4,y:1},{id:`full_automation`,name:`Automatización Total`,description:`+4 clics automáticos por segundo.`,icon:`bolt`,category:`automatizacion`,tier:4,requires:[`offline_ops`,`multiplier_amp`],baseCost:180,costGrowth:1.9,maxLevel:5,bonus:{autoClick:4},x:4,y:0},{id:`void_hoard`,name:`Almacén del Vacío`,description:`+8 ranuras de almacén por nivel.`,icon:`warehouse`,category:`economia`,tier:4,requires:[`storage_rack`,`core_yield`],baseCost:90,costGrowth:1.7,maxLevel:5,bonus:{storageSlots:8},x:4,y:2},{id:`chaos_forge`,name:`Forja del Caos`,description:`+20% a la probabilidad de crafteo. Recolectores más caras de reparar.`,icon:`collector`,category:`crafteo`,tier:4,requires:[`master_smith`,`core_yield`],baseCost:260,costGrowth:2.1,maxLevel:4,bonus:{craftLuck:.2},x:4,y:3}],Ut=Object.fromEntries(Ht.map(e=>[e.id,e])),Wt={automatizacion:{label:`Automatización`,color:`text-cyan-400`,icon:`bolt`},multiplicador:{label:`Multiplicadores`,color:`text-purple-400`,icon:`sparkle`},economia:{label:`Economía`,color:`text-amber-400`,icon:`store`},crafteo:{label:`Crafteo`,color:`text-rose-400`,icon:`collector`},exclusivo:{label:`Exclusivos`,color:`text-emerald-400`,icon:`crystal`}};function Gt(e,t){return Math.ceil(e.baseCost*e.costGrowth**+t)}var Kt={clickMult:0,passiveMult:0,costReduction:0,sellMult:0,craftLuck:0,shardBonus:0,autoClick:0,afkHours:0,offlineClicks:0,crateLuck:0,coreGain:0,storageSlots:0,companionSlots:0},qt=1e6;function Jt(e,t=0){if(e<1e6)return 0;let n=8*(e/1e6)**.6;return Math.floor(n*(1+t))}function Yt(e){let t=Jt(e.totalNanitesProduced,e.coreGain);return Math.max(0,t-e.totalCores)}function Xt(e,t=0){if(e<=0)return 0;let n=1+t,r=Math.max(qt,Math.ceil(1e6*(e/(8*n))**(1/.6)));for(;r>0&&Jt(r-1,t)>=e;)r--;for(;Jt(r,t)<e;)r++;return r}function Zt(e){if(Yt(e)>0)return 0;let t=Xt(e.totalCores+1,e.coreGain);return Math.max(0,t-e.totalNanitesProduced)}function Qt(e){if(Yt(e)>0)return 1;let t=Xt(e.totalCores+1,e.coreGain);return t<=0?0:Math.min(1,Math.max(0,e.totalNanitesProduced/t))}function $t(e){let t={...Kt};for(let[n,r]of Object.entries(e)){if(!r)continue;let e=Ut[n];if(e)for(let[n,i]of Object.entries(e.bonus)){let e=n;typeof i==`number`&&(t[e]+=i*r)}}return t}function en(e,t,n){let r=Ut[e];if(!r)return{ok:!1,reason:`Nodo desconocido.`};let i=t[e]||0;if(i>=r.maxLevel)return{ok:!1,reason:`Nivel máximo alcanzado.`};let a=r.requires.filter(e=>!(t[e]>0));if(a.length)return{ok:!1,reason:`Requiere: ${a.map(e=>Ut[e]?.name??e).join(`, `)}`};let o=Gt(r,i);return n<o?{ok:!1,reason:`Faltan ${o-n} núcleos.`}:{ok:!0}}function tn(e){let t=Object.keys(Ut),n=t.reduce((e,t)=>e+Ut[t].maxLevel,0),r=t.reduce((t,n)=>t+Math.min(e[n]||0,Ut[n].maxLevel),0);return n>0?r/n:0}var nn=[`consumable`,`crate`,`key`,`crystal`],rn={consumable:20,crate:20,key:99,crystal:99};function an(e){return!!e&&!!e.stackable&&nn.includes(e.type)}function V(e){if(!an(e))return 1;let t=Number(e.stackCount);return Number.isFinite(t)&&t>0?Math.floor(t):1}function on(e){return`${e?.type}::${e?.name}`}function H(e){let t=e||[],n=new Set;for(let e=0;e<t.length;e++){let r=t[e];n.add(an(r)?on(r):`#${e}:${r.id}`)}return n.size}function sn(e){let t=new Map,n=[],r=!1;for(let i of e){if(!an(i)){n.push(i);continue}let e=on(i),a=t.get(e);if(a){let e=V(i);a.stackCount=V(a)+e,r=!0;continue}let o={...i,stackCount:V(i)};t.set(e,o),n.push(o)}return{items:r?n:e,changed:r}}var cn=6e5,ln=18e5,un={clickBoost:`clickBoostExpiresAt`,clickX2:`clickX2ExpiresAt`,clickX3:`clickX3ExpiresAt`,passiveBoost:`passiveBoostExpiresAt`};function dn(e,t,n){let r=(e===`companion`?w.companionNames:w.collectorNames)[t]||[e===`companion`?`Dron Explorador`:`Blaster Láser`];return r[Math.floor(n()*r.length)]}function fn(e,t){let n=w.ranges[e]||[1,5];return Math.floor(t()*(n[1]-n[0]+1))+n[0]}function pn(e,t=Math.random){return{id:`comp_t${e}_${Date.now()}_${Math.floor(t()*1e9).toString(36).substring(2,7)}`,name:dn(`companion`,e,t),type:`click`,power:fn(e,t),rarity:w.rarityByTier[e]||`Común`,tier:e}}function mn(e,t=Math.random){let n=fn(e,t);return{id:`collector_t${e}_${Date.now()}_${Math.floor(t()*1e9).toString(36).substring(2,7)}`,name:dn(`collector`,e,t),type:`collector`,details:`Recolección por click: +${n}`,rarity:w.rarityByTier[e]||`Común`,tier:e,level:0,damage:n}}function hn(e,t){return lt(e,t)}function gn(e){return ge(e)}var _n=7,vn=200;function yn(e){if(e==null)return 0;if(typeof e==`number`)return e;if(typeof e==`string`){let t=Date.parse(e);return Number.isNaN(t)?0:t}return typeof e.toMillis==`function`?e.toMillis():typeof e.seconds==`number`?e.seconds*1e3:0}var bn={weapon:`collector`};function xn(e){let t=!1;for(let n of e){let e=bn[n.type];e&&(n.type=e,t=!0)}return t}function Sn(e,t,n=!0){let r=t;if(r&&!e.some(e=>e.id===r&&e.type===`collector`)&&(r=null),!r&&n){let t=e.filter(e=>e.type===`collector`&&e.equipped);t.length===1&&(r=t[0].id)}let i=r!==t;for(let t of e){let e=t.type===`collector`&&t.id===r;!!t.equipped!==e&&(t.equipped=e,i=!0)}return{id:r,changed:i}}function Cn(e){let t=e.toLowerCase();return t.includes(`expansor`)?`warehouseExpander`:t.includes(`afk`)?`afk`:t.includes(`click x3`)?`clickX3`:t.includes(`click x2`)?`clickX2`:t.includes(`pasivo`)?`passiveBoost`:/clics?\s*x2/.test(t)?`clickBoost`:null}function wn(e,t=1){let n=$e[e],r=it[`${e}Crate`];return{id:`crate_${e}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:n.name,type:`crate`,details:n.details,rarity:n.rarity,tier:0,sellPrice:Math.floor(r.cost/4),stackable:!0,stackCount:t}}async function Tn(e,t,n,r){let i=zt(),a={id:`companion_base_001`,name:`Dron Explorador`,type:`click`,power:5,rarity:`Común`,tier:1},o=(e.displayName||n||`Operativo`).trim(),s=o.toLowerCase()===`blanquician`,c=o.toLowerCase()===`admin`,l=s||c?1e8:0,u=new Map,f={saveVersion:_n,nanites:l,totalNanitesProduced:l,passiveIncome:0,passiveMultiplier:1,totalClicks:0,totalInfraestructure:0,cratesOpened:0,unlockedAchievements:[],cores:0,totalCores:0,resets:0,unlockedNodes:[],nodeLevels:{},shards:0,forgedCount:0,bonus:{clickMult:0,passiveMult:0,costReduction:0,sellMult:0,craftLuck:0,shardBonus:0,autoClick:0,afkHours:0,offlineClicks:0,crateLuck:0,coreGain:0,storageSlots:0,companionSlots:0},cosmetics:{title:`title_default`,frame:`frame_none`,banner:`banner_none`,unlocked:[`title_default`,`frame_none`,`banner_none`]},keys:3,upgradeCrystals:5,warehouseCapacity:15,maxCompanionSlots:1,warehouseGaps:[],afkCards:0,afkExpiresAt:0,crates:{common:2,rare:0,epic:0,legendary:0},keysByTier:{0:3,1:0,2:0,3:0},crystalsByTier:{1:5},crystalTotal:5,equippedCollectorId:null,companions:[a],activeCompanions:[],warehouse:[{id:`collector_blaster_001`,name:`Blaster Láser`,type:`collector`,details:`Recolección por click: +5`,rarity:`Común`,tier:1,level:0,damage:5,sellPrice:250},{id:`companion_base_001`,name:`Dron Explorador`,type:`companion`,details:`Recolección por segundo: +5/s`,rarity:`Común`,tier:1,sellPrice:250}],buffs:{clickBoostExpiresAt:0,passiveBoostExpiresAt:0,clickX2ExpiresAt:0,clickX3ExpiresAt:0}};function p(e){return e.type===`collector`?Fe(e,{sellMult:1+f.bonus.sellMult}):Math.floor((e.sellPrice||0)*(1+f.bonus.sellMult))}function m(e,t){let n=V(e);if(t==null)return n;let r=Math.floor(Number(t));return!Number.isFinite(r)||r<1?0:Math.min(r,n)}function g(e){let t=y(e);return t?(t.stackCount=V(t)+V(e),!0):H(f.warehouse)>=E()?!1:(f.warehouse.push(e),!0)}function y(e){if(!an(e))return null;let t=`${e.type}::${e.name}`;return f.warehouse.find(e=>an(e)&&`${e.type}::${e.name}`===t)??null}function b(e){return!!y(e)||H(f.warehouse)<E()}let x=[`warehouseSlot`,`backpackExpander`,`companionSlot1`,`companionSlot2`];function ee(e){return x.includes(e)?!0:b(te(e))}function te(e){if(P[e]!==void 0)return{type:`key`,name:N[P[e]].name,stackable:!0};if(e===`upgradeCrystal`)return{type:`crystal`,name:F[1].name,stackable:!0};if(e.endsWith(`Crate`)&&$e[e.replace(`Crate`,``).toLowerCase()])return{type:`crate`,name:$e[e.replace(`Crate`,``).toLowerCase()].name,stackable:!0};let t=Qe[e];return t?{type:`consumable`,name:t.name,stackable:!0}:e.startsWith(`companionCardT`)?{type:`companion`}:e.startsWith(`collectorCardT`)?{type:`collector`}:null}function ne(e,t=1){let n=f.warehouse.findIndex(t=>t.id===e);if(n<0)return 0;let r=f.warehouse[n];return r.stackable&&(r.stackCount||1)>t?(r.stackCount=(r.stackCount||1)-t,r.stackCount):(f.warehouse.splice(n,1),0)}function re(e,t){se(`key`,e,t)}function ae(e,t){se(`crystal`,e,t)}function oe(e){return!f.cosmetics.unlocked.includes(e)&&(f.cosmetics.unlocked.push(e),!0)}function se(e,t,n){if(n<=0)return;let r=ce(e,t);r.stackCount=n,g(r)||console.warn(`[inventario] Sin hueco en el almacén: se pierden `+n+` x `+e+` T`+t+`.`)}function ce(e,t){let n=e===`key`,r=n?N[t]:F[t],i=n?`key`:`crystal`,a=le(e,t);return{id:`${i}_t${t}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:r.name,type:n?`key`:`crystal`,details:r.details,rarity:r.rarity,tier:t,sellPrice:a,stackable:!0,stackCount:1}}function le(e,t){let n=e===`key`?N[t??0].cost:it.upgradeCrystal.cost;return n?Math.floor(n/4):0}function ue(){let e={0:0,1:0,2:0,3:0},t={},n=0;f.warehouse.forEach(r=>{if(r.type===`key`){let t=typeof r.tier==`number`?r.tier:I(r.name||``);e[t]=(e[t]||0)+(r.stackCount||1)}else if(r.type===`crystal`){let e=typeof r.tier==`number`?r.tier:1;t[e]=(t[e]||0)+(r.stackCount||1),n+=r.stackCount||1}}),f.keys=e[0]+e[1]+e[2]+e[3],f.keysByTier=e,f.crystalsByTier=t,f.upgradeCrystals=t[1]||0,f.crystalTotal=n,f.warehouse.forEach(e=>{e.type===`key`&&typeof e.tier!=`number`&&(e.tier=I(e.name||``)),e.type===`crystal`&&typeof e.tier!=`number`&&(e.tier=ut(e.name||``)===1?1:2)})}let C=!1,de=Date.now(),fe=0,me=6e4,_e=d(_,`users`,e.uid),ve=d(_,`rankings`,e.uid),ye=!1;function be(e){if(typeof document>`u`||typeof document.querySelector!=`function`)return;let t=document.querySelector(`#pending-save-indicator`);t&&t.classList.toggle(`hidden`,!e)}function xe(){be(!1),ye&&(ye=!1,S(`Guardado. Tu progreso ya está en la nube.`,`success`))}try{let t=await v(_e);if(t.exists()){let n=t.data(),r=typeof n.saveVersion==`number`?n.saveVersion:0;f.saveVersion=_n,f.nanites=n.nanites??0,f.totalNanitesProduced=n.totalNanitesProduced??n.nanites??0,f.totalClicks=n.totalClicks??0,f.unlockedAchievements=n.unlockedAchievements??[],f.totalInfraestructure=n.totalInfraestructure??0,f.cratesOpened=n.cratesOpened??0,f.keys=n.keys??3,f.upgradeCrystals=n.upgradeCrystals??5,f.warehouseCapacity=n.warehouseCapacity??15,f.maxCompanionSlots=n.maxCompanionSlots??1,f.crates={common:n.crates?.common??2,rare:n.crates?.rare??0,epic:n.crates?.epic??0,legendary:n.crates?.legendary??0},f.equippedCollectorId=n.equippedCollectorId??null,f.companions=n.companions??[],f.activeCompanions=n.activeCompanions??[],f.warehouse=n.warehouse??[],f.warehouseGaps=Array.isArray(n.warehouseGaps)?n.warehouseGaps.filter(e=>typeof e==`string`&&f.warehouse.some(t=>t.id===e)):[];let i=!1;r<7&&(xn(f.warehouse)&&(i=!0),!f.equippedCollectorId&&typeof n.equippedWeaponId==`string`&&(f.equippedCollectorId=n.equippedWeaponId,i=!0));let a=Sn(f.warehouse,f.equippedCollectorId);f.equippedCollectorId=a.id,a.changed&&(i=!0),f.warehouse.forEach(e=>{if(e.type===`collector`){if(e.damage===void 0){let t=e.tier||1,n=w.ranges[t]||[1,5];e.damage=Math.floor(Math.random()*(n[1]-n[0]+1))+n[0],i=!0}let t=`Recolección por click: +${e.damage}`;e.details!==t&&(e.details=t,i=!0)}if(e.type===`consumable`&&!e.buffId){let t=Cn(e.name||``);t&&(e.buffId=t,i=!0)}(e.type===`key`||e.type===`crystal`)&&typeof e.tier!=`number`&&(e.tier=e.type===`key`?I(e.name||``):ut(e.name||``)===1?1:2,i=!0)});let o=!1,s=(e,t)=>{let n=0;for(let r of f.warehouse)r.type===e&&(typeof r.tier==`number`?r.tier:e===`key`?I(r.name||``):ut(r.name||``)===1?1:2)===t&&(n+=r.stackable&&r.stackCount||1);return n},c=(e,t,n)=>{let r=Math.max(0,n-s(e,t));if(r<=0)return;let i=ce(e,t);i.stackCount=r,g(i)&&(o=!0)};c(`key`,0,n.keysByTier?n.keysByTier[0]??0:n.keys??3),c(`key`,1,n.keysByTier?.[1]??0),c(`key`,2,n.keysByTier?.[2]??0),c(`key`,3,n.keysByTier?.[3]??0),c(`crystal`,1,n.upgradeCrystals??5),c(`crystal`,2,n.crystalsByTier?.[2]??0),c(`crystal`,3,n.crystalsByTier?.[3]??0),c(`crystal`,4,n.crystalsByTier?.[4]??0),o&&(i=!0);let l=sn(f.warehouse);l.changed&&(f.warehouse=l.items,i=!0),f.afkCards=n.afkCards??0,f.afkExpiresAt=n.afkExpiresAt??0,f.cores=n.cores??0,f.totalCores=n.totalCores??0,f.resets=n.resets??0,f.unlockedNodes=n.unlockedNodes??[],f.nodeLevels=n.nodeLevels??{},f.shards=n.shards??0,f.forgedCount=n.forgedCount??0,f.cosmetics={title:n.cosmetics?.title??`title_default`,frame:n.cosmetics?.frame??`frame_none`,banner:n.cosmetics?.banner??`banner_none`,unlocked:Array.from(new Set([`title_default`,`frame_none`,`banner_none`,...n.cosmetics?.unlocked??[]]))},!n.totalCores&&(n.resets??0)>0&&(f.totalCores=Jt(f.totalNanitesProduced)),f.buffs={clickBoostExpiresAt:n.buffs?.clickBoostExpiresAt??0,passiveBoostExpiresAt:n.buffs?.passiveBoostExpiresAt??0,clickX2ExpiresAt:n.buffs?.clickX2ExpiresAt??0,clickX3ExpiresAt:n.buffs?.clickX3ExpiresAt??0};let u=Ke(e.uid);if(u.existe){if(u.ts>yn(n.updatedAt)){let e=u.nanites-f.nanites;f.nanites=u.nanites,f.totalNanitesProduced=u.producidas,f.totalClicks=u.clics,f.cores=u.nucleos,f.totalCores=u.totalNucleos,f.resets=u.reinicios,e>0?(console.info(`[cola] Recuperadas `+h(e)+` nanitas sin confirmar.`),S(`Recuperadas `+h(e)+` nanitas que no se habían guardado.`,`success`)):e<0&&console.info(`[cola] Adoptado un saldo más bajo (`+h(e)+`).`)}else console.info(`[cola] Descartada: el documento del servidor es más reciente.`),Je(u.ts)}i&&O(),D()}else await ie(_e,{saveVersion:_n,userId:e.uid,username:o,nanites:f.nanites,totalNanitesProduced:f.totalNanitesProduced,totalClicks:0,totalInfraestructure:0,cratesOpened:0,keys:f.keys,keysByTier:f.keysByTier,crystalsByTier:f.crystalsByTier,upgradeCrystals:f.upgradeCrystals,warehouseCapacity:f.warehouseCapacity,maxCompanionSlots:f.maxCompanionSlots,afkCards:f.afkCards,afkExpiresAt:f.afkExpiresAt,crates:f.crates,equippedCollectorId:f.equippedCollectorId,companions:f.companions,activeCompanions:f.activeCompanions,warehouse:f.warehouse,warehouseGaps:f.warehouseGaps,buffs:f.buffs,unlockedAchievements:f.unlockedAchievements,cores:f.cores,totalCores:f.totalCores,resets:f.resets,unlockedNodes:f.unlockedNodes,nodeLevels:f.nodeLevels,shards:f.shards,forgedCount:f.forgedCount,cosmetics:f.cosmetics,updatedAt:new Date}),await ie(ve,{userId:e.uid,username:e.displayName||`Operativo`,score:f.nanites,totalClicks:0,achievements:0,secretAchievements:0,forgedCount:0,updatedAt:new Date})}catch(e){console.error(`Error al sincronizar con Firebase:`,e)}function Se(){f.companions.forEach(e=>{!f.warehouse.some(t=>t.id===e.id)&&H(f.warehouse)<E()&&f.warehouse.push({id:e.id,name:e.name,type:`companion`,details:`Recolección por segundo: +${e.power}/s`,rarity:e.rarity,sellPrice:e.rarity===`Común`?100:e.rarity===`Raro`?500:e.rarity===`Épico`?2e3:1e4})}),De()}function Ce(){let e=Te(f.warehouseGaps);e.join(`,`)!==(f.warehouseGaps||[]).join(`,`)&&(f.warehouseGaps=e)}function Te(e){if(!Array.isArray(e))return[];let t=new Set(f.warehouse.map(e=>e.id)),n=[];for(let r of e)if(typeof r==`string`&&t.has(r)&&(n.push(r),n.length>=vn))break;return n}function Ee(e){let t=Te(e),n=(f.warehouseGaps||[]).join(`,`);return f.warehouseGaps=t,n!==t.join(`,`)&&(O(),!0)}function De(){let e=E();if(H(f.warehouse)<=e)return;let t=e=>e.id===f.equippedCollectorId?1e3:f.activeCompanions.includes(e.id)?800:e.type===`collector`?500+(e.tier||0)+(e.potential||0)*50:e.type===`companion`?400+(e.tier||0):e.type===`crate`?300:e.type===`consumable`?200:100,n=f.warehouse.map((e,n)=>({w:e,index:n,s:t(e)})).sort((e,t)=>t.s-e.s||e.index-t.index).slice(0,e).sort((e,t)=>e.index-t.index).map(e=>e.w);f.warehouse=n,Ce()}function Oe(e){let t=e.toLowerCase();return t.includes(`común`)?`common`:t.includes(`rara`)?`rare`:t.includes(`épica`)?`epic`:t.includes(`legendaria`)?`legendary`:null}function ke(){let e={common:0,rare:0,epic:0,legendary:0};return f.warehouse.forEach(t=>{if(t.type!==`crate`)return;let n=Oe(t.name||``);n&&(e[n]+=t.stackCount||1)}),e}function Ae(){f.crates=ke()}function je(){let e=ke();Object.keys($e).forEach(t=>{let n=(f.crates[t]||0)-e[t];if(n<=0)return;let r=E()-H(f.warehouse),i=Math.min(n,Math.max(0,r));for(let e=0;e<i&&g(wn(t));e++);e[t]+=i}),f.crates=e}function Me(){let e=0;f.warehouse.forEach(t=>{t.type===`consumable`&&(t.buffId??Cn(t.name||``))===`afk`&&(e+=t.stackable&&t.stackCount||1)}),f.afkCards=e}Le(),Ne(),Se(),je(),ue(),Me(),T(),await O();function Ne(){i.unlocked=f.unlockedAchievements,i.clickBonus=0,i.passiveBonus=0;for(let e of Rt)f.unlockedAchievements.includes(e.id)&&(i.clickBonus+=e.reward.clickBonus,i.passiveBonus+=e.reward.passiveBonus)}function T(){let e=Bt(f,i);if(e.length!==0){for(let t of e)f.unlockedAchievements.includes(t.id)||f.unlockedAchievements.push(t.id),r?.(t);D(),O()}}function Ie(){let e=1;return f.activeCompanions.forEach(t=>{let n=f.companions.find(e=>e.id===t);n&&n.type===`multiplier`&&(e+=n.power)}),Math.max(1,e)}function Le(){f.bonus=$t(f.nodeLevels),f.unlockedNodes=Object.keys(f.nodeLevels).filter(e=>(f.nodeLevels[e]||0)>0)}function E(){return f.warehouseCapacity+f.bonus.storageSlots}function Re(){return f.maxCompanionSlots+f.bonus.companionSlots}function ze(){return cn+f.bonus.afkHours*36e5}function D(){let e=0,t=[];f.activeCompanions.forEach(n=>{let r=f.companions.find(e=>e.id===n);r&&r.type!==`multiplier`&&(e+=r.power,t.push(r))}),Date.now()<f.buffs.passiveBoostExpiresAt&&(e*=2),f.passiveMultiplier=Ie();let n=e*f.passiveMultiplier*(1+i.passiveBonus)*(1+f.bonus.passiveMult);f.passiveIncome=Math.floor(n),Be(t,f.passiveIncome)}function Be(e,t){if(u.clear(),!e.length)return;let n=e.map(e=>Math.max(0,e.power||0)),r=n.reduce((e,t)=>e+t,0);if(r<=0)return;let i=0,a=[];for(let e of n){let n=t*e/r,o=Math.floor(n);a.push(o),i+=o}let o=t-i;for(let e=0;o>0;e=(e+1)%a.length,o--)a[e]++;e.forEach((e,t)=>u.set(e.id,a[t]))}function Ve(){let e={clickMult:0,passiveMult:0,flat:0};if(!f.equippedCollectorId)return e;let t=f.warehouse.find(e=>e.id===f.equippedCollectorId);if(!t?.affixes?.length)return e;for(let n of t.affixes){let r=pe[n];r&&(e.clickMult+=r.effect.clickMult||0,e.passiveMult+=r.effect.passiveMult||0,e.flat+=(r.effect.flatDamage||0)*(1+(t.level||0)*.08))}return e}function He(){let e={total:0,base:0,conNivel:0};if(!f.equippedCollectorId)return e;let t=f.warehouse.find(e=>e.id===f.equippedCollectorId);if(!t)return e;let n=Ve(),r=t.damage||0,a=1+(t.level||0)*.1,o=r*a;return{total:(r+n.flat)*a*Ie()*(1+i.clickBonus)*(1+f.bonus.clickMult)*(1+n.clickMult),base:r,conNivel:o}}function Ue(){return Math.floor(He().total)}function We(){let e=He(),t=Math.floor(e.total*Ge()),n=Math.floor(e.conNivel),r=n-e.base,i=t-n;return{total:t,base:e.base,porNivel:r,porBonos:i}}function Ge(){let e=1,t=Date.now();return t<f.buffs.clickBoostExpiresAt&&(e=2),t<f.buffs.clickX3ExpiresAt?e=3:t<f.buffs.clickX2ExpiresAt&&(e=2),e}async function O(){if(!e)return;let t=qe(e.uid,f.nanites,f.totalNanitesProduced,f.totalClicks,f.cores,f.totalCores,f.resets);try{let n={saveVersion:_n,userId:e.uid,username:o,nanites:f.nanites,totalNanitesProduced:f.totalNanitesProduced,totalClicks:f.totalClicks,totalInfraestructure:f.totalInfraestructure,cratesOpened:f.cratesOpened,keys:f.keys,keysByTier:f.keysByTier,crystalsByTier:f.crystalsByTier,upgradeCrystals:f.upgradeCrystals,warehouseCapacity:f.warehouseCapacity,maxCompanionSlots:f.maxCompanionSlots,afkCards:f.afkCards,afkExpiresAt:f.afkExpiresAt,crates:f.crates,equippedCollectorId:f.equippedCollectorId,companions:f.companions,activeCompanions:f.activeCompanions,warehouse:f.warehouse,warehouseGaps:f.warehouseGaps,buffs:f.buffs,unlockedAchievements:f.unlockedAchievements,cores:f.cores,totalCores:f.totalCores,resets:f.resets,unlockedNodes:f.unlockedNodes,nodeLevels:f.nodeLevels,shards:f.shards,forgedCount:f.forgedCount,cosmetics:f.cosmetics,updatedAt:new Date};await ie(_e,n,{merge:!0}),await ie(ve,{userId:e.uid,username:e.displayName||`Operativo`,score:f.nanites,totalClicks:f.totalClicks,achievements:f.unlockedAchievements.filter(e=>!Vt.includes(e)).length,secretAchievements:f.unlockedAchievements.filter(e=>Vt.includes(e)).length,forgedCount:f.forgedCount,title:f.cosmetics.title,updatedAt:new Date},{merge:!0}),Je(t)&&xe()}catch(e){console.error(`Error al guardar en Firebase:`,e),be(!0),ye||(ye=!0,S(`Sin conexión con el servidor. Tu progreso se guarda en este dispositivo y se subirá solo al volver.`,`error`))}}function Xe(){return document.visibilityState===`visible`&&document.hasFocus()}function Ze(e){let t=performance.now()-e,n=Math.max(0,f.afkExpiresAt-Date.now()),r=Math.min(t,n,ln);r<=0||(D(),!(f.passiveIncome<=0)&&(f.nanites+=r/1e3*f.passiveIncome))}let k=()=>{if(!Xe()){fe===0&&(fe=performance.now(),C=!0,L&&=(clearInterval(L),null),t(f,!0));return}fe>0&&(Ze(fe),fe=0),C=Date.now()-de>me,de=Date.now(),L||R()},A=e=>{e&&e instanceof KeyboardEvent&&(e.key===`Enter`||e.key===` `||e.key===`Spacebar`)||e&&e.type===`click`&&(de=Date.now(),C&&(C=!1,st=!0,t(f,!1)))},j=document;document.addEventListener(`visibilitychange`,k),window.addEventListener(`focus`,k),window.addEventListener(`blur`,k),window.addEventListener(`pageshow`,k),window.addEventListener(`pagehide`,k),j.addEventListener(`freeze`,k),j.addEventListener(`resume`,k),window.addEventListener(`keydown`,A),window.addEventListener(`click`,A);let et=setInterval(O,15e3),nt=()=>{O()};window.addEventListener(`beforeunload`,nt);let rt=()=>{e&&Ye(e.uid)&&O()};window.addEventListener(`online`,rt),window.addEventListener(`focus`,rt),window.addEventListener(`pageshow`,rt),e&&Ye(e.uid)&&setTimeout(()=>{O()},1200);let at=1e3,st=!1,ct=0,ft=[];function pt(e){ft.length>=40&&ft.shift(),ft.push({cantidad:e})}let mt=0,L=null;function R(){L&&clearInterval(L),mt=0,ft=[],L=setInterval(()=>{if(!Xe()){k();return}let e=Date.now()-de;!C&&e>me&&(C=!0,mt=0),D();let n=Date.now(),r=n<f.buffs.passiveBoostExpiresAt,i=n<f.afkExpiresAt;if(C&&!r&&!i){t(f,!0);return}if(st){t(f,!1);return}for(mt+=500;mt>=at;)mt-=at,f.passiveIncome>0&&(f.nanites+=f.passiveIncome,f.totalNanitesProduced+=f.passiveIncome);if(f.bonus.autoClick>0)for(ct+=f.bonus.autoClick*(500/1e3);ct>=1;){--ct;let e=Ue()*Ge();f.nanites+=e,f.totalNanitesProduced+=e,f.totalClicks+=1,pt(Math.floor(e))}T(),t(f,C&&(r||i))},500)}Xe()&&R();let ht={getState:()=>f,getDisplayName:()=>o,isAfk:()=>C,isPresent:()=>Xe(),getClickDamage:()=>Math.floor(Ue()*Ge()),getClickDamageBreakdown:()=>We(),getCompanionOutput:e=>u.get(e)??0,getAnunciablesIngreso:()=>f.activeCompanions.map(e=>({id:e,cantidad:u.get(e)??0})).filter(e=>{let t=f.companions.find(t=>t.id===e.id);return t&&t.type!==`multiplier`}),drainClickEvents:()=>{if(!ft.length)return[];let e=ft;return ft=[],e},getAchievements:()=>Rt.map(e=>({...e,unlocked:f.unlockedAchievements.includes(e.id),current:e.progress(f).current,target:e.progress(f).target})),cancelBuff:e=>{A();let n={clickBoost:`Clics x2`,clickX2:`Clics x2 (tarjeta)`,clickX3:`Clics x3 (tarjeta)`,passiveBoost:`Pasivo x2`,afk:`AFK`};if(e===`afk`){if(f.afkExpiresAt<=Date.now())return!1;f.afkExpiresAt=0}else{let t=un[e];if(f.buffs[t]<=Date.now())return!1;f.buffs[t]=0}return D(),t(f,C),O(),n[e]},updateState:e=>{Object.assign(f,e),De(),Se(),Ce(),Ae(),ue(),Me(),Ne(),D(),T(),t(f,C),O()},moveItems:(e,n,r=`antes`)=>{let i=f.warehouse;if(!e.length)return!1;let a=e.map(e=>i.findIndex(t=>t.id===e)).filter(e=>e>=0).sort((e,t)=>e-t);if(!a.length)return!1;let o=new Set(a),s=n==null?-1:i.findIndex(e=>e.id===n);if(n!=null&&s<0||s>=0&&o.has(s))return!1;let c=a.map(e=>i[e]);for(let e=a.length-1;e>=0;e--)i.splice(a[e],1);if(s<0)i.push(...c);else{let e=i.findIndex(e=>e.id===n);i.splice(r===`despues`?e+1:e,0,...c)}return t(f,C),O(),!0},getWarehouseGaps:()=>[...f.warehouseGaps||[]],setWarehouseGaps:Ee,sellItem:(e,n)=>{A();let r=f.warehouse.findIndex(t=>t.id===e);if(r<0)return{ok:!1,msg:`Ese item ya no está en el almacén.`};let i=f.warehouse[r];if(i.type===`collector`&&f.equippedCollectorId===i.id||i.type===`companion`&&f.activeCompanions.includes(i.id))return{ok:!1,msg:`Desequípalo antes de venderlo.`};let a=m(i,n);if(a<=0)return{ok:!1,msg:`Elige una cantidad mayor que cero.`};if((i.type===`collector`||i.type===`companion`)&&f.warehouse.filter(e=>e.type===i.type).length<=1)return{ok:!1,msg:`No puedes vender el último de su tipo.`};let o=Math.floor(p(i)*a);return f.nanites+=o,ne(i.id,a),Ce(),i.type===`companion`&&(f.companions=f.companions.filter(e=>e.id!==i.id),f.activeCompanions=f.activeCompanions.filter(e=>e!==i.id)),Ae(),ue(),Me(),Se(),D(),T(),t(f,C),O(),{ok:!0,gained:o,sold:a}},useConsumable:e=>{A();let n=f.warehouse.find(t=>t.id===e);if(!n)return{ok:!1,msg:`Ese item ya no está en el almacén.`};if(n.type!==`consumable`)return{ok:!1,msg:`Esto no se puede usar.`};let r=n.buffId??Cn(n.name||``);if(!r)return{ok:!1,msg:`Este consumible no tiene efecto conocido.`};let i=Date.now(),a=ze();switch(r){case`warehouseExpander`:if(f.warehouseCapacity>=50)return{ok:!1,msg:`Almacén al máximo.`};f.warehouseCapacity+=1;break;case`afk`:{let e=Math.max(i,f.afkExpiresAt||0);f.afkExpiresAt=Math.min(e+a,i+a*3);break}case`clickBoost`:{let e=Math.max(i,f.buffs.clickBoostExpiresAt);f.buffs.clickBoostExpiresAt=Math.min(e+18e5,i+36e5);break}case`passiveBoost`:{let e=Math.max(i,f.buffs.passiveBoostExpiresAt);f.buffs.passiveBoostExpiresAt=Math.min(e+36e5,i+72e5);break}case`clickX2`:{let e=Math.max(i,f.buffs.clickX2ExpiresAt);f.buffs.clickX2ExpiresAt=Math.min(e+3e4,i+18e5);break}case`clickX3`:{let e=Math.max(i,f.buffs.clickX3ExpiresAt);f.buffs.clickX3ExpiresAt=Math.min(e+3e4,i+18e5);break}case`calibrationStone`:case`stabilityNano`:return{ok:!1,msg:`Este consumible se usa en la Forja.`};default:return{ok:!1,msg:`Este consumible no tiene efecto conocido.`}}return ne(n.id,1),Ce(),Me(),D(),T(),t(f,C),O(),{ok:!0,msg:`${n.name}: aplicado`}},click:()=>{A(),st&&=!1;let e=Ue(),n=Ge(),r=Math.floor(e*n);return f.nanites+=r,f.totalNanitesProduced+=r,f.totalClicks+=1,T(),t(f,C),r},upgradeEquippedCollector:(e=1)=>{if(A(),!f.equippedCollectorId)return{success:!1,rolled:!1,msg:`No hay ningún recolector equipado.`};let n=f.warehouse.find(e=>e.id===f.equippedCollectorId);if(!n)return{success:!1,rolled:!1,msg:`Recolector no encontrado.`};let r=n.level||0,i=he(n.maxLevel);if(r>=i)return{success:!1,rolled:!1,msg:`Recolector al nivel máximo (+${i*10}%).`};let a=f.warehouse.find(t=>t.type===`crystal`&&(typeof t.tier==`number`?t.tier:1)===e);if(!a)return{success:!1,rolled:!1,msg:`No tienes ${F[e]?.name??`Cristal`}.`};let o=ge(r),s=a.stackCount||1;if(s<o)return{success:!1,rolled:!1,msg:`Necesitas ${o} x ${F[e].name} (tienes ${s}).`};ne(a.id,o),Ce(),ue();let c=lt(r,F[e]?.power??1);return Math.random()*100<=c?(n.level=r+1,t(f,C),O(),{success:!0,rolled:!0,level:n.level,msg:`¡Mejora exitosa! ${n.name} ascendió al nivel ${n.level}.`}):(t(f,C),O(),{success:!1,rolled:!0,level:r,msg:`Fallo en el sintonizador. ${n.name} se mantiene en nivel ${r}. (-${o} cristales)`})},expandWarehouse:()=>{A();let e=Math.floor(500*(1-f.bonus.costReduction));return f.nanites>=e&&f.warehouseCapacity<50&&(f.nanites-=e,f.warehouseCapacity+=5,t(f,C),O(),!0)},unlockCompanionSlot:()=>{if(A(),f.maxCompanionSlots>=5)return!1;let e=Math.floor(tt[Re()]??9e6);return f.nanites>=e&&(f.nanites-=e,f.maxCompanionSlots+=1,t(f,C),O(),!0)},toggleCompanionActive:e=>ht.equipCompanion(e),equipCollector:e=>{A();let n=f.warehouse.find(t=>t.id===e);if(!n||n.type!==`collector`)return!1;let r=f.equippedCollectorId===n.id,{id:i}=Sn(f.warehouse,r?null:n.id,!r);return f.equippedCollectorId=i,D(),t(f,C),O(),!0},equipCompanion:e=>{A();let n=f.activeCompanions.indexOf(e);if(n>-1)f.activeCompanions.splice(n,1);else{if(!f.companions.some(t=>t.id===e))return!1;if(f.activeCompanions.length<Re())f.activeCompanions.push(e),f.activeCompanions.sort((e,t)=>{let n=f.companions.find(t=>t.id===e),r=f.companions.find(e=>e.id===t);return(n?.tier||0)-(r?.tier||0)});else return!1}return D(),t(f,C),O(),!0},buyStoreItem:e=>{A();let n=it[e];if(!n)return!1;let r=Math.floor(n.cost*(1-f.bonus.costReduction));if(f.nanites<r)return!1;let i=Re(),a=M[e];if(a&&i>=a.da)return!1;if(!ee(e))return S(`Almacén lleno. No puedes comprar más items.`,`error`),!1;if(f.nanites-=r,P[e]!==void 0||e===`upgradeCrystal`){let n=P[e]!==void 0,i=n?P[e]:1,a=ce(n?`key`:`crystal`,i);return g(a)?(ue(),t(f,C),O(),a):(f.nanites+=r,!1)}if(e===`warehouseSlot`)return f.warehouseCapacity+=5,T(),t(f,C),O(),{id:`slot_${Date.now()}`,name:`Espacio de Almacén`,type:`upgrade`,details:`+5 espacios de almacén`,rarity:`Raro`,tier:0};if(e===`commonCrate`||e===`rareCrate`||e===`epicCrate`||e===`legendaryCrate`){let n=wn(e.replace(`Crate`,``).toLowerCase());return g(n)?(Ae(),t(f,C),O(),n):(f.nanites+=r,!1)}if(Qe[e]){let i=Qe[e],a={id:`cons_${e}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,name:i.name,type:`consumable`,details:i.details,rarity:i.rarity,tier:0,sellPrice:Math.floor(n.cost/4),stackable:!0,stackCount:1,buffId:i.buffId};return g(a)?(Me(),t(f,C),O(),a):(f.nanites+=r,!1)}if(M[e]){let n=M[e];return f.maxCompanionSlots=n.da,t(f,C),O(),{id:`slots${n.da}_${Date.now()}`,name:n.etiqueta,type:`upgrade`,details:`${n.da} slots de compañero activos`,rarity:`Épico`,tier:0}}if(e.startsWith(`companionCardT`)){let i=pn(parseInt(e.replace(`companionCardT`,``)));f.companions.push(i);let a={id:i.id,name:i.name,type:`companion`,details:`Recolección por segundo: +${i.power}/s`,rarity:i.rarity,tier:i.tier,sellPrice:Math.floor(n.cost/4)};return g(a)?(t(f,C),O(),a):(f.companions.pop(),f.nanites+=r,!1)}if(e.startsWith(`collectorCardT`)){let i={...mn(parseInt(e.replace(`collectorCardT`,``))),sellPrice:Math.floor(n.cost/4)};return g(i)?(t(f,C),O(),i):(f.nanites+=r,!1)}return t(f,C),O(),!0},openCrateBox:(e,n)=>{A();let r=f.warehouse.find(t=>t.id===e&&t.type===`crate`);if(!r)return{ok:!1,msg:`La caja ya no está en el almacén.`};let i=Oe(r.name||``);if(!i)return{ok:!1,msg:`No se reconoce el tipo de esta caja.`};let a=f.warehouse.find(e=>e.id===n&&e.type===`key`);if(!a)return{ok:!1,msg:`Ya no tienes esa llave.`};let o=typeof a.tier==`number`?a.tier:I(a.name||``),s=ot[i];if(!dt(o,s))return{ok:!1,msg:`${a.name} no abre ${$e[i].name}. Necesitas ${N[s].name}.`};ne(r.id,1),ne(a.id,1),Ce(),f.cratesOpened+=1;let c=Pt(i,{nanites:e=>{f.nanites+=e,f.totalNanitesProduced+=e},crystals:(e,t)=>{ae(t,e)},keys:(e,t)=>{re(t,e)},hasSpace:()=>H(f.warehouse)<E(),unlockCosmetic:e=>oe(e),ownedCosmetics:()=>f.cosmetics.unlocked,addItem:e=>g(e)?(e.type===`companion`&&!f.companions.some(t=>t.id===e.id)&&f.companions.push({id:e.id,name:e.name,type:e.companionType||`passive`,power:typeof e.power==`number`?e.power:1,rarity:e.rarity,tier:e.tier}),!0):!1});return Ae(),ue(),Me(),D(),t(f,C),O(),{ok:!0,reward:c,crateType:i}},getPrestigeInfo:()=>({cores:f.cores,totalCores:f.totalCores,pending:Yt({totalNanitesProduced:f.totalNanitesProduced,totalCores:f.totalCores,coreGain:f.bonus.coreGain}),resets:f.resets,totalProduced:f.totalNanitesProduced,bonus:f.bonus}),prestige:()=>{A();let e=Yt({totalNanitesProduced:f.totalNanitesProduced,totalCores:f.totalCores,coreGain:f.bonus.coreGain});if(e<=0)return{success:!1,gained:0,msg:`Necesitas producir más para reciclar.`};let n=f.shards,r=f.forgedCount,i=[...f.unlockedAchievements],o=f.cores+e,s=f.totalCores+e,c=f.resets+1,l={...f.nodeLevels},u={...f.cosmetics,unlocked:[...f.cosmetics.unlocked]};return Object.assign(f,{nanites:0,totalNanitesProduced:0,passiveIncome:0,passiveMultiplier:1,totalClicks:0,totalInfraestructure:0,cratesOpened:0,keys:3,upgradeCrystals:5,warehouseCapacity:15,maxCompanionSlots:1,afkCards:0,afkExpiresAt:0,crates:{common:2,rare:0,epic:0,legendary:0},equippedCollectorId:null,companions:[a],activeCompanions:[],warehouse:[{id:`collector_blaster_001`,name:`Blaster Láser`,type:`collector`,details:`Recolección por click: +5`,rarity:`Común`,tier:1,level:0,damage:5,sellPrice:250},{id:`companion_base_001`,name:`Dron Explorador`,type:`companion`,details:`Recolección por segundo: +5/s`,rarity:`Común`,tier:1,sellPrice:250}],buffs:{clickBoostExpiresAt:0,passiveBoostExpiresAt:0,clickX2ExpiresAt:0,clickX3ExpiresAt:0},cores:o,totalCores:s,resets:c,nodeLevels:l,unlockedNodes:Object.keys(l),shards:n,forgedCount:r,unlockedAchievements:i,cosmetics:u}),Le(),Ne(),Se(),je(),D(),T(),t(f,C),O(),{success:!0,gained:e,msg:`+${e} núcleos`}},buyNode:e=>{A();let n=en(e,f.nodeLevels,f.cores);if(!n.ok)return{success:!1,msg:n.reason??`No se puede comprar.`};let r=Ut[e],i=f.nodeLevels[e]||0,a=Gt(r,i);return f.cores-=a,f.nodeLevels[e]=i+1,Le(),D(),t(f,C),O(),{success:!0,msg:`${r.name} → nivel ${i+1}`}},forgeCollector:(r,i=0,a=0)=>{if(A(),(f.nodeLevels.blueprint||0)<1)return{success:!1,msg:`Necesitas el nodo "Planos Viejos" para craftear.`};if(r.length!==3)return{success:!1,msg:`Selecciona exactamente 3 recolectores.`};let o=r.map(e=>f.warehouse.find(t=>t.id===e)).filter(e=>!!e);if(o.length!==3)return{success:!1,msg:`Material no encontrado.`};if(o.some(e=>e.type!==`collector`))return{success:!1,msg:`Solo se pueden fusionar recolectores.`};let s=o[0].tier||1;if(o.some(e=>(e.tier||1)!==s))return{success:!1,msg:`Las 3 recolectores deben ser del mismo tier.`};if(o.some(e=>e.equipped||e.id===f.equippedCollectorId))return{success:!1,msg:`No puedes fusionar el recolector equipado. Desequípala primero.`};if(s>=11)return{success:!1,msg:`T11 es el techo de la forja.`};let c=Math.max(0,Math.min(5,i));if(c>0){let e=f.warehouse.find(e=>e.type===`consumable`&&e.buffId===`calibrationStone`);if(!e)return{success:!1,msg:`No tienes Piedras de Calibración.`};let t=e.stackCount||1;if(t<c)return{success:!1,msg:`Solo tienes ${t} Piedra(s) de Calibración.`};e.stackCount=t-c,e.stackCount<=0&&(f.warehouse=f.warehouse.filter(t=>t.id!==e.id))}let l=+(a>0);if(l>0){let e=f.warehouse.find(e=>e.type===`consumable`&&e.buffId===`stabilityNano`);if(!e)return{success:!1,msg:`No tienes Nanopartículas de Estabilidad.`};let t=e.stackCount||1;if(t<l)return{success:!1,msg:`Solo tienes ${t} Nanopartícula(s).`};e.stackCount=t-l,e.stackCount<=0&&(f.warehouse=f.warehouse.filter(t=>t.id!==e.id))}let u=we(o,s,e.displayName||n||`Anónimo`,{craftLuck:f.bonus.craftLuck,shardBonus:f.bonus.shardBonus,stonesUsed:c,nanoUsed:l});if(u.error)return{success:!1,msg:u.error};if(u.success&&u.collector){let e=u.collector;e.sellPrice=Fe(e,{sellMult:1+f.bonus.sellMult});let n=o.reduce((e,t)=>e.damage<t.damage?e:t,o[0]);return f.warehouse=f.warehouse.filter(e=>!r.includes(e.id)||e.id===n.id),f.warehouse.push(e),f.forgedCount+=1,D(),T(),t(f,C),O(),{success:!0,collector:e,chance:u.chanceUsed,msg:`${e.name} forjada`}}return f.warehouse=f.warehouse.filter(e=>!r.includes(e.id)),f.shards+=u.shards||0,t(f,C),O(),{success:!1,shards:u.shards,chance:u.chanceUsed,msg:`Fallo en la forja: +${u.shards} esquirlas`}},getForgeInfo:()=>({shards:f.shards,craftLuck:f.bonus.craftLuck,forgeUnlocked:(f.nodeLevels.blueprint||0)>0,baseChance:e=>{let t=.78-(e-1)*.05;return Math.min(.95,Math.max(.3,t)+f.bonus.craftLuck)}}),getSellPrice:e=>{let t=f.warehouse.find(t=>t.id===e);return t?p(t):0},getSellTotal:(e,t)=>{let n=f.warehouse.find(t=>t.id===e);if(!n)return 0;let r=m(n,t);return r>0?Math.floor(p(n)*r):0},getCollectorValue:e=>{let t=f.warehouse.find(t=>t.id===e);return!t||t.type!==`collector`?0:Pe(t,{sellMult:1+f.bonus.sellMult})},equipCosmetic:(e,n)=>(A(),f.cosmetics.unlocked.includes(n)?(f.cosmetics[e]=n,t(f,C),O(),!0):!1),unlockCosmetic:e=>oe(e),getCapacity:()=>E(),canBuyStoreItem:e=>{let t=M[e];return t&&Re()>=t.da?!1:ee(e)},getCompanionSlots:()=>Re(),getAfkDurationMs:()=>ze(),cleanup:async()=>{L&&clearInterval(L),clearInterval(et),window.removeEventListener(`beforeunload`,nt),document.removeEventListener(`visibilitychange`,k),window.removeEventListener(`focus`,k),window.removeEventListener(`blur`,k),window.removeEventListener(`pageshow`,k),window.removeEventListener(`pagehide`,k),j.removeEventListener(`freeze`,k),j.removeEventListener(`resume`,k),window.removeEventListener(`keydown`,A),window.removeEventListener(`click`,A),window.removeEventListener(`online`,rt),window.removeEventListener(`focus`,rt),window.removeEventListener(`pageshow`,rt),await O()},flush:()=>{O()}};return ht}var En=`data-page-root`;function Dn(e,t){let n=e.querySelector(`:scope > [${En}]`),r=e.ownerDocument.createElement(`div`);return r.setAttribute(En,``),r.className=`page-root`,r.innerHTML=t,n?n.replaceWith(r):e.appendChild(r),r}function On(e,t){e.addEventListener(`click`,e=>{let n=e.target.closest(`[data-nav]`);if(n){e.stopPropagation(),t.go?.(n.dataset.nav);return}e.target.closest(`[data-nav-back]`)&&(e.stopPropagation(),t.back?.())})}function kn(e,t){let n=e.onBack?`<button data-nav-back
         class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0
                transition-transform active:scale-90"
         style="min-width:44px;min-height:44px" aria-label="Volver">
         <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${i(`back`)}</span>
       </button>`:``,r=e.state&&!e.hideNanites?`<span id="page-nanites"
             class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border flex-shrink-0 tabular
                    border-[var(--border-color)]"
             style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
         <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
         <span class="font-mono text-[11px] text-[var(--text-main)]" id="page-nanites-val">${h(e.state.nanites||0)}</span>
       </span>`:``;return`
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">
      <header
        class="card-glass flex-shrink-0 flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">
        ${n}
        ${e.icon?`<span class="accent-text flex-shrink-0 hidden sm:block [&>span>svg]:w-5 [&>span>svg]:h-5">${i(e.icon)}</span>`:``}
        <div class="min-w-0 flex-1">
          <h1 class="font-['Orbitron'] font-bold text-[15px] md:text-lg accent-text truncate leading-tight">
            ${e.title}
          </h1>
          ${e.subtitle?`<p class="text-[10px] md:text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5 hidden sm:block">${e.subtitle}</p>`:``}
        </div>
        ${r}
        ${e.actions?`<div class="flex items-center gap-1.5 flex-shrink-0">${e.actions}</div>`:``}
      </header>

      <main class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
                  px-3 md:px-4 pt-2 md:pt-3 overflow-y-auto overscroll-contain
                  -webkit-overflow-scrolling:touch ${e.bodyClass||``}"
           style="padding-bottom: calc(1rem + env(safe-area-inset-bottom))">
        ${t}
      </main>
    </div>
  `}function An(e){return`
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      ${e.map(e=>`
        <div class="card-glass border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
          <span class="label-caps">
            ${e.glyph?`<span class="accent-text not-italic">${e.glyph}</span>`:``}
            ${e.label}
          </span>
          <span class="font-['Orbitron'] font-bold text-[15px] md:text-base tabular
                       ${e.tone||`accent-text`}"
                ${e.valueId?`id="${e.valueId}"`:``}>${e.value}</span>
        </div>
      `).join(``)}
    </div>
  `}function jn(e,t,n=``){return`
    <div class="flex items-center justify-between gap-2 mb-2.5">
      <h2 class="label-caps flex items-center gap-1.5">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(t)}</span>
        ${e}
      </h2>
      ${n}
    </div>
  `}function Mn(e,t,n){return`
    <div class="card-glass border rounded-2xl py-10 px-5 flex flex-col items-center gap-2 text-center">
      <span class="text-[var(--text-muted)] opacity-40 [&>span>svg]:w-9 [&>span>svg]:h-9">${i(e)}</span>
      <span class="font-['Orbitron'] font-bold text-sm text-[var(--text-main)]">${t}</span>
      <span class="text-[11px] text-[var(--text-muted)] max-w-[22rem] leading-relaxed">${n}</span>
    </div>
  `}var U=null,Nn=null,Pn=null,W=null,Fn=.5,In=.16,Ln=localStorage.getItem(`cyberforge_sfx`)!==`0`,G=localStorage.getItem(`cyberforge_music`)!==`0`,Rn=new Set;function zn(e){return Rn.add(e),()=>{Rn.delete(e)}}function Bn(){let e={sfx:Ln,music:G};Rn.forEach(t=>{try{t(e)}catch(e){console.warn(`[audio] suscriptor falló`,e)}})}function Vn(){return Ln}function Hn(){return G}function Un(){if(U)return U.state===`suspended`&&U.resume().catch(()=>{}),U;try{let e=window.AudioContext||window.webkitAudioContext;return e?(U=new e,U.setMaxLatency?.(.05),W=U.createDynamicsCompressor(),W.threshold.value=-14,W.knee.value=22,W.ratio.value=5,W.attack.value=.004,W.release.value=.2,W.connect(U.destination),Nn=U.createGain(),Nn.gain.value=Ln?Fn:0,Nn.connect(W),Pn=U.createGain(),Pn.gain.value=G?In:0,Pn.connect(W),U):null}catch{return null}}function Wn(e=.05){if(!U)return;let t=U.currentTime;Nn&&(Nn.gain.cancelScheduledValues(t),Nn.gain.setTargetAtTime(Ln?Fn:0,t,e)),Pn&&(Pn.gain.cancelScheduledValues(t),Pn.gain.setTargetAtTime(G?In:0,t,Math.max(e,.2)))}function Gn(e){return Ln=e,localStorage.setItem(`cyberforge_sfx`,e?`1`:`0`),Un(),Wn(),Bn(),Ln}function Kn(e){return G=e,localStorage.setItem(`cyberforge_music`,e?`1`:`0`),Un(),Wn(.25),G?nr():rr(),Bn(),G}function qn(){return Gn(!Ln)}function Jn(){return Kn(!G)}function K(e,t,n=`sine`,r=1,i=0){if(!Ln)return;let a=Un();if(!a||!Nn)return;let o=a.currentTime+i,s=a.createOscillator(),c=a.createGain();s.type=n,s.frequency.setValueAtTime(e,o),c.gain.setValueAtTime(1e-4,o),c.gain.exponentialRampToValueAtTime(Math.max(2e-4,r),o+.006),c.gain.exponentialRampToValueAtTime(1e-4,o+t),s.connect(c),c.connect(Nn),s.start(o),s.stop(o+t+.02),s.onended=()=>{s.disconnect(),c.disconnect()}}var q={click:(e=0)=>{let t=620*1.022**Math.min(e,22);K(t,.055,`square`,.42),K(t*2,.03,`sine`,.16)},buy:()=>{K(523.25,.09,`triangle`,.6),K(783.99,.12,`triangle`,.5,.075)},error:()=>{K(174.61,.14,`sawtooth`,.35),K(155.56,.16,`sawtooth`,.3,.05)},use:()=>{K(880,.08,`sine`,.55),K(1318.5,.1,`sine`,.4,.05)},equip:()=>{K(392,.07,`square`,.4),K(587.33,.1,`square`,.35,.05)},tick:(e=0)=>K(1500-e*500,.022,`square`,.22*(1-e*.6)),spinStart:()=>{K(196,.3,`sawtooth`,.3),K(293.66,.34,`triangle`,.22,.1)},reward:e=>{let t=e?523.25:392;K(t,.18,`triangle`,.65),K(t*1.26,.18,`triangle`,.55,.085),K(t*1.5,.3,`triangle`,.5,.17),e&&K(t*2,.42,`sine`,.35,.26)},jackpot:()=>{[523.25,659.25,783.99,1046.5,1318.5].forEach((e,t)=>K(e,.4,`triangle`,.62-t*.05,t*.075)),K(1567.98,.6,`sine`,.3,.38)},achievement:()=>{[659.25,830.61,987.77].forEach((e,t)=>K(e,.3,`sine`,.5,t*.07))},levelUp:()=>{[392,523.25,659.25,784].forEach((e,t)=>K(e,.28,`triangle`,.5,t*.06))},nodeBuy:()=>{K(1046.5,.06,`square`,.4),K(1396.91,.1,`square`,.32,.055)},prestige:()=>{K(880,.5,`sawtooth`,.4),K(440,.6,`sine`,.35,.12),[261.63,392,523.25].forEach((e,t)=>K(e,.5,`triangle`,.42,.24+t*.08)),K(1046.5,.7,`sine`,.25,.5)},hammer:()=>{K(110,.22,`square`,.55),K(82.41,.26,`sine`,.4,.02)},forgeSuccess:()=>{[329.63,415.3,493.88,659.25].forEach((e,t)=>K(e,.45,`triangle`,.55,t*.07)),K(1318.5,.55,`sine`,.3,.3)},forgeFail:()=>{K(146.83,.2,`sawtooth`,.4),K(110,.3,`sawtooth`,.35,.14)},forgeTick:(e=0)=>K(900-e*420,.03,`square`,.2*(1-e*.55)),nav:()=>K(660,.035,`sine`,.22),place:()=>K(320,.045,`square`,.16),pick:()=>K(480,.035,`sine`,.14)},Yn=null,Xn=0,Zn=[],J=null,Qn=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]];function $n(e){let t=Un();if(!t||!Pn)return;er(),J=t.createGain(),J.gain.value=0;let n=t.createBiquadFilter();n.type=`lowpass`,n.frequency.value=900,n.Q.value=.6;let r=t.createOscillator(),i=t.createGain();r.frequency.value=.14,i.gain.value=.05,r.connect(i),i.connect(J.gain),r.start(),Zn.push(r),J.connect(n),n.connect(Pn),e.forEach(e=>{for(let n of[-4,4]){let r=t.createOscillator();r.type=`sawtooth`,r.frequency.value=e,r.detune.value=n;let i=t.createGain();i.gain.value=.09,r.connect(i),i.connect(J),r.start(),Zn.push(r)}}),J.gain.setTargetAtTime(1,t.currentTime,2.2)}function er(){let e=U;if(!e){Zn=[];return}let t=Zn;Zn=[],J&&(J.gain.cancelScheduledValues(e.currentTime),J.gain.setTargetAtTime(0,e.currentTime,.6)),window.setTimeout(()=>{t.forEach(e=>{try{e.stop()}catch{}e.disconnect()})},2200),J=null}function tr(){if(G&&!document.hidden&&Un()){if(Xn%8==0){let e=Qn[Math.floor(Xn/8)%Qn.length];$n(e)}Xn++}}function nr(){Yn===null&&G&&(Un(),Yn=window.setInterval(tr,2600))}function rr(){Yn!==null&&(clearInterval(Yn),Yn=null),er()}function ir(e){e?rr():nr()}function ar(){let e=Un();e&&(e.resume().catch(()=>{}),nr())}var or=!1;function sr(){if(or)return;or=!0;let e=()=>{window.removeEventListener(`pointerdown`,e),window.removeEventListener(`keydown`,e),ar()};window.addEventListener(`pointerdown`,e,{passive:!0}),window.addEventListener(`keydown`,e)}var cr=[.425,.85,.775,1],lr=32;function ur(e,t,n){let r=1-e;return 3*r*r*e*t+3*r*e*e*n+e*e*e}function dr(e,t,n){let r=1-e;return 3*r*r*e*t+3*r*e*e*n+e*e*e}function fr(e){if(e<=0)return 0;if(e>=1)return 1;let[t,n,r,i]=cr,a=0,o=1;for(let n=0;n<lr;n++){let n=(a+o)/2;ur(n,t,r)<e?a=n:o=n}return dr((a+o)/2,n,i)}function pr(e){if(e<=0)return 0;if(e>=1)return 1;let t=0,n=1;for(let r=0;r<lr;r++){let r=(t+n)/2;fr(r)<e?t=r:n=r}return(t+n)/2}function mr(e){let{ventanaPx:t,pasoPx:n,casillaPx:r}=e,i=e.vueltas??3,a=Math.max(3,Math.floor(t/n)),o=i*a+a;return{visibles:a,winIndex:o,casillas:o+a+1,viaje:o*n+r/2-t/2}}function hr(e){let{viajePx:t,pasoPx:n,ventanaPx:r,duracionMs:i}=e;if(t<=0||n<=0||i<=0)return[];let a=Math.ceil(r/2/n),o=Math.floor((t+r/2)/n),s=[];for(let e=a;e<=o;e++){let a=e*n-r/2;a<=0||a>=t||s.push(Math.round(pr(a/t)*i))}return s}var gr=96,_r=78,vr=8,yr=420,br=260;function xr(){return window.innerWidth<640?_r:gr}var Sr={good:`text-cyan-300`,bad:`text-rose-400`},Cr={good:`border-cyan-400/40`,bad:`border-rose-500/40`};function wr(e,t){let n=e.tone?Sr[e.tone]:pt[e.rarity]||``;return`
    <div class="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl
                border ${e.tone?Cr[e.tone]:R(e.rarity)} card-glass"
         style="width:${t}px;height:${t+24}px">
      <span class="[&>span>svg]:w-6 [&>span>svg]:h-6 ${n} leading-none">${i(e.icon)}</span>
      <span class="text-[9px] font-mono text-center leading-tight px-1 line-clamp-2 w-full ${n}">${e.label}</span>
      ${e.amount?`<span class="text-[10px] font-mono font-bold leading-none ${n}">${e.amount}</span>`:``}
      <span class="text-[9px] font-mono uppercase tracking-wider ${n} opacity-70">${e.sub}</span>
    </div>
  `}function Tr(e,t){let n=e.parentElement,r=e.children[t];if(!n||!r)return 0;let i=n.getBoundingClientRect(),a=r.getBoundingClientRect(),o=i.left+n.clientLeft+n.clientWidth/2;return a.left+a.width/2-o}function Er(e,t,n){let r=xr(),i=r+vr,a=document.createElement(`div`);a.className=`relative w-full max-w-2xl select-none flex-shrink-0`,a.innerHTML=`
    <div class="relative overflow-hidden rounded-2xl border py-4"
         style="border-color: var(--border-color); background: color-mix(in srgb, var(--bg-app) 70%, transparent)">
      <!-- POR QUÉ data-role Y NO id. Las dos ruletas se montan en el body
           y comparten selectores: con un id, la segunda que se abriera
           encontraría el carril de la primera. El estado de un nodo va en
           data-* (R8). -->
      <!-- Y POR QUÉ EL CARRIL NO TIENE px-1. Geometría (rouletteSpin.ts)
           coloca la casilla k en k * paso desde el borde IZQUIERDO de la
           pista, sin contar un relleno. Un px-1 la desplazaba 4 px, y como el
           desplazamiento se calcula sin él, la casilla ganadora se paraba 4 px
           a la derecha de la aguja. Lo que se ve es el peor fallo posible en
           una ruleta: el marcador sobre una casilla y el cartel anunciando
           otra. La corrección por medición de enderezar() lo tapaba solo si
           el signo era el correcto, así que el error pasaba por dos sitios.
           Lo que no está en la aritmética no se pone en la aritmética. -->
      <div data-role="track" class="flex gap-2 will-change-transform"></div>
      <!-- Máscara de degradados en los extremos -->
      <div class="pointer-events-none absolute inset-y-0 left-0 w-16" style="background: linear-gradient(to right, var(--bg-app), transparent)"></div>
      <div class="pointer-events-none absolute inset-y-0 right-0 w-16" style="background: linear-gradient(to left, var(--bg-app), transparent)"></div>
      <!-- Marcador central -->
      <div class="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px]" style="background: var(--accent); box-shadow: 0 0 14px var(--accent)"></div>
      <div class="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--accent)"></div>
    </div>`,e.appendChild(a);let o=a.querySelector(`div`),s=mr({ventanaPx:o.clientWidth,pasoPx:i,casillaPx:r,vueltas:n}),c=a.querySelector(`[data-role="track"]`);c.innerHTML=t(s).map(e=>wr(e,r)).join(``);let l=Math.round(Tr(c,s.winIndex));return{track:c,giro:l>0?{...s,viaje:l}:s,anchoVentana:o.clientWidth}}function Dr(e,t,n){let{track:r,giro:i,anchoVentana:a}=e,o=window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches===!0,s=o?0:t;if(q.spinStart(),r.style.transition=o?`none`:`transform ${s}ms cubic-bezier(${cr.join(`, `)})`,r.style.transform=`translate3d(${-i.viaje}px,0,0)`,!o)for(let e of hr({viajePx:i.viaje,pasoPx:xr()+vr,ventanaPx:a,duracionMs:s}))setTimeout(()=>q.tick(e/s),e);let c={value:!1};function l(){let e=Tr(r,i.winIndex);Math.abs(e)<1||(r.style.transition=`transform 200ms cubic-bezier(0.33, 0, 0.2, 1)`,r.style.transform=`translate3d(${-i.viaje-e}px,0,0)`)}function u(){let e=r.children[i.winIndex];e&&(e.classList.add(`scale-110`,`z-10`),e.style.transition=`transform 220ms ease-out, box-shadow 220ms`,e.style.boxShadow=`0 0 28px var(--accent)`),n()}function d(){c.value||(c.value=!0,r.removeEventListener(`transitionend`,f),r.style.transition=`none`,r.offsetWidth,l(),o?u():setTimeout(u,yr))}function f(e){e.propertyName===`transform`&&d()}r.addEventListener(`transitionend`,f),setTimeout(d,o?br:s+350)}var Or=5200,kr={nanites:`Nanitas`,crystals:`Cristales`,keys:`Llaves`,crate:`Cajas`,consumable:`Unidades`};function Ar(e,t,n){let r=_t[t],a=R(e.rarity),o=L[e.rarity]||``,s=(gt[e.rarity]??0)>=4,c=!!e.item,l=Mt(e),u=kr[e.kind]??``,d=u!==``&&e.name.trim().toLowerCase()===u.toLowerCase(),f=document.createElement(`div`);f.className=`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto`,f.innerHTML=`
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${i(r.icon)}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">${r.name.toUpperCase()}</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">DESBLOQUEANDO CARGA…</p>
    </div>

    <!-- SIN BACKTICKS EN ESTE COMENTARIO. Va dentro de un template literal, así que
         un identificador marcado cerraría la cadena en ese punto y el resto
         del HTML se leería como código. Los identificadores van sin marcar y el
         porqué vive en el comentario de TypeScript de mountStrip. -->
    <div data-role="strip" class="contents"></div>
  `,document.body.appendChild(f);let p=document.createElement(`div`);p.dataset.role=`result`,p.className=`opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2`,p.innerHTML=`
    <div class="card-glass-elevated border ${a} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 ${o} max-w-sm text-center">
      <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${pt[e.rarity]||``}">${i(e.icon)}</div>
      ${l?`
      <div class="font-['Orbitron'] font-black text-3xl leading-none tabular-nums ${pt[e.rarity]||``}">
        ${Nt(e)}
      </div>
      <div class="text-[9px] font-mono uppercase tracking-[0.2em] -mt-1" style="color: var(--text-muted)">${u}</div>`:``}
      ${d?``:`<div class="font-['Orbitron'] font-bold text-base ${pt[e.rarity]||``}">${e.name}</div>`}
      <div class="text-[11px] font-mono uppercase tracking-wider ${pt[e.rarity]||``} opacity-80">${e.rarity}${e.exclusive?` · EXCLUSIVO`:``}</div>
      <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${e.details}</div>
      ${c?`<div class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">✓ Guardado en el almacén</div>`:``}
      ${e.cosmeticId?`<div class="text-[10px] font-mono mt-1 accent-text">✓ Desbloqueado · equípalo en el Perfil</div>`:``}
    </div>
    <button data-role="close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
      CONTINUAR
    </button>`,f.appendChild(p);let m=Er(f.querySelector(`[data-role="strip"]`),n=>{let{tiles:r}=It(t,n.casillas);return r[n.winIndex]=Lt(e),r}),h={value:!1};Dr(m,Or,()=>{h.value=!0,s?q.jackpot():q.reward((gt[e.rarity]??0)>=2),p.classList.remove(`opacity-0`),p.classList.add(`opacity-100`)});let g=()=>{document.removeEventListener(`keydown`,_),f.remove(),n()};p.querySelector(`[data-role="close"]`)?.addEventListener(`click`,g);let _=e=>{e.key===`Escape`&&h.value&&g()};document.addEventListener(`keydown`,_)}var jr=2,Mr=2400;function Nr(e,t,n){let r=e.rolled===!0,i=r&&e.success===!0&&n>t;return{rolled:r,success:i,levelBefore:t,levelAfter:i?n:t,msg:e.msg||``}}function Pr(e,t){let n=e.success,r=n?`text-cyan-300`:`text-rose-400`,a=document.createElement(`div`);a.className=`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 p-4 app-bg overflow-y-auto`,a.innerHTML=`
    <div class="text-center flex-shrink-0">
      <div class="mb-2 [&>span>svg]:w-9 [&>span>svg]:h-9" style="color: var(--accent)">${i(`crystal`)}</div>
      <h2 class="font-['Orbitron'] font-black text-lg tracking-wider" style="color: var(--accent)">SINTONIZANDO</h2>
      <p class="text-[10px] font-mono mt-1" style="color: var(--text-muted)">${n?`RESONANCIA ESTABLE`:`SIN RESONANCIA`}</p>
    </div>
  `,document.body.appendChild(a);let o=Er(a,t=>{let r=Array.from({length:t.casillas},(t,n)=>n%2==0?{label:`MEJORA`,sub:`NIVEL ${e.levelBefore+1}`,rarity:`Legendario`,icon:`sparkle`,tone:`good`}:{label:`FALLO`,sub:`NIVEL ${e.levelBefore}`,rarity:`Común`,icon:`close`,tone:`bad`});return r[t.winIndex]=n?{label:`MEJORA`,sub:`NIVEL ${e.levelAfter}`,rarity:`Legendario`,icon:`sparkle`,tone:`good`}:{label:`FALLO`,sub:`NIVEL ${e.levelAfter}`,rarity:`Común`,icon:`close`,tone:`bad`},r},jr),s=document.createElement(`div`);s.dataset.role=`result`,s.className=`opacity-0 transition-opacity duration-300 flex flex-col items-center gap-3 flex-shrink-0 pb-2`,s.innerHTML=`
    <div class="card-glass-elevated border ${n?`border-cyan-400/40`:`border-rose-500/40`} rounded-2xl px-6 py-5 flex flex-col items-center gap-2 max-w-sm text-center">
      <div class="mb-1 [&>span>svg]:w-12 [&>span>svg]:h-12 ${r}">${i(n?`sparkle`:`close`)}</div>
      <div class="font-['Orbitron'] font-black text-2xl leading-none ${r}">${n?`¡MEJORA!`:`FALLO`}</div>
      <div class="text-[11px] font-mono tabular ${r}">
        Nivel ${e.levelBefore}${n?` → ${e.levelAfter}`:` · sin cambio`}
      </div>
      <div class="text-xs font-mono mt-1" style="color: var(--text-main)">${e.msg}</div>
    </div>
    <button data-role="close" class="px-6 py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
      CONTINUAR
    </button>`,a.appendChild(s);let c={value:!1};Dr(o,Mr,()=>{c.value=!0,n?q.levelUp():q.error(),s.classList.remove(`opacity-0`),s.classList.add(`opacity-100`)});let l=()=>{document.removeEventListener(`keydown`,u),a.remove(),t()};s.querySelector(`[data-role="close"]`)?.addEventListener(`click`,l);let u=e=>{e.key===`Escape`&&c.value&&l()};document.addEventListener(`keydown`,u)}function Fr(e,t){let n=e.getState(),r=n.warehouse.find(e=>e.id===n.equippedCollectorId);if(!r){S(`Equipa un recolector primero.`,`info`);return}let a=he(r.maxLevel);if((r.level||0)>=a){S(`El recolector ya está al nivel máximo.`,`info`);return}let o=(n.warehouse||[]).filter(e=>e.type===`crystal`).sort((e,t)=>(t.tier||1)-(e.tier||1));if(o.length===0){S(`No tienes cristales de mejora.`,`error`);return}let s=document.createElement(`div`);s.className=`sheet-overlay z-[70]`,s.innerHTML=`
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`crystal`)}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${r.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${r.level||0} · coste ${Ir(r.level||0)} x cristal
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`close`)}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${o.map((e,t)=>{let n=F[typeof e.tier==`number`?e.tier:1],a=e.stackCount||1,o=Ir(r.level||0),s=a>=o,c=hn(r.level||0,n?.power??1);return`
            <button data-crystal="${e.id}" data-idx="${t}" ${s?``:`disabled style="opacity:.45"`}
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                           ${s?`cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]`:``}
                           border-[var(--border-color)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${R(e.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`crystal`)}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${e.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] mt-0.5">
                  ${n?.power??1}x · ${c}% de éxito
                </span>
              </span>
              <span class="text-right flex-shrink-0">
                <span class="block text-[11px] font-mono accent-text tabular">×${a}</span>
                <span class="block text-[9px] font-mono ${s?`text-[var(--text-muted)]`:`text-rose-400`}">
                  ${s?`-${o}`:`faltan`}
                </span>
              </span>
            </button>`}).join(``)}
      </div>
    </div>
  `;let c=()=>s.remove();s.querySelectorAll(`[data-cerrar]`).forEach(e=>e.addEventListener(`click`,c)),s.querySelectorAll(`[data-crystal]:not([disabled])`).forEach(n=>{n.addEventListener(`click`,()=>{let i=Number(n.dataset.idx);c(),q.use();let a=r.level||0,s=Nr(e.upgradeEquippedCollector(o[i].tier||1),a,r.level||0);if(!s.rolled){q.error(),S(s.msg||`No se pudo sintonizar.`,`error`),t();return}Pr(s,t)})}),document.body.appendChild(s)}function Ir(e){return gn(e)}var Lr={collector:`collector`,companion:`companion`,crate:`crate`,key:`key`,crystal:`crystal`,consumable:`flask`},Rr={collector:`Recolector`,companion:`Compañero`,crate:`Caja`,key:`Llave`,crystal:`Cristal de Mejora`,consumable:`Consumible`},zr={crate:`caja`,key:`llave`,crystal:`cristal`,consumable:`consumible`},Y={selectedId:null,filter:`all`,sort:`default`,sheetOpen:!1};function Br(e,t,n,r,i){Vr(e,t,n,r,i)}function Vr(e,t,n,r,a){let o=t.getState(),s=o.warehouse||[],c=t.getCapacity?.()??o.warehouseCapacity??15,l=H(s),u=Jr(t,o);Y.selectedId&&!s.some(e=>e.id===Y.selectedId)&&(Y.selectedId=null,Y.sheetOpen=!1);let d=Y.selectedId?s.find(e=>e.id===Y.selectedId):null,f=(e,t)=>{let n=e.item,r=n.id===Y.selectedId,a=Gr(n,o),s=e.count;return`
      <button class="inv-cell ${r?`is-selected`:``} ${s>0?`is-stackable`:``}"
              data-cell="${t}" data-id="${n.id}" data-count="${s}"
              style="${a?`border-color:#fbbf24; box-shadow: inset 0 0 0 1px #fbbf24;`:``}"
              aria-label="${n.name}">
        <span class="ring-${ht(n.rarity)} w-8 h-8 rounded-lg grid place-items-center
                     ${R(n.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">
          ${i(Lr[n.type]??`crate`)}
        </span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full px-0.5">
          ${n.name}
        </span>
        <span class="text-[9px] font-mono ${a?`text-amber-400`:`text-[var(--text-muted)]`}">
          ${n.tier?`T${n.tier}`:n.rarity??``}
          ${n.potential?` ${`★`.repeat(n.potential)}`:``}
        </span>
        ${a?`<span class="absolute bottom-0.5 left-1 text-[9px] font-mono text-amber-400">EQ</span>`:``}
      </button>
    `},p=(e,t)=>`
    <div class="inv-cell opacity-25" data-cell="${e}" data-painted="${t}" data-empty="1" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`plus`)}</span>
    </div>
  `,m=e=>`
    <div class="inv-cell opacity-25" data-gap="${e}" aria-hidden="true">
      <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`plus`)}</span>
    </div>
  `,g=Zr(t,o),_=Xr(u.length,c),v=[],y=0;for(let e=0;e<u.length;e++){let t=g.get(u[e].item.id)??0;for(let n=0;n<t;n++)v.push(m(u[e].item.id)),y++;v.push(f(u[e],e)),y++}for(let e=0;y<_;e++,y++)v.push(p(u.length+e,y));let b=`
    <!--
      Dos columnas a partir de lg. Antes el panel de detalle era un overlay
      fixed que en escritorio se convertia en un hijo mas del contenedor en
      columna: caia DEBAJO de la rejilla, pegado a la esquina inferior
      derecha y flotando sobre el vacio. Ahora es una columna de verdad.
    -->
    <div class="flex flex-col lg:flex-row lg:gap-4 lg:items-start">

      <div class="min-w-0 flex-1">
        ${jn(`Almacén`,`warehouse`,`
          <div class="flex items-center gap-2.5">
            <!--
              El contador de nanitas vive aquí y no en la cabecera de la página.
              En el almacén la decisión es siempre local —vender, ampliar, usar
              una llave— y el número que la acompaña queda en la misma línea que
              las ranuras, no en una esquina a la que hay que llegar con la
              vista. Arriba quedaba demasiado lejos de donde se decide.
            -->
            <span id="wh-nanites"
                  class="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border tabular flex-shrink-0
                         border-[var(--border-color)]"
                  style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
              <span class="accent-text not-italic text-[11px]" aria-hidden="true">◆</span>
              <span class="font-mono text-[11px] text-[var(--text-main)]" id="wh-nanites-val">${h(o.nanites||0)}</span>
            </span>
            <span class="text-[10px] font-mono tabular ${l>=c?`text-rose-400`:`text-[var(--text-muted)]`}">
              ${l}/${c} ranuras
            </span>
          </div>
        `)}

        <div class="flex flex-wrap items-center gap-1.5 mb-3">
          ${[{id:`all`,label:`Todo`},{id:`collector`,label:`Recolectores`},{id:`companion`,label:`Compañeros`},{id:`otros`,label:`Otros`}].map(e=>`
            <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition
                           ${Y.filter===e.id?`accent-bg text-slate-950 font-bold`:`btn-ghost text-[var(--text-muted)]`}"
                    data-filter="${e.id}">${e.label}</button>
          `).join(``)}
          <select id="wh-sort" aria-label="Ordenar"
            class="ml-auto h-10 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
            <option value="default" ${Y.sort==="default"?`selected`:``}>Mi orden</option>
            <option value="value" ${Y.sort===`value`?`selected`:``}>Mayor valor</option>
            <option value="rarity" ${Y.sort===`rarity`?`selected`:``}>Rareza</option>
            <option value="tier" ${Y.sort===`tier`?`selected`:``}>Tier</option>
            <option value="name" ${Y.sort===`name`?`selected`:``}>Nombre</option>
          </select>
        </div>

        <div class="inv-grid mb-2" id="inv-grid">${v.join(``)}</div>

        <p class="text-[9px] text-[var(--text-muted)] text-center leading-relaxed mt-3">
          Arrastra una celda sobre otra para reordenar. Toca para ver detalles.
        </p>
      </div>

      <aside class="hidden lg:block w-80 xl:w-96 flex-shrink-0 lg:sticky lg:top-2">
        ${d?Ur(d,o,t):`<div class="card-glass border rounded-2xl p-6 flex flex-col items-center gap-2 text-center">
               <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-9 [&>span>svg]:h-9">${i(`eye`)}</span>
               <span class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                 Selecciona un item de la rejilla para ver su descripcion
               </span>
             </div>`}
      </aside>
    </div>

    ${d?Hr(d,o,t):``}
  `,x=Dn(e,kn({title:`Almacén`,subtitle:`Arrastra para reordenar · toca para inspeccionar`,icon:`warehouse`,onBack:n,state:o,hideNanites:!0},b));On(x,{back:n,go:a}),Kr(x,t,n,r,a)}function Hr(e,t,n){return`
    <div class="fixed inset-0 z-[60] lg:hidden flex items-end justify-center pointer-events-none">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-act="close"></div>
      <div class="relative card-glass-elevated w-full rounded-t-2xl pointer-events-auto
                  p-4 max-h-[78dvh] overflow-y-auto overscroll-contain animate-rise-in"
           style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))">
        ${Wr(e,t,n)}
      </div>
    </div>
  `}function Ur(e,t,n){return`
    <div class="card-glass border rounded-2xl p-4 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain">
      ${Wr(e,t,n)}
    </div>
  `}function Wr(e,t,n){let r=e.type===`collector`,a=e.type===`companion`,o=Gr(e,t),s=n.getSellTotal?.(e.id)??Math.floor((n.getSellPrice?.(e.id)??e.sellPrice??0)*V(e)),c=rn[e.type]??1,l=he(e.maxLevel),u=(e.affixes||[]).map(e=>{let t=pe[e];return t?`<li class="text-[10px] flex items-start gap-1.5">
      <span class="${R(t.rarity)} flex-shrink-0 mt-[3px]">◆</span>
      <span><span class="${R(t.rarity)}">${t.name}</span>
      <span class="text-[var(--text-muted)]"> — ${t.description}</span></span>
    </li>`:``}).join(``),d=r?T(e):[];return`
        <div class="flex items-start gap-2.5 mb-3">
          <span class="ring-${ht(e.rarity)} w-11 h-11 rounded-xl grid place-items-center
                       flex-shrink-0 ${R(e.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">
            ${i(Lr[e.type]??`crate`)}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate leading-tight">
              ${e.name}
            </h3>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              <span class="text-[10px] font-mono ${R(e.rarity)}">${e.rarity}</span>
              ${e.tier?`<span class="text-[10px] font-mono text-[var(--text-muted)]">T${e.tier}</span>`:``}
              <span class="text-[10px] font-mono text-[var(--text-muted)]">${Rr[e.type]??`Objeto`}</span>
              ${e.potential?`<span class="text-[10px] text-amber-400">${`★`.repeat(e.potential)}</span>`:``}
            </div>
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-act="close" title="Cerrar detalle" aria-label="Cerrar detalle">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`close`)}</span>
          </button>
        </div>

        <!-- Autoría: lo que hace único al objeto -->
        ${e.forgedBy?`
          <div class="rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center gap-1.5"
               style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-3 h-3">${i(`anvil`)}</span>
            <span class="text-[10px] font-mono text-[var(--text-main)] truncate">
              Forjada por <span class="accent-text">${e.forgedBy}</span>
            </span>
          </div>
        `:``}

        <p class="text-[11px] text-[var(--text-main)] leading-relaxed mb-2.5">
          ${e.details||`Sin descripción`}
        </p>

        ${e.stackable?`
          <div class="mb-2.5">
            <div class="label-caps mb-1">Cantidad</div>
            <div class="flex items-baseline gap-1.5">
              <span class="font-['Orbitron'] font-bold text-base accent-text tabular">${e.stackCount||1}</span>
              <span class="text-[10px] font-mono text-[var(--text-muted)]">/ ${c}</span>
            </div>
          </div>
        `:``}

        ${r&&(e.level??0)>0?`
          <div class="mb-2.5">
            <div class="label-caps mb-1">Nivel ${e.level} / ${l}</div>
            <div class="meter is-tall"><span style="width:${e.level/l*100}%"></span></div>
          </div>
        `:``}

        ${u?`
          <div class="mb-2.5">
            <div class="label-caps mb-1">Afijos heredados</div>
            <ul class="space-y-1">${u}</ul>
          </div>
        `:``}

        ${d.length?`
          <!--
            POR QUÉ VA ABIERTO. Estaba en un <details> cerrado, y el jugador
            tenía que abrir la flechita para ver cuánto valía su item. Es
            información que se pide antes de vender: nadie mira la valoración
            después de haber vendido. Y esconderla detrás de un clic hace que la
            mayoría de las fichas enseñen un precio sin explicar de dónde sale.

            El <details> NO se quita, y esa es la parte importante: cerrar el
            desglose sigue siendo posible cuando la ficha es larga y occupies el
            alto. Abrir por defecto y poder cerrar no es lo mismo que no dejar
            cerrar.

            Y no es un <summary> que haya que enganchar: el elemento nativo ya se
            abre y se cierra solo, sin un solo listener. Un acordeón propio sería
            un estado más que mantener y una tecla más que pulsar.
          -->
          <details class="mb-2.5" open>
            <summary class="label-caps cursor-pointer select-none">Valoración</summary>
            <ul class="mt-1.5 space-y-0.5">
              ${d.map(e=>`<li class="text-[10px] font-mono text-[var(--text-muted)]">${e}</li>`).join(``)}
            </ul>
          </details>
        `:``}

        <div class="flex flex-col gap-1.5 mt-3">
          ${r||a?`
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="equip">
              ${o?`Desequipar`:`Equipar`}
            </button>
          `:``}

          ${e.type===`crate`?`
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="open">
              ${si(t,e).length>0?`Abrir caja`:`Falta la llave`}
            </button>
          `:``}

          ${e.type===`crystal`?`
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="nada" title="Los cristales se gastan desde la Sintonización del recolector">
              Se usa en Sintonización
            </button>
          `:``}

          ${e.type===`consumable`?`
            <button class="w-full h-11 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="use">Usar</button>
          `:``}

          ${r?`
            <button class="w-full h-11 rounded-xl btn-ghost font-['Orbitron'] font-bold text-[11px] cursor-pointer"
                    data-act="upgrade" ${o?``:`disabled style="opacity:.4"`}
                    title="${o?``:`Equípala primero`}">
              Mejorar con cristales
            </button>
          `:``}

          <button class="w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px] cursor-pointer
                         border border-amber-500/30 text-amber-400"
                  style="background: color-mix(in srgb, #f59e0b 12%, transparent)"
                  data-act="sell" ${o?`disabled style="opacity:.4"`:``}>
            ${V(e)>1?`Vender ×${V(e)} · ${h(s)} ◆`:`Vender · ${h(s)} ◆`}
          </button>
        </div>

        ${o?`<p class="text-[9px] text-amber-400 text-center mt-2">Desequípalo para venderlo o mejorarlo.</p>`:``}
  `}function Gr(e,t){return e.type===`collector`?t.equippedCollectorId===e.id:e.type===`companion`&&t.activeCompanions.includes(e.id)}function Kr(e,t,n,r,i){let a=e.parentElement,o=()=>Vr(a,t,n,r,i);e.querySelectorAll(`[data-filter]`).forEach(e=>{e.addEventListener(`click`,()=>{q.nav(),Y.filter=e.dataset.filter,o()})}),e.querySelector(`#wh-sort`)?.addEventListener(`change`,e=>{Y.sort=e.target.value,o()});let s=e.querySelector(`#inv-grid`);s&&qr(s,t,o),e.addEventListener(`click`,e=>{let n=e.target.closest(`[data-act]`);if(!n)return;let i=n.dataset.act,a=Y.selectedId?t.getState().warehouse.find(e=>e.id===Y.selectedId):null;switch(i){case`close`:q.pick(),Y.selectedId=null,o();break;case`equip`:if(!a)return;q.equip(),a.type===`collector`?t.equipCollector(a.id):a.type===`companion`&&(t.equipCompanion(a.id)||S(`No hay slots de compañero libres.`,`error`)),o(),r?.();break;case`open`:if(!a)return;ri(t,a,o);break;case`use`:if(!a)return;li(t,a,o);break;case`upgrade`:if(!a)return;if(a.id!==t.getState().equippedCollectorId){S(`Equipa el recolector primero.`,`info`);return}Fr(t,o);break;case`nada`:return;case`sell`:if(!a)return;ui(t,a,o)}})}function qr(e,t,n){let r=null,i=-1,a=null,o=null,s=0,c=0,l=()=>{a?.remove(),a=null};e.addEventListener(`pointerdown`,e=>{let t=e.target.closest(`[data-cell]`);if(!t||e.target.closest(`select, button[data-act]`)||o!==null)return;let n=t.dataset.id;n&&(o=e.pointerId,r=n,i=Number(t.dataset.cell),s=e.clientX,c=e.clientY,t.dataset.pendingDrag=`1`)}),e.addEventListener(`pointermove`,t=>{if(o!==t.pointerId||!r)return;let n=t.clientX-s,l=t.clientY-c;if(!a&&Math.hypot(n,l)<8)return;let u=e.querySelector(`[data-cell="${i}"]`);if(!u)return;a||(q.pick(),u.classList.add(`is-dragging`),delete u.dataset.pendingDrag,a=document.createElement(`div`),a.className=`drag-ghost`,a.style.background=`color-mix(in srgb, var(--bg-app) 88%, transparent)`,a.style.border=`1px solid var(--accent)`,a.innerHTML=u.innerHTML,document.body.appendChild(a),u.setPointerCapture?.(t.pointerId)),t.preventDefault(),a.style.left=`${t.clientX}px`,a.style.top=`${t.clientY}px`;let d=document.elementFromPoint(t.clientX,t.clientY)?.closest(`[data-cell],[data-gap]`)??null;e.querySelectorAll(`.is-over`).forEach(e=>e.classList.remove(`is-over`)),d&&d.dataset.cell!==String(i)&&d.classList.add(`is-over`)}),e.addEventListener(`pointerup`,s=>{if(o!==s.pointerId)return;o=null;let c=!!a;if(l(),e.querySelectorAll(`.is-over, .is-dragging`).forEach(e=>e.classList.remove(`is-over`,`is-dragging`)),!r)return;let u=r;r=null;let d=i;if(i=-1,!c){q.pick(),Y.selectedId=Y.selectedId===u?null:u,n();return}let f=document.elementFromPoint(s.clientX,s.clientY),p=f?.closest(`[data-gap]`)??null,m=f?.closest(`[data-cell]`)??null;if(p?.dataset.gap)Qr(t,u,p.dataset.gap,Y.filter,Y.sort)?(q.place(),Y.sort=`default`):S(`Ese hueco ya está donde toca.`,`info`);else if(m?.dataset.empty)$r(t,u,m.dataset.painted===void 0?Number(m.dataset.cell):Number(m.dataset.painted),Y.filter,Y.sort)?(q.place(),Y.sort=`default`):S(`Ya está en la última posición: no hay más sitio libre detrás.`,`info`);else{let e=m?Number(m.dataset.cell):-1;if(e>=0&&e!==d){let n=(t.getState().warehouse||[]).map(e=>e.id).join(`,`);ei(t,u,e)&&((t.getState().warehouse||[]).map(e=>e.id).join(`,`)===n?S(`Ya estaba en ese sitio.`,`info`):(q.place(),Y.sort=`default`))}}n()}),e.addEventListener(`pointercancel`,t=>{l(),e.querySelectorAll(`.is-over, .is-dragging`).forEach(e=>e.classList.remove(`is-over`,`is-dragging`)),o===t.pointerId&&(o=null),r=null,i=-1}),e.addEventListener(`click`,e=>e.stopPropagation())}function Jr(e,t){return Yr(e,t,Y.filter,Y.sort)}function Yr(e,t,n,r){let i=(t.warehouse||[]).filter(e=>ni(e,n));if(r===`name`)i=[...i].sort((e,t)=>String(e.name).localeCompare(String(t.name)));else if(r===`rarity`)i=[...i].sort((e,t)=>(gt[t.rarity]??0)-(gt[e.rarity]??0));else if(r===`tier`)i=[...i].sort((e,t)=>(t.tier||0)-(e.tier||0));else if(r===`value`){let t=t=>e.getSellPrice?.(t.id)??t.sellPrice??0;i=[...i].sort((e,n)=>t(n)-t(e))}let a=[],o=new Map;for(let e of i){if(an(e)){let t=`${e.type}_${e.name}`,n=rn[e.type]??20,r=o.get(t);if(r!==void 0){a[r].ids.push(e.id),a[r].count=Math.min(a[r].count+(e.stackCount||1),n);continue}o.set(t,a.length),a.push({item:e,ids:[e.id],count:Math.min(e.stackCount||1,n)});continue}a.push({item:e,ids:[e.id],count:0})}return a}function Xr(e,t){return Math.max(e,Math.min(t,Math.max(12,Math.ceil(t/3)*3)))}function Zr(e,t){let n=new Map;if(Y.filter!==`all`||Y.sort!=="default")return n;let r=e.getWarehouseGaps?.()??t.warehouseGaps??[],i=new Set((t.warehouse||[]).map(e=>e.id));for(let e of r)i.has(e)&&n.set(e,(n.get(e)??0)+1);return n}function Qr(e,t,n,r,i){let a=e.getState(),o=Yr(e,a,r,i),s=o.findIndex(e=>e.ids.includes(t));if(s<0)return!1;let c=o[s];if(c.ids.includes(n)||o.findIndex(e=>e.ids.includes(n))===s+1||!e.moveItems(c.ids,n,`antes`))return!1;let l=o[s+1],u=(e.getWarehouseGaps?.()??a.warehouseGaps??[]).filter(e=>e!==n);return l&&u.push(l.item.id),e.setWarehouseGaps?.(u),!0}function $r(e,t,n,r,i){let a=e.getState(),o=Yr(e,a,r,i),s=o.findIndex(e=>e.ids.includes(t));if(s<0)return!1;let c=e.getCapacity?.()??a.warehouseCapacity??15,l=o.length;if(!l)return!1;let u=new Map;for(let t of e.getWarehouseGaps?.()??a.warehouseGaps??[])u.set(t,(u.get(t)??0)+1);let d=[...u.values()].reduce((e,t)=>e+t,0),f=o[s],p=s!==l-1;if(p&&!e.moveItems(f.ids,null,`despues`))return!1;let m=o.filter((e,t)=>t!==s).reduce((e,t)=>e+(u.get(t.item.id)??0),0),h=Math.max(0,n-(l-1)-m),g=Math.max(0,Xr(l,c)-l-d),_=Math.min(h,g);if(!p&&_===0)return!1;let v=[];for(let e of o){if(e.ids.includes(t)){v.push(...Array(_).fill(e.item.id));continue}v.push(...Array(u.get(e.item.id)??0).fill(e.item.id))}return e.setWarehouseGaps?.(v),!0}function ei(e,t,n){return ti(e,t,n,Y.filter,Y.sort)}function ti(e,t,n,r,i){if(n<0)return!1;let a=Yr(e,e.getState(),r,i),o=a.findIndex(e=>e.ids.includes(t));if(o<0)return!1;let s=a[o];if(n===o)return!1;let c=n>=a.length?null:a[n];if(c&&s.ids.includes(c.ids[0]))return!1;let l=n>o,u=c?l?c.ids[c.ids.length-1]:c.ids[0]:null;return e.moveItems(s.ids,u,l?`despues`:`antes`)}function ni(e,t){return t===`all`?!0:t===`otros`?![`collector`,`companion`].includes(e.type):e.type===t}function ri(e,t,n){let r=ci(t.name),i=si(e.getState(),t);if(i.length===0){let e=N[ot[r]];S(`Necesitas ${e?.name??`una llave`} para abrir ${t.name}.`,`info`);return}let a=e=>e.stackCount||1,o=i.reduce((e,t)=>e+a(t),0);if(i.length===1){ii(e,t,r,i[0],n);return}oi(i,o,i=>{ii(e,t,r,i,n)})}function ii(e,t,n,r,i){x(ai(r.name),()=>{let a=e.openCrateBox(t.id,r.id);if(!a.ok){q.error(),S(a.msg||`No se pudo abrir la caja.`,`error`);return}Y.selectedId=null,Ar(a.reward,a.crateType??n,i)},{sublabel:t.name,confirmText:`Abrir`})}function ai(e){let t=document.createElement(`span`),n=document.createElement(`span`);return n.className=`font-bold accent-text`,n.textContent=e,t.append(`Se gastará `,n,` y la caja. La ruleta gira y te dice qué ha salido. Tabla distinta por caja.`),t}function oi(e,t,n){let r=document.createElement(`div`);r.className=`sheet-overlay z-[70]`,r.innerHTML=`
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ring-raro rarity-raro
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`key`)}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
            ¿Con qué llave?
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            ${e.length} tipos disponibles · ${t} llaves en total
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`close`)}</span>
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        ${e.map((e,t)=>{let n=N[typeof e.tier==`number`?e.tier:I(e.name||``)];return`
            <button data-key="${e.id}" data-idx="${t}"
                    class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer
                           transition active:scale-[0.99] border-[var(--border-color)] hover:border-[var(--accent)]"
                    style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
              <span class="flex-shrink-0 ${R(e.rarity)} [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`key`)}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${e.name}</span>
                <span class="block text-[9px] font-mono text-[var(--text-muted)] truncate mt-0.5">${e.details||n?.details||``}</span>
              </span>
              <span class="text-[11px] font-mono accent-text tabular flex-shrink-0">×${e.stackCount||1}</span>
            </button>`}).join(``)}
      </div>
    </div>
  `;let a=()=>{r.remove()};r.querySelectorAll(`[data-cerrar]`).forEach(e=>e.addEventListener(`click`,a)),r.querySelectorAll(`[data-key]`).forEach(t=>{t.addEventListener(`click`,()=>{q.pick();let r=Number(t.dataset.idx);a(),n(e[r])})}),document.body.appendChild(r)}function si(e,t){let n=ci(t.name);return(e.warehouse||[]).filter(e=>e.type===`key`&&ft(e.name||``,n)).sort((e,t)=>(typeof e.tier==`number`?e.tier:I(e.name||``))-(typeof t.tier==`number`?t.tier:I(t.name||``)))}function ci(e){let t=e.toLowerCase();return t.includes(`común`)?`common`:t.includes(`rara`)?`rare`:t.includes(`épica`)?`epic`:`legendary`}function li(e,t,n){x(t.details||`Aplicar el efecto de este consumible.`,()=>{let r=e.useConsumable(t.id);if(!r.ok){q.error(),S(r.msg||`No se pudo usar.`,`error`);return}q.use(),Y.selectedId=null,S(r.msg||`${t.name}: aplicado`,`success`),n()},{sublabel:t.name,confirmText:`Usar`})}function ui(e,t,n){let r=V(t),i=e.getSellTotal?.(t.id)??Math.floor((e.getSellPrice?.(t.id)??t.sellPrice??0)*r);if(r<=1){x(`Vendes ${t.name}${r>1?` ×${r}`:``} por ${h(i)} nanitas.`,()=>di(e,t,void 0,n),{sublabel:`Vender`,confirmText:`+${h(i)} ◆`});return}x(`Tienes ${r} × ${t.name}. Elige cuántas vender.`,r=>di(e,t,r,n),{sublabel:`Vender`,confirmText:`Vender`,quantity:{max:r,itemName:t.name,unitName:zr[t.type]??`unidad`,amount:n=>h(e.getSellTotal?.(t.id,n)??0)}})}function di(e,t,n,r){let i=e.sellItem(t.id,n);if(!i.ok){q.error(),S(i.msg||`No se pudo vender.`,`error`);return}q.buy();let a=i.sold??1;S(`Vendido${a>1?` ×${a}`:``} por ${h(i.gained??0)} ◆`,`success`),e.getState().warehouse.some(e=>e.id===t.id)||(Y.selectedId=null),r()}var fi=5e4,pi=25e4,mi=2e4,hi=[{id:`definitivo`,label:`Definitivo`,hint:`La combinación de las tres: potencia, tiempo y exploración. Un logro pesa 50.000 nanitas y una firma de autor 20.000.`,icon:`trophy`},{id:`nanitas`,label:`Nanitas`,hint:`Quién ha juntado más nanitas en total. No cuenta solo lo que tiene ahora, sino todo lo que ha producido desde que empezó.`,icon:`bolt`},{id:`clics`,label:`Clics`,hint:`Quién más tiempo ha dedicado a la partida. Un clic es una decisión activa: subir en esta tabla cuesta más que en la de nanitas.`,icon:`collector`},{id:`logros`,label:`Logros`,hint:`Quién ha explorado más del juego. Cuenta los secretos, que pesan más que los normales.`,icon:`achievement`}];function gi(e,t){switch(t){case`nanitas`:return Math.floor(e.nanites??e.score??0);case`clics`:return Math.floor(e.totalClicks??0);case`logros`:return Math.floor((e.achievements??0)+(e.secretAchievements??0)*2);case`definitivo`:return _i(e)}}function _i(e){return Math.floor((e.score||0)+(e.achievements||0)*fi+(e.secretAchievements||0)*pi+(e.forgedCount||0)*mi)}async function vi(e=40){let t=[{uid:`mock_1`,username:`QuantumApex`,score:1450200,nanites:1450200,totalClicks:8420,achievements:12,secretAchievements:1,forgedCount:8,updatedAt:Date.now()},{uid:`mock_2`,username:`NexusGrid`,score:12100,nanites:12100,totalClicks:312,achievements:4,secretAchievements:0,forgedCount:0,updatedAt:Date.now()},{uid:`mock_3`,username:`AgujaCero`,score:41500,nanites:41500,totalClicks:2105,achievements:3,secretAchievements:0,forgedCount:1,updatedAt:Date.now()},{uid:`mock_4`,username:`ByteSmith`,score:9800,nanites:9800,totalClicks:640,achievements:7,secretAchievements:1,forgedCount:3,updatedAt:Date.now()}];try{let n=async()=>{let n=ne(te(_,`rankings`),c(`score`,`desc`),f(e)),r=await p(n),i=[];return r.forEach(e=>i.push({...e.data(),uid:e.id})),i.length===0?t:i},r=new Promise((e,t)=>setTimeout(()=>t(Error(`Firestore timeout`)),3500));return await Promise.race([n(),r])}catch(e){return console.warn(`Rankings con datos de respaldo (Firestore no disponible):`,e),t}}function yi(e,t){return[...e].sort((e,n)=>gi(n,t)-gi(e,t))}var bi=`definitivo`;function xi(e,t,n,r){let i=t?.uid??t?.userId,a=Dn(e,kn({title:`Ranking global`,subtitle:`La tabla general y los tres criterios por separado`,icon:`trophy`,onBack:n},`
    <div class="flex flex-col gap-2" id="rank-body">
      ${Di()}
    </div>
  `));On(a,{back:n,go:r});let o=a.querySelector(`#rank-body`),s=()=>o.isConnected;vi().then(e=>{if(!s())return;if(e.length===0){o.innerHTML=Mn(`trophy`,`Ranking vacío`,`Todavía no hay nadie registrado. Sé la primera persona en aparecer.`);return}let t=()=>{if(!s())return;let n=hi.find(e=>e.id===bi),r=yi(e,bi);o.innerHTML=`
        ${Si()}
        <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed px-1 mb-1">
          ${n.hint}
        </p>
        ${r.map((e,t)=>wi(e,t,i,bi)).join(``)}
        ${Ei(bi)}
      `,Ci(o,t)};t()}).catch(()=>{s()&&(o.innerHTML=Mn(`warning`,`No se pudo cargar`,`Firestore no responde. Revisa tu conexión y vuelve a entrar.`))})}function Si(){return`
    <div class="flex gap-1 mb-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Tablas del ranking">
      ${hi.map(e=>`
        <button data-rank-tab="${e.id}" role="tab" aria-selected="${e.id===bi}"
          class="h-9 px-3 rounded-lg text-[11px] font-mono flex-shrink-0 cursor-pointer
                 transition-colors ${e.id===bi?`accent-bg text-slate-950 font-bold`:`btn-ghost text-[var(--text-muted)]`}"
        >
          <span class="inline-flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(e.icon)}</span>
            ${e.label}
          </span>
        </button>
      `).join(``)}
    </div>
  `}function Ci(e,t){e.querySelectorAll(`[data-rank-tab]`).forEach(e=>{e.addEventListener(`click`,()=>{e.getAttribute(`data-rank-tab`)!==bi&&(bi=e.getAttribute(`data-rank-tab`),t())})})}function wi(e,t,n,r=`definitivo`){let a=e.uid===n,o=e.title?Ze[e.title]:null,s=gi(e,r),c=Ti(r);return`
    <div class="rank-row ${a?`is-me`:``}">
      <div class="rank-pos" data-tier="${t+1<=3?t+1:``}">${t+1}</div>

      <div class="min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[12px] font-bold text-[var(--text-main)] truncate">${e.username}</span>
          ${a?`<span class="medal accent-text flex-shrink-0">TÚ</span>`:``}
        </div>
        <div class="flex items-center gap-1.5 flex-wrap mt-1">
          ${o?`<span class="text-[9px] title-display ${R(o.rarity)}">${o.name}</span>`:``}
          ${e.achievements?`<span class="medal text-amber-400">${i(`achievement`,`w-3 h-3`)} ${e.achievements}</span>`:``}
          ${e.secretAchievements?`<span class="medal text-fuchsia-300" title="Logros secretos">${i(`lock`,`w-3 h-3`)} ${e.secretAchievements}</span>`:``}
          ${e.forgedCount?`<span class="medal text-cyan-300" title="Recolectores forjados">${i(`anvil`,`w-3 h-3`)} ${e.forgedCount}</span>`:``}
        </div>
      </div>

      <div class="text-right flex-shrink-0">
        <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">${h(s)}</div>
        <div class="text-[9px] font-mono text-[var(--text-muted)]">${c}</div>
      </div>
    </div>
  `}function Ti(e){switch(e){case`nanitas`:return`nanitas`;case`clics`:return`clics`;case`logros`:return`puntos de logro`;case`definitivo`:return`◆ puntos`}}function Ei(e){return e===`definitivo`?`
    <p class="text-[9px] text-[var(--text-muted)] text-center mt-3 leading-relaxed px-2">
      En esta tabla, un logro público vale ${h(fi)} puntos,
      uno secreto ${h(pi)} y cada recolector
      forjado ${h(mi)}. Los pesos son una decisión de diseño:
      igualan la partida entre grindar y completar.
    </p>
  `:``}function Di(){return Array.from({length:6}).map((e,t)=>`
    <div class="rank-row" style="opacity:${.7-t*.1}">
      <div class="rank-pos">·</div>
      <div class="min-w-0">
        <div class="h-3 rounded bg-[var(--border-color)] w-2/3"></div>
        <div class="h-2 rounded bg-[var(--border-color)] w-1/3 mt-1.5"></div>
      </div>
      <div class="h-3 rounded bg-[var(--border-color)] w-12"></div>
    </div>
  `).join(``)}var Oi=[{id:`llaves`,label:`Llaves`,icon:`key`,items:[`keyT0`,`keyT1`,`keyT2`,`keyT3`]},{id:`cajas`,label:`Cajas`,icon:`crate`,items:[`commonCrate`,`rareCrate`,`epicCrate`,`legendaryCrate`]},{id:`recursos`,label:`Recursos`,icon:`crystal`,items:[`upgradeCrystal`,`warehouseSlot`,`backpackExpander`]},{id:`cartas`,label:`Cartas`,icon:`card`,items:[`afkCard`,`clickX2Card`,`clickX3Card`]},{id:`forja`,label:`Forja`,icon:`flask`,items:[`calibrationStone`,`stabilityNano`]},{id:`mejoras`,label:`Mejoras`,icon:`layers`,items:Object.keys(M)},{id:`companeros`,label:`Compañeros`,icon:`companion`,items:Array.from({length:10},(e,t)=>`companionCardT${t+1}`)},{id:`recolectores`,label:`Recolectores`,icon:`collector`,items:Array.from({length:10},(e,t)=>`collectorCardT${t+1}`)}],ki={commonCrate:{what:`Caja básica con recursos de partida temprana.`,detail:`Puede dar nanitas, cristales, llaves, drones T1 o una ranura de almacén. Es la única caja cuyo contenido medio cubre su precio.`},rareCrate:{what:`Caja de nivel medio: crystals, compañeros T3 y recolectores T4 sobrecargadas.`,detail:`Las recolectores sobrecargadas valen bastante más que una del mismo tier en la tienda. Suele salir rentable si necesitas material de forja.`},epicCrate:{what:`Caja alta: compañeros T6, recolectores T6 y Piedras de Calibración.`,detail:`Puede incluir dos compañeros exclusivos que no se compran de ninguna otra forma, y es la mejor fuente de piedras de calibración.`},legendaryCrate:{what:`La caja máxima: recolectores T8, Nanopartículas y tres exclusivos.`,detail:`El premio habitual son los compañeros Divinos que solo existen aquí. La Nanopartícula de Estabilidad sale casi siempre de esta caja.`},key:{what:`Una llave. Se gasta una por cada caja que abras.`,detail:`Las cajas del almacén se aperturan aquí. Gastas la llave, la ruleta gira y te dice qué ha salido. Cada caja tiene su propia tabla de botín.`},upgradeCrystal:{what:`Cristal para subir el nivel del recolector equipado.`,detail:`El nivel multiplica el daño del recolector y sube hasta 20 en las de tienda, o 35 en las crafteadas. El coste en cristales crece por nivel y el éxito baja.`},warehouseSlot:{what:`Añade 5 ranuras permanentes al almacén.`,detail:`Las ranuras del árbol de pasivas se suman a estas. Ampliar es irreversible, pero es de las pocas compras que nunca sobran.`},backpackExpander:{what:`Añade 1 ranura al almacén, de pago único.`,detail:`Cuesta lo mismo por ranura que la ampliación grande pero permite comprar solo lo que falta.`},afkCard:{what:`Permite seguir cobrando con la ventana cerrada o en otra aplicación.`,detail:`El tiempo de la tarjeta se suma, hasta un máximo de 3 tarjetas a la vez. Cuanto más invertido tengas en compañeros activos, más rinde.`},clickBuff:{what:`x2 al daño de click durante 30 minutos.`,detail:`Afecta al recolector, no al ingreso pasivo. Conviene usarlo cuando vas a dedicate a pulsar en vez de a mirar los números.`},passiveBuff:{what:`x2 a todo el ingreso pasivo durante 1 hora.`,detail:`Multiplica a los compañeros activos, no al daño de click. Es la mejor carta si tu estilo es dejar que trabajen solos.`},clickX2Card:{what:`x2 al click durante 30 segundos.`,detail:`Muy corta a propósito: para gastarla en el pico de una racha de clics, no para llevarla puesta.`},clickX3Card:{what:`x3 al click durante 30 segundos.`,detail:`El doble de efecto que la x2 por cinco veces el precio. Solo sale rentable con muchos clics por segundo.`},calibrationStone:{what:`Sube 12 puntos la probabilidad de la próxima fusión.`,detail:`Se usa en la Forja y se puede gastar más de una por intento, hasta 5. Cuantas más gastes en una tirada, más riesgo que asumes.`},stabilityNano:{what:`Sube 8 puntos la probabilidad y garantiza un afijo extra.`,detail:`Es el único consumible que mejora el recolector resultante, no solo las probabilidades. Sale de la Caja Legendaria.`},companionSlot1:{what:`Una ranura más de compañero activo.`,detail:`Los compañeros activos son los que generan ingreso pasivo. Con más ranuras puedes usar a los que tengas, pero también subirlos de tier.`},companionSlot2:{what:`Abre hasta 3 ranuras de compañero de golpe.`,detail:`Sale mucho más barato por ranura que comprar la ranura suelta, pero solo tiene sentido si ya usas las 2 primeras.`}};function Ai(e,t){let n=ji(t),r=Mi(t);return e===`companion`?{what:`Compañero de tier ${t} (${r}): entre +${n[0]} y +${n[1]} de ingreso por segundo.`,detail:`Solo cuenta si lo equipas en una ranura activa. El nombre, el poder exacto y la rareza se sortean al comprarlo.`}:{what:`Recolector de tier ${t} (${r}): entre +${n[0]} y +${n[1]} de daño por click.`,detail:`El daño y la rareza se sortean al comprarlo. Los tiers altos suben de precio por estilo, no por ser objetivamente mejores: el coste por punto de daño se mantiene plano en toda la curva.`}}function ji(e){return w.ranges[e]??[1,5]}function Mi(e){return w.rarityByTier[e]??`Común`}var X={category:`cajas`,detail:null,stripScroll:0};function Ni(e){return e.endsWith(`Crate`)?`crate`:e.startsWith(`collectorCardT`)?`collector`:e.startsWith(`companionCardT`)?`companion`:{keyT0:`key`,keyT1:`key`,keyT2:`key`,keyT3:`key`,upgradeCrystal:`crystal`,warehouseSlot:`warehouse`,backpackExpander:`warehouse`,afkCard:`clock`,clickX2Card:`bolt`,clickX3Card:`bolt`,calibrationStone:`flask`,stabilityNano:`flask`,...Object.fromEntries(Object.keys(M).map(e=>[e,`layers`]))}[e]??`store`}function Pi(e){return P[e]===void 0?e.endsWith(`Crate`)?{commonCrate:`Común`,rareCrate:`Raro`,epicCrate:`Épico`,legendaryCrate:`Legendario`}[e]??null:e.startsWith(`companionCardT`)?Mi(parseInt(e.slice(14))):e.startsWith(`collectorCardT`)?Mi(parseInt(e.slice(11))):{upgradeCrystal:`Raro`,warehouseSlot:`Raro`,backpackExpander:`Raro`,afkCard:`Raro`,clickX2Card:`Raro`,clickX3Card:`Épico`,calibrationStone:`Raro`,stabilityNano:`Legendario`,...Object.fromEntries(nt.map((e,t)=>[`companionSlot${t+1}`,t>=1?`Legendario`:`Épico`]))}[e]??null:N[P[e]].rarity}function Fi(e){if(ki[e])return ki[e];if(P[e]!==void 0){let t=N[P[e]];return{what:`Abre ${st(t.tier).map(e=>$e[e].name).join(`, `)}.`,detail:`Las cajas sueltan llaves de su propio nivel, así que se repone sola.`}}return e.startsWith(`companionCardT`)?Ai(`companion`,parseInt(e.slice(14))):e.startsWith(`collectorCardT`)?Ai(`collector`,parseInt(e.slice(11))):{what:``,detail:``}}function Ii(e,t,n){let r=n.getCompanionSlots?.()??t.maxCompanionSlots,i=M[e];return i&&r>=i.da?{disabled:!0,reason:`Comprado`}:e===`backpackExpander`&&t.warehouseCapacity>=50?{disabled:!0,reason:`Al máximo`}:n.canBuyStoreItem?.(e)===!1?{disabled:!0,reason:`Almacén lleno`}:{disabled:!1,reason:null}}function Li(e,t,n,r){let a=t.getState(),o=a.bonus?.costReduction||0,s=e=>Math.floor(e*(1-o)),c=Oi.find(e=>e.id===X.category)??Oi[0],l=e=>{let n=it[e];if(!n)return``;let r=s(n.cost),c=a.nanites>=r,{disabled:l,reason:u}=Ii(e,a,t),d=l||!c,f=Pi(e),p=o>0&&Math.floor(n.cost)>r,m=``;if(e===`backpackExpander`)m=`Capacidad real: ${H(a.warehouse)}/${t.getCapacity?.()??a.warehouseCapacity}`;else if(e===`warehouseSlot`)m=`Ranuras de tienda: ${a.warehouseCapacity}`;else if(e===`afkCard`)m=`${Math.round((t.getAfkDurationMs?.()??6e5)/6e4)} min cada una · acumulable ×3`;else if(e===`key`)m=`Tienes ${a.keys}`;else if(e===`upgradeCrystal`)m=`Tienes ${a.upgradeCrystals}`;else if(M[e]){let n=M[e],r=t.getCompanionSlots?.()??a.maxCompanionSlots,i=Math.max(0,n.da-r);m=`${i===1?`Abre 1 ranura más de escuadrón`:`Abre ${i} ranuras más de escuadrón`} · Tienes ${r}`}else(e===`calibrationStone`||e===`stabilityNano`)&&(m=`En almacén: ${a.warehouse.find(t=>t.buffId===(e===`calibrationStone`?`calibrationStone`:`stabilityNano`))?.stackCount||0}`);return`
      <button class="card-glass border rounded-xl p-3 flex flex-col gap-2 text-left cursor-pointer
                     transition active:scale-[0.98] hover:border-[var(--accent)] ${l?`opacity-60`:``}"
              data-info="${e}" aria-label="Ver detalles de ${n.label}">
        <div class="flex items-start gap-2.5">
          <span class="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0
                       ${f?`ring-`+ht(f):``}
                       ${f?R(f):``} [&>span>svg]:w-4 [&>span>svg]:h-4">
            ${i(Ni(e))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="text-[12px] font-bold text-[var(--text-main)] leading-tight">${n.label}</div>
            ${m?`<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5 leading-snug">${m}</div>`:``}
          </div>
          <span class="text-[var(--text-muted)] opacity-40 flex-shrink-0 -mr-1 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
            ${i(`info`)}
          </span>
        </div>

        <div class="flex items-end justify-between gap-2 mt-auto pt-1">
          <div>
            <div class="font-['Orbitron'] font-bold text-[14px] accent-text tabular leading-none flex items-baseline gap-1">
              ${h(r)}
              <span class="accent-text text-[10px] not-italic" aria-hidden="true">◆</span>
            </div>
            ${p?`<div class="text-[9px] font-mono text-emerald-400 line-through leading-none mt-0.5">${h(n.cost)}</div>`:`<div class="text-[9px] font-mono text-[var(--text-muted)] mt-0.5">nanitas</div>`}
          </div>
          <!--
            El estado bloqueado viaja en el atributo data-blocked, no en una
            clase. Antes el manejador sniffaba className, así que cambiar el
            estilo de un botón rompía en silencio la lógica de la compra: se
            veía gris pero dejaba comprar.

            El precio también va en el DOM (data-price) y el aspecto sale de
            .store-buy en CSS: la hoja se refresca sin re-pintarse y asi el
            refresco tiene con comparar precio contra saldo.
          -->
          <span class="store-buy text-[10px] font-mono px-2.5 h-8 rounded-lg
                       grid place-items-center flex-shrink-0"
                data-buy="${e}" data-price="${r}"
                ${d?`data-blocked="1"`:``}
                ${c&&!l?`data-afford="1"`:``}
                role="button" tabindex="0"
                aria-label="${n.label}: ${u??(c?`Comprar`:`No alcanza`)}">
            ${u??`Comprar`}
          </span>
        </div>
      </button>
    `},u=X.detail?Bi(X.detail,s,a,t):``,d=`
    ${An([{label:`Nanitas`,value:h(a.nanites),glyph:`◆`,valueId:`store-nanites`},{label:`Almacén`,value:`${H(a.warehouse)}/${t.getCapacity?.()??a.warehouseCapacity}`},{label:`Descuento`,value:o>0?`−${Math.round(o*100)}%`:`—`,tone:o>0?`text-emerald-400`:void 0},{label:`Llaves`,value:String(a.keys)}])}

    <div id="cat-tabs" class="relative flex gap-1 mb-3 overflow-x-auto pb-1" role="tablist">
      <span id="cat-pill"
            class="absolute top-0 h-10 rounded-lg accent-bg pointer-events-none z-0"
            style="transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1); will-change: transform"></span>
      ${Oi.map(e=>`
        <button class="relative z-10 px-3 h-10 rounded-lg text-[10px] font-mono flex-shrink-0
                       transition-colors duration-200 cursor-pointer"
                data-cat="${e.id}" role="tab"
                aria-selected="${e.id===X.category}"
                style="${e.id===X.category?`color:#06121f;font-weight:700`:`color:var(--text-muted)`}">
          <span class="inline-flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(e.icon)}</span>
            ${e.label}
          </span>
        </button>
      `).join(``)}
    </div>

    ${c.id===`forja`&&!(a.nodeLevels?.blueprint>0)?`
      <div class="rounded-xl border p-3 mb-2.5 text-[10px] leading-relaxed"
           style="border-color: color-mix(in srgb, #f59e0b 40%, transparent);
                  background: color-mix(in srgb, #f59e0b 8%, transparent)">
        Puedes comprar estas piedras antes de desbloquear la forja, pero no
        sirven de nada hasta que tengas el nodo <span class="text-amber-400">Planos Viejos</span>.
      </div>
    `:``}

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      ${c.items.map(l).join(``)}
    </div>

    ${u}
  `,f=Dn(e,kn({title:`Mercado`,subtitle:o>0?`Descuento del árbol aplicado: −${Math.round(o*100)}%`:`Todo se paga con nanitas`,icon:`store`,onBack:n,state:a,hideNanites:!0},d));On(f,{back:n,go:r}),Ri(f,X.category),zi(f,X.category),f.querySelectorAll(`[data-cat]`).forEach(i=>{i.addEventListener(`click`,()=>{i.dataset.cat!==X.category&&(q.nav(),X.category=i.dataset.cat,X.detail=null,X.stripScroll=f.querySelector(`#cat-tabs`)?.scrollLeft??0,Li(e,t,n,r))})}),f.addEventListener(`click`,i=>{let a=i.target,o=a.closest(`[data-buy]`);if(o){i.stopPropagation();let a=o.dataset.buy;if(o.dataset.blocked){q.error();let e=Ii(a,t.getState(),t);S(e.reason??`No te alcanza`,`info`);return}if(t.buyStoreItem(a)===!1){q.error(),S(`No se pudo completar la compra.`,`error`);return}q.buy(),S(`Comprado`,`success`),Li(e,t,n,r);return}let s=a.closest(`[data-info]`);if(s){q.pick(),X.detail=X.detail===s.dataset.info?null:s.dataset.info,Li(e,t,n,r);return}a.closest(`[data-detail-close]`)&&(q.pick(),X.detail=null,Li(e,t,n,r))}),Wi(f,t)}function Ri(e,t){let n=e.querySelector(`#cat-pill`),r=e.querySelector(`[data-cat="${t}"]`);n&&r&&(requestAnimationFrame(()=>{n.style.width=`${r.offsetWidth}px`,n.style.transform=`translateX(${r.offsetLeft}px)`}),window.setTimeout(()=>{n.style.width=`${r.offsetWidth}px`,n.style.transform=`translateX(${r.offsetLeft}px)`},60))}function zi(e,t){let n=e.querySelector(`#cat-tabs`),r=e.querySelector(`[data-cat="${t}"]`);n&&r&&(n.scrollWidth<=n.clientWidth||(n.scrollLeft=X.stripScroll,n.scrollTo({left:r.offsetLeft,behavior:`smooth`})))}function Bi(e,t,n,r){let a=it[e];if(!a)return``;let o=t(a.cost),s=n.nanites>=o,{disabled:c,reason:l}=Ii(e,n,r),u=Pi(e),d=Fi(e);return`
    <div class="sheet-overlay z-[60]">
      <div class="absolute inset-0 bg-black/55 pointer-events-auto" data-detail-close></div>
      <div class="sheet-panel card-glass-elevated animate-rise-in">
        <div class="flex items-start gap-3 mb-3">
          <span class="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0
                       ${u?`ring-`+ht(u):``}
                       ${u?R(u):``} [&>span>svg]:w-6 [&>span>svg]:h-6">
            ${i(Ni(e))}
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight">
              ${a.label}
            </h3>
            ${u?`<div class="text-[10px] font-mono mt-0.5 ${R(u)}">${u}</div>`:``}
          </div>
          <button class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                  data-detail-close aria-label="Cerrar">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`close`)}</span>
          </button>
        </div>

        <p class="text-[12px] text-[var(--text-main)] leading-relaxed mb-1.5">${d.what}</p>
        <p class="text-[11px] text-[var(--text-muted)] leading-relaxed mb-3">${d.detail}</p>

        <div class="rounded-xl border border-[var(--border-color)] p-3 mb-3 flex items-center justify-between gap-3"
             style="background: color-mix(in srgb, var(--accent) 8%, transparent)">
          <div>
            <div class="label-caps mb-0.5">Precio</div>
            <div class="font-['Orbitron'] font-bold text-lg accent-text tabular flex items-baseline gap-1">
              ${h(o)}<span class="text-[12px] not-italic" aria-hidden="true">◆</span>
            </div>
          </div>
          <div class="text-right">
            <div class="label-caps mb-0.5">Tienes</div>
            <div class="font-mono text-[12px] text-[var(--text-main)] tabular">
              <span id="store-nanites-sheet">${h(n.nanites)}</span> ◆
            </div>
          </div>
        </div>

        <button class="store-buy w-full h-12 rounded-xl font-['Orbitron'] font-bold text-[12px] cursor-pointer
                       ${c?`opacity-50`:``}"
                data-buy="${e}" data-price="${o}"
                ${s&&!c?`data-afford="1"`:``}
                ${c?`disabled`:``}>
          ${l??`Comprar`}
        </button>
      </div>
    </div>
  `}var Vi=null,Hi=400;function Ui(e,t){let n=t.getState();e.querySelectorAll(`[data-buy]`).forEach(e=>{let r=e.dataset.buy,i=Number(e.dataset.price);if(!r||!Number.isFinite(i))return;let{disabled:a}=Ii(r,n,t),o=n.nanites>=i;a||!o?e.setAttribute(`data-blocked`,`1`):e.removeAttribute(`data-blocked`),o&&!a?e.setAttribute(`data-afford`,`1`):e.removeAttribute(`data-afford`)});let r=h(n.nanites||0);for(let t of[`#store-nanites`,`#store-nanites-sheet`]){let n=e.querySelector(t);n&&(n.textContent=r)}}function Wi(e,t){Vi!==null&&(window.clearInterval(Vi),Vi=null),Vi=window.setInterval(()=>{if(!e.isConnected){Vi!==null&&window.clearInterval(Vi),Vi=null;return}Ui(e,t)},Hi)}var Z={selected:[],stones:0,nano:!1,tier:0};function Gi(e,t,n,r){Ki(e,t,n,r)}function Ki(e,t,n,r){let a=t.getState(),o=(a.nodeLevels?.blueprint||0)>0,s=t.getForgeInfo(),c=(a.warehouse||[]).filter(e=>e.type===`collector`).sort((e,t)=>e.tier-t.tier||(t.damage||0)-(e.damage||0)),l=Array.from(new Set(c.map(e=>e.tier))).sort((e,t)=>e-t);Z.selected=Z.selected.filter(e=>c.some(t=>t.id===e)),Z.selected.length>3&&(Z.selected=Z.selected.slice(0,3)),l.includes(Z.tier)||(Z.tier=l[0]??1);let u=(a.warehouse||[]).find(e=>e.buffId===`calibrationStone`)?.stackCount||0,d=Math.min(5,u);Z.stones>d&&(Z.stones=d);let f=(a.warehouse||[]).find(e=>e.buffId===`stabilityNano`)?.stackCount||0;f===0&&(Z.nano=!1);let p=Z.selected.map(e=>c.find(t=>t.id===e)).filter(Boolean),m=p[0]?.tier??0,g=p.reduce((e,t)=>e+(t.affixes?.length||0)*.02,0),_=p.length===3&&m?ve(m,s.craftLuck,Z.stones,g,+!!Z.nano):0,v=p.length===3,y=o?`
    ${An([{label:`Esquirlas`,value:h(a.shards),tone:`text-cyan-300`},{label:`Recolectores`,value:String(c.length)},{label:`Forjadas`,value:String(a.forgedCount)},{label:`Piedras`,value:String(u)}])}

    <section class="card-glass rounded-2xl p-3 md:p-4 mb-3">
      ${jn(`Yunque de fusión`,`anvil`,`
        <span class="text-[9px] font-mono text-[var(--text-muted)] hidden sm:inline">3 del mismo tier → 1 del siguiente</span>
      `)}

      <div class="forge-anvil">${[0,1,2].map(e=>{let t=p[e];return t?`
      <button class="forge-slot is-filled" data-act="clear" data-slot="${e}"
              style="border-color: color-mix(in srgb, var(--accent) 55%, transparent)"
              aria-label="Quitar ${t.name}">
        <span class="flex flex-col items-center gap-0.5 min-w-0 w-full">
          <span class="${R(t.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`collector`)}</span>
          <span class="text-[9px] font-mono text-center leading-tight line-clamp-2">T${t.tier}</span>
          ${t.potential?`<span class="text-[9px] text-amber-400 leading-none">${`★`.repeat(t.potential)}</span>`:``}
        </span>
      </button>`:`
        <button class="forge-slot" data-act="clear" data-slot="${e}" aria-label="Hueco ${e+1}">
          <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`plus`)}</span>
        </button>`}).join(``)}</div>

      <div class="mt-3">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="label-caps">Probabilidad</span>
          <span class="font-['Orbitron'] font-bold text-sm tabular
                       ${v?_>=.6?`text-emerald-400`:_>=.42?`text-amber-400`:`text-rose-400`:`text-[var(--text-muted)]`}">
            ${v?`${Math.round(_*100)}%`:`—`}
          </span>
        </div>
        <div class="chance-bar">
          <span style="width:${(_*100).toFixed(1)}%;
                       background: linear-gradient(to right, var(--accent),
                         color-mix(in srgb, var(--accent) 50%, transparent))"></span>
        </div>
        ${v?`
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            base T${m} ${Math.round(_e(m)*100)}%
            ${s.craftLuck>0?` · árbol +${Math.round(s.craftLuck*100)}%`:``}
            ${Z.stones>0?` · piedras +${Z.stones*12}%`:``}
            ${Z.nano?` · nanopartícula +8%`:``}
            · tope 95%
          </p>
        `:`
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5">
            Selecciona 3 recolectores del mismo tier.
          </p>
        `}
      </div>

      <div class="mt-3 pt-3 border-t border-[var(--border-color)]">
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="label-caps flex items-center gap-1.5">
            <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`flask`)}</span>
            Piedras de calibración
          </span>
          <span class="text-[10px] font-mono text-[var(--text-muted)]">${u} en almacén</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${Array.from({length:d}).map((e,t)=>`
            <button class="w-9 h-9 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition
                           ${t<Z.stones?`accent-bg text-slate-950 border-transparent`:`btn-ghost text-[var(--text-muted)]`}"
                    data-act="stones" data-n="${t+1}" aria-label="Usar ${t+1}">${t+1}</button>
          `).join(``)}
          ${d===0?`<span class="text-[10px] text-[var(--text-muted)] leading-relaxed">
                 No tienes piedras. Se venden en la tienda y salen de cajas Épicas y Legendarias.
               </span>`:`<button class="ml-1 px-2.5 h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                      data-act="stones" data-n="0">Quitar</button>`}
          ${Z.stones>0?`<span class="ml-auto text-[10px] font-mono accent-text">+${Z.stones*12}%</span>`:``}
        </div>

        <!-- Nanopartícula: interruptor, porque solo se puede gastar una -->
        <div class="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center gap-2.5">
          <button class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  data-act="nano" ${f>0?``:`disabled style="opacity:.4;cursor:not-allowed"`}>
            <span class="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 border transition
                         ${Z.nano?`accent-bg text-slate-950 border-transparent`:`btn-ghost text-[var(--text-muted)]`}"
                  aria-hidden="true">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3">${i(`check`)}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-bold text-[var(--text-main)] leading-tight">
                Nanopartícula de Estabilidad
              </span>
              <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">
                ${f>0?`${f} en almacén · +8% y un afijo garantizado`:`No tienes ninguna`}
              </span>
            </span>
          </button>
          ${Z.nano?`<span class="text-[10px] font-mono accent-text flex-shrink-0">activa</span>`:``}
        </div>
      </div>

      <button data-act="forge" ${v?``:`disabled`}
        class="w-full mt-3 rounded-xl font-['Orbitron'] font-bold text-[12px] tracking-wide cursor-pointer
               ${v?`btn-primary`:`btn-ghost opacity-40 cursor-not-allowed`}"
        style="min-height:52px">
        ${v?`FORJAR`:`FALTAN ${3-p.length} MATERIALES`}
      </button>
      <p class="text-[9px] text-[var(--text-muted)] text-center mt-2 leading-relaxed">
        Éxito: creas el recolector y recuperas 1 de los 3 materiales.
        Fallo: pierdes los 3 y ganas esquirlas.
      </p>
    </section>

    <section class="card-glass rounded-2xl p-3 md:p-4">
      ${jn(`Materiales`,`layers`,`
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${Z.selected.length}/3</span>
      `)}

      ${c.length===0?Mn(`collector`,`No tienes recolectores`,`Compra recolectores en la tienda o abre cajas. Necesitas 3 del mismo tier para fusionar.`):`
          <div class="flex gap-1 mb-2.5 overflow-x-auto pb-1">
            ${l.map(e=>`
              <button class="px-3 h-10 rounded-lg text-[10px] font-mono cursor-pointer flex-shrink-0 transition
                             ${e===Z.tier?`accent-bg text-slate-950`:`btn-ghost text-[var(--text-muted)]`}"
                      data-act="tier" data-tier="${e}">
                T${e} · ${c.filter(t=>t.tier===e).length}
              </button>
            `).join(``)}
          </div>
          <div class="inv-grid">
            ${c.filter(e=>e.tier===Z.tier).map(e=>{let t=Z.selected.includes(e.id),n=e.id===a.equippedCollectorId;return`
      <button class="inv-cell ${t?`is-selected`:``} ${n?`opacity-60`:``}"
              data-act="pick" data-id="${e.id}"
              title="${n?`Equipada: desequípala para usarla como material`:e.name}">
        <span class="ring-${ht(e.rarity)} w-9 h-9 rounded-lg grid place-items-center
                     [&>span>svg]:w-4 [&>span>svg]:h-4 ${R(e.rarity)}">${i(`collector`)}</span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full">
          ${e.name}
        </span>
        <span class="text-[9px] font-mono text-[var(--text-muted)]">
          T${e.tier}${e.potential?` · ${e.potential}★`:``}${n?` · EQ`:``}
        </span>
      </button>`}).join(``)||`<p class="text-[11px] text-[var(--text-muted)] col-span-full">Sin recolectores en este tier.</p>`}
          </div>
        `}
    </section>
  `:qi(a),b=Dn(e,kn({title:`Forja`,subtitle:o?`Fusión, autoría y potencial`:`Bloqueada · necesitas 1 ◆`,icon:`anvil`,onBack:n,state:a,actions:o?`
      <span class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border border-[var(--border-color)]
                   text-[11px] font-mono text-cyan-300">
        ${i(`crystal`,`w-3.5 h-3.5`)} ${h(a.shards)}
      </span>`:``},y));On(b,{back:n,go:r}),Ji(b,t,n,r)}function qi(e){return`
    ${Mn(`lock`,`Forja bloqueada`,`Invierte núcleos en el nodo "Planos Viejos" del árbol de pasivas para desbloquear el crafteo.`)}
    <div class="card-glass rounded-2xl p-4 mt-3 flex flex-col gap-2">
      <div class="flex items-center gap-2.5">
        <span class="w-9 h-9 rounded-lg btn-ghost grid place-items-center flex-shrink-0
                     [&>span>svg]:w-4 [&>span>svg]:h-4 text-amber-400">${i(`scroll`)}</span>
        <div class="min-w-0">
          <div class="text-[12px] font-bold text-[var(--text-main)]">Planos Viejos</div>
          <div class="text-[10px] text-[var(--text-muted)] font-mono">1 núcleo · sin requisitos</div>
        </div>
        <span class="ml-auto text-[10px] font-mono accent-text tabular">
          ${e.cores>=1?`comprable`:`te faltan ${1-e.cores}`}
        </span>
      </div>
      <p class="text-[10px] text-[var(--text-muted)] leading-relaxed">
        Recicla tu progreso una vez para ganar núcleos, vuelve a la Ascensión y desbloquea la forja.
      </p>
    </div>
  `}function Ji(e,t,n,r){let i=e.parentElement,a=()=>Ki(i,t,n,r),o=()=>{let e=(t.getState().warehouse||[]).filter(e=>e.type===`collector`);return{collectors:e,selected:Z.selected.map(t=>e.find(e=>e.id===t)).filter(Boolean)}};i.addEventListener(`click`,e=>{let n=e.target.closest(`[data-act]`);if(n)switch(n.dataset.act){case`tier`:q.nav(),Z.tier=Number(n.dataset.tier),a();break;case`pick`:{if(Z.selected.length>=3){S(`El yunque ya tiene 3 materiales. Quita uno primero.`,`info`);return}let{collectors:e,selected:r}=o(),i=e.find(e=>e.id===n.dataset.id);if(!i)return;if(r.length&&i.tier!==r[0].tier){q.error(),S(`Ya hay un T${r[0].tier} en el yunque. La fusión exige 3 del mismo tier.`,`info`);return}if(i.id===t.getState().equippedCollectorId){q.error(),S(`Desequipa ese recolector antes de consumirlo como material.`,`info`);return}q.pick(),Z.selected.push(n.dataset.id),a();break}case`clear`:q.pick(),Z.selected.splice(Number(n.dataset.slot),1),a();break;case`stones`:{q.nav();let e=Number(n.dataset.n);Z.stones=e===0||Z.stones===e?0:e,a();break}case`nano`:if((t.getState().warehouse||[]).filter(e=>e.buffId===`stabilityNano`).reduce((e,t)=>e+(t.stackCount||1),0)===0){q.error(),S(`No tienes Nanopartículas de Estabilidad.`,`info`);return}q.nav(),Z.nano=!Z.nano,a();break;case`forge`:Yi(i,t,a)}})}function Yi(e,t,n){let r=(t.getState().warehouse||[]).filter(e=>e.type===`collector`),i=Z.selected.map(e=>r.find(t=>t.id===e)).filter(Boolean);if(i.length!==3){S(`Selecciona 3 recolectores del mismo tier.`,`info`);return}let a=i[0].tier,o=t.getForgeInfo(),s=i.reduce((e,t)=>e+(t.affixes?.length||0)*.02,0),c=ve(a,o.craftLuck,Z.stones,s,+!!Z.nano);x(`Tres recolectores de tier ${a} se funden en una de tier ${a+1}. Si aciertas recuperas un material; si fallas, pierdes los tres.`,()=>Xi(t,i,Z.stones,Z.nano,n),{sublabel:`Probabilidad ${Math.round(c*100)}%`,confirmText:`Forjar`,danger:c<.45})}function Xi(e,t,n,r,i){q.hammer();let a=e.forgeCollector(t.map(e=>e.id),n,+!!r);Zi(a,()=>{a.success&&a.collector?(q.forgeSuccess(),S(`${a.collector.name} — forjada por ti`,`success`),Z.selected=[]):(q.forgeFail(),S(a.msg??`La fusión falló`,`error`),Z.selected=[]),i()})}function Zi(e,t){let n=document.createElement(`div`);n.className=`fixed inset-0 z-[75] flex flex-col items-center justify-center p-6`,n.style.cssText=`background: rgb(0 0 0 / 0.8); backdrop-filter: blur(8px);`,n.style.animation=`riseIn 240ms ease both`;let r=!!e.success,a=e.collector,o=r?a?.name??`Forja completada`:`FALLO DE FORJA`,s=r?`#fbbf24`:`#f87171`,c=r?[`T${a.tier} · ${a.potential??1}★ · ${a.rarity}`,(a.affixes||[]).length?a.affixes.map(e=>pe[e]?.name).filter(Boolean).join(` · `):`Sin afijos`,`Forjada por: ${a.forgedBy??`—`}`].join(`<br>`):`+${e.shards??0} esquirlas para el siguiente intento`,l=Array.from({length:18},(e,t)=>{let n=t===9;return`
      <div class="w-14 h-14 rounded-xl grid place-items-center flex-shrink-0 border md:w-16 md:h-16
                  ${n?r?`border-amber-400 text-amber-300`:`border-rose-500 text-rose-400`:`border-[var(--border-color)] text-[var(--text-muted)] opacity-35`}"
           style="${n?`box-shadow: 0 0 24px -6px currentColor`:``}">
        <span class="[&>span>svg]:w-5 [&>span>svg]:h-5 md:[&>span>svg]:w-6 md:[&>span>svg]:h-6">
          ${i(n?r?`sparkle`:`close`:`core`)}
        </span>
      </div>`}).join(``);n.innerHTML=`
    <div class="w-full max-w-md flex flex-col gap-3">
      <div class="text-center label-caps" style="color:${s}">
        ${r?`Forja completada`:`El yunque se enfrió`}
      </div>
      <div class="forge-roulette">
        <div class="flex gap-1.5 pl-8" id="forge-track" style="will-change:transform">${l}</div>
      </div>
      <div class="text-center flex flex-col gap-1">
        <div class="font-['Orbitron'] font-bold text-[15px]" style="color:${s}">${o}</div>
        <div class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">${c}</div>
      </div>
    </div>
  `,document.body.appendChild(n);let u=n.querySelector(`#forge-track`),d=n.querySelector(`.forge-roulette`),f=0,p=window.setInterval(()=>{f++,q.forgeTick(f/22),f>=22&&window.clearInterval(p)},70),m=!1,h=()=>{if(m)return;let e=u.children[9];if(!e)return;m=!0;let t=parseFloat(getComputedStyle(e).width)||56,n=d.clientWidth/2,r=Math.round(d.clientWidth*1.5);u.style.paddingLeft=`${32+r}px`;let i=32+r+9*(t+6)+t/2-n;u.style.setProperty(`--forge-travel`,`${i.toFixed(1)}px`),u.style.animation=`forgeSpin 1.9s cubic-bezier(0.12, 0.85, 0.2, 1) both`},g=()=>{let e=u.children[9];if(!e)return;let t=e.getBoundingClientRect(),n=d.getBoundingClientRect().left+d.clientLeft+d.clientWidth/2,r=t.left+t.width/2-n;if(Math.abs(r)<1)return;let i=parseFloat(u.style.getPropertyValue(`--forge-travel`))||0;u.style.setProperty(`--forge-travel`,`${(i+r).toFixed(1)}px`)};requestAnimationFrame(()=>{h(),g()}),window.setTimeout(()=>{h(),g()},60),window.setTimeout(g,220),window.setTimeout(()=>{window.clearInterval(p),t(),n.style.transition=`opacity 320ms ease`,n.style.opacity=`0`,window.setTimeout(()=>n.remove(),340)},2200)}function Qi(e){let t=e.unlock;switch(t.kind){case`default`:return`Disponible desde el principio`;case`cores`:return`Compra con ${t.value} núcleos en la Ascensión`;case`achievement`:return`Se desbloquea con un logro`;case`ranking`:return t.value===1?`Solo para quien ocupe el 1er puesto`:t.value===3?`Solo para el Top 3 sostenido 7 días`:`Solo para el Top ${t.value} sostenido 7 días`;case`crate`:return`Sale de una ${_t[t.value]?.name??`caja`}`;case`secret`:return t.hint??`Condición oculta`;default:return`No disponible`}}function $i(e){let t=e.size??`md`,n=t===`lg`?`w-20 h-20`:t===`sm`?`w-9 h-9`:`w-14 h-14`,r=t===`lg`?`text-2xl`:t===`sm`?`text-[13px]`:`text-lg`,i=(e.name||`?`).trim().slice(0,2).toUpperCase(),a=Ze[e.cosmetics.title],o=Ze[e.cosmetics.frame],s=Ze[e.cosmetics.banner],c=[j(a),a?.style.gradient?`background-clip:text;-webkit-background-clip:text;color:transparent`:``,a?.style.glow===`true`?`text-shadow:0 0 16px currentColor`:``].filter(Boolean).join(`;`);return`
    <div class="flex items-center gap-3 min-w-0">
      <div class="avatar-stack ${n} flex-shrink-0">
        <span class="avatar-frame w-full h-full rounded-full ${s?.id&&s.id!==`banner_none`?``:`opacity-0`}"
              style="${s&&s.id!==`banner_none`?`transform:scale(1.9);opacity:.5;${j(s)}`:``}"></span>
        <span class="avatar-core w-[78%] h-[78%] ${r}">${i}</span>
        <span class="avatar-frame w-full h-full rounded-full"
              style="${o?j(o):``}"></span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-['Orbitron'] font-bold text-[13px] md:text-sm text-[var(--text-main)] truncate leading-tight">
          ${e.name}
        </div>
        ${a?`
          <div class="title-display text-[10px] truncate" style="${c}">${a.name}</div>
        `:`<div class="label-caps">${e.subtitle??`Operativo`}</div>`}
      </div>
    </div>
  `}var ea={tab:`title`};function ta(e,t,n,r,o){let s=t.getState(),c=t.getAchievements(),l=c.filter(e=>e.unlocked),u=s.unlockedAchievements.filter(e=>Vt.includes(e)),d=t.getDisplayName?.()||s.displayName||`Operativo`,f=s.warehouse.filter(e=>e.type===`collector`),p=f.reduce((e,t)=>!e||(t.damage||0)>(e.damage||0)?t:e,null),m=f.filter(e=>e.forgedBy).reduce((e,t)=>!e||(t.damage||0)>(e.damage||0)?t:e,null),g=s.cosmetics.unlocked,_=ea.tab,v=e=>{let t=g.includes(e.id),n=_===`title`&&s.cosmetics.title===e.id||_===`frame`&&s.cosmetics.frame===e.id||_===`banner`&&s.cosmetics.banner===e.id;return`
      <button class="text-left card-glass border rounded-xl p-2.5 flex flex-col gap-1.5 cursor-pointer
                     transition active:scale-[0.97] ${n?`is-selected`:``} ${t?``:`opacity-55`}"
              data-cos="${e.id}"
              style="${n?`border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent)`:``}">
        <div class="flex items-start justify-between gap-1.5">
          <span class="text-[11px] font-bold ${R(e.rarity)} leading-tight">${e.name}</span>
          ${n?`<span class="accent-text flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`check`)}</span>`:t?`<span class="text-emerald-400 flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`unlock`)}</span>`:`<span class="text-[var(--text-muted)] opacity-60 flex-shrink-0 [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`lock`)}</span>`}
        </div>

        <div class="flex items-center gap-1.5 min-h-[28px]">
          ${_===`frame`?`
            <span class="w-7 h-7 rounded-full flex-shrink-0" style="${j(e)}"></span>
          `:_===`banner`?`
            <span class="w-9 h-6 rounded-md flex-shrink-0" style="${j(e)}"></span>
          `:`
            <span class="title-display text-[9px] truncate flex-1"
                  style="${j(e)}${e.style.gradient?`;background-clip:text;-webkit-background-clip:text`:``}">
              ${e.name}
            </span>
          `}
        </div>

        <span class="text-[9px] text-[var(--text-muted)] leading-snug">${Qi(e)}</span>
      </button>
    `},y=`
    ${An([{label:`Nanitas`,value:h(s.nanites),glyph:`◆`,valueId:`profile-nanites`},{label:`Logros`,value:`${l.length}/${c.length}`,tone:`text-amber-300`},{label:`Núcleos`,value:h(s.cores),tone:`text-purple-300`},{label:`Forjadas`,value:String(s.forgedCount)}])}

    <!-- Mejor recolector: el objeto del que presume el jugador -->
    ${p?`
      <section class="card-glass rounded-2xl p-3 mb-3">
        <div class="label-caps mb-2 flex items-center gap-1.5">
          <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`collector`)}</span>
          ${m?`Mejor recolector forjado`:`Mejor recolector`}
        </div>
        <div class="flex items-center gap-2.5">
          <span class="ring-${ht(p.rarity)} w-10 h-10 rounded-xl grid place-items-center flex-shrink-0
                       ${R(p.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`collector`)}</span>
          <div class="min-w-0 flex-1">
            <div class="text-[12px] font-bold text-[var(--text-main)] truncate">${p.name}</div>
            <div class="text-[9px] font-mono text-[var(--text-muted)]">
              T${p.tier} · ${p.rarity}${p.potential?` · ${`★`.repeat(p.potential)}`:``}
              ${p.forgedBy?` · de <span class="accent-text">${p.forgedBy}</span>`:``}
            </div>
          </div>
          <div class="text-right flex-shrink-0">
            <div class="label-caps leading-none">Daño</div>
            <div class="font-['Orbitron'] font-bold text-[13px] accent-text tabular">+${h(p.damage)}</div>
          </div>
        </div>
      </section>
    `:``}

    <!-- Tarjeta de identidad -->
    <section class="card-glass rounded-2xl overflow-hidden mb-3">
      <div class="cosmetic-banner" style="${j(Ze[s.cosmetics.banner])}">
        <div class="p-4 md:p-5 flex flex-col items-center text-center gap-2"
             style="background: color-mix(in srgb, var(--bg-app) 72%, transparent)">
          ${$i({name:d,cosmetics:s.cosmetics,size:`lg`})}
          <div class="flex items-center gap-2 flex-wrap justify-center mt-1">
            <span class="medal text-[var(--text-muted)]">${i(`core`,`w-3 h-3`)} ${s.resets} ascensiones</span>
            <span class="medal text-[var(--text-muted)]">${i(`anvil`,`w-3 h-3`)} ${s.forgedCount} recolectores</span>
            <span class="medal text-amber-400">${i(`sparkle`,`w-3 h-3`)} ${u.length} secretos</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Acceso a la ascensión -->
    <button data-go-prestige
      class="w-full card-glass border rounded-2xl p-3.5 mb-3 flex items-center gap-3 cursor-pointer
             transition active:scale-[0.99] hover:border-[var(--accent)]"
      style="border-color: color-mix(in srgb, var(--accent) 40%, transparent)">
      <span class="accent-text flex-shrink-0 [&>span>svg]:w-6 [&>span>svg]:h-6">${i(`recycle`)}</span>
      <div class="min-w-0 flex-1 text-left">
        <div class="text-[12px] font-bold text-[var(--text-main)]">Ascensión y árbol de pasivas</div>
        <div class="text-[10px] text-[var(--text-muted)] font-mono">
          ${h(s.cores)} núcleos disponibles
        </div>
      </div>
      <span class="text-[var(--text-muted)] flex-shrink-0 rotate-180 [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`back`)}</span>
    </button>

    <!-- Cosméticos -->
    <section class="card-glass rounded-2xl p-3 md:p-4 mb-3">
      ${jn(`Cosméticos`,`crown`,`
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${g.length}/${Xe.length}</span>
      `)}

      <div class="flex gap-1 mb-3">
        ${[{id:`title`,label:`Títulos`,icon:`medal`},{id:`frame`,label:`Marcos`,icon:`sparkle`},{id:`banner`,label:`Banners`,icon:`layers`}].map(e=>`
          <button class="flex-1 h-10 rounded-lg text-[10px] font-mono cursor-pointer transition flex items-center
                         justify-center gap-1.5
                         ${_===e.id?`accent-bg text-slate-950`:`btn-ghost text-[var(--text-muted)]`}"
                  data-cos-tab="${e.id}">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(e.icon)}</span>
            ${e.label}
          </button>
        `).join(``)}
      </div>

      <div id="cos-panel">${(e=>`
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      ${k(e).map(v).join(``)}
    </div>
  `)(_)}</div>
    </section>

    <!-- Logros -->
    <section class="card-glass rounded-2xl p-3 md:p-4">
      ${jn(`Logros`,`achievement`,`
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${l.length}/${c.length}</span>
      `)}
      <div class="flex flex-col gap-2">
        ${c.map(e=>{let t=Vt.includes(e.id),n=e.target>0?Math.min(100,e.current/e.target*100):0;return`
      <div class="rounded-xl border border-[var(--border-color)] p-2.5 flex items-center gap-2.5
                  ${e.unlocked?``:`opacity-65`}"
           style="${e.unlocked?`background: color-mix(in srgb, var(--accent) 8%, transparent)`:``}">
        <span class="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0
                     ${e.unlocked?`accent-bg text-slate-950`:`btn-ghost text-[var(--text-muted)]`}"
              aria-hidden="true">${a(t&&!e.unlocked?`lock`:e.icon)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[11px] font-bold text-[var(--text-main)] truncate">
              ${t&&!e.unlocked?`???`:e.title}
            </span>
            ${e.unlocked?`<span class="text-[9px] font-mono text-emerald-400 flex-shrink-0">✓</span>`:`<span class="text-[9px] font-mono text-[var(--text-muted)] tabular flex-shrink-0">${h(e.current)}/${h(e.target)}</span>`}
          </div>
          <p class="text-[9px] text-[var(--text-muted)] leading-snug mt-0.5">
            ${t&&!e.unlocked?e.description||`Logro oculto`:e.description}
          </p>
          ${!e.unlocked&&e.target>0?`<div class="meter mt-1.5"><span style="width:${n}%"></span></div>`:``}
          ${e.unlocked?`<p class="text-[9px] font-mono mt-0.5" style="color:var(--accent)">${e.rewardText}</p>`:``}
        </div>
      </div>
    `}).join(``)}
      </div>
      ${u.length>0?`
        <p class="text-[9px] text-[var(--text-muted)] mt-3 text-center leading-relaxed">
          Hay ${u.length} logro(s) secreto(s) desbloqueado(s). Nadie más puede ver cuáles.
        </p>
      `:``}
    </section>
  `,b=Dn(e,kn({title:`Perfil`,subtitle:`Identidad, cosméticos y logros`,icon:`user`,onBack:n,state:s,hideNanites:!0},y));On(b,{back:n,go:o}),b.querySelector(`[data-go-prestige]`)?.addEventListener(`click`,r),b.querySelectorAll(`[data-cos-tab]`).forEach(i=>{i.addEventListener(`click`,()=>{q.nav(),ea.tab=i.dataset.cosTab,ta(e,t,n,r,o)})}),b.querySelectorAll(`[data-cos]`).forEach(i=>{i.addEventListener(`click`,()=>{let a=i.dataset.cos;if(!g.includes(a)){q.error();let e=Ze[a];S(`${e?.name}: ${Qi(e)}`,`info`);return}q.equip(),t.equipCosmetic(_,a),ta(e,t,n,r,o)})})}function na(e,t){let n=e=>`+${Math.round(e*100)}%`;switch(e){case`clickMult`:return`${n(t)} daño de click`;case`passiveMult`:return`${n(t)} ingreso pasivo`;case`costReduction`:return`−${Math.round(t*100)}% coste de tienda`;case`sellMult`:return`${n(t)} precio de venta`;case`craftLuck`:return`${n(t)} éxito de forja`;case`shardBonus`:return`${n(t)} esquirlas por fallo`;case`autoClick`:return`+${t} clics/s automáticos`;case`afkHours`:return`+${t*60} min de AFK`;case`offlineClicks`:return`+${t} clics al volver`;case`crateLuck`:return`${n(t)} suerte en cajas`;case`coreGain`:return`${n(t)} núcleos por reinicio`;case`storageSlots`:return`+${t} slots de almacén`;case`companionSlots`:return`+${t} slots de compañero`;default:return`${e} +${t}`}}function ra(e){let t=Object.keys(e).map(t=>[t,e[t]]).filter(([,e])=>e>0).sort((e,t)=>ia(t[0],t[1])-ia(e[0],e[1]));return t.length===0?`<p class="text-[11px] text-[var(--text-muted)] leading-relaxed">
      Todavía no has invertido ningún núcleo. Recicla una vez para desbloquear la rama de las pasivas.
    </p>`:`
    <div class="flex flex-wrap gap-1.5">
      ${t.map(([e,t])=>`
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono
                     border border-[var(--border-color)] text-[var(--text-main)]"
              style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
          ${na(e,t)}
        </span>
      `).join(``)}
    </div>
  `}function ia(e,t){return t*(e===`clickMult`||e===`passiveMult`?4:1)}function aa(e,t,n,r){let o=t.getState(),s=o.bonus,c=Yt({totalNanitesProduced:o.totalNanitesProduced,totalCores:o.totalCores,coreGain:s.coreGain}),l=tn(o.nodeLevels||{}),u=c>0,d={};for(let e of Ht)(d[e.tier]||=[]).push(e);for(let e of Object.keys(d))d[Number(e)].sort((e,t)=>e.y-t.y);let f=e=>{let t=o.nodeLevels[e.id]||0,n=en(e.id,o.nodeLevels,o.cores),r=t>=e.maxLevel,i=r?null:Gt(e,t),s=Wt[e.category];return`
      <button class="${[`tree-node`,t>0?`is-owned`:``,r?`is-capped`:``,!n.ok&&!r?n.reason?.startsWith(`Requiere`)?`is-locked`:``:`is-affordable`].filter(Boolean).join(` `)}" data-node="${e.id}" aria-label="${e.name}">
        <span class="${s?.color||`accent-text`} [&>span>svg]:w-4 [&>span>svg]:h-4">${a(e.icon)}</span>
        <span class="text-[9px] leading-[1.15] font-mono text-[var(--text-main)] px-0.5 line-clamp-2">
          ${e.name}
        </span>
        <span class="flex items-center gap-[3px]">
          ${Array.from({length:Math.min(e.maxLevel,5)}).map((e,n)=>`<span class="tree-pip ${n<Math.min(t,5)?`is-on`:``}"></span>`).join(``)}
        </span>
        ${r?`<span class="text-[9px] font-mono text-amber-400">MAX</span>`:`<span class="text-[9px] font-mono tabular ${o.cores>=i?`accent-text`:`text-[var(--text-muted)]`}">${i} ◆</span>`}
      </button>
    `},p=`
    ${An([{label:`Núcleos`,value:h(o.cores)},{label:`Al reiniciar`,value:`+${h(c)}`,tone:`text-emerald-400`},{label:`Reinicios`,value:String(o.resets)},{label:`Árbol`,value:`${Math.round(l*100)}%`}])}

    <!-- Panel de reciclaje -->
    <section class="card-glass rounded-2xl p-3.5 md:p-4 mb-3">
      <div class="flex items-start gap-2.5 mb-2.5">
        <span class="accent-text flex-shrink-0 [&>span>svg]:w-5 [&>span>svg]:h-5">${i(`recycle`)}</span>
        <div class="min-w-0 flex-1">
          <h2 class="font-['Orbitron'] font-bold text-[13px] accent-text">Reciclar progreso</h2>
          <p class="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 leading-relaxed">
            Conviertes todo lo que has construido en núcleos permanentes.
          </p>
        </div>
      </div>

      ${u?`
        <div class="flex items-center justify-between gap-3 py-2 px-3 rounded-xl mb-2.5"
             style="background: color-mix(in srgb, var(--accent) 10%, transparent);
                    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent)">
          <span class="text-[11px] font-mono text-[var(--text-muted)]">Producido total</span>
          <span class="font-['Orbitron'] font-bold text-sm accent-text tabular">${h(o.totalNanitesProduced)}</span>
        </div>
      `:`
        <div class="mb-2.5">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[10px] font-mono text-[var(--text-muted)]">
              Produce ${h(Zt({totalNanitesProduced:o.totalNanitesProduced,totalCores:o.totalCores,coreGain:s.coreGain}))} más para el ${o.totalCores>0?`siguiente`:`primer`} núcleo
            </span>
          </div>
          <div class="meter is-tall"><span style="width:${Math.round(Qt({totalNanitesProduced:o.totalNanitesProduced,totalCores:o.totalCores,coreGain:s.coreGain})*100)}%"></span></div>
        </div>
      `}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-[10px]">
        <div class="rounded-xl border border-[var(--border-color)] p-2.5">
          <div class="label-caps mb-1" style="color:#f87171">Se pierde</div>
          <ul class="space-y-0.5 text-[var(--text-muted)] leading-snug">
            <li>Nanitas y todo el ingreso pasivo</li>
            <li>Recolectores, compañeros e infraestructura</li>
            <li>Llaves, cristales y cajas sin abrir</li>
          </ul>
        </div>
        <div class="rounded-xl border border-[var(--border-color)] p-2.5">
          <div class="label-caps mb-1" style="color:#4ade80">Se conserva</div>
          <ul class="space-y-0.5 text-[var(--text-muted)] leading-snug">
            <li>Núcleos, nodos del árbol y cosméticos</li>
            <li>Logros y sus bonificaciones</li>
            <li>Esquirlas y recolectores que ya forjaste</li>
          </ul>
        </div>
      </div>

      <button id="recycle-btn" ${u?``:`disabled`}
        class="w-full h-12 rounded-xl font-['Orbitron'] font-bold text-[12px] tracking-wide cursor-pointer
               ${u?`btn-primary`:`btn-ghost opacity-40 cursor-not-allowed`}">
        ${u?`RECICLAR Y GANAR ${h(c)} NÚCLEOS`:`AÚN NO PUEDES RECICLAR`}
      </button>
    </section>

    <!-- Bonificaciones activas -->
    <section class="card-glass rounded-2xl p-3.5 md:p-4 mb-3">
      <h2 class="label-caps mb-2 flex items-center gap-1.5">
        <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`sparkle`)}</span>
        Bonificaciones activas
      </h2>
      ${ra(s)}
    </section>

    <!-- El árbol -->
    <section class="card-glass rounded-2xl p-3 md:p-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 class="label-caps flex items-center gap-1.5">
          <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`tree`)}</span>
          Árbol de pasivas
        </h2>
        <div class="flex items-center gap-1.5 flex-wrap justify-end">
          ${Object.values(Wt).map(e=>`
            <span class="text-[9px] font-mono ${e.color} hidden sm:inline">${e.label}</span>
          `).join(``)}
        </div>
      </div>

      <div class="tree-wrap">
        <div class="tree-grid">
          ${[0,1,2,3,4].map(e=>`
            <div class="flex flex-col gap-1.5 min-w-0">
              <div class="label-caps text-center pb-0.5">T${e}</div>
              ${(d[e]||[]).map(e=>f(e)).join(``)}
            </div>
          `).join(``)}
        </div>
      </div>

      <p class="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed text-center">
        Los nodos se desbloquean de izquierda a derecha. Las ramas caras exigen
        dos nodos previos: la forja se planea, no se tapsa.
      </p>
    </section>
  `,m=Dn(e,kn({title:`Ascensión`,subtitle:`Núcleos y árbol de pasivas`,icon:`recycle`,onBack:n,state:o,actions:`
      <span class="inline-flex items-center gap-1 px-2.5 h-9 rounded-lg border border-[var(--border-color)]
                   text-[11px] font-mono accent-text"
            style="background: color-mix(in srgb, var(--accent) 10%, transparent)">
        ${i(`core`,`w-3.5 h-3.5`)} ${h(o.cores)}
      </span>
    `},p));On(m,{back:n,go:r}),oa(m,t,n,o,r)}function oa(e,t,n,r,i){let a=e.parentElement;a.querySelector(`#recycle-btn`)?.addEventListener(`click`,()=>{let e=Yt({totalNanitesProduced:r.totalNanitesProduced,totalCores:r.totalCores,coreGain:r.bonus.coreGain});e<=0||x(`Reciclarás todo tu progreso y ganarás ${e} núcleos. Recolectores, compañeros, nanitas, cajas y cristales se pierden.`,()=>{let e=t.prestige();e.success?(q.prestige(),S(`Ascendido: ${e.msg}`,`success`),aa(a,t,n,i)):S(e.msg,`error`)},{sublabel:`Confirmar reciclaje`,confirmText:`Reciclar`,danger:!0})}),a.querySelectorAll(`[data-node]`).forEach(e=>{e.addEventListener(`click`,()=>{let o=e.dataset.node,s=Ut[o];if(!s)return;let c=r.nodeLevels[o]||0,l=en(o,r.nodeLevels,r.cores),u=Wt[s.category],d=Object.entries(s.bonus).map(([e,t])=>na(e,t)).join(` · `)||`Desbloquea una función`;if(!l.ok){q.error(),S(l.reason??`No disponible`,`info`);return}x(`${s.name} — nivel ${c+1}/${s.maxLevel}. ${d}.`,()=>{let e=t.buyNode(o);e.success?(q.nodeBuy(),S(e.msg,`success`)):(q.error(),S(e.msg,`error`)),aa(a,t,n,i)},{sublabel:`${u?.label??`Nodo`} · nivel ${c+1}/${s.maxLevel}`,confirmText:`Comprar por ${Gt(s,c)} ◆`})})})}var sa=[{id:`base`,label:`Base`,icon:`chip`,inBottomBar:!0,inHeader:!0,title:`Panel Principal`},{id:`almacen`,label:`Almacén`,icon:`warehouse`,inBottomBar:!0,inHeader:!0,title:`Almacén`},{id:`forja`,label:`Forja`,icon:`anvil`,inBottomBar:!0,inHeader:!0,title:`Forja de Recolectores`},{id:`tienda`,label:`Mercado`,icon:`store`,inBottomBar:!0,inHeader:!0,title:`Mercado`},{id:`perfil`,label:`Perfil`,icon:`user`,inBottomBar:!0,inHeader:!0,title:`Perfil y Logros`},{id:`ranking`,label:`Ranking`,icon:`trophy`,inBottomBar:!1,inHeader:!0,title:`Ranking Global`},{id:`prestigio`,label:`Prestigio`,icon:`recycle`,inBottomBar:!1,inHeader:!1,title:`Ascensión`}],ca=sa.filter(e=>e.inBottomBar),la=sa.filter(e=>e.inHeader);function ua(e){return sa.find(t=>t.id===e)?.title??`Cyber Base`}var da=10,fa=class{stack=[`base`];listeners=new Set;get current(){return this.stack[this.stack.length-1]}goTo(e){if(e===this.current)return;let t=this.current;e===`base`?this.stack=[`base`]:(this.stack.push(e),this.stack.length>da&&this.stack.shift()),this.emit(t)}back(){if(this.stack.length<=1)return!1;let e=this.current;return this.stack.pop(),this.emit(e),!0}get history(){return this.stack}canGoBack(){return this.stack.length>1}onChange(e){return this.listeners.add(e),()=>this.listeners.delete(e)}emit(e){for(let t of this.listeners)t(this.current,e)}};function pa(e,t,n,r){let a=m.map(e=>`<option value="${e.value}" ${e.value===t?`selected`:``}>${e.label}</option>`).join(``),o=e=>{let t=ca.find(t=>t.id===e),r=n===e;return`
      <button data-nav="${e}"
        class="nav-item group flex flex-col items-center justify-center gap-1 flex-1 h-full cursor-pointer
               transition-colors duration-150 active:scale-95
               ${r?`text-[var(--accent)]`:`text-[var(--text-muted)]`}"
        style="min-height:44px" aria-label="${t.label}"
        ${r?`aria-current="page"`:``}>
        <span class="[&>span>svg]:w-[22px] [&>span>svg]:h-[22px] transition-transform duration-150
                     group-active:scale-90
                     ${r?`drop-shadow-[0_0_8px_var(--accent)]`:``}">
          ${i(t.icon)}
        </span>
        <span class="text-[9px] font-mono tracking-wide leading-none">${t.label}</span>
        ${r?`<span class="absolute top-0 w-6 h-[2px] rounded-full" style="background: var(--accent)"></span>`:``}
      </button>`};return`
    <div class="fixed inset-0 app-bg flex flex-col font-sans select-none overflow-hidden">

      <!-- ===================== CABECERA ===================== -->
      <header
        class="relative z-20 card-glass flex-shrink-0 px-3 md:px-5 py-2.5 md:py-3
               border-x-0 border-t-0 md:mx-4 md:mt-2 md:rounded-2xl md:border"
        style="padding-top: max(0.625rem, env(safe-area-inset-top))">

        <div class="flex items-center justify-between gap-3">
          <!-- Identidad -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="relative flex-shrink-0">
              <span class="block w-8 h-8 rounded-lg accent-bg flex items-center justify-center"
                    style="box-shadow: 0 0 18px -4px color-mix(in srgb, var(--accent) 70%, transparent)">
                ${i(`chip`,`w-[18px] h-[18px] text-slate-900`)}
              </span>
              <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full accent-bg border-2 animate-core-pulse"
                    style="border-color: var(--bg-app)"></span>
            </div>
            <div class="min-w-0">
              <div class="label-caps leading-none" id="page-title">${ua(n)}</div>
              <div id="nav-username"
                   class="font-['Orbitron'] font-bold text-[13px] md:text-sm accent-text truncate leading-tight mt-0.5">
                ${e.displayName||`Operativo`}
              </div>
            </div>
          </div>

          <!-- Navegación de escritorio -->
          <nav class="hidden lg:flex items-center gap-0.5 flex-shrink-0" aria-label="Navegación">
            ${la.map(e=>{let t=n===e.id;return`
                <button data-nav="${e.id}"
                  class="h-9 px-3 rounded-lg text-[11px] font-mono cursor-pointer transition flex items-center gap-1.5
                         ${t?`accent-bg text-slate-950 font-bold`:`btn-ghost text-[var(--text-muted)]`}"
                  aria-label="${e.title}">
                  <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(e.icon)}</span>
                  ${e.label}
                </button>`}).join(``)}
          </nav>

          <!-- HUD de buffs: fila con scroll, nunca agranda la cabecera -->
          <div id="active-buffs-hud"
               class="hidden xl:flex items-center gap-1.5 flex-nowrap min-w-0 overflow-x-auto py-0.5"></div>

          <!-- Controles -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button data-nav="ranking" title="Ranking"
              class="lg:hidden w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer"
              aria-label="Ranking">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`trophy`)}</span>
            </button>

            <!--
              AUDIO: los dos interruptores son independientes y cada uno lleva
              su PROPIO icono. Antes los dos pintaban el altavoz, así que en
              móvil —donde la etiqueta de texto no cabe— eran dos botones
              idénticos y no se sabía cuál era cuál.

                música -> nota musical  (lo que pone, no lo que suena)
                SFX    -> altavoz       (icono de parlante)

              Apagado baja al icono de silencio y el texto dice "Off": el
              estado se lee de un vistazo, sin depender del title, que en
              táctil no aparece hasta mantener pulsado.

              data-audio en vez de dos ids distintos: un solo manejador por
              delegación cubre los dos, y el estado se lee con querySelector
              sin acoplarse al id.
            -->
            <button id="music-btn" data-audio="music"
              aria-pressed="${Hn()}"
              aria-label="${Hn()?`Apagar música`:`Encender música`}"
              title="${Hn()?`Apagar música`:`Encender música`}"
              class="w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center
                     gap-1.5 cursor-pointer text-[11px] transition
                     ${Hn()?`text-[var(--text-main)]`:`text-[var(--text-muted)] opacity-70`}">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(Hn()?`music`:`mute`)}</span>
              <span class="hidden md:inline font-mono">${Hn()?`Música`:`Off`}</span>
            </button>

            <button id="mute-btn" data-audio="sfx"
              aria-pressed="${Vn()}"
              aria-label="${Vn()?`Silenciar efectos`:`Activar efectos`}"
              title="${Vn()?`Silenciar efectos`:`Activar efectos`}"
              class="w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center
                     gap-1.5 cursor-pointer text-[11px] transition
                     ${Vn()?`text-[var(--text-main)]`:`text-[var(--text-muted)] opacity-70`}">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(Vn()?`sound`:`mute`)}</span>
              <span class="hidden md:inline font-mono">${Vn()?`SFX`:`Off`}</span>
            </button>

            <select id="theme-selector" aria-label="Tema visual"
              class="hidden md:block app-bg border border-[var(--border-color)] rounded-lg px-2.5 h-9
                     text-[11px] font-mono text-[var(--text-main)] cursor-pointer hover:border-[var(--accent)]
                     transition-colors">
              ${a}
            </select>

            <!--
              El ancho fijo evita que la etiqueta se descentre cuando los botones
              de audio alternan entre "Música" y "Off", y hace que el botón
              "Salir" no parezca moverse respecto al resto de la cabecera.

              items-center es lo que lo centra de verdad: antes era inline-flex
              a secas, y el nodo de texto, al ser un ítem anónimo de flex, se
              estiraba a la altura completa y la línea se pegaba arriba.
            -->
            <button id="logout-btn" data-logout title="Cerrar sesión"
              class="hidden md:inline-flex h-9 w-24 shrink-0 items-center justify-center gap-1.5 rounded-lg
                     text-[11px] font-mono cursor-pointer
                     border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${i(`logout`)}</span>
              <span>Salir</span>
            </button>
          </div>
        </div>

        <!-- Buffs en móvil: bajo la cabecera, siempre visible -->
        <div id="buffs-hud-mobile"
             class="xl:hidden flex gap-1.5 overflow-x-auto mt-2 pb-0.5 empty:hidden -mx-1 px-1"></div>
      </header>

      <!-- ===================== ZONA DE JUEGO ===================== -->
      <main
        class="relative z-10 flex-grow min-h-0 w-full max-w-[68rem] mx-auto
               px-3 md:px-4 pt-2 md:pt-3 pb-2 md:pb-3
               grid grid-cols-1 lg:grid-cols-12 gap-2.5 md:gap-4
               overflow-y-auto lg:overflow-hidden overscroll-contain"
        style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))">

        <!-- ---------- Columna izquierda: el recolector ---------- -->
        <section class="lg:col-span-5 card-glass rounded-2xl md:rounded-3xl
                        flex flex-col items-center justify-center gap-3 md:gap-5
                        p-4 md:p-5 lg:p-6 text-center min-h-0
                        justify-center lg:justify-start lg:pt-10">

          <!-- Métrica principal: el número que importa -->
          <div class="flex-shrink-0 w-full">
            <div class="flex items-baseline justify-center gap-1.5">
              <span id="nanites-counter"
                    class="font-['Orbitron'] font-black text-[32px] md:text-4xl accent-text
                           tabular leading-none tracking-tight
                           [text-shadow:0_0_28px_color-mix(in_srgb,var(--accent)_35%,transparent)]">0</span>
            </div>
            <div class="label-caps mt-1.5 flex items-center justify-center gap-1.5">
              <span class="accent-text font-bold not-italic" aria-hidden="true">◆</span>
              <span>Nanitas</span>
            </div>
            <div id="passive-income-display"
                 class="text-[11px] md:text-xs font-mono mt-1.5 text-[var(--text-muted)] tabular
                       min-h-[16px] flex items-center justify-center text-center px-2">
              +0 /s
            </div>
            <!--
              Aviso de guardado pendiente.

              Sin esto, con la red caída el jugador ve su saldo crecer en pantalla
              sin ninguna pista de que el servidor no lo sabe. Cierra la pestaña y
              no tiene forma de saber si se guardó o no. El indicador solo aparece
              cuando hay algo de verdad sin confirmar, y desaparece en cuanto
              llega: no es un adorno, es el estado real de la partida.
            -->
            <div id="pending-save-indicator"
                 role="status" aria-live="polite"
                 class="hidden mt-2 text-[10px] font-mono text-amber-400/90 flex items-center
                        justify-center gap-1.5 px-2 py-1 rounded-lg border border-amber-500/30
                        bg-amber-500/10">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Sin guardar en el servidor</span>
            </div>
          </div>

          <!-- El botón: objetivo táctil grande y con respuesta táctil -->
          <button id="click-btn"
            class="relative rounded-full flex-shrink-0
                   w-32 h-32 md:w-40 md:h-40 lg:w-44 lg:h-44
                   max-h-[38vh] aspect-square
                   flex flex-col items-center justify-center gap-1.5 cursor-pointer
                   border-[3px] border-[var(--accent)] app-bg
                   transition-transform duration-100 ease-out active:scale-95
                   animate-core-breathe"
            style="box-shadow:
                   0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent),
                   0 0 44px -8px color-mix(in srgb, var(--accent) 55%, transparent),
                   inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent)"
            aria-label="Recolectar nanitas">
            <span class="absolute inset-2 rounded-full border border-[var(--accent)] opacity-25 animate-core-pulse pointer-events-none"></span>
            <span class="relative accent-text animate-pulse" style="animation-duration:2s">
              <span class="[&>span>svg]:w-9 [&>span>svg]:h-9">${i(`bolt`)}</span>
            </span>
            <span class="relative font-['Orbitron'] font-black text-[10px] md:text-xs
                         tracking-[0.2em] accent-text leading-none">RECOLECTAR</span>
          </button>

          <div id="click-damage-display"
               class="text-[11px] md:text-xs font-mono text-emerald-400 flex-shrink-0 tabular">
            +0 por click
          </div>

          <!-- Acceso rápido a la ascensión: el techo del juego tiene que ser
               alcanzable desde donde se pasa el 95% del tiempo -->
          <button data-nav="prestigio"
            class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost cursor-pointer
                   transition active:scale-95 w-full max-w-[16rem]"
            style="border-color: color-mix(in srgb, var(--accent) 35%, transparent)">
            <span class="accent-text flex-shrink-0 [&>span>svg]:w-4 [&>span>svg]:h-4">${i(`recycle`)}</span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block text-[10px] font-mono text-[var(--text-muted)] leading-none">Ascensión</span>
              <span class="block text-[11px] font-bold accent-text leading-tight mt-0.5" id="prestige-hint">
                0 núcleos
              </span>
            </span>
          </button>
        </section>

        <!-- ---------- Columna derecha: paneles ---------- -->
        <section class="lg:col-span-7 card-glass rounded-2xl md:rounded-3xl
                        flex flex-col min-h-0 overflow-hidden">
          <div class="flex items-center justify-between gap-2 px-4 md:px-5 py-3 flex-shrink-0
                      border-b border-[var(--border-color)]">
            <h2 class="font-['Orbitron'] font-bold text-[13px] md:text-sm accent-text
                       tracking-wide flex items-center gap-2">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`companion`)}</span>
              Escuadrón
            </h2>
            <span class="label-caps">Panel principal</span>
          </div>

          <div class="flex flex-col gap-2.5 md:gap-3 overflow-y-auto overscroll-contain
                      p-3 md:p-4 flex-grow min-h-0 -webkit-overflow-scrolling:touch">
            <!-- Recolector equipado -->
            <div class="app-bg border rounded-xl p-3 md:p-4 flex-shrink-0"
                 style="border-color: color-mix(in srgb, var(--accent) 45%, transparent);
                        background: linear-gradient(to bottom right,
                          color-mix(in srgb, var(--accent) 10%, transparent), transparent)">
              <div class="flex items-center gap-2 mb-2.5">
                <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 accent-text">${i(`collector`)}</span>
                <span class="label-caps" style="color: var(--accent)">Recolector</span>
              </div>
              <div id="equipped-collector-container"></div>
            </div>

            <!-- Compañeros -->
            <div class="app-bg border rounded-xl p-3 md:p-4 flex-shrink-0"
                 style="border-color: color-mix(in srgb, var(--accent) 30%, transparent);
                        background: linear-gradient(to bottom right,
                          color-mix(in srgb, var(--accent) 6%, transparent), transparent)">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="[&>span>svg]:w-4 [&>span>svg]:h-4 accent-text">${i(`companion`)}</span>
                  <span class="label-caps" style="color: var(--accent)">Compañeros</span>
                </div>
                <span id="slots-label" class="text-[10px] font-mono text-[var(--text-muted)] tabular"></span>
              </div>
              <div id="companions-slots-container" class="grid grid-cols-3 gap-2 md:gap-2.5"></div>
            </div>
          </div>
        </section>
      </main>

      <!-- ===================== NAVEGACIÓN INFERIOR (MÓVIL) ===================== -->
      <nav
        class="lg:hidden relative z-20 card-glass border-x-0 border-b-0 flex-shrink-0 px-1 pt-1.5 pb-1"
        style="padding-bottom: max(0.25rem, env(safe-area-inset-bottom))"
        aria-label="Navegación principal">
        <div class="flex items-stretch gap-0.5 relative">
          ${ca.map(e=>o(e.id)).join(``)}
        </div>
      </nav>

      <!-- Avisos de logro: por encima de todo, sin bloquear toques -->
      <div id="achievement-stack"
           class="fixed z-[70] left-1/2 -translate-x-1/2 flex flex-col gap-2 w-[min(92vw,22rem)]
                  pointer-events-none"
           style="bottom: calc(5.5rem + env(safe-area-inset-bottom))"></div>

      <!-- ===================== PANEL DE TEMA (MÓVIL) ===================== -->
      <div id="theme-sheet" class="lg:hidden fixed inset-0 z-40 hidden">
        <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" id="theme-sheet-overlay"></div>
        <div class="absolute bottom-0 left-0 right-0 card-glass-elevated rounded-t-2xl
                    p-5 pb-8 flex flex-col gap-3"
             style="padding-bottom: calc(2rem + env(safe-area-inset-bottom));
                    animation: riseIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both">
          <div class="flex items-center justify-between">
            <h3 class="font-['Orbitron'] font-bold text-sm accent-text">Tema visual</h3>
            <button id="close-theme-sheet" class="w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer"
                    aria-label="Cerrar">
              <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(`close`)}</span>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            ${m.map(e=>`
              <button data-theme-option="${e.value}"
                class="theme-option h-11 rounded-lg btn-ghost text-[11px] font-mono cursor-pointer
                       flex items-center justify-center gap-1.5 transition-colors"
                style="${e.value===t?`border-color:`+e.tone+`;color:`+e.tone:``}">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${e.tone}"></span>
                ${e.label}
              </button>
            `).join(``)}
          </div>
        </div>
      </div>
    </div>
  `}var Q=document.querySelector(`#app`),$=null,ma=null,ha=new fa,ga=new Set;function _a(){ga.forEach(e=>{try{e()}catch{}}),ga.clear()}function va(){ir(document.hidden)}var ya=[];function ba(){if(document.querySelector(`#achievement-stack`))for(;ya.length>0;)xa(ya.shift())}function xa(e){let t=document.querySelector(`#achievement-stack`);if(!t){ya.push(e);return}q.achievement();let n=document.createElement(`div`);for(n.className=`card-glass-elevated rounded-2xl px-4 py-2.5 flex items-center gap-3 w-full pointer-events-none`,n.style.borderColor=`var(--accent)`,n.style.cssText+=`animation: achievementIn 380ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--accent);`,n.innerHTML=`
    <span class="w-9 h-9 rounded-xl accent-bg flex items-center justify-center flex-shrink-0
                 [&>span>svg]:w-4 [&>span>svg]:h-4 text-slate-900">${a(e.icon)}</span>
    <span class="flex flex-col gap-0.5 min-w-0">
      <span class="label-caps" style="color: var(--accent)">Logro desbloqueado</span>
      <span class="font-['Orbitron'] font-bold text-[13px] text-[var(--text-main)] truncate">${e.title}</span>
      <span class="text-[10px] font-mono text-[var(--text-muted)] truncate">${e.rewardText}</span>
    </span>
  `,t.appendChild(n);t.children.length>3;)t.firstElementChild?.remove();setTimeout(()=>{n.style.transition=`opacity 350ms ease, transform 350ms ease`,n.style.opacity=`0`,n.style.transform=`translateY(12px) scale(0.97)`,setTimeout(()=>n.remove(),380)},3e3)}l(b()),document.addEventListener(`contextmenu`,e=>e.preventDefault()),sr();var Sa=`Operativo`,Ca=null;function wa(e,t){let n=[t,(()=>{try{return sessionStorage.getItem(`cyberforge_username`)}catch{return null}})(),e?.displayName,ma?.displayName].filter(e=>typeof e==`string`&&e.trim().length>0)[0]??Sa;if(Ca=n,n!==Sa)try{sessionStorage.setItem(`cyberforge_username`,n)}catch{}return n===Sa&&console.warn(`[auth] No se ha podido determinar el nombre de usuario; se usa "`+Sa+`".`,e),n}async function Ta(e){if(!Da&&!Ea){if(Ea=!0,console.info(`[auth] Volviendo al acceso`+(e?`: `+e:``)+`.`),_a(),Xa(),$?.cleanup)try{await $.cleanup()}catch{}$=null,ma=null,Ca=null;try{sessionStorage.removeItem(`cyberforge_username`)}catch{}setTimeout(()=>{Ea=!1,Re(Q,(e,t)=>{Aa(e,t)})},120)}}var Ea=!1,Da=!1;async function Oa(e,t){if(Da)return!0;let n=await He(e);if(!n.bloqueado)return!1;Da=!0,console.warn(`[bloqueo] Cuenta suspendida:`,t,`-`,n.motivo);try{$?.flush?.()}catch(e){console.warn(`[bloqueo] No se ha podido guardar antes de bloquear:`,e)}if(_a(),Xa(),$?.cleanup)try{await $.cleanup()}catch{}$=null,ma=null,Ca=null;try{sessionStorage.removeItem(`cyberforge_username`)}catch{}try{await g(u)}catch{}return D(Q,{nombre:t,motivo:n.motivo,desde:n.desde}),!0}function ka(){if(document.hidden)return;let e=ma?.uid;e&&!Da&&Oa(e,Ca||Sa).then(e=>{e&&console.info(`[bloqueo] Sesión cerrada al volver a la pestaña.`)})}r(u,async e=>{if(!e){await Ta();return}if($&&ma?.uid===e.uid)return;let t=sessionStorage.getItem(`pending_username`);t&&sessionStorage.removeItem(`pending_username`);let n=wa(e,t??void 0);await Oa(e.uid,n)||await Aa(e,n)});async function Aa(e,t){ma=e,$=await Tn(e,(e,t)=>{Pa(e,t??!1)},t,e=>{xa(e)}),requestAnimationFrame(()=>{ja(ha.current),Ya($),ba()})}function ja(e){if(!$)return;Q.innerHTML=``,Q.removeAttribute(`style`),Q.onclick=null,document.body.setAttribute(`data-theme`,b()),ue(),_a();let t=()=>{q.nav(),ha.back()||ha.goTo(`base`),ja(ha.current)},n=e=>{q.nav(),ha.goTo(e),ja(ha.current)};switch(e){case`base`:Ma(n,t);break;case`almacen`:Br(Q,$,t,()=>{Pa($.getState(),$.isAfk())},n);break;case`forja`:Gi(Q,$,t,n);break;case`tienda`:Li(Q,$,t,n);break;case`perfil`:ta(Q,$,t,()=>n(`prestigio`),n);break;case`ranking`:xi(Q,ma,t,n);break;case`prestigio`:aa(Q,$,t,n)}y()}function Ma(e,t){let n=$;Q.innerHTML=pa(ma,b(),ha.current,{onNavigate:e,onLogout:()=>void Na(),onToggleMute:()=>qn(),onToggleMusic:()=>Jn(),onThemeChange:e=>ee(e)}),Q.onclick=t=>{let n=t.target,r=n.closest(`[data-audio]`);if(r){t.preventDefault(),r.dataset.audio===`music`?Jn():qn();return}if(n.closest(`[data-logout]`)){t.preventDefault(),Na();return}let i=n.closest(`[data-nav]`);i&&(t.preventDefault(),q.nav(),e(i.dataset.nav))};let r=()=>{let e=Hn(),t=Vn(),n=document.querySelector(`#music-btn`);n&&(n.innerHTML=`<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(e?`music`:`mute`)}</span><span class="hidden md:inline font-mono">${e?`Música`:`Off`}</span>`,n.className=e?`w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]`:`w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70`,n.setAttribute(`aria-pressed`,String(e)),n.setAttribute(`aria-label`,e?`Apagar música`:`Encender música`),n.setAttribute(`title`,e?`Apagar música`:`Encender música`));let r=document.querySelector(`#mute-btn`);r&&(r.innerHTML=`<span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${i(t?`sound`:`mute`)}</span><span class="hidden md:inline font-mono">${t?`SFX`:`Off`}</span>`,r.className=t?`w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-main)]`:`w-9 h-9 md:w-auto md:h-9 md:px-2.5 rounded-lg btn-ghost flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition text-[var(--text-muted)] opacity-70`,r.setAttribute(`aria-pressed`,String(t)),r.setAttribute(`aria-label`,t?`Silenciar efectos`:`Activar efectos`),r.setAttribute(`title`,t?`Silenciar efectos`:`Activar efectos`))},a=zn(r);ga.add(a),r();let o=0,s=null;document.querySelector(`#click-btn`)?.addEventListener(`click`,e=>{let t=e;ar(),o++,q.click(o),s&&clearTimeout(s),s=window.setTimeout(()=>{o=0},1200);let r=n.click();Ga(1),Ba(t.clientX,t.clientY,`+${h(r)}`)});let c=e=>{let t=e.target.closest(`[data-cancel]`)?.getAttribute(`data-cancel`);t&&(e.stopPropagation(),x(`Se pierde el tiempo restante de ${de(t)}. El item ya está gastado.`,()=>{let e=$?.cancelBuff?.(t);e&&S(`${e} cancelado`,`info`)},{sublabel:`Cancelar buff`,confirmText:`Cancelar buff`,danger:!0}))};document.querySelector(`#active-buffs-hud`)?.addEventListener(`click`,c),document.querySelector(`#buffs-hud-mobile`)?.addEventListener(`click`,c);let l=document.querySelector(`#theme-sheet`),u=()=>l?.classList.remove(`hidden`),d=()=>l?.classList.add(`hidden`);document.querySelector(`#theme-btn-mobile`)?.addEventListener(`click`,u),document.querySelector(`#close-theme-sheet`)?.addEventListener(`click`,d),document.querySelector(`#theme-sheet-overlay`)?.addEventListener(`click`,d),l?.querySelectorAll(`[data-theme-option]`).forEach(e=>{e.addEventListener(`click`,()=>{ee(e.getAttribute(`data-theme-option`)),d()})});let f=document.querySelector(`#theme-selector`);f&&(f.value=b()),f?.addEventListener(`change`,e=>ee(e.target.value)),document.removeEventListener(`visibilitychange`,va),document.addEventListener(`visibilitychange`,va),document.removeEventListener(`visibilitychange`,ka),document.addEventListener(`visibilitychange`,ka);let p=n.getState();Pa(p,n.isAfk()),Fa(p),requestAnimationFrame(()=>{Pa(n.getState(),n.isAfk()),Fa(n.getState())})}async function Na(){Xa();try{$?.flush&&$.flush()}catch(e){console.warn(`[auth] No se ha podido guardar antes de salir:`,e)}await g(u),await Ta(`cierre de sesión manual`)}window.updateGameUI=e=>{let t=e||$?.getState();t&&Pa(t,$?.isAfk()||!1)};function Pa(e,t=!1){let n=document.querySelector(`#nanites-counter`),r=document.querySelector(`#passive-income-display`),i=document.querySelector(`#click-damage-display`);if($&&typeof $.drainClickEvents==`function`)for(let e of $.drainClickEvents())Ka(e.cantidad);let a=h(e.nanites||0);n&&(n.textContent=a);for(let e of[`#page-nanites-val`,`#wh-nanites-val`,`#store-nanites`,`#profile-nanites`]){let t=document.querySelector(e);t&&(t.textContent=a)}let o=Date.now(),s=Math.max(0,e.buffs.passiveBoostExpiresAt-o)>0,c=typeof $?.isPresent!=`function`||$.isPresent();if(r){if(!c)r.innerHTML=`<span class="text-amber-500">En pausa — vuelve a la ventana para cobrar</span>`;else{let n=t&&!s?0:e.passiveIncome;r.textContent=`+${h(n)} Nanitas / segundo`}}if(i){let e=typeof $?.getClickDamage==`function`?$.getClickDamage():0;i.textContent=`+${h(e)} Nanitas por click`}let l=document.querySelector(`#prestige-hint`);if(l){let t=$?.getPrestigeInfo?.()?.pending??0;l.textContent=e.cores>0?`${h(e.cores)} núcleos disponibles`:t>0?`Reciclar: +${h(t)} núcleos`:`0 núcleos`}le(e,o),document.querySelector(`#equipped-collector-container`)&&Fa(e)}function Fa(e){Le(e,typeof $?.getClickDamage==`function`?$.getClickDamage():0,typeof $?.getCompanionSlots==`function`?$.getCompanionSlots():void 0,typeof $?.getCompanionOutput==`function`?e=>$.getCompanionOutput(e):void 0,typeof $?.getClickDamageBreakdown==`function`?()=>$.getClickDamageBreakdown():void 0)}var Ia=1150,La=1750,Ra=[],za=12;function Ba(e,t,n,r=`var(--accent)`,i=Ia){for(;Ra.length>=za;)Ra.shift()?.remove();let a=document.createElement(`div`);a.textContent=n,a.style.cssText=`
    position: fixed;
    left: ${e}px;
    top: ${t}px;
    transform: translate(-50%, -50%);
    color: ${r};
    font-family: 'Orbitron', sans-serif;
    font-weight: 900;
    font-size: 16px;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
    text-shadow: 0 0 10px ${r}, 0 0 2px ${r}, 0 1px 3px rgba(0, 0, 0, 0.9);
    animation: floatUp ${i}ms linear forwards;
  `,a.setAttribute(`data-float-text`,``),document.body.appendChild(a),Ra.push(a);let o=()=>{a.remove();let e=Ra.indexOf(a);e!==-1&&Ra.splice(e,1)};a.addEventListener(`animationend`,o,{once:!0}),window.setTimeout(o,i+600)}var Va=[{transform:`scale(1)`,offset:0,easing:`cubic-bezier(0.2, 0, 0.4, 1)`},{transform:`scale(0.9)`,offset:.16,easing:`cubic-bezier(0.2, 0.9, 0.35, 1)`},{transform:`scale(1.07)`,offset:.46,easing:`ease-in-out`},{transform:`scale(0.985)`,offset:.72,easing:`linear`},{transform:`scale(1)`,offset:1}],Ha=[{transform:`scale(0.72)`,opacity:.85,offset:0},{transform:`scale(1.12)`,opacity:.4,offset:.4},{transform:`scale(1.5)`,opacity:0,offset:1}],Ua=null,Wa=[];function Ga(e=1){let t=document.querySelector(`#click-btn`);if(!t)return;let n=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;if(n&&(e=Math.min(e,.35)),Ua?.cancel(),Ua=t.animate(Va.map(t=>({transform:`scale(${(1+(parseFloat(t.transform.slice(6))-1)*e).toFixed(4)})`,offset:t.offset,easing:t.easing})),{duration:240+80*e,easing:`linear`}),n)return;let r=Wa.pop();r||(r=document.createElement(`span`),r.setAttribute(`aria-hidden`,`true`),r.className=`hit-wave`,t.prepend(r)),r.getAnimations().forEach(e=>e.cancel()),r.animate(Ha,{duration:460+160*e,easing:`cubic-bezier(0.16, 1, 0.3, 1)`}),window.setTimeout(()=>{Wa.length<4&&Wa.push(r)},700+160*e)}function Ka(e){let t=document.querySelector(`#click-btn`);if(!t)return;let n=t.getBoundingClientRect();Ba(n.left+40+Math.random()*(n.width-80),n.top+40+Math.random()*(n.height-80),`+${h(e)}`,`var(--accent)`,La),Ga(.62)}var qa=null;function Ja(e){document.hidden||document.querySelector(`#click-btn`)&&(typeof e.getAnunciablesIngreso==`function`?e.getAnunciablesIngreso():e.getState().activeCompanions.map(t=>e.getState().companions.find(e=>e.id===t)).filter(e=>e&&e.type===`click`).map(e=>({id:e.id,cantidad:e.power}))).forEach((e,t)=>{setTimeout(()=>{Ka(e.cantidad)},t*100)})}function Ya(e){qa&&clearInterval(qa),qa=window.setInterval(()=>Ja(e),1e3)}function Xa(){qa&&=(clearInterval(qa),null)}