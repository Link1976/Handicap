# Golf Handicap RFEG - Contexto v12

## Qué es
App web para seguir el hándicap de golf de Guillermo (995317), Raúl (924203) y Alberto (503218) Ruiz de Infante. Consulta automáticamente el PDF de la RFEG, parsea los datos y muestra dashboard interactivo.

## Stack
- HTML único con React 18 + Babel (sin build)
- PDF.js (browser-side parsing)
- Cloudflare Pages: hosting del index.html en `golf-handicap.alberto76.workers.dev`
- Descarga directa del PDF desde `https://api.rfeg.es/files/summaryhandicap/{licencia}.pdf`
- Fallback a proxy Worker `https://golf-rfeg-pro.alberto76.workers.dev` si CORS falla
- localStorage: perfiles, histórico HI, objetivos

## Funcionalidades v12

### Siempre visible en dashboard
- Hero card (nombre, licencia, HI)
- Stats: rondas, computan, mejor, media
- H10/H5 con tendencia y tooltip explicativo

### Tabs (menú de iconos)
- 📈 **Evolución**: gráfica SVG del HI, comparar dos jugadores
- ⛳ **Campos**: stats por campo expandibles, barras, tooltips
- 🎯 **Objetivo**: meta de HI con barra de progreso, guardado en localStorage
- 🧮 **HCP Juego**: calculadora WHS (Valor de Campo + Slope + Par → golpes de ventaja)
- 📋 **Rondas**: tabla últimas 20, ⭐ computan
- 🏌️ **Simulador**: qué pasaría con una nueva ronda, con ajuste ASC opcional

### Sistema multi-jugador
- Perfiles en localStorage, click para consultar
- Histórico HI solo añade punto cuando cambia

## Cambios en v12 (respecto a v11)
- **Descarga directa RFEG**: la app intenta descargar el PDF directamente de `api.rfeg.es` sin proxy; si falla por CORS, usa el worker como fallback
- **Simulador con ajuste ASC**: nuevo campo "Ajuste ASC" (por defecto 0) que se resta de los golpes antes de calcular el diferencial. Fórmula: `(RBA - Valor de Campo - ASC) × 113 / Slope`
- **Renombrado "Course Rating"** a **"Valor de Campo"** en Simulador y HCP Juego
- **Mejor diagnóstico de errores**: mensajes de error más descriptivos cuando falla la descarga del PDF (tamaño, content-type, contenido)

## Parser PDF - Estado actual
- Página 1: torneo + campo + CR/Slope/Par + STB (regex acepta vuelta 1-9)
- Página 3: valor campo, slope, ASC, nivel jugado
- Página 5: diferenciales finales
- Resolución de nombres: si no hay campo, busca por CR/Slope en rondas que sí lo tienen
- Nombres de torneo detectados por palabras clave (Jornada, Torneo, Ranking, etc.)

## Fórmulas WHS implementadas
- **Diferencial**: (RBA - Valor de Campo - ASC) × 113 / Slope
- **Handicap Index**: media de los N mejores diferenciales de las últimas 20 rondas (N según tabla WHS)
- **HCP de Juego**: HI × (Slope / 113) + (Valor de Campo - Par), redondeado

## Bugs corregidos en v11 (mantenidos)
- Regex de página 1 solo aceptaba vuelta=1, perdía torneos multi-día
- Nombres de campo con número de vuelta pegado al principio → limpiado con regex
- Torneo usado como nombre de campo cuando parser fallaba → resolución por CR/Slope
- Header no clickable / botón INICIO no funcionaba → goHome con reset de estado
- H10/H5 desaparecían → reconstruido desde cero

## Limitaciones conocidas
- Mismo campo con nombres diferentes no se agrupan automáticamente. Deprioritizado.
- PDF.js extrae texto diferente a pdftotext — los regex funcionan razonablemente con PDF.js
- localStorage es por dispositivo/navegador, no se sincroniza entre dispositivos
- El ajuste ASC del simulador es manual; no se puede predecir antes de jugar

## Próximos pasos posibles
- Compartir tarjeta por WhatsApp (imagen con HI)
- Mejoras de diseño/UX de las secciones existentes
- Capacitor para App Store (futuro lejano)
- Cloud sync (requiere auth)

## Ficheros
- `v12.html` → renombrar a `index.html` para deploy en Cloudflare Pages
