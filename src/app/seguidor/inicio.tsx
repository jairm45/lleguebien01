import Icono from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Avatar, Aviso, Boton, Pantalla, ui, color } from "../../components/seguidor/Controles";
import { Avance, hora } from "../../components/seguidor/Avance";
import { useSesion } from "../../context/SesionContext";
import { useConsultaSeguidor } from "../../hooks/useConsultaSeguidor";
import { cargarInicio } from "../../services/seguimientoFamiliar";

export default function Inicio() {
  const { perfil } = useSesion();
  const { datos, error, reintentar } = useConsultaSeguidor(cargarInicio);
  const rutas = datos?.rutas.slice().sort((a,b) => Number(b.estado === "emergencia") - Number(a.estado === "emergencia"));
  return <Pantalla titulo={`Hola, ${perfil?.nombre_completo?.split(" ")[0] ?? ""}`} detalle="Seguidor o familiar"
    accion={<Pressable accessibilityLabel="Ir a alertas" accessibilityRole="button" hitSlop={12} onPress={() => router.navigate("/seguidor/alertas")}>
      <Icono name="bell-outline" color={color.navy} size={26} /></Pressable>}>
    <Aviso mensaje={error} />{error && <Boton titulo="Reintentar" accion={reintentar} />}
    {!datos && !error && <Text style={ui.texto}>Cargando estudiantes…</Text>}
    {rutas?.map(r => {
      const emergencia = r.estado === "emergencia";
      return <View key={r.id} style={[ui.tarjeta, emergencia && { borderColor: color.rojo, backgroundColor: "#FFF1F1" }]}>
        <Text style={[ui.etiqueta, { color: emergencia ? "#AD292F" : color.tinta }]}>{emergencia ? "Alerta de emergencia" : "● En vivo"}</Text>
        <Text style={ui.seccion}>{datos?.estudiantes.find(e => e.id === r.id_usuario)?.nombre_completo}</Text>
        {!emergencia && <Avance ruta={r} />}
        <Boton titulo={emergencia ? "Ver emergencia" : "Ver en el mapa"} peligro={emergencia}
          accion={() => router.navigate({ pathname: emergencia ? "/seguidor/emergencia" : "/seguidor/seguimiento", params: { recorridoId: r.id } })} />
      </View>;
    })}
    <Text style={ui.seccion}>Mis estudiantes</Text>
    {datos?.estudiantes.length === 0 && <Text style={ui.texto}>Aún no acompañas a ningún estudiante. Usa su invitación para empezar.</Text>}
    {datos?.estudiantes.map(e => <View key={e.id} style={[ui.tarjeta, ui.fila]}><Avatar nombre={e.nombre_completo} /><View style={{ flex: 1 }}>
      <Text style={ui.etiqueta}>{e.nombre_completo}</Text><Text style={ui.texto}>{e.recorrido_actual ? (e.recorrido_actual.estado === "emergencia" ? "Necesita ayuda" : "En recorrido")
        : e.ultimo_recorrido_finalizado?.finalizado_en ? `En casa · Llegó a las ${hora(e.ultimo_recorrido_finalizado.finalizado_en)}` : "Aún sin recorrido"}</Text>
    </View></View>)}
    <Pressable accessibilityRole="button" style={[ui.boton, { borderWidth: 1, borderStyle: "dashed", borderColor: color.tinta }]}
      onPress={() => router.push("/familiar/vincular")}><Text style={[ui.botonTexto, { color: color.tinta }]}>+ Vincular otro estudiante</Text></Pressable>
  </Pantalla>;
}
