const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");
const React = require("react");

// Carga los módulos de la app sin iniciar Metro. Solo se sustituyen sus dependencias nativas o de red.
function cargar(archivo, dependencias = {}) {
  const ruta = resolve(__dirname, "..", archivo);
  const { outputText } = ts.transpileModule(readFileSync(ruta, "utf8"), {
    fileName: archivo,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const salida = {};
  const importar = nombre => {
    if (nombre === "react/jsx-runtime") return require(nombre);
    if (!(nombre in dependencias)) throw new Error("Dependencia de prueba sin definir: " + nombre);
    return dependencias[nombre];
  };
  new Function("require", "exports", outputText)(importar, salida);
  return salida;
}

const navegacion = cargar("src/lib/navegacionSeguidor.ts");
const recorridoId = "00000000-0000-4000-8000-000000000001";
const alertaId = "00000000-0000-4000-8000-000000000002";
const estudiante = { id: "estudiante", nombre_completo: "Prueba" };
const seguimiento = { pathname: "/seguidor/seguimiento", params: { recorridoId } };
const emergencia = { pathname: "/seguidor/emergencia", params: { recorridoId, alertaId } };
const defecto = "expo.modules.notifications.actions.DEFAULT";
const datosPush = { alerta_id: alertaId, recorrido_id: recorridoId, tipo: "manual", modo: "silencioso",
  motivo: null, lat: 3.88, lng: -77.03, url: 'lleguebien01://seguidor/emergencia?alertaId=' + alertaId + '&recorridoId=' + recorridoId };
const controles = { ui: {}, color: {}, Pantalla: "Pantalla", Boton: "Boton", Aviso: "Aviso", Cabecera: "Cabecera", Avatar: "Avatar" };
const nativos = { View: "View", Text: "Text", Pressable: "Pressable", SectionList: "SectionList" };

function elementos(arbol) {
  return React.Children.toArray(arbol).flatMap(n => React.isValidElement(n) ? [n, ...elementos(n.props.children)] : []);
}

test("S07 abre S08 con el id del recorrido y S11 desde la tarjeta roja", () => {
  let estado = "activo";
  const destinos = [];
  const { default: Inicio } = cargar("src/app/seguidor/(tabs)/inicio.tsx", {
    "@expo/vector-icons/MaterialCommunityIcons": "Icono",
    "expo-router": { router: { push: d => destinos.push(d) } }, "react-native": nativos,
    "../../../components/seguidor/Controles": controles, "../../../components/seguidor/Avance": { Avance: "Avance" },
    "../../../context/SesionContext": { useSesion: () => ({}) },
    "../../../hooks/useConsultaSeguidor": { useConsultaSeguidor: () => ({ datos: {
      estudiantes: [estudiante], rutas: [{ id: recorridoId, id_usuario: estudiante.id, estado }],
    } }) },
    "../../../lib/navegacionSeguidor": navegacion, "../../../services/seguimientoFamiliar": {},
  });
  for (estado of ["activo", "emergencia"]) {
    const tarjeta = elementos(Inicio()).find(n => n.type === "Pressable" &&
      elementos(n.props.children).some(h => h.props.children === (estado === "activo" ? "Ver en el mapa" : "Ver emergencia")));
    tarjeta.props.onPress();
  }
  assert.deepEqual(destinos, [seguimiento, { pathname: emergencia.pathname, params: { recorridoId } }]);
});

test("S09 permite tocar toda la alerta y conserva ambos identificadores", () => {
  let destino;
  const hito = { tipo: "emergencia", fecha: new Date().toISOString(), nombre: "Prueba", recorridoId, alertaId };
  const { default: Alertas } = cargar("src/app/seguidor/(tabs)/alertas.tsx", {
    "expo-router": { router: { push: d => { destino = d; } } }, "react-native": nativos,
    react: { useState: x => [x, () => {}], useCallback: f => f },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 0 }) },
    "../../../components/seguidor/Controles": controles, "../../../components/seguidor/Avance": { hora: () => "12:00" },
    "../../../hooks/useConsultaSeguidor": { useConsultaSeguidor: () => ({ datos: { hitos: [hito] } }) },
    "../../../lib/navegacionSeguidor": navegacion, "../../../services/seguimientoFamiliar": {},
  });
  const lista = elementos(Alertas()).find(n => n.type === "SectionList");
  lista.props.renderItem({ item: lista.props.sections[0].data[0] }).props.onPress();
  assert.deepEqual(destino, emergencia);
});

function mapa(params, consulta = {}) {
  const reemplazos = [];
  const deps = {
    "expo-location": {}, "expo-router": { router: { replace: d => reemplazos.push(d) },
      useLocalSearchParams: () => params, useFocusEffect: f => f() },
    react: { useCallback: f => f, useMemo: f => f(), useEffect() {}, useState: x => [x, () => {}] },
    "react-native": { ...nativos, Platform: { OS: "android" }, ScrollView: "ScrollView" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "../../hooks/useConsultaSeguidor": { useConsultaSeguidor: () => consulta },
    "../../lib/recorrido": {}, "../../lib/navegacionSeguidor": navegacion,
    "../../services/seguimientoFamiliar": { consultaMapa: () => async () => consulta, zonaActual: () => null },
    "../../services/zonasRiesgo": {}, "../recorrido/MapaMapbox": { MapaMapbox: "MapaMapbox" },
    "./Avance": { Avance: "Avance" }, "./Controles": { ...controles, useOperacion: () => ({}) },
  };
  return { pantalla: cargar("src/components/seguidor/MapaFamiliar.tsx", deps).MapaFamiliar, reemplazos };
}

test("S08/S11 aceptan UUID escalar o array único y explican los parámetros inválidos", () => {
  for (const esEmergencia of [false, true]) {
    for (const params of [{}, { recorridoId: "undefined" }, { recorridoId: [] }, { recorridoId: [recorridoId, alertaId] },
      { recorridoId, alertaId: "" }, { recorridoId, alertaId: [alertaId, recorridoId] }]) {
      const vista = mapa(params).pantalla({ emergencia: esEmergencia });
      assert.ok(elementos(vista).some(n => n.type === "Aviso" && n.props.mensaje));
      assert.ok(elementos(vista).some(n => n.props.titulo === "Volver"));
    }
    for (const params of [{ recorridoId }, { recorridoId: [recorridoId], alertaId: [alertaId] }]) {
      const vista = mapa(params).pantalla({ emergencia: esEmergencia });
      assert.equal(vista.props.recorridoId, recorridoId);
      assert.equal(vista.props.alertaId, params.alertaId ? alertaId : undefined);
    }
  }
});

test("S08 entrega ruta y último punto al mapa y pasa a S11 si escala el recorrido", () => {
  const ruta = { estado: "activo", ruta_geojson: { type: "Feature", geometry: { type: "LineString", coordinates: [] } } };
  const punto = { lat: 3.88, lng: -77.03, captured_at: new Date().toISOString() };
  const { pantalla, reemplazos } = mapa({ recorridoId }, { datos: { ruta, estudiante, puntos: [punto], alerta: null } });
  const consulta = pantalla({ emergencia: false });
  const detalle = consulta.type(consulta.props);
  const lienzo = elementos(detalle.type(detalle.props)).find(n => n.type === "MapaMapbox");
  assert.equal(lienzo.props.ruta, ruta.ruta_geojson);
  assert.deepEqual(lienzo.props.rastro, [[punto.lng, punto.lat]]);
  assert.equal(lienzo.props.ubicacionActual.latitude, punto.lat);
  ruta.estado = "emergencia";
  consulta.type(consulta.props);
  assert.deepEqual(reemplazos, [{ pathname: emergencia.pathname, params: { recorridoId } }]);
});

test("S08/S11 ofrecen reintentar y volver ante un fallo de lectura", () => {
  for (const esEmergencia of [true, false]) {
    let intentos = 0;
    const consulta = mapa({ recorridoId }, { error: "Recorrido no disponible", reintentar: () => intentos++ })
      .pantalla({ emergencia: esEmergencia });
    const vista = elementos(consulta.type(consulta.props));
    assert.ok(vista.some(n => n.props.children === "Recorrido no disponible"));
    vista.find(n => n.props.titulo === "Reintentar").props.accion();
    assert.equal(intentos, 1);
    assert.ok(vista.some(n => n.props.titulo === "Volver"));
  }
});

test("S11 resuelve solo la alerta activa de ese recorrido y respeta los resultados vacíos de RLS", async () => {
  const tablas = { recorridos: [{ id: recorridoId, id_usuario: estudiante.id }], alertas: [
    { id: "otra", id_recorrido: "otro-recorrido", estado: "activa" },
    { id: alertaId, id_recorrido: recorridoId, estado: "activa" },
  ], recorrido_ubicaciones: [] };
  const supabase = { from(tabla) {
    let filas = tablas[tabla];
    return { select() { return this; }, eq(k, v) { filas = filas.filter(r => r[k] === v); return this; },
      limit() { return this; }, order() { return this; }, gt() { return this; },
      returns: async () => ({ data: filas }), maybeSingle: async () => ({ data: filas[0] ?? null }) };
  } };
  const { consultaMapa } = cargar("src/services/seguimientoFamiliar.ts", {
    "./supabase": { supabase }, "./seguidores": { estudiantesSeguidos: async () => [estudiante] }, "../lib/recorrido": {},
  });
  assert.equal((await consultaMapa(recorridoId, undefined, true)()).alerta.id, alertaId);
  await assert.rejects(consultaMapa(recorridoId, "otra", true), /alerta.*disponible/);
  tablas.alertas[1].estado = "terminada";
  assert.equal((await consultaMapa(recorridoId, alertaId, true)()).alerta.estado, "terminada");
  await assert.rejects(consultaMapa(recorridoId, undefined, true), /alerta.*disponible/);
  tablas.recorridos = [];
  await assert.rejects(consultaMapa(recorridoId)(), /recorrido.*disponible/);
});

test("S08/S11 están en la pila y Atrás conserva las pestañas de origen", () => {
  const perfil = { rol: "seguidor", identificacion: "1", nombre_completo: "Prueba", telefono: "1", ciudad: "B", pais: "CO" };
  const Stack = Object.assign(() => {}, { Screen: "Stack.Screen" });
  const Tabs = Object.assign(() => {}, { Screen: "Tabs.Screen" });
  const padre = cargar("src/app/seguidor/_layout.tsx", {
    "expo-router": { Stack }, "react-native": nativos, "../../context/SesionContext": { useSesion: () => ({ session: {}, perfil }) },
    "../../components/seguidor/Controles": controles,
  });
  assert.equal(padre.unstable_settings.initialRouteName, "(tabs)");
  assert.equal(padre.default().type, Stack);
  assert.deepEqual(elementos(padre.default().props.children).map(n => n.props.name), ["(tabs)", "seguimiento", "emergencia"]);
  const tabs = cargar("src/app/seguidor/(tabs)/_layout.tsx", {
    "expo-router": { Tabs }, "@expo/vector-icons/MaterialCommunityIcons": {}, "../../../components/seguidor/Controles": controles,
  }).default();
  assert.deepEqual(elementos(tabs.props.children).map(n => n.props.name), ["inicio", "alertas", "perfil"]);
});

function respuesta(datos, accion = defecto) {
  return { actionIdentifier: accion, notification: { date: 123, request: { identifier: "aviso", content: { data: datos } } } };
}

const finDeTurno = () => new Promise(resolve => setImmediate(resolve));

// Ejecuta los efectos del hook y sus listeners con la tabla SQLite en memoria.
// El foco del navegador solo cambia cuando la prueba confirma la transición.
function entornoPush(t, rol, ultimaInicial = null) {
  const db = new DatabaseSync(":memory:");
  db.exec("create table intenciones_notificacion(clave text primary key, datos text not null, atendida integer default 0, creada_en integer)");
  const sqlite = { obtenerDb: async () => ({
    runAsync: async (sql, ...args) => db.prepare(sql).run(...args),
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...args),
  }) };
  let ultima = ultimaInicial, listener, handler;
  const suscripcion = { remove() {} };
  const notificaciones = {
    DEFAULT_ACTION_IDENTIFIER: defecto,
    setNotificationHandler: h => { handler = h; },
    getLastNotificationResponseAsync: async () => ultima,
    clearLastNotificationResponseAsync: async () => { ultima = null; },
    addNotificationResponseReceivedListener: f => { listener = f; return suscripcion; },
    addNotificationReceivedListener: () => suscripcion,
  };
  const intenciones = cargar("src/services/intencionesNotificacion.ts", {
    "expo-notifications": notificaciones, "../lib/navegacionSeguidor": navegacion, "./colaOffline": sqlite,
  });
  const efectos = [], refs = [], destinos = [], confirmaciones = [];
  const nav = { isReady: () => true };
  const router = { navigate: d => destinos.push(d), push: d => destinos.push(d) };
  let ruta = "/", params = {}, ref = 0, efecto = 0;
  const perfil = { rol, pais: "CO", ciudad: "B", telefono: "1", identificacion: "1", nombre_completo: "Prueba" };
  const activo = { id: recorridoId, id_usuario: "cuenta", estado: "emergencia" };
  const { useAccionesNotificacion } = cargar("src/hooks/useAccionesNotificacion.ts", {
    "expo-network": { getNetworkStateAsync: async () => ({ isConnected: true }) },
    "expo-notifications": notificaciones, "react-native": { Platform: { OS: "android" } },
    "expo-router": { router, usePathname: () => ruta, useGlobalSearchParams: () => params,
      useNavigationContainerRef: () => nav, useRootNavigationState: () => ({ key: "raiz" }) },
    react: {
      useRef: valor => refs[ref++] ??= { current: valor },
      useEffect: (f, deps) => {
        const i = efecto++;
        if (efectos[i] && deps.every((v, j) => Object.is(v, efectos[i].deps[j]))) return;
        efectos[i]?.limpiar?.();
        efectos[i] = { deps, limpiar: f() };
      },
    },
    "../context/SesionContext": { useSesion: () => ({ session: { user: { id: "cuenta" } }, perfil }) },
    "../lib/navegacionSeguidor": navegacion, "../services/intencionesNotificacion": intenciones,
    "../services/notificacionesPush": {
      ACCION_SOS_SILENCIOSO: "SOS", ACCION_ESTOY_BIEN: "BIEN", ACCION_NECESITO_AYUDA: "AYUDA",
      registrarCategoriasNotificaciones() {}, mostrarAccesoRapidoRecorrido() {},
    },
    "../services/colaOffline": { confirmarCheckinConCola: async (...args) => confirmaciones.push(args) },
    "../services/emergencias": { obtenerCheckinAbierto: async () => ({ checkin_id: "pregunta" }) },
    "../services/recorridos": { obtenerRecorridoActivo: async () => activo, leerRecorridoVerificado: async () => activo },
    "../tasks/backgroundLocationTask": { registrarTareaRecepcion: async () => {} },
  });
  t.after(() => { efectos.forEach(e => e.limpiar?.()); db.close(); });
  return {
    destinos, intenciones, confirmaciones, presentar: n => handler.handleNotification(n.notification),
    tocar: r => listener(r),
    async enfocar(pathname, nuevosParams = {}) {
      ruta = pathname;
      params = nuevosParams;
      ref = efecto = 0;
      useAccionesNotificacion(false);
      await finDeTurno();
    },
  };
}

for (const origen of ["primer plano", "segundo plano", "arranque en frío"]) {
  test("S10 abre S11 y confirma una sola intención desde " + origen, async t => {
    // También deben abrirse los avisos emitidos antes de corregir la URL del servidor.
    const aviso = respuesta({ ...datosPush, url: "lleguebien01://recorrido/emergencia" });
    const e = entornoPush(t, "seguidor", origen === "arranque en frío" ? aviso : null);
    if (origen === "segundo plano") {
      const nativa = respuesta(null);
      nativa.notification.request.content = { dataString: JSON.stringify(aviso.notification.request.content.data) };
      await e.intenciones.guardarIntencion(nativa);
    }
    await e.enfocar("/");
    assert.deepEqual(e.destinos, []);
    await e.enfocar("/seguidor/inicio");
    if (origen === "primer plano") {
      assert.equal((await e.presentar(aviso)).shouldShowBanner, true);
      assert.deepEqual(e.destinos, []);
      e.tocar(aviso);
      await finDeTurno();
    }
    assert.deepEqual(e.destinos, [emergencia]);
    assert.ok(await e.intenciones.siguienteIntencion());
    await e.enfocar(emergencia.pathname, { recorridoId, alertaId: "otra" });
    assert.ok(await e.intenciones.siguienteIntencion());
    await e.enfocar(emergencia.pathname, emergencia.params);
    assert.equal(await e.intenciones.siguienteIntencion(), null);
    const enviados = e.destinos.length;
    e.tocar(aviso);
    await finDeTurno();
    assert.equal(e.destinos.length, enviados);
  });
}

test("S10 sin alerta_id resuelve la activa y un recorrido inválido llega al error visible", () => {
  const { alerta_id, ...sinAlerta } = datosPush;
  assert.deepEqual(navegacion.destinoPushSeguidor(sinAlerta, true), { pathname: emergencia.pathname, params: { recorridoId } });
  const destino = navegacion.destinoPushSeguidor({ ...datosPush, recorrido_id: null }, true);
  assert.ok(navegacion.parametrosMapa(destino.params.recorridoId, destino.params.alertaId).error);
  assert.equal(navegacion.destinoPushSeguidor({ tipo: "acceso_rapido", recorrido_id: recorridoId }, true), null);
});

for (const [accion, datos, esperado] of [
  [defecto, datosPush, "/recorrido/emergencia"],
  ["SOS", { tipo: "acceso_rapido", recorrido_id: recorridoId }, "/recorrido/sos"],
  ["BIEN", { checkin_id: "pregunta", recorrido_id: recorridoId }, "/recorrido"],
  ["AYUDA", { checkin_id: "pregunta", recorrido_id: recorridoId }, "/recorrido"],
]) {
  test("Estudiante conserva su destino y su confirmación para " + accion, async t => {
    const e = entornoPush(t, "estudiante");
    await e.enfocar("/recorrido");
    e.tocar(respuesta(datos, accion));
    await finDeTurno();
    assert.equal(e.destinos.length, 1);
    assert.equal(e.destinos[0].pathname, esperado);
    assert.equal(e.destinos[0].params.recorridoId, recorridoId);
    if (accion === "SOS") assert.equal(e.destinos[0].params.modo, "silencioso");
    if (accion === "BIEN") assert.deepEqual(e.confirmaciones, [["pregunta", recorridoId]]);
    if (accion === "AYUDA") {
      assert.equal(e.destinos[0].params.ayudaCheckin, "pregunta");
      assert.ok(await e.intenciones.siguienteIntencion()); // E10 confirma después de guardar la activación.
    } else assert.equal(await e.intenciones.siguienteIntencion(), null);
  });
}
