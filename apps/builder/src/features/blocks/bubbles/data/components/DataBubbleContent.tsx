import { Text } from "@chakra-ui/react";
import type { DataBubbleBlock } from "@typebot.io/blocks-bubbles/data/schema";

type Props = {
  block: DataBubbleBlock;
};

export const DataBubbleContent = ({ block }: Props) => {
  const variableCount = block.content?.variables?.length || 0;

  return (
    <Text color="gray.500" fontSize="sm">
      {variableCount === 0
        ? "Click to add variables"
        : `${variableCount} variable${variableCount > 1 ? "s" : ""} configured`}
    </Text>
  );
};
