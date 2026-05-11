import { useRouter } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../../../lib/useTheme";
import { useLiveMatch } from "../context/LiveMatchContext";
import { s } from "../styles";

export default function MatchHeader() {
  const c = useTheme();
  const router = useRouter();
  const { isLive, step, setCloseModal, handleResetMatch } = useLiveMatch();

  return (
    <>
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

      <StepIndicator />
    </>
  );
}

function StepIndicator() {
  const c = useTheme();
  const { isLive, step } = useLiveMatch();

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
}
