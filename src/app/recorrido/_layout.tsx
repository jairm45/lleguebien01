import { useEffect } from "react";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { avisarSalidaBloqueada } from "../../hooks/useGuardiaRecorrido";
import { Stack } from "expo-router/stack";

import { RecorridoProvider, useRecorrido } from "../../context/RecorridoContext";

export const unstable_settings = { initialRouteName: "index" };

export default function RecorridoLayout() {
  return (
    <RecorridoProvider>
      <FlujoRecorrido />
    </RecorridoProvider>
  );
}

function FlujoRecorrido() {
  const { recorridoId, recuperando, resumenFinal } = useRecorrido();
  // beforeRemove en la ruta padre deja pasar los cambios dentro del Stack hijo.
  usePreventRemove(recuperando || Boolean(recorridoId), avisarSalidaBloqueada);
  useEffect(() => {
    if (resumenFinal) {
      router.replace({ pathname: "/recorrido/llegada", params: { resumen: JSON.stringify(resumenFinal) } });
    }
  }, [resumenFinal]);

  return (
    <Stack screenOptions={{
      headerShown: false,
      gestureEnabled: false,
      contentStyle: { backgroundColor: "#1A1E3C" },
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cuenta-regresiva" />
      <Stack.Screen name="sos" />
      <Stack.Screen name="emergencia" />
      <Stack.Protected guard={Boolean(resumenFinal)}>
        <Stack.Screen name="llegada" />
      </Stack.Protected>
    </Stack>
  );
}
