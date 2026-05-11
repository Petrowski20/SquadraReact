import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import { useLiveMatch } from "../context/LiveMatchContext";
import { s } from "../styles";

export default function LiveMatchModals() {
  const { isLive } = useLiveMatch();
  if (!isLive) return null;
  return (
    <>
      <CloseMatchModal />
      <SubPickerModal />
      <PitchPlayerModal />
    </>
  );
}

// ── Close-match modal ─────────────────────────────────────────────────────────

function CloseMatchModal() {
  const c = useTheme();
  const {
    closeModal,
    setCloseModal,
    goalsFor,
    setGoalsFor,
    goalsAgainst,
    setGoalsAgainst,
    handleClose,
    closing,
  } = useLiveMatch();

  return (
    <Modal visible={closeModal} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
            <Text style={[s.modalTitle, { color: c.texto }]}>Cerrar partido</Text>
            <TextInput
              style={[s.input, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto }]}
              placeholder="Goles a favor"
              placeholderTextColor={c.subtexto}
              keyboardType="numeric"
              value={goalsFor}
              onChangeText={setGoalsFor}
            />
            <TextInput
              style={[s.input, { borderColor: c.bordeInput, backgroundColor: c.input, color: c.texto }]}
              placeholder="Goles en contra"
              placeholderTextColor={c.subtexto}
              keyboardType="numeric"
              value={goalsAgainst}
              onChangeText={setGoalsAgainst}
            />
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: "#ef4444", marginTop: 4, opacity: closing ? 0.6 : 1 }]}
              onPress={handleClose}
              disabled={closing}
            >
              {closing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Confirmar resultado</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setCloseModal(false)}>
              <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Substitution picker modal ─────────────────────────────────────────────────

function SubPickerModal() {
  const c = useTheme();
  const {
    subModalVisible,
    playerToSubOut,
    visibleStats,
    getStatus,
    handleConfirmSub,
    closeSubModal,
  } = useLiveMatch();

  const benchPlayers = visibleStats.filter(
    (p) => getStatus(p.playerId, p.wasStarter).isBench,
  );

  return (
    <Modal visible={subModalVisible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
          <Text style={[s.modalTitle, { color: c.texto }]}>Elegir sustituto</Text>
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
              <Text style={{ color: c.subtexto, textAlign: "center", paddingVertical: 24 }}>
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
          <TouchableOpacity style={s.cancelBtn} onPress={closeSubModal}>
            <Text style={{ color: c.subtexto, fontWeight: "600" }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Pitch player action modal ─────────────────────────────────────────────────

function PitchPlayerModal() {
  const c = useTheme();
  const {
    pitchPlayer,
    setPitchPlayer,
    handleGoal,
    handleAssist,
    handleYellowCard,
    handleRedCard,
    handleOpenSubModal,
  } = useLiveMatch();

  if (!pitchPlayer) return null;

  return (
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
              { label: "⚽ Gol",         bg: "#16a34a", onPress: () => { handleGoal(pitchPlayer);        setPitchPlayer(null); } },
              { label: "🎯 Asistencia",  bg: "#3b82f6", onPress: () => { handleAssist(pitchPlayer);      setPitchPlayer(null); } },
              { label: "🟨 Amarilla",    bg: "#f59e0b", onPress: () => { handleYellowCard(pitchPlayer);  setPitchPlayer(null); } },
              { label: "🟥 Roja",        bg: "#ef4444", onPress: () => { handleRedCard(pitchPlayer);     setPitchPlayer(null); } },
              { label: "🔄 Cambio",      bg: "#6b7280", onPress: () => { setPitchPlayer(null);           handleOpenSubModal(pitchPlayer); } },
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
  );
}
