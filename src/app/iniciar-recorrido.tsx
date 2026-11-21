import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
import { useRequisitosRecorrido } from "../hooks/useRequisitosRecorrido";
import { DESTINO_PRUEBA, conTimeout } from "../lib/recorrido";
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

  const [seguidores, setSeguidores] = useState<SeguidorUI[]>([]);
  const [cargandoSeguidores, setCargandoSeguidores] = useState(true);
  const [iniciando, setIniciando] = useState(false);

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

  const comenzarRecorrido = async () => {
    if (iniciando) return;

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

      const ruta = await obtenerRutaPeatonal(origen, DESTINO_PRUEBA);

      const recorridoId = await crearRecorrido({
        origen,
        destino: DESTINO_PRUEBA,
        destinoNombre: DESTINO_PRUEBA.nombre,
        ruta: ruta?.feature ?? null,
      });

      router.push({
        pathname: "/recorrido",
        params: { recorridoId },
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
                  name="school"
                  size={24}
                  color="#1ABC9C"
                />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Destino</Text>
                <Text style={styles.routeValue}>{DESTINO_PRUEBA.nombre}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>¿Quién te acompaña?</Text>

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
              (!requisitosOk || verificando || iniciando) &&
                styles.buttonDisabled,
            ]}
            onPress={comenzarRecorrido}
            disabled={!requisitosOk || verificando || iniciando}
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={24}
              color="#FFF"
            />
            <Text style={styles.buttonText}>
              {iniciando
                ? "Creando recorrido..."
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
