import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../lib/useTheme";
import { useAuthStore } from "../../lib/store";

// Importamos los nuevos componentes separados
import TabSolicitudes from "../../components/presidente/TabSolicitudes";
import TabCuotas from "../../components/presidente/TabCuotas";
import TabEquipos from "../../components/presidente/TabEquipos";

type Tab = "SOLICITUDES" | "CUOTAS" | "EQUIPOS";

export default function GestionPresidente() {
  const c = useTheme();
  const { t } = useTranslation();
  const { activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  const [activeTab, setActiveTab] = useState<Tab>("SOLICITUDES");
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(new Set<Tab>(["SOLICITUDES"]));
  const [refreshKey, setRefreshKey] = useState(0);
  const initialFocusDone = useRef(false);

  const changeTab = useCallback((tab: Tab) => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTab(tab);
  }, []);

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
          {t('presidentManagement.adminTitle')}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: c.subtexto }}>
          {t('calendar.season')} {seasonLabel}
        </Text>
      </View>

      {/* Selector de pestañas */}
      <View style={{ flexDirection: "row", paddingHorizontal: 24, marginBottom: 15 }}>
        {(["SOLICITUDES", "CUOTAS", "EQUIPOS"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => changeTab(tab)}
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
              {tab === "SOLICITUDES" ? `📩 ${t('presidentManagement.tab_requests')}` : tab === "CUOTAS" ? `💳 ${t('presidentManagement.tab_fees')}` : `🏆 ${t('presidentManagement.tab_teams')}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido — lazy mount: se monta al entrar por primera vez, permanece en memoria al cambiar de pestaña */}
      <View style={{ flex: 1 }}>
        {mountedTabs.has("SOLICITUDES") && (
          <View style={{ flex: 1, display: activeTab === "SOLICITUDES" ? "flex" : "none" }}>
            <TabSolicitudes key={refreshKey} />
          </View>
        )}
        {mountedTabs.has("CUOTAS") && (
          <View style={{ flex: 1, display: activeTab === "CUOTAS" ? "flex" : "none" }}>
            <TabCuotas key={refreshKey} />
          </View>
        )}
        {mountedTabs.has("EQUIPOS") && (
          <View style={{ flex: 1, display: activeTab === "EQUIPOS" ? "flex" : "none" }}>
            <TabEquipos key={refreshKey} />
          </View>
        )}
      </View>
    </View>
  );
}