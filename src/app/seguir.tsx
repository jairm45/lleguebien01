import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Aviso, Boton, Pantalla, ui, useOperacion } from "../components/seguidor/Controles";
import { useSesion } from "../context/SesionContext";
import { extraerCodigo, guardarCodigo, destinoPerfil } from "../services/perfilSesion";

export default function Seguir() {
  const { codigo } = useLocalSearchParams<{ codigo?: string }>();
  const { session, perfil, leyendoPerfil, errorPerfil, actualizarPerfil } = useSesion();
  const valor = typeof codigo === "string" ? extraerCodigo(codigo) : null;
  const [fallo, setFallo] = useState(false);
  const { ejecutar, error } = useOperacion();
  useEffect(() => {
    let vigente = true;
    if (valor && !leyendoPerfil && !errorPerfil && perfil?.rol !== "estudiante") {
      void guardarCodigo(valor).then(async () => {
        const ruta = session && perfil ? await destinoPerfil(perfil) : "/familiar/acceso";
        if (vigente) router.replace(ruta);
      }).catch(() => setFallo(true));
    }
    return () => { vigente = false; };
  }, [valor, session, perfil, leyendoPerfil, errorPerfil, fallo]);
  return <Pantalla titulo="Invitación">
    <Text style={ui.texto}>{!valor ? "El enlace no contiene un código válido." : perfil?.rol === "estudiante"
      ? "Este enlace se acepta con una cuenta de familiar o seguidor." : "Abriendo tu invitación…"}</Text>
    <Aviso mensaje={errorPerfil || error || (fallo ? "No se pudo guardar el enlace." : null)} />
    {(errorPerfil || fallo) && <Boton titulo="Reintentar" accion={() => ejecutar(async () => {
      if (session) await actualizarPerfil(session.user.id);
      setFallo(false);
    })} />}
    <Boton titulo="Ir al inicio" secundario accion={() => router.replace("/")} />
  </Pantalla>;
}
