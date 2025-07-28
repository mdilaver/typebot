import { Text } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { EventType } from "@typebot.io/events/constants";
import type { TEvent } from "@typebot.io/events/schemas";

type Props = {
  event: TEvent;
};

export const EventNodeContent = ({ event }: Props) => {
  const { t } = useTranslate();

  if (event.type === EventType.START) {
    const hasMappings =
      event.options?.initialDataMappings &&
      event.options.initialDataMappings.length > 0;
    const mappingCount = event.options?.initialDataMappings?.length ?? 0;
    const mappingText =
      mappingCount === 1
        ? t("blocks.events.start.mappingBadge")
        : t("blocks.events.start.mappingBadge.plural");

    return (
      <Text
        fontSize="sm"
        noOfLines={1}
        flex="1"
        display="flex"
        alignItems="center"
        gap={2}
      >
        {t("blocks.events.start.node.label")}
        {hasMappings && (
          <Text
            as="span"
            fontSize="xs"
            bg="blue.100"
            color="blue.700"
            px={1.5}
            py={0.5}
            borderRadius="md"
          >
            {mappingCount} {mappingText}
          </Text>
        )}
      </Text>
    );
  }

  return (
    <Text fontSize="sm" noOfLines={1} flex="1">
      {event.type === EventType.COMMAND &&
        t("blocks.events.command.node.label")}
      {event.type === EventType.REPLY && t("blocks.events.reply.node.prefix")}
      {event.type === EventType.INVALID_REPLY &&
        t("blocks.events.invalidReply.node.prefix")}
    </Text>
  );
};
