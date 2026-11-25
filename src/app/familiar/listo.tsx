import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Avatar, Boton, Pantalla, ui } from "../../components/seguidor/Controles";
export default function VinculacionLista() {
  const { nombre } = useLocalSearchParams<{ nombre: string }>();
  return <Pantalla titulo={`¡Ya acompañas a ${nombre}!`}>
    <View style={ui.tarjeta}><Avatar nombre={nombre ?? ""} /><Text style={ui.seccion}>{nombre}</Text>
      <Text style={[ui.etiqueta, { color: "#075D51" }]}>✓ Vinculada</Text></View>
    <Boton titulo="Ir a mi inicio" accion={() => router.replace("/seguidor/inicio")} />
  </Pantalla>;
}
