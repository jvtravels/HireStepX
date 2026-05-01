import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemVoice from "./DesignSystemVoice";

const meta: Meta<typeof DesignSystemVoice> = {
  title: "Design System/Voice & Tone",
  component: DesignSystemVoice,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemVoice> = {};
