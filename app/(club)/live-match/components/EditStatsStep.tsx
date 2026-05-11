import React from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import { STAT_FIELDS, useLiveMatch } from "../context/LiveMatchContext";
import { s } from "../styles";

export default function EditStatsStep() {
  const c = useTheme();
  const { visibleStats, updateStat, handleSave, saving } = useLiveMatch();

  return (
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
      {visibleStats.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 28 }}>📋</Text>
          <Text style={{ color: c.subtexto, marginTop: 8 }}>
            No hay jugadores convocados.
          </Text>
        </View>
      )}

      {visibleStats.map((item) => (
        <View key={item.playerId} style={[s.statsCard, { backgroundColor: c.input }]}>
          <View style={s.playerHeader}>
            <Text style={[s.playerName, { color: c.texto, flex: 1 }]}>
              {item.firstName} {item.lastName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 12, color: c.subtexto }}>Titular</Text>
              <Switch
                value={item.wasStarter}
                onValueChange={(v) => updateStat(item.playerId, "wasStarter", v)}
                trackColor={{ false: c.bordeInput, true: "#16a34a" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={s.countersRow}>
            {STAT_FIELDS.map(({ label, field }) => (
              <View key={field} style={s.counter}>
                <Text style={{ fontSize: 10, color: c.subtexto, marginBottom: 4 }}>
                  {label}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <TouchableOpacity
                    style={[s.counterBtn, { borderColor: c.bordeInput, backgroundColor: c.fondo }]}
                    onPress={() =>
                      updateStat(item.playerId, field, Math.max(0, (item[field] as number) - 1))
                    }
                  >
                    <Text style={{ color: c.texto, fontWeight: "700" }}>−</Text>
                  </TouchableOpacity>
                  <Text
                    style={{
                      minWidth: 22,
                      textAlign: "center",
                      color: c.texto,
                      fontWeight: "700",
                    }}
                  >
                    {item[field] as number}
                  </Text>
                  <TouchableOpacity
                    style={[s.counterBtn, { borderColor: c.bordeInput, backgroundColor: c.fondo }]}
                    onPress={() =>
                      updateStat(item.playerId, field, (item[field] as number) + 1)
                    }
                  >
                    <Text style={{ color: c.texto, fontWeight: "700" }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[s.primaryBtn, { backgroundColor: c.boton, opacity: saving ? 0.6 : 1, marginTop: 8 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.primaryBtnText}>
          {saving ? "Guardando..." : "💾 Guardar estadísticas"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
