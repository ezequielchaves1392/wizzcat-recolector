import{E as e,M as t,O as n,S as r,_ as i,a,b as o,c as s,d as c,f as l,g as u,h as d,j as f,k as p,l as m,m as h,o as ee,p as te,r as ne,t as g,u as _,v as re,x as v,y as ie}from"./toast-CLH3vizD.js";var y=`users`,b=`rankings`,x=`bloqueos`,ae=`admins`,oe=200,se=400;function S(e){let t=Number(e);return Number.isFinite(t)?t:0}function ce(e){if(e==null)return 0;if(typeof e==`number`)return e;if(typeof e==`string`){let t=Date.parse(e);return Number.isNaN(t)?0:t}return typeof e.toMillis==`function`?e.toMillis():typeof e.seconds==`number`?e.seconds*1e3:0}function le(e,t){let n=Array.isArray(t.warehouse)?t.warehouse:[],r=Array.isArray(t.companions)?t.companions:[];return{uid:e,username:String(t.username||t.userId||e),nanites:S(t.nanites),totalNanitesProduced:S(t.totalNanitesProduced??t.nanites),totalClicks:S(t.totalClicks),cores:S(t.cores),items:n.length,companeros:r.length,actualizado:ce(t.updatedAt),bruto:t}}async function ue(e){let t=[],n=null;for(;;){let r=[i(te()),u(oe)];n&&r.unshift(o(n));let a=await d(re(_(m,y),...r));if(a.empty||(a.forEach(e=>t.push(le(e.id,e.data()))),e?.(t.length),a.size<oe))break;n=a.docs[a.docs.length-1].id}return t.sort((e,t)=>t.nanites-e.nanites),t}async function C(e,t){let n=l(m,b,e);(await h(n)).exists()&&await v(n,{score:Math.floor(t)})}async function de(e,t){let n=l(m,y,e),r=await h(n);if(!r.exists())throw Error(`Ese operativo ya no está en la base de datos.`);let i=r.data(),a=S(i.nanites),o=Math.max(0,Math.floor(a+t));return await v(n,{nanites:o,totalNanitesProduced:Math.max(0,Math.floor(S(i.totalNanitesProduced??i.nanites)+t))}),await C(e,o),o}async function fe(e,t){let n=l(m,y,e),r=await h(n);if(!r.exists())throw Error(`Ese operativo ya no está en la base de datos.`);let i=r.data(),a=Math.max(0,Math.floor(t));return await v(n,{nanites:a,totalNanitesProduced:Math.max(a,S(i.totalNanitesProduced))}),await C(e,a),a}var pe=[{campo:`keys`,etiqueta:`Llaves`},{campo:`upgradeCrystals`,etiqueta:`Cristales de mejora`},{campo:`warehouseCapacity`,etiqueta:`Capacidad del almacén`},{campo:`maxCompanionSlots`,etiqueta:`Huecos de compañero`},{campo:`cratesOpened`,etiqueta:`Cajas abiertas`},{campo:`totalClicks`,etiqueta:`Clics totales`},{campo:`cores`,etiqueta:`Núcleos`},{campo:`totalCores`,etiqueta:`Núcleos totales`},{campo:`shards`,etiqueta:`Esquirlas`}];async function me(e,t,n){let r=l(m,y,e);if(!(await h(r)).exists())throw Error(`Ese operativo ya no está en la base de datos.`);await v(r,{[t]:Math.max(0,Math.floor(n))})}async function he(e){await Promise.all([c(l(m,y,e)),c(l(m,b,e))])}async function ge(e){let t=[],n=0;for(let a of[y,b,x]){let s=null,l=null;for(;;){let f=[i(te()),u(se)];s&&f.unshift(o(s));let p=await d(re(_(m,a),...f));if(p.empty)break;let h=r(m);p.docs.forEach(e=>h.delete(e.ref));try{await h.commit(),n+=p.size}catch{for(let e of p.docs)try{await c(e.ref),n+=1}catch(n){l=`${a}/${e.id}: ${n?.message||n}`,t.push(l)}}e?.({fase:a,borrados:n,total:n,ultimoError:l}),s=p.docs[p.docs.length-1].id}}return e?.({fase:`rankings`,borrados:n,total:n,ultimoError:null}),{total:n,errores:t}}async function _e(e,t,n){let r=l(m,x,e);await ie(r,{uid:e,activo:!0,motivo:(t||``).trim()||`Cuentasuspendida por un administrador.`,desde:Date.now(),puestoPor:n,quitadoPor:``},{merge:!0})}async function ve(e,t){let n=l(m,x,e);await ie(n,{uid:e,activo:!1,quitadoPor:t,desde:0},{merge:!0})}async function ye(){let e={};return(await d(_(m,x))).forEach(t=>{let n=t.data();e[t.id]={uid:t.id,activo:n.activo===!0,motivo:String(n.motivo||``),desde:ce(n.desde),puestoPor:String(n.puestoPor||``),quitadoPor:String(n.quitadoPor||``)}}),e}async function be(e){try{return(await h(l(m,ae,e))).exists()}catch(e){return console.warn(`[admin] No se ha podido comprobar el rol de administrador; se permite el acceso.`,e),!0}}async function xe(e){await c(l(m,x,e))}function Se(e){return(e||`Común`).toLowerCase().normalize(`NFD`).replace(/[\u0300-\u036f]/g,``)}var w={comun:`#94a3b8`,raro:`#60a5fa`,epico:`#c084fc`,legendario:`#fbbf24`,mitico:`#fb7185`,divino:`#fde047`,sobrecargado:`#f0abfc`};function T(e){return w[Se(e)]||w.comun}var E=[],Ce=document.querySelector(`#app`),D=null,O=null,k=[],A=!1,j=``,M=`nanites`,N=`operativos`,P=!1,F=!1,I=null,L=null,R={},z=`BORRAR TODO`;function B(e){return String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e])}function V(e){if(!e)return`sin guardado`;let t=Math.max(0,Math.floor((Date.now()-e)/1e3));if(t<60)return`hace ${t} s`;let n=Math.floor(t/60);if(n<60)return`hace ${n} min`;let r=Math.floor(n/60);if(r<24)return`hace ${r} h`;let i=Math.floor(r/24);return i<30?`hace ${i} d`:new Date(e).toLocaleDateString(`es-ES`)}function H(e){if(e==null)return e;if(typeof e?.toDate==`function`)return e.toDate().toISOString();if(Array.isArray(e))return e.map(H);if(typeof e==`object`){let t={};for(let[n,r]of Object.entries(e))t[n]=H(r);return t}return e}var U=e=>document.querySelector(e),we={collector:`collector`,companion:`companion`,crate:`crate`,key:`key`,crystal:`crystal`,consumable:`flask`},Te={collector:`Recolector`,companion:`Compañero`,crate:`Caja`,key:`Llave`,crystal:`Cristal`,consumable:`Consumible`};function W(e,t,n,r=``){return`<button type="button" data-accion="${e}" ${r}
    class="${n}">${t}</button>`}function G(e=``,r=`error`){Ce.innerHTML=`
    <div class="min-h-dvh flex items-center justify-center p-4 app-bg">
      <div class="w-full max-w-sm card-glass rounded-3xl p-6 flex flex-col gap-4">
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="w-12 h-12 rounded-2xl accent-bg grid place-items-center text-slate-950">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${t(`lock`)}</span>
          </div>
          <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.15em] accent-text">
            TERMINAL DE ADMINISTRACIÓN
          </h1>
          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            Acceso con una cuenta de Cyber-Forge.<br />La sesión es la misma que la del juego.
          </p>
        </div>

        <div id="login-error" role="alert"
             class="${e?``:`hidden`} rounded-xl border px-3 py-2.5 text-[11px] font-mono leading-relaxed
                    ${r===`error`?`border-red-500/40 bg-red-500/10 text-red-300`:`border-cyan-500/40 bg-cyan-500/10 text-cyan-200`}">${B(e)}</div>

        <form id="login-form" class="flex flex-col gap-3" novalidate>
          <div class="flex flex-col gap-1.5">
            <label for="login-user" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
              NOMBRE DE OPERATIVO
            </label>
            <input type="text" id="login-user" autocomplete="username" maxlength="24" spellcheck="false"
                   class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                          text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                          placeholder:text-[var(--text-muted)]"
                   placeholder="admin" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="login-pass" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
              CONTRASEÑA
            </label>
            <input type="password" id="login-pass" autocomplete="current-password"
                   class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                          text-[13px] font-mono text-[var(--text-main)] focus:outline-none
                          placeholder:text-[var(--text-muted)]"
                   placeholder="Mínimo 6 caracteres" />
          </div>
          <button type="submit" id="login-btn"
                  class="mt-1 py-3 accent-bg hover:opacity-90 text-slate-950 font-['Orbitron'] font-bold
                         text-[12px] rounded-xl accent-glow cursor-pointer tracking-[0.15em]
                         disabled:opacity-60 disabled:cursor-not-allowed">
            ENTRAR
          </button>
        </form>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed text-center">
          Esta pantalla no va a producción sin reglas en Firestore: quien pueda
          escribir en la base de datos puede usar todo lo que hay debajo.
        </p>
      </div>
    </div>
  `;let i=U(`#login-form`),a=U(`#login-user`),o=U(`#login-pass`),c=U(`#login-btn`),l=U(`#login-error`),u=localStorage.getItem(`cyberforge_admin_user`);a&&u&&(a.value=u),i?.addEventListener(`submit`,async e=>{e.preventDefault();let t=(a?.value||``).trim(),r=o?.value||``,i=e=>{l&&(l.textContent=e,l.classList.remove(`hidden`))};if(t.length<3)return i(`El nombre necesita al menos 3 letras o números.`);if(r.length<6)return i(`La contraseña necesita al menos 6 caracteres.`);let u=t.toLowerCase().replace(/[^a-z0-9]/g,``)+`@cyberforge.game`;c.disabled=!0,c.textContent=`VERIFICANDO…`;try{localStorage.setItem(`cyberforge_admin_user`,t),await n(s,u,r)}catch(e){c.disabled=!1,c.textContent=`ENTRAR`;let t=String(e?.code||``);i(t.includes(`invalid-credential`)||t.includes(`user-not-found`)?`Nombre o contraseña incorrectos.`:t.includes(`too-many-requests`)?`Demasiados intentos. Espera un momento.`:String(e?.message||`No se ha podido completar el acceso.`).replace(/^Firebase:\s*/i,``).replace(/\s*\(auth\/[^)]+\)\.?$/,``))}}),a?.focus()}function Ee(e){return E.length===0||E.includes(e)}function De(){Ce.innerHTML=`
    <div class="min-h-dvh flex flex-col app-bg">

      <header class="sticky top-0 z-30 border-b border-[var(--border-color)] backdrop-blur-xl
                     bg-slate-950/80">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div class="w-9 h-9 rounded-xl accent-bg grid place-items-center text-slate-950 flex-shrink-0">
            <span class="[&>span>svg]:w-5 [&>span>svg]:h-5">${t(`shield`)}</span>
          </div>
          <div class="mr-auto min-w-0">
            <h1 class="font-['Orbitron'] font-black text-[13px] tracking-[0.15em] accent-text leading-none">
              TERMINAL DE ADMINISTRACIÓN
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] mt-1 truncate">
              <span id="sesion-nombre">—</span>
            </p>
          </div>

          <div class="flex items-center gap-1 p-1 rounded-xl border border-[var(--border-color)]
                      app-bg">
            <button type="button" data-pestana="operativos" class="admin-tab">Operativos</button>
            <button type="button" data-pestana="base" class="admin-tab">Base de datos</button>
          </div>

          <button type="button" id="btn-refrescar"
                  class="px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg
                         text-[10px] font-mono text-[var(--text-main)] hover:border-[var(--accent)]
                         transition cursor-pointer flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${t(`recycle`)}</span>
            Refrescar
          </button>
          <button type="button" id="btn-salir"
                  class="px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg
                         text-[10px] font-mono text-[var(--text-muted)] hover:text-red-300
                         hover:border-red-500/50 transition cursor-pointer flex items-center gap-1.5">
            <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${t(`logout`)}</span>
            Salir
          </button>
        </div>
      </header>

      <main class="max-w-7xl w-full mx-auto px-4 py-5 flex-1">

        <!-- Pestaña de operativos -->
        <section id="panel-operativos" class="grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 items-start">
          <div class="card-glass rounded-2xl p-3 flex flex-col gap-3 lg:sticky lg:top-20">
            <div class="flex flex-col gap-2">
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]
                             [&>span>svg]:w-4 [&>span>svg]:h-4">${t(`eye`)}</span>
                <input type="search" id="buscar" placeholder="Buscar por nombre o UID"
                       class="w-full app-bg border border-[var(--border-color)] rounded-xl pl-9 pr-3 py-2.5
                              text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]" />
              </div>
              <div class="flex items-center gap-1.5 text-[10px] font-mono">
                <span class="text-[var(--text-muted)] mr-1">Orden</span>
                <button type="button" data-orden="nanites" class="admin-chip">Nanitas</button>
                <button type="button" data-orden="nombre" class="admin-chip">Nombre</button>
                <button type="button" data-orden="guardado" class="admin-chip">Guardado</button>
              </div>
            </div>
            <div id="lista" class="flex flex-col gap-1.5 max-h-[calc(100dvh-15rem)] overflow-y-auto pr-0.5"></div>
          </div>

          <div id="detalle" class="min-w-0"></div>
        </section>

        <!-- Pestaña de borrado masivo -->
        <section id="panel-base" class="hidden max-w-2xl"></section>
      </main>
    </div>
  `,document.querySelectorAll(`[data-pestana]`).forEach(e=>{e.addEventListener(`click`,()=>Oe(e.dataset.pestana))}),document.querySelectorAll(`[data-orden]`).forEach(e=>{e.addEventListener(`click`,()=>{M=e.dataset.orden,K(),ke()})}),U(`#btn-refrescar`)?.addEventListener(`click`,()=>q(!0)),U(`#btn-salir`)?.addEventListener(`click`,async()=>{await p(s)});let e=U(`#buscar`);e?.addEventListener(`input`,()=>{j=e.value.trim(),K()}),U(`#detalle`)?.addEventListener(`click`,e=>{let t=e.target.closest(`[data-accion]`);t&&Ae(t.dataset.accion,t)}),U(`#panel-base`)?.addEventListener(`click`,e=>{let t=e.target.closest(`[data-accion]`);t&&Me(t.dataset.accion)}),U(`#panel-base`)?.addEventListener(`input`,e=>{e.target.id===`confirmacion`&&je()});let n=D?.displayName||D?.email?.split(`@`)[0]||`administrador`,r=U(`#sesion-nombre`);r&&(r.textContent=`Sesión: ${n} · ${D?.uid||``}`),E.length===0&&g(`Modo local: ADMIN_UIDS está vacío, así que esta comprobación no filtra a nadie.`,`info`),ke(),Oe(N),q()}function Oe(e){N=e,U(`#panel-operativos`)?.classList.toggle(`hidden`,e!==`operativos`),U(`#panel-base`)?.classList.toggle(`hidden`,e!==`base`),document.querySelectorAll(`[data-pestana]`).forEach(t=>{t.classList.toggle(`admin-tab-on`,t.dataset.pestana===e)}),e===`base`&&$()}function ke(){document.querySelectorAll(`[data-orden]`).forEach(e=>{e.classList.toggle(`admin-chip-on`,e.dataset.orden===M)})}function K(){let e=U(`#lista`);if(!e)return;if(A){e.innerHTML=`<p class="text-[11px] font-mono text-[var(--text-muted)] p-4 text-center">
      Leyendo la base de datos…</p>`;return}let t=k;if(j){let e=j.toLowerCase();t=t.filter(t=>t.username.toLowerCase().includes(e)||t.uid.toLowerCase().includes(e))}if(t=t.slice().sort((e,t)=>M===`nombre`?e.username.localeCompare(t.username,`es`):M===`guardado`?t.actualizado-e.actualizado:t.nanites-e.nanites),!t.length){e.innerHTML=`<p class="text-[11px] font-mono text-[var(--text-muted)] p-4 text-center">
      ${k.length?`Ningún operativo coincide con la búsqueda.`:`No hay ningún operativo guardado.`}
    </p>`;return}e.innerHTML=t.map(e=>{let t=e.uid===O?.uid,n=e.username.trim().charAt(0).toUpperCase()||`?`,r=R[e.uid]?.activo;return`
      <button type="button" data-uid="${B(e.uid)}"
        class="text-left w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition cursor-pointer
               ${t?`border-[var(--accent)] bg-[var(--accent)]/10`:`border-[var(--border-color)] hover:border-[var(--accent)]/60`}">
        <span class="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 relative
                     ${t?`accent-bg text-slate-950`:`app-bg text-[var(--text-muted)] border border-[var(--border-color)]`}
                     font-['Orbitron'] font-bold text-[13px]">
          ${B(n)}
          ${r?`
            <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500
                         ring-2 ring-[var(--bg-app)]"
                  title="Cuenta bloqueada"></span>
          `:``}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-mono ${r?`text-red-300`:`text-[var(--text-main)]`} truncate">
            ${B(e.username)}
          </span>
          <span class="block text-[9px] font-mono truncate">
            ${r?`<span class="text-red-400">BLOQUEADO</span>`:`<span class="text-[var(--text-muted)]">${e.items} objs · ${e.companeros} comp. · ${B(V(e.actualizado))}</span>`}
          </span>
        </span>
        <span class="font-mono text-[11px] flex-shrink-0 ${r?`text-[var(--text-muted)]`:`accent-text`}">
          ${f(e.nanites)}
        </span>
      </button>
    `}).join(``),e.querySelectorAll(`[data-uid]`).forEach(e=>{e.addEventListener(`click`,()=>{O=k.find(t=>t.uid===e.dataset.uid)||null,K(),X()})})}async function q(e=!1){if(!A){A=!0,K();try{k=await ue(),O&&!k.some(e=>e.uid===O.uid)&&(O=null),e&&g(`${k.length} operativos cargados.`,`success`)}catch(e){console.error(e),k=[],O=null,g(`No se ha podido leer la base de datos: ${J(e)}`,`error`)}try{R=await ye()}catch(e){console.error(e),R={},g(`No se han podido leer los bloqueos: puede que las reglas de Firestore lo impidan.`,`error`)}finally{A=!1,K(),X(),N===`base`&&$()}}}function J(e){let t=String(e?.code||``);return t.includes(`permission-denied`)?`las reglas de Firestore no permiten esta operación (permission-denied)`:t.includes(`unavailable`)?`no hay conexión con el servidor`:e?.message||String(e)}function Y(e,t,n=``){return`
    <div class="rounded-xl border border-[var(--border-color)] app-bg px-3 py-2">
      <p class="text-[9px] font-mono text-[var(--text-muted)] tracking-wider uppercase">${e}</p>
      <p class="text-[13px] font-mono text-[var(--text-main)] mt-0.5 truncate ${n}">${t}</p>
    </div>
  `}function X(){let e=U(`#detalle`);if(!e)return;if(!O){e.innerHTML=`
      <div class="card-glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <span class="text-[var(--text-muted)] [&>span>svg]:w-10 [&>span>svg]:h-10">${t(`user`)}</span>
        <p class="text-[12px] font-mono text-[var(--text-main)]">Elige un operativo de la lista</p>
        <p class="text-[10px] font-mono text-[var(--text-muted)] max-w-sm leading-relaxed">
          Podrás ver su inventario, darle nanitas o borrar su partida.
        </p>
      </div>
    `;return}let n=O,r=n.bruto,i=Array.isArray(r.warehouse)?r.warehouse:[],a=Array.isArray(r.companions)?r.companions:[],o=r.crates&&typeof r.crates==`object`?r.crates:{},s=R[n.uid],c=s?.activo?`
      <div class="rounded-2xl border border-red-500/50 bg-red-500/5 p-3.5 flex flex-col gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-red-400 [&>span>svg]:w-4 [&>span>svg]:h-4">${t(`lock`)}</span>
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-red-300">
            CUENTA BLOQUEADA
          </h3>
          ${s.desde?`
            <span class="text-[9px] font-mono text-[var(--text-muted)] ml-auto">
              desde ${B(V(s.desde))}
            </span>
          `:``}
        </div>

        <div class="rounded-xl border border-[var(--border-color)] app-bg px-3 py-2.5">
          <p class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            Motivo que ve el jugador
          </p>
          <p class="text-[12px] font-sans text-[var(--text-main)] mt-1 break-words">
            ${B(s.motivo||`Sin motivo registrado.`)}
          </p>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          El juego no le cargará. Si tiene la partida abierta en otra pestaña, se le
          cerrará la sesión en cuanto vuelva a mirar la pantalla.
          ${s.puestoPor?`<br />Bloqueado por ${B(s.puestoPor)}.`:``}
        </p>

        ${W(`desbloquear`,`LEVANTAR BLOQUEO`,`self-start px-4 h-10 rounded-xl btn-primary font-['Orbitron'] font-bold text-[11px] cursor-pointer transition`,`tracking-[0.08em]`)}
      </div>
    `:`
      <div class="rounded-2xl border border-[var(--border-color)] app-bg p-3.5 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-[var(--text-muted)] [&>span>svg]:w-4 [&>span>svg]:h-4">${t(`lock`)}</span>
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-[var(--text-main)]">
            BLOQUEAR CUENTA
          </h3>
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          El juego dejará de cargarse para ${B(n.username)} y le mostrará el motivo
          que escribas abajo. No le cierra la sesión al instante en otros
          dispositivos, y no le impide crear una cuenta nueva.
        </p>

        <div class="flex flex-col gap-1.5">
          <label for="motivo-bloqueo" class="text-[9px] font-mono text-[var(--text-muted)] tracking-wider">
            MOTIVO (LO VERÁ EL JUGADOR)
          </label>
          <input type="text" id="motivo-bloqueo" maxlength="180"
                 placeholder="Cuentasuspensa por un administrador."
                 class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3 py-2.5
                        text-[12px] font-sans text-[var(--text-main)] focus:outline-none
                        placeholder:text-[var(--text-muted)]" />
        </div>

        ${W(`bloquear`,`BLOQUEAR CUENTA`,`self-start px-4 h-10 rounded-xl text-white font-['Orbitron'] font-bold text-[11px] cursor-pointer transition`,`tracking-[0.08em]" style="background:linear-gradient(to bottom,#dc2626,#b91c1c)"`)}
      </div>
    `;e.innerHTML=`
    <div class="card-glass rounded-2xl p-4 flex flex-col gap-4">
      <div class="flex items-start gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h2 class="font-['Orbitron'] font-bold text-base ${s?.activo?`text-red-300`:`text-[var(--text-main)]`} truncate">
            ${B(n.username)}
          </h2>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-1 break-all">${B(n.uid)}</p>
        </div>
        ${W(`copiar-uid`,`Copiar UID`,`px-3 h-9 rounded-xl border border-[var(--border-color)] app-bg text-[10px] font-mono`,`text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent)] transition cursor-pointer`)}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${Y(`Nanitas`,f(n.nanites),`accent-text text-[15px] font-bold`)}
        ${Y(`Producidas`,f(n.totalNanitesProduced))}
        ${Y(`Clics`,f(n.totalClicks))}
        ${Y(`Núcleos`,f(n.cores))}
        ${Y(`Llaves`,f(Number(r.keys)||0))}
        ${Y(`Cristales`,f(Number(r.upgradeCrystals)||0))}
        ${Y(`Cajas`,`${o.common||0}C · ${o.rare||0}R · ${o.epic||0}E · ${o.legendary||0}L`)}
        ${Y(`Almacén`,`${n.items} / ${r.warehouseCapacity??`—`}`)}
        ${Y(`Logros`,f(Array.isArray(r.unlockedAchievements)?r.unlockedAchievements.length:0))}
        ${Y(`Reinicios`,f(Number(r.resets)||0))}
        ${Y(`Esquirlas`,f(Number(r.shards)||0))}
        ${Y(`Guardado`,B(V(n.actualizado)))}
      </div>

      <!-- Otorgar nanitas -->
      <div class="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3.5 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] accent-text">
            OTORGAR NANITAS
          </h3>
          <span class="text-[10px] font-mono text-[var(--text-muted)]">
            Saldo actual: <span class="text-[var(--text-main)]">${f(n.nanites)}</span>
          </span>
        </div>

        <div class="flex gap-2">
          <input type="number" id="grant-cantidad" inputmode="numeric" placeholder="Cantidad"
                 class="flex-1 min-w-0 app-bg border border-[var(--border-color)] rounded-xl px-3 py-2.5
                        text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                        placeholder:text-[var(--text-muted)]" />
          ${W(`otorgar`,`OTORGAR`,`px-4 rounded-xl accent-bg hover:opacity-90 text-slate-950 font-['Orbitron'] font-bold text-[11px]`,`tracking-[0.1em] cursor-pointer disabled:opacity-50`)}
        </div>

        <div class="flex flex-wrap gap-1.5">
          ${[{etiqueta:`−1 M`,valor:-1e6},{etiqueta:`−1 K`,valor:-1e3},{etiqueta:`1 K`,valor:1e3},{etiqueta:`100 K`,valor:1e5},{etiqueta:`1 M`,valor:1e6},{etiqueta:`10 M`,valor:1e7},{etiqueta:`1 B`,valor:1e9},{etiqueta:`1 T`,valor:0xe8d4a51000}].map(e=>W(`rapido`,e.etiqueta,`px-2.5 h-7 rounded-lg border border-[var(--border-color)] app-bg text-[10px] font-mono`,`data-valor="${e.valor}" style="color:var(--text-muted)"
             onmouseover="this.style.color='var(--accent)'"
             onmouseout="this.style.color='var(--text-muted)'"`)).join(``)}
        </div>

        <p class="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
          Una cantidad negativa resta nanitas. El saldo nunca baja de cero y el
          histórico de producción sube lo mismo, para que el reinicio no lo castigue.
        </p>

        <div class="flex gap-2 flex-wrap items-center">
          <span class="text-[10px] font-mono text-[var(--text-muted)]">Fijar saldo</span>
          <input type="number" id="fijar-valor" inputmode="numeric" placeholder="0"
                 class="w-32 app-bg border border-[var(--border-color)] rounded-xl px-3 py-2
                        text-[12px] font-mono text-[var(--text-main)] focus:outline-none" />
          ${W(`fijar`,`FIJAR`,`px-3 h-9 rounded-xl btn-ghost text-[10px] font-['Orbitron'] font-bold cursor-pointer transition`)}
          ${W(`a-cero`,`Poner a 0`,`px-3 h-9 rounded-xl btn-ghost text-[10px] font-['Orbitron'] font-bold cursor-pointer transition`)}
          ${W(`duplicar`,`Duplicar saldo`,`px-3 h-9 rounded-xl btn-ghost text-[10px] font-['Orbitron'] font-bold cursor-pointer transition`)}
        </div>
      </div>

      ${c}

      <!-- Campos sueltos -->
      <details class="rounded-2xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em]
                        text-[var(--text-main)] cursor-pointer select-none">
          OTROS CAMPOS
        </summary>
        <div class="grid sm:grid-cols-2 gap-2 mt-3">
          ${pe.map(e=>{let t=r[e.campo],n=typeof t==`number`&&Number.isFinite(t)?String(t):``;return`
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-[var(--text-muted)] flex-1 truncate">${e.etiqueta}</span>
                <input type="number" inputmode="numeric" data-campo="${e.campo}" value="${n}"
                       placeholder="—"
                       class="w-24 app-bg border border-[var(--border-color)] rounded-lg px-2 py-1.5
                              text-[11px] font-mono text-[var(--text-main)] focus:outline-none
                              placeholder:text-[var(--text-muted)]" />
                ${W(`guardar-campo`,`Guardar`,`px-2.5 h-8 rounded-lg btn-ghost text-[9px] font-['Orbitron'] cursor-pointer transition`,`data-campo="${e.campo}"`)}
              </div>
            `}).join(``)}
        </div>
      </details>

      <!-- Peligro -->
      <div class="rounded-2xl border border-red-500/40 bg-red-500/5 p-3.5 flex items-center gap-3 flex-wrap">
        <div class="min-w-0 flex-1">
          <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-red-300">
            ELIMINAR PARTIDA
          </h3>
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed">
            Borra el documento de <span class="text-[var(--text-main)]">users/${B(n.uid)}</span> y su
            fila del ranking. La cuenta de acceso sigue existiendo: el nickname
            puede volver a entrar y empezar de cero.
          </p>
        </div>
        ${W(`borrar`,`ELIMINAR`,`px-4 h-10 rounded-xl text-white font-['Orbitron'] font-bold text-[11px] cursor-pointer transition`,`style="background:linear-gradient(to bottom,#ef4444,#dc2626)"`)}
      </div>
    </div>
  
    <div class="card-glass rounded-2xl p-4 flex flex-col gap-3 mt-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="text-[11px] font-['Orbitron'] font-bold tracking-[0.12em] text-[var(--text-main)]">
          INVENTARIO · ${i.length} OBJETOS
        </h3>
        <span class="text-[10px] font-mono text-[var(--text-muted)]">
          ${a.length} compañeros · ${i.filter(e=>e.equipped).length} equipados
        </span>
      </div>
      ${i.length?`
        <div class="overflow-x-auto -mx-1 px-1">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                <th class="py-1.5 pr-2 font-normal">Objeto</th>
                <th class="py-1.5 pr-2 font-normal">Tipo</th>
                <th class="py-1.5 pr-2 font-normal">Rareza</th>
                <th class="py-1.5 pr-2 font-normal text-right">Nivel</th>
                <th class="py-1.5 pr-2 font-normal text-right">Daño</th>
                <th class="py-1.5 pr-2 font-normal text-right">Cant.</th>
                <th class="py-1.5 font-normal text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${i.map(e=>`
                <tr class="border-t border-[var(--border-color)]/60 text-[11px] font-mono">
                  <td class="py-1.5 pr-2">
                    <span class="flex items-center gap-1.5 min-w-0">
                      <span style="color:${T(e.rarity)}" class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5 flex-shrink-0">
                        ${t(we[e.type]||`crate`)}
                      </span>
                      <span class="text-[var(--text-main)] truncate max-w-[14rem]">${B(e.name)}</span>
                      ${e.equipped?`<span class="text-amber-400 text-[9px] flex-shrink-0">EQ</span>`:``}
                    </span>
                  </td>
                  <td class="py-1.5 pr-2 text-[var(--text-muted)]">
                    ${B(Te[e.type]||e.type||`—`)}
                  </td>
                  <td class="py-1.5 pr-2" style="color:${T(e.rarity)}">${B(e.rarity||`—`)}</td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-muted)]">
                    ${e.level==null?`—`:e.level}${e.potential?` `+`★`.repeat(e.potential):``}
                  </td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-main)]">
                    ${e.damage==null?`—`:f(e.damage)}
                  </td>
                  <td class="py-1.5 pr-2 text-right text-[var(--text-main)]">${e.stackCount??1}</td>
                  <td class="py-1.5 text-right text-[var(--text-muted)]">
                    ${e.sellPrice==null?`—`:f(e.sellPrice)}
                  </td>
                </tr>
              `).join(``)}
            </tbody>
          </table>
        </div>
      `:`
        <p class="text-[11px] font-mono text-[var(--text-muted)] py-3 text-center">
          El almacén está vacío.
        </p>
      `}

      ${a.length?`
        <div class="flex flex-col gap-1.5">
          <p class="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Compañeros</p>
          ${a.map(e=>`
            <div class="flex items-center gap-2 text-[11px] font-mono rounded-lg px-2 py-1.5
                        border border-[var(--border-color)]/60">
              <span style="color:${T(e.rarity)}" class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">
                ${t(`companion`)}
              </span>
              <span class="text-[var(--text-main)] truncate flex-1">${B(e.name)}</span>
              <span style="color:${T(e.rarity)}">${B(e.rarity||``)}</span>
              <span class="text-[var(--text-muted)]">${e.power==null?``:`+${f(e.power)}/s`}</span>
            </div>
          `).join(``)}
        </div>
      `:``}

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Documento en crudo (JSON)
        </summary>
        <pre class="mt-2.5 max-h-96 overflow-auto text-[10px] font-mono text-[var(--text-muted)]
                    leading-relaxed whitespace-pre-wrap break-all">${B(JSON.stringify(H(r),null,2))}</pre>
      </details>

      ${s?`
        <details class="rounded-xl border border-[var(--border-color)] app-bg p-3">
          <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
            Documento de bloqueo (JSON)
          </summary>
          <pre class="mt-2.5 max-h-40 overflow-auto text-[10px] font-mono text-[var(--text-muted)]
                      leading-relaxed whitespace-pre-wrap break-all">${B(JSON.stringify(H(s),null,2))}</pre>
        </details>
      `:``}
    </div>
  `}async function Ae(e,t){let n=O;if(n){if(e===`copiar-uid`){try{await navigator.clipboard.writeText(n.uid),g(`UID copiado.`,`success`)}catch{g(`El navegador no deja copiar. Cópialo a mano.`,`error`)}return}if(e===`rapido`){let e=U(`#grant-cantidad`);e&&(e.value=t.dataset.valor||``,e.focus());return}if(e===`bloquear`){let e=(U(`#motivo-bloqueo`)?.value??``).trim();if(!e){g(`Escribe un motivo: el jugador lo verá en su pantalla de bloqueo.`,`error`),U(`#motivo-bloqueo`)?.focus();return}if(!await Q(`${n.username} no podrá volver a jugar. Su partida se queda guardada y verá este motivo: "${e}".`,`BLOQUEAR`,!0))return;await Z(async()=>{await _e(n.uid,e,D?.uid||`admin`),R[n.uid]={uid:n.uid,activo:!0,motivo:e,desde:Date.now(),puestoPor:D?.uid||`admin`,quitadoPor:``},K(),X(),g(`${n.username} bloqueado.`,`success`)});return}if(e===`desbloquear`){if(!await Q(`${n.username} volverá a poder entrar.`,`DESBLOQUEAR`,!1))return;await Z(async()=>{await ve(n.uid,D?.uid||`admin`),R[n.uid]={uid:n.uid,activo:!1,motivo:R[n.uid]?.motivo||``,desde:0,puestoPor:R[n.uid]?.puestoPor||``,quitadoPor:D?.uid||`admin`},K(),X(),g(`Bloqueo de ${n.username} levantado.`,`success`)});return}if(e===`otorgar`){let e=(U(`#grant-cantidad`)?.value??``).trim();if(e===``){g(`Escribe una cantidad, o usa uno de los atajos de abajo.`,`error`);return}let t=Number(e);if(!Number.isFinite(t)||t===0){g(`La cantidad tiene que ser un número distinto de cero.`,`error`);return}if(t>0&&!await Q(`Se van a sumar ${f(t)} nanitas a ${n.username}.`,`OTORGAR`,!1))return;await Z(async()=>{let e=await de(n.uid,Math.floor(t));g(`${n.username} tiene ahora ${f(e)} nanitas.`,`success`)});return}if(e===`fijar`||e===`a-cero`||e===`duplicar`){if(e===`fijar`&&(U(`#fijar-valor`)?.value??``).trim()===``){g(`Escribe el saldo al que quieres fijarlo.`,`error`);return}let t=e===`a-cero`?0:e===`duplicar`?n.nanites*2:Number(U(`#fijar-valor`)?.value);if(!Number.isFinite(t)||t<0){g(`Ese número no vale. Usa un entero igual o mayor que cero.`,`error`);return}if(!await Q(`El saldo de ${n.username} pasará de ${f(n.nanites)} a ${f(t)} nanitas.`,`FIJAR`,!1))return;await Z(async()=>{let e=await fe(n.uid,Math.floor(t));g(`Saldo fijado en ${f(e)}.`,`success`)});return}if(e===`guardar-campo`){let e=t.dataset.campo,r=(document.querySelector(`input[type="number"][data-campo="${e}"]`)?.value??``).trim();if(r===``){g(`Escribe un número antes de guardar.`,`error`);return}let i=Number(r);if(!Number.isFinite(i)||i<0){g(`Ese número no vale. Usa un entero igual o mayor que cero.`,`error`);return}await Z(async()=>{await me(n.uid,e,i),g(`${e} guardado.`,`success`)});return}if(e===`borrar`){if(!await Q(`Se borrará la partida de ${n.username} y su fila del ranking. La cuenta de acceso seguirá existiendo.`,`ELIMINAR`,!0))return;await Z(async()=>{await he(n.uid),R[n.uid]&&(delete R[n.uid],await xe(n.uid).catch(e=>{console.warn(`[admin] No se ha podido borrar el bloqueo:`,e)})),O=null,g(`Partida eliminada.`,`success`),await q()})}}}async function Z(e){if(!P){P=!0,document.body.style.cursor=`progress`;try{await e()}catch(e){console.error(e),g(`Operación fallida: ${J(e)}`,`error`)}finally{P=!1,document.body.style.cursor=``}}}function Q(e,t,n){return new Promise(r=>{let i=!1,a=()=>document.querySelector(`#confirm-modal-overlay`),o=()=>Array.from(a()?.querySelectorAll(`button`)??[]),s=e=>{if(!i){i=!0;for(let e of o())e.removeEventListener(`click`,c),e.removeEventListener(`click`,l);a()?.removeEventListener(`click`,u),document.removeEventListener(`keydown`,d),r(e)}},c=()=>s(!0),l=()=>s(!1),u=e=>{e.target===a()&&s(!1)},d=e=>{e.key===`Escape`&&s(!1)};ne(e,c,{sublabel:n?`OPERACIÓN IRREVERSIBLE`:`CONFIRMAR`,confirmText:t,danger:n});let f=o();f[0]?.addEventListener(`click`,l),f[f.length-1]?.addEventListener(`click`,c),a()?.addEventListener(`click`,u),document.addEventListener(`keydown`,d)})}function $(){let e=U(`#panel-base`);if(!e)return;let n=F,r=I,i=k.length||1,a=r?Math.min(100,Math.round(r.borrados/i*100)):0,o=(U(`#confirmacion`)?.value||``).trim().toUpperCase()===z;e.innerHTML=`
    <div class="card-glass rounded-2xl p-5 flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <span class="text-red-400 [&>span>svg]:w-5 [&>span>svg]:h-5">${t(`warning`)}</span>
        <h2 class="font-['Orbitron'] font-bold text-sm tracking-[0.12em] text-red-300">
          BORRADO MASIVO DE LA BASE DE DATOS
        </h2>
      </div>

      <p class="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
        Vacía por completo las colecciones <span class="text-[var(--text-main)]">users</span>,
        <span class="text-[var(--text-main)]">rankings</span> y
        <span class="text-[var(--text-main)]">bloqueos</span> en lotes de 400 documentos.
        Ahora mismo hay <span class="text-[var(--text-main)]">${k.length}</span>
        ${k.length===1?`operativo`:`operativos`}
        en la lista (puede haber más: la lista se lee al abrir la terminal).
      </p>

      <div class="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 flex flex-col gap-2">
        <p class="text-[10px] font-mono text-amber-200 leading-relaxed">
          Antes de seguir, dos cosas que este botón NO hace:
        </p>
        <ul class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed list-disc pl-4 space-y-1">
          <li>
            No borra las cuentas de Firebase Auth. Los nicknames seguirán pudiendo
            entrar y crearán una partida nueva desde cero.
          </li>
          <li>
            No avisa a nadie. No hay copia de seguridad: lo que se borra, se borró.
          </li>
        </ul>
      </div>

      <div class="flex flex-col gap-2">
        <label for="confirmacion" class="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
          ESCRIBE <span class="text-red-300">${z}</span> PARA HABILITAR EL BOTÓN
        </label>
        <input type="text" id="confirmacion" autocomplete="off" spellcheck="false" ${n?`disabled`:``}
               placeholder="${z}"
               class="w-full app-bg border border-[var(--border-color)] rounded-xl px-3.5 py-2.5
                      text-[12px] font-mono text-[var(--text-main)] focus:outline-none
                      placeholder:text-[var(--text-muted)]" />
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        ${W(`borrar-todo`,n?`BORRANDO…`:`BORRAR TODA LA BASE DE DATOS`,`px-5 h-12 rounded-xl text-white font-['Orbitron'] font-bold text-[11px] tracking-[0.1em] transition`,`style="background:linear-gradient(to bottom,#ef4444,#dc2626)"
           ${o&&!n?``:`disabled opacity-40 cursor-not-allowed`}`)}
        ${W(`recargar-lista`,`Recargar lista`,`px-4 h-12 rounded-xl btn-ghost text-[11px] font-['Orbitron'] font-bold cursor-pointer transition`)}
      </div>

      ${r?`
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
            <span>Fase: ${r.fase===`users`?`partidas`:r.fase===`rankings`?`ranking`:`bloqueos`} · ${r.borrados} borrados</span>
            <span>${a}%</span>
          </div>
          <div class="meter"><span style="width:${a}%;background:#ef4444"></span></div>
          ${r.ultimoError?`<p class="text-[9px] font-mono text-amber-300">${B(r.ultimoError)}</p>`:``}
        </div>
      `:``}

      ${L?`
        <div class="rounded-xl border px-3.5 py-3 flex flex-col gap-1.5
                    ${L.errores.length?`border-amber-500/40 bg-amber-500/5`:`border-emerald-500/40 bg-emerald-500/5`}">
          <p class="text-[11px] font-mono ${L.errores.length?`text-amber-200`:`text-emerald-300`}">
            ${L.errores.length?`Borrado terminado con ${L.errores.length} documento(s) que no se pudieron eliminar.`:`Base de datos vaciada. ${L.total} documentos eliminados.`}
          </p>
          ${L.errores.slice(0,8).map(e=>`<p class="text-[9px] font-mono text-[var(--text-muted)] break-all">${B(e)}</p>`).join(``)}
        </div>
      `:``}

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Reglas de Firestore: por qué esto puede fallar con «permission-denied»
        </summary>
        <div class="mt-2.5 text-[10px] font-mono text-[var(--text-muted)] leading-relaxed flex flex-col gap-2">
          <p>
            Todo lo que hace esta página escribe en documentos de otros. Eso solo
            lo permite si las reglas de seguridad lo autorizan, y con las reglas
            por defecto de un proyecto nuevo no lo hace: son de lectura y
            escritura públicas.
          </p>
          <p>
            El archivo <span class="text-[var(--text-main)]">firestore.rules</span>
            del proyecto trae las reglas necesarias, con la explicación de por
            qué cada colección es como es. Se pega en Firebase console →
            Firestore Database → Rules → Publish.
          </p>
          <p>
            Después hay que crear el documento
            <span class="text-[var(--text-main)]">admins/{esc(sesion?.uid || 'TU_UID')}</span>
            para tu cuenta. Sin él, las reglas niegan el acceso aunque las
            publiques.
          </p>
        </div>
      </details>

      <details class="rounded-xl border border-[var(--border-color)] app-bg p-3.5">
        <summary class="text-[10px] font-mono text-[var(--text-muted)] cursor-pointer select-none">
          Cómo se borran también las cuentas de acceso
        </summary>
        <div class="mt-2.5 text-[10px] font-mono text-[var(--text-muted)] leading-relaxed flex flex-col gap-2">
          <p>
            Las cuentas viven en Firebase Auth, no en Firestore, y el SDK del
            navegador no tiene permiso para borrarlas. Con el Admin SDK, desde
            Node y con una clave de cuenta de servicio:
          </p>
          <pre class="overflow-x-auto p-2.5 rounded-lg bg-black/40 text-[9px] leading-relaxed">import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp({ credential: admin.credential.cert(serviceAccount) });
await getAuth(app).deleteUsers(uids);   // máximo 1000 por llamada</pre>
          <p>
            El mismo script puede recorrer <span class="text-[var(--text-main)]">users</span> con
            <span class="text-[var(--text-main)]">listUsers()</span> y borrar cada uid antes de
            borrar su documento. Haz una copia de seguridad antes: no hay vuelta atrás.
          </p>
          <p>
            Es también la única forma de <strong>cerrar la sesión de un jugador
            ahora</strong>: <span class="text-[var(--text-main)]">revokeRefreshTokens(uid)</span>
            invalida sus tokens, y su partida se cae en cuanto intente guardar. El
            botón de bloquear de esta página no lo hace —el SDK del navegador no
            puede—: se limita a negar el arranque y a cerrarle la sesión cuando
            vuelve a la pestaña.
          </p>
        </div>
      </details>
    </div>
  `}function je(){let e=U(`#confirmacion`),t=U(`[data-accion="borrar-todo"]`);t&&(t.disabled=(e?.value||``).trim().toUpperCase()!==z||F,t.style.opacity=t.disabled?`.4`:`1`,t.style.cursor=t.disabled?`not-allowed`:`pointer`)}function Me(e){if(e===`recargar-lista`){q(!0);return}if(e===`borrar-todo`){if((U(`#confirmacion`)?.value||``).trim().toUpperCase()!==z){g(`Escribe ${z} para confirmar.`,`error`);return}Q(`Se borrarán todas las partidas y todas las filas del ranking. Esto no se puede deshacer.`,`BORRAR TODO`,!0).then(e=>{e&&Ne()})}}async function Ne(){if(F)return;F=!0,I={fase:`users`,borrados:0,total:0,ultimoError:null},L=null;let e=(U(`#confirmacion`)?.value||``).trim().toUpperCase();$();let t=U(`#confirmacion`);t&&(t.value=e);try{let e=await ge(e=>{I=e,$()});L=e,e.errores.length?g(`${e.errores.length} documento(s) no se pudieron borrar.`,`error`):g(`Base de datos vaciada: ${e.total} documentos.`,`success`)}catch(e){console.error(e),g(`Borrado interrumpido: ${J(e)}`,`error`)}finally{F=!1,I=null,k=[],O=null,$(),K(),X();let e=U(`#confirmacion`);e&&(e.value=``)}}a(ee()),e(s,e=>{if(D=e,!e){O=null,k=[],G();return}if(!Ee(e.uid)){G(`Esta cuenta no está en la lista de administradores (ADMIN_UIDS en src/admin.ts).`,`error`);return}be(e.uid).then(t=>{if(t){De();return}G(`Esta cuenta no es administradora. Para darle acceso, crea el documento admins/`+e.uid+` en Firestore.`,`error`)})});