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

// Formats raw seconds → "MM:SS"
const formatTime = (total: number) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

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

  // In EDIT mode we skip the callups step entirely
  const [step, setStep] = useState<Step>(isLive ? "callups" : "stats");

  // Data
  const [calledUpIds, setCalledUpIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<StatsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stopwatch — only meaningful in LIVE mode
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Close-match modal — only shown in LIVE mode
  const [closeModal, setCloseModal] = useState(false);
  const [goalsFor, setGoalsFor] = useState("");
  const [goalsAgainst, setGoalsAgainst] = useState("");

  // ── Stopwatch effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  // Fetch callups (to get CALLED_UP set) and stats in parallel.
  // The /stats endpoint returns ALL active players when no stats exist yet,
  // so we cross-reference with the callups to filter correctly.
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
          .filter((c) => c.status === "CALLED_UP")
          .map((c) => c.playerId),
      );

      setCalledUpIds(calledUp);
      setStats(statsData);
    } catch {
      Alert.alert("Error", "Error de red al cargar el partido.");
    } finally {
      setLoading(false);
    }
  }, [matchId, clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only CALLED_UP players are shown anywhere in this screen
  const visibleStats = stats.filter((s) => calledUpIds.has(s.playerId));

  // ── Stat mutation ─────────────────────────────────────────────────────────
  const updateStat = (
    playerId: number,
    field: keyof StatsEntry,
    value: number | boolean | string,
  ) => {
    setStats((prev) =>
      prev.map((s) => (s.playerId === playerId ? { ...s, [field]: value } : s)),
    );
  };

  // ── Save stats ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(
        `/api/coach/match/${matchId}/stats/bulk?clubId=${clubId}`,
        {
          method: "PUT",
          body: JSON.stringify({ entries: visibleStats }),
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
        Alert.alert(
          "Error",
          `No se pudo cerrar el partido (HTTP ${res.status}).`,
        );
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

      {/* "Cerrar Partido" only makes sense in live stats step */}
      {isLive && step === "stats" ? (
        <TouchableOpacity
          style={[s.closeMatchBtn, { backgroundColor: "#ef4444" }]}
          onPress={() => setCloseModal(true)}
        >
          <Text style={s.closeMatchText}>Cerrar{"\n"}Partido</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 64 }} />
      )}
    </View>
  );

  // Progress indicator — only in LIVE mode
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

  // Step 1 — Starters selection (LIVE mode only)
  const renderCallupsStep = () => {
    // Calculamos cuántos titulares hay seleccionados
    const startersCount = visibleStats.filter((s) => s.wasStarter).length;
    const isMaxStarters = startersCount >= 11;

    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.hint, { color: c.subtexto }]}>
          Marca quién es titular hoy. Solo aparecen los jugadores convocados.
        </Text>

        {/* CONTADOR DE TITULARES DESTACADO */}
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
            Titulares Seleccionados: {startersCount} / 11
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

        {visibleStats.map((item) => (
          <View
            key={item.playerId}
            style={[s.callupsCard, { backgroundColor: c.input }]}
          >
            {/* Fila superior: Nombre + Switch */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <Text style={[s.playerName, { color: c.texto }]}>
                  {item.firstName} {item.lastName}
                </Text>
                {/* Píldora de Posición Natural */}
                <View style={s.naturalPosBadge}>
                  <Text style={s.naturalPosText}>{item.position || "N/A"}</Text>
                </View>
              </View>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 13, color: c.subtexto }}>Titular</Text>
                <Switch
                  value={item.wasStarter}
                  onValueChange={(v) =>
                    updateStat(item.playerId, "wasStarter", v)
                  }
                  disabled={!item.wasStarter && isMaxStarters} // BLOQUEA SI YA HAY 11
                  trackColor={{ false: c.bordeInput, true: "#16a34a" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Fila inferior: Selector de Posición (Solo si es titular) */}
            {item.wasStarter && (
              <View style={s.positionSelector}>
                {["POR", "DEF", "MED", "DEL"].map((pos) => {
                  const isSelected = item.assignedPosition === pos;
                  return (
                    <TouchableOpacity
                      key={pos}
                      style={[
                        s.posBtn,
                        isSelected
                          ? {
                              backgroundColor: "#3b82f6",
                              borderColor: "#3b82f6",
                            }
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
          </View>
        ))}

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

  // Stopwatch widget — only rendered inside LIVE stats step
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
            {isRunning
              ? "⏸ Pausar"
              : seconds === 0
                ? "▶ Iniciar"
                : "▶ Reanudar"}
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

  // Step 2 — Stats counters (both modes)
  const renderStatsStep = () => (
    <ScrollView
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
    >
      {/* Stopwatch is exclusive to LIVE mode */}
      {isLive && renderStopwatch()}

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
          {/* Player name + Titular switch */}
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

          {/* Stat counters */}
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

        {/* Close match modal — only relevant in LIVE mode */}
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

  // ─── NUEVOS ESTILOS PARA POSICIONES Y CONTADOR ───
  counterBox: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  naturalPosBadge: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  naturalPosText: { fontSize: 10, fontWeight: "700", color: "#6b7280" },
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

  // Callups step card — modificado a columna para que quepan los botones de posición
  callupsCard: {
    flexDirection: "column",
    alignItems: "stretch",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  // Stats step card — vertical
  statsCard: { borderRadius: 12, padding: 14, marginBottom: 10 },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  playerName: { fontWeight: "700", fontSize: 15 },

  // Counters
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

  // Close match modal
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
});
