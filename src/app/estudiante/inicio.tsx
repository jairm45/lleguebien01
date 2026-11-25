import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResumenSeguidores } from "../../components/ResumenSeguidores";
import { supabase } from "../../services/supabase";
import { styles } from "../../styles/InicioStyles";

export default function InicioEstudiante() {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("Estudiante");

  useEffect(() => {
    const obtenerNombre = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre_completo")
          .eq("id", user.id)
          .single();
        if (perfil && perfil.nombre_completo) {
          const primerNombre = perfil.nombre_completo.split(" ")[0];
          setNombre(primerNombre);
        }
      }
    };
    obtenerNombre();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.greeting}>Hola, {nombre}</Text>
        <Text style={styles.subtitle}>
          Hoy vuelves de la universidad a casa.
        </Text>

        <View style={styles.statusBadge}>
          <MaterialCommunityIcons
            name="shield-check"
            size={16}
            color="#1ABC9C"
          />
          <Text style={styles.statusText}>Protección activa</Text>
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
        {/* Tarjeta del recorrido */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Tu recorrido de hoy</Text>
            <View style={styles.statusTag}>
              <Text style={styles.statusTagText}>Listo para salir</Text>
            </View>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFF3DF" }]}>
                <MaterialCommunityIcons
                  name="school"
                  size={24}
                  color="#F5A623"
                />
              </View>
              <Text style={styles.routeLabel}>Universidad</Text>
            </View>

            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>

            <View style={styles.routePoint}>
              <View style={[styles.iconCircle, { backgroundColor: "#E8F8F5" }]}>
                <MaterialCommunityIcons name="home" size={24} color="#1ABC9C" />
              </View>
              <Text style={styles.routeLabel}>Casa</Text>
            </View>
          </View>
        </View>

        <ResumenSeguidores />

        {/* 👇 NUEVO BOTÓN DE PERMISOS */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFF",
            padding: 15,
            borderRadius: 12,
            marginTop: 10,
            borderWidth: 1,
            borderColor: "#D9DDEF",
          }}
          onPress={() => router.push("/permisos")}
        >
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={20}
            color="#1A1E3C"
          />
          <Text style={{ color: "#1A1E3C", fontWeight: "600", marginLeft: 10 }}>
            Activar permisos de aplicación
          </Text>
        </TouchableOpacity>

        {/* Botón para iniciar recorrido (Corregido) */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/iniciar-recorrido")}
        >
          <MaterialCommunityIcons
            name="map-marker-path"
            size={24}
            color="#FFF"
          />
          <Text style={styles.buttonText}>Iniciar recorrido</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
