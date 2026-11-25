import { Redirect, Stack, usePathname } from "expo-router";
import { Text } from "react-native";
import { Boton, Pantalla, ui } from "../../components/seguidor/Controles";
import { useSesion } from "../../context/SesionContext";

export default function FlujoFamiliar() {
  const { session, perfil, leyendoPerfil, errorPerfil, actualizarPerfil } = useSesion();
  const ruta = usePathname();
  if (ruta !== "/familiar/acceso") {
    if (!session) return <Redirect href="/familiar/acceso" />;
    if (leyendoPerfil || errorPerfil) return <Pantalla titulo="Tu cuenta">
      <Text style={ui.texto}>{errorPerfil ?? "Cargando perfil…"}</Text>
      {errorPerfil && <Boton titulo="Reintentar" accion={() => void actualizarPerfil(session.user.id).catch(() => undefined)} />}
    </Pantalla>;
    if (perfil?.rol !== "seguidor") return <Redirect href="/" />;
    if (!perfil.identificacion && ruta !== "/familiar/datos") return <Redirect href="/familiar/datos" />;
    if ((!perfil.ciudad || !perfil.pais) && !["/familiar/datos", "/familiar/ubicacion"].includes(ruta))
      return <Redirect href="/familiar/ubicacion" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
