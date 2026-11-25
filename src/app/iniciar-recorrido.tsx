import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { RequisitosRecorrido } from "../components/recorrido/RequisitosRecorrido";
import {
  useDestinoSeleccionado,
  type DestinoSeleccionado,
} from "../context/DestinoSeleccionContext";
import { useRequisitosRecorrido } from "../hooks/useRequisitosRecorrido";
import { conTimeout } from "../lib/recorrido";
import {
  eliminarDestino,
  establecerDestinoPredeterminado,
  listarDestinosGuardados,
  type DestinoGuardado,
} from "../services/destinos";
import { obtenerRutaPeatonal } from "../services/mapboxDirections";
import { crearRecorrido } from "../services/recorridos";
import { obtenerSeguidoresActivos } from "../services/seguidores";
import { styles } from "../styles/IniciarRecorridoStyles";

const COLORES_AVATAR = ["#1ABC9C", "#1A1E3C", "#E5484D", "#F5A623"];

type SeguidorUI = {
  id: string;
  nombre: string;
  inicial: string;
  color: string;
};

function aSeleccion(destino: DestinoGuardado): DestinoSeleccionado {
  return {
    id: destino.id,
    nombre: destino.nombre,
    direccion: destino.direccion,
    lat: destino.lat,
    lng: destino.lng,
    esPredeterminado: destino.es_predeterminado,
  };
}

export default function IniciarRecorrido() {
  const {
    requisitosOk,
    faltantes,
    verificando,
    haVerificado,
    puedeSolicitarPermiso,
    revalidar,
    solicitarPermiso,
    abrirAjustes,
  } = useRequisitosRecorrido({ monitorear: false });

  const { destinoSeleccionado, setDestinoSeleccionado } =
    useDestinoSeleccionado();

  const [seguidores, setSeguidores] = useState<SeguidorUI[]>([]);
  const [cargandoSeguidores, setCargandoSeguidores] = useState(true);
  const [destinos, setDestinos] = useState<DestinoGuardado[]>([]);
  const [cargandoDestinos, setCargandoDestinos] = useState(true);
  const [errorDestinos, setErrorDestinos] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  const destinoSeleccionadoRef = useRef(destinoSeleccionado);

  useEffect(() => {
    destinoSeleccionadoRef.current = destinoSeleccionado;
  }, [destinoSeleccionado]);

  useEffect(() => {
    let activo = true;

    const cargarSeguidores = async () => {
      try {
        const datos = await obtenerSeguidoresActivos();

        if (!activo) return;

        setSeguidores(
          datos.map((seguidor, indice) => ({
            id: seguidor.id,
            nombre: seguidor.nombre,
            inicial:
              seguidor.nombre.trim().charAt(0).toUpperCase() || "S",
            color: COLORES_AVATAR[indice % COLORES_AVATAR.length],
          })),
        );
      } catch (error) {
        if (activo) {
          console.warn("[seguidores] No se pudieron cargar", error);
        }
      } finally {
        if (activo) setCargandoSeguidores(false);
      }
    };

    void cargarSeguidores();

    return () => {
      activo = false;
    };
  }, []);

  const cargarDestinos = useCallback(async () => {
    setCargandoDestinos(true);
    setErrorDestinos(false);

    try {
      const datos = await listarDestinosGuardados();
      setDestinos(datos);

      if (!destinoSeleccionadoRef.current) {
        const predeterminado = datos.find(
          (destino) => destino.es_predeterminado,
        );

        if (predeterminado) {
          setDestinoSeleccionado(aSeleccion(predeterminado));
        }
      }

      return datos;
    } catch (error) {
      console.warn("[destinos] No se pudieron cargar", error);
      setErrorDestinos(true);
      return [] as DestinoGuardado[];
    } finally {
      setCargandoDestinos(false);
    }
  }, [setDestinoSeleccionado]);

  useFocusEffect(
    useCallback(() => {
      void cargarDestinos();
    }, [cargarDestinos]),
  );

  const elegirEnMapa = () => {
    router.push("/seleccionar-destino");
  };

  const marcarPredeterminado = async (destino: DestinoGuardado) => {
    try {
      const actualizado = await establecerDestinoPredeterminado(destino.id);
      await cargarDestinos();
      setDestinoSeleccionado(aSeleccion(actualizado));
    } catch (error) {
      Alert.alert(
        "No se pudo actualizar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  const confirmarEliminar = (destino: DestinoGuardado) => {
    Alert.alert(
      "Eliminar destino",
      `¿Quieres eliminar "${destino.nombre}" de tus destinos guardados?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await eliminarDestino(destino.id);
                await cargarDestinos();

                if (destinoSeleccionadoRef.current?.id === destino.id) {
                  setDestinoSeleccionado(null);
                }
              } catch (error) {
                Alert.alert(
                  "No se pudo eliminar",
                  error instanceof Error
                    ? error.message
                    : "Inténtalo de nuevo.",
                );
              }
            })();
          },
        },
      ],
    );
  };

  const comenzarRecorrido = async () => {
    if (iniciando) return;

    if (!destinoSeleccionado) {
      Alert.alert(
        "Elige un destino",
        "Selecciona uno de tus destinos guardados o elige uno en el mapa.",
      );
      return;
    }

    const requisitosActuales = await revalidar();

    if (
      !requisitosActuales.gps ||
      !requisitosActuales.permisos ||
      !requisitosActuales.red
    ) {
      return;
    }

    setIniciando(true);

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
          "No se pudo obtener tu ubicación actual.",
        ));

      const origen = {
        latitude: posicion.coords.latitude,
        longitude: posicion.coords.longitude,
      };

      const puntoB = {
        latitude: destinoSeleccionado.lat,
        longitude: destinoSeleccionado.lng,
      };

      const ruta = await obtenerRutaPeatonal(origen, puntoB);

      const recorridoId = await crearRecorrido({
        origen,
        destino: puntoB,
        destinoNombre: destinoSeleccionado.nombre,
        ruta: ruta?.feature ?? null,
        duracionEstimadaSegundos: ruta?.duracionSegundos ?? null,
      });

      router.push({
        pathname: "/recorrido",
        params: {
          recorridoId,
          destinoNombre: destinoSeleccionado.nombre,
          destinoLat: String(destinoSeleccionado.lat),
          destinoLng: String(destinoSeleccionado.lng),
        },
      });
    } catch (error) {
      Alert.alert(
        "No se pudo iniciar el recorrido",
        error instanceof Error
          ? error.message
          : "Inténtalo de nuevo en unos segundos.",
      );
    } finally {
      setIniciando(false);
    }
  };

  const puedeComenzar =
    requisitosOk &&
    Boolean(destinoSeleccionado) &&
    !verificando &&
    !iniciando;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView bounces={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Iniciar recorrido</Text>
          <Text style={styles.headerSubtitle}>
            Confirma tu ruta antes de salir.
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF3DF" }]}>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={24}
                  color="#F5A623"
                />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Salida</Text>
                <Text style={styles.routeValue}>Mi ubicación actual</Text>
              </View>
            </View>

            <View style={styles.dottedLine} />

            <View style={styles.routeRow}>
              <View style={[styles.iconCircle, { backgroundColor: "#E8F8F5" }]}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={24}
                  color="#1ABC9C"
                />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Destino</Text>
                <Text style={styles.routeValue}>
                  {destinoSeleccionado?.nombre ?? "Elige un destino"}
                </Text>
                {destinoSeleccionado?.direccion ? (
                  <Text style={styles.routeHint} numberOfLines={1}>
                    {destinoSeleccionado.direccion}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>¿A dónde vas?</Text>

          {destinoSeleccionado && !destinoSeleccionado.id ? (
            <View style={[styles.destinoCard, styles.destinoCardSelected]}>
              <View style={styles.destinoMain}>
                <View style={styles.destinoIcon}>
                  <MaterialCommunityIcons
                    name="map-marker-check"
                    size={20}
                    color="#1ABC9C"
                  />
                </View>
                <View style={styles.destinoInfo}>
                  <Text style={styles.destinoName} numberOfLines={1}>
                    {destinoSeleccionado.nombre}
                  </Text>
                  <Text style={styles.destinoAddress} numberOfLines={1}>
                    {destinoSeleccionado.direccion ??
                      "Seleccionado en el mapa"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={22}
                  color="#1ABC9C"
                />
              </View>
            </View>
          ) : null}

          {cargandoDestinos ? (
            <View style={styles.destinosLoading}>
              <ActivityIndicator color="#1ABC9C" size="small" />
              <Text style={styles.emptyText}>Cargando destinos...</Text>
            </View>
          ) : destinos.length === 0 ? (
            <View style={styles.emptyFollowers}>
              <MaterialCommunityIcons
                name="map-marker-plus-outline"
                size={30}
                color="#73799D"
              />
              <Text style={styles.emptyTitle}>Elige a dónde vas</Text>
              <Text style={styles.emptyText}>
                Aún no tienes destinos guardados. Marca tu primer Punto B y
                decide si quieres dejarlo como predeterminado.
              </Text>
              <TouchableOpacity
                style={styles.chooseDestinationButton}
                onPress={elegirEnMapa}
              >
                <MaterialCommunityIcons
                  name="map-search-outline"
                  size={20}
                  color="#1ABC9C"
                />
                <Text style={styles.chooseDestinationText}>
                  Elegir destino en el mapa
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {destinos.map((destino) => {
                const seleccionado =
                  destinoSeleccionado?.id === destino.id;

                return (
                  <View
                    key={destino.id}
                    style={[
                      styles.destinoCard,
                      seleccionado && styles.destinoCardSelected,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.destinoMain}
                      onPress={() => setDestinoSeleccionado(aSeleccion(destino))}
                    >
                      <View style={styles.destinoIcon}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={20}
                          color="#F5A623"
                        />
                      </View>

                      <View style={styles.destinoInfo}>
                        <View style={styles.destinoNameRow}>
                          <Text style={styles.destinoName} numberOfLines={1}>
                            {destino.nombre}
                          </Text>
                          {destino.es_predeterminado ? (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                Por defecto
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {destino.direccion ? (
                          <Text style={styles.destinoAddress} numberOfLines={1}>
                            {destino.direccion}
                          </Text>
                        ) : null}
                      </View>

                      {seleccionado ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color="#1ABC9C"
                        />
                      ) : null}
                    </TouchableOpacity>

                    <View style={styles.destinoActions}>
                      {!destino.es_predeterminado ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Establecer como predeterminado"
                          style={styles.destinoActionButton}
                          onPress={() => void marcarPredeterminado(destino)}
                        >
                          <MaterialCommunityIcons
                            name="star-outline"
                            size={19}
                            color="#F5A623"
                          />
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar destino"
                        style={styles.destinoActionButton}
                        onPress={() => confirmarEliminar(destino)}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={19}
                          color="#E5484D"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.chooseDestinationButton}
                onPress={elegirEnMapa}
              >
                <MaterialCommunityIcons
                  name="map-search-outline"
                  size={20}
                  color="#1ABC9C"
                />
                <Text style={styles.chooseDestinationText}>
                  Elegir otro destino en el mapa
                </Text>
              </TouchableOpacity>
            </>
          )}

          {errorDestinos && destinos.length === 0 ? (
            <TouchableOpacity
              style={styles.retryDestinosButton}
              onPress={() => void cargarDestinos()}
            >
              <Text style={styles.retryDestinosText}>
                No se pudieron cargar tus destinos. Reintentar
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>
            ¿Quién te acompaña?
          </Text>

          {cargandoSeguidores ? (
            <View style={styles.followersLoading}>
              <ActivityIndicator color="#1ABC9C" size="small" />
              <Text style={styles.emptyText}>Cargando seguidores...</Text>
            </View>
          ) : seguidores.length === 0 ? (
            <View style={styles.emptyFollowers}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={30}
                color="#73799D"
              />
              <Text style={styles.emptyTitle}>
                Aún no tienes seguidores vinculados
              </Text>
              <Text style={styles.emptyText}>
                Puedes iniciar el recorrido igualmente. Cuando vincules a
                alguien, aparecerá aquí.
              </Text>
            </View>
          ) : (
            <>
              {seguidores.map((seguidor) => (
                <View key={seguidor.id} style={styles.followerCard}>
                  <View
                    style={[styles.avatar, { backgroundColor: seguidor.color }]}
                  >
                    <Text style={styles.avatarText}>{seguidor.inicial}</Text>
                  </View>
                  <Text style={styles.followerName}>{seguidor.nombre}</Text>
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>Activo</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.followersHint}>
                Todos tus seguidores activos recibirán tu ubicación.
              </Text>
            </>
          )}

          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={20}
              color="#F5A623"
            />
            <Text style={styles.infoText}>
              Si agitas el teléfono 4 veces, se activa la alerta de emergencia.
            </Text>
          </View>

          {haVerificado && faltantes.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <RequisitosRecorrido
                variante="card"
                faltantes={faltantes}
                verificando={verificando}
                puedeSolicitarPermiso={puedeSolicitarPermiso}
                onReintentar={() => void revalidar()}
                onAbrirAjustes={() => void abrirAjustes()}
                onSolicitarPermiso={() => void solicitarPermiso()}
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              !puedeComenzar && styles.buttonDisabled,
            ]}
            onPress={comenzarRecorrido}
            disabled={!puedeComenzar}
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={24}
              color="#FFF"
            />
            <Text style={styles.buttonText}>
              {iniciando
                ? "Creando recorrido..."
                : !destinoSeleccionado
                  ? "Elige un destino"
                  : verificando
                    ? "Verificando..."
                    : "Comenzar recorrido"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
