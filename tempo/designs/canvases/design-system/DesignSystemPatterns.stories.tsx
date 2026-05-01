import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemPatterns from "./DesignSystemPatterns";

const meta: Meta<typeof DesignSystemPatterns> = {
  title: "Design System/Patterns",
  component: DesignSystemPatterns,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemPatterns> = {};
