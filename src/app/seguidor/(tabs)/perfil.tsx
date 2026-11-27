import Icono from "@expo/vector-icons/MaterialCommunityIcons";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState, type ComponentProps } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Aviso, Boton, color, ui, useOperacion } from "../../../components/seguidor/Controles";
import { useSesion } from "../../../context/SesionContext";
import { crearCanalesNotificaciones, cerrarSesionSeguidor, registrarTokenPush } from "../../../services/notificacionesPush";

type DatoPerfil = {
  etiqueta: string;
  icono: ComponentProps<typeof Icono>["name"];
  valor?: string | null;
};

export default function Perfil() {
  const { top } = useSafeAreaInsets();
  const { session, perfil } = useSesion();
  const [estado, setEstado] = useState("Consultando…");
  const { ejecutar, ocupado, error } = useOperacion();

  useFocusEffect(useCallback(() => {
    let vigente = true;
    async function consultar() {
      if (Platform.OS === "web") {
        setEstado("Disponibles en la aplicación móvil");
        return;
      }

      const permiso = await Notifications.getPermissionsAsync();
      const token = permiso.granted ? await registrarTokenPush() : null;
      if (vigente) {
        setEstado(token ? "Activas en este dispositivo" : permiso.granted ? "Permiso concedido · registro pendiente" : "Desactivadas");
      }
    }

    void consultar().catch(() => { if (vigente) setEstado("No se pudo comprobar el permiso"); });
    return () => { vigente = false; };
  }, []));

  async function configurarNotificaciones() {
    await crearCanalesNotificaciones();
    const permiso = await Notifications.requestPermissionsAsync();
    if (!permiso.granted) {
      setEstado("Desactivadas");
      if (!permiso.canAskAgain) await Linking.openSettings();
      return;
    }
    setEstado(await registrarTokenPush() ? "Activas en este dispositivo" : "Permiso concedido · registro pendiente");
  }

  async function salir() {
    await cerrarSesionSeguidor();
    router.replace("/");
  }

  const nombre = perfil?.nombre_completo?.trim() || "Mi perfil";
  const inicial = nombre.slice(0, 1).toUpperCase();
  const datos: DatoPerfil[] = [
    { etiqueta: "Correo electrónico", icono: "email-outline", valor: session?.user.email },
    { etiqueta: "Identificación", icono: "card-account-details-outline", valor: perfil?.identificacion },
    { etiqueta: "Teléfono", icono: "phone-outline", valor: perfil?.telefono },
    { etiqueta: "País", icono: "earth", valor: perfil?.pais },
    { etiqueta: "Ciudad", icono: "map-marker-outline", valor: perfil?.ciudad },
    { etiqueta: "Universidad", icono: "school-outline", valor: perfil?.universidad },
    { etiqueta: "Dirección", icono: "home-outline", valor: perfil?.direccion },
  ];

  return (
    <View style={ui.base}>
      <StatusBar style="dark" />
      <View style={[styles.franjaSuperior, { height: top }]} />
      <ScrollView bounces={false}>
        <View style={styles.cabecera}>
          <View style={styles.avatar} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.inicial}>{inicial}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.nombre}>{nombre}</Text>
          <Text style={styles.rol}>Seguidor o familiar</Text>
        </View>

        <View style={styles.cuerpo}>
          {datos.map(({ etiqueta, icono, valor }) => (
            <View key={etiqueta} style={[styles.tarjeta, ui.fila]}>
              <View style={styles.icono}>
                <Icono name={icono} size={20} color={color.tinta} />
              </View>
              <View style={styles.detalle}>
                <Text style={ui.etiqueta}>{etiqueta}</Text>
                <Text selectable style={ui.texto}>{valor?.trim() || "Sin registrar"}</Text>
              </View>
            </View>
          ))}

          <View style={styles.notificaciones}>
            <View style={ui.fila}>
              <View style={styles.icono}>
                <Icono name="bell-outline" size={20} color={color.tinta} />
              </View>
              <View style={styles.detalle}>
                <Text accessibilityRole="header" style={ui.etiqueta}>Notificaciones push</Text>
                <Text accessibilityLiveRegion="polite" style={ui.texto}>{estado}</Text>
              </View>
            </View>
            {Platform.OS !== "web" && (
              <Boton
                secundario
                titulo="Configurar notificaciones"
                desactivado={ocupado}
                accion={() => void ejecutar(configurarNotificaciones)}
              />
            )}
          </View>

          <Aviso mensaje={error} />
          <Pressable
            accessibilityRole="button"
            disabled={ocupado}
            onPress={() => void ejecutar(salir)}
            style={({ pressed }) => [ui.boton, (pressed || ocupado) && styles.atenuado]}
          >
            <Icono name="logout" size={20} color={styles.salir.color} />
            <Text style={[ui.botonTexto, styles.salir]}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  franjaSuperior: { backgroundColor: color.teal },
  cabecera: {
    backgroundColor: color.teal,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 25,
    paddingBottom: 30,
    alignItems: "center",
    gap: 5,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#D9F5ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  inicial: { color: color.tinta, fontSize: 32, fontWeight: "800" },
  nombre: { color: color.navy, fontSize: 24, fontWeight: "800", textAlign: "center" },
  rol: { color: color.navy, fontSize: 14, textAlign: "center" },
  cuerpo: { padding: 20, gap: 10 },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DAE5E2",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E1F2EE",
    alignItems: "center",
    justifyContent: "center",
  },
  detalle: { flex: 1, gap: 2 },
  notificaciones: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DAE5E2",
    borderRadius: 16,
    padding: 15,
    marginTop: 6,
    gap: 14,
  },
  salir: { color: "#B83136" },
  atenuado: { opacity: 0.58 },
});
