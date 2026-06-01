# handicap-app

App web (single-file HTML) para consultar el handicap RFEG, ver evolución de rondas, estadísticas por campo, simular futuras rondas y calcular el handicap de juego. Uso personal y familiar.

**Estado:** activo — v14 (mayo 2026)

---

## Stack

| Capa | Tecnología | Archivo |
|------|-----------|---------|
| Frontend | HTML single-file + React 18 UMD + Babel standalone | `v14.html` / `index.html` |
| Backend | Cloudflare Worker (JS ES modules) | `rfeg-courses-worker-v7.js` |
| Deploy frontend | Cloudflare Pages | `index.html` |
| Deploy backend | Cloudflare Workers | worker name: `rfeg-courses` |

React y Babel se cargan desde CDN (sin build step). El HTML se abre directamente en el navegador para desarrollo local, apuntando siempre al worker en producción.

---

## URLs

| Servicio | URL |
|----------|-----|
| App (Cloudflare Pages) | https://golf-handicap.alberto76.workers.dev |
| Worker (backend) | https://rfeg-courses.alberto76.workers.dev |
| Repo GitHub | https://github.com/Link1976/Handicap |

---

## Workflow de desarrollo

```bash
# Desarrollo local
abrir v14.html en el navegador (apunta al worker en producción)

# Deploy worker
wrangler deploy rfeg-courses-worker-v7.js --name rfeg-courses --compatibility-date 2024-01-01

# Deploy frontend
cp v14.html index.html
# subir index.html a Cloudflare Pages vía dashboard
```

Versiones: cada iteración grande genera un nuevo `vXX.html`. Sincronizar siempre `index.html` con la versión activa antes de deploy.

---

## Arquitectura frontend (v14.html)

### Flujo de datos — `fetchParse(lic, onMsg)`

Cascada de 4 intentos para obtener datos del jugador:

1. **PDF público** `GET /?pdf=licencia` — cualquier licencia, sin login
2. **PDF autenticado** `POST /?auth_pdf=fedId` — requiere login, solo propio + vinculados
3. **HI actual** `POST /?auth_handicap=fedId` — requiere login, funciona para cualquier federado (datos limitados, sin rondas)
4. **Scores history** `POST /?auth_scores=fedId` — requiere login, solo propio + vinculados

Si solo se obtiene HI (intento 3) → dashboard muestra datos limitados, sin tabs Rondas / Campos / Simulador.

### Motor WHS — funciones puras

```
getTakeCount(count)         tabla WHS: cuántos diferenciales usar
calcHandicapIndex(rounds)   media de los N mejores de las últimas 20 rondas (máx 54.0)
getBestIndices(rounds)      Set de índices de rondas que computan
simulateNextRound(...)      nuevo HI tras una ronda hipotética
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

El HI calculado tiene tope máximo de **54.0** (límite WHS). PCC y ESR no están implementados (diferencia mínima para uso personal).

### Parser de PDF — `extractRFEGData(fullText, pages)`

El PDF de la RFEG tiene 5 páginas. La app extrae:
- **Página 1** (`extractPage1Data`): fecha, campo, CR, Slope, HCP de juego, Stableford, ASC
- **Página 3** (`extractPage3Data`): fecha, torneo, RBA, CR, Slope, ASC, diferencial
- **Página 5** (`extractDifferentials`): lista de diferenciales

Los datos de las tres páginas se fusionan por índice posicional y se ordenan cronológicamente.

### Componentes principales

| Componente | Función |
|-----------|---------|
| `App` | Raíz. Estados: `home` / `loading` / `dashboard`. Perfiles en localStorage |
| `LoginModal` | Login RFEG, credenciales en sesión, mapa licencia→fedId |
| `Simulator` | Simulador 18H y 9H. Modo 9H: diferencial combinado = dif. 9H real + HI/2 esperado |
| `PlayingHCP` | Handicap de juego: `HI × (Slope/113) + (CR − Par)` |
| `CourseSearch` | Buscador de campos RFEG con selector de tee. Scraping en tiempo real |
| `CourseStats` | Estadísticas por campo: media, mejor/peor diferencial, mejor Stableford |
| `HIChart` | Gráfica SVG de evolución del HI. Soporta comparativa entre dos jugadores |
| `HIGoal` | Seguimiento de objetivo de handicap con barra de progreso |
| `RoundRow` | Fila de ronda (modo compacto mobile y modo desktop) |

### Almacenamiento

| Clave | Contenido |
|-------|-----------|
| `localStorage["gp"]` | Perfiles guardados (nombre, licencia, HI, fecha) |
| `localStorage["gh_<lic>"]` | Historial de HI para la gráfica de evolución |
| `localStorage["goal_<lic>"]` | Objetivo de handicap |
| `window._rfegCreds` | Credenciales de sesión (solo memoria, se borran al recargar) |
| `window._rfegFedIds` | Mapa licencia → federatedId (inicializado con IDs conocidos) |

### IDs conocidos (hardcodeados en la app)

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
| `GET` | `?pdf=licencia` | PDF de handicap (token público) | No |
| `GET` | `?player=nombre` | Busca jugador por nombre/licencia | No |
| `POST` | `?auth_pdf=fedId` | Login + PDF completo | Sí |
| `POST` | `?auth_handicap=fedId` | Login + HI actual | Sí |
| `POST` | `?auth_scores=fedId` | Login + historial scores | Sí |

Los endpoints POST esperan body JSON `{username, password}`.

### Caché KV (Cloudflare KV: `RFEG_CACHE`)

| Tipo | TTL | Estado |
|------|-----|--------|
| Búsqueda de clubs | 7 días | Activo |
| Tees de campo | — | Deshabilitado — scraping en tiempo real |

El cache de tees se deshabilitó porque la RFEG actualiza CR/Slope sin aviso y el cache de 30 días mostraba valores obsoletos.

### Scraping de tees — `parseClubHTML`

Parsea `rfegolf.es/club/{slug}?id={clubId}` con dos pasos:
1. Extrae definiciones de tee de las llamadas `selectWay(nombre, color, género, orden, wayId)`
2. Para cada tee, localiza su sección HTML mediante el ancla `id="holes_{wayId}"` y extrae el bloque `TOTAL/Vc/Vs` dentro de esa sección

Los tees sin bloque en su sección (normalmente porque comparten tabla con otro tee) se omiten del resultado. Este enfoque es robusto frente a campos donde el número de bloques no coincide con el número de `selectWay` (problema presente en El Encín, CNG y otros campos de la RFEG).

### Autenticación RFEG

Login vía `POST https://api.rfegolf.es/auth/login?realm=FED` con `{username, password}`. La RFEG devuelve cookies de sesión que se usan en peticiones siguientes. Respuesta 200 sin cookies = credenciales incorrectas.

### Mapa de autorización API rfegolf.es

| Endpoint | Acceso |
|----------|--------|
| `/federated/{id}/handicap` | Cualquier sesión activa |
| `/federated/{id}/scores` | Solo propio + vinculados |
| `/whs/{id}/world-handicap` | Solo propio + vinculados (PDF) |

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

- Credenciales solo en `window._rfegCreds` (sesión). Se borran al recargar.
- El worker es un proxy: nunca almacena credenciales.
- Aviso LOPD/RGPD en el modal de login.
- CORS abierto (`*`) en el worker — aceptable para consulta de datos propios.

---

## Limitaciones conocidas

- **Scraping frágil**: `parseClubHTML` usa regex contra HTML de rfegolf.es. Un cambio en su layout rompería el parser silenciosamente (array de tees vacío).
- **PDF no siempre disponible**: El intento 1 falla frecuentemente. El sistema hace fallback a los siguientes intentos.
- **PCC y ESR no implementados**: El cálculo de HI no incluye Playing Conditions Calculation ni Exceptional Score Reduction del WHS oficial.
- **Tees de 9 hoyos**: Algunos campos muestran ratings de 18H equivalentes de forma inconsistente en la RFEG. El simulador de 9H usa el rating introducido por el usuario.
