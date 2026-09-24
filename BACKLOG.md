# Backlog — handicap-app

## Monetización (ideas, sin fecha)

### Análisis revisado (2026-09-24)

**Qué se vendería**: el análisis, no los datos. Ver las rondas de otra manera, tendencia de las
últimas 5 y 10 rondas, simular el HI según el campo y saber qué hay que hacer para mantenerlo
(defensa). Es el modelo Strava/Garmin: cobrar por interpretar los datos propios del usuario.

**La pregunta clave no es qué se vende, sino de quién son las rondas que se analizan:**

| Caso | Valoración |
|------|-----------|
| Rondas propias, o de un hijo menor a cargo | Defendible: es el interesado usando sus datos, la app es la herramienta |
| Rondas de un tercero (rival, compañero de club) | Problema RGPD: se analizan datos ajenos sin que el titular lo sepa |

**Vía intermedia elegida: aviso tras introducir la licencia.** Declaración del tipo "esta licencia
es mía, de un menor a mi cargo, o tengo permiso de su titular". No verifica nada, pero fija para
qué sirve el producto y quién responde si se usa mal. Mantiene la experiencia sin fricción
(poner licencia y listo). Con términos de uso y política de privacidad reales, es un punto de
partida razonable para un lanzamiento pequeño.

**Descartado**: modo "sube tu PDF" — la gente no sabe dónde está ese PDF, demasiada fricción.

**Riesgos por tipo:**

- **Condiciones de la RFEG** ([aviso legal](https://rfegolf.es/aviso-legal/), sección 4ª): protegen
  "esta Página" (texto, diseño, logos, estructura de rfegolf.es) y prohíben su reproducción salvo
  uso personal y privado. **No regulan expresamente los datos de hándicap de cada jugador** ni los
  PDF de `api.rfeg.es`. Las rondas son hechos, no contenido con propiedad intelectual. Riesgo bajo.
  Lo más cercano a "contenido" que se extrae son los datos de campos (VC, slope, par) del HTML
  de las fichas de club, pero son consultas puntuales, no una copia de su base de datos.
- **Protección de datos (RGPD)**: el marco que realmente aplica. Que un dato sea accesible no
  permite usarlo para cualquier fin (criterio AEPD). La RFEG publica hándicaps para el peer review
  del WHS. Mitigación: aviso tras licencia + política de privacidad + consentimiento parental
  para menores de 14.
- **Dependencia técnica**: el PDF público sin token parece un descuido de la migración. Si lo
  cierran, la app depende del login (que exige conocer el federatedId, ver abajo). Riesgo de
  negocio, no legal.
- **Login con credenciales RFEG a escala**: pedir contraseñas a clientes de pago probablemente va
  contra las normas de la RFEG, y muchos logins desde IPs de Cloudflare son detectables.
  Aceptable como respaldo, no como base del producto.
- **Marcas WHS**: "Handicap Index®", "Course Handicap™", etc. son de USGA/R&A, solo para
  asociaciones autorizadas. En una versión comercial, evitar esos términos en la marca/marketing.

**Mercado:**

- App oficial RFEG: gratis, con HI, historial, estadísticas y licencia digital.
- **Precedente de acuerdo**: RFEG + Golf GameBook (abril 2025) — sincroniza hándicap y envía
  resultados de torneos; Gold gratis para todos los juniors. La RFEG sí firma con terceros.
- Diferenciación de HCAPP: simulador, defensa del HI, tendencias. Nadie más lo ofrece, pero es nicho.
- Orden de magnitud (hipótesis): ~300.000 federados; 0,5 % a 10 €/año ≈ 15.000 €/año (optimista).
  Realista: cientos de usuarios.

**Antes de cobrar:**

1. Aviso tras licencia + aviso "app no oficial" (ver Funcionalidad pendiente).
2. Términos de uso y política de privacidad con responsable identificado.
3. Alta de autónomo/sociedad.
4. Una consulta con abogado de protección de datos.
5. Contactar con la RFEG (vía GameBook como precedente) antes de escalar.

### Opciones de monetización

1. **Freemium ligero**
   - Gratis: HI + rondas. "Pro" (pago único o 1-2 €/mes): simulador, defensa del HI, tendencias,
     comparativa, exportar imagen.
   - Con el aviso tras licencia, viable como producto público pequeño, no solo para el club.

2. **Insight con IA sobre el propio juego**
   - Análisis textual vía API de Claude: "por qué ha subido/bajado tu HI este trimestre,
     qué campos te penalizan más". Feature diferenciadora, justificable como "Pro".
   - Sinergia con la experiencia ya adquirida en portfolio-monitor.

3. **White-label para un club concreto**
   - Portal de socios para el propio club: relación contractual clara.

4. **Acuerdo con la RFEG**
   - Pedir acceso en condiciones similares a Golf GameBook, o ofrecer simulador/defensa como
     funcionalidad para ellos. Es lo único que resuelve a la vez datos, facilidad de uso y riesgo.

5. **Descartado**: publicidad de terceros (no compensa en un nicho tan pequeño) y login RFEG
   masivo como base del producto.

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
  una apertura buscada. Puede cerrarse sin aviso. Para uso personal no importa: la cascada de
  `fetchParse` ya tiene respaldo con login.
- **Tres sistemas que cambian por separado** (servidor de ficheros, web WordPress, API con login).
  La migración rompió dos de tres vías sin aviso: con clientes de pago habría sido una caída de servicio.
- El PDF de cualquier licencia se puede descargar hoy fuera de la app, así que el worker no expone
  nada que la RFEG no exponga ya. Cerrar el worker a una lista de licencias es opcional en uso
  personal, y no aplica si se comercializa.

### Si se comercializa con login como vía principal

Quitar el buscador de licencias es solo una parte. Faltaría:

- **Descubrir el federatedId y los vinculados tras el login.** Hoy se mapean a mano
  (`BOOT_FED_IDS` + campo `licencia:fedId` del modal). Un cliente no conoce su ID. Pendiente
  investigar si la API lo devuelve tras el login (lectura con la cuenta de Alberto).
- Quitar `?pdf=` del worker (no solo de la UI) y limitar `?auth_handicap` (hoy da el HI de
  cualquier federatedId).

## Funcionalidad pendiente

### Antes de abrir la app a terceros

- **Aviso tras introducir la licencia** (declaración de titularidad/permiso, ver análisis arriba).
- **Aviso "app no oficial"**: sin relación con la RFEG; simulador, evolución y defensa son
  estimaciones; el hándicap oficial es el de rfegolf.es.
- **Texto del modal de login** (`LoginModal`): dice que las credenciales van "directamente" a la
  RFEG (pasan por el worker en Cloudflare, que no las guarda) y "Cumplimos LOPD y RGPD" (sin
  política ni responsable que lo respalde). Corregir o quitar.

### Parser del PDF (`extractRFEGData`)

- ~~Bug hándicaps plus~~: arreglado en `8fe55f1` (lectura con signo + visualización "+2.1").
  Probado con textos sintéticos: revisar con el PDF real del primer jugador plus que use la app.
- **Cruce de páginas por posición sin comprobar fechas**: si una página pierde una fila (la regex
  de página 1 exige `Individuales`), todo lo posterior se desplaza en silencio.
- **Diferencial de respaldo `|| 0`**: si falta, queda 0 y el motor lo toma como uno de los mejores.
- **Páginas fijas**: asume 5 páginas con diferenciales en la 5ª.

### Otras

- **Notificaciones push "¿jugaste hoy?"**: requiere Service Worker + permiso de notificaciones
  + PWA instalada (iOS 16.4+). Aplazado; de momento la home muestra "hace N días" en cada perfil.
- PCC y ESR del WHS oficial (diferencia mínima para uso personal).
