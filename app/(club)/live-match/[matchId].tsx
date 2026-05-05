import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenContainer from "../../../components/ScreenContainer";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../../lib/store";
import { useTheme } from "../../../lib/useTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchMode = "LIVE" | "EDIT";
type Step = "callups" | "stats";

interface MatchEvent {
  playerId: number;
  type: "SUB_IN" | "SUB_OUT" | "RED_CARD";
  minute: number;
}

interface CallupEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  status: "CALLED_UP" | "NOT_CALLED_UP" | "INJURED";
}

interface StatsEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  wasStarter: boolean;
  position?: string;
  assignedPosition?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STAT_FIELDS: { label: string; field: keyof StatsEntry }[] = [
  { label: "Goles", field: "goals" },
  { label: "Asist.", field: "assists" },
  { label: "Amarillas", field: "yellowCards" },
  { label: "Rojas", field: "redCards" },
  { label: "Minutos", field: "minutesPlayed" },
];

const formatTime = (total: number) => {
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// ─── Position helpers (module-level, pure) ────────────────────────────────────

const POSITION_MAP: Record<string, string> = {
  POR: "Porteros", GK: "Porteros", PORTERO: "Porteros",
  DEF: "Defensas", CB: "Defensas", LB: "Defensas", RB: "Defensas",
  WB: "Defensas", DEFENSA: "Defensas",
  MED: "Centrocampistas", CM: "Centrocampistas", MC: "Centrocampistas",
  CAM: "Centrocampistas", CDM: "Centrocampistas", CENTROCAMPISTA: "Centrocampistas",
  MEDIOCAMPISTA: "Centrocampistas",
  DEL: "Delanteros", FW: "Delanteros", ST: "Delanteros", CF: "Delanteros",
  LW: "Delanteros", RW: "Delanteros", DELANTERO: "Delanteros", ATACANTE: "Delanteros",
};

const POSITION_ORDER = ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Otros"];

function groupByPosition(players: StatsEntry[]): Record<string, StatsEntry[]> {
  return players.reduce(
    (acc, player) => {
      const raw = (player.position ?? "").toUpperCase();
      const group = POSITION_MAP[raw] ?? "Otros";
      return { ...acc, [group]: [...(acc[group] ?? []), player] };
    },
    {} as Record<string, StatsEntry[]>,
  );
}

function getPlayerStatus(
  playerId: number,
  wasStarter: boolean,
  events: MatchEvent[],
): { isCurrentlyPlaying: boolean; isBench: boolean; isSubbedOut: boolean } {
  const playerEvents = events.filter((e) => e.playerId === playerId);
  if (playerEvents.length === 0) {
    return { isCurrentlyPlaying: wasStarter, isBench: !wasStarter, isSubbedOut: false };
  }
  const lastEvent = playerEvents[playerEvents.length - 1];
  const isCurrentlyPlaying = lastEvent.type === "SUB_IN";
  const hasEverPlayed = wasStarter || playerEvents.some((e) => e.type === "SUB_IN");
  return {
    isCurrentlyPlaying,
    isBench: !hasEverPlayed,
    isSubbedOut: hasEverPlayed && !isCurrentlyPlaying,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const c = useTheme();
  const router = useRouter();
  const { matchId, mode } = useLocalSearchParams<{
    matchId: string;
    mode: string;
  }>();
  const { activeClubId: clubId } = useAuthStore();

  const matchMode: MatchMode = mode === "EDIT" ? "EDIT" : "LIVE";
  const isLive = matchMode === "LIVE";

  const [step, setStep] = useState<Step>(isLive ? "callups" : "stats");

  // Data
  const [calledUpIds, setCalledUpIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stopwatch
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Close-match modal
  const [closeModal, setCloseModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  // Match events — substitutions during LIVE mode
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  // Substitution picker modal
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [playerToSubOut, setPlayerToSubOut] = useState<StatsEntry | null>(null);

  // ── Stopwatch effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [callupsRes, statsRes] = await Promise.all([
        apiFetch(`/api/coach/match/callups/${matchId}?clubId=${clubId}`),
        apiFetch(`/api/coach/match/${matchId}/stats?clubId=${clubId}`),
      ]);

      if (!callupsRes.ok || !statsRes.ok) {
        Alert.alert("Error", "No se pudo cargar la información del partido.");
        return;
      }

      const callupsData: CallupEntry[] = await callupsRes.json();
      const statsData: StatsEntry[] = await statsRes.json();

      const calledUp = new Set<number>(
        callupsData
          .filter((entry) => entry.status === "CALLED_UP")
          .map((entry) => entry.playerId),
      );

      setCalledUpIds(calledUp);
      setStats(statsData);
    } catch {
      Alert.alert("Error", "Error de red al cargar el partido.");
    } finally {
      setLoading(false);
    }
  }, [matchId, clubId]);

  // Reset all transient match state when navigating to a different match
  useEffect(() => {
    setMatchEvents([]);
    setSeconds(0);
    setIsRunning(false);
    setStep(isLive ? "callups" : "stats");
    setStats([]);
    setCalledUpIds(new Set());
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visibleStats = stats.filter((p) => calledUpIds.has(p.playerId));

  // ── Stat mutation ─────────────────────────────────────────────────────────
  const updateStat = (
    playerId: number,
    field: keyof StatsEntry,
    value: number | boolean | string,
  ) => {
    setStats((prev) =>
      prev.map((p) => (p.playerId === playerId ? { ...p, [field]: value } : p)),
    );
  };

  // ── Status helper (closes over matchEvents) ───────────────────────────────
  const getStatus = (playerId: number, wasStarter: boolean) =>
    getPlayerStatus(playerId, wasStarter, matchEvents);

  // ── Minute calculation ────────────────────────────────────────────────────
  const calculateMinutes = (playerId: number, wasStarter: boolean): number => {
    const currentMinute = Math.floor(seconds / 60);
    const events = matchEvents
      .filter((e) => e.playerId === playerId)
      .sort((a, b) => a.minute - b.minute);

    if (events.length === 0) return wasStarter ? currentMinute : 0;

    let total = 0;
    let entryMinute: number | null = wasStarter ? 0 : null;

    for (const event of events) {
      if (event.type === "SUB_IN") {
        entryMinute = event.minute;
      } else if (event.type === "SUB_OUT" && entryMinute !== null) {
        total += event.minute - entryMinute;
        entryMinute = null;
      }
    }

    if (entryMinute !== null) total += currentMinute - entryMinute;
    return total;
  };

  // ── Substitution handlers ─────────────────────────────────────────────────
  const handleOpenSubModal = (player: StatsEntry) => {
    setPlayerToSubOut(player);
    setSubModalVisible(true);
  };

  const handleConfirmSub = (benchPlayer: StatsEntry) => {
    if (!playerToSubOut) return;
    const currentMinute = Math.floor(seconds / 60);
    if (playerToSubOut.assignedPosition) {
      updateStat(benchPlayer.playerId, "assignedPosition", playerToSubOut.assignedPosition);
    }
    setMatchEvents((prev) => [
      ...prev,
      { playerId: playerToSubOut.playerId, type: "SUB_OUT", minute: currentMinute },
      { playerId: benchPlayer.playerId, type: "SUB_IN", minute: currentMinute },
    ]);
    setSubModalVisible(false);
    setPlayerToSubOut(null);
  };

  // ── Card handlers (LIVE only) ─────────────────────────────────────────────
  const handleRedCard = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "redCards", player.redCards + 1);
    setMatchEvents((prev) => [
      ...prev,
      { playerId: player.playerId, type: "RED_CARD", minute: currentMinute },
    ]);
  };

  const handleYellowCard = (player: StatsEntry) => {
    const newYellowCount = player.yellowCards + 1;
    updateStat(player.playerId, "yellowCards", newYellowCount);

    if (isLive && newYellowCount === 2) {
      handleRedCard(player);
      const currentMinute = Math.floor(seconds / 60);
      Alert.alert(
        "Doble Amarilla",
        `El jugador ha recibido la segunda amarilla y ha sido expulsado en el min ${currentMinute}.`,
      );
    }
  };

  // ── Save stats ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const entriesToSave = isLive
        ? visibleStats.map((p) => ({
            ...p,
            minutesPlayed: calculateMinutes(p.playerId, p.wasStarter),
          }))
        : visibleStats;

      const res = await apiFetch(
        `/api/coach/match/${matchId}/stats/bulk?clubId=${clubId}`,
        {
          method: "PUT",
          body: JSON.stringify({ entries: entriesToSave }),
        },
      );
      if (!res.ok) {
        Alert.alert("Error", `No se pudo guardar (HTTP ${res.status}).`);
        return;
      }
      Alert.alert("Guardado", "Estadísticas actualizadas correctamente.");
    } catch {
      Alert.alert("Error", "Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  };

  // ── Close match ───────────────────────────────────────────────────────────
  const handleClose = async () => {
    if (!goalsFor || !goalsAgainst) {
      Alert.alert("Atención", "Introduce el marcador final.");
      return;
    }
    try {
      const res = await apiFetch(
        `/api/coach/match/${matchId}/close?clubId=${clubId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            goalsFor: Number(goalsFor),
            goalsAgainst: Number(goalsAgainst),
          }),
        },
      );
      if (!res.ok) {
        Alert.alert("Error", `No se pudo cerrar el partido (HTTP ${res.status}).`);
        return;
      }
      setCloseModal(false);
      Alert.alert("Partido cerrado", "El resultado ha sido registrado.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Error de red al cerrar el partido.");
    }
  };

  // ── Reset match ───────────────────────────────────────────────────────────
  const applyReset = () => {
    setMatchEvents([]);
    setSeconds(0);
    setIsRunning(false);
    setStep("callups");
    setStats((prev) =>
      prev.map((p) => ({
        ...p,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
        wasStarter: false,
        assignedPosition: undefined,
      })),
    );
  };

  const handleResetMatch = () => {
    Alert.alert(
      "¿Estás seguro?",
      "Esto borrará los titulares, el cronómetro y todos los eventos registrados hasta ahora.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetear",
          style: "destructive",
          onPress: applyReset,
        },
      ],
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={[s.header, { backgroundColor: c.fondo }]}>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={{ fontSize: 24, color: c.boton }}>‹</Text>
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={[s.title, { color: c.texto }]}>
          {isLive ? "Partido en Vivo" : "Editar Estadísticas"}
        </Text>
        <View
          style={[
            s.modePill,
            { backgroundColor: isLive ? "#16a34a" : "#2563eb" },
          ]}
        >
          <Text style={s.modePillText}>
            {isLive ? "● EN VIVO" : "✏ EDICIÓN"}
          </Text>
        </View>
      </View>

      {isLive && step === "stats" ? (
        <TouchableOpacity
          style={[s.closeMatchBtn, { backgroundColor: "#ef4444" }]}
          onPress={() => setCloseModal(true)}
        >
          <Text style={s.closeMatchText}>Cerrar{"\n"}Partido</Text>
        </TouchableOpacity>
      ) : isLive ? (
        <TouchableOpacity
          style={[s.closeMatchBtn, { backgroundColor: "#6b7280" }]}
          onPress={handleResetMatch}
        >
          <Text style={s.closeMatchText}>🔄{"\n"}Reset</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 64 }} />
      )}
    </View>
  );

  const renderStepIndicator = () => {
    if (!isLive) return null;
    const atStats = step === "stats";
    return (
      <View style={s.stepRow}>
        <View style={[s.stepDot, { backgroundColor: "#16a34a" }]}>
          <Text style={s.stepDotText}>1</Text>
        </View>
        <Text
          style={[
            s.stepLbl,
            {
              color: !atStats ? c.texto : c.subtexto,
              fontWeight: !atStats ? "700" : "500",
            },
          ]}
        >
          Titulares
        </Text>
        <View
          style={[
            s.stepLine,
            { backgroundColor: atStats ? "#16a34a" : c.bordeInput },
          ]}
        />
        <View
          style={[
            s.stepDot,
            { backgroundColor: atStats ? "#16a34a" : c.bordeInput },
          ]}
        >
          <Text style={s.stepDotText}>2</Text>
        </View>
        <Text
          style={[
            s.stepLbl,
            {
              color: atStats ? c.texto : c.subtexto,
              fontWeight: atStats ? "700" : "500",
            },
          ]}
        >
          Estadísticas
        </Text>
      </View>
    );
  };

  // ── Step 1 — Tappable starter selection grouped by position ───────────────
  const renderCallupsStep = () => {
    const startersCount = visibleStats.filter((p) => p.wasStarter).length;
    const isMaxStarters = startersCount >= 11;
    const grouped = groupByPosition(visibleStats);

    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
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
            Titulares: {startersCount} / 11
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
              {players.map((item) => {
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
                    {/* Row: name + badge */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                      >
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

                    {/* Position selector — only visible for starters */}
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
              opacity: startersCount === 11 ? 1 : 0.5,
            },
          ]}
          onPress={() => {
            if (startersCount !== 11) {
              Alert.alert(
                "Atención",
                "Debes seleccionar exactamente 11 titulares para iniciar el partido.",
              );
              return;
            }
            setStep("stats");
          }}
        >
          <Text style={s.primaryBtnText}>Confirmar Titulares →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── Stopwatch widget ──────────────────────────────────────────────────────
  const renderStopwatch = () => (
    <View style={[s.stopwatch, { backgroundColor: c.input }]}>
      <Text style={[s.stopwatchTime, { color: c.texto }]}>
        {formatTime(seconds)}
      </Text>
      <View style={s.stopwatchBtns}>
        <TouchableOpacity
          style={[
            s.swBtn,
            { backgroundColor: isRunning ? "#f59e0b" : "#16a34a" },
          ]}
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
  );

  // ── Live card — full actions, shown only for players on the field ──────────
  const renderLiveCard = (item: StatsEntry) => (
    <View key={item.playerId} style={[s.statsCard, { backgroundColor: c.input }]}>
      <View style={s.playerHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.playerName, { color: c.texto }]}>
            {item.firstName} {item.lastName}
          </Text>
          {(item.assignedPosition ?? item.position) ? (
            <Text style={[s.positionTag, { color: c.subtexto }]}>
              {item.assignedPosition ?? item.position}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={s.quickActionsRow}>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#16a34a" }]}
          onPress={() => updateStat(item.playerId, "goals", item.goals + 1)}
        >
          <Text style={s.quickActionText}>⚽ {item.goals}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#3b82f6" }]}
          onPress={() => updateStat(item.playerId, "assists", item.assists + 1)}
        >
          <Text style={s.quickActionText}>🎯 {item.assists}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#f59e0b" }]}
          onPress={() => handleYellowCard(item)}
        >
          <Text style={s.quickActionText}>🟨 {item.yellowCards}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#ef4444" }]}
          onPress={() => handleRedCard(item)}
        >
          <Text style={s.quickActionText}>🟥 {item.redCards}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#6b7280" }]}
          onPress={() => handleOpenSubModal(item)}
        >
          <Text style={s.quickActionText}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Bench card — available but not yet playing ────────────────────────────
  const renderBenchCard = (item: StatsEntry) => (
    <View
      key={item.playerId}
      style={[s.benchCard, { backgroundColor: c.input }]}
    >
      <Text style={[s.playerName, { color: c.texto }]}>
        {item.firstName} {item.lastName}
      </Text>
      {(item.assignedPosition ?? item.position) ? (
        <Text style={[s.positionTag, { color: c.subtexto }]}>
          {item.assignedPosition ?? item.position}
        </Text>
      ) : null}
    </View>
  );

  // ── Subbed-out card — burned, cannot return ───────────────────────────────
  const renderSubbedOutCard = (item: StatsEntry) => (
    <View
      key={item.playerId}
      style={[s.benchCard, { backgroundColor: c.input, opacity: 0.45 }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.playerName, { color: c.subtexto }]}>
            {item.firstName} {item.lastName}
          </Text>
          {(item.assignedPosition ?? item.position) ? (
            <Text style={[s.positionTag, { color: c.subtexto }]}>
              {item.assignedPosition ?? item.position}
            </Text>
          ) : null}
        </View>
        <View style={s.subbedOutBadge}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#6b7280" }}>
            ↩ SALIÓ
          </Text>
        </View>
      </View>
    </View>
  );

  // ── Expelled card — red card issued, removed from field ──────────────────
  const renderExpelledCard = (item: StatsEntry) => (
    <View
      key={item.playerId}
      style={[
        s.benchCard,
        { backgroundColor: "#ef444410", borderWidth: 1, borderColor: "#ef444430" },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.playerName, { color: "#ef4444" }]}>
            {item.firstName} {item.lastName}
          </Text>
          {(item.assignedPosition ?? item.position) ? (
            <Text style={[s.positionTag, { color: "#ef4444", opacity: 0.7 }]}>
              {item.assignedPosition ?? item.position}
            </Text>
          ) : null}
        </View>
        <View style={[s.subbedOutBadge, { backgroundColor: "#ef444420" }]}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#ef4444" }}>
            🟥 EXPULSADO
          </Text>
        </View>
      </View>
    </View>
  );

  // ── Substitution picker modal ─────────────────────────────────────────────
  const renderSubModal = () => {
    const benchPlayers = visibleStats.filter(
      (p) => getStatus(p.playerId, p.wasStarter).isBench,
    );

    return (
      <Modal visible={subModalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalBox,
              { backgroundColor: c.fondo, borderColor: c.bordeInput },
            ]}
          >
            <Text style={[s.modalTitle, { color: c.texto }]}>
              Elegir sustituto
            </Text>
            {playerToSubOut && (
              <Text style={{ color: c.subtexto, marginBottom: 12, fontSize: 13 }}>
                Sustituyendo a:{" "}
                <Text style={{ fontWeight: "700", color: c.texto }}>
                  {playerToSubOut.firstName} {playerToSubOut.lastName}
                </Text>
              </Text>
            )}
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {benchPlayers.length === 0 ? (
                <Text
                  style={{
                    color: c.subtexto,
                    textAlign: "center",
                    paddingVertical: 24,
                  }}
                >
                  No hay jugadores disponibles en el banquillo.
                </Text>
              ) : (
                benchPlayers.map((player) => (
                  <TouchableOpacity
                    key={player.playerId}
                    style={[s.subPickerRow, { borderBottomColor: c.bordeInput }]}
                    onPress={() => handleConfirmSub(player)}
                  >
                    <Text style={[s.playerName, { color: c.texto, flex: 1 }]}>
                      {player.firstName} {player.lastName}
                    </Text>
                    {(player.assignedPosition ?? player.position) ? (
                      <View style={s.naturalPosBadge}>
                        <Text style={s.naturalPosText}>
                          {player.assignedPosition ?? player.position}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                setSubModalVisible(false);
                setPlayerToSubOut(null);
              }}
            >
              <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Step 2 — Stats (LIVE + EDIT) ──────────────────────────────────────────
  const renderStatsStep = () => {
    // ── LIVE mode: four sections — field / bench / substituted / expelled ─────
    if (isLive) {
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
        const { isCurrentlyPlaying, isBench, isSubbedOut } = getStatus(
          p.playerId,
          p.wasStarter,
        );
        if (isCurrentlyPlaying) onField.push(p);
        else if (isBench) bench.push(p);
        else if (isSubbedOut) substituted.push(p);
      }

      return (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {renderStopwatch()}

          <Text style={[s.sectionTitle, { color: c.texto }]}>
            🟢 En el campo ({onField.length})
          </Text>
          {onField.length === 0 ? (
            <Text
              style={{ color: c.subtexto, textAlign: "center", marginBottom: 8 }}
            >
              Sin jugadores en el campo
            </Text>
          ) : (
            onField.map(renderLiveCard)
          )}

          <Text style={[s.sectionTitle, { color: c.texto, marginTop: 16 }]}>
            🪑 Banquillo ({bench.length})
          </Text>
          {bench.length === 0 ? (
            <Text
              style={{ color: c.subtexto, textAlign: "center", marginBottom: 8 }}
            >
              Banquillo vacío
            </Text>
          ) : (
            bench.map(renderBenchCard)
          )}

          {substituted.length > 0 && (
            <>
              <Text
                style={[
                  s.sectionTitle,
                  { color: c.subtexto, marginTop: 16, fontSize: 13 },
                ]}
              >
                🔄 Sustituidos ({substituted.length})
              </Text>
              {substituted.map(renderSubbedOutCard)}
            </>
          )}

          {expelled.length > 0 && (
            <>
              <Text
                style={[
                  s.sectionTitle,
                  { color: "#ef4444", marginTop: 16, fontSize: 13 },
                ]}
              >
                🟥 Expulsados ({expelled.length})
              </Text>
              {expelled.map(renderExpelledCard)}
            </>
          )}

          <TouchableOpacity
            style={[
              s.primaryBtn,
              { backgroundColor: c.boton, opacity: saving ? 0.6 : 1, marginTop: 8 },
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.primaryBtnText}>
              {saving ? "Guardando..." : "💾 Guardar estadísticas"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ padding: 14, alignItems: "center", marginTop: 4 }}
            onPress={handleResetMatch}
          >
            <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 13 }}>
              🔄 Resetear Partido
            </Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // ── EDIT mode — manual +/- counters (unchanged) ───────────────────────────
    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {visibleStats.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 28 }}>📋</Text>
            <Text style={{ color: c.subtexto, marginTop: 8 }}>
              No hay jugadores convocados.
            </Text>
          </View>
        )}

        {visibleStats.map((item) => (
          <View
            key={item.playerId}
            style={[s.statsCard, { backgroundColor: c.input }]}
          >
            <View style={s.playerHeader}>
              <Text style={[s.playerName, { color: c.texto, flex: 1 }]}>
                {item.firstName} {item.lastName}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={{ fontSize: 12, color: c.subtexto }}>Titular</Text>
                <Switch
                  value={item.wasStarter}
                  onValueChange={(v) =>
                    updateStat(item.playerId, "wasStarter", v)
                  }
                  trackColor={{ false: c.bordeInput, true: "#16a34a" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={s.countersRow}>
              {STAT_FIELDS.map(({ label, field }) => (
                <View key={field} style={s.counter}>
                  <Text
                    style={{ fontSize: 10, color: c.subtexto, marginBottom: 4 }}
                  >
                    {label}
                  </Text>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <TouchableOpacity
                      style={[
                        s.counterBtn,
                        { borderColor: c.bordeInput, backgroundColor: c.fondo },
                      ]}
                      onPress={() =>
                        updateStat(
                          item.playerId,
                          field,
                          Math.max(0, (item[field] as number) - 1),
                        )
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
                      style={[
                        s.counterBtn,
                        { borderColor: c.bordeInput, backgroundColor: c.fondo },
                      ]}
                      onPress={() =>
                        updateStat(
                          item.playerId,
                          field,
                          (item[field] as number) + 1,
                        )
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
          style={[
            s.primaryBtn,
            { backgroundColor: c.boton, opacity: saving ? 0.6 : 1, marginTop: 8 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={s.primaryBtnText}>
            {saving ? "Guardando..." : "💾 Guardar estadísticas"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <View style={[s.container, { backgroundColor: c.fondo }]}>
        {renderHeader()}
        {renderStepIndicator()}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={c.boton}
            style={{ marginTop: 40 }}
          />
        ) : step === "callups" ? (
          renderCallupsStep()
        ) : (
          renderStatsStep()
        )}

        {/* Close match modal */}
        {isLive && (
          <Modal visible={closeModal} transparent animationType="slide">
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <View style={s.modalOverlay}>
                <View
                  style={[
                    s.modalBox,
                    { backgroundColor: c.fondo, borderColor: c.bordeInput },
                  ]}
                >
                  <Text style={[s.modalTitle, { color: c.texto }]}>
                    Cerrar partido
                  </Text>
                  <TextInput
                    style={[
                      s.input,
                      {
                        borderColor: c.bordeInput,
                        backgroundColor: c.input,
                        color: c.texto,
                      },
                    ]}
                    placeholder="Goles a favor"
                    placeholderTextColor={c.subtexto}
                    keyboardType="numeric"
                    value={goalsFor}
                    onChangeText={setGoalsFor}
                  />
                  <TextInput
                    style={[
                      s.input,
                      {
                        borderColor: c.bordeInput,
                        backgroundColor: c.input,
                        color: c.texto,
                      },
                    ]}
                    placeholder="Goles en contra"
                    placeholderTextColor={c.subtexto}
                    keyboardType="numeric"
                    value={goalsAgainst}
                    onChangeText={setGoalsAgainst}
                  />
                  <TouchableOpacity
                    style={[
                      s.primaryBtn,
                      { backgroundColor: "#ef4444", marginTop: 4 },
                    ]}
                    onPress={handleClose}
                  >
                    <Text style={s.primaryBtnText}>Confirmar resultado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.cancelBtn}
                    onPress={() => setCloseModal(false)}
                  >
                    <Text style={{ color: c.subtexto, fontWeight: "600" }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Substitution picker modal */}
        {isLive && renderSubModal()}
      </View>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "800" },
  modePill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
    alignSelf: "flex-start",
  },
  modePillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  closeMatchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  closeMatchText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },

  // Step indicator
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },
  stepLbl: { fontSize: 13 },

  // List container
  list: { padding: 16, paddingBottom: 50 },
  hint: { fontSize: 13, textAlign: "center", marginBottom: 14 },
  empty: { alignItems: "center", paddingVertical: 40 },

  // Counter box
  counterBox: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },

  // Position group header
  groupTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  // Natural position badge
  naturalPosBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  naturalPosText: { fontSize: 10, fontWeight: "700", color: "#6b7280" },

  // Starter/suplente badge pill
  starterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },

  // Position selector (inside starter card)
  positionSelector: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  posBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  posBtnText: { fontSize: 11, fontWeight: "700" },

  // Callup card (tappable, column layout)
  callupsCard: {
    flexDirection: "column",
    alignItems: "stretch",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  // Stats card (live actions)
  statsCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  playerName: { fontWeight: "700", fontSize: 15 },

  // Bench / subbed-out card
  benchCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  subbedOutBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Edit mode counters
  countersRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  counter: { alignItems: "center", minWidth: 58 },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Stopwatch
  stopwatch: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  stopwatchTime: { fontSize: 60, fontWeight: "800", letterSpacing: 4 },
  stopwatchBtns: { flexDirection: "row", gap: 12, marginTop: 14 },
  swBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10 },
  swBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Buttons
  primaryBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Modals (shared bottom-sheet style)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalBox: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 10 },
  cancelBtn: { padding: 14, alignItems: "center" },

  // Substitution picker rows
  subPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  // Live-mode section headers
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },

  // Live-mode player position tag
  positionTag: { fontSize: 12, marginTop: 2 },

  // Live-mode quick action buttons
  quickActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 50,
  },
  quickActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
