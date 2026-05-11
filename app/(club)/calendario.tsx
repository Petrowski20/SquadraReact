import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import { useTheme } from "../../lib/useTheme";
import CalendarGrid from "./dashboard/components/CalendarGrid";
import CalendarHeader from "./dashboard/components/CalendarHeader";
import CalendarModals from "./dashboard/components/CalendarModals";
import SchedulePanel from "./dashboard/components/SchedulePanel";
import {
  DashboardProvider,
  useDashboard,
} from "./dashboard/context/DashboardContext";

// ─── Breakpoint ──────────────────────────────────────────────────────────────

const WIDE_BREAKPOINT = 800;

// ─── Tipos locales ────────────────────────────────────────────────────────────

type ActiveTab = "CALENDAR" | "LIST";

// ─── FAB ─────────────────────────────────────────────────────────────────────
// Separado para poder usarlo en ambos layouts sin duplicar JSX.

function CreateFAB() {
  const c = useTheme();
  const { canCreate, setCreateModal } = useDashboard();
  if (!canCreate) return null;
  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: c.boton }]}
      onPress={() => setCreateModal(true)}
    >
      <Text style={styles.fabText}>+</Text>
    </TouchableOpacity>
  );
}

// ─── Layout Wide (>= 800 px) — Side-by-Side 1/3 | 2/3 ───────────────────────

function WideLayout() {
  const c = useTheme();
  const { currentSeasonLabel } = useDashboard();

  return (
    <View style={[styles.wideRow, { backgroundColor: c.fondo }]}>
      {/* ── Panel izquierdo 1/3 ── */}
      <View
        style={[
          styles.leftPanel,
          { borderRightColor: c.bordeInput },
        ]}
      >
        {/* Mini-header para alinear visualmente con el CalendarHeader */}
        <View style={styles.leftPanelHeader}>
          <Text style={[styles.leftPanelSub, { color: c.subtexto }]}>
            Temporada {currentSeasonLabel}
          </Text>
          <Text style={[styles.leftPanelTitle, { color: c.texto }]}>
            Horarios
          </Text>
        </View>

        <SchedulePanel />
      </View>

      {/* ── Panel derecho 2/3 ── */}
      <View style={styles.rightPanel}>
        <CalendarHeader />
        <CalendarGrid />
        <CreateFAB />
      </View>
    </View>
  );
}

// ─── Layout Narrow (< 800 px) — Tabs ─────────────────────────────────────────

function NarrowLayout() {
  const c = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>("CALENDAR");

  return (
    <View style={[styles.wrapper, { backgroundColor: c.fondo }]}>
      {/* ── Tab Bar / Segmented Control ── */}
      <View
        style={[
          styles.mobileTabBar,
          {
            backgroundColor: c.fondo,
            borderBottomColor: c.bordeInput,
            // El paddingTop absorbe el status bar en lugar del CalendarHeader
            paddingTop: Platform.OS === "ios" ? 50 : 36,
          },
        ]}
      >
        <View style={[styles.segmentedWrapper, { backgroundColor: c.input }]}>
          {(
            [
              { key: "CALENDAR" as ActiveTab, label: "📅 Calendario" },
              { key: "LIST" as ActiveTab, label: "📋 Lista" },
            ] as const
          ).map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.segmentedBtn,
                  active && { backgroundColor: c.boton },
                ]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentedText,
                    { color: active ? "#fff" : c.subtexto },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Contenido de la pestaña activa ── */}
      <View style={styles.mobileContent}>
        {activeTab === "CALENDAR" ? (
          <>
            {/*
             * nativeTopPad={false}: el Tab Bar ya absorbió el status bar.
             * CalendarHeader solo necesita un padding decorativo pequeño.
             */}
            <CalendarHeader nativeTopPad={false} />
            <CalendarGrid />
            <CreateFAB />
          </>
        ) : (
          /*
           * SchedulePanel se monta al cambiar al tab Lista.
           * Su useEffect detecta selectedDate (persiste en context) y
           * hace scroll automáticamente al día que el usuario seleccionó
           * en el calendario — incluso si lo hizo en la otra pestaña.
           */
          <SchedulePanel />
        )}
      </View>
    </View>
  );
}

// ─── CalendarioScreen ─────────────────────────────────────────────────────────

function CalendarioScreen() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  return (
    <ScreenContainer>
      <View style={[styles.root, { backgroundColor: c.fondo }]}>
        {isWide ? <WideLayout /> : <NarrowLayout />}

        {/*
         * CalendarModals siempre está montado independientemente del layout.
         * Los Modal de React Native son portales al root de la app — su
         * posición en el árbol no afecta su apariencia, pero sí necesitan
         * estar dentro del DashboardProvider para acceder al context.
         */}
        <CalendarModals />
      </View>
    </ScreenContainer>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function Calendario() {
  return (
    <DashboardProvider>
      <CalendarioScreen />
    </DashboardProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  wrapper: { flex: 1 },

  // ── Wide layout ─────────────────────────────────────────────────────────
  wideRow: {
    flex: 1,
    flexDirection: "row",
  },
  leftPanel: {
    flex: 1,
    borderRightWidth: 1,
    // paddingTop alineado con el paddingTop: 46 del CalendarHeader
    paddingTop: 46,
  },
  leftPanelHeader: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  leftPanelSub: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  leftPanelTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  rightPanel: {
    flex: 2,
  },

  // ── Narrow layout ───────────────────────────────────────────────────────
  mobileTabBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  segmentedWrapper: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: "600",
  },
  mobileContent: {
    flex: 1,
  },

  // ── FAB ─────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 22,
    right: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabText: { fontSize: 28, color: "#fff", fontWeight: "bold" },
});
