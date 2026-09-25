# SPEC-065 — Verificación

- **25/09/2026** — Local, asesora de prueba: la cola muestra tarjetas con
  cliente, teléfono, «Volver a llamar», «desde el 05/09» y «Lleva 7 días
  contigo: ciérralo o agenda una fecha»; la línea menor dice «Última
  gestión: No contesta · 05/09 08:53 · «…»» y «CLARO · Máximo S/39.9 · … · 0
  de 3 hoy». «Mi día» dice lo mismo del mismo caso (AC-001). En el celular
  (375 px) la página mide 375 px de ancho: sin desplazamiento lateral
  (AC-003). «Ver datos» abre DNI, padres, teléfonos, gestiones, dirección y
  líneas. Tomar casos: «36 casos libres en … · Tomar 10 casos». Sin errores
  en consola. Validation 404 pruebas; web: tipos, lint y 239 pruebas en
  verde.

- **25/09/2026** — Producción (`f52481f`), sesión de asesora, solo lectura:
  las vistas dicen «Trabajar ahora 26 · Por completar 0 · En espera 0 ·
  Historial 68» desde «Trabajar ahora» (AC-002; antes, «Historial 0»). La
  primera fila dice «desde el 12/09 · Ya puede portar: llámalo», igual que
  «Mi día» (AC-001); la línea del resultado, «26 casos · 24 sin sus 3
  intentos de hoy». El aviso «4 ventas caídas por llamar» ocupa su línea
  sobre el título sin tapar nada (AC-005). En el celular la página mide 375
  px de ancho y la primera fila muestra cliente, teléfono, frase y
  «Registrar gestión» (AC-003).
