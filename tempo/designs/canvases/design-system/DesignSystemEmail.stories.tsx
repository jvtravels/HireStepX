import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemEmail from "./DesignSystemEmail";

const meta: Meta<typeof DesignSystemEmail> = {
  title: "Design System/Email",
  component: DesignSystemEmail,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemEmail> = {};
