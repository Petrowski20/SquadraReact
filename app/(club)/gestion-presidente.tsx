import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../lib/useTheme";
import { useAuthStore } from "../../lib/store";

// Importamos los nuevos componentes separados
import TabSolicitudes from "../../components/presidente/TabSolicitudes";
import TabCuotas from "../../components/presidente/TabCuotas";
import TabEquipos from "../../components/presidente/TabEquipos";

type Tab = "SOLICITUDES" | "CUOTAS" | "EQUIPOS";

export default function GestionPresidente() {
  const c = useTheme();
  const { activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  const [activeTab, setActiveTab] = useState<Tab>("SOLICITUDES");
  const [refreshKey, setRefreshKey] = useState(0);
  const initialFocusDone = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!initialFocusDone.current) {
        initialFocusDone.current = true;
        return;
      }
      let isActive = true;
      setRefreshKey((k) => k + 1);
      return () => { isActive = false; };
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      {/* Cabecera */}
      <View style={{ padding: 24, paddingTop: 60, paddingBottom: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: c.texto, marginBottom: 4 }}>
          {"Administración"}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.subtexto }}>
          {`Temporada ${seasonLabel}`}
        </Text>
      </View>

      {/* Selector de pestañas */}
      <View style={{ flexDirection: "row", paddingHorizontal: 24, marginBottom: 15 }}>
        {(["SOLICITUDES", "CUOTAS", "EQUIPOS"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              {
                flex: 1,
                paddingVertical: 14,
                alignItems: "center",
                borderBottomWidth: 3,
              },
              activeTab === tab
                ? { borderBottomColor: c.boton }
                : { borderBottomColor: "transparent" },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "bold",
                color: activeTab === tab ? c.texto : c.subtexto,
              }}
            >
              {tab === "SOLICITUDES" ? "📩 Peticiones" : tab === "CUOTAS" ? "💳 Cuotas" : "🏆 Equipos"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido (Renderizado Condicional) */}
      <View style={{ flex: 1 }}>
        {activeTab === "SOLICITUDES" && <TabSolicitudes key={refreshKey} />}
        {activeTab === "CUOTAS" && <TabCuotas key={refreshKey} />}
        {activeTab === "EQUIPOS" && <TabEquipos key={refreshKey} />}
      </View>
    </View>
  );
}