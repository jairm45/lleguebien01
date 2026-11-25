import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Aviso, Avatar, Boton, Pantalla, ui, useOperacion } from "../../components/seguidor/Controles";
import { borrarCodigo } from "../../services/perfilSesion";
import { aceptarInvitacion, consultarInvitacion, rechazarInvitacion } from "../../services/seguidores";

export default function Invitacion() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [vista, setVista] = useState<Awaited<ReturnType<typeof consultarInvitacion>> | null>(null);
  const [lectura, setLectura] = useState("");
  const [revision, refrescar] = useState(0);
  const { ejecutar, ocupado, error } = useOperacion();
  useEffect(() => {
    let vigente = true;
    setVista(null); setLectura("");
    void consultarInvitacion(codigo).then(v => { if (vigente) setVista(v); })
      .catch(e => { if (vigente) setLectura(e.message); });
    return () => { vigente = false; };
  }, [codigo, revision]);
  async function salir() { await borrarCodigo(); router.replace("/familiar/vincular"); }
  return <Pantalla titulo="Aceptar invitación">
    <Aviso mensaje={error || lectura} />
    {vista ? <>
      <View style={ui.tarjeta}><Avatar nombre={vista.nombre_completo} />
        <Text style={ui.seccion}>{vista.nombre_completo}</Text>
        {!!vista.universidad && <Text style={ui.texto}>{vista.universidad}</Text>}
      </View>
      <Text style={ui.etiqueta}>Al aceptar podrás</Text>
      {["Ver su ubicación durante el recorrido", "Recibir un aviso al llegar a casa", "Recibir alertas si pide ayuda"].map(t => <Text key={t} style={ui.texto}>✓  {t}</Text>)}
      <Boton titulo="Aceptar y seguir" desactivado={ocupado} accion={() => ejecutar(async () => {
        const estudiante = await aceptarInvitacion(codigo);
        await borrarCodigo();
        router.replace({ pathname: "/familiar/listo", params: { nombre: estudiante.nombre_completo } });
      })} />
      <Boton secundario titulo="Rechazar" desactivado={ocupado} accion={() => ejecutar(async () => {
        await rechazarInvitacion(codigo); await salir();
      })} />
    </> : lectura ? <Boton titulo="Reintentar" accion={() => refrescar(v => v + 1)} /> : <Text style={ui.texto}>Consultando invitación…</Text>}
    <Boton secundario titulo="Volver al código" desactivado={ocupado} accion={() => ejecutar(salir)} />
  </Pantalla>;
}
