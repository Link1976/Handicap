# Golf Handicap RFEG - Contexto v13.1

## Qué es
App web para seguir el hándicap de golf de Guillermo (995317), Raúl (924203) y Alberto (503218) Ruiz de Infante. Consulta automáticamente el PDF de la RFEG, parsea los datos y muestra dashboard interactivo.

## Stack
- HTML único con React 18 + Babel (sin build)
- PDF.js (browser-side parsing)
- Cloudflare Pages: hosting del index.html en `golf-handicap.alberto76.workers.dev`
- Descarga directa del PDF desde `https://api.rfeg.es/files/summaryhandicap/{licencia}.pdf`
- Fallback a proxy Worker `https://golf-rfeg-pro.alberto76.workers.dev` (roto, devuelve 0 bytes)
- **Worker principal** `https://rfeg-courses.alberto76.workers.dev` (v6, pendiente deploy)
- localStorage: perfiles, histórico HI, objetivos

## Versiones de ficheros
- `v13_1.html` → index.html desplegado en Cloudflare Pages (con 3 intentos de descarga PDF)
- `rfeg-courses-worker-v6.js` → Worker pendiente de desplegar (añade /?player= y /?pdf=)

## Funcionalidades v13.1

### Descarga de PDF — 3 intentos en cascada
1. Worker `golf-rfeg-pro` (roto, devuelve 0 bytes siempre)
2. Descarga directa a `api.rfeg.es` (falla por CORS en navegador)
3. Worker `rfeg-courses/?pdf=licencia` (funciona cuando el backend RFEG está activo)

### Tabs (menú de iconos)
- 📈 Evolución, ⛳ Campos, 🎯 Objetivo, 🧮 HCP Juego, 📋 Rondas, 🏌️ Simulador
- Buscador de campos RFEG en Simulador y HCP Juego

## Problema crítico: PDF de api.rfeg.es caído
- El endpoint `api.rfeg.es/files/summaryhandicap/{licencia}.pdf` devuelve HTTP 200 con 0 bytes
- Es un problema del backend legacy de la RFEG (nginx sirve ficheros vacíos)
- Solo funcionan PDFs que estén en caché del servidor/navegador de sesiones anteriores
- No tiene solución desde fuera — requiere intervención de la RFEG

## Investigación API rfegolf.es (nueva)
- Dominio: `api.rfegolf.es` (distinto a `api.rfeg.es`)
- Auth: OAuth con cookie JWT httpOnly
- Login: `POST https://api.rfegolf.es/auth/login?realm=FED` con body JSON `{username, password}`
- Tras login se establece cookie `JWT=...` y `JWT_REFRESH_TOKEN=...`

### IDs internos descubiertos
- Alberto: federatedId=26291, userId=236664
- Guillermo: federatedId=330075, licencia=995317
- Raúl: federatedId=328208, licencia=924203

### Endpoints descubiertos en api.rfegolf.es
- `GET /users/me` → perfil del usuario logado (incluye federatedId)
- `GET /federated/{id}/handicap` → HI actual, status, categoría
- `GET /federated/{id}/scores` → historial HI por fecha (solo propio y vinculados)
- `GET /federated/{id}/games?page=0&pageSize=20` → lista partidas con gameId y clubId
- `GET /federated/{id}/games/{gameId}` → detalle partida: teeColorType, teeGender, holes, summary
- `GET /whs/{id}/world-handicap` → **PDF completo 1.4MB** ✅ (solo propio y vinculados)

### Restricciones de acceso
- Con sesión del usuario: solo puede ver su propio perfil y jugadores vinculados a su cuenta
- Guillermo (330075) accesible desde cuenta de Alberto (vinculación desconocida, mismo apellido)
- Raúl (328208) da 403/404 — no vinculado
- La app móvil RFEG muestra datos de cualquier jugador — usa client_id diferente (por descubrir)

### Endpoint de búsqueda pública de jugadores
- `api.rfeg.es/web/search/handicap?q=nombre_o_licencia` — requiere token Bearer coded_xxx
- Devuelve: id_ref, guid_licence, full_name, handicap, date_hdc_updated_at, club_title
- El token se obtiene igual que para búsqueda de clubs (scraping de rfegolf.es/clubes)
- Worker v6 añade endpoint `/?player=licencia` que usa este sistema

### Flujo potencial sin PDF (parcialmente implementado)
1. `/?player=licencia` → id_ref del jugador (via token coded_xxx)
2. `GET /federated/{id}/games` → lista con clubId + gameId
3. `GET /federated/{id}/games/{gameId}` → teeColorType + teeGender
4. Worker cursos: clubId → Vc/Slope/Par por barras/género
5. Calcular diferencial WHS
- **Bloqueado**: paso 2-3 requiere auth y da 403 para jugadores no vinculados

## Worker rfeg-courses v6 (pendiente deploy)
- URL: `https://rfeg-courses.alberto76.workers.dev`
- `/?search=nombre` → busca clubs (v1)
- `/?club_id=X&slug=Y` → datos Vc/Slope/Par (v1)
- `/?pdf=licencia` → descarga PDF con token Bearer (v5, funciona cuando backend activo)
- `/?player=licencia` → busca jugador, devuelve id_ref y HI actual (v6, nuevo)

## Próximo paso clave
Interceptar tráfico de app móvil RFEG con Charles Proxy en Mac Big Sur + iPhone.
Objetivo: descubrir si la app usa un client_id OAuth diferente que permite acceder
a datos de cualquier federado sin restricciones de vinculación.
Charles Proxy: https://www.charlesproxy.com (30 días gratis, funciona en Big Sur)

## Fórmulas WHS implementadas
- **Diferencial**: (RBA - Valor de Campo - ASC) × 113 / Slope
- **Handicap Index**: media de los N mejores diferenciales de las últimas 20 rondas
- **HCP de Juego**: HI × (Slope / 113) + (Valor de Campo - Par), redondeado

## Limitaciones conocidas
- PDF de api.rfeg.es inestable — backend legacy RFEG con caídas
- golf-rfeg-pro Worker roto (devuelve 0 bytes)
- localStorage por dispositivo, no sincronizado
- App móvil RFEG tiene acceso completo pero no sabemos cómo replica eso desde fuera
