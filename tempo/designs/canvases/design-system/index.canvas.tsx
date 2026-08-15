import CanvasProviders from "../../../CanvasProviders";
import DesignSystemIndex from "./DesignSystemIndex";
import DesignSystemColor from "./DesignSystemColor";
import DesignSystemTypography from "./DesignSystemTypography";
import DesignSystemFoundations from "./DesignSystemFoundations";
import DesignSystemMotion from "./DesignSystemMotion";
import DesignSystemComponents from "./DesignSystemComponents";
import DesignSystemPatterns from "./DesignSystemPatterns";
import DesignSystemVoice from "./DesignSystemVoice";
import DesignSystemAccessibility from "./DesignSystemAccessibility";
import DesignSystemBrandStory from "./DesignSystemBrandStory";
import DesignSystemEmail from "./DesignSystemEmail";
import DesignSystemPhotography from "./DesignSystemPhotography";
import DesignSystemPersonas from "./DesignSystemPersonas";
import DesignSystemSound from "./DesignSystemSound";
import DesignSystemDataViz from "./DesignSystemDataViz";
import DesignSystemComponentsAdvanced from "./DesignSystemComponentsAdvanced";
import { Canvas, Storyboard } from "tempo-sdk/canvas";

const Index = () => (
    <CanvasProviders>
      <DesignSystemIndex />
    </CanvasProviders>
  );

const Color = () => (
    <CanvasProviders>
      <DesignSystemColor />
    </CanvasProviders>
  );

const Typography = () => (
    <CanvasProviders>
      <DesignSystemTypography />
    </CanvasProviders>
  );

const Foundations = () => (
    <CanvasProviders>
      <DesignSystemFoundations />
    </CanvasProviders>
  );

const Motion = () => (
    <CanvasProviders>
      <DesignSystemMotion />
    </CanvasProviders>
  );

const Components = () => (
    <CanvasProviders>
      <DesignSystemComponents />
    </CanvasProviders>
  );

const Patterns = () => (
    <CanvasProviders>
      <DesignSystemPatterns />
    </CanvasProviders>
  );

const Voice = () => (
    <CanvasProviders>
      <DesignSystemVoice />
    </CanvasProviders>
  );

const Accessibility = () => (
    <CanvasProviders>
      <DesignSystemAccessibility />
    </CanvasProviders>
  );

const BrandStory = () => (
    <CanvasProviders>
      <DesignSystemBrandStory />
    </CanvasProviders>
  );

const Email = () => (
    <CanvasProviders>
      <DesignSystemEmail />
    </CanvasProviders>
  );

const Photography = () => (
    <CanvasProviders>
      <DesignSystemPhotography />
    </CanvasProviders>
  );

const Personas = () => (
    <CanvasProviders>
      <DesignSystemPersonas />
    </CanvasProviders>
  );

const Sound = () => (
    <CanvasProviders>
      <DesignSystemSound />
    </CanvasProviders>
  );

const DataViz = () => (
    <CanvasProviders>
      <DesignSystemDataViz />
    </CanvasProviders>
  );

const ComponentsAdvanced = () => (
    <CanvasProviders>
      <DesignSystemComponentsAdvanced />
    </CanvasProviders>
  );

export default function DesignSystemCanvas() {
  return (
    <Canvas name="Design System">
      <Storyboard
        id="Index"
        name="Index · Cover"
        component={Index}
        layout={{ x: -1391, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Color"
        name="Color"
        component={Color}
        layout={{ x: -51, y: 0, width: 1280, height: 6521 }}
      />
      <Storyboard
        id="Typography"
        name="Typography"
        component={Typography}
        layout={{ x: 1279, y: 0, width: 1280, height: 7919 }}
      />
      <Storyboard
        id="Foundations"
        name="Foundations"
        component={Foundations}
        layout={{ x: 2706, y: 0, width: 1280, height: 5500 }}
      />
      <Storyboard
        id="Motion"
        name="Motion"
        component={Motion}
        layout={{ x: 4036, y: 0, width: 1280, height: 5200 }}
      />
      <Storyboard
        id="Components"
        name="Components"
        component={Components}
        layout={{ x: 5366, y: 0, width: 1280, height: 7200 }}
      />
      <Storyboard
        id="Patterns"
        name="Patterns"
        component={Patterns}
        layout={{ x: 6696, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Voice"
        name={"Voice & Tone"}
        component={Voice}
        layout={{ x: 8026, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Accessibility"
        name="Accessibility"
        component={Accessibility}
        layout={{ x: 9356, y: 0, width: 1280, height: 5500 }}
      />
      <Storyboard
        id="BrandStory"
        name="Brand Story"
        component={BrandStory}
        layout={{ x: 10686, y: 0, width: 1280, height: 6800 }}
      />
      <Storyboard
        id="Email"
        name="Email Design"
        component={Email}
        layout={{ x: 12016, y: 0, width: 1280, height: 7800 }}
      />
      <Storyboard
        id="Photography"
        name="Photography"
        component={Photography}
        layout={{ x: 13346, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Personas"
        name="Customer Personas"
        component={Personas}
        layout={{ x: 14676, y: 0, width: 1280, height: 4800 }}
      />
      <Storyboard
        id="Sound"
        name="Sound Identity"
        component={Sound}
        layout={{ x: 16006, y: 0, width: 1280, height: 5400 }}
      />
      <Storyboard
        id="DataViz"
        name="Data Visualization"
        component={DataViz}
        layout={{ x: 17336, y: 0, width: 1280, height: 6800 }}
      />
      <Storyboard
        id="ComponentsAdvanced"
        name="Components · Advanced"
        component={ComponentsAdvanced}
        layout={{ x: 18666, y: 0, width: 1280, height: 7200 }}
      />
    </Canvas>
  );
}
