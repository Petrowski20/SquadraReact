import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../lib/useTheme";
import { useDashboard } from "../context/DashboardContext";

export default function CalendarGrid() {
  const c = useTheme();
  const { t } = useTranslation();
  const {
    year,
    month,
    events,
    loading,
    selectedDate,
    selectedTeamId,
    setSelectedDate,
    setSelectedDayEvents,
    setDayModal,
  } = useDashboard();

  const renderCalendarGrid = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const grid: React.ReactNode[] = [];
    let dayCount = 1;

    for (let row = 0; row < 6; row++) {
      const daysRow: React.ReactNode[] = [];

      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < startOffset) {
          daysRow.push(<View key={`es-${col}`} style={styles.dayCellEmpty} />);
        } else if (dayCount <= daysInMonth) {
          const currentDate = dayCount;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(currentDate).padStart(2, "0")}`;
          const dayEvents = events.filter((e) => {
            if (selectedTeamId !== null && e.teamId !== selectedTeamId) return false;
            const d = new Date(e.startTime);
            return (
              d.getDate() === currentDate &&
              d.getMonth() === month &&
              d.getFullYear() === year
            );
          });
          const hasMatch = dayEvents.some((e) => e.type === "MATCH");
          const hasTraining = dayEvents.some((e) => e.type === "TRAINING");
          const isSelected = selectedDate === dateStr;

          daysRow.push(
            <TouchableOpacity
              key={`day-${currentDate}`}
              style={[
                styles.dayCell,
                { backgroundColor: isSelected ? `${c.boton}18` : c.input },
                isSelected && { borderWidth: 1.5, borderColor: c.boton },
              ]}
              onPress={() => {
                setSelectedDate(dateStr);
                setSelectedDayEvents(dayEvents);
                setDayModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayText,
                  {
                    color: isSelected ? c.boton : c.texto,
                    fontWeight: isSelected ? "700" : "600",
                  },
                ]}
              >
                {currentDate}
              </Text>
              <View style={styles.barsContainer}>
                {hasTraining && (
                  <View
                    style={[styles.eventBar, { backgroundColor: "#3b82f6" }]}
                  />
                )}
                {hasMatch && (
                  <View
                    style={[styles.eventBar, { backgroundColor: "#f97316" }]}
                  />
                )}
              </View>
            </TouchableOpacity>,
          );
          dayCount++;
        } else {
          daysRow.push(
            <View key={`ee-${row}-${col}`} style={styles.dayCellEmpty} />,
          );
        }
      }

      grid.push(
        <View key={`row-${row}`} style={styles.weekRow}>
          {daysRow}
        </View>,
      );
      if (dayCount > daysInMonth) break;
    }

    return grid;
  };

  return (
    <View style={{ paddingHorizontal: 14 }}>
      <View style={[styles.calendarWrapper, { borderColor: c.bordeInput }]}>
        <View style={styles.weekRow}>
          {[0,1,2,3,4,5,6].map((i) => (
            <Text key={i} style={[styles.weekDayText, { color: c.subtexto }]}>
              {t(`days.${i}`)}
            </Text>
          ))}
        </View>
        {loading ? (
          <ActivityIndicator
            size="large"
            color={c.boton}
            style={{ marginVertical: 16 }}
          />
        ) : (
          renderCalendarGrid()
        )}
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#f97316" }]} />
          <Text style={[styles.legendText, { color: c.subtexto }]}>{t('calendar.matchLegend')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#3b82f6" }]} />
          <Text style={[styles.legendText, { color: c.subtexto }]}>{t('calendar.trainLegend')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 5,
    paddingBottom: 8,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 3,
  },
  weekDayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  dayCell: {
    flex: 1,
    height: 62,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
    margin: 1,
    borderRadius: 7,
  },
  dayCellEmpty: { flex: 1, height: 62, margin: 1 },
  dayText: { fontSize: 14, fontWeight: "600" },
  barsContainer: { width: "88%", gap: 2, marginTop: 3 },
  eventBar: { height: 3, borderRadius: 1.5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legendRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "flex-end",
    marginTop: 5,
    paddingRight: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 10 },
});
