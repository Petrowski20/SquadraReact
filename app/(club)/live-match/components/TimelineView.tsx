import React from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import { useLiveMatch } from "../context/LiveMatchContext";
import { s } from "../styles";

const EVENT_LABEL: Record<string, string> = {
  GOAL: "⚽ Gol",
  ASSIST: "🎯 Asistencia",
  YELLOW_CARD: "🟨 Amarilla",
  RED_CARD: "🟥 Roja",
  SUB_IN: "🔄 Entra",
  SUB_OUT: "🔄 Sale",
};

export default function TimelineView() {
  const c = useTheme();
  const { matchEvents, stats, handleUndoEvent, handleSave, saving } = useLiveMatch();

  const sorted = [...matchEvents].sort((a, b) => a.minute - b.minute);

  return (
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
      {sorted.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 28 }}>📋</Text>
          <Text style={{ color: c.subtexto, marginTop: 8, textAlign: "center" }}>
            Aún no hay eventos registrados.
          </Text>
        </View>
      ) : (
        sorted.map((event) => {
          const player = stats.find((p) => p.playerId === event.playerId);
          return (
            <View key={event.id} style={[s.timelineRow, { backgroundColor: c.input }]}>
              <View style={[s.timelineBadge, { backgroundColor: `${c.boton}20` }]}>
                <Text style={[s.timelineMin, { color: c.boton }]}>{event.minute}'</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: c.texto }}>
                  {EVENT_LABEL[event.type] ?? event.type}
                </Text>
                {player && (
                  <Text style={{ fontSize: 12, color: c.subtexto }}>
                    {player.firstName} {player.lastName}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Deshacer", "¿Quitar este evento?", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Deshacer", style: "destructive", onPress: () => handleUndoEvent(event.id) },
                  ])
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 16, color: "#ef4444" }}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={[s.primaryBtn, { backgroundColor: c.boton, opacity: saving ? 0.6 : 1, marginTop: 8 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.primaryBtnText}>{saving ? "Guardando..." : "💾 Guardar estadísticas"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
