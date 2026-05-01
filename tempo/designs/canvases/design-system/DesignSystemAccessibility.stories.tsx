import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemAccessibility from "./DesignSystemAccessibility";

const meta: Meta<typeof DesignSystemAccessibility> = {
  title: "Design System/Accessibility",
  component: DesignSystemAccessibility,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemAccessibility> = {};
