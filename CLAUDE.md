# handicap-app

App web (single-file HTML) para consultar el handicap RFEG y evolución de rondas de golf. Incluye buscador de campos, simulador, login autenticado y dashboard.

**Estado:** uso y desarrollo activo — v14 (abril 2026)

## Stack
- Frontend: HTML single-file + vanilla JS + CSS (`index.html` = copia de la versión actual, p.ej. `v14.html`)
- Backend: Cloudflare Worker (`rfeg-courses-worker-v7.js`) — proxy a APIs RFEG
- Deploy: Cloudflare Pages (frontend) + Cloudflare Workers (backend)

## URLs
- App: https://golf-handicap.alberto76.workers.dev
- Worker: https://rfeg-courses.alberto76.workers.dev
- GitHub: https://github.com/Link1976/Handicap

## Workflow de versionado
- Cada iteración grande genera un nuevo `vXX.html` (actual: `v14.html`)
- Para deploy: copiar `vXX.html` → `index.html` y subirlo a Cloudflare Pages
- Versiones antiguas se conservan como referencia (puede limpiarse cuando dejen de servir)

## Deploy
1. Worker: subir `rfeg-courses-worker-v7.js` a Cloudflare Workers (`rfeg-courses.alberto76.workers.dev`)
2. Frontend: copiar `v14.html` → `index.html` y subirlo a Cloudflare Pages (`golf-handicap.alberto76.workers.dev`)

## Desarrollo local
- Frontend: abrir `v14.html` en el navegador (funciona contra el Worker en producción)
- Worker: `wrangler dev` para probar cambios antes de desplegar

## Glosario RFEG
- **Licencia**: número público de federado (ej. 503218). No es la licencia RFEG completa (formato XX12345678).
- **federatedId**: ID interno de `api.rfegolf.es` (ej. 26291). Se obtiene vía login.
- **Vinculados**: familiares enlazados a tu cuenta RFEG — acceso completo a sus datos vía tu sesión.

## IDs conocidos
- Alberto: licencia=503218, federatedId=26291
- Guillermo: licencia=995317, federatedId=330075 (vinculado)
- Raúl: licencia=924203, federatedId=328208 (no vinculado)

## Sistema híbrido de obtención de datos (v14)
Cascada de 4 intentos en `fetchParse()`:
1. **PDF público** vía `api.rfeg.es` (Worker `/?pdf=lic`) — cualquier licencia si backend RFEG activo
2. **PDF autenticado** vía `api.rfegolf.es/whs/{id}/world-handicap` (`/?auth_pdf=fedId`) — requiere login, solo propio + vinculados
3. **HI actual** vía `api.rfegolf.es/federated/{id}/handicap` (`/?auth_handicap=fedId`) — requiere login, funciona para cualquier federado
4. **Scores** vía `api.rfegolf.es/federated/{id}/scores` (`/?auth_scores=fedId`) — requiere login, solo propio + vinculados

Si solo hay HI sin PDF → dashboard limitado (sin tabs Campos/Rondas/Simulador).

## Mapa de autorización API rfegolf.es
| Endpoint | ¿Propietario? | Notas |
|---|---|---|
| `/federated/{id}/handicap` | No | Cualquier sesión activa |
| `/federated/{id}/rankings` | No | Cualquier sesión activa |
| `/federated/{id}/scores` | Sí | Propio + vinculados |
| `/federated/{id}/games` | Sí | Propio + vinculados |
| `/federated/{id}` (perfil) | Sí | Propio + vinculados |
| `/whs/{id}/world-handicap` | Sí | Propio + vinculados, devuelve PDF |

## Endpoints del Worker (v7)
- `GET /?search=nombre` — busca clubs
- `GET /?club_id=X&slug=Y` — datos tees
- `GET /?pdf=licencia` — PDF público
- `GET /?player=nombre` — busca jugador
- `POST /?auth_pdf={fedId}` — login + PDF (body: `{username, password}`)
- `POST /?auth_handicap={fedId}` — login + HI actual
- `POST /?auth_scores={fedId}` — login + historial scores

## Privacidad
- Credenciales solo en sesión (`window._rfegCreds`), se borran al recargar
- Mappings licencia→fedId en `window._rfegFedIds` (sesión)
- Aviso LOPD/RGPD en `LoginModal`
