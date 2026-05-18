import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, ActivityIndicator, FlatList, Switch, TextInput } from "react-native";
import { apiFetch } from "../../lib/api";
import { parseApiError } from "../../lib/helper";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

// Tipos
type AssignableRole = "PLAYER" | "COACH" | "RELATIVE";
type PlayerPosition = "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
type StaffRoleType = "HEAD_COACH" | "ASSISTANT" | "FITNESS_COACH" | "PHYSIOTHERAPIST" | "DELEGATE" | "OTHER";
type KinshipType = "FATHER" | "MOTHER" | "LEGAL_GUARDIAN" | "OTHER";

interface JoinRequest {
  id: number; userId: string; userFullName: string; userEmail: string;
  requestedRole: string; status: string; message: string | null; requestedAt: string;
  metadata?: Record<string, any>;
}
interface Team { id: number; category: string; gender: string; suffix: string; seasonLabel: string; }
interface TeamPlayer { id: number; firstName: string; lastName?: string; }

// Constantes
const STAFF_ROLES: { value: StaffRoleType; label: string }[] = [
  { value: "HEAD_COACH", label: "1er Entrenador" }, { value: "ASSISTANT", label: "2º Entrenador" },
  { value: "FITNESS_COACH", label: "Prep. Físico" }, { value: "PHYSIOTHERAPIST", label: "Fisioterapeuta" },
  { value: "DELEGATE", label: "Delegado" }, { value: "OTHER", label: "Otro" },
];
const KINSHIP_TYPES: { value: KinshipType; label: string }[] = [
  { value: "FATHER", label: "Padre" }, { value: "MOTHER", label: "Madre" },
  { value: "LEGAL_GUARDIAN", label: "Tutor Legal" }, { value: "OTHER", label: "Otro" },
];
const PLAYER_POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: "GOALKEEPER", label: "Portero/a" }, { value: "DEFENDER", label: "Defensa" },
  { value: "MIDFIELDER", label: "Centrocampista" }, { value: "FORWARD", label: "Delantero/a" },
];
const CATEGORY_LABEL: Record<string, string> = {
  U8: "Prebenjamín", U10: "Benjamín", U12: "Alevín",
  U14: "Infantil", U16: "Cadete", U19: "Juvenil", SENIOR: "Senior",
};
const ASSIGNABLE_ROLES: { value: AssignableRole; label: string }[] = [
  { value: "PLAYER", label: "Jugador/a" }, { value: "COACH", label: "Entrenador / Staff" }, { value: "RELATIVE", label: "Familiar" },
];
const ROLE_LABELS: Record<string, string> = { PLAYER: "Jugador/a", COACH: "Entrenador", RELATIVE: "Familiar", STAFF: "Staff", OTHER: "Otro" };
const labelForRole = (role: string): string => ROLE_LABELS[role] ?? role;

export default function TabSolicitudes() {
  const c = useTheme();
  const { activeClubId: clubId, activeSeasonName } = useAuthStore();
  const currentSeason = activeSeasonName || "24-25";

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqPage, setReqPage] = useState(0);
  const [reqHasMore, setReqHasMore] = useState(true);

  const [reviewModal, setReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");

  const [assignRole, setAssignRole] = useState<AssignableRole>("PLAYER");
  const [assignTeamId, setAssignTeamId] = useState<number | null>(null);
  const [assignStaffRole, setAssignStaffRole] = useState<StaffRoleType>("HEAD_COACH");
  const [assignKinship, setAssignKinship] = useState<KinshipType>("FATHER");
  const [assignPlayerPosition, setAssignPlayerPosition] = useState<PlayerPosition>("MIDFIELDER");
  const [assignLinkedPlayerId, setAssignLinkedPlayerId] = useState<number | null>(null);
  const [assignChildTeamId, setAssignChildTeamId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [imageConsentEnabled, setImageConsentEnabled] = useState(false);
  const [query, setQuery] = useState('');

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);

  // Fetches
  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/president/club/${clubId}/teams`);
      setTeams(await res.json());
    } catch {}
  }, [clubId]);

  const fetchRequests = useCallback(async (page: number) => {
    setReqLoading(true);
    try {
      const res = await apiFetch(`/api/president/requests?clubId=${clubId}&page=${page}&size=15`);
      const data = await res.json();
      const items = data.content ?? [];
      setRequests((prev) => (page === 0 ? items : [...prev, ...items]));
      setReqHasMore(!data.last);
      setReqPage(page);
    } catch { setFetchError("No se pudieron cargar las solicitudes."); }
    finally { setReqLoading(false); }
  }, [clubId]);

  useEffect(() => { fetchTeams(); fetchRequests(0); }, [fetchTeams, fetchRequests]);

  useEffect(() => {
    if (assignRole === "RELATIVE" && assignTeamId) {
      setQuery('');
      apiFetch(`/api/president/players?clubId=${clubId}&teamId=${assignTeamId}`)
        .then((res) => res.json())
        .then((data) => {
          const arr = data.content ?? data;
          setTeamPlayers(Array.isArray(arr) ? arr : []);
        }).catch(() => setTeamPlayers([]));
    } else {
      setTeamPlayers([]);
      setAssignLinkedPlayerId(null);
      setQuery('');
    }
  }, [assignTeamId, assignRole, clubId]);

  // Handlers
  const openApproveModal = (item: JoinRequest) => {
    setSelectedRequest(item);
    setReviewDecision("APPROVED");
    const preRole = ["COACH", "PLAYER", "RELATIVE"].includes(item.requestedRole) ? (item.requestedRole as AssignableRole) : "PLAYER";
    setAssignRole(preRole);
    setAssignTeamId(null);
    setAssignLinkedPlayerId(null);
    setAssignChildTeamId(null);
    setQuery('');
    setImageConsentEnabled(false);
    setModalError('');
    setReviewModal(true);
  };

  const handleReview = async () => {
    if (!selectedRequest) return;
    setModalError('');

    const payload: Record<string, unknown> = { decision: reviewDecision, assignedRole: assignRole };
    if (reviewDecision === "APPROVED") {
      if (assignRole === "PLAYER") {
        if (!assignTeamId) {
          setModalError("Debes seleccionar un equipo para el jugador.");
          return;
        }
        if (!assignPlayerPosition) {
          setModalError("Debes seleccionar una posición.");
          return;
        }
        payload.teamId = assignTeamId;
        payload.playerPosition = assignPlayerPosition;
        payload.imageConsentSeason = imageConsentEnabled ? currentSeason : null;
      } else if (assignRole === "COACH") {
        if (!assignTeamId) {
          setModalError("Debes seleccionar un equipo para el entrenador.");
          return;
        }
        if (!assignStaffRole) {
          setModalError("Debes seleccionar un rol técnico.");
          return;
        }
        payload.teamId = assignTeamId;
        payload.staffRoleType = assignStaffRole;
      } else if (assignRole === "RELATIVE") {
        const childHasAccount = selectedRequest?.metadata?.childHasAccount;
        if (childHasAccount === false) {
          if (!assignChildTeamId) {
            setModalError("Debes seleccionar un equipo para el nuevo jugador/a.");
            return;
          }
          payload.teamId = assignChildTeamId;
        } else {
          if (!assignLinkedPlayerId) {
            setModalError("Debes vincular un jugador/a existente.");
            return;
          }
          payload.linkedPlayerId = assignLinkedPlayerId;
        }
        payload.kinshipType = assignKinship;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/president/requests/${selectedRequest.id}?clubId=${clubId}`, {
        method: "PATCH", body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        try {
          const errBody = JSON.parse(errText);
          setModalError(parseApiError(errBody?.message || errBody?.error, 'Error al procesar la solicitud.'));
        } catch {
          setModalError(parseApiError(errText, 'Error al procesar la solicitud.'));
        }
        return;
      }
      setReviewModal(false);
      setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));
    } catch {
      setModalError("Problema de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {reqLoading && requests.length === 0 && <ActivityIndicator color={c.boton} style={{ marginTop: 20 }} />}
      {fetchError !== '' && (
        <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
          <Text style={{ color: c.error, fontSize: 13, fontWeight: "500" }}>⚠️ {fetchError}</Text>
        </View>
      )}
      {!reqLoading && requests.length === 0 && fetchError === '' && (
        <View style={[styles.emptyBox, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={{ color: c.subtexto, textAlign: "center" }}>{"No hay solicitudes pendientes"}</Text>
        </View>
      )}
      
      {requests.map((item) => (
        <View key={item.id} style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={[styles.cardTitle, { color: c.texto }]}>{item.userFullName}</Text>
          <Text style={{ color: c.subtexto, fontSize: 13, marginTop: 2 }}>{item.userEmail}</Text>
          <View style={[styles.roleBadge, { backgroundColor: c.fondo, borderColor: c.bordeInput }]}>
            <Text style={{ color: c.boton, fontSize: 12, fontWeight: "700" }}>{labelForRole(item.requestedRole)}</Text>
          </View>
          {!!item.message && <Text style={{ color: c.subtexto, fontSize: 12, fontStyle: "italic", marginTop: 6 }}>{`"${item.message}"`}</Text>}
          
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[styles.btnAction, { backgroundColor: "#DCFCE7", borderColor: "#16A34A" }]} onPress={() => openApproveModal(item)}>
              <Text style={{ color: "#16A34A", fontWeight: "bold", fontSize: 13 }}>{"✓ Aprobar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnAction, { backgroundColor: "#FEE2E2", borderColor: "#DC2626" }]} onPress={() => { setSelectedRequest(item); setReviewDecision("REJECTED"); setModalError(''); setReviewModal(true); }}>
              <Text style={{ color: "#DC2626", fontWeight: "bold", fontSize: 13 }}>{"✕ Rechazar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {reqHasMore && !reqLoading && requests.length > 0 && (
        <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => fetchRequests(reqPage + 1)}>
          <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cargar más"}</Text>
        </TouchableOpacity>
      )}

      {/* MODAL REVISIÓN */}
      <Modal visible={reviewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalBox, { backgroundColor: c.fondo }]}>
              <Text style={[styles.modalTitle, { color: c.texto }]}>{"Revisar Solicitud"}</Text>

              {selectedRequest && (
                <View style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput, marginBottom: 20, padding: 12 }]}>
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{selectedRequest.userFullName}</Text>
                  <Text style={{ color: c.subtexto, fontSize: 13 }}>{selectedRequest.userEmail}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Decisión"}</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => setReviewDecision("APPROVED")} style={[styles.btnAction, reviewDecision === "APPROVED" ? { backgroundColor: "#DCFCE7", borderColor: "#16A34A" } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                  <Text style={{ color: reviewDecision === "APPROVED" ? "#16A34A" : c.subtexto, fontWeight: "bold" }}>{"✓ Aprobar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setReviewDecision("REJECTED")} style={[styles.btnAction, reviewDecision === "REJECTED" ? { backgroundColor: "#FEE2E2", borderColor: "#DC2626" } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                  <Text style={{ color: reviewDecision === "REJECTED" ? "#DC2626" : c.subtexto, fontWeight: "bold" }}>{"✕ Rechazar"}</Text>
                </TouchableOpacity>
              </View>

              {reviewDecision === "APPROVED" && (
                <View>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>{"1. Rol a asignar"}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <TouchableOpacity key={r.value} onPress={() => { setAssignRole(r.value); setAssignTeamId(null); setAssignLinkedPlayerId(null); setAssignChildTeamId(null); setQuery(''); }} style={[styles.chip, assignRole === r.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                        <Text style={{ color: assignRole === r.value ? "#fff" : c.subtexto, fontSize: 12, fontWeight: "600" }}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {assignRole === "PLAYER" && (
                    <View>
                      <Text style={[styles.inputLabel, { color: c.texto }]}>{"2. Equipo"}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        {teams.map((t) => (
                          <TouchableOpacity key={t.id} onPress={() => setAssignTeamId(t.id)} style={[styles.chip, assignTeamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                            <Text style={{ color: assignTeamId === t.id ? "#fff" : c.subtexto, fontSize: 12 }}>{`${CATEGORY_LABEL[t.category] ?? t.category} ${t.suffix}`}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={[styles.inputLabel, { color: c.texto }]}>{"3. Posición"}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                        {PLAYER_POSITIONS.map((pos) => (
                          <TouchableOpacity key={pos.value} onPress={() => setAssignPlayerPosition(pos.value)} style={[styles.chip, assignPlayerPosition === pos.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                            <Text style={{ color: assignPlayerPosition === pos.value ? "#fff" : c.subtexto, fontSize: 12 }}>{pos.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={[styles.consentRow, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: c.texto, fontSize: 13, fontWeight: "600" }}>
                            {`Consentimiento de Imagen (Temporada ${currentSeason})`}
                          </Text>
                          <Text style={{ color: c.subtexto, fontSize: 11, marginTop: 3 }}>
                            {"Las fotos se ocultarán automáticamente al cambiar de temporada deportiva hasta que se renueve el consentimiento"}
                          </Text>
                        </View>
                        <Switch
                          value={imageConsentEnabled}
                          onValueChange={setImageConsentEnabled}
                          trackColor={{ false: c.bordeInput, true: c.boton }}
                          thumbColor="#fff"
                        />
                      </View>
                    </View>
                  )}

                  {assignRole === "COACH" && (
                    <View>
                      <Text style={[styles.inputLabel, { color: c.texto }]}>{"2. Equipo"}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        {teams.map((t) => (
                          <TouchableOpacity key={t.id} onPress={() => setAssignTeamId(t.id)} style={[styles.chip, assignTeamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                            <Text style={{ color: assignTeamId === t.id ? "#fff" : c.subtexto, fontSize: 12 }}>{`${CATEGORY_LABEL[t.category] ?? t.category} ${t.suffix}`}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={[styles.inputLabel, { color: c.texto }]}>{"3. Rol técnico"}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                        {STAFF_ROLES.map((sr) => (
                          <TouchableOpacity key={sr.value} onPress={() => setAssignStaffRole(sr.value)} style={[styles.chip, assignStaffRole === sr.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                            <Text style={{ color: assignStaffRole === sr.value ? "#fff" : c.subtexto, fontSize: 12 }}>{sr.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {assignRole === "RELATIVE" && (
                    <View>
                      {selectedRequest?.metadata?.childHasAccount === false ? (
                        // Hijo sin cuenta: se creará jugador automáticamente desde metadata
                        <View>
                          <View style={[styles.infoBox, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                            <Text style={{ color: c.texto, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
                              {"Se creará un nuevo jugador/a:"}
                            </Text>
                            <Text style={{ color: c.subtexto, fontSize: 13 }}>
                              {`${selectedRequest.metadata.childFirstName ?? ""} ${selectedRequest.metadata.childLastName ?? ""}`.trim() || "Sin nombre"}
                            </Text>
                            {!!selectedRequest.metadata.childBirthDate && (
                              <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 2 }}>
                                {`Nacimiento: ${selectedRequest.metadata.childBirthDate}`}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.inputLabel, { color: c.texto, marginTop: 12 }]}>{"2. Equipo"}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {teams.map((t) => (
                              <TouchableOpacity key={t.id} onPress={() => setAssignChildTeamId(t.id)} style={[styles.chip, assignChildTeamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                                <Text style={{ color: assignChildTeamId === t.id ? "#fff" : c.subtexto, fontSize: 12 }}>{`${CATEGORY_LABEL[t.category] ?? t.category} ${t.suffix}`}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <Text style={[styles.inputLabel, { color: c.texto }]}>{"3. Parentesco"}</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                            {KINSHIP_TYPES.map((k) => (
                              <TouchableOpacity key={k.value} onPress={() => setAssignKinship(k.value)} style={[styles.chip, assignKinship === k.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                                <Text style={{ color: assignKinship === k.value ? "#fff" : c.subtexto, fontSize: 12 }}>{k.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ) : (
                        // Hijo con cuenta existente: el presidente selecciona la ficha
                        <View>
                          <Text style={[styles.inputLabel, { color: c.texto }]}>{"2. Equipo del jugador/a"}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {teams.map((t) => (
                              <TouchableOpacity key={t.id} onPress={() => setAssignTeamId(t.id)} style={[styles.chip, assignTeamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                                <Text style={{ color: assignTeamId === t.id ? "#fff" : c.subtexto, fontSize: 12 }}>{`${CATEGORY_LABEL[t.category] ?? t.category} ${t.suffix}`}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <Text style={[styles.inputLabel, { color: c.texto }]}>{"3. Parentesco"}</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                            {KINSHIP_TYPES.map((k) => (
                              <TouchableOpacity key={k.value} onPress={() => setAssignKinship(k.value)} style={[styles.chip, assignKinship === k.value ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                                <Text style={{ color: assignKinship === k.value ? "#fff" : c.subtexto, fontSize: 12 }}>{k.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {assignTeamId && (
                            <View style={{ marginBottom: 16 }}>
                              <Text style={[styles.inputLabel, { color: c.texto }]}>{"4. Vincular a jugador/a"}</Text>

                              {assignLinkedPlayerId ? (
                                <View style={[styles.linkedBadge, { backgroundColor: `${c.boton}18`, borderColor: `${c.boton}40` }]}>
                                  <Text style={{ flex: 1, color: c.boton, fontWeight: "600", fontSize: 13 }}>
                                    {"Vinculado a: "}
                                    {teamPlayers.find((p) => p.id === assignLinkedPlayerId)?.firstName}{" "}
                                    {teamPlayers.find((p) => p.id === assignLinkedPlayerId)?.lastName ?? ""}
                                  </Text>
                                  <TouchableOpacity onPress={() => { setAssignLinkedPlayerId(null); setQuery(""); }}>
                                    <Text style={{ color: c.subtexto, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>{"✕"}</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View>
                                  <TextInput
                                    style={[styles.searchInput, { backgroundColor: c.input, borderColor: c.bordeInput, color: c.texto }]}
                                    placeholder={"Escribe nombre o apellido (mín. 3 letras)..."}
                                    placeholderTextColor={c.subtexto}
                                    value={query}
                                    onChangeText={setQuery}
                                  />
                                  {query.trim().length >= 3 && (() => {
                                    const hits = teamPlayers.filter((p) =>
                                      `${p.firstName} ${p.lastName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
                                    );
                                    return hits.length > 0 ? (
                                      <View style={[styles.dropdown, { borderColor: c.bordeInput }]}>
                                        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
                                          {hits.map((p) => (
                                            <TouchableOpacity
                                              key={p.id}
                                              style={[styles.dropdownItem, { borderBottomColor: c.bordeInput }]}
                                              onPress={() => { setAssignLinkedPlayerId(p.id); setQuery(""); }}
                                            >
                                              <Text style={{ color: c.texto, fontSize: 13 }}>{p.firstName} {p.lastName ?? ""}</Text>
                                            </TouchableOpacity>
                                          ))}
                                        </ScrollView>
                                      </View>
                                    ) : (
                                      <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 6, marginLeft: 4 }}>{"Sin coincidencias."}</Text>
                                    );
                                  })()}
                                  {teamPlayers.length === 0 && (
                                    <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 6, marginLeft: 4 }}>{"No hay jugadores en ese equipo aún."}</Text>
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {modalError !== '' && (
                <View style={[styles.errorBanner, { backgroundColor: `${c.error}15`, borderColor: c.error }]}>
                  <Text style={{ color: c.error, fontSize: 13, fontWeight: "500" }}>⚠️ {modalError}</Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => setReviewModal(false)}>
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: reviewDecision === "APPROVED" ? c.boton : "#DC2626", flex: 1, opacity: isSubmitting ? 0.5 : 1 }]} onPress={handleReview} disabled={isSubmitting}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>{isSubmitting ? "Procesando..." : "Confirmar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "bold" },
  btnMain: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12, marginTop: 10 },
  btnAction: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  inputLabel: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginTop: 6 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 30, marginBottom: 12, alignItems: "center" },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  errorBanner: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  searchInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  dropdown: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: "hidden" },
  dropdownItem: { padding: 12, borderBottomWidth: 1 },
  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10 },
});