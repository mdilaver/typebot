import { useDisclosure } from "@chakra-ui/react";
import type { ForgedBlockDefinition } from "@typebot.io/forge-repository/definitions";
import type { User } from "@typebot.io/user/schemas";
import { useEffect } from "react";
import { onboardingVideos } from "../data";

type Props = {
  key?: keyof typeof onboardingVideos;
  updateUser: (data: Partial<User>) => void;
  user?: Pick<User, "createdAt" | "displayedInAppNotifications">;
  defaultOpenDelay?: number;
  blockDef: ForgedBlockDefinition | undefined;
  isEnabled?: boolean;
};

export const useOnboardingDisclosure = ({
  key,
  updateUser,
  user,
  defaultOpenDelay,
  blockDef,
  isEnabled = true,
}: Props) => {
  const { isOpen, onOpen, onClose: onCloseDisclosure } = useDisclosure();

  const onClose = async () => {
    onCloseDisclosure();
    if (!user || !key || user.displayedInAppNotifications?.[key]) return;
    await updateUser({
      displayedInAppNotifications: {
        ...user.displayedInAppNotifications,
        [key]: true,
      },
    });
  };

  useEffect(() => {
    if (!user || !key || !isEnabled) return;

    const video = onboardingVideos[key];

    if (
      video &&
      (!video.deployedAt ||
        new Date(user.createdAt) >=
          (video.deployedAt ??
            blockDef?.onboarding?.deployedAt ??
            new Date())) &&
      user.displayedInAppNotifications?.[key] === undefined
    ) {
      const timeoutId = setTimeout(() => {
        onOpen();
      }, defaultOpenDelay);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    blockDef?.onboarding?.deployedAt,
    defaultOpenDelay,
    key,
    onOpen,
    user,
    isEnabled,
  ]);

  return { isOpen, onClose, onOpen };
};
