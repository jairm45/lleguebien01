import { Redirect, Stack } from "expo-router";
import { Text } from "react-native";
import { useSesion } from "../../context/SesionContext";
import { Boton, Pantalla, ui } from "../../components/seguidor/Controles";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function NavegacionSeguidor() {
  const { session, perfil, leyendoPerfil, errorPerfil, actualizarPerfil } = useSesion();
  if (!session) return <Redirect href="/familiar/acceso" />;
  if (leyendoPerfil || errorPerfil) return <Pantalla titulo="Tu cuenta"><Text style={ui.texto}>{errorPerfil ?? "Cargando perfil…"}</Text>
    {errorPerfil && <Boton titulo="Reintentar" accion={() => void actualizarPerfil(session.user.id).catch(() => undefined)} />}</Pantalla>;
  if (perfil?.rol !== "seguidor") return <Redirect href="/" />;
  if (!perfil.identificacion || !perfil.nombre_completo || !perfil.telefono) return <Redirect href="/familiar/datos" />;
  if (!perfil.ciudad || !perfil.pais) return <Redirect href="/familiar/ubicacion" />;
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="seguimiento" />
    <Stack.Screen name="emergencia" />
  </Stack>;
}
