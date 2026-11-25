import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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

import { avisarSalidaBloqueada } from "../../hooks/useGuardiaRecorrido";
import { completarIntencion, siguienteIntencion } from "../../services/intencionesNotificacion";
import { MapaMapbox } from "../../components/recorrido/MapaMapbox";
import { ModalCheckinSeguridad } from "../../components/recorrido/ModalCheckinSeguridad";
import { RequisitosRecorrido } from "../../components/recorrido/RequisitosRecorrido";
import { useRecorrido } from "../../context/RecorridoContext";
import { useDetectorSacudidas } from "../../hooks/useDetectorSacudidas";
import {
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
    red,
    requisitosOk,
    faltantes,
    ubicacionActual,
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

  const [seguirUsuario, setSeguirUsuario] = useState(true);
  const [origen, setOrigen] = useState<Coordenada | null>(null);
  const [rastro, setRastro] = useState<number[][]>([]);
  useEffect(() => {
    if (!ubicacionActual) return;
    const { longitude, latitude } = ubicacionActual;
    setRastro(anterior => {
      const ultimo = anterior[anterior.length - 1];
      if (ultimo?.[0] === longitude && ultimo[1] === latitude) return anterior;
      return [...anterior.slice(-399), [longitude, latitude]];
    });
  }, [ubicacionActual]);

  const [zonas, setZonas] = useState<ZonasRiesgo>(ZONAS_VACIAS);
  const [ruta, setRuta] = useState<Feature<LineString> | null>(null);
  const [distanciaMetros, setDistanciaMetros] = useState(0);
  const [duracionSegundos, setDuracionSegundos] = useState(0);
  const [rutaAproximada, setRutaAproximada] = useState(false);
  const [errorZonas, setErrorZonas] = useState(false);
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
    if (enfocado && !finalizando && !recuperando && !recorridoId) {
      router.replace("/iniciar-recorrido");
    }
  }, [enfocado, finalizando, recorridoId, recuperando]);

  useEffect(() => {
    if (enfocado && alertaActiva && !accion.ayudaCheckin) {
      router.replace({ pathname: "/recorrido/emergencia", params: { modo: alertaActiva.modo } });
    }
  }, [accion.ayudaCheckin, alertaActiva, enfocado]);

  useEffect(() => {
    if (ubicacionActual && !origen) setOrigen(ubicacionActual);
  }, [ubicacionActual, origen]);

  useEffect(() => {
    if (!origen || !destino || !recorridoId || !requisitosOk) return;
    let cancelado = false;
    const cargarRecorrido = async () => {
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
    };

    void cargarRecorrido();
    return () => { cancelado = true; };
  }, [destino, origen, recorridoId, requisitosOk]);

  const eta = useMemo(
    () =>
      `${formatearDuracion(duracionSegundos)} · ${formatearDistancia(distanciaMetros)}`,
    [distanciaMetros, duracionSegundos],
  );

  const zonaPrincipal = zonasRiesgoActuales[0];
  const hayBanners = Boolean(
    (enZonaRiesgo && zonaPrincipal) || !requisitosOk,
  );

  const manejarLlegada = async () => {
    if (!recorridoId || finalizando) return;

    setFinalizando(true);

    try {
      await finalizarRecorridoActual();
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

  useEffect(() => {
    if (!enfocado || (!recorridoId && !recuperando)) return;
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
      avisarSalidaBloqueada();
      return true;
    });
    return () => suscripcion.remove();
  }, [enfocado, recorridoId, recuperando]);

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

  if (recuperando || !destino) {
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
        red={red}
        zonas={zonas}
        ruta={ruta}
        rastro={rastro}
        destino={destino}
        centroInicial={ubicacionActual ?? destino}
        ubicacionActual={ubicacionActual}
        seguirUsuario={seguirUsuario}
        onMoverMapa={() => setSeguirUsuario(false)}
      />

      <View style={[styles.topCard, { top: insets.top + 12 }]}>
        <View style={styles.topRow}>
          <View style={styles.topInfo}>
            <Text style={styles.eta}>{duracionSegundos ? eta : "Recorrido en curso"}</Text>
            <Text style={styles.destino}>Hacia {destino.nombre}</Text>

            <Text style={styles.recorridoText}>
              Recorrido real: {formatearDistancia(distanciaRecorridaM)}
            </Text>

            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{ubicacionActual ? "Ubicación GPS" : "Buscando señal GPS…"}</Text>
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

      {!seguirUsuario && ubicacionActual && (
        <Pressable accessibilityRole="button" style={[styles.recentrar, { bottom: insets.bottom + 195 }]}
          onPress={() => setSeguirUsuario(true)}>
          <Text style={styles.buttonText}>Recentrar</Text>
        </Pressable>
      )}
      <View style={[styles.bottomPanel, { bottom: insets.bottom + 12 }]}>
        <View style={styles.bottomRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>En vivo</Text>
          </View>
          <Text style={styles.bottomText}>
            {!red ? "Sin conexión al servidor" : !requisitosOk ? "Esperando GPS o permiso" : enviando ? "Sincronizando ubicación..." : "Compartiendo ubicación"}
          </Text>
        </View>

        <Text style={styles.bottomText}>
          El GPS actualiza el mapa aunque no tengas internet.
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
