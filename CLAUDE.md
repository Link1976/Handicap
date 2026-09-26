# handicap-app (HCAPP)

App web (single-file HTML, instalable como PWA) para consultar el handicap RFEG, ver evolución de rondas, estadísticas por campo, simular futuras rondas, defender el handicap y calcular el handicap de juego. Uso personal y familiar.

**Estado:** activo — v17 (septiembre 2026)

---

## Stack

| Capa | Tecnología | Archivo |
|------|-----------|---------|
| Frontend | HTML single-file + React 18 UMD + Babel standalone | `v17.html` (fuente) → `index.html` (desplegado) |
| Hosting frontend | Cloudflare Worker `golf-handicap` que sirve assets estáticos | `worker-static.js` + `wrangler.toml` |
| PWA | Manifest + iconos + service worker (cache del shell) | `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `sw.js` |
| Backend datos | Cloudflare Worker `rfeg-courses` (JS ES modules) | `rfeg-courses-worker-v7.js` |

React y Babel se cargan desde CDN (sin build step). El frontend apunta siempre al worker de datos en producción.

---

## URLs

| Servicio | URL |
|----------|-----|
| App | https://golf-handicap.alberto76.workers.dev |
| Worker de datos | https://rfeg-courses.alberto76.workers.dev |
| Repo GitHub | https://github.com/Link1976/Handicap |

---

## Workflow de desarrollo

```bash
# Desarrollo local: editar v17.html y previsualizarlo
# (.claude/launch.json levanta un servidor python en el puerto 8899; no está en git)

# Deploy frontend
cp v17.html index.html
wrangler deploy --dry-run   # valida
wrangler deploy             # usa wrangler.toml → worker golf-handicap

# Deploy worker de datos
wrangler deploy rfeg-courses-worker-v7.js --name rfeg-courses --compatibility-date 2024-01-01
```

- Verificar en producción con cache-busting (`?nc=timestamp`): el navegador y el service worker cachean el shell.
- Antes de desplegar, `git pull`: pueden llegar commits desde sesiones web de Claude (ramas `claude/*`).
- Ojo: `wrangler.toml` de la raíz es del worker `golf-handicap`. Al desplegar `rfeg-courses` comprobar que conserva el binding KV `RFEG_CACHE` (el código funciona sin él, pero sin caché de búsqueda).
- Versiones: cada iteración grande genera un nuevo `vXX.html`. `index.html` debe ser copia exacta de la versión activa.

### `worker-static.js`

Sirve `index.html`, `manifest.webmanifest` e iconos (importados vía reglas `Text`/`Data` de `wrangler.toml`). `sw.js` se sirve **inline como string constante** (`SW_SOURCE`), no como import: importarlo hizo que Cloudflare lo ejecutara como código del worker en la validación y crasheara. El `sw.js` de la raíz es solo referencia — los cambios hay que hacerlos en `SW_SOURCE`.

---

## Arquitectura frontend (v17.html)

### Red — `fetchT(url, opts, ms)`

Wrapper de `fetch` con `AbortController`: timeout de 15 s (12 s en el buscador de campos). Toda llamada de red debe pasar por aquí.

### Flujo de datos — `fetchParse(lic, onMsg)`

Cascada de 4 intentos para obtener datos del jugador:

1. **PDF público** `GET /?pdf=licencia` — cualquier licencia, sin login
2. **PDF autenticado** `POST /?auth_pdf=fedId` — requiere login, solo propio + vinculados
3. **HI actual** `POST /?auth_handicap=fedId` — requiere login, funciona para cualquier federado (datos limitados, sin rondas)
4. **Scores history** `POST /?auth_scores=fedId` — requiere login, solo propio + vinculados

Si solo se obtiene HI (intento 3) → dashboard muestra datos limitados, sin tabs Rondas / Campos / Simulador. El último resultado bueno se guarda en `gd_<lic>` como caché.

### Motor WHS — funciones puras

```
getTakeCount(count)         tabla WHS: cuántos diferenciales usar
calcHandicapIndex(rounds)   media de los N mejores de las últimas 20 rondas (máx 54.0)
getBestIndices(rounds)      Set de índices de rondas que computan
simulateNextRound(...)      nuevo HI tras una ronda hipotética (usa rounds.slice(-19): sustituye la más antigua)
calcDefensePlan(rounds)     diferencial máximo a repetir en 1, 2, 3… rondas para que el HI no suba
estimateHIHistory(rounds)   reconstruye la evolución del HI aplicando el motor ronda a ronda
```

**Tabla WHS de diferenciales utilizados** (implementada en `getTakeCount`):

| Rondas | Usan |
|--------|------|
| 3–5    | 1 mejor |
| 6–8    | 2 mejores |
| 9–11   | 3 mejores |
| 12–14  | 4 mejores |
| 15–16  | 5 mejores |
| 17–18  | 6 mejores |
| 19     | 7 mejores |
| 20     | 8 mejores |

El HI calculado tiene tope máximo de **54.0** (límite WHS). PCC y ESR no están implementados.

**Defender el handicap** (`calcDefensePlan`): localiza la primera ronda que computa y está a punto de salir de la ventana de 20, y calcula el umbral contra el **HI publicado** (1 decimal), no contra la media exacta — decisión consciente. Se muestra como `≤ N` (un número suelto se leía como mínimo). Oculto con menos de 20 rondas.

**Evolución del HI**: la gráfica usa `estimateHIHistory` (no depende de visitas previas) y se etiqueta como "estimación" porque no incluye PCC/ESR ni topes de subida.

### Parser de PDF — `extractRFEGData(fullText, pages)`

El PDF de la RFEG tiene 5 páginas. La app extrae:
- **Página 1** (`extractPage1Data`): fecha, campo, CR, Slope, HCP de juego, Stableford, ASC
- **Página 3** (`extractPage3Data`): fecha, torneo, RBA, CR, Slope, ASC, diferencial
- **Página 5** (`extractDifferentials`): lista de diferenciales

Los datos de las tres páginas se fusionan por índice posicional y se ordenan cronológicamente.

### Diseño y temas

Marca HCAPP: logo SVG propio, paleta "Torneo" (verde `#046A38` dominante, amarillo `#F5D400` puntual), tipografía Space Grotesk + JetBrains Mono, iconos de pestaña SVG (`TAB_ICONS`).

Dos temas: `THEMES.dark` y `THEMES.paper` (alto contraste para exteriores), toggle en la cabecera. `applyTheme()` reescribe el objeto mutable `C` en cada render de `App`; como ningún componente usa `React.memo`, todo el árbol se retematiza.

**Regla**: todo color nuevo va como token en **ambos** temas, nunca como hex/rgba literal (ha causado varias rondas de bugs de contraste). Excepción documentada: el modal de login usa la paleta fija `MODAL_C`.

### Componentes principales

| Componente | Función |
|-----------|---------|
| `App` | Raíz. Estados: `home` / `loading` / `dashboard`. Perfiles en localStorage |
| `Header` / `Logo` | Cabecera sticky con logo y toggle de tema |
| `HIndexCard` | Tarjeta del HI actual |
| `LoginModal` | Login RFEG, credenciales en sesión, mapa licencia→fedId |
| `Simulator` | Simulador 18H y 9H. Modo 9H: diferencial combinado = dif. 9H real + HI/2 esperado |
| `DefensePlan` | "Defender el handicap" dentro del Simulador (se calcula al entrar, sin pulsar SIMULAR) |
| `PlayingHCP` | Handicap de juego: `HI × (Slope/113) + (CR − Par)` |
| `CourseSearch` | Buscador de campos RFEG con selector de tee y favoritos. Scraping en tiempo real |
| `CourseStats` | Estadísticas por campo: media, mejor/peor diferencial, mejor Stableford |
| `HIChart` | Gráfica SVG de evolución del HI. Soporta comparativa entre dos jugadores |
| `HIGoal` | Seguimiento de objetivo de handicap con barra de progreso |
| `RoundRow` | Fila de ronda (modo compacto mobile y modo desktop) |
| `RoundDetailModal` | Detalle de ronda + compartir como imagen (Web Share API) |

### Almacenamiento

| Clave | Contenido |
|-------|-----------|
| `localStorage["gp"]` | Perfiles guardados (nombre, licencia, HI, fecha) |
| `localStorage["gh_<lic>"]` | Historial de HI consultado |
| `localStorage["gd_<lic>"]` | Caché del último resultado (nombre, HI, rondas, timestamp) |
| `localStorage["goal_<lic>"]` | Objetivo de handicap |
| `localStorage["gf"]` | Mapa licencia → federatedId (arranca con `BOOT_FED_IDS`) |
| `localStorage["cfav"]` | Campos favoritos (máx. 5) |
| `localStorage["theme_paper"]` | Tema Papel activo (`"1"`/`"0"`) |
| `sessionStorage["rc"]` | Credenciales, solo si el usuario marca mantener sesión (muere con la pestaña) |
| `window._rfegCreds` | Credenciales en memoria |

### IDs conocidos (`BOOT_FED_IDS`)

| Jugador | Licencia | federatedId | Notas |
|---------|----------|-------------|-------|
| Alberto | 503218 | 26291 | Titular |
| Guillermo | 995317 | 330075 | Vinculado |
| Raúl | 924203 | 328208 | No vinculado |

---

## Arquitectura backend (rfeg-courses-worker-v7.js)

### Endpoints

| Método | Parámetro | Función | Requiere auth |
|--------|-----------|---------|--------------|
| `GET` | `?search=nombre` | Busca clubs por nombre | No |
| `GET` | `?club_id=X&slug=Y` | Tees y ratings de un club | No |
| `GET` | `?pdf=licencia` | PDF de handicap | No |
| `GET` | `?player=nombre` | Busca jugador por nombre/licencia | No |
| `POST` | `?auth_pdf=fedId` | Login + PDF completo | Sí |
| `POST` | `?auth_handicap=fedId` | Login + HI actual | Sí |
| `POST` | `?auth_scores=fedId` | Login + historial scores | Sí |

Los endpoints POST esperan body JSON `{username, password}`.

### Caché KV (Cloudflare KV: `RFEG_CACHE`)

| Tipo | TTL | Estado |
|------|-----|--------|
| Búsqueda de clubs (`wpsearch_<query>`) | 7 días | Activo |
| Tees de campo | — | Deshabilitado — scraping en tiempo real |

El cache de tees se deshabilitó porque la RFEG actualiza CR/Slope sin aviso y el cache de 30 días mostraba valores obsoletos.

### Fuente de datos: rfegolf.es (WordPress)

rfegolf.es es un WordPress. El token `coded_…` y `api.rfeg.es/web/search/club` no existen; `rfeg-courses-worker-v7_1.js` (histórico) todavía los usa, no tomarlo como referencia.

- **Búsqueda** (`searchViaWordPress`): API REST de WordPress `rfegolf.es/wp-json/wp/v2/club?search=…`. El `id` devuelto es el ID del post de WordPress; el nombre sale de `yoast_head_json.title`.
- **Tees** (`parseClubHTML`): parsea `rfegolf.es/club/{slug}` (solo necesita el slug):
  1. Cada tee es un `<option value="rcpanel_{post}_{recorrido}_{n}">CLUB - Recorrido - TEE (M|F)</option>`
  2. Su tarjeta está en el panel `id="rcpanel_…"`: Par y Metros = última celda de su fila; `Vc: X` / `Vs: Y` en `.holes-table-footer`
- Si el slug da 404 (favoritos guardados con slugs antiguos tipo `forus_golf_las_rejas`), se resuelve buscando el slug en la API de WordPress.
- **PDF público** (`fetchPDF`): `api.rfeg.es/files/summaryhandicap/{licencia}.pdf` ya sirve sin token; el token solo se envía si todavía aparece. Reintenta hasta 5 veces porque el servidor da HTTP 500 aleatorios.

### Autenticación RFEG

Login vía `POST https://api.rfegolf.es/auth/login?realm=FED` con `{username, password}`. La RFEG devuelve cookies de sesión que se usan en peticiones siguientes. Respuesta 200 sin cookies = credenciales incorrectas.

### Mapa de autorización API rfegolf.es

| Endpoint | Acceso |
|----------|--------|
| `/federated/{id}/handicap` | Cualquier sesión activa |
| `/federated/{id}/scores` | Solo propio + vinculados |
| `/whs/{id}/world-handicap` | Solo propio + vinculados (PDF) |

---

## Archivos

- **Activos**: `v17.html`, `index.html`, `worker-static.js`, `wrangler.toml`, `manifest.webmanifest`, iconos PNG, `sw.js` (referencia), `rfeg-courses-worker-v7.js`, `BACKLOG.md`
- **Históricos, no tocar**: `v14.html`, `v15.html`, `v16.html`, `rfeg-courses-worker-v7_1.js` (diagnóstico, no en producción)
- `.env` contiene el token de Cloudflare: está en `.gitignore`, nunca commitearlo.

---

## Glosario RFEG

- **Licencia**: número público de federado (ej. `503218`).
- **federatedId**: ID interno de `api.rfegolf.es` (ej. `26291`). Se obtiene al hacer login.
- **Vinculados**: familiares enlazados a la cuenta RFEG.
- **VC / Valor de Campo / CR**: Course Rating. Puntuación esperada para un jugador scratch.
- **Slope**: dificultad relativa para el jugador bogey vs scratch. Base = 113.
- **ASC**: Ajuste de Stroke Control. Reducción por condiciones adversas.
- **Diferencial**: `(Bruta − CR − ASC) × 113 / Slope`. Medida de rendimiento normalizada.

---

## Privacidad

- Credenciales en memoria (`window._rfegCreds`); opcionalmente en `sessionStorage` si el usuario marca mantener sesión. Nunca en `localStorage`.
- El worker es un proxy: nunca almacena credenciales.
- Aviso LOPD/RGPD en el modal de login.
- CORS abierto (`*`) en el worker — aceptable para consulta de datos propios.

---

## Limitaciones conocidas

- **Scraping frágil**: `parseClubHTML` usa regex contra el HTML de rfegolf.es. Un cambio en su layout rompería el parser silenciosamente (array de tees vacío). Ya pasó con la migración a WordPress.
- **PDF no siempre disponible**: el intento 1 falla a menudo. El sistema hace fallback a los siguientes intentos.
- **PCC y ESR no implementados**: afecta al HI calculado y a la evolución estimada.
- **Tees de 9 hoyos**: algunos campos muestran ratings de 18H equivalentes de forma inconsistente en la RFEG. El simulador de 9H usa el rating introducido por el usuario.
- **App carga sin datos**: casi siempre es el operador de red bloqueando IPs de `workers.dev`, no el código.
