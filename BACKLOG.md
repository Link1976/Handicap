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

## Funcionalidad pendiente

- **Notificaciones push "¿jugaste hoy?"**: requiere Service Worker + permiso de notificaciones
  + PWA instalada (iOS 16.4+). Aplazado; de momento la home muestra "hace N días" en cada perfil.
- PCC y ESR del WHS oficial (diferencia mínima para uso personal).
