# Golf Handicap RFEG - Contexto v13

## Qué es
App web para seguir el hándicap de golf de Guillermo (995317), Raúl (924203) y Alberto (503218) Ruiz de Infante. Consulta automáticamente el PDF de la RFEG, parsea los datos y muestra dashboard interactivo.

## Stack
- HTML único con React 18 + Babel (sin build)
- PDF.js (browser-side parsing)
- Cloudflare Pages: hosting del index.html en `golf-handicap.alberto76.workers.dev`
- Descarga directa del PDF desde `https://api.rfeg.es/files/summaryhandicap/{licencia}.pdf`
- Fallback a proxy Worker `https://golf-rfeg-pro.alberto76.workers.dev` si CORS falla
- **Nuevo Worker** `https://rfeg-courses.alberto76.workers.dev` para búsqueda de campos y datos de Vc/Slope/Par
- localStorage: perfiles, histórico HI, objetivos

## Funcionalidades v13

### Siempre visible en dashboard
- Hero card (nombre, licencia, HI)
- Stats: rondas, computan, mejor, media
- H10/H5 con tendencia y tooltip explicativo

### Tabs (menú de iconos)
- 📈 **Evolución**: gráfica SVG del HI, comparar dos jugadores
- ⛳ **Campos**: stats por campo expandibles, barras, tooltips
- 🎯 **Objetivo**: meta de HI con barra de progreso, guardado en localStorage
- 🧮 **HCP Juego**: calculadora WHS con **buscador de campos RFEG** integrado
- 📋 **Rondas**: tabla últimas 20, ⭐ computan
- 🏌️ **Simulador**: qué pasaría con una nueva ronda, con ajuste ASC y **buscador de campos RFEG** integrado

### Buscador de campos RFEG (NUEVO v13)
- Componente `CourseSearch` reutilizable, integrado en Simulador y HCP Juego
- Busca cualquier campo de golf en España por nombre (via API RFEG)
- Muestra todos los recorridos del campo (ej: "Las Rejas", "Pares 3", "Mixto")
- Muestra todas las barras disponibles por recorrido (AMARILLAS, BLANCAS, ROJAS, etc.) con género (M/F)
- Al seleccionar barras: auto-rellena Valor de Campo, Slope y Par
- Los campos numéricos siguen siendo editables manualmente
- Datos cacheados 30 días en Cloudflare KV

### Sistema multi-jugador
- Perfiles en localStorage, click para consultar
- Histórico HI solo añade punto cuando cambia

## Worker rfeg-courses (NUEVO v13)
- URL: `https://rfeg-courses.alberto76.workers.dev`
- **`/?search=nombre`**: Busca clubs en la RFEG
  - Obtiene token dinámico scrapeando rfegolf.es (el token `coded_xxx` cambia en cada carga de página)
  - Llama a `api.rfeg.es/web/search/club?q=nombre` con el token
  - Devuelve JSON: id, name, slug, city, community, holes
- **`/?club_id=448&slug=forus_golf_las_rejas`**: Datos de recorridos
  - Scrapes `rfegolf.es/club/{slug}?id={id}` (HTML server-rendered)
  - Extrae tees del dropdown `selectWay('CLUB - Recorrido','BARRAS','M/F','colorCode','wayId')`
  - Extrae Vc/Vs/Par de las tablas de scorecard (patrón: TOTAL → par → metros → Vc → valor → Vs → valor)
  - Devuelve JSON: club, tees[{recorrido, tee, gender, par, vc, vs, meters}]
- **KV Cache**: namespace `RFEG_CACHE`, TTL 30 días para datos de campo, 7 días para búsquedas

## Descubrimientos técnicos sobre rfegolf.es
- La web es una SPA (jQuery + server-rendered HTML)
- API base: `https://api.rfeg.es`
- Endpoints encontrados: `/web/search/club?q=`, `/web/club/way/pdf?id=`, `/web/club/competitions?id=`, `/web/club/news?id=`
- Autenticación: Bearer token dinámico (`coded_xxx`), embebido en el HTML/JS de cada página, cambia en cada carga
- El token se extrae con regex `coded_[a-f0-9]+` del HTML de rfegolf.es
- Los datos de Vc/Slope NO están en la API, solo en el HTML de las fichas de club
- Las fichas de club son server-rendered con scorecards completos incluyendo Vc y Vs al final de cada tabla
- Los nombres de barras/género están en llamadas `selectWay()` en el dropdown del HTML

## Cambios en v12 (mantenidos)
- Descarga directa RFEG con fallback a proxy
- Simulador con ajuste ASC
- Renombrado "Course Rating" a "Valor de Campo"
- Mejor diagnóstico de errores en descarga PDF

## Parser PDF - Estado actual
- Página 1: torneo + campo + CR/Slope/Par + STB (regex acepta vuelta 1-9)
- Página 3: valor campo, slope, ASC, nivel jugado
- Página 5: diferenciales finales
- Resolución de nombres: si no hay campo, busca por CR/Slope en rondas que sí lo tienen

## Fórmulas WHS implementadas
- **Diferencial**: (RBA - Valor de Campo - ASC) × 113 / Slope
- **Handicap Index**: media de los N mejores diferenciales de las últimas 20 rondas (N según tabla WHS)
- **HCP de Juego**: HI × (Slope / 113) + (Valor de Campo - Par), redondeado

## Limitaciones conocidas
- Mismo campo con nombres diferentes no se agrupan automáticamente
- PDF.js extrae texto diferente a pdftotext — los regex funcionan razonablemente
- localStorage es por dispositivo/navegador, no se sincroniza
- El ajuste ASC del simulador es manual
- El token de la API RFEG es dinámico; el Worker lo refresca en cada búsqueda

## Ficheros
- `v13.html` → renombrar a `index.html` para deploy en Cloudflare Pages
- Worker `rfeg-courses` desplegado en Cloudflare Workers con KV namespace `RFEG_CACHE`

## Próximos pasos posibles
- Compartir tarjeta por WhatsApp (imagen con HI)
- Mejoras de diseño/UX
- Capacitor para App Store (futuro lejano)
- Cloud sync (requiere auth)
