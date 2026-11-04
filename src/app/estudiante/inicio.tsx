import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../services/supabase"; // Ajusta la ruta si es necesario
import { styles } from "../../styles/InicioStyles";

export default function InicioEstudiante() {
  const [nombre, setNombre] = useState("Estudiante"); // Nombre por defecto

  useEffect(() => {
    const obtenerNombre = async () => {
      // 1. Obtenemos el usuario logueado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 2. Buscamos su nombre en la tabla perfiles
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre_completo")
          .eq("id", user.id)
          .single();

        // 3. Si tiene nombre, lo mostramos (solo el primer nombre)
        if (perfil && perfil.nombre_completo) {
          const primerNombre = perfil.nombre_completo.split(" ")[0];
          setNombre(primerNombre);
        }
      }
    };

    obtenerNombre();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header Azul */}
      <View style={styles.header}>
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

      <View style={styles.body}>
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

        {/* Tarjeta de seguidores (estática por ahora) */}
        <View style={styles.card}>
          <View style={styles.followersRow}>
            <View style={styles.avatars}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: "#1ABC9C", marginLeft: 0 },
                ]}
              >
                <Text style={styles.avatarText}>M</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: "#1A1E3C" }]}>
                <Text style={styles.avatarText}>P</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: "#E5484D" }]}>
                <Text style={styles.avatarText}>H</Text>
              </View>
            </View>
            <Text style={styles.followersText}>
              3 seguidores listos recibirán tu ubicación en vivo.
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#73799D"
            />
          </View>
        </View>

        {/* Botón para iniciar recorrido */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/estudiante/recorrido")}
        >
          <MaterialCommunityIcons
            name="map-marker-path"
            size={24}
            color="#FFF"
          />
          <Text style={styles.buttonText}>Iniciar recorrido</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
