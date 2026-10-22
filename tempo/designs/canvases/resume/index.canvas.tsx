import ResumeTab from './ResumeTab';
import ResumeTabEmpty from './ResumeTabEmpty';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

export default function ResumeCanvas() {
  return (
    <Canvas name="Resume">
      <Storyboard
        id="ResumeTabScreen"
        name="Resume tab — populated"
        component={ResumeTab}
        layout={{ x: 0, y: 0, width: 1440, height: 2600 }}
      />
      <Storyboard
        id="ResumeTabEmptyScreen"
        name="Resume tab — empty state"
        component={ResumeTabEmpty}
        layout={{ x: 1490, y: 0, width: 1440, height: 1024 }}
      />
    </Canvas>
  );
}
