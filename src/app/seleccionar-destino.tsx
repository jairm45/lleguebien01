import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MapaSeleccionDestino } from "../components/destinos/MapaSeleccionDestino";
import { useDestinoSeleccionado } from "../context/DestinoSeleccionContext";
import {
  CENTRO_BUENAVENTURA,
  conTimeout,
  type Coordenada,
} from "../lib/recorrido";
import {
  guardarDestino,
  listarDestinosGuardados,
  type DestinoGuardado,
} from "../services/destinos";
import {
  buscarLugaresMapbox,
  obtenerDireccionDesdeCoordenadas,
  type LugarMapbox,
} from "../services/mapboxGeocoding";
import { styles } from "../styles/SeleccionDestinoStyles";

const CHIPS_NOMBRE = ["Casa", "Universidad", "Trabajo"];

function claveCoordenada(coordenada: Coordenada): string {
  return `${coordenada.latitude.toFixed(5)},${coordenada.longitude.toFixed(5)}`;
}

function sugerirNombreDesdeDireccion(direccion: string): string {
  const primeraParte = direccion.split(",")[0]?.trim() ?? "";

  if (!primeraParte) return "";
  if (primeraParte.length <= 30) return primeraParte;

  return `${primeraParte.slice(0, 27).trim()}...`;
}

export default function SeleccionarDestinoScreen() {
  const insets = useSafeAreaInsets();
  const { height: altoPantalla } = useWindowDimensions();
  const { setDestinoSeleccionado } = useDestinoSeleccionado();

  const [marcador, setMarcador] = useState<Coordenada>(CENTRO_BUENAVENTURA);
  const [centroSolicitado, setCentroSolicitado] = useState<Coordenada | null>(
    null,
  );
  const [ubicacionActual, setUbicacionActual] = useState<Coordenada | null>(
    null,
  );
  const [direccion, setDireccion] = useState("");
  const [nombre, setNombre] = useState("");
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<LugarMapbox[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [buscandoLugares, setBuscandoLugares] = useState(false);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [cargandoUbicacion, setCargandoUbicacion] = useState(false);
  const [guardarEnLista, setGuardarEnLista] = useState(false);
  const [predeterminado, setPredeterminado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [altoPanel, setAltoPanel] = useState(0);

  const montadoRef = useRef(true);
  const ultimaConsultaRef = useRef("");
  const nombreManualRef = useRef(false);
  const solicitudDireccionRef = useRef(0);

  const maxAltoPanel = Math.max(230, Math.round(altoPantalla * 0.35));
  const altoPanelEfectivo = altoPanel || maxAltoPanel;
  const paddingMapa = altoPanelEfectivo + insets.bottom + 24;
  const bottomRecenter = insets.bottom + 12 + altoPanelEfectivo + 10;

  const actualizarDireccion = useCallback(async (coordenada: Coordenada) => {
    const solicitud = ++solicitudDireccionRef.current;
    setBuscandoDireccion(true);

    try {
      const referencia = await obtenerDireccionDesdeCoordenadas(
        coordenada.latitude,
        coordenada.longitude,
      );

      if (
        !montadoRef.current ||
        solicitud !== solicitudDireccionRef.current
      ) {
        return;
      }

      setDireccion(referencia ?? "");

      if (referencia) {
        setNombre((actual) => {
          if (nombreManualRef.current && actual.trim()) {
            return actual;
          }

          return sugerirNombreDesdeDireccion(referencia);
        });
      }
    } finally {
      if (
        montadoRef.current &&
        solicitud === solicitudDireccionRef.current
      ) {
        setBuscandoDireccion(false);
      }
    }
  }, []);

  useEffect(() => {
    let activo = true;
    montadoRef.current = true;

    const cargarDatosIniciales = async () => {
      try {
        const destinos = await listarDestinosGuardados();

        if (activo) {
          const sinPredeterminado = !destinos.some(
            (destino) => destino.es_predeterminado,
          );

          if (destinos.length === 0 || sinPredeterminado) {
            setPredeterminado(true);
          }
        }
      } catch {
        // La pantalla sigue funcionando aunque falle la consulta de destinos.
      }

      try {
        const ultima = await Location.getLastKnownPositionAsync({
          maxAge: 60000,
          requiredAccuracy: 100,
        }).catch(() => null);

        const posicion =
          ultima ??
          (await conTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }),
            10000,
            "No se pudo obtener tu ubicación.",
          ));

        if (!activo) return;

        const coordenada: Coordenada = {
          latitude: posicion.coords.latitude,
          longitude: posicion.coords.longitude,
        };

        setUbicacionActual(coordenada);
        setMarcador(coordenada);
        setCentroSolicitado(coordenada);
        ultimaConsultaRef.current = claveCoordenada(coordenada);
        void actualizarDireccion(coordenada);
      } catch {
        // Se mantiene el centro de referencia de Buenaventura.
      }
    };

    void cargarDatosIniciales();

    return () => {
      activo = false;
      montadoRef.current = false;
    };
  }, [actualizarDireccion]);

  useEffect(() => {
    const texto = query.trim();

    if (texto.length < 3) {
      setResultados([]);
      setBuscandoLugares(false);
      return;
    }

    let activo = true;

    const temporizador = setTimeout(async () => {
      setBuscandoLugares(true);

      try {
        const proximidad = ubicacionActual
          ? {
              lat: ubicacionActual.latitude,
              lng: ubicacionActual.longitude,
            }
          : undefined;

        const encontrados = await buscarLugaresMapbox(texto, proximidad);

        if (activo) {
          setResultados(encontrados);
          setMostrarResultados(true);
        }
      } finally {
        if (activo) setBuscandoLugares(false);
      }
    }, 400);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [query, ubicacionActual]);

  const manejarPuntoSeleccionado = useCallback(
    (coordenada: Coordenada) => {
      setMarcador(coordenada);
      setMostrarResultados(false);

      const clave = claveCoordenada(coordenada);

      ultimaConsultaRef.current = clave;
      void actualizarDireccion(coordenada);
    },
    [actualizarDireccion],
  );

  const seleccionarLugar = (lugar: LugarMapbox) => {
    const coordenada: Coordenada = {
      latitude: lugar.lat,
      longitude: lugar.lng,
    };

    solicitudDireccionRef.current += 1;
    setBuscandoDireccion(false);
    ultimaConsultaRef.current = claveCoordenada(coordenada);
    setMarcador(coordenada);
    setCentroSolicitado(coordenada);
    setDireccion(lugar.direccion);
    setNombre(lugar.nombre);
    nombreManualRef.current = true;
    setQuery(lugar.nombre);
    setResultados([]);
    setMostrarResultados(false);
  };

  const limpiarBusqueda = () => {
    setQuery("");
    setResultados([]);
    setMostrarResultados(false);
  };

  const recentrar = async () => {
    setCargandoUbicacion(true);

    try {
      const ultima = await Location.getLastKnownPositionAsync({
        maxAge: 60000,
        requiredAccuracy: 100,
      }).catch(() => null);

      const posicion =
        ultima ??
        (await conTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          10000,
          "No se pudo obtener tu ubicación.",
        ));

      const coordenada: Coordenada = {
        latitude: posicion.coords.latitude,
        longitude: posicion.coords.longitude,
      };

      ultimaConsultaRef.current = claveCoordenada(coordenada);
      setUbicacionActual(coordenada);
      setMarcador(coordenada);
      setCentroSolicitado(coordenada);
      void actualizarDireccion(coordenada);
    } catch (error) {
      Alert.alert(
        "No se pudo recentrar",
        error instanceof Error
          ? error.message
          : "Verifica que el GPS esté encendido.",
      );
    } finally {
      setCargandoUbicacion(false);
    }
  };

  const confirmarDestino = async () => {
    if (guardando) return;

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      Alert.alert(
        "Falta el nombre",
        "Escribe un nombre para reconocer este destino.",
      );
      return;
    }

    if (
      !Number.isFinite(marcador.latitude) ||
      !Number.isFinite(marcador.longitude)
    ) {
      Alert.alert(
        "Falta el punto",
        "Toca el mapa o arrastra el pin hasta el lugar exacto.",
      );
      return;
    }

    setGuardando(true);

    try {
      let guardado: DestinoGuardado | null = null;

      if (guardarEnLista) {
        guardado = await guardarDestino({
          nombre: nombreLimpio,
          direccion: direccion.trim() || null,
          lat: marcador.latitude,
          lng: marcador.longitude,
          esPredeterminado: predeterminado,
        });
      }

      setDestinoSeleccionado({
        id: guardado?.id,
        nombre: guardado?.nombre ?? nombreLimpio,
        direccion:
          guardado?.direccion ?? (direccion.trim() ? direccion.trim() : null),
        lat: guardado?.lat ?? marcador.latitude,
        lng: guardado?.lng ?? marcador.longitude,
        esPredeterminado:
          guardado?.es_predeterminado ??
          (guardarEnLista ? predeterminado : false),
      });

      router.back();
    } catch (error) {
      Alert.alert(
        "No se pudo guardar el destino",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />

      <MapaSeleccionDestino
        centroInicial={CENTRO_BUENAVENTURA}
        centroSolicitado={centroSolicitado}
        marcador={marcador}
        paddingInferior={paddingMapa}
        onPressMapa={manejarPuntoSeleccionado}
        onDragEnd={manejarPuntoSeleccionado}
      />

      <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar selector"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color="#1A1E3C"
            />
          </Pressable>

          <TextInput
            style={styles.searchInput}
            placeholder="Buscar dirección o lugar..."
            placeholderTextColor="#73799D"
            value={query}
            onChangeText={(texto) => {
              const suficiente = texto.trim().length >= 3;

              setQuery(texto);
              setMostrarResultados(suficiente);
              setBuscandoLugares(suficiente);
            }}
            onFocus={() => setMostrarResultados(query.trim().length >= 3)}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {buscandoLugares ? (
            <ActivityIndicator color="#1ABC9C" size="small" />
          ) : query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              onPress={limpiarBusqueda}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name="close-circle-outline"
                size={19}
                color="#73799D"
              />
            </Pressable>
          ) : null}
        </View>

        {mostrarResultados && query.trim().length >= 3 ? (
          <View style={styles.resultsCard}>
            {buscandoLugares ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>Buscando lugares...</Text>
              </View>
            ) : resultados.length === 0 ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>
                  No encontramos resultados en Colombia.
                </Text>
              </View>
            ) : (
              resultados.map((lugar, indice) => (
                <Pressable
                  key={lugar.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar ${lugar.nombre}`}
                  onPress={() => seleccionarLugar(lugar)}
                  style={({ pressed }) => [
                    styles.resultRow,
                    indice === resultados.length - 1 && styles.resultRowLast,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.resultIcon}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={18}
                      color="#F5A623"
                    />
                  </View>
                  <View style={styles.resultText}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {lugar.nombre}
                    </Text>
                    <Text style={styles.resultAddress} numberOfLines={2}>
                      {lugar.direccion}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Centrar en mi ubicación"
        onPress={() => void recentrar()}
        disabled={cargandoUbicacion}
        style={({ pressed }) => [
          styles.recenterButton,
          { bottom: bottomRecenter },
          (pressed || cargandoUbicacion) && styles.pressed,
        ]}
      >
        {cargandoUbicacion ? (
          <ActivityIndicator color="#1ABC9C" size="small" />
        ) : (
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={22}
            color="#1A1E3C"
          />
        )}
      </Pressable>

      <View
        style={[
          styles.bottomPanel,
          { bottom: insets.bottom + 12, maxHeight: maxAltoPanel },
        ]}
        onLayout={(evento) =>
          setAltoPanel(evento.nativeEvent.layout.height)
        }
      >
        <ScrollView
          style={[
            styles.bottomPanelScroll,
            { maxHeight: Math.max(180, maxAltoPanel - 18) },
          ]}
          contentContainerStyle={styles.bottomPanelContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.handle} />

          <View style={styles.addressRow}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={18}
              color="#1ABC9C"
            />
            <Text style={styles.addressText} numberOfLines={2}>
              {buscandoDireccion
                ? "Buscando una referencia para este punto..."
                : direccion ||
                  "Toca el mapa o arrastra el pin para ajustar el punto."}
            </Text>
          </View>

          <View style={styles.chipsRow}>
            {CHIPS_NOMBRE.map((chip) => {
              const activo =
                nombre.trim().toLowerCase() === chip.toLowerCase();

              return (
                <Pressable
                  key={chip}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar nombre ${chip}`}
                  onPress={() => {
                    nombreManualRef.current = true;
                    setNombre(chip);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    activo && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      activo && styles.chipTextActive,
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder='Nombre (ej. "Casa")'
              placeholderTextColor="#999"
              value={nombre}
              onChangeText={(texto) => {
                nombreManualRef.current = true;
                setNombre(texto);
              }}
              maxLength={80}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Guardar en mis destinos
            </Text>
            <Switch
              value={guardarEnLista}
              onValueChange={setGuardarEnLista}
              trackColor={{ false: "#D9DDEF", true: "#1ABC9C" }}
              thumbColor="#FFF"
            />
          </View>

          {guardarEnLista ? (
            <View style={[styles.switchRow, styles.defaultRow]}>
              <Text style={styles.switchLabel}>
                ¿Dejar como destino por defecto?
              </Text>
              <Switch
                value={predeterminado}
                onValueChange={setPredeterminado}
                trackColor={{ false: "#D9DDEF", true: "#F5A623" }}
                thumbColor="#FFF"
              />
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirmar destino"
            disabled={guardando || !nombre.trim()}
            onPress={() => void confirmarDestino()}
            style={({ pressed }) => [
              styles.confirmButton,
              (guardando || !nombre.trim()) && styles.confirmButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {guardando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons
                name="check"
                size={20}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.confirmButtonText}>
              {guardando ? "Guardando..." : "Confirmar destino"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
