import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useTheme } from "../../lib/useTheme";

type PaymentStatus = "PENDING" | "PAID" | "OVERDUE";
interface PaymentItem { paymentId: number; playerId: number; playerName: string; status: PaymentStatus; paidDate: string | null; }
interface FeeWithPayments { feeId: number; concept: string; amount: number; dueDate: string; teamName?: string; payments: PaymentItem[]; }
interface Team { id: number; category: string; gender: string; suffix: string; seasonLabel: string; }

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const getTodayStr = () => new Date().toISOString().split("T")[0];
const computedStatus = (status: PaymentStatus, dueDate: string): PaymentStatus => {
  if (status === "PAID") return "PAID";
  if (dueDate < getTodayStr()) return "OVERDUE";
  return "PENDING";
};

export default function TabCuotas() {
  const c = useTheme();
  const { activeClubId: clubId, activeSeasonName } = useAuthStore();
  const seasonLabel = activeSeasonName || "24-25";

  const [fees, setFees] = useState<FeeWithPayments[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [feesPage, setFeesPage] = useState(0);
  const [feesHasMore, setFeesHasMore] = useState(true);
  const [expandedFee, setExpandedFee] = useState<number | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [createFeeModal, setCreateFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState<{ teamId: number | "ALL"; concept?: string; amount?: string; dueDate?: string }>({ teamId: "ALL" });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const fetchTeams = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/president/club/${clubId}/teams`);
      setTeams(await res.json());
    } catch {}
  }, [clubId]);

  const fetchFees = useCallback(async (page: number) => {
    setFeesLoading(true);
    try {
      const res = await apiFetch(`/api/president/fees?clubId=${clubId}&seasonLabel=${seasonLabel}&page=${page}&size=15`);
      const data = await res.json();
      const items = data.content ?? [];
      setFees((prev) => (page === 0 ? items : [...prev, ...items]));
      setFeesHasMore(!data.last);
      setFeesPage(page);
    } catch { Alert.alert("Error", "No se cargaron las cuotas."); }
    finally { setFeesLoading(false); }
  }, [clubId, seasonLabel]);

  useEffect(() => { fetchTeams(); fetchFees(0); }, [fetchTeams, fetchFees]);

  const handleCreateFee = async () => {
    if (!feeForm.concept?.trim() || !feeForm.amount || !feeForm.dueDate) return Alert.alert("Atención", "Rellena todos los campos.");
    const parsedAmount = parseFloat(String(feeForm.amount).replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert("Atención", "Importe no válido.");

    const [dy, dm, dd] = feeForm.dueDate!.split("-").map(Number);
    const dueDay = new Date(dy, dm - 1, dd);
    const todayFee = new Date();
    todayFee.setHours(0, 0, 0, 0);
    if (dueDay < todayFee) return Alert.alert("Atención", "La fecha de la cuota no puede ser anterior a hoy.");

    const targetTeamIds = feeForm.teamId === "ALL" ? teams.map((t) => t.id) : [Number(feeForm.teamId)];
    if (targetTeamIds.length === 0) return Alert.alert("Atención", "No hay equipos.");

    try {
      let created = 0;
      for (const tid of targetTeamIds) {
        const res = await apiFetch(`/api/president/fees?clubId=${clubId}`, {
          method: "POST",
          body: JSON.stringify({ teamId: tid, concept: feeForm.concept.trim(), amount: parsedAmount, dueDate: feeForm.dueDate }),
        });
        if (res.ok) {
          const data: FeeWithPayments = await res.json();
          const t = teams.find((x) => x.id === tid);
          if (t) data.teamName = `${t.category} ${t.suffix}`;
          setFees((prev) => [data, ...prev]);
          created++;
        }
      }
      if (created > 0) {
        setCreateFeeModal(false); setFeeForm({ teamId: "ALL" });
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
        f.payments.forEach((p) => {
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
              <Text style={[styles.modalTitle, { color: c.texto }]}>{"Nueva Cuota"}</Text>
              
              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Asignar a:"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setFeeForm((f) => ({ ...f, teamId: "ALL" }))} style={[styles.chip, feeForm.teamId === "ALL" ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                  <Text style={{ color: feeForm.teamId === "ALL" ? "#fff" : c.subtexto, fontWeight: "bold" }}>{"🌐 Todo el club"}</Text>
                </TouchableOpacity>
                {teams.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setFeeForm((f) => ({ ...f, teamId: t.id }))} style={[styles.chip, feeForm.teamId === t.id ? { backgroundColor: c.boton } : { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput }]}>
                    <Text style={{ color: feeForm.teamId === t.id ? "#fff" : c.subtexto }}>{`${t.category} ${t.suffix}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: c.texto }]}>{"Concepto de la cuota:"}</Text>
              <TextInput style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} placeholder="Ej: Matrícula Anual" placeholderTextColor={c.subtexto} onChangeText={(v) => setFeeForm((f) => ({ ...f, concept: v }))} value={feeForm.concept ?? ""} />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>{"Importe (€):"}</Text>
                  <TextInput style={[styles.textInput, { backgroundColor: c.input, color: c.texto, borderColor: c.bordeInput }]} placeholder="50.00" placeholderTextColor={c.subtexto} keyboardType="numeric" onChangeText={(v) => setFeeForm((f) => ({ ...f, amount: v }))} value={feeForm.amount ?? ""} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: c.texto }]}>{"Vencimiento:"}</Text>
                  <TouchableOpacity style={[styles.textInput, { backgroundColor: c.input, justifyContent: "center", borderColor: c.bordeInput }]} onPress={() => setShowDatePicker(true)}>
                    <Text style={{ color: feeForm.dueDate ? c.texto : c.subtexto }}>{feeForm.dueDate ?? "Seleccionar 📅"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, flex: 1, borderWidth: 1, borderColor: c.bordeInput }]} onPress={() => setCreateFeeModal(false)}>
                  <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.boton, flex: 1 }]} onPress={handleCreateFee}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>{"Generar Cuota"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL CALENDARIO */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: c.fondo, paddingBottom: 20 }]}>
            <Text style={[styles.modalTitle, { color: c.texto }]}>{"Seleccionar Vencimiento"}</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else { setCalMonth((m) => m - 1); } }}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: c.boton }}>{"‹ Anterior"}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: c.texto }}>{`${MESES[calMonth]} ${calYear}`}</Text>
              <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else { setCalMonth((m) => m + 1); } }}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: c.boton }}>{"Siguiente ›"}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.calendarWrapper, { borderColor: c.bordeInput }]}>
              <View style={styles.weekRow}>{DIAS_SEMANA.map((d) => <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: c.subtexto }}>{d}</Text>)}</View>
              {renderCalendarGrid()}
            </View>
            <TouchableOpacity style={[styles.btnMain, { backgroundColor: c.input, borderWidth: 1, borderColor: c.bordeInput, marginTop: 15 }]} onPress={() => setShowDatePicker(false)}>
              <Text style={{ color: c.texto, fontWeight: "bold" }}>{"Cancelar"}</Text>
            </TouchableOpacity>
          </View>
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
  weekRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", margin: 2, borderRadius: 8 },
  dayCellEmpty: { flex: 1, aspectRatio: 1, margin: 2 },
});