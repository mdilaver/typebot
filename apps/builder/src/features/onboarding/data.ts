import type { BubbleBlockType } from "@typebot.io/blocks-bubbles/constants";
import type { Block } from "@typebot.io/blocks-core/schemas/schema";
import { IntegrationBlockType } from "@typebot.io/blocks-integrations/constants";
import type { TEventWithOptions } from "@typebot.io/events/schemas";

// Exclude BubbleBlockType.DATA since it doesn't have onboarding videos
type Feature =
  | "editor"
  | "groupTitlesAutoGeneration"
  | Exclude<Block["type"], BubbleBlockType.DATA>
  | TEventWithOptions["type"];

type OnboardingVideoData = {
  key: string;
  youtubeId: string;
  deployedAt?: Date;
};

// Simple and clean - optional access handles undefined
export const onboardingVideos: Record<string, OnboardingVideoData> = {
  editor: {
    key: "editor",
    youtubeId: "jp3ggg_42-M",
    deployedAt: new Date("2024-06-04"),
  },
  groupTitlesAutoGeneration: {
    key: "groupTitlesAutoGeneration",
    youtubeId: "Lt7UliKv0xQ",
  },
  [IntegrationBlockType.ZAPIER]: {
    key: IntegrationBlockType.ZAPIER,
    youtubeId: "2ZskGItI_Zo",
    deployedAt: new Date("2024-06-04"),
  },
  [IntegrationBlockType.MAKE_COM]: {
    key: IntegrationBlockType.MAKE_COM,
    youtubeId: "V-y1Orys_kY",
    deployedAt: new Date("2024-06-04"),
  },
};

export type { Feature, OnboardingVideoData };
