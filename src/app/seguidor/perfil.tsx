import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { Avatar, Aviso, Boton, Pantalla, ui, useOperacion } from "../../components/seguidor/Controles";
import { useSesion } from "../../context/SesionContext";
import { crearCanalesNotificaciones, cerrarSesionSeguidor, registrarTokenPush } from "../../services/notificacionesPush";

export default function Perfil() {
  const { session, perfil } = useSesion();
  const [estado, setEstado] = useState("Consultando…");
  const { ejecutar, ocupado, error } = useOperacion();
  useFocusEffect(useCallback(() => {
    let vigente = true;
    async function consultar() {
      if (Platform.OS === "web") { setEstado("Disponibles en la aplicación móvil"); return; }
      const p = await Notifications.getPermissionsAsync();
      const token = p.granted ? await registrarTokenPush() : null;
      if (vigente) setEstado(token ? "Activas en este dispositivo" : p.granted ? "Permiso concedido · registro pendiente" : "Desactivadas");
    }
    void consultar().catch(() => { if (vigente) setEstado("No se pudo comprobar el permiso"); });
    return () => { vigente = false; };
  }, []));
  return <Pantalla titulo="Mi perfil" detalle="Seguidor o familiar">
    <View style={ui.tarjeta}><Avatar nombre={perfil?.nombre_completo ?? ""} /><Text style={ui.seccion}>{perfil?.nombre_completo}</Text>
      {[session?.user.email, perfil?.identificacion, perfil?.telefono, [perfil?.ciudad, perfil?.pais].filter(Boolean).join(", "), perfil?.universidad, perfil?.direccion]
        .map((valor, i) => valor ? <Text selectable key={i} style={ui.texto}>{valor}</Text> : null)}</View>
    <View style={ui.tarjeta}><Text style={ui.seccion}>Notificaciones push</Text><Text style={ui.texto}>{estado}</Text>
      {Platform.OS !== "web" && <Boton secundario titulo="Configurar notificaciones" desactivado={ocupado} accion={() => ejecutar(async () => {
        await crearCanalesNotificaciones();
        const permiso = await Notifications.requestPermissionsAsync();
        if (!permiso.granted) { setEstado("Desactivadas"); if (!permiso.canAskAgain) await Linking.openSettings(); return; }
        setEstado(await registrarTokenPush() ? "Activas en este dispositivo" : "Permiso concedido · registro pendiente");
      })} />
    }</View>
    <Aviso mensaje={error} />
    <Boton titulo="Cerrar sesión" desactivado={ocupado} accion={() => ejecutar(async () => {
      await cerrarSesionSeguidor();
      router.replace("/");
    })} />
  </Pantalla>;
}
