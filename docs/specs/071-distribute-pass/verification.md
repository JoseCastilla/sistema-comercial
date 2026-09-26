# SPEC-071 — Verificación

- **25/09/2026** — Web: tipos, lint y 272 pruebas (`repartir-base.test.tsx`
  5 de 5: filas compactas, marcar los primeros N con el botón que dice
  cuántos, reparto parejo a todo el ancho y quién no participa, una forma a
  la vez, sin marcados no se envía).

- **25/09/2026** — Producción (`7808e5b`), sesión de la supervisora, sin
  repartir nada. «Disponibles para asignar 66 · Asignados sin gestión 0 · En
  gestión 221 · En revisión 6»; pestañas «Por repartir 66 | Asignados sin
  gestión 0»; 66 filas compactas; la página mide 4888 px (antes 6883). Al
  marcar los primeros 50, el botón dice «Repartir 50 casos» y cada asesor
  «Recibiría 10 → quedaría con …». Se recargó sin enviar. En el celular el
  selector de modo ensanchaba el formulario y el texto se cortaba a la
  derecha: el formulario ahora no crece más que la pantalla y el selector se
  desplaza de lado dentro de sí mismo.
- **25/09/2026** — Producción (`9eaaf5f`), celular (375 px): el formulario
  mide 343 px dentro de 375, ningún elemento sale de él; cada asesor se lee
  completo («Recibiría 0 → quedaría con 7») y el selector de modo se
  desplaza dentro de sí mismo (AC-001).
