import type { TempoPage, TempoStoryboard } from "tempo-sdk";
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

const page: TempoPage = {
  name: "Design System",
};

export default page;

export const Index: TempoStoryboard = {
  name: "Index · Cover",
  render: () => (
    <CanvasProviders>
      <DesignSystemIndex />
    </CanvasProviders>
  ),
  layout: { x: -1391, y: 0, width: 1280, height: 5800 },
};

export const Color: TempoStoryboard = {
  name: "Color",
  render: () => (
    <CanvasProviders>
      <DesignSystemColor />
    </CanvasProviders>
  ),
  layout: { x: -51, y: 0, width: 1280, height: 6521 },
};

export const Typography: TempoStoryboard = {
  name: "Typography",
  render: () => (
    <CanvasProviders>
      <DesignSystemTypography />
    </CanvasProviders>
  ),
  layout: { x: 1279, y: 0, width: 1280, height: 7919 },
};

export const Foundations: TempoStoryboard = {
  name: "Foundations",
  render: () => (
    <CanvasProviders>
      <DesignSystemFoundations />
    </CanvasProviders>
  ),
  layout: { x: 2706, y: 0, width: 1280, height: 5500 },
};

export const Motion: TempoStoryboard = {
  name: "Motion",
  render: () => (
    <CanvasProviders>
      <DesignSystemMotion />
    </CanvasProviders>
  ),
  layout: { x: 4036, y: 0, width: 1280, height: 5200 },
};

export const Components: TempoStoryboard = {
  name: "Components",
  render: () => (
    <CanvasProviders>
      <DesignSystemComponents />
    </CanvasProviders>
  ),
  layout: { x: 5366, y: 0, width: 1280, height: 7200 },
};

export const Patterns: TempoStoryboard = {
  name: "Patterns",
  render: () => (
    <CanvasProviders>
      <DesignSystemPatterns />
    </CanvasProviders>
  ),
  layout: { x: 6696, y: 0, width: 1280, height: 5800 },
};

export const Voice: TempoStoryboard = {
  name: "Voice & Tone",
  render: () => (
    <CanvasProviders>
      <DesignSystemVoice />
    </CanvasProviders>
  ),
  layout: { x: 8026, y: 0, width: 1280, height: 5800 },
};

export const Accessibility: TempoStoryboard = {
  name: "Accessibility",
  render: () => (
    <CanvasProviders>
      <DesignSystemAccessibility />
    </CanvasProviders>
  ),
  layout: { x: 9356, y: 0, width: 1280, height: 5500 },
};

export const BrandStory: TempoStoryboard = {
  name: "Brand Story",
  render: () => (
    <CanvasProviders>
      <DesignSystemBrandStory />
    </CanvasProviders>
  ),
  layout: { x: 10686, y: 0, width: 1280, height: 6800 },
};

export const Email: TempoStoryboard = {
  name: "Email Design",
  render: () => (
    <CanvasProviders>
      <DesignSystemEmail />
    </CanvasProviders>
  ),
  layout: { x: 12016, y: 0, width: 1280, height: 7800 },
};

export const Photography: TempoStoryboard = {
  name: "Photography",
  render: () => (
    <CanvasProviders>
      <DesignSystemPhotography />
    </CanvasProviders>
  ),
  layout: { x: 13346, y: 0, width: 1280, height: 5800 },
};

export const Personas: TempoStoryboard = {
  name: "Customer Personas",
  render: () => (
    <CanvasProviders>
      <DesignSystemPersonas />
    </CanvasProviders>
  ),
  layout: { x: 14676, y: 0, width: 1280, height: 4800 },
};

export const Sound: TempoStoryboard = {
  name: "Sound Identity",
  render: () => (
    <CanvasProviders>
      <DesignSystemSound />
    </CanvasProviders>
  ),
  layout: { x: 16006, y: 0, width: 1280, height: 5400 },
};

export const DataViz: TempoStoryboard = {
  name: "Data Visualization",
  render: () => (
    <CanvasProviders>
      <DesignSystemDataViz />
    </CanvasProviders>
  ),
  layout: { x: 17336, y: 0, width: 1280, height: 6800 },
};

export const ComponentsAdvanced: TempoStoryboard = {
  name: "Components · Advanced",
  render: () => (
    <CanvasProviders>
      <DesignSystemComponentsAdvanced />
    </CanvasProviders>
  ),
  layout: { x: 18666, y: 0, width: 1280, height: 7200 },
};
