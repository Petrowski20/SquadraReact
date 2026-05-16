import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";
interface PaymentItem { paymentId: number; playerId: number; playerName: string; status: PaymentStatus; paidDate: string | null; }
interface FeeWithPayments { feeId: number; concept: string; amount: number; dueDate: string; teamName?: string; payments: PaymentItem[]; }
interface Team { id: number; category: string; gender: string; suffix: string; seasonLabel: string; }

const getTodayStr = () => new Date().toISOString().split("T")[0];
const computedStatus = (status: PaymentStatus, dueDate: string): PaymentStatus => {
  if (status === "PAID") return "PAID";
  if (dueDate < getTodayStr()) return "OVERDUE";
  return "PENDING";
};

export default function TabCuotas() {
  const c = useTheme();
  const { t } = useTranslation();
  const { activeClubId: clubId, activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  // Ref para el seasonLabel real obtenido del backend (equipos), evita el desajuste con el store
  const slRef = useRef<string>(seasonLabel);

  const [fees, setFees] = useState<FeeWithPayments[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesPage, setFeesPage] = useState(0);
  const [feesHasMore, setFeesHasMore] = useState(true);
  const [expandedFee, setExpandedFee] = useState<number | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [createFeeModal, setCreateFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState<{ teamId: number | "ALL"; concept?: string; amount?: string; dueDate?: string }>({ teamId: "ALL" });
  const [feeError, setFeeError] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const fetchFees = useCallback(async (page: number) => {
    setFeesLoading(true);
    try {
      const res = await apiFetch(`/api/president/fees?clubId=${clubId}&seasonLabel=${slRef.current}&page=${page}&size=15`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: FeeWithPayments[] = Array.isArray(data) ? data : (data.content ?? []);
      const hasMore = Array.isArray(data) ? false : !data.last;
      const normalized = items.map((f) => ({ ...f, payments: f.payments ?? [] }));
      setFees((prev) => (page === 0 ? normalized : [...prev, ...normalized]));
      setFeesHasMore(hasMore);
      setFeesPage(page);
    } catch {
      Alert.alert("Error", "No se cargaron las cuotas.");
    }
    finally { setFeesLoading(false); }
  }, [clubId]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch(`/api/president/club/${clubId}/teams`);
        if (res.ok) {
          const data: Team[] = await res.json();
          setTeams(data);
          if (data.length > 0) slRef.current = data[0].seasonLabel;
        }
      } catch {}
      fetchFees(0);
    };
    init();
  }, [clubId, fetchFees]);

  const handleCreateFee = async () => {
    setFeeError("");

    if (!feeForm.concept?.trim() || !feeForm.amount || !feeForm.dueDate) {
      setFeeError("Por favor, rellena todos los campos.");
      return;
    }
    const parsedAmount = parseFloat(String(feeForm.amount).replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFeeError("El importe debe ser un número mayor que 0.");
      return;
    }

    const [dy, dm, dd] = feeForm.dueDate!.split("-").map(Number);
    const dueDay = new Date(dy, dm - 1, dd);
    const todayFee = new Date();
    todayFee.setHours(0, 0, 0, 0);
    if (dueDay < todayFee) {
      setFeeError("La fecha de vencimiento no puede ser anterior a hoy.");
      return;
    }

    const targetTeamIds = feeForm.teamId === "ALL" ? teams.map((t) => t.id) : [Number(feeForm.teamId)];
    if (targetTeamIds.length === 0) return Alert.alert("Atención", "No hay equipos.");

    try {
      let created = 0;
      for (const tid of targetTeamIds) {
        const res = await apiFetch(`/api/president/fees?clubId=${clubId}&seasonLabel=${slRef.current}`, {
          method: "POST",
          body: JSON.stringify({ teamId: tid, concept: feeForm.concept.trim(), amount: parsedAmount, dueDate: feeForm.dueDate }),
        });
        if (res.ok) created++;
      }
      if (created > 0) {
        setCreateFeeModal(false);
        setFeeForm({ teamId: "ALL" });
        await fetchFees(0);
        Alert.alert("Éxito", feeForm.teamId === "ALL" ? `Cuotas generadas para ${created} equipo(s).` : "Cuota generada.");
      } else { Alert.alert("Error", "El servidor rechazó la creación."); }
    } catch { Alert.alert("Error", "Problema de conexión."); }
  };

  const handlePaymentStatus = async (paymentId: number, feeId: number, newStatus: PaymentStatus) => {
    try {
      await apiFetch(`/api/president/payments/${paymentId}?clubId=${clubId}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      setFees((prev) => prev.map((f) => f.feeId !== feeId ? f : { ...f, payments: f.payments.map((p) => p.paymentId !== paymentId ? p : { ...p, status: newStatus }) }));
    } catch { Alert.alert("Error", "No se actualizó el pago."); }
  };

  const selectDate = (day: number) => {
    const yyyy = calYear; const mm = String(calMonth + 1).padStart(2, "0"); const dd = String(day).padStart(2, "0");
    setFeeForm((f) => ({ ...f, dueDate: `${yyyy}-${mm}-${dd}` }));
    setShowDatePicker(false);
  };

  const renderCalendarGrid = () => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const grid: React.ReactNode[] = []; let dayCount = 1;

    for (let row = 0; row < 6; row++) {
      const cells: React.ReactNode[] = [];
      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < startOffset) cells.push(<View key={`es-${col}`} style={styles.dayCellEmpty} />);
        else if (dayCount <= daysInMonth) {
          const d = dayCount;
          cells.push(
            <TouchableOpacity key={`d-${d}`} style={[styles.dayCell, { backgroundColor: c.input }]} onPress={() => selectDate(d)}>
              <Text style={{ color: c.texto, fontSize: 14, fontWeight: "600" }}>{d}</Text>
            </TouchableOpacity>
          );
          dayCount++;
        } else cells.push(<View key={`ee-${row}-${col}`} style={styles.dayCellEmpty} />);
      }
      grid.push(<View key={`row-${row}`} style={styles.weekRow}>{cells}</View>);
      if (dayCount > daysInMonth) break;
    }
    return grid;
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton }]} onPress={() => setCreateFeeModal(true)}>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{"+ Crear Nueva Cuota"}</Text>
      </TouchableOpacity>

      {feesLoading && fees.length === 0 && <ActivityIndicator style={{ marginTop: 20 }} color={c.boton} />}
      {!feesLoading && fees.length === 0 && (
        <View style={[styles.emptyBox, { backgroundColor: c.input, borderColor: c.bordeInput }]}>
          <Text style={{ color: c.subtexto, textAlign: "center" }}>{"No hay cuotas registradas en esta temporada"}</Text>
        </View>
      )}

      {fees.map((f) => {
        let paid = 0; let pending = 0; let overdue = 0;
        (f.payments ?? []).forEach((p) => {
          const st = computedStatus(p.status, f.dueDate);
          if (st === "PAID") paid++; else if (st === "PENDING") pending++; else overdue++;
        });

        return (
          <View key={f.feeId} style={[styles.card, { backgroundColor: c.input, borderColor: c.bordeInput, padding: 0, overflow: "hidden" }]}>
            <TouchableOpacity style={{ padding: 16 }} onPress={() => setExpandedFee(expandedFee === f.feeId ? null : f.feeId)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: c.texto, fontSize: 17 }]}>{f.concept}</Text>
                  <Text style={{ color: c.subtexto, fontSize: 13, marginTop: 4 }}>{`👕 ${f.teamName ?? "Todo el club"}`}</Text>
                </View>
                <Text style={{ color: c.boton, fontWeight: "900", fontSize: 22 }}>{`€${Number(f.amount).toFixed(2)}`}</Text>
              </View>
              <Text style={{ color: c.texto, fontSize: 13, marginTop: 10, fontWeight: "500" }}>{`Vencimiento: ${f.dueDate}`}</Text>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 10, backgroundColor: c.fondo, padding: 10, borderRadius: 10 }}>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: "#16A34A", fontWeight: "bold", fontSize: 16 }}>{paid}</Text><Text style={{ color: c.subtexto, fontSize: 10 }}>{"PAGADOS"}</Text></View>
                <View style={{ alignItems: "center", flex: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.bordeInput }}><Text style={{ color: "#D97706", fontWeight: "bold", fontSize: 16 }}>{pending}</Text><Text style={{ color: c.subtexto, fontSize: 10 }}>{"PENDIENTES"}</Text></View>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: "#DC2626", fontWeight: "bold", fontSize: 16 }}>{overdue}</Text><Text style={{ color: c.subtexto, fontSize: 10 }}>{"EXPIRADOS"}</Text></View>
              </View>
              <Text style={{ color: c.subtexto, fontSize: 12, marginTop: 8, textAlign: "right" }}>{expandedFee === f.feeId ? "▲ Ocultar jugadores" : "▼ Ver jugadores"}</Text>
            </TouchableOpacity>

            {expandedFee === f.feeId && (
              <View style={{ backgroundColor: c.fondo, padding: 16, borderTopWidth: 1, borderTopColor: c.bordeInput }}>
                <Text style={{ color: c.texto, fontWeight: "bold", marginBottom: 12 }}>{"Lista de Jugadores:"}</Text>
                {f.payments.map((p) => {
                  const currentStatus = computedStatus(p.status, f.dueDate);
                  return (
                    <View key={p.paymentId} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: c.input, paddingBottom: 8 }}>
                      <Text style={{ color: c.texto, fontSize: 14, flex: 1, fontWeight: "500" }}>{`👤 ${p.playerName}`}</Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity onPress={() => handlePaymentStatus(p.paymentId, f.feeId, "PENDING")} style={[styles.chipSmall, currentStatus !== "PAID" ? currentStatus === "OVERDUE" ? { backgroundColor: "#FEE2E2", borderColor: "#DC2626" } : { backgroundColor: "#FEF3C7", borderColor: "#D97706" } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                          <Text style={{ fontSize: 11, fontWeight: currentStatus !== "PAID" ? "bold" : "normal", color: currentStatus !== "PAID" ? currentStatus === "OVERDUE" ? "#DC2626" : "#D97706" : c.subtexto }}>
                            {currentStatus === "OVERDUE" ? "Expirado" : "Pendiente"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handlePaymentStatus(p.paymentId, f.feeId, "PAID")} style={[styles.chipSmall, currentStatus === "PAID" ? { backgroundColor: "#DCFCE7", borderColor: "#16A34A" } : { backgroundColor: c.input, borderColor: c.bordeInput }]}>
                          <Text style={{ fontSize: 11, fontWeight: currentStatus === "PAID" ? "bold" : "normal", color: currentStatus === "PAID" ? "#16A34A" : c.subtexto }}>{"Pagado"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {feesHasMore && !feesLoading && fees.length > 0 && (
        <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => fetchFees(feesPage + 1)}>
          <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cargar más"}</Text>
        </TouchableOpacity>
      )}

      {/* MODAL CREAR CUOTA */}
      <Modal visible={createFeeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalBox, { backgroundColor: c.fondo }]}>
              <Text style={[styles.modalTitle, { color: c.texto }]}>{t('presidentManagement.newFeeTitle')}</Text>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{t('presidentManagement.feeTeam')}:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setFeeForm((f) => ({ ...f, teamId: "ALL" }))} style={[styles.chip, feeForm.teamId === "ALL" ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                  <Text style={{ color: feeForm.teamId === "ALL" ? "#fff" : c.subtexto, fontWeight: "bold" }}>{"🌐 "}{t('presidentManagement.feeAllClub')}</Text>
                </TouchableOpacity>
                {teams.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setFeeForm((f) => ({ ...f, teamId: t.id }))} style={[styles.chip, feeForm.teamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                    <Text style={{ color: feeForm.teamId === t.id ? "#fff" : c.subtexto }}>{`${t.category} ${t.suffix}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{t('presidentManagement.feeConcept')}:</Text>
              <TextInput style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} placeholder={t('presidentManagement.feeConceptPlaceholder')} placeholderTextColor={c.subtexto} onChangeText={(v) => setFeeForm((f) => ({ ...f, concept: v }))} value={feeForm.concept ?? ""} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>{t('presidentManagement.feeAmount')}:</Text>
                  <TextInput 
                    style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} 
                    placeholder={t('presidentManagement.feeAmountPlaceholder')} 
                    placeholderTextColor={c.subtexto} 
                    keyboardType="numeric" 
                    onChangeText={(v) => {
                      // Filtro para admitir solo números y puntuación en Web y Móvil
                      const cleanedText = v.replace(/[^0-9.,]/g, "");
                      setFeeForm((f) => ({ ...f, amount: cleanedText }));
                    }} 
                    value={feeForm.amount ?? ""} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>{t('presidentManagement.feeDueDate')}:</Text>
                  
                  {Platform.OS === "web" ? (
                    <View style={[styles.textInput, { backgroundColor: c.input, justifyContent: "center", borderColor: c.bordeInput, padding: 0, overflow: "hidden" }]}>
                      {/* @ts-ignore - input nativo de HTML para web */}
                      <input
                        type="date"
                        style={{
                          backgroundColor: "transparent", border: "none", color: c.texto, padding: "14px", width: "100%", outline: "none", colorScheme: "dark", fontSize: "15px"
                        }}
                        value={feeForm.dueDate ?? ""}
                        onChange={(e) => setFeeForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.textInput, { backgroundColor: c.input, justifyContent: "center", borderColor: c.bordeInput }]} 
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={{ color: feeForm.dueDate ? c.texto : c.subtexto }}>
                        {feeForm.dueDate ?? "Seleccionar 📅"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* TEXTO DE ERROR */}
              {feeError !== "" && (
                <Text style={{ color: "#ef4444", marginBottom: 12, textAlign: "center", fontWeight: "600", fontSize: 13 }}>
                  ⚠️ {feeError}
                </Text>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                <TouchableOpacity 
                  style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} 
                  onPress={() => {
                    setCreateFeeModal(false);
                    setFeeError("");
                  }}
                >
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{t('presidentManagement.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton, flex: 1 }]} onPress={handleCreateFee}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>{t('presidentManagement.feeSave')}</Text>
                </TouchableOpacity>
              </View>

              {/* SELECTOR NATIVO PARA MÓVILES */}
              {showDatePicker && Platform.OS !== "web" && (
                <>
                  <DateTimePicker
                    value={feeForm.dueDate ? new Date(feeForm.dueDate) : new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === "android") setShowDatePicker(false);
                      if (selectedDate) {
                        const yyyy = selectedDate.getFullYear();
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
                        const dd = String(selectedDate.getDate()).padStart(2, "0");
                        setFeeForm((f) => ({ ...f, dueDate: `${yyyy}-${mm}-${dd}` }));
                      }
                    }}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity 
                      style={[styles.btnMain, { backgroundColor: c.boton, marginTop: 10 }]} 
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>Aceptar Fecha</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

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
  btnMain: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  chipSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  textInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, minHeight: 50 },
  inputLabel: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 30, marginBottom: 12, alignItems: "center" },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  calendarWrapper: { borderRadius: 12, borderWidth: 1, padding: 10, paddingBottom: 15 },
  weekRow: { flexDirection: "row", justifyContent: "center", marginBottom: 4 },
  dayCell: { width: 36, height: 36, alignItems: "center", justifyContent: "center", margin: 2, borderRadius: 8 },
  dayCellEmpty: { width: 36, height: 36, margin: 2 },
});