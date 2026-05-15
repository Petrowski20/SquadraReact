import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../lib/useTheme";
import { useDashboard } from "../context/DashboardContext";

interface CalendarHeaderProps {
  /** false cuando el componente se renderiza debajo de otro header (ej: tab bar
   *  en móvil) y no necesita compensar el status bar por sí mismo. */
  nativeTopPad?: boolean;
}

export default function CalendarHeader({ nativeTopPad = true }: CalendarHeaderProps) {
  const c = useTheme();
  const { t } = useTranslation();
  const {
    month,
    year,
    currentSeasonLabel,
    canCreate,
    isPresident,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    goToPrevMonth,
    goToNextMonth,
    handleImportClick,
    isImporting,
    setExportModal,
  } = useDashboard();

  return (
    <>
      {/* CABECERA */}
      <View style={[styles.headerRow, !nativeTopPad && { paddingTop: 14 }]}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <View>
            <Text style={[styles.headerTitle, { color: c.texto }]}>
              {t('calendar.title')}
            </Text>
            <Text style={[styles.headerSub, { color: c.subtexto }]}>
              {t('calendar.season')} {currentSeasonLabel}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {canCreate && (
              <TouchableOpacity
                style={[
                  styles.exportBtn,
                  { backgroundColor: c.input, borderColor: c.bordeInput },
                ]}
                onPress={handleImportClick}
                disabled={isImporting}
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color={c.boton} />
                ) : (
                  <>
                    <Text style={{ fontSize: 14 }}>📥</Text>
                    <Text
                      style={{ fontSize: 12, color: c.subtexto, fontWeight: "600" }}
                    >
                      Import
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.exportBtn,
                { backgroundColor: c.input, borderColor: c.bordeInput },
              ]}
              onPress={() => setExportModal(true)}
            >
              <Text style={{ fontSize: 14 }}>📤</Text>
              <Text style={{ fontSize: 12, color: c.subtexto, fontWeight: "600" }}>
                CSV
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* FILTROS PRESIDENTE */}
      {isPresident && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: !selectedTeamId ? `${c.boton}20` : c.input },
              ]}
              onPress={() => setSelectedTeamId(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: !selectedTeamId ? c.boton : c.subtexto },
                ]}
              >
                {t('calendar.all')}
              </Text>
            </TouchableOpacity>
            {teams.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedTeamId === t.id ? `${c.boton}20` : c.input,
                  },
                ]}
                onPress={() => setSelectedTeamId(t.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selectedTeamId === t.id ? c.boton : c.subtexto },
                  ]}
                >
                  {t.category} {t.suffix}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* NAVEGACIÓN DE MES */}
      <View style={{ paddingHorizontal: 14 }}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth}>
            <Text style={[styles.navBtnText, { color: c.boton }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: c.texto }]}>
            {t(`months.${month}`)} {year}
          </Text>
          <TouchableOpacity onPress={goToNextMonth}>
            <Text style={[styles.navBtnText, { color: c.boton }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingTop: 90, paddingBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: "bold" },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    marginTop: 2,
  },
  navBtnText: { fontSize: 24, fontWeight: "bold", paddingHorizontal: 6 },
  monthText: { fontSize: 15, fontWeight: "bold" },
});
