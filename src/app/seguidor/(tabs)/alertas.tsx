import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Aviso, Boton, Cabecera, color, ui } from "../../../components/seguidor/Controles";
import { hora } from "../../../components/seguidor/Avance";
import { useConsultaSeguidor } from "../../../hooks/useConsultaSeguidor";
import { destinoMapa } from "../../../lib/navegacionSeguidor";
import { cargarHistorial } from "../../../services/seguimientoFamiliar";

export default function Alertas() {
  const margen = useSafeAreaInsets();
  const [limite, cambiarLimite] = useState(40);
  const cargar = useCallback(() => cargarHistorial(limite), [limite]);
  const { datos, error, reintentar } = useConsultaSeguidor(cargar);
  const hoy = new Date().toDateString();
  const grupos = ["Hoy", "Anteriores"].map(title => ({ title,
    data: datos?.hitos.filter(e => (new Date(e.fecha).toDateString() === hoy) === (title === "Hoy")) ?? [],
  })).filter(g => g.data.length);
  return <View style={ui.base}>
    <Cabecera titulo="Alertas" detalle="Actividad de tus estudiantes" />
    <SectionList sections={grupos} keyExtractor={e => e.clave} stickySectionHeadersEnabled={false}
      contentContainerStyle={[ui.cuerpo, { paddingBottom: margen.bottom + 20 }]}
      renderSectionHeader={({ section }) => <Text style={ui.seccion}>{section.title}</Text>}
      refreshing={!datos && !error} onRefresh={reintentar}
      ListEmptyComponent={error ? <><Aviso mensaje={error} /><Boton titulo="Reintentar" accion={reintentar} /></> :
        <Text style={ui.texto}>{datos ? "Aquí aparecerán sus salidas, llegadas y emergencias." : "Consultando actividad…"}</Text>}
      ListFooterComponent={datos?.hayMas ? <Boton secundario titulo="Ver actividad anterior" accion={() => cambiarLimite(n => n + 40)} /> : undefined}
      renderItem={({ item: e }) => {
        const fecha = new Date(e.fecha).toLocaleDateString("es-CO") + " · " + hora(e.fecha);
        if (e.tipo !== "emergencia") return <View style={ui.tarjeta}>
          <Text style={ui.etiqueta}>{e.nombre + (e.tipo === "salida" ? " salió de camino a casa" : " llegó a casa")}</Text>
          <Text style={ui.texto}>{fecha}</Text>
        </View>;
        return <Pressable accessibilityRole="button" style={[ui.tarjeta, { borderColor: color.rojo, backgroundColor: "#FFF2F2" }]}
          onPress={() => router.push(destinoMapa(e.recorridoId, true, e.alertaId))}>
          <Text style={ui.etiqueta}>Alerta de emergencia</Text>
          <Text style={ui.texto}>{e.nombre}</Text>
          <Text style={ui.texto}>{fecha}</Text>
          <Text style={ui.etiqueta}>Ver alerta ›</Text>
        </Pressable>;
      }} />
  </View>;
}
