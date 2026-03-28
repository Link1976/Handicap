# Golf Handicap RFEG - Contexto v11

## Qué es
App web para seguir el hándicap de golf de Guillermo (995317) y Raúl (924203) Ruiz de Infante, hijos de Alberto. Consulta automáticamente el PDF de la RFEG, parsea los datos y muestra dashboard interactivo.

## Stack
- HTML único con React 18 + Babel (sin build)
- PDF.js (browser-side parsing)
- Cloudflare Worker: `https://golf-rfeg-pro.alberto76.workers.dev` (proxy CORS)
- Cloudflare Pages: hosting del index.html
- localStorage: perfiles, histórico HI, objetivos

## Funcionalidades v11

### Siempre visible en dashboard
- Hero card (nombre, licencia, HI)
- Stats: rondas, computan, mejor, media
- H10/H5 con tendencia y tooltip explicativo

### Tabs (menú de iconos)
- 📈 **Evolución**: gráfica SVG del HI, comparar dos jugadores
- ⛳ **Campos**: stats por campo expandibles, barras, tooltips
- 🎯 **Objetivo**: meta de HI con barra de progreso, guardado en localStorage
- 🧮 **HCP Juego**: calculadora WHS (CR + Slope + Par → golpes)
- 📋 **Rondas**: tabla últimas 20, ⭐ computan
- 🏌️ **Simulador**: qué pasaría con una nueva ronda

### Sistema multi-jugador
- Perfiles en localStorage, click para consultar
- Histórico HI solo añade punto cuando cambia

## Parser PDF - Estado actual
- Página 1: torneo + campo + CR/Slope/Par + STB (regex acepta vuelta 1-9)
- Página 3: valor campo, slope, ASC, nivel jugado
- Página 5: diferenciales finales
- Resolución de nombres: si no hay campo, busca por CR/Slope en rondas que sí lo tienen
- Nombres de torneo detectados por palabras clave (Jornada, Torneo, Ranking, etc.)

## Bugs corregidos en v11
- Regex de página 1 solo aceptaba vuelta=1, perdía torneos multi-día (Copa Santa Marina 3 vueltas, Copa Federación Cántabra 2 vueltas, etc.)
- Nombres de campo con número de vuelta pegado al principio → limpiado con regex
- Torneo usado como nombre de campo cuando parser fallaba → resolución por CR/Slope
- Header no clickable / botón INICIO no funcionaba → goHome con reset de estado
- H10/H5 desaparecían → componentes se perdieron en edición incremental, reconstruido desde cero

## Limitaciones conocidas
- Mismo campo con nombres diferentes (ej: "Centro Tecnificacion - P&p" vs "Centro Tecnificacion - Centro De Tecnificación") no se agrupan automáticamente. Deprioritizado.
- PDF.js extrae texto diferente a pdftotext — los regex están calibrados para pdftotext pero funcionan razonablemente con PDF.js
- localStorage es por dispositivo/navegador, no se sincroniza entre dispositivos

## Próximos pasos posibles
- Compartir tarjeta por WhatsApp (imagen con HI)
- Mejoras de diseño/UX de las secciones existentes
- Capacitor para App Store (futuro lejano)
- Cloud sync (requiere auth)

## Ficheros
- `v11.html` → renombrar a `index.html` para deploy
- `cloudflare-worker.js` → ya desplegado, no cambió
