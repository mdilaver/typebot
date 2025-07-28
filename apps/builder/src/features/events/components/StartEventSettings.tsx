import { PlusIcon, TrashIcon } from "@/components/icons";
import { TextInput } from "@/components/inputs";
import { VariableSearchInput } from "@/components/inputs/VariableSearchInput";
import { useTypebot } from "@/features/editor/providers/TypebotProvider";
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Stack,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import type { StartEvent } from "@typebot.io/events/schemas";
import type { Variable } from "@typebot.io/variables/schemas";

type InitialDataMapping = {
  dataKey: string;
  variableId?: string;
  createNewVariable?: boolean;
  newVariableName?: string;
};

export const StartEventSettings = ({
  options,
  onOptionsChange,
}: {
  options: StartEvent["options"];
  onOptionsChange: (options: StartEvent["options"]) => void;
}) => {
  const { t } = useTranslate();
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const handleMappingsChange = (initialDataMappings: InitialDataMapping[]) => {
    onOptionsChange({
      ...options,
      initialDataMappings,
    });
  };

  const addMapping = () => {
    const newMapping: InitialDataMapping = {
      dataKey: "",
      variableId: undefined,
      createNewVariable: false,
      newVariableName: "",
    };

    handleMappingsChange([...(options?.initialDataMappings ?? []), newMapping]);
  };

  const removeMapping = (index: number) => {
    const currentMappings = options?.initialDataMappings ?? [];
    handleMappingsChange(currentMappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, updatedMapping: InitialDataMapping) => {
    const currentMappings = options?.initialDataMappings ?? [];
    const newMappings = [...currentMappings];
    newMappings[index] = updatedMapping;
    handleMappingsChange(newMappings);
  };

  return (
    <VStack spacing={3} p={3} align="stretch" maxW="400px" w="full">
      <VStack spacing={1} align="stretch">
        <Text fontSize="sm" fontWeight="semibold">
          {t("blocks.events.start.settings.title")}
        </Text>
        <Text fontSize="xs" color="gray.500" lineHeight="shorter">
          {t("blocks.events.start.settings.description")}
        </Text>
      </VStack>

      <VStack spacing={2} align="stretch">
        {(options?.initialDataMappings ?? []).map((mapping, index) => (
          <Box
            key={index}
            p={2}
            border="1px"
            borderColor={borderColor}
            borderRadius="md"
            bg={useColorModeValue("gray.50", "gray.700")}
          >
            <VStack spacing={2} align="stretch">
              <Flex justify="space-between" align="center">
                <Text fontSize="xs" fontWeight="medium" color="gray.600">
                  {t("blocks.events.start.settings.mapping.number", {
                    number: index + 1,
                  })}
                </Text>
                <IconButton
                  aria-label={t("blocks.events.start.settings.mapping.delete")}
                  icon={<TrashIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeMapping(index)}
                />
              </Flex>

              <VStack spacing={2} align="stretch">
                <Box>
                  <Text fontSize="xs" fontWeight="medium" mb={1}>
                    {t("blocks.events.start.settings.mapping.apiKey")}
                  </Text>
                  <TextInput
                    placeholder={t(
                      "blocks.events.start.settings.mapping.placeholder.apiKey",
                    )}
                    defaultValue={mapping.dataKey}
                    onChange={(dataKey) =>
                      updateMapping(index, { ...mapping, dataKey })
                    }
                    withVariableButton={false}
                    size="sm"
                  />
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="medium" mb={1}>
                    {t("blocks.events.start.settings.mapping.variable")}
                  </Text>
                  {mapping.createNewVariable ? (
                    <TextInput
                      placeholder={t(
                        "blocks.events.start.settings.mapping.placeholder.newVariable",
                      )}
                      defaultValue={mapping.newVariableName}
                      onChange={(newVariableName) =>
                        updateMapping(index, { ...mapping, newVariableName })
                      }
                      withVariableButton={false}
                      size="sm"
                    />
                  ) : (
                    <VariableSearchInput
                      initialVariableId={mapping.variableId}
                      onSelectVariable={(variable) =>
                        updateMapping(index, {
                          ...mapping,
                          variableId: variable?.id,
                          createNewVariable: false,
                          newVariableName: "",
                        })
                      }
                    />
                  )}
                </Box>
              </VStack>

              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  updateMapping(index, {
                    ...mapping,
                    createNewVariable: !mapping.createNewVariable,
                    variableId: mapping.createNewVariable
                      ? undefined
                      : mapping.variableId,
                  })
                }
                colorScheme={mapping.createNewVariable ? "blue" : "gray"}
                fontSize="xs"
              >
                {mapping.createNewVariable
                  ? t("blocks.events.start.settings.mapping.existingVariable")
                  : t("blocks.events.start.settings.mapping.newVariable")}
              </Button>
            </VStack>
          </Box>
        ))}

        <Button
          leftIcon={<PlusIcon />}
          onClick={addMapping}
          variant="outline"
          borderStyle="dashed"
          borderWidth="1px"
          p={3}
          h="auto"
          color="gray.500"
          fontSize="xs"
          _hover={{
            color: "blue.500",
            borderColor: "blue.500",
          }}
        >
          {t("blocks.events.start.settings.mapping.addNew")}
        </Button>
      </VStack>

      {(options?.initialDataMappings?.length ?? 0) > 0 && (
        <Box
          p={2}
          bg={useColorModeValue("blue.50", "blue.900")}
          borderRadius="md"
          border="1px"
          borderColor={useColorModeValue("blue.200", "blue.600")}
        >
          <Text
            fontSize="xs"
            color={useColorModeValue("blue.700", "blue.300")}
            lineHeight="shorter"
          >
            {t("blocks.events.start.settings.mapping.configured", {
              count: options?.initialDataMappings?.length ?? 0,
            })}
          </Text>
        </Box>
      )}
    </VStack>
  );
};
