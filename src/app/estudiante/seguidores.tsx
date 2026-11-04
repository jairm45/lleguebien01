import { Text, View } from "react-native";

export default function SeguidoresScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8F9FA",
      }}
    >
      <Text style={{ fontSize: 18, color: "#1A1E3C" }}>
        Lista de seguidores
      </Text>
    </View>
  );
}
