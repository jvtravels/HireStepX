import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemPersonas from "./DesignSystemPersonas";

const meta: Meta<typeof DesignSystemPersonas> = {
  title: "Design System/Personas",
  component: DesignSystemPersonas,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemPersonas> = {};
