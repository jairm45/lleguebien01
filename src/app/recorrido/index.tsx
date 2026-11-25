import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Feature, LineString } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { completarIntencion, siguienteIntencion } from "../../services/intencionesNotificacion";
import { MapaMapbox } from "../../components/recorrido/MapaMapbox";
import { ModalCheckinSeguridad } from "../../components/recorrido/ModalCheckinSeguridad";
import { RequisitosRecorrido } from "../../components/recorrido/RequisitosRecorrido";
import { useRecorrido } from "../../context/RecorridoContext";
import { useDetectorSacudidas } from "../../hooks/useDetectorSacudidas";
import {
  CENTRO_BUENAVENTURA,
  conTimeout,
  distanciaHaversineMetros,
  estimarDuracionSegundos,
  formatearDistancia,
  formatearDuracion,
  type Coordenada,
} from "../../lib/recorrido";
import { obtenerRutaPeatonal } from "../../services/mapboxDirections";
import {
  obtenerZonasRiesgo,
  type ZonasRiesgo,
} from "../../services/zonasRiesgo";
import { styles } from "../../styles/RecorridoStyles";

const ZONAS_VACIAS: ZonasRiesgo = {
  type: "FeatureCollection",
  features: [],
};

export default function RecorridoActivoScreen() {
  const insets = useSafeAreaInsets();
  const enfocado = useIsFocused();
  const {
    recorridoId,
    destino,
    recuperando,
    requisitosOk,
    faltantes,
    verificando,
    puedeSolicitarPermiso,
    revalidar,
    solicitarPermiso,
    abrirAjustes,
    distanciaRecorridaM,
    enZonaRiesgo,
    zonasRiesgoActuales,
    enviando,
    ultimoError,
    pendientesOffline,
    alertaActiva,
    avisoSegundoPlano,
    sacudidasNecesarias,
    checkin,
    presentarCheckin,
    respondiendoCheckin,
    responderCheckin,
    finalizarRecorridoActual,
  } = useRecorrido();

  const [ubicacion, setUbicacion] = useState<Coordenada | null>(null);
  const [zonas, setZonas] = useState<ZonasRiesgo>(ZONAS_VACIAS);
  const [ruta, setRuta] = useState<Feature<LineString> | null>(null);
  const [distanciaMetros, setDistanciaMetros] = useState(0);
  const [duracionSegundos, setDuracionSegundos] = useState(0);
  const [rutaAproximada, setRutaAproximada] = useState(false);
  const [errorZonas, setErrorZonas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapaIniciado, setMapaIniciado] = useState(false);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [finalizando, setFinalizando] = useState(false);

  const accion = useLocalSearchParams<{ recorridoId?: string; ayudaCheckin?: string; intencion?: string }>();
  const atendiendo = useRef<string | null>(null);
  useEffect(() => {
    const { ayudaCheckin, intencion } = accion;
    if (!enfocado || !intencion || !ayudaCheckin || recorridoId !== accion.recorridoId ||
        atendiendo.current === intencion) return;
    atendiendo.current = intencion;
    void siguienteIntencion().then(async pendiente => {
        if (pendiente?.clave !== intencion || pendiente.datos.checkin_id !== ayudaCheckin ||
            pendiente.datos.recorrido_id !== recorridoId) return;
        await responderCheckin("necesito_ayuda", ayudaCheckin);
        await completarIntencion(intencion);
        router.replace({ pathname: "/recorrido/emergencia", params: { modo: "silencioso" } });
      })
      .catch(() => {
        atendiendo.current = null;
        Alert.alert("No se pudo guardar el SOS", "Reintenta pedir ayuda.");
      });
  }, [accion, enfocado, recorridoId, responderCheckin]);

  useDetectorSacudidas({
    activo:
      enfocado &&
      Boolean(recorridoId) &&
      requisitosOk &&
      !alertaActiva,
    sacudidasNecesarias,
    onDetectar: () => {
      if (!alertaActiva) {
        router.push("/recorrido/cuenta-regresiva");
      }
    },
  });

  useEffect(() => {
    if (!finalizando && !recuperando && (!recorridoId || !destino)) {
      router.replace("/iniciar-recorrido");
    }
  }, [destino, finalizando, recorridoId, recuperando]);

  useEffect(() => {
    if (enfocado && alertaActiva && !accion.ayudaCheckin) {
      router.replace({ pathname: "/recorrido/emergencia", params: { modo: alertaActiva.modo } });
    }
  }, [accion.ayudaCheckin, alertaActiva, enfocado]);

  useEffect(() => {
    if (!requisitosOk || !recorridoId || !destino) {
      setCargando(false);
      return;
    }

    let cancelado = false;

    const cargarRecorrido = async () => {
      setCargando(true);
      setError(null);

      try {
        const ultimaUbicacion = await Location.getLastKnownPositionAsync({
          maxAge: 60000,
          requiredAccuracy: 100,
        }).catch(() => null);

        const posicion =
          ultimaUbicacion ??
          (await conTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }),
            12000,
            "No se pudo obtener una ubicación GPS precisa.",
          ));

        if (cancelado) return;

        const origen: Coordenada = {
          latitude: posicion.coords.latitude,
          longitude: posicion.coords.longitude,
        };

        setUbicacion(origen);

        const [resultadoZonas, resultadoRuta] = await Promise.allSettled([
          obtenerZonasRiesgo(),
          obtenerRutaPeatonal(origen, destino),
        ]);

        if (cancelado) return;

        if (resultadoZonas.status === "fulfilled") {
          setZonas(resultadoZonas.value);
          setErrorZonas(false);
        } else {
          setZonas(ZONAS_VACIAS);
          setErrorZonas(true);
        }

        if (resultadoRuta.status === "fulfilled" && resultadoRuta.value) {
          setRuta(resultadoRuta.value.feature);
          setDistanciaMetros(resultadoRuta.value.distanciaMetros);
          setDuracionSegundos(resultadoRuta.value.duracionSegundos);
          setRutaAproximada(false);
        } else {
          const distancia = distanciaHaversineMetros(origen, destino);

          setRuta({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [origen.longitude, origen.latitude],
                [destino.longitude, destino.latitude],
              ],
            },
            properties: {},
          });
          setDistanciaMetros(distancia);
          setDuracionSegundos(estimarDuracionSegundos(distancia));
          setRutaAproximada(true);
        }

        setMapaIniciado(true);
      } catch {
        if (!cancelado) {
          setError(
            "No pudimos obtener tu ubicación actual. Verifica que el GPS esté encendido e inténtalo de nuevo.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    void cargarRecorrido();

    return () => {
      cancelado = true;
    };
  }, [destino, intentoCarga, recorridoId, requisitosOk]);

  const eta = useMemo(
    () =>
      `${formatearDuracion(duracionSegundos)} · ${formatearDistancia(distanciaMetros)}`,
    [distanciaMetros, duracionSegundos],
  );

  const zonaPrincipal = zonasRiesgoActuales[0];
  const hayBanners = Boolean(
    (enZonaRiesgo && zonaPrincipal) || !requisitosOk,
  );

  const reintentarCarga = () => {
    setError(null);
    setIntentoCarga((valor) => valor + 1);
    void revalidar();
  };

  const manejarLlegada = async () => {
    if (!recorridoId || finalizando) return;

    setFinalizando(true);

    try {
      const resumen = await finalizarRecorridoActual();

      router.replace({
        pathname: "/recorrido/llegada",
        params: { resumen: JSON.stringify(resumen) },
      });
    } catch (errorFinalizacion) {
      setFinalizando(false);

      Alert.alert(
        "No se pudo finalizar el recorrido",
        errorFinalizacion instanceof Error
          ? errorFinalizacion.message
          : "Inténtalo de nuevo.",
      );
    }
  };

  // Salir de E10 sin finalizar dejaría el recorrido abierto y sin GPS.
  const confirmarSalida = () => {
    Alert.alert(
      "¿Finalizar el recorrido?",
      "Dejarás de compartir tu ubicación con tus seguidores.",
      [
        { text: "Seguir aquí", style: "cancel" },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: () => void manejarLlegada(),
        },
      ],
    );
  };

  const salidaRef = useRef(confirmarSalida);

  useEffect(() => {
    salidaRef.current = confirmarSalida;
  });

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        salidaRef.current();
        return true;
      },
    );

    return () => suscripcion.remove();
  }, []);

  if (enfocado && checkin && checkin.recorrido_id === recorridoId && !alertaActiva) {
    const responder = (respuesta: "estoy_bien" | "necesito_ayuda") => {
      void responderCheckin(respuesta, checkin.checkin_id).catch(() =>
        Alert.alert("No se pudo guardar tu respuesta", "Vuelve a intentarlo."));
    };
    return <ModalCheckinSeguridad key={checkin.checkin_id} visible motivo={checkin.motivo}
      creadaEn={checkin.creada_en} desde={checkin.presentada_en} enviando={respondiendoCheckin}
      onPresentado={() => void presentarCheckin(checkin.checkin_id)}
      onEstoyBien={() => responder("estoy_bien")} onNecesitoAyuda={() => responder("necesito_ayuda")} />;
  }

  if (
    recuperando ||
    ((verificando || cargando) && !mapaIniciado)
  ) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1ABC9C" size="large" />
        <Text style={styles.loadingText}>
          Verificando GPS, permisos, conexión y recorrido...
        </Text>
      </View>
    );
  }

  if (!requisitosOk && !mapaIniciado) {
    return (
      <RequisitosRecorrido
        variante="bloqueo"
        faltantes={faltantes}
        verificando={verificando}
        puedeSolicitarPermiso={puedeSolicitarPermiso}
        onReintentar={() => void revalidar()}
        onAbrirAjustes={() => void abrirAjustes()}
        onSolicitarPermiso={() => void solicitarPermiso()}
      />
    );
  }

  if (error && !mapaIniciado) {
    return (
      <RequisitosRecorrido
        variante="bloqueo"
        titulo="No pudimos obtener tu ubicación"
        faltantes={[error]}
        verificando={verificando}
        onReintentar={reintentarCarga}
        onAbrirAjustes={() => void abrirAjustes()}
      />
    );
  }

  if (!mapaIniciado || !ubicacion || !destino) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1ABC9C" size="large" />
        <Text style={styles.loadingText}>Preparando tu recorrido...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <MapaMapbox
        zonas={zonas}
        ruta={ruta}
        destino={destino}
        centroInicial={ubicacion}
      />

      <View style={[styles.topCard, { top: insets.top + 12 }]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={confirmarSalida}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.75 },
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color="#1A1E3C"
            />
          </Pressable>

          <View style={styles.topInfo}>
            <Text style={styles.eta}>{eta}</Text>
            <Text style={styles.destino}>Hacia {destino.nombre}</Text>

            <Text style={styles.recorridoText}>
              Recorrido real: {formatearDistancia(distanciaRecorridaM)}
            </Text>

            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>compartiendo en vivo</Text>
            </View>

            {rutaAproximada ? (
              <Text style={styles.approximateText}>
                Ruta aproximada: no se pudo calcular la ruta peatonal.
              </Text>
            ) : null}

            {errorZonas ? (
              <Text style={styles.approximateText}>
                No se pudieron cargar las zonas de riesgo.
              </Text>
            ) : null}

            {ultimoError ? (
              <Text style={styles.approximateText}>{ultimoError}</Text>
            ) : null}

            {pendientesOffline > 0 ? (
              <Text style={styles.approximateText}>
                {pendientesOffline} evento(s) esperando señal
              </Text>
            ) : null}

            {avisoSegundoPlano ? (
              <Text style={styles.approximateText}>{avisoSegundoPlano}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {hayBanners ? (
        <View style={[styles.bannersContainer, { top: insets.top + 198 }]}>
          {enZonaRiesgo && zonaPrincipal ? (
            <View style={styles.riskBanner}>
              <MaterialCommunityIcons
                name="alert"
                size={20}
                color="#E5484D"
              />
              <View style={styles.riskTextWrap}>
                <Text style={styles.riskTitle}>
                  Estás entrando en: {zonaPrincipal.nombre}
                </Text>
                <Text style={styles.riskText}>
                  Riesgo {zonaPrincipal.nivel}
                  {zonasRiesgoActuales.length > 1
                    ? ` · ${zonasRiesgoActuales.length} zonas activas`
                    : ""}
                </Text>
              </View>
            </View>
          ) : null}

          {!requisitosOk ? (
            <RequisitosRecorrido
              variante="banner"
              faltantes={faltantes}
              puedeSolicitarPermiso={puedeSolicitarPermiso}
              onReintentar={() => void revalidar()}
              onAbrirAjustes={() => void abrirAjustes()}
              onSolicitarPermiso={() => void solicitarPermiso()}
            />
          ) : null}
        </View>
      ) : null}

      <View style={[styles.bottomPanel, { bottom: insets.bottom + 12 }]}>
        <View style={styles.bottomRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>En vivo</Text>
          </View>
          <Text style={styles.bottomText}>
            {enviando ? "Sincronizando ubicación..." : "Compartiendo ubicación"}
          </Text>
        </View>

        <Text style={styles.bottomText}>
          Tu recorrido se actualiza cada 5 segundos mientras la app está
          abierta.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergencia"
            onPress={() => router.push("/recorrido/sos")}
            style={({ pressed }) => [
              styles.emergencyButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <MaterialCommunityIcons
              name="alert-octagon-outline"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Emergencia</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ya llegué"
            disabled={finalizando}
            onPress={() => void manejarLlegada()}
            style={({ pressed }) => [
              styles.arrivedButton,
              (pressed || finalizando) && { opacity: 0.75 },
            ]}
          >
            {finalizando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.buttonText}>
              {finalizando ? "Finalizando..." : "Ya llegué"}
            </Text>
          </Pressable>
        </View>
      </View>


    </View>
  );
}
