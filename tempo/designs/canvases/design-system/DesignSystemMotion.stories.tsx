import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemMotion from "./DesignSystemMotion";

const meta: Meta<typeof DesignSystemMotion> = {
  title: "Design System/Motion",
  component: DesignSystemMotion,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemMotion> = {};
