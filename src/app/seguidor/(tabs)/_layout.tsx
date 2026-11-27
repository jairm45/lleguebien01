import Icono from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { color } from "../../../components/seguidor/Controles";

export const unstable_settings = { initialRouteName: "inicio" };

export default function PestanasSeguidor() {
  return <Tabs backBehavior="history" screenOptions={{ headerShown: false, tabBarActiveTintColor: color.tinta }}>
    <Tabs.Screen name="inicio" options={{ title: "Inicio", tabBarIcon: p => <Icono name="home-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
    <Tabs.Screen name="alertas" options={{ title: "Alertas", tabBarIcon: p => <Icono name="bell-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
    <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: p => <Icono name="account-outline" size={p.size} color={p.focused ? color.tinta : color.gris} /> }} />
  </Tabs>;
}
