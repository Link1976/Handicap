# Golf Handicap RFEG - Contexto v14

## Qué ha cambiado en v14

### Sistema híbrido de obtención de datos (3+2 intentos)
El `fetchParse()` ahora intenta obtener datos en cascada:

1. **PDF público** via `api.rfeg.es` (Worker `/?pdf=lic`) — funciona para cualquier licencia cuando el backend RFEG está activo
2. **PDF autenticado** via `api.rfegolf.es/whs/{id}/world-handicap` (Worker `/?auth_pdf=fedId`) — requiere login, solo propio + vinculados
3. **HI actual** via `api.rfegolf.es/federated/{id}/handicap` (Worker `/?auth_handicap=fedId`) — requiere login, funciona para CUALQUIER federado
4. **Scores** via `api.rfegolf.es/federated/{id}/scores` (Worker `/?auth_scores=fedId`) — requiere login, solo propio + vinculados

Si solo se obtiene HI (sin PDF), la app muestra un dashboard limitado con el HI actual y, si disponible, el historial de scores.

### Login modal con aviso de privacidad
- Nuevo componente `LoginModal` accesible desde la pantalla principal
- Aviso claro de LOPD/RGPD: credenciales solo en sesión, no se almacenan, se borran al cerrar
- Credenciales guardadas en `window._rfegCreds` (memoria JS, se pierde al recargar)
- Login se valida haciendo una petición de prueba al endpoint de handicap

### Mapeo licencia → federatedId
- IDs conocidos bootstrapped: `503218→26291` (Alberto), `995317→330075` (Guillermo), `924203→328208` (Raúl)
- El usuario puede añadir más mappings desde el modal de login (formato `licencia:fedId`)
- Almacenados en `window._rfegFedIds` (sesión)

### Dashboard limitado
- Cuando no hay PDF pero sí HI vía API, muestra `limitedData:true`
- Se ocultan tabs que necesitan rondas: Campos, Rondas, Simulador
- Se muestra card explicativa con pasos para obtener datos completos
- Si hay scores disponibles, se muestra historial de evolución del HI

### Worker v7 (rfeg-courses-worker-v7.js)
Nuevos endpoints POST (requieren `{username, password}` en body JSON):
- `POST /?auth_pdf={federatedId}` → login + descarga PDF
- `POST /?auth_handicap={federatedId}` → login + HI actual
- `POST /?auth_scores={federatedId}` → login + historial scores

Endpoints GET existentes sin cambios:
- `GET /?search=nombre` → busca clubs
- `GET /?club_id=X&slug=Y` → datos tees
- `GET /?pdf=licencia` → PDF público
- `GET /?player=nombre` → busca jugador

## Mapa de autorización API rfegolf.es
| Endpoint | ¿Requiere ser propietario? | Notas |
|---|---|---|
| `/federated/{id}/handicap` | ❌ No | Cualquier sesión activa |
| `/federated/{id}/rankings` | ❌ No | Cualquier sesión activa |
| `/federated/{id}/scores` | ✅ Sí | Propio + vinculados |
| `/federated/{id}/games` | ✅ Sí | Propio + vinculados |
| `/federated/{id}` (perfil) | ✅ Sí | Propio + vinculados |
| `/whs/{id}/world-handicap` | ✅ Sí | Propio + vinculados, devuelve PDF |

## IDs internos
- Alberto: licencia=503218, federatedId=26291
- Guillermo: licencia=995317, federatedId=330075
- Raúl: licencia=924203, federatedId=328208

## Flujo de usuario
1. Usuario abre la app → ve jugadores guardados + botón "Iniciar sesión RFEG"
2. Sin login: intenta PDF público → si falla, error
3. Con login: intenta PDF público → si falla, intenta PDF autenticado → si falla (403 o error), obtiene HI vía API → muestra dashboard limitado
4. Para Alberto y Guillermo (vinculados): PDF autenticado funciona → datos completos
5. Para Raúl (no vinculado): PDF autenticado da 403 → solo HI actual + scores da 403 → dashboard limitado

## Deploy
1. Subir `rfeg-courses-worker-v7.js` a Cloudflare Workers (`rfeg-courses.alberto76.workers.dev`)
2. Subir `v14.html` como `index.html` a Cloudflare Pages (`golf-handicap.alberto76.workers.dev`)

## Pendiente
- Las licencias 503218/995317/924203 no son licencias RFEG completas (formato XX12345678) — buscar en widget público por "Ruiz de Infante"
- Charles Proxy para interceptar app móvil RFEG (podría descubrir acceso universal)
- El Worker hace login en cada petición POST — optimizar con caché de sesión en KV si el rendimiento es problema
