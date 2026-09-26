# SPEC-079 — Verificación

- **26/09/2026** — Web: tipos, lint y 289 pruebas. La prueba del servidor comprueba que un pedido fallido no detiene a los otros dos y que los repetidos cuentan una vez.

- **26/09/2026, producción (administrador, sin confirmar ningún cierre)**:
  - «Falta activar 34»: 34 casillas, todas habilitadas para administrador.
  - La barra dice «Marca los que el operador ya activó · Marcar los 34 de
    esta página · Cerrar: ya activaron».
  - Al marcar dos: «2 pedidos marcados» y «Cerrar: ya activaron (2)».
  - Al tocar el botón aparece «¿Cerrar 2 pedidos? No se puede deshacer»
    con «Sí, cerrar 2 pedidos» y «Volver». Se tocó «Volver» y luego
    «Desmarcar»: quedaron 0 marcados.
  - No se envió nada.
