import type { ForgedBlockDefinition } from "@typebot.io/forge-repository/definitions";
import { isDefined } from "@typebot.io/lib/utils";
import type { Feature } from "../data";
import { onboardingVideos } from "../data";

type Props = {
  nodeType: Feature;
  blockDef?: ForgedBlockDefinition;
};

export const hasOnboardingVideo = ({ nodeType, blockDef }: Props) => {
  const video = onboardingVideos[nodeType];
  return isDefined(blockDef?.onboarding?.youtubeId ?? video?.youtubeId);
};
