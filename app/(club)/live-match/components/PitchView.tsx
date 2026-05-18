import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import DefaultAvatar from "../../../../components/DefaultAvatar";
import { useTheme } from "../../../../lib/useTheme";
import { StatsEntry, useLiveMatch } from "../context/LiveMatchContext";
import { s } from "../styles";

export default function PitchView() {
  const c = useTheme();
  const {
    visibleStats,
    matchEvents,
    getStatus,
    seconds,
    isRunning,
    setIsRunning,
    setSeconds,
    handleSave,
    saving,
    setPitchPlayer,
  } = useLiveMatch();

  // Categorise players
  const onField: StatsEntry[] = [];
  const bench: StatsEntry[] = [];
  const substituted: StatsEntry[] = [];
  const expelled: StatsEntry[] = [];

  for (const p of visibleStats) {
    const hasRedCard = matchEvents.some(
      (e) => e.playerId === p.playerId && e.type === "RED_CARD",
    );
    if (hasRedCard) {
      expelled.push(p);
      continue;
    }
    const { isCurrentlyPlaying, isBench, isSubbedOut } = getStatus(p.playerId, p.wasStarter);
    if (isCurrentlyPlaying) onField.push(p);
    else if (isBench) bench.push(p);
    else if (isSubbedOut) substituted.push(p);
  }

  const por = onField.filter((p) => p.assignedPosition === "POR");
  const def = onField.filter((p) => p.assignedPosition === "DEF");
  const med = onField.filter((p) => p.assignedPosition === "MED");
  const del = onField.filter((p) => p.assignedPosition === "DEL");
  const unassigned = onField.filter((p) => !p.assignedPosition);

  const formatTime = (total: number) => {
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const renderPitchPlayerCard = (p: StatsEntry) => (
    <TouchableOpacity
      key={p.playerId}
      style={s.pitchPlayerCard}
      onPress={() => setPitchPlayer(p)}
      activeOpacity={0.8}
    >
      <View style={s.pitchAvatar}>
        <DefaultAvatar size={24} color="#ffffff" />
      </View>
      <Text style={s.pitchPlayerName} numberOfLines={1}>
        {p.lastName || p.firstName}
      </Text>
      <View style={s.pitchPlayerStats}>
        {p.goals > 0 && <Text style={s.pitchStatBadge}>⚽{p.goals}</Text>}
        {p.yellowCards > 0 && <Text style={s.pitchStatBadge}>🟨</Text>}
        {p.redCards > 0 && <Text style={s.pitchStatBadge}>🟥</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      {/* Stopwatch */}
      <View style={[s.stopwatch, { backgroundColor: c.input }]}>
        <Text style={[s.stopwatchTime, { color: c.texto }]}>
          {formatTime(seconds)}
        </Text>
        <View style={s.stopwatchBtns}>
          <TouchableOpacity
            style={[s.swBtn, { backgroundColor: isRunning ? "#f59e0b" : "#16a34a" }]}
            onPress={() => setIsRunning((r) => !r)}
          >
            <Text style={s.swBtnText}>
              {isRunning ? "⏸ Pausar" : seconds === 0 ? "▶ Iniciar" : "▶ Reanudar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.swBtn, { backgroundColor: "#6b7280" }]}
            onPress={() => {
              setSeconds(0);
              setIsRunning(false);
            }}
          >
            <Text style={s.swBtnText}>↺ Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pitch */}
      <View style={s.pitch}>
        <View style={s.pitchHalfLabel}><Text style={s.pitchHalfText}>RIVAL</Text></View>
        <View style={s.pitchMidLine} />
        <View style={s.pitchRow}>{del.map(renderPitchPlayerCard)}</View>
        {med.length > 0 && <View style={s.pitchRow}>{med.map(renderPitchPlayerCard)}</View>}
        {def.length > 0 && <View style={s.pitchRow}>{def.map(renderPitchPlayerCard)}</View>}
        {unassigned.length > 0 && <View style={s.pitchRow}>{unassigned.map(renderPitchPlayerCard)}</View>}
        <View style={[s.pitchRow, { justifyContent: "center" }]}>{por.map(renderPitchPlayerCard)}</View>
        <View style={s.pitchHalfLabel}><Text style={s.pitchHalfText}>NUESTRA PORTERÍA</Text></View>
      </View>

      {/* Bench */}
      {bench.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <Text style={[s.sectionTitle, { color: c.texto, fontSize: 13 }]}>🪑 Banquillo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {bench.map((p) => (
              <View
                key={p.playerId}
                style={[s.benchChip, { backgroundColor: c.input }]}
              >
                <Text style={{ fontSize: 11, color: c.texto, fontWeight: "600" }} numberOfLines={1}>
                  {p.firstName[0]}. {p.lastName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Substituted */}
      {substituted.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={[s.sectionTitle, { color: c.subtexto, fontSize: 12 }]}>🔄 Sustituidos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {substituted.map((p) => (
              <View key={p.playerId} style={[s.benchChip, { backgroundColor: c.input, opacity: 0.5 }]}>
                <Text style={{ fontSize: 11, color: c.subtexto, fontWeight: "600" }} numberOfLines={1}>
                  {p.firstName[0]}. {p.lastName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Expelled */}
      {expelled.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Text style={[s.sectionTitle, { color: "#ef4444", fontSize: 12 }]}>🟥 Expulsados</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {expelled.map((p) => (
              <View key={p.playerId} style={[s.benchChip, { backgroundColor: "#ef444415" }]}>
                <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600" }} numberOfLines={1}>
                  {p.firstName[0]}. {p.lastName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: c.boton, opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Guardando..." : "💾 Guardar estadísticas"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
