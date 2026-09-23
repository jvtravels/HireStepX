import FooterDome from './FooterDome';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

export default function FooterRedesignCanvas() {
  return (
    <Canvas name="Footer Redesign">
      <Storyboard
        id="FooterDomeScreen"
        name="Footer — Dome 1728"
        component={FooterDome}
        layout={{ x: 0, y: 0, width: 1728, height: 460 }}
      />
    </Canvas>
  );
}
