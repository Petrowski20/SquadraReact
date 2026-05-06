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
import DefaultAvatar from "../../../components/DefaultAvatar";
import ScreenContainer from "../../../components/ScreenContainer";
import { apiFetch } from "../../../lib/api";
import { useAuthStore } from "../../../lib/store";
import { useTheme } from "../../../lib/useTheme";

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchMode = "LIVE" | "EDIT";
type Step = "callups" | "stats";
type LiveTab = "field" | "timeline";

interface MatchEvent {
  id: string;
  playerId: number;
  type: "SUB_IN" | "SUB_OUT" | "RED_CARD" | "YELLOW_CARD" | "GOAL" | "ASSIST";
  minute: number;
}

// ─── Formations ──────────────────────────────────────────────────────────────

const FORMATIONS = [
  { id: "4-4-2", label: "4-4-2", por: 1, def: 4, med: 4, del: 2 },
  { id: "4-3-3", label: "4-3-3", por: 1, def: 4, med: 3, del: 3 },
  { id: "3-5-2", label: "3-5-2", por: 1, def: 3, med: 5, del: 2 },
  { id: "3-2-1", label: "3-2-1 ⑦", por: 1, def: 3, med: 2, del: 1 },
] as const;

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
  const subEvents = events
    .filter((e) => e.playerId === playerId && (e.type === "SUB_IN" || e.type === "SUB_OUT"))
    .sort((a, b) => a.minute - b.minute);
  if (subEvents.length === 0) {
    return { isCurrentlyPlaying: wasStarter, isBench: !wasStarter, isSubbedOut: false };
  }
  const lastSub = subEvents[subEvents.length - 1];
  const isCurrentlyPlaying = lastSub.type === "SUB_IN";
  const hasEverPlayed = wasStarter || subEvents.some((e) => e.type === "SUB_IN");
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
  const [closing, setClosing] = useState(false);

  // Stopwatch
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Close-match modal
  const [closeModal, setCloseModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  // Match events — all live events tracked for timeline/undo
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  // Substitution picker modal
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [playerToSubOut, setPlayerToSubOut] = useState<StatsEntry | null>(null);

  // Formation selection (LIVE callups step)
  const [selectedFormation, setSelectedFormation] = useState<string | null>(null);

  // Live tab: pitch view vs timeline
  const [liveTab, setLiveTab] = useState<LiveTab>("field");

  // Pitch action modal
  const [pitchPlayer, setPitchPlayer] = useState<StatsEntry | null>(null);

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
      .filter((e) => e.playerId === playerId && (e.type === "SUB_IN" || e.type === "SUB_OUT"))
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
    const ts = Date.now();
    setMatchEvents((prev) => [
      ...prev,
      { id: `${ts}-out`, playerId: playerToSubOut.playerId, type: "SUB_OUT", minute: currentMinute },
      { id: `${ts}-in`, playerId: benchPlayer.playerId, type: "SUB_IN", minute: currentMinute },
    ]);
    setSubModalVisible(false);
    setPlayerToSubOut(null);
    setPitchPlayer(null);
  };

  // ── Card handlers (LIVE only) ─────────────────────────────────────────────
  const handleRedCard = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "redCards", player.redCards + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-rc`, playerId: player.playerId, type: "RED_CARD", minute: currentMinute },
    ]);
  };

  const handleYellowCard = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    const newYellowCount = player.yellowCards + 1;
    updateStat(player.playerId, "yellowCards", newYellowCount);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-yc`, playerId: player.playerId, type: "YELLOW_CARD", minute: currentMinute },
    ]);
    if (isLive && newYellowCount === 2) {
      handleRedCard(player);
      Alert.alert(
        "Doble Amarilla",
        `El jugador ha recibido la segunda amarilla y ha sido expulsado en el min ${currentMinute}.`,
      );
    }
  };

  const handleGoal = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "goals", player.goals + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-goal`, playerId: player.playerId, type: "GOAL", minute: currentMinute },
    ]);
  };

  const handleAssist = (player: StatsEntry) => {
    const currentMinute = Math.floor(seconds / 60);
    updateStat(player.playerId, "assists", player.assists + 1);
    setMatchEvents((prev) => [
      ...prev,
      { id: `${Date.now()}-assist`, playerId: player.playerId, type: "ASSIST", minute: currentMinute },
    ]);
  };

  const handleUndoEvent = (eventId: string) => {
    const event = matchEvents.find((e) => e.id === eventId);
    if (!event) return;
    // Use functional updater so we always operate on the latest stats snapshot
    setStats((prev) =>
      prev.map((p) => {
        if (p.playerId !== event.playerId) return p;
        switch (event.type) {
          case "GOAL":        return { ...p, goals:       Math.max(0, p.goals - 1) };
          case "ASSIST":      return { ...p, assists:     Math.max(0, p.assists - 1) };
          case "YELLOW_CARD": return { ...p, yellowCards: Math.max(0, p.yellowCards - 1) };
          case "RED_CARD":    return { ...p, redCards:    Math.max(0, p.redCards - 1) };
          default:            return p; // SUB_IN/SUB_OUT: getStatus recalculates from events
        }
      }),
    );
    setMatchEvents((prev) => [...prev.filter((e) => e.id !== eventId)]);
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
    if (closing) return;
    setClosing(true);
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
        const msg = await res.text().catch(() => "");
        Alert.alert("Error", msg || `No se pudo cerrar el partido (HTTP ${res.status}).`);
        return;
      }
      setCloseModal(false);
      router.replace("/(club)/calendario");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Error de red al cerrar el partido.");
    } finally {
      setClosing(false);
    }
  };

  // ── Reset match ───────────────────────────────────────────────────────────
  const applyReset = () => {
    setMatchEvents([]);
    setSeconds(0);
    setIsRunning(false);
    setStep("callups");
    setSelectedFormation(null);
    setLiveTab("field");
    setPitchPlayer(null);
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
      <TouchableOpacity onPress={() => router.replace("/(club)/calendario")} style={s.backBtn}>
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

  // ── Step 1 — Formation picker + tappable starter selection ──────────────
  const renderCallupsStep = () => {
    const startersCount = visibleStats.filter((p) => p.wasStarter).length;
    const formation = FORMATIONS.find((f) => f.id === selectedFormation);
    const maxStarters = formation ? formation.por + formation.def + formation.med + formation.del : 11;
    const isMaxStarters = startersCount >= maxStarters;
    const grouped = groupByPosition(visibleStats);

    // Count starters per position
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
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
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

  // ── Live card — full actions, shown in list view ──────────────────────────
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
          onPress={() => handleGoal(item)}
        >
          <Text style={s.quickActionText}>⚽ {item.goals}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickActionBtn, { backgroundColor: "#3b82f6" }]}
          onPress={() => handleAssist(item)}
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

  // ── FIFA Pitch view ───────────────────────────────────────────────────────
  const renderPitchView = (onField: StatsEntry[], bench: StatsEntry[], substituted: StatsEntry[], expelled: StatsEntry[]) => {
    const por = onField.filter((p) => p.assignedPosition === "POR");
    const def = onField.filter((p) => p.assignedPosition === "DEF");
    const med = onField.filter((p) => p.assignedPosition === "MED");
    const del = onField.filter((p) => p.assignedPosition === "DEL");
    const unassigned = onField.filter((p) => !p.assignedPosition);

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
        {renderStopwatch()}
        <View style={s.pitch}>
          {/* Opponent half */}
          <View style={s.pitchHalfLabel}><Text style={s.pitchHalfText}>RIVAL</Text></View>
          <View style={s.pitchMidLine} />
          {/* Our half: FWD → MID → DEF → GK */}
          <View style={s.pitchRow}>{del.map(renderPitchPlayerCard)}</View>
          {med.length > 0 && <View style={s.pitchRow}>{med.map(renderPitchPlayerCard)}</View>}
          {def.length > 0 && <View style={s.pitchRow}>{def.map(renderPitchPlayerCard)}</View>}
          {unassigned.length > 0 && <View style={s.pitchRow}>{unassigned.map(renderPitchPlayerCard)}</View>}
          <View style={[s.pitchRow, { justifyContent: "center" }]}>{por.map(renderPitchPlayerCard)}</View>
          <View style={s.pitchHalfLabel}><Text style={s.pitchHalfText}>NUESTRA PORTERÍA</Text></View>
        </View>

        {/* Bench / Substituted / Expelled */}
        {bench.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Text style={[s.sectionTitle, { color: c.texto, fontSize: 13 }]}>🪑 Banquillo — toca para sustituir</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bench.map((p) => (
                <TouchableOpacity key={p.playerId} style={[s.benchChip, { backgroundColor: c.input }]} onPress={() => handleOpenSubModal(p)}>
                  <Text style={{ fontSize: 11, color: c.texto, fontWeight: "600" }} numberOfLines={1}>{p.firstName[0]}. {p.lastName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {substituted.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={[s.sectionTitle, { color: c.subtexto, fontSize: 12 }]}>🔄 Sustituidos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {substituted.map((p) => (
                <View key={p.playerId} style={[s.benchChip, { backgroundColor: c.input, opacity: 0.5 }]}>
                  <Text style={{ fontSize: 11, color: c.subtexto, fontWeight: "600" }} numberOfLines={1}>{p.firstName[0]}. {p.lastName}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        {expelled.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={[s.sectionTitle, { color: "#ef4444", fontSize: 12 }]}>🟥 Expulsados</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {expelled.map((p) => (
                <View key={p.playerId} style={[s.benchChip, { backgroundColor: "#ef444415" }]}>
                  <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600" }} numberOfLines={1}>{p.firstName[0]}. {p.lastName}</Text>
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
  };

  // ── Timeline view ─────────────────────────────────────────────────────────
  const renderTimeline = () => {
    const eventLabel: Record<string, string> = {
      GOAL: "⚽ Gol",
      ASSIST: "🎯 Asistencia",
      YELLOW_CARD: "🟨 Amarilla",
      RED_CARD: "🟥 Roja",
      SUB_IN: "🔄 Entra",
      SUB_OUT: "🔄 Sale",
    };

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
                    {eventLabel[event.type] ?? event.type}
                  </Text>
                  {player && (
                    <Text style={{ fontSize: 12, color: c.subtexto }}>
                      {player.firstName} {player.lastName}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert("Deshacer", "¿Quitar este evento?", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Deshacer", style: "destructive", onPress: () => handleUndoEvent(event.id) },
                  ])}
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
  };

  // ── Step 2 — Stats (LIVE + EDIT) ──────────────────────────────────────────
  const renderStatsStep = () => {
    // ── LIVE mode: tab bar + pitch or timeline ────────────────────────────────
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
        <View style={{ flex: 1 }}>
          {/* Back to lineup */}
          <TouchableOpacity
            style={[s.backToLineupBtn, { borderBottomColor: c.bordeInput }]}
            onPress={() => setStep("callups")}
          >
            <Text style={{ color: c.boton, fontSize: 12, fontWeight: "600" }}>⬅ Editar Alineación</Text>
          </TouchableOpacity>
          {/* Tab bar */}
          <View style={[s.liveTabBar, { borderBottomColor: c.bordeInput }]}>
            {([
              { id: "field" as LiveTab, label: "⚽ Campo" },
              { id: "timeline" as LiveTab, label: `📋 Eventos (${matchEvents.length})` },
            ]).map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[s.liveTabBtn, liveTab === id && { borderBottomColor: c.boton, borderBottomWidth: 2 }]}
                onPress={() => setLiveTab(id)}
              >
                <Text style={{ color: liveTab === id ? c.boton : c.subtexto, fontWeight: liveTab === id ? "700" : "600", fontSize: 13 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {liveTab === "field"
            ? renderPitchView(onField, bench, substituted, expelled)
            : renderTimeline()
          }
        </View>
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
                      { backgroundColor: "#ef4444", marginTop: 4, opacity: closing ? 0.6 : 1 },
                    ]}
                    onPress={handleClose}
                    disabled={closing}
                  >
                    {closing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.primaryBtnText}>Confirmar resultado</Text>
                    }
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

        {/* Pitch player action modal */}
        {isLive && pitchPlayer && (
          <Modal visible={!!pitchPlayer} transparent animationType="slide">
            <View style={s.modalOverlay}>
              <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
                <Text style={[s.modalTitle, { color: c.texto }]}>
                  {pitchPlayer.firstName} {pitchPlayer.lastName}
                </Text>
                <Text style={{ color: c.subtexto, marginBottom: 14, fontSize: 13 }}>
                  {pitchPlayer.assignedPosition ?? pitchPlayer.position ?? "Sin posición"}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "⚽ Gol", bg: "#16a34a", onPress: () => { handleGoal(pitchPlayer); setPitchPlayer(null); } },
                    { label: "🎯 Asistencia", bg: "#3b82f6", onPress: () => { handleAssist(pitchPlayer); setPitchPlayer(null); } },
                    { label: "🟨 Amarilla", bg: "#f59e0b", onPress: () => { handleYellowCard(pitchPlayer); setPitchPlayer(null); } },
                    { label: "🟥 Roja", bg: "#ef4444", onPress: () => { handleRedCard(pitchPlayer); setPitchPlayer(null); } },
                    { label: "🔄 Cambio", bg: "#6b7280", onPress: () => { setPitchPlayer(null); handleOpenSubModal(pitchPlayer); } },
                  ].map(({ label, bg, onPress }) => (
                    <TouchableOpacity
                      key={label}
                      style={[s.quickActionBtn, { backgroundColor: bg, flexBasis: "47%" }]}
                      onPress={onPress}
                    >
                      <Text style={s.quickActionText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setPitchPlayer(null)}>
                  <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, maxWidth: 1000, width: "100%", alignSelf: "center" },

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

  // Formation picker
  formationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  formationRequirements: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },

  // Back-to-lineup banner (LIVE stats step)
  backToLineupBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },

  // Live tab bar
  liveTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  liveTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  // FIFA Pitch
  pitch: {
    backgroundColor: "#166534",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 12,
  },
  pitchRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 6,
  },
  pitchMidLine: {
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginHorizontal: 8,
  },
  pitchHalfLabel: {
    alignItems: "center",
  },
  pitchHalfText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pitchPlayerCard: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 70,
    maxWidth: 90,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pitchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  pitchPlayerName: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  pitchPlayerStats: {
    flexDirection: "row",
    gap: 2,
    marginTop: 3,
  },
  pitchStatBadge: {
    fontSize: 9,
  },

  // Bench horizontal chip
  benchChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },

  // Timeline
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  timelineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 42,
    alignItems: "center",
  },
  timelineMin: { fontSize: 13, fontWeight: "800" },
});
