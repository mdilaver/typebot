import { blockBaseSchema } from "@typebot.io/blocks-base/schemas";
import { z } from "@typebot.io/zod";
import { BubbleBlockType } from "../constants";

export const dataVariableSchema = z.object({
  mode: z.enum(["variable", "custom"]).optional().default("variable"),
  // Variable mode fields
  variableId: z.string().optional(),
  // Custom field mode fields
  customKey: z.string().optional(),
  // Common field
  value: z.string().optional(),
});

export const dataBubbleContentSchema = z.object({
  variables: z.array(dataVariableSchema).optional(),
});

export const dataBubbleBlockSchema = blockBaseSchema
  .merge(
    z.object({
      type: z.enum([BubbleBlockType.DATA]),
      content: dataBubbleContentSchema.optional(),
    }),
  )
  .openapi({
    title: "Data",
    ref: `dataBlock`,
  });

export type DataBubbleBlock = z.infer<typeof dataBubbleBlockSchema>;
export type DataVariable = z.infer<typeof dataVariableSchema>;
