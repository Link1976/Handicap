# Backlog — handicap-app

## Monetización (ideas, sin fecha)

> **Advertencia previa**: la app scrapea rfegolf.es y usa credenciales de usuarios contra la
> API no oficial de la RFEG. Monetizar abriéndola a terceros implica riesgo legal
> (términos de uso RFEG, tratamiento de credenciales ajenas, RGPD) y riesgo técnico
> (bloqueo de IP del worker si escala el scraping). Cualquier vía de monetización debe
> evitar almacenar credenciales de terceros y no escalar el scraping masivamente.

1. **Freemium ligero para conocidos/club**
   - Gratis: HI + rondas. "Pro" (pago único o 1-2 €/mes): simulador avanzado,
     comparativa multijugador, exportar PDF/imagen.
   - Bajo riesgo si se limita a un círculo pequeño (amigos del club), no como producto público.

2. **Insight con IA sobre el propio juego**
   - Análisis textual vía API de Claude: "por qué ha subido/bajado tu HI este trimestre,
     qué campos te penalizan más". Feature diferenciadora, justificable como "Pro".
   - Sinergia con la experiencia ya adquirida en portfolio-monitor.

3. **White-label para un club concreto**
   - Portal de socios para el propio club: relación contractual clara,
     sin depender de scrapear cuentas de desconocidos.

4. **Descartado**: apertura al público general con login RFEG masivo (riesgo bloqueo/ToS)
   y publicidad de terceros (no compensa en un nicho tan pequeño).

5. **Nueva vía: pedir acceso oficial a la API de la RFEG**
   - Tras rehacer su web (2026) tiene más sentido plantearlo. Un "no" también sirve para decidir.

### Acceso a datos tras la migración de rfegolf.es a WordPress (análisis 2026-09-24)

Estado comprobado en vivo:

| Vía | Estado | Qué da |
|-----|--------|--------|
| PDF público `api.rfeg.es/files/summaryhandicap/{licencia}.pdf` | Funciona, **ya no pide token** | Historial completo (rondas, diferenciales) con solo la licencia |
| Buscador nuevo `rfegolf.es/wp-json/handicap-search/v1/search?q=` | Funciona, público, sin token | Nombre, HI, club, federación y fecha de actualización (447.342 fichas). Busca por nombre, no por licencia |
| Buscador antiguo (`?player=` del worker) | Roto (dependía del token `coded_`) | La app no lo usa |
| Campos y tees (WordPress + lectura del HTML) | Funciona (arreglado en `f36759d`) | Valor de campo, slope, par, metros |
| API con login `api.rfegolf.es` | No probada; la migración fue de la web, no de la API | HI de cualquiera; rondas/PDF solo propio + vinculados |

Conclusiones:

- **Hay más datos accesibles sin login que antes**, pero parece un descuido de la migración, no
  una apertura buscada. Lo más probable es que lo cierren sin aviso. Para uso personal no importa:
  la cascada de `fetchParse` ya tiene respaldo con login.
- **Tres sistemas que cambian por separado** (servidor de ficheros, web WordPress, API con login).
  La migración rompió dos de tres vías sin aviso: con clientes de pago habría sido una caída de servicio.
- Que los datos se vean no autoriza a usarlos comercialmente: siguen siendo datos personales de
  terceros (RGPD), con menores entre ellos.

Impacto en las opciones:

- **1 y 2 (freemium / IA)**: en teoría funcionarían sin pedir credenciales (desaparece el mayor
  riesgo), pero sobre un acceso que probablemente se cierre. No construir producto sobre esto.
- **3 (club)**: gana peso — es la única vía con el acceso a datos apoyado en un acuerdo.
- **5 (acceso oficial)**: nueva, ver arriba.

## Funcionalidad pendiente

- **Notificaciones push "¿jugaste hoy?"**: requiere Service Worker + permiso de notificaciones
  + PWA instalada (iOS 16.4+). Aplazado; de momento la home muestra "hace N días" en cada perfil.
- PCC y ESR del WHS oficial (diferencia mínima para uso personal).
