import type { Prisma } from "@typebot.io/prisma/types";
import { z } from "@typebot.io/zod";

const variableTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["text", "number", "boolean"]).default("text"),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
});

const initialDataMappingSchema = z.object({
  dataKey: z.string(),
  variableId: z.string().optional(),
  createNewVariable: z.boolean().optional(),
  newVariableName: z.string().optional(),
});

export const folderSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  parentFolderId: z.string().nullable(),
  workspaceId: z.string(),
  variableTemplates: z.array(variableTemplateSchema).optional(),
  initialDataMappings: z.array(initialDataMappingSchema).optional(),
}) satisfies z.ZodType<Prisma.DashboardFolder>;

export type Folder = z.infer<typeof folderSchema>;
export type VariableTemplate = z.infer<typeof variableTemplateSchema>;
export type InitialDataMapping = z.infer<typeof initialDataMappingSchema>;
