import { TrashIcon } from "@/components/icons";
import { VariableSearchInput } from "@/components/inputs/VariableSearchInput";
import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { DataVariable } from "@typebot.io/blocks-bubbles/data/schema";

type Props = {
  variable: DataVariable;
  onVariableChange: (variable: DataVariable) => void;
  onDelete: () => void;
};

export const DataVariableItem = ({
  variable,
  onVariableChange,
  onDelete,
}: Props) => {
  const { t } = useTranslate();
  const mode = variable.mode || "variable";
  const isCustomMode = mode === "custom";

  const handleModeChange = (checked: boolean) => {
    const newMode = checked ? "custom" : "variable";
    onVariableChange({
      ...variable,
      mode: newMode,
      // Clear opposite mode fields
      variableId: newMode === "variable" ? variable.variableId : undefined,
      customKey: newMode === "custom" ? variable.customKey : undefined,
      value: newMode === "custom" ? variable.value : undefined, // Keep value for custom mode, clear for variable mode
    });
  };

  const handleVariableSelect = (
    selectedVariable: { id: string; name: string } | undefined,
  ) => {
    onVariableChange({
      ...variable,
      variableId: selectedVariable?.id,
    });
  };

  const handleCustomKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVariableChange({
      ...variable,
      customKey: e.target.value,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVariableChange({
      ...variable,
      value: e.target.value,
    });
  };

  return (
    <VStack
      spacing={4}
      p={4}
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      align="stretch"
    >
      {/* Mode Toggle */}
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium">
          {t("editor.blocks.bubbles.data.dataSource")}
        </FormLabel>
        <HStack spacing={3}>
          <Switch
            isChecked={isCustomMode}
            onChange={(e) => handleModeChange(e.target.checked)}
            size="sm"
          />
          <Text fontSize="sm" color="gray.600">
            {isCustomMode
              ? t("editor.blocks.bubbles.data.customField")
              : t("editor.blocks.bubbles.data.existingVariable")}
          </Text>
        </HStack>
      </FormControl>

      {/* Variable Mode */}
      {!isCustomMode && (
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium">
            {t("editor.blocks.bubbles.data.variableToInclude")}
          </FormLabel>
          <HStack spacing={3}>
            <VariableSearchInput
              initialVariableId={variable.variableId}
              onSelectVariable={handleVariableSelect}
              placeholder={t(
                "editor.blocks.bubbles.data.selectVariablePlaceholder",
              )}
              flex={1}
            />

            <Button
              variant="ghost"
              colorScheme="red"
              size="sm"
              onClick={onDelete}
              aria-label="Delete variable"
            >
              <TrashIcon />
            </Button>
          </HStack>

          {variable.variableId && (
            <Text fontSize="xs" color="gray.500" mt={2}>
              {t("editor.blocks.bubbles.data.currentValueNote")}
            </Text>
          )}
        </FormControl>
      )}

      {/* Custom Field Mode */}
      {isCustomMode && (
        <>
          <FormControl>
            <FormLabel fontSize="sm" fontWeight="medium">
              {t("editor.blocks.bubbles.data.customFieldName")}
            </FormLabel>
            <HStack spacing={3}>
              <Input
                placeholder={t(
                  "editor.blocks.bubbles.data.customFieldNamePlaceholder",
                )}
                value={variable.customKey || ""}
                onChange={handleCustomKeyChange}
                size="sm"
                flex={1}
              />

              <Button
                variant="ghost"
                colorScheme="red"
                size="sm"
                onClick={onDelete}
                aria-label="Delete variable"
              >
                <TrashIcon />
              </Button>
            </HStack>
          </FormControl>

          {variable.customKey && (
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium">
                {t("editor.blocks.bubbles.data.fieldValue")}
              </FormLabel>
              <Input
                placeholder={t(
                  "editor.blocks.bubbles.data.fieldValuePlaceholder",
                )}
                value={variable.value || ""}
                onChange={handleValueChange}
                size="sm"
              />
            </FormControl>
          )}
        </>
      )}
    </VStack>
  );
};
