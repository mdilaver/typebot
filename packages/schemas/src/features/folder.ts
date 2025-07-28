import type { Prisma } from "@typebot.io/prisma/types";
import { z } from "@typebot.io/zod";

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
  initialDataMappings: z.array(initialDataMappingSchema).optional(),
}) satisfies z.ZodType<Prisma.DashboardFolder>;

export type Folder = z.infer<typeof folderSchema>;
export type InitialDataMapping = z.infer<typeof initialDataMappingSchema>;
