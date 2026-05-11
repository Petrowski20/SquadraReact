import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import {
  FORMATIONS,
  POSITION_ORDER,
  StatsEntry,
  groupByPosition,
  useLiveMatch,
} from "../context/LiveMatchContext";
import { s } from "../styles";

export default function CallupsStep() {
  const c = useTheme();
  const { visibleStats, selectedFormation, setSelectedFormation, setStep, updateStat } =
    useLiveMatch();

  const startersCount = visibleStats.filter((p) => p.wasStarter).length;
  const formation = FORMATIONS.find((f) => f.id === selectedFormation);
  const maxStarters = formation
    ? formation.por + formation.def + formation.med + formation.del
    : 11;
  const isMaxStarters = startersCount >= maxStarters;
  const grouped = groupByPosition(visibleStats);

  const starters = visibleStats.filter((p) => p.wasStarter);
  const porCount = starters.filter((p) => p.assignedPosition === "POR").length;
  const defCount = starters.filter((p) => p.assignedPosition === "DEF").length;
  const medCount = starters.filter((p) => p.assignedPosition === "MED").length;
  const delCount = starters.filter((p) => p.assignedPosition === "DEL").length;

  const formationReady =
    !!formation &&
    porCount === formation.por &&
    defCount === formation.def &&
    medCount === formation.med &&
    delCount === formation.del;

  return (
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
      {/* Formation picker */}
      <Text style={[s.groupTitle, { color: c.subtexto, marginTop: 0 }]}>FORMACIÓN</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {FORMATIONS.map((f) => {
          const active = selectedFormation === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[
                s.formationChip,
                { backgroundColor: active ? c.boton : c.input, borderColor: active ? c.boton : c.bordeInput },
              ]}
              onPress={() => setSelectedFormation(active ? null : f.id)}
            >
              <Text style={{ color: active ? "#fff" : c.subtexto, fontWeight: "700", fontSize: 13 }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {formation && (
        <View style={[s.formationRequirements, { backgroundColor: c.input }]}>
          {[
            { pos: "POR", need: formation.por, have: porCount },
            { pos: "DEF", need: formation.def, have: defCount },
            { pos: "MED", need: formation.med, have: medCount },
            { pos: "DEL", need: formation.del, have: delCount },
          ].map(({ pos, need, have }) => (
            <View key={pos} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: have === need ? "#16a34a" : c.subtexto, fontWeight: "700" }}>
                {pos}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: have === need ? "#16a34a" : c.texto }}>
                {have}/{need}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[s.hint, { color: c.subtexto }]}>
        Pulsa la tarjeta de un jugador para marcarlo como titular.
      </Text>

      <View
        style={[
          s.counterBox,
          { backgroundColor: isMaxStarters ? "#16a34a20" : c.input },
        ]}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: isMaxStarters ? "#16a34a" : c.texto,
          }}
        >
          Titulares: {startersCount} / {maxStarters}
        </Text>
      </View>

      {visibleStats.length === 0 && (
        <View style={s.empty}>
          <Text style={{ fontSize: 28 }}>📋</Text>
          <Text style={{ color: c.subtexto, marginTop: 8 }}>
            No hay jugadores convocados.
          </Text>
        </View>
      )}

      {POSITION_ORDER.map((group) => {
        const players = grouped[group];
        if (!players || players.length === 0) return null;
        return (
          <View key={group}>
            <Text style={[s.groupTitle, { color: c.subtexto }]}>
              {group.toUpperCase()}
            </Text>
            {players.map((item: StatsEntry) => {
              const isStarter = item.wasStarter;
              const isDisabled = !isStarter && isMaxStarters;
              return (
                <TouchableOpacity
                  key={item.playerId}
                  activeOpacity={isDisabled ? 1 : 0.72}
                  onPress={() => {
                    if (isDisabled) return;
                    updateStat(item.playerId, "wasStarter", !item.wasStarter);
                  }}
                  style={[
                    s.callupsCard,
                    {
                      backgroundColor: isStarter ? "#16a34a15" : c.input,
                      borderWidth: 2,
                      borderColor: isStarter ? "#16a34a" : "transparent",
                      opacity: isDisabled ? 0.4 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <Text
                        style={[
                          s.playerName,
                          {
                            color: isStarter ? "#16a34a" : c.texto,
                            fontWeight: isStarter ? "800" : "600",
                          },
                        ]}
                      >
                        {item.firstName} {item.lastName}
                      </Text>
                      {item.position ? (
                        <View style={s.naturalPosBadge}>
                          <Text style={s.naturalPosText}>{item.position}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={[
                        s.starterBadge,
                        {
                          backgroundColor: isStarter ? "#16a34a" : "transparent",
                          borderColor: isStarter ? "#16a34a" : c.bordeInput,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: isStarter ? "#fff" : c.subtexto,
                        }}
                      >
                        {isStarter ? "✓ TITULAR" : "SUPLENTE"}
                      </Text>
                    </View>
                  </View>

                  {isStarter && (
                    <View style={s.positionSelector}>
                      {["POR", "DEF", "MED", "DEL"].map((pos) => {
                        const isSelected = item.assignedPosition === pos;
                        return (
                          <TouchableOpacity
                            key={pos}
                            style={[
                              s.posBtn,
                              isSelected
                                ? { backgroundColor: "#3b82f6", borderColor: "#3b82f6" }
                                : { borderColor: c.bordeInput },
                            ]}
                            onPress={() =>
                              updateStat(item.playerId, "assignedPosition", pos)
                            }
                          >
                            <Text
                              style={[
                                s.posBtnText,
                                { color: isSelected ? "#fff" : c.subtexto },
                              ]}
                            >
                              {pos}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      <TouchableOpacity
        style={[
          s.primaryBtn,
          {
            backgroundColor: "#16a34a",
            marginTop: 8,
            opacity: formationReady ? 1 : 0.5,
          },
        ]}
        disabled={!formationReady}
        onPress={() => setStep("stats")}
      >
        <Text style={s.primaryBtnText}>Confirmar Titulares →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
