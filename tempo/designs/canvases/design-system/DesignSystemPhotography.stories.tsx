import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemPhotography from "./DesignSystemPhotography";

const meta: Meta<typeof DesignSystemPhotography> = {
  title: "Design System/Photography",
  component: DesignSystemPhotography,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemPhotography> = {};
