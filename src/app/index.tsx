import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { destinoEstudianteSinRed, destinoPerfil } from "../services/perfilSesion";
import { useSesion } from "../context/SesionContext";
import { styles } from "../styles/WelcomeStyles";

export default function WelcomeScreen() {
  const { session, cargando, actualizarPerfil } = useSesion();
  const margen = useSafeAreaInsets();
  const [fallo, setFallo] = useState(false);
  const revision = useRef(0);
  const abrirCuenta = useCallback(async () => {
    if (!session || cargando) return;
    const turno = ++revision.current;
    setFallo(false);
    try {
      const perfil = await actualizarPerfil(session.user.id);
      const ruta = !perfil && session.user.user_metadata?.rol_solicitado === "seguidor"
        ? "/familiar/acceso" : await destinoPerfil(perfil);
      if (turno === revision.current) router.replace(ruta);
    } catch {
      if (turno !== revision.current) return;
      const destino = await destinoEstudianteSinRed(session.user.id);
      if (turno !== revision.current) return;
      if (destino) router.replace(destino);
      else setFallo(true);
    }
  }, [session, cargando, actualizarPerfil]);
  useFocusEffect(useCallback(() => {
    void abrirCuenta();
    return () => { revision.current++; };
  }, [abrirCuenta]));
  if (session && fallo) return <View style={styles.loading}>
    <Text style={styles.subtitle}>No se pudo cargar tu cuenta.</Text>
    <TouchableOpacity onPress={abrirCuenta}>
      <Text style={styles.cardTitleReintentar}>Reintentar</Text>
    </TouchableOpacity>
  </View>;
  if (cargando || session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1ABC9C" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: margen.top + 20, paddingBottom: margen.bottom }]} contentContainerStyle={{ flexGrow: 1 }}>
      <StatusBar style="light" />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons
            name="map-marker-radius"
            size={60}
            color="#F5A623"
          />
        </View>

        <Text style={styles.title}>LleguéBien</Text>
        <Text style={styles.subtitle}>
          Tu regreso a casa, siempre acompañado.
        </Text>

        <Text style={styles.question}>¿Cómo vas a usar la app?</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/auth")}
          activeOpacity={0.8}
        >
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="school" size={30} color="#FFF" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Soy estudiante</Text>
            <Text style={styles.cardSubtitle}>
              Quiero que me acompañen al volver a casa.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={26}
            color="#73799D"
          />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.card} onPress={() => router.push("/familiar/acceso")}>
          <View style={[styles.iconCircle, { backgroundColor: "#1ABC9C" }]}>
            <MaterialCommunityIcons name="account-heart" size={30} color="#1A1E3C" />
          </View>
          <View style={styles.cardText}><Text style={styles.cardTitle}>Soy familiar o seguidor</Text>
            <Text style={styles.cardSubtitle}>Quiero acompañar a un estudiante.</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={26} color="#73799D" />
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>
        Al continuar aceptas los términos y la política de privacidad.
      </Text>
    </ScrollView>
  );
}
