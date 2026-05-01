import type { Meta, StoryObj } from "@storybook/react";
import DesignSystemBrandStory from "./DesignSystemBrandStory";

const meta: Meta<typeof DesignSystemBrandStory> = {
  title: "Design System/Brand Story",
  component: DesignSystemBrandStory,
  parameters: { layout: "fullscreen" },
};
export default meta;

export const Default: StoryObj<typeof DesignSystemBrandStory> = {};
