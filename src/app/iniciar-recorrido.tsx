import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { RequisitosRecorrido } from "../components/recorrido/RequisitosRecorrido";
import { useRequisitosRecorrido } from "../hooks/useRequisitosRecorrido";
import { DESTINO_PRUEBA } from "../lib/recorrido";
import { supabase } from "../services/supabase";
import { styles } from "../styles/IniciarRecorridoStyles";

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

  const [nombre, setNombre] = useState("Estudiante");
  const [seguidores, setSeguidores] = useState([
    { id: 1, nombre: "Mamá", inicial: "M", color: "#1ABC9C", activo: true },
    { id: 2, nombre: "Papá", inicial: "P", color: "#1A1E3C", activo: true },
  ]);

  useEffect(() => {
    const obtenerNombre = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("perfiles")
          .select("nombre_completo")
          .eq("id", user.id)
          .single();
        if (data?.nombre_completo) {
          setNombre(data.nombre_completo.split(" ")[0]);
        }
      }
    };
    obtenerNombre();
  }, []);

  const toggleSeguidor = (id: number) => {
    setSeguidores(
      seguidores.map((s) => (s.id === id ? { ...s, activo: !s.activo } : s)),
    );
  };

  const comenzarRecorrido = async () => {
    const activos = seguidores.filter((s) => s.activo);
    if (activos.length === 0) {
      alert("Selecciona al menos un seguidor para acompañarte.");
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

    router.push("/recorrido");
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
          {/* Tarjeta de ruta */}
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

          {/* Seguidores */}
          <Text style={styles.sectionTitle}>¿Quién te acompaña?</Text>
          {seguidores.map((seguidor) => (
            <View key={seguidor.id} style={styles.followerCard}>
              <View
                style={[styles.avatar, { backgroundColor: seguidor.color }]}
              >
                <Text style={styles.avatarText}>{seguidor.inicial}</Text>
              </View>
              <Text style={styles.followerName}>{seguidor.nombre}</Text>
              <Switch
                trackColor={{ false: "#D9DDEF", true: "#1ABC9C" }}
                thumbColor="#FFF"
                onValueChange={() => toggleSeguidor(seguidor.id)}
                value={seguidor.activo}
              />
            </View>
          ))}

          {/* Nota informativa */}
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

          {/* Botón de comenzar */}
          <TouchableOpacity
            style={[
              styles.button,
              (!requisitosOk || verificando) && styles.buttonDisabled,
            ]}
            onPress={comenzarRecorrido}
            disabled={!requisitosOk || verificando}
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={24}
              color="#FFF"
            />
            <Text style={styles.buttonText}>
              {verificando ? "Verificando..." : "Comenzar recorrido"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
