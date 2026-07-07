Actúa como un estudio de diseño digital al que le he encargado el rediseño visual de una app web. Te adjunto una captura de pantalla del diseño actual (y aquí tienes la URL en vivo para que la revises tú mismo si puedes navegar: https://golf-handicap.alberto76.workers.dev). Mírala con detenimiento antes de proponer nada: quiero que tus tres propuestas partan de un análisis real de lo que hay, no de una descripción genérica de "app de golf".

Quiero que me presentes **tres propuestas de diseño diferentes**, como si fueran tres direcciones creativas alternativas de un mismo pitch de estudio (tipo "concepto A / concepto B / concepto C"), no tres variaciones menores de lo mismo.

## Qué es la app

"Golf Handicap RFEG": una app personal/familiar para consultar el hándicap de golf federado en España (RFEG/WHS), ver la evolución del hándicap, estadísticas por campo, un simulador de "qué pasaría si hago X golpes" y una calculadora de hándicap de juego. La usan un padre de 49 años y sus hijos adolescentes, ambos jugadores de golf. Se consulta sobre todo desde el móvil, muchas veces de pie en el campo antes o después de jugar.

Es una PWA instalable (icono en pantalla de inicio) construida como un único archivo HTML con React (sin build step), así que el rediseño tiene que poder expresarse en CSS/inline styles y SVG, sin depender de librerías de diseño externas complejas.

## Diseño actual (punto de partida a mejorar, no a repetir)

- Fondo verde oscuro casi negro, tarjetas con degradado verde bosque a dorado envejecido, tipografía serif (Georgia) para títulos y monospace para datos/etiquetas.
- Iconos: emojis estándar (⛳🏌️📈🎯), un icono de app genérico (bandera de golf sobre fondo degradado) que podría ser el de cualquier app de golf genérica.
- Es funcional pero "correcto" y algo genérico — el objetivo es que dé un salto de percepción: que parezca hecho por un estudio con personalidad, no un dashboard con IA por defecto.

## Un elemento que quiero que esté presente

En algún lugar de las tres propuestas quiero reconocer el verde de Augusta National / The Masters (ese verde de césped icónico del golf, casi el color "oficial" del golf de torneo — piensa en el verde de la chaqueta ganadora y de los greens de Augusta, aprox. #00563F / #0D5C3B según la referencia que uses). No hace falta que sea el color dominante en las tres — puede aparecer como acento en una, como base en otra, o como guiño solo en un detalle (el borde de una tarjeta, un subrayado, el propio icono) — pero quiero que cada propuesta me explique dónde y cómo lo ha usado y por qué esa dosis concreta.

## Lo que quiero que evites explícitamente

- Que no se note "hecho con IA": nada de degradados morado-azul genéricos, nada de ilustraciones 3D isométricas genéricas, nada de emojis como iconografía final, nada de tarjetas con sombras difusas tipo "glassmorphism" por defecto sin razón de ser.
- Iconografía e imágenes con un punto de vista propio: si usas ilustración, que tenga una lógica de estilo definida (p. ej. inspirada en scorecards de golf clásicos, cartografía de campos, tipografía de tablón de resultados de torneo, texturas de césped/greens dibujadas a mano, etc.) — dame la lógica detrás de cada elección, no solo "queda bonito".

## Lo que necesito de cada una de las 3 propuestas

Para cada concepto de diseño, dame:

1. **Nombre comercial para la app** (no tiene por qué ser "Golf Handicap RFEG" — propón un nombre de marca real, corto, memorable, que funcione como nombre de icono en el móvil) **y una frase que capture la dirección de diseño** (el "elevator pitch" visual). Explica por qué ese nombre encaja con esta dirección concreta (los tres conceptos pueden tener nombres distintos entre sí).
2. **Paleta de color** con los códigos hex concretos y el porqué (qué transmite, de dónde viene la referencia).
3. **Tipografía**: familias concretas (que existan en Google Fonts o system fonts, nada de fuentes de pago raras) para títulos, cuerpo y datos/números.
4. **Un logo/icono de app reconocible**: diseña un logo concreto para esta app (no un icono genérico de golf) que funcione tanto como icono de app cuadrado (para la pantalla de inicio del móvil) como marca dentro de la propia interfaz (cabecera, splash). Descríbelo con precisión suficiente para poder dibujarlo en SVG: qué forma o símbolo usa, por qué es memorable y distinguible de otras apps de golf, y cómo se simplifica en tamaños pequeños (favicon). Si puedes, dame el SVG.
5. **Sistema de iconos e imágenes**: cómo resolverías los iconos de las pestañas (Evolución, Campos, Objetivo, Hándicap de Juego, Rondas, Simulador) y cualquier ilustración de apoyo, manteniendo coherencia con el logo. Sin caer en clichés de IA. Si es viable como SVG simple, mejor.
6. **Mejoras de usabilidad concretas** que introduce esta dirección (no solo estética): cómo organiza mejor la jerarquía de información en la pantalla principal del hándicap, cómo trata los estados vacíos/carga/error, cómo se comporta en móvil con una sola mano.
7. **Un ejemplo visual**: describe o boceta (en SVG si puedes, o en descripción muy visual si no) cómo se vería la pantalla principal del dashboard (el HI grande, las estadísticas rápidas, las pestañas) con esta dirección aplicada, incluyendo el logo colocado en la cabecera.

Al final, dame tu recomendación personal de estudio: cuál de las tres elegirías para esta app y por qué, considerando que la tiene que poder mantener y programar una sola persona sin equipo de diseño.
