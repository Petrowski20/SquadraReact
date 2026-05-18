import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

type TeamGender = "MALE" | "FEMALE" | "MIXED";

interface Team { id: number; category: string; gender: TeamGender; suffix: string; seasonLabel: string; }

const GENDER_OPTIONS: { value: TeamGender; label: string }[] = [
  { value: "MALE", label: "♂ Masc." }, { value: "FEMALE", label: "♀ Fem." }, { value: "MIXED", label: "⚥ Mixto" },
];
const CATEGORY_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "U8",     labelKey: "categories.prebenjamin" },
  { value: "U10",    labelKey: "categories.benjamin"    },
  { value: "U12",    labelKey: "categories.alevin"      },
  { value: "U14",    labelKey: "categories.infantil"    },
  { value: "U16",    labelKey: "categories.cadete"      },
  { value: "U19",    labelKey: "categories.juvenil"     },
  { value: "SENIOR", labelKey: "categories.senior"      },
];

export default function TabEquipos() {
  const c = useTheme();
  const { t } = useTranslation();
  const { activeClubId: clubId, activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  const [teams, setTeams] = useState<Team[]>([]);
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState<Partial<{ category: string; gender: TeamGender; suffix: string }>>({ gender: "MALE" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteErrorModal, setDeleteErrorModal] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/president/club/${clubId}/teams`);
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch {}
  }, [clubId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleCreateTeam = async () => {
    if (!teamForm.category || !teamForm.gender || !teamForm.suffix?.trim()) {
      setCreateError("Elige categoría, género y escribe un sufijo.");
      return;
    }
    setCreateError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/president/teams?clubId=${clubId}&seasonLabel=${seasonLabel}`, {
        method: "POST",
        body: JSON.stringify({ category: teamForm.category, gender: teamForm.gender, suffix: teamForm.suffix.trim() }),
      });
      if (!res.ok) {
        let msg = "No se pudo crear el equipo.";
        try { const body = await res.json(); msg = body.message || body.error || JSON.stringify(body); } catch {}
        console.error("[TabEquipos] POST /teams status:", res.status, "msg:", msg);
        setCreateError(msg);
        return;
      }
      await fetchTeams();
      setCreateTeamModal(false);
      setTeamForm({ gender: "MALE" });
      setCreateError(null);
    } catch {
      setCreateError("Error de conexión. Comprueba tu red.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (deleteConfirmId === null) return;
    try {
      const res = await apiFetch(`/api/president/teams/${deleteConfirmId}?clubId=${clubId}`, { method: "DELETE" });
      if (res.ok) {
        setTeams((prev) => prev.filter((team) => team.id !== deleteConfirmId));
      } else {
        setDeleteErrorModal(true);
      }
    } catch {
      Alert.alert("Error de red", "No se pudo conectar con el servidor.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton }]} onPress={() => { setCreateTeamModal(true); setCreateError(null); }}>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{"+ Nuevo Equipo"}</Text>
      </TouchableOpacity>

      {teams.length === 0 && (
        <View style={[styles.emptyBox, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={{ color: c.subtexto, textAlign: "center" }}>{"Aún no hay equipos en el club"}</Text>
        </View>
      )}

      {teams.map((team) => {
        const catOption = CATEGORY_OPTIONS.find(c => c.value === team.category);
        const catLabel = catOption ? t(catOption.labelKey) : team.category;
        return (
          <View key={team.id} style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput, flexDirection: "row", alignItems: "center" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.texto }]}>{`${catLabel} · ${team.gender === "MALE" ? t('myClub.gender_male') : team.gender === "FEMALE" ? t('myClub.gender_female') : t('myClub.gender_mixed')} · ${team.suffix}`}</Text>
              <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 4 }}>{`${t('calendar.season')} ${team.seasonLabel}`}</Text>
            </View>
            <TouchableOpacity onPress={() => setDeleteConfirmId(team.id)}>
              <Text style={{ color: "#DC2626", fontWeight: "bold", paddingHorizontal: 8 }}>{t('presidentManagement.deleteTeam')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Modal confirmación borrar */}
      <Modal visible={deleteConfirmId !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: c.fondo }]}>
            <Text style={[styles.modalTitle, { color: c.texto, textAlign: "center" }]}>{"Eliminar equipo"}</Text>
            <Text style={{ color: c.subtexto, textAlign: "center", marginBottom: 24 }}>{"¿Seguro que quieres eliminar este equipo?"}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => setDeleteConfirmId(null)}>
                <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnMain, { backgroundColor: "#DC2626", flex: 1 }]} onPress={handleDeleteTeam}>
                <Text style={{ color: "#fff", fontWeight: "bold" }}>{"Eliminar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal error jugadores activos */}
      <Modal visible={deleteErrorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmBox, { backgroundColor: c.fondo }]}>
            <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>{"⚠️"}</Text>
            <Text style={[styles.modalTitle, { color: c.texto, textAlign: "center" }]}>{"No se puede eliminar"}</Text>
            <Text style={{ color: c.subtexto, textAlign: "center", marginBottom: 24 }}>{"Este equipo tiene jugadores activos. Elimina o mueve los jugadores antes de borrar el equipo."}</Text>
            <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton }]} onPress={() => setDeleteErrorModal(false)}>
              <Text style={{ color: "#fff", fontWeight: "bold" }}>{"Entendido"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={createTeamModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalBox, { backgroundColor: c.fondo }]}>
              <Text style={[styles.modalTitle, { color: c.texto }]}>{"Nuevo Equipo"}</Text>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Categoría"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity key={cat.value} onPress={() => setTeamForm((f) => ({ ...f, category: cat.value }))} style={[styles.chip, teamForm.category === cat.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                    <Text style={{ color: teamForm.category === cat.value ? "#fff" : c.subtexto, fontSize: 13, fontWeight: "600" }}>{t(cat.labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Género"}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
                {GENDER_OPTIONS.map((g) => (
                  <TouchableOpacity key={g.value} onPress={() => setTeamForm((f) => ({ ...f, gender: g.value }))} style={[styles.chip, teamForm.gender === g.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                    <Text style={{ color: teamForm.gender === g.value ? "#fff" : c.subtexto, fontSize: 13, fontWeight: "600" }}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Sufijo (Ej: A, B, Norte...)"}</Text>
              <TextInput style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} placeholder="A" placeholderTextColor={c.subtexto} onChangeText={(v) => setTeamForm((f) => ({ ...f, suffix: v }))} value={teamForm.suffix ?? ""} />

              {createError && (
                <Text style={{ color: "#DC2626", fontSize: 13, textAlign: "center", marginBottom: 8 }}>{createError}</Text>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => { setCreateTeamModal(false); setTeamForm({ gender: "MALE" }); setCreateError(null); }}>
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={submitting} style={[styles.btnMain, { backgroundColor: submitting ? c.subtexto : c.boton, flex: 1 }]} onPress={handleCreateTeam}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>{submitting ? "Creando..." : "Crear Equipo"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "bold" },
  btnMain: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, minHeight: 50 },
  inputLabel: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 30, marginBottom: 12, alignItems: "center" },
  confirmBox: { borderRadius: 20, padding: 24, marginHorizontal: 32, width: "80%" },
});