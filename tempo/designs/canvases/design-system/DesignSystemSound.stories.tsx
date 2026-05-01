import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemSound from "./DesignSystemSound";

const meta: Meta<typeof DesignSystemSound> = {
  title: "Design System/Sound",
  component: DesignSystemSound,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemSound> = {};
