import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemColor from "./DesignSystemColor";

const meta: Meta<typeof DesignSystemColor> = {
  title: "Design System/Color",
  component: DesignSystemColor,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemColor> = {};
