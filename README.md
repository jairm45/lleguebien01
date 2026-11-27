# LleguéBien (`lleguebien01`)

![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo)
![React Native 0.88.1](https://img.shields.io/badge/React%20Native-0.88.1-61DAFB?logo=react&logoColor=black)
![TypeScript 6.0.3](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Realtime-3FCF8E?logo=supabase&logoColor=black)
![PostGIS 3.3.7](https://img.shields.io/badge/PostGIS-3.3.7-336791?logo=postgresql&logoColor=white)
![Mapbox](https://img.shields.io/badge/Mapbox-Maps%20%2B%20Directions-000000?logo=mapbox)

LleguéBien es una aplicación móvil de acompañamiento y seguridad para estudiantes de la **Universidad del Pacífico** en Buenaventura, Valle del Cauca, Colombia. Cada estudiante puede compartir su recorrido a pie en tiempo real con familiares o contactos de confianza y pedir ayuda desde la aplicación si surge una emergencia.

## Funcionalidades principales

### Estudiante

- Registro e inicio de sesión con correo institucional `@unipacifico.edu.co` y PIN de seis dígitos. El estudiante puede editar su perfil y ajustar el número de sacudidas y el tiempo para cancelar una alerta. La ubicación se solicita primero para el primer plano y luego para el segundo plano.
- Selección de destino con búsqueda de Mapbox, toque en el mapa y pin arrastrable. Se pueden guardar destinos y elegir uno como predeterminado. Antes de iniciar, la app comprueba que haya un destino, servicios de ubicación activos, permiso de ubicación en primer plano y conectividad.
- Seguimiento en vivo con ruta peatonal, hora estimada de llegada (ETA) y distancia recorrida. La navegación bloquea la salida accidental del flujo mientras hay un recorrido activo. Al finalizar, muestra un resumen del trayecto.

| Pantalla | Ruta                          | Función                                                                  |
| -------- | ----------------------------- | ------------------------------------------------------------------------ |
| E10      | `/recorrido`                  | Mapa, avance y controles del recorrido                                   |
| E11      | `/recorrido/cuenta-regresiva` | Cuenta regresiva cancelable tras detectar sacudidas                      |
| E12      | `/recorrido/sos`              | SOS manual sonoro o silencioso al mantener pulsado durante tres segundos |
| E13      | `/recorrido/emergencia`       | Emergencia activa y controles para terminarla                            |
| E14      | `/recorrido/llegada`          | Resumen de llegada, duración y distancia real                            |

### Emergencias y funcionamiento sin conexión

- El detector de sacudidas filtra las muestras del acelerómetro y abre una cuenta regresiva cancelable. En una emergencia sonora, la app activa localmente la alarma en bucle y la vibración sin esperar a la red. El modo silencioso permite pedir ayuda sin reproducir la alarma.
- La notificación de acceso rápido **Recorrido protegido** ofrece la acción **SOS Silencioso**. Al tocarla, abre E12 en modo silencioso. El estudiante aún debe mantener pulsado el botón durante tres segundos.
- La cola SQLite conserva puntos GPS, eventos de emergencia y respuestas al monitor. Procesa primero los eventos prioritarios y mantiene el orden FIFO dentro de cada prioridad. Limita los reintentos y usa `client_event_id` para que un reenvío no duplique el evento. Los puntos conservan su hora de captura en `captured_at`.
- El monitor **¿Estás bien?** consulta recorridos activos cuando pasan cuatro minutos sin una ubicación, cuando se cumplen tres minutos de parada en una zona de riesgo alto o cuando el ETA se supera por quince minutos. El estudiante puede confirmar que está bien o pedir ayuda. Si la condición persiste, el servidor puede escalar el aviso a una emergencia silenciosa tras sesenta segundos desde que registra su presentación, o tras noventa segundos desde su creación si no pudo confirmarla. El funcionamiento en un entorno desplegado depende de [activar el monitor](#activar-el-monitor-pasivo).

### Familiar o seguidor

| Flujo   | Qué permite                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P01     | Elegir el rol desde la pantalla inicial. Si hay sesión, el perfil determina el flujo.                                                                                                                      |
| S01–S03 | Acceder o registrarse con un correo válido de cualquier dominio y completar los datos del perfil.                                                                                                          |
| S04–S06 | Vincularse con un código de seis caracteres que vence a las 24 horas o abrir `lleguebien01://seguir?codigo=CODIGO`. El familiar puede revisar, aceptar o rechazar la invitación.                           |
| S07–S08 | Consultar el panel de estudiantes vinculados y seguir un recorrido en el mapa mediante Supabase Realtime. La vista también consulta el servidor cada 20 segundos mientras la app no está en segundo plano. |
| S09     | Consultar el historial de alertas e hitos del recorrido.                                                                                                                                                   |
| S10–S11 | Abrir el detalle de una emergencia desde el panel o desde una notificación. La vista ofrece **Llamar** si hay un teléfono disponible y **Cómo llegar** si hay una ubicación.                               |

El estudiante puede revocar un vínculo desde Seguidores. Las consultas del familiar requieren un vínculo activo y respetan las políticas RLS.

### Inteligencia espacial

PostGIS usa `geography` con SRID 4326 para calcular la distancia elipsoidal sobre el rastro válido. El servidor filtra muestras GPS que no cumplen los criterios de calidad o movimiento y comprueba si los puntos válidos intersectan zonas de riesgo activas. Mapbox calcula la ruta peatonal prevista. La distancia real se calcula con los puntos que el estudiante recorre.

## Stack tecnológico

Los rangos corresponden al manifiesto. El lockfile fija la versión que instala npm para cada dependencia. [package.json](package.json) · [package-lock.json](package-lock.json)

| Categoría                    | Dependencias declaradas                                                                                                      | Versiones del lockfile o configuración                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend móvil               | Expo `~58.1.0`, React Native `0.88.1`, React `19.3.0`, Expo Router `~58.0.33`, TypeScript `~6.0.3`                           | `58.1.0`, `0.88.1`, `19.3.0`, `58.0.33`, `6.0.3`                                                             |
| Mapas y geolocalización      | `@rnmapbox/maps ^10.3.18`, `expo-location ~58.0.23`, `expo-task-manager ~58.0.14`                                            | `10.3.18`, `58.0.23`, `58.0.14`. Mapbox Directions y Geocoding v5.                                           |
| Backend y base de datos      | `@supabase/supabase-js ^2.118.0`, Supabase Auth, Realtime y Edge Functions                                                   | Cliente `2.119.0`. PostgreSQL 17 con PostGIS 3.3.7 en `extensions`, según la migración de Fase 2.            |
| Resiliencia y notificaciones | `expo-sqlite ~58.0.18`, `expo-network ~58.0.6`, `expo-notifications ~58.1.10`, `expo-sensors ~58.0.5`, `expo-audio ~58.0.12` | `58.0.18`, `58.0.6`, `58.1.10`, `58.0.5`, `58.0.12`. Expo Push Service y Nodemailer `6.9.16` en el servidor. |
| Despliegue y compilación     | `expo-dev-client ~58.0.22`, `expo-build-properties ~58.0.12`, EAS y GitHub Actions                                           | `58.0.22`, `58.0.12`. EAS CLI `>=25.3.0`, Node.js 22 y Java 17 en el workflow Android.                       |

## Arquitectura y estructura del repositorio

```text
.
├── src/
│   ├── app/
│   │   ├── _layout.tsx         # Sesión, navegación raíz y tarea en segundo plano
│   │   ├── estudiante/         # Inicio, seguidores y perfil
│   │   ├── familiar/           # Acceso, registro e invitaciones
│   │   ├── recorrido/          # Seguimiento, SOS, emergencia y llegada
│   │   └── seguidor/           # Panel, mapa, alertas y perfil del familiar
│   ├── components/             # Componentes de interfaz y mapas
│   ├── context/                # Sesión, recorrido y destino seleccionado
│   ├── hooks/                  # Ubicación, sensores, notificaciones y consultas
│   ├── lib/                    # Cálculos del recorrido y detector de sacudidas
│   ├── services/               # Supabase, Mapbox, cola offline y servicios de dominio
│   ├── styles/                 # Estilos de pantalla
│   └── tasks/                  # Ubicación y notificaciones en segundo plano
├── supabase/
│   └── functions/
│       ├── _shared/
│       ├── enviar-alerta/
│       ├── enviar-invitacion-seguidor/
│       └── monitor-recorridos-pasivos/
├── docs/                       # Migraciones SQL y datos de prueba
├── assets/                     # Recursos gráficos y alarma
└── .github/workflows/          # Compilación y publicación del APK
```

El móvil obtiene posiciones en primer y segundo plano. Con conexión, envía las muestras al backend. Si se interrumpe la red, la [cola local](src/services/colaOffline.ts) conserva los eventos para sincronizarlos después. PostGIS valida y actualiza el recorrido, Realtime notifica los cambios al familiar y las Edge Functions se encargan de las entregas push y por correo.

## Backend con Supabase y PostGIS

### Tablas y acceso

| Tabla                                        | Datos principales                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `perfiles`                                   | Datos personales y rol `estudiante` o `seguidor`, asociados a Supabase Auth |
| `configuracion_sensores`                     | Preferencias de detección y cuenta regresiva                                |
| `destinos_guardados`                         | Destinos por usuario y elección de un predeterminado                        |
| `seguidores`                                 | Invitaciones, vencimiento y vínculos autorizados                            |
| `recorridos`                                 | Origen, destino, ruta, ETA, distancia y estado                              |
| `recorrido_ubicaciones`                      | Coordenadas, precisión, hora de captura y validez de cada muestra           |
| `zonas_riesgo`                               | Geometría GeoJSON, geografía derivada, nivel y estado                       |
| `alertas`                                    | Emergencias manuales, por sacudida, por notificación rápida o pasivas       |
| `dispositivos_push`                          | Tokens de Expo Push por usuario y dispositivo                               |
| `checkins_pasivos`                           | Preguntas de seguridad, presentación, respuesta y escalamiento              |
| `envios_alerta_push`, `envios_alerta_correo` | Reservas para evitar despachos duplicados                                   |

Las políticas **Row Level Security (RLS)** limitan el acceso por usuario y vínculo. La publicación `supabase_realtime` incorpora `recorridos`, `recorrido_ubicaciones`, `alertas`, `seguidores` y `checkins_pasivos` en las migraciones de Fases 3B y 4. Las operaciones administrativas del monitor y las reservas de despacho se ejecutan con `service_role`.

### RPC utilizadas

| Módulo                   | Funciones                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recorridos y emergencias | `registrar_ubicacion_recorrido`, `finalizar_recorrido`, `activar_emergencia_recorrido`, `terminar_emergencia_recorrido`                                                        |
| Destinos                 | `guardar_destino_usuario`, `establecer_destino_predeterminado`                                                                                                                 |
| Dispositivos             | `registrar_token_push`, `eliminar_token_push`                                                                                                                                  |
| Invitaciones             | `crear_invitacion_seguidor`, `obtener_invitacion_por_codigo`, `aceptar_invitacion_seguidor`, `rechazar_invitacion_seguidor`, `listar_estudiantes_seguidos`, `revocar_seguidor` |
| Monitor pasivo           | `marcar_checkin_presentado`, `responder_checkin_pasivo`, `evaluar_checkins_pasivos`, `escalar_checkin_pasivo`, `reservar_envios_checkin`                                       |
| Despacho                 | `reservar_destinos_alerta`, `reservar_correo_alerta`                                                                                                                           |

### Edge Functions

| Código                                                                               | Responsabilidad                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [enviar-alerta](supabase/functions/enviar-alerta/index.ts)                           | Valida la sesión o la llamada interna y distribuye la alerta por Expo Push y SMTP a seguidores activos. Las reservas por alerta y destinatario permiten reintentar envíos con control de duplicados. |
| [enviar-invitacion-seguidor](supabase/functions/enviar-invitacion-seguidor/index.ts) | Comprueba la sesión y la invitación del estudiante. Envía por SMTP el código y el enlace de vinculación.                                                                                             |
| [monitor-recorridos-pasivos](supabase/functions/monitor-recorridos-pasivos/index.ts) | Evalúa los recorridos, reserva preguntas pendientes, envía el aviso al estudiante y delega las alertas escaladas en `enviar-alerta`.                                                                 |
| [`_shared/correoSmtp.ts`](supabase/functions/_shared/correoSmtp.ts)                  | Helper compartido de Nodemailer para validar direcciones, escapar HTML y enviar correo con TLS.                                                                                                      |

## Instalación, ejecución y verificación

1. Desde la raíz, instala con npm y configura el entorno descrito arriba.

   ```bash
   npm install
   ```

2. Genera el APK de desarrollo e instálalo en Android. Repite la compilación cuando cambien dependencias nativas o plugins. [Guía de builds de desarrollo](https://docs.expo.dev/tutorial/eas/android-development-build/)

   ```bash
   npx eas-cli@latest build --profile development --platform android
   ```

3. Inicia Metro y abre el Development Build para conectarlo al servidor.

   ```bash
   npx expo start --dev-client
   ```

4. Comprueba tipos y compatibilidad del proyecto.

   ```bash
   npx tsc --noEmit
   npx expo-doctor
   ```

Los scripts `start`, `android`, `ios` y `web` están definidos en [package.json](package.json). `npm run lint` llama a `expo lint`, pero el repositorio carece de configuración y dependencias de ESLint. La verificación funcional es manual porque el proyecto carece de un runner de pruebas automatizadas.

Para una prueba de integración, vincula una cuenta de estudiante y otra de seguidor. Comprueba el código de invitación, el avance del rastro, la sincronización tras recuperar la red y la recepción de alertas push y por correo. Para comprobar el monitor, verifica además la presentación de la pregunta y su resolución o escalamiento en el entorno de prueba.

### APK de distribución

El [workflow de GitHub Actions](.github/workflows/release-apk.yml) usa Gradle. Con un tag `v*` compila el APK `preview` y publica una release del tag. La ejecución manual permite elegir `preview` o `development` y ambas modalidades actualizan la release rodante `latest-apk`. El perfil `preview` usa `assembleRelease` con R8, reducción de recursos y optimización PNG. El perfil `development` usa `assembleDebug` para conservar el lanzador de desarrollo. La arquitectura Android configurada es `arm64-v8a`.

## Alcance técnico y consideraciones conocidas

- El acelerómetro de `expo-sensors` opera en primer plano. Mientras el estudiante está fuera de la app, el acceso rápido de la notificación y el monitor en servidor complementan la detección. Su disponibilidad depende de los permisos, la red y las restricciones del sistema operativo.
- La alarma sonora se reproduce en bucle con volumen interno `1` en `expo-audio`. El volumen físico de reproducción queda bajo el control del usuario y del sistema operativo. [Implementación de la alarma](src/hooks/useAlarmaEmergencia.ts)
- Cuando la app pierde conexión, el seguidor puede ver una posición desactualizada hasta que el dispositivo sincronice. Los avisos push y SMTP requieren red y la configuración de los servicios de entrega.

## Integrantes del equipo

**Universidad del Pacífico — Buenaventura, Valle del Cauca, Colombia**

- Freddy Jair Mondragon Medina
- Hernando Tovar Alzate
- Helen Dayana Rivas Gonzalez
- Anyela Katerine Rentería
- Kelly Jhoana Mosquera Urbano
