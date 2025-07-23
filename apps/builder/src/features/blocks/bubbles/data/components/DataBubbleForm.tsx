import { PlusIcon } from "@/components/icons";
import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type {
  DataBubbleBlock,
  DataVariable,
} from "@typebot.io/blocks-bubbles/data/schema";
import { DataVariableItem } from "./DataVariableItem";

type Props = {
  block: DataBubbleBlock;
  onContentChange: (content: DataBubbleBlock["content"]) => void;
};

export const DataBubbleForm = ({ block, onContentChange }: Props) => {
  const { t } = useTranslate();
  const variables = block.content?.variables || [];

  const addVariable = () => {
    const newVariable: DataVariable = {
      mode: "variable", // Default to variable mode
      variableId: undefined,
      customKey: undefined,
      value: undefined,
    };

    onContentChange({
      variables: [...variables, newVariable],
    });
  };

  const updateVariable = (index: number, variable: DataVariable) => {
    const updatedVariables = variables.map((v, i) =>
      i === index ? variable : v,
    );
    onContentChange({
      variables: updatedVariables,
    });
  };

  const deleteVariable = (index: number) => {
    const updatedVariables = variables.filter((_, i) => i !== index);
    onContentChange({
      variables: updatedVariables,
    });
  };

  return (
    <Stack spacing={6}>
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={2}>
          {t("editor.blocks.bubbles.data.title")}
        </Text>
        <Text fontSize="sm" color="gray.600">
          {t("editor.blocks.bubbles.data.description")}
        </Text>
      </Box>

      <Stack spacing={4}>
        {variables.map((variable, index) => (
          <DataVariableItem
            key={index}
            variable={variable}
            onVariableChange={(variable) => updateVariable(index, variable)}
            onDelete={() => deleteVariable(index)}
          />
        ))}

        <Button
          leftIcon={<PlusIcon />}
          variant="outline"
          colorScheme="blue"
          onClick={addVariable}
          size="sm"
        >
          {t("editor.blocks.bubbles.data.addButton")}
        </Button>
      </Stack>
    </Stack>
  );
};
