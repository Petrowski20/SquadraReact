import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../../components/ScreenContainer";
import { useTheme } from "../../../lib/useTheme";
import CallupsStep from "./components/CallupsStep";
import EditStatsStep from "./components/EditStatsStep";
import LiveMatchModals from "./components/LiveMatchModals";
import MatchHeader from "./components/MatchHeader";
import PitchView from "./components/PitchView";
import TimelineView from "./components/TimelineView";
import { LiveMatchProvider, useLiveMatch } from "./context/LiveMatchContext";
import { s } from "./styles";

function MatchContent() {
  const c = useTheme();
  const { loading, step, isLive, liveTab, setLiveTab, matchEvents, setStep } = useLiveMatch();

  return (
    <View style={[s.container, { backgroundColor: c.fondo }]}>
      <MatchHeader />

      {loading ? (
        <ActivityIndicator size="large" color={c.boton} style={{ marginTop: 40 }} />
      ) : step === "callups" ? (
        <CallupsStep />
      ) : isLive ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={[s.backToLineupBtn, { borderBottomColor: c.bordeInput }]}
            onPress={() => setStep("callups")}
          >
            <Text style={{ color: c.boton, fontSize: 12, fontWeight: "600" }}>⬅ Editar Alineación</Text>
          </TouchableOpacity>

          <View style={[s.liveTabBar, { borderBottomColor: c.bordeInput }]}>
            {(
              [
                { id: "field" as const, label: "⚽ Campo" },
                { id: "timeline" as const, label: `📋 Eventos (${matchEvents.length})` },
              ] as const
            ).map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[
                  s.liveTabBtn,
                  liveTab === id && { borderBottomColor: c.boton, borderBottomWidth: 2 },
                ]}
                onPress={() => setLiveTab(id)}
              >
                <Text
                  style={{
                    color: liveTab === id ? c.boton : c.subtexto,
                    fontWeight: liveTab === id ? "700" : "600",
                    fontSize: 13,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {liveTab === "field" ? <PitchView /> : <TimelineView />}
        </View>
      ) : (
        <EditStatsStep />
      )}

      <LiveMatchModals />
    </View>
  );
}

export default function MatchScreen() {
  return (
    <ScreenContainer>
      <LiveMatchProvider>
        <MatchContent />
      </LiveMatchProvider>
    </ScreenContainer>
  );
}
