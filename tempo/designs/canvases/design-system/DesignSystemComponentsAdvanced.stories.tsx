import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemComponentsAdvanced from "./DesignSystemComponentsAdvanced";

const meta: Meta<typeof DesignSystemComponentsAdvanced> = {
  title: "Design System/Components · Advanced",
  component: DesignSystemComponentsAdvanced,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemComponentsAdvanced> = {};
