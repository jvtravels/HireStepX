import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemDataViz from "./DesignSystemDataViz";

const meta: Meta<typeof DesignSystemDataViz> = {
  title: "Design System/Data Visualization",
  component: DesignSystemDataViz,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemDataViz> = {};
