import { z } from "zod";

const timezone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone");

export const createWorkspaceSchema = z.strictObject({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: timezone.default("UTC"),
});

export const updateWorkspaceSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(160).optional(),
    timezone: timezone.optional(),
  })
  .refine((value) => value.name !== undefined || value.timezone !== undefined, "Provide a field to update");

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
