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
  { value: "Prebenjamín",  labelKey: "categories.prebenjamin" },
  { value: "Benjamín",     labelKey: "categories.benjamin"    },
  { value: "Alevín",       labelKey: "categories.alevin"      },
  { value: "Infantil",     labelKey: "categories.infantil"    },
  { value: "Cadete",       labelKey: "categories.cadete"      },
  { value: "Juvenil",      labelKey: "categories.juvenil"     },
  { value: "Senior",       labelKey: "categories.senior"      },
];

export default function TabEquipos() {
  const c = useTheme();
  const { t } = useTranslation();
  const { activeClubId: clubId, activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  const [teams, setTeams] = useState<Team[]>([]);
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState<Partial<{ category: string; gender: TeamGender; suffix: string }>>({ gender: "MALE" });

  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/president/club/${clubId}/teams`);
      setTeams(await res.json());
    } catch {}
  }, [clubId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleCreateTeam = async () => {
    if (!teamForm.category || !teamForm.gender || !teamForm.suffix?.trim()) return Alert.alert("Atención", "Elige categoría, género y escribe un sufijo.");
    try {
      const res = await apiFetch(`/api/president/teams?clubId=${clubId}&seasonLabel=${seasonLabel}`, {
        method: "POST",
        body: JSON.stringify({ category: teamForm.category, gender: teamForm.gender, suffix: teamForm.suffix.trim() }),
      });
      const data: Team = await res.json();
      setTeams((prev) => [...prev, data]);
      setCreateTeamModal(false);
      setTeamForm({ gender: "MALE" });
    } catch { Alert.alert("Error", "No se pudo crear el equipo."); }
  };

  const handleDeleteTeam = (teamId: number) => {
    Alert.alert("Eliminar equipo", "¿Seguro que quieres eliminar este equipo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/president/teams/${teamId}?clubId=${clubId}`, { method: "DELETE" });
            if (res.ok) {
              setTeams((prev) => prev.filter((t) => t.id !== teamId));
            } else {
              Alert.alert("No se puede eliminar", "No puedes borrar un equipo que tiene jugadores o eventos asignados.");
            }
          } catch {
            Alert.alert("Error de red", "No se pudo conectar con el servidor.");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton }]} onPress={() => setCreateTeamModal(true)}>
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
            <TouchableOpacity onPress={() => handleDeleteTeam(team.id)}>
              <Text style={{ color: "#DC2626", fontWeight: "bold", paddingHorizontal: 8 }}>{t('presidentManagement.deleteTeam')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

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

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => { setCreateTeamModal(false); setTeamForm({ gender: "MALE" }); }}>
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton, flex: 1 }]} onPress={handleCreateTeam}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>{"Crear Equipo"}</Text>
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
});