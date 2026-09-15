# Validación de integración

Ejecutada el 14 de septiembre de 2026 contra `smartquote-web-services/develop`, commit `e0b4d9287108cc9699f1b1ff325351c6f259429f`, .NET 10 y PostgreSQL 16 locales. Resultado tras migrar a Vue: **18 comprobaciones correctas**; se generó y recuperó la orden `PO-00002` y su solicitud terminó en `Ordered`.

1. Autenticación JWT y paginación de solicitudes.
2. Compras no puede registrar solicitudes de producción: HTTP 403.
3. Persistencia de una solicitud creada por producción.
4. Persistencia de un adjunto.
5. Transiciones de estado con versión esperada.
6. Rechazo de versión antigua de solicitud: HTTP 409.
7. Carga de PDF e idempotencia ante un documento duplicado.
8. Procesamiento mediante el adaptador de desarrollo y devolución de evidencia.
9. Correcciones de campos y rechazo de versión antigua de cotización.
10. Asignación de líneas y verificación de cotizaciones.
11. Ranking calculado por la API: precio al 60 % recomienda A.
12. El cliente invalida el resultado anterior cuando cambia el escenario activo.
13. Nuevo ranking de la API: entrega al 70 % recomienda B.
14. Un analista no puede aprobar una orden: HTTP 403.
15. Generación, recuperación e idempotencia de una orden real.
16. Finalización de la solicitud en `Ordered`.
17. Notificación para producción y confirmación de lectura.
18. Historial persistente de cambios.

La prueba usa `AI__Provider=Stub`, no un servicio de IA. Las respuestas de extracción del adaptador son deterministas; se corrigen valores mediante endpoints reales para verificar que los criterios cambian el ranking. No demuestra precisión de extracción de PDF arbitrarios ni disponibilidad de un backend público.

La prueba ejercita los mismos servicios de aplicación y repositorios que utiliza Vue. Puede repetirse con `npm run test:integration`; crea nuevos datos en el backend local. El recorrido del navegador se comprueba por separado con Playwright y `SMARTQUOTE_E2E_REAL=1`.

También pasaron 14 pruebas de dominio, arquitectura y transporte, el lint y la compilación de Vite. Playwright pasó dos pruebas en Microsoft Edge: idioma y diseño responsivo; y el recorrido completo con producción y gerencia, dos PDF verificados, comparación, generación de `PO-00003` y cierre de la solicitud. No se registraron errores JavaScript de página durante ese recorrido.
