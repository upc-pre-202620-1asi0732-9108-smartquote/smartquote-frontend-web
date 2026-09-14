# SmartQuote · Frontend web

Aplicación web en español para registrar necesidades de producción, revisar cotizaciones PDF, comparar proveedores y aprobar órdenes de compra. Adaptación a escritorio y móvil de los flujos de SmartQuote.

Integración con [smartquote-web-services](https://github.com/upc-pre-202620-1asi0732-9108-smartquote/smartquote-web-services), rama `develop`. Validada contra el commit `e0b4d9287108cc9699f1b1ff325351c6f259429f` con PostgreSQL y la API .NET 10 reales. La interfaz consulta y guarda en `/api/v1`; no utiliza una base de datos ficticia en el navegador.

## Ejecutar

Requisitos: Node.js 22.18+ (recomendado 24), npm y el backend iniciado con PostgreSQL.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell, utiliza `Copy-Item .env.example .env.local`. Edita `VITE_API_BASE_URL` con la URL raíz del backend y abre **http://127.0.0.1:5174**. También puedes cambiar la URL desde la pantalla de acceso.

Configura CORS en el backend para el origen exacto del frontend; por ejemplo, `Cors__AllowedOrigins__0=http://127.0.0.1:5174`. Sigue las instrucciones del repositorio del backend para configurar `ConnectionStrings__DefaultConnection`, ejecutar las migraciones y definir `Jwt__Issuer`, `Jwt__Audience` y `Jwt__SigningKey`. En producción, ambos servicios deben usar HTTPS y CORS debe incluir el dominio publicado.

## Acceso y roles

El backend actual valida JWT, pero no publica endpoints de inicio de sesión o registro. Por eso el acceso requiere un token emitido por tu entorno. La API comprueba la autenticación y los permisos; los roles del navegador solo adaptan la navegación.

| Rol JWT                | Flujo disponible                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ProductionSpecialist` | Crear solicitudes con ítems y requisitos, adjuntar documentos, consultar estados y notificaciones.                    |
| `PurchaseAnalyst`      | Revisar solicitudes, cambiar estados, cargar y verificar cotizaciones, configurar criterios y ejecutar comparaciones. |
| `PurchaseManager`      | Flujo de compras y aprobación, consulta e impresión de órdenes.                                                       |

Para un backend **local de desarrollo**, el script de Node puede emitir tokens con la misma clave que el backend. Esta clave se mantiene fuera del frontend:

```powershell
$env:SMARTQUOTE_JWT_KEY = Get-Content -Raw 'C:\ruta-segura\clave-local.txt'
npm run token:dev -- --role PurchaseManager
npm run token:dev -- --role ProductionSpecialist
```

El emisor predeterminado es `SmartQuote` y la audiencia `SmartQuote.Clients`. Puedes ajustarlos con `SMARTQUOTE_JWT_ISSUER` y `SMARTQUOTE_JWT_AUDIENCE`. `SMARTQUOTE_USER_ID` permite reutilizar el identificador de una cuenta local. Los tokens duran cuatro horas. Nunca uses este script como autenticación de producción ni publiques claves en variables `VITE_*`.

El token de acceso se conserva en `sessionStorage` de la pestaña y se elimina al cerrar sesión. La URL de la API y las referencias de simulación se guardan en `localStorage`.

## Flujo de compra

1. Producción registra ítems, cantidades, fecha y al menos un requisito obligatorio por ítem.
2. Compras mueve la solicitud a revisión y después a recopilación de cotizaciones.
3. Carga PDF por proveedor, solicita el procesamiento, revisa evidencias y corrige campos. Asigna las líneas a los ítems de la solicitud y verifica cada cotización.
4. En evaluación, configura requisitos técnicos obligatorios y ponderaciones que sumen 100 %. Ejecuta la simulación calculada por el backend.
5. El responsable revisa la alternativa elegible y confirma la generación de la orden. Puede imprimirla y marcar la solicitud como ordenada.

Las actualizaciones envían `expectedVersion`. Un conflicto de concurrencia muestra un aviso para actualizar antes de guardar de nuevo. Una comparación anterior queda deshabilitada si cambió la versión activa de criterios.

## Comprobaciones

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`lint` revisa el código de la aplicación, el cliente API y los scripts; el catálogo generado de componentes shadcn se conserva sin modificaciones. `npm start` sirve la compilación con Wrangler.

Prueba de integración sobre una base de desarrollo local (crea datos persistentes):

```powershell
$env:SMARTQUOTE_API_URL = 'http://127.0.0.1:5088'
$env:SMARTQUOTE_KEY_FILE = 'C:\ruta-segura\clave-local.txt'
npm run test:integration
```

Requiere `AI__Provider=Stub` en el backend, migraciones aplicadas y los valores JWT indicados arriba. Se restringe a localhost. Genera cotizaciones PDF de prueba y registra resultados y tokens temporales en `.local/`, excluido de Git. Consulta [la validación documentada](docs/integration-validation.md).

## Límites del backend actual

- Las pruebas de extracción utilizaron el proveedor `Stub` incluido en el repositorio. Validan carga, procesamiento, evidencia y revisión, pero no la precisión de extracción con IA. Para PDF reales, configura el proveedor de extracción del backend y valida sus resultados.
- El backend no expone descarga de PDF, exportación de órdenes ni autenticación de usuario/contraseña. La interfaz muestra las evidencias devueltas y utiliza la impresión del navegador para las órdenes.
- El backend puede devolver `isCurrent=true` para una simulación de una versión de criterios anterior. El cliente comprueba además el escenario activo antes de habilitar la aprobación. Conviene aplicar también esta validación en el backend para proteger otros clientes y cambios concurrentes.
- Publicar este frontend no publica PostgreSQL ni la API. Para utilizarlo desde otros equipos se necesita una URL HTTPS accesible del backend, CORS y un emisor de tokens.

## Estructura

- `components/smartquote/`: acceso, solicitudes, cotizaciones, comparación y órdenes.
- `lib/smartquote/`: tipos, contratos HTTP y presentación del dominio.
- `app/`: entrada, metadatos y estilos responsivos.
- `tests/` y `scripts/`: comprobaciones del cliente e integración real.
- `components/ui/`: catálogo shadcn sobre Base UI.

Stack: React 19, TypeScript, Vinext/Vite, Tailwind CSS 4 y shadcn. No se incorporan claves del backend al paquete de navegador.
