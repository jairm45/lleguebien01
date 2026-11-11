import { Text, View } from "react-native";

export default function RecorridoEstudiante() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1A1E3C",
      }}
    >
      <Text style={{ color: "#FFF", fontSize: 20 }}>Recorrido en curso...</Text>
    </View>
  );
}
