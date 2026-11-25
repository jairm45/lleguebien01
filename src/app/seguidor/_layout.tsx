import Icono from "@expo/vector-icons/MaterialCommunityIcons";
import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useSesion } from "../../context/SesionContext";
import { Boton, Pantalla, color, ui } from "../../components/seguidor/Controles";

export default function TabsSeguidor() {
  const { session, perfil, leyendoPerfil, errorPerfil, actualizarPerfil } = useSesion();
  if (!session) return <Redirect href="/familiar/acceso" />;
  if (leyendoPerfil || errorPerfil) return <Pantalla titulo="Tu cuenta"><Text style={ui.texto}>{errorPerfil ?? "Cargando perfil…"}</Text>
    {errorPerfil && <Boton titulo="Reintentar" accion={() => void actualizarPerfil(session.user.id).catch(() => undefined)} />}</Pantalla>;
  if (perfil?.rol !== "seguidor") return <Redirect href="/" />;
  if (!perfil.identificacion || !perfil.nombre_completo || !perfil.telefono) return <Redirect href="/familiar/datos" />;
  if (!perfil.ciudad || !perfil.pais) return <Redirect href="/familiar/ubicacion" />;
  return <Tabs backBehavior="history" screenOptions={{ headerShown: false, tabBarActiveTintColor: color.tinta }}>
    <Tabs.Screen name="inicio" options={{ title: "Inicio", tabBarIcon: p => <Icono name="home-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
    <Tabs.Screen name="alertas" options={{ title: "Alertas", tabBarIcon: p => <Icono name="bell-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
    <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: p => <Icono name="account-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
    <Tabs.Screen name="seguimiento" options={{ href: null, tabBarStyle: { display: "none" } }} />
    <Tabs.Screen name="emergencia" options={{ href: null, tabBarStyle: { display: "none" } }} />
  </Tabs>;
}
