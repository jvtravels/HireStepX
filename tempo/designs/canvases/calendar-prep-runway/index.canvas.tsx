import Calendarpreprunway, { PrepRunwayRail, SuggestRunwaySheet } from '../../../../src/CalendarPrepRunway';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

export default function CalendarPrepRunwayCanvas() {
  return (
    <Canvas name="Calendar — Prep Runway">
      <Storyboard
        id="CalendarPage"
        name="Calendar — full surface"
        component={Calendarpreprunway}
        layout={{ x: 0, y: 0, width: 1340, height: 1040 }}
      />
      <Storyboard
        id="RunwayRail"
        name="Prep Runway rail"
        component={PrepRunwayRail}
        layout={{ x: 1390, y: 0, width: 1160, height: 380 }}
      />
      <Storyboard
        id="SuggestSheet"
        name="Suggest-then-accept sheet"
        component={SuggestRunwaySheet}
        layout={{ x: 0, y: 1090, width: 620, height: 540 }}
      />
    </Canvas>
  );
}
