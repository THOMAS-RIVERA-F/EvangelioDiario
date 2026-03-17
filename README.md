# Hinry · Evangelio diario

Aplicación móvil (Expo + React Native) para seguir el Evangelio diario y acompañarlo con la voz de Hinry. El MVP está diseñado para lectura rápida, favoritos y un calendario litúrgico claro.

**Estado visual del README**

- No se incluyen capturas en este README para evitar mostrar imágenes que puedan no reflejar exactamente el estado actual de la app.

**Funcionalidades clave**

- Inicio (Hoy): muestra la fecha, el color litúrgico como acento y un carrusel de lecturas con acceso directo a la lectura completa.
- Lectura: lectura completa por tarjetas, cambio de tema (auto/claro/noche), ajuste de tamaño de letra y favoritos por lectura o por versículo.
- Calendario: lista de fechas litúrgicas importantes o vista completa, agrupada por mes y resaltando el día actual.
- Hinry: tarjetas “Hoy con Hinry” para hoy y ayer, con giro de tarjeta, reproducción de audio cuando está disponible, compartir tarjeta y guardado local.
- Favoritos: lista persistente de lecturas y versículos guardados, con opción de eliminar.

**Navegación**

- Tabs principales: `Hoy`, `Hinry`, `Calendario`, `Favoritos`.
- Desde `Hoy` se entra a `Lectura` para leer el contenido completo y guardar lecturas/versículos.

**Enfoque online-first (MVP)**

- El contenido base vive en `data/lecturas_2026.json` y `data/hinry_master_2026.json` para garantizar apertura inmediata y uso sin conexión.
- Cada día incluye URL de referencia en el JSON, lo que permite sincronizar con fuentes online cuando se habilite la capa de actualización.
- La persistencia local (AsyncStorage) guarda favoritos y tarjetas de Hinry marcadas como descargadas.

**Datos y contenido**

- `data/lecturas_2026.json`: calendario y lecturas del año con metadatos litúrgicos.
- `data/hinry_master_2026.json`: contenido de Hinry por día (contexto, explicación y mensaje central).
- `assets/audio`: audios locales de Hinry cuando están disponibles.

**Estructura principal**

- `app/(tabs)/index.tsx`: pantalla de inicio con lecturas del día.
- `app/reading.tsx`: lectura completa con favoritos y ajustes de lectura.
- `app/(tabs)/two.tsx`: calendario litúrgico.
- `app/(tabs)/hinry.tsx`: tarjetas de Hinry, audio y compartir.
- `app/(tabs)/favorites.tsx`: favoritos persistentes.
- `lib/favorites.ts`: capa de favoritos en AsyncStorage.

**Scripts de datos**

- `scripts/generate_hinry_master.mjs`: genera el archivo completo de Hinry por día, con citas del Evangelio diario y mensaje pastoral.
- `scripts/generate_hinry_prompts.mjs`: genera prompts de Hinry.
- `scripts/generate_audio_preview.py`: preview de audio.

**Cómo correr el proyecto**

```bash
npm install
npm run start
```

Para ejecutar en un dispositivo o emulador:

```bash
npm run android
npm run ios
```
