import * as Location from "expo-location";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConsultaSeguidor } from "../../hooks/useConsultaSeguidor";
import { CENTRO_BUENAVENTURA, distanciaHaversineMetros, formatearDistancia, type Coordenada } from "../../lib/recorrido";
import { consultaMapa, zonaActual, type Seguimiento } from "../../services/seguimientoFamiliar";
import { obtenerZonasRiesgo, type ZonasRiesgo } from "../../services/zonasRiesgo";
import { MapaMapbox } from "../recorrido/MapaMapbox";
import { Avance } from "./Avance";
import { Aviso, Boton, Pantalla, color, ui, useOperacion } from "./Controles";

const sinZonas: ZonasRiesgo = { type: "FeatureCollection", features: [] };

function Antiguedad({ fecha }: { fecha?: string }) {
  const [ahora, ponerHora] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => ponerHora(Date.now()), 1000); return () => clearInterval(t); }, []);
  return <Text style={{ color: "white" }}>{fecha ? `Ubicación actualizada hace ${Math.max(0, Math.floor((ahora - Date.parse(fecha)) / 1000))} s` : "Esperando ubicación del estudiante"}</Text>;
}

export function MapaFamiliar({ emergencia }: { emergencia: boolean }) {
  const { recorridoId, alertaId } = useLocalSearchParams<{ recorridoId: string; alertaId?: string }>();
  return <ConsultaMapa key={[recorridoId, alertaId].join("/")} recorridoId={recorridoId} alertaId={alertaId} emergencia={emergencia} />;
}

function ConsultaMapa({ recorridoId, alertaId, emergencia }: { recorridoId: string; alertaId?: string; emergencia: boolean }) {
  const leer = useMemo(() => consultaMapa(recorridoId, alertaId), [recorridoId, alertaId]);
  const { datos, error, reintentar } = useConsultaSeguidor(leer, recorridoId);
  useFocusEffect(useCallback(() => {
    if (!emergencia && datos?.ruta.estado === "emergencia") {
      router.replace({ pathname: "/seguidor/emergencia", params: { recorridoId, ...(datos.alerta ? { alertaId: datos.alerta.id } : {}) } });
    }
  }, [datos, emergencia, recorridoId]));
  if (!datos || error) return <Pantalla titulo={emergencia ? "Alerta de emergencia" : "Seguimiento"}>
    <Text style={ui.texto}>{error ?? "Cargando el recorrido…"}</Text>
    {error && <Boton titulo="Reintentar" accion={reintentar} />}
    <Boton secundario titulo="Volver al inicio" accion={() => router.navigate("/seguidor/inicio")} />
  </Pantalla>;
  return <DetalleMapa key={recorridoId + (alertaId ?? "")} datos={datos} emergencia={emergencia} />;
}

function DetalleMapa({ datos, emergencia }: { datos: Seguimiento; emergencia: boolean }) {
  const margen = useSafeAreaInsets();
  const { ruta, estudiante, alerta, puntos } = datos;
  const [zonas, setZonas] = useState(sinZonas);
  const [falloZonas, avisarZonas] = useState(false);
  const [propia, setPropia] = useState<Coordenada | null>(null);
  const [seguir, setSeguir] = useState(true);
  const [encuadre, encuadrar] = useState(0);
  const { error, ejecutar } = useOperacion();
  useEffect(() => {
    let vigente = true;
    void obtenerZonasRiesgo().then(z => { if (vigente) setZonas(z); }).catch(() => { if (vigente) avisarZonas(true); });
    if (emergencia && Platform.OS !== "web") {
      void Location.getForegroundPermissionsAsync().then(p => p.granted ? Location.getLastKnownPositionAsync({ maxAge: 300000 }) : null)
        .then(p => { if (p && vigente) setPropia(p.coords); }).catch(() => undefined);
    }
    return () => { vigente = false; };
  }, [emergencia]);

  const ultimo = puntos[puntos.length - 1];
  const usandoAlerta = emergencia && alerta?.lat != null && alerta.lng != null &&
    (!ultimo || Date.parse(alerta.iniciada_en) > Date.parse(ultimo.captured_at));
  const punto = usandoAlerta ? { lat: alerta.lat!, lng: alerta.lng!, captured_at: alerta.iniciada_en, precision_m: null } : ultimo;
  const posicion = punto ? { latitude: punto.lat, longitude: punto.lng, heading: null, precisionM: punto.precision_m, capturedAt: Date.parse(punto.captured_at) } : null;
  const destino = ruta.destino_lat != null && ruta.destino_lng != null ? {
    latitude: ruta.destino_lat, longitude: ruta.destino_lng, nombre: ruta.destino_nombre ?? "Destino",
  } : null;
  const rastro = useMemo(() => puntos.map(p => [p.lng, p.lat]), [puntos]);
  const zona = posicion && zonaActual(zonas, posicion.latitude, posicion.longitude);
  const viva = ruta.estado === "emergencia" && (!alerta || alerta.estado === "activa");
  const final = ruta.estado === "finalizado" || ruta.estado === "cancelado";
  const nombre = estudiante.nombre_completo;
  const telefono = estudiante.telefono?.replace(/[^+\d]/g, "");
  const titulo = emergencia ? (viva ? `${nombre} necesita ayuda` : "Emergencia finalizada") : nombre;
  async function abrir(url: string) {
    try { await Linking.openURL(url); } catch { throw new Error("No se pudo abrir la aplicación en este dispositivo."); }
  }

  return <View style={ui.base}>
    <View style={{ backgroundColor: emergencia ? "#AF3035" : color.tinta, borderBottomWidth: 4, borderBottomColor: emergencia ? color.rojo : color.teal, padding: 16, paddingTop: margen.top + 12, gap: 4 }}>
      <Text accessibilityRole="header" style={[ui.seccion, { color: "white" }]}>{titulo}</Text>
      {emergencia && viva && <Antiguedad fecha={punto?.captured_at} />}
    </View>
    <View style={{ flex: 1, minHeight: 110 }}>
      <MapaMapbox zonas={zonas} ruta={ruta.ruta_geojson} rastro={rastro} destino={destino}
        centroInicial={posicion ?? destino ?? CENTRO_BUENAVENTURA} ubicacionActual={posicion}
        seguirUsuario={seguir} onMoverMapa={() => setSeguir(false)} red vistaFamiliar={emergencia ? "emergencia" : "seguimiento"} pulsar={viva} encuadre={encuadre} />
      {!!zona && <Text style={[ui.aviso, { position: "absolute", top: 8, left: 12, right: 12 }]}>Zona de riesgo · {zona}</Text>}
    </View>
    <ScrollView style={{ flexGrow: 0, maxHeight: "49%", backgroundColor: "white" }}
      contentContainerStyle={[ui.cuerpo, { paddingBottom: margen.bottom + 12, gap: 9 }]}>
      <Text style={ui.seccion}>{emergencia ? nombre : ruta.destino_nombre ?? "Recorrido"}</Text>
      <Text style={ui.etiqueta}>{final ? (ruta.estado === "finalizado" ? "Llegó a su destino" : "Recorrido cancelado")
        : emergencia && !viva ? "Alerta cerrada" : "● En vivo"}</Text>
      {!emergencia && !final && <Avance ruta={ruta} />}
      {!posicion && <Text style={ui.texto}>Todavía no se recibió una ubicación.</Text>}
      {propia && posicion && <Text style={ui.texto}>A unos {formatearDistancia(distanciaHaversineMetros(propia, posicion))} de ti</Text>}
      {falloZonas && <Text style={ui.texto}>Zonas de riesgo no disponibles.</Text>}
      <Aviso mensaje={error} />
      <View style={ui.fila}>
        <Boton icono="phone" titulo="Llamar" peligro={emergencia} desactivado={!telefono} accion={() => ejecutar(() => abrir(`tel:${telefono}`))} />
        {emergencia ? <Boton secundario titulo="Cómo llegar" desactivado={!punto} accion={() => ejecutar(async () => {
          if (!punto) return;
          const destino = `${punto.lat},${punto.lng}`;
          await abrir(Platform.OS === "ios" ? `https://maps.apple.com/?daddr=${destino}` : `https://www.google.com/maps/dir/?api=1&destination=${destino}`);
        })} /> : <Boton secundario titulo="Ver ruta" desactivado={!ruta.ruta_geojson} accion={() => { setSeguir(false); encuadrar(n => n + 1); }} />}
      </View>
      {!seguir && <Boton secundario titulo="Centrar estudiante" desactivado={!posicion} accion={() => setSeguir(true)} />}
      <Boton secundario titulo="Volver al inicio" accion={() => router.navigate("/seguidor/inicio")} />
    </ScrollView>
  </View>;
}
