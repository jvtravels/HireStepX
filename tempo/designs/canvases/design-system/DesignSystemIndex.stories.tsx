import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemIndex from "./DesignSystemIndex";

const meta: Meta<typeof DesignSystemIndex> = {
  title: "Design System/Index · Cover",
  component: DesignSystemIndex,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemIndex> = {};
