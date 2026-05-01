import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemTypography from "./DesignSystemTypography";

const meta: Meta<typeof DesignSystemTypography> = {
  title: "Design System/Typography",
  component: DesignSystemTypography,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemTypography> = {};
