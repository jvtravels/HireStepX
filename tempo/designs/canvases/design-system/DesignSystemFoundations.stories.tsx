import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemFoundations from "./DesignSystemFoundations";

const meta: Meta<typeof DesignSystemFoundations> = {
  title: "Design System/Foundations",
  component: DesignSystemFoundations,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemFoundations> = {};
