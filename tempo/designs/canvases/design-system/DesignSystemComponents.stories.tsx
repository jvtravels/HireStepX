import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemComponents from "./DesignSystemComponents";

const meta: Meta<typeof DesignSystemComponents> = {
  title: "Design System/Components",
  component: DesignSystemComponents,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemComponents> = {};
