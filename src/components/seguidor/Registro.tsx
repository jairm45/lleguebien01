import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useSesion } from "../../context/SesionContext";
import { leerCodigo } from "../../services/perfilSesion";
import { estudiantesSeguidos } from "../../services/seguidores";
import { supabase } from "../../services/supabase";
import { Aviso, Boton, Campo, Pantalla, ui, useOperacion } from "./Controles";

export function Registro({ personal }: { personal: boolean }) {
  const { session, perfil, actualizarPerfil } = useSesion();
  const [identificacion, setIdentificacion] = useState(perfil?.identificacion ?? "");
  const [nombre, setNombre] = useState(perfil?.nombre_completo ?? "");
  const [telefono, setTelefono] = useState(perfil?.telefono ?? "");
  const [pais, setPais] = useState(perfil?.pais ?? "");
  const [ciudad, setCiudad] = useState(perfil?.ciudad ?? "");
  const [universidad, setUniversidad] = useState(perfil?.universidad ?? "");
  const [direccion, setDireccion] = useState(perfil?.direccion ?? "");
  const { ejecutar, ocupado, error } = useOperacion();
  async function guardar() {
    if (!session || perfil?.rol !== "seguidor") throw new Error("Vuelve a iniciar sesión.");
    if (personal && (!identificacion.trim() || !nombre.trim() || !/^\+?\d{6,15}$/.test(telefono.replace(/[\s()-]/g, ""))))
      throw new Error("Completa tu identificación, nombre y teléfono.");
    if (!personal && (!pais.trim() || !ciudad.trim())) throw new Error("Escribe tu país y ciudad.");
    const cambios = personal ? { identificacion: identificacion.trim(), nombre_completo: nombre.trim(), telefono: telefono.trim() }
      : { pais: pais.trim(), ciudad: ciudad.trim(), universidad: universidad.trim() || null, direccion: direccion.trim() || null };
    const { error: fallo } = await supabase.from("perfiles").update(cambios).eq("id", session.user.id)
      .eq("rol", "seguidor").select("id").single();
    if (fallo) throw new Error("No se pudieron guardar tus datos.");
    await actualizarPerfil(session.user.id);
    if (personal) { router.replace("/familiar/ubicacion"); return; }
    const codigo = await leerCodigo();
    if (codigo) router.replace({ pathname: "/familiar/invitacion", params: { codigo } });
    else router.replace((await estudiantesSeguidos()).length ? "/seguidor/inicio" : "/familiar/vincular");
  }
  return <Pantalla detalle={personal ? "Registro · 1 de 2" : "Registro · 2 de 2"} titulo={personal ? "Datos personales" : "Ubicación y estudios"}>
    <Text style={[ui.etiqueta, { alignSelf: "flex-start", borderRadius: 14, padding: 8, backgroundColor: "#D9F5ED" }]}>Seguidor o familiar</Text>
    {personal ? <>
      <Campo titulo="Identificación" value={identificacion} onChangeText={setIdentificacion} />
      <Campo titulo="Correo electrónico" editable={false} value={session?.user.email ?? ""} />
      <Campo titulo="Nombre completo" autoComplete="name" value={nombre} onChangeText={setNombre} />
      <Campo titulo="Teléfono" keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
    </> : <>
      <Campo titulo="País" value={pais} onChangeText={setPais} />
      <Campo titulo="Ciudad" value={ciudad} onChangeText={setCiudad} />
      <Campo titulo="Universidad (opcional)" value={universidad} onChangeText={setUniversidad} />
      <Campo titulo="Dirección (opcional)" value={direccion} onChangeText={setDireccion} />
    </>}
    <Aviso mensaje={error} />
    <Boton titulo="Guardar y continuar" desactivado={ocupado} accion={() => ejecutar(guardar)} />
  </Pantalla>;
}
