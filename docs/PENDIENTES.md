# Pendientes y features

> **Para el jugador:** esta es tu lista. Escribe en el apartado que toque, con
> tus palabras. No hace falta que sea técnico ni marcar casillas.
>
> **Una idea está pendiente mientras siga en estos apartados.** Cuando se termine
> se mueve a **Hecho**, y si se decide que no, a **Descartado** con el motivo en
> una línea. Así que lo único que hay que hacer al acabar algo es **moverlo**, y no
> se pierde ninguna idea.
>
> **El fichero no se borra.** Es la memoria de lo que se quiso hacer. Un descarte
> escrito vale más que la lista de "hecho": una idea que se rechazó con un motivo
> no vuelve a proponerla nadie.

---

## Features

_Cosas que quieres que existan._

### F1 · Ver la valoración sin abrir la flechita

La valoración por defautl se muestra, no hace falta abrir la flechita.

### F2 · La valoración también en el panel principal

La valoración se debe mostrar en el panel principal, en el sector de recolector.

### F3 · Desglosar la recolección por click

La recolección x click debe mostrar el base + el aumento por la mejora x nivel.
Ej: `Recolección por click: +20 (5 base +15 por mejora)`

### F4 · Solo tarjetas de buff, fuera los buffs pasivos

Sacar los buffs pasivos y dejar las tarjetas únicamente.

### F5 · Una llave por tipo de caja, con precio creciente

Debe existir una llave para cada tipo de caja y crece el precio de las mismas.

### F6 · Probabilidad baja de botín de tier superior en las cajas

En las cajas debe haber una probabilidad baja de obtener cosas del tier superior.

### F7 · Tope de 3 compañeros y precio de ranura balanceado

El máximo de compañeros quiero que sea 3. La segunda compra de slot no debe dar
+3. Balancear el precio.

---

## Bugs y cosas que se han visto

### B1 · El primer slot de compañero no muestra su daño

El click automático de los compañeros no siempre muestra el valor. Equipé un Épico
puntualmente y no mostraba el valor del daño, uno común anda. Otro dato es que el
segundo compañero sí muestra el daño. A lo mejor es un problema con el primer slot.

> Sospecha del jugador, no confirmada. Encaja con que el daño se calcule sobre el
> recolector equipado y no sobre el compañero, así que el primer slot puede estar
> leyéndose antes de que exista ese valor.

---

## Balance y dificultad

_Preguntas sobre si el juego va bien de ritmo. No son bugs: son decisiones tuyas
sobre cuánto debería costar._

### P1 · Se llega muy rápido a compañeros de tier 6

Llegué muy rápido a los compañeros tier 6... ¿está bien el balance? ¿podrás ver?

### P2 · Se llega muy rápido a recolectores de tier 7

Lo mismo que a los recolectores, llegué muy rápido al recolector tier 7.

### P3 · Los cristales de mejora son muy baratos

Los cristales de mejora valen muy baratos, es muy fácil mejorar los ítems...

---

## Tareas añadidas durante el trabajo

_Cualquier cosa que surja implementando otra cosa y haga falta decidir. Se van
apilando aquí al final, y se suben a "Features" cuando toca hacerlas._

_(vacío)_

---

## Hecho

_Lo terminado, para no perder el hilo. Una línea por cosa y el commit donde entró._

- [x] El contador deja de enseñar números que nadie cobra (`558a394`). La ficha y
      el "+N" de los compañeros ya dicen la cifra que entra de verdad, y los clics
      del árbol tienen señal.
- [x] La ruleta del sintonizador, y la de las cajas partida en tres ficheros
      (`ce3a346`).

---

## Descartado

_Lo que se decidió no hacer, y por qué. Esto vale más que la lista de "hecho":
una idea que se descartó con un motivo escrito no vuelve a proponerla nadie._

_(vacío)_