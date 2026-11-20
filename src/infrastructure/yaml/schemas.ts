import { z } from 'zod';
import { TAG_IDS } from '../../domain/tags';
import { isIsoTimestamp } from '../../domain/validation';
import { PRIORITIES } from '../../domain/types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const requiredText = (message: string) =>
  z.string().refine((value) => value.trim().length > 0, { message });

export const uuidSchema = z
  .string()
  .regex(UUID_PATTERN, 'Identifier must be a valid UUID.');

export const columnIdSchema = z
  .string()
  .regex(COLUMN_ID_PATTERN, 'Column ID must contain only lowercase letters, digits and hyphens.');

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Color must be a six-digit hexadecimal value such as #64748b.');

export const isoTimestampSchema = z
  .string()
  .refine(isIsoTimestamp, 'Timestamp must be a valid ISO 8601 UTC value.');

export const positionSchema = z
  .number()
  .int('Position must be an integer.')
  .nonnegative('Position must be a non-negative integer.');

export const checklistItemSchema = z
  .object({
    id: uuidSchema,
    text: requiredText('Checklist item text is required.'),
    completed: z.boolean(),
    position: positionSchema,
  })
  .passthrough();

export const checklistSchema = z
  .object({
    id: uuidSchema,
    title: requiredText('Checklist title is required.'),
    position: positionSchema,
    items: z.array(checklistItemSchema),
  })
  .passthrough()
  .superRefine((checklist, context) => {
    const itemIds = new Set<string>();
    checklist.items.forEach((item, index) => {
      if (itemIds.has(item.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate checklist item ID: ${item.id}`,
          path: ['items', index, 'id'],
        });
      }
      itemIds.add(item.id);
    });
  });

export const taskSchema = z
  .object({
    id: uuidSchema,
    title: requiredText('Task title is required.'),
    description: z.string().optional(),
    tags: z.array(z.string()),
    priority: z.enum(PRIORITIES),
    position: positionSchema,
    checklists: z.array(checklistSchema),
    dueAt: isoTimestampSchema.optional(),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .passthrough()
  .superRefine((task, context) => {
    const tags = new Set<string>();
    task.tags.forEach((tag, index) => {
      if (!(TAG_IDS as readonly string[]).includes(tag)) {
        context.addIssue({
          code: 'custom',
          message: `Unsupported tag: ${tag}`,
          path: ['tags', index],
        });
      } else if (tags.has(tag)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate tag: ${tag}`,
          path: ['tags', index],
        });
      }
      tags.add(tag);
    });

    const checklistIds = new Set<string>();
    task.checklists.forEach((checklist, index) => {
      if (checklistIds.has(checklist.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate checklist ID: ${checklist.id}`,
          path: ['checklists', index, 'id'],
        });
      }
      checklistIds.add(checklist.id);
    });
  });

export const boardSchema = z
  .object({
    version: z.literal(1),
    name: requiredText('Board name is required.'),
    columns: z
      .array(columnIdSchema)
      .min(1, 'A board must have at least one column.')
      .superRefine((columns, context) => {
        const seen = new Set<string>();
        columns.forEach((column, index) => {
          if (seen.has(column)) {
            context.addIssue({
              code: 'custom',
              message: `Duplicate column reference: ${column}`,
              path: ['columns', index],
            });
          }
          seen.add(column);
        });
      }),
  })
  .passthrough();

export const columnSchema = z
  .object({
    id: columnIdSchema,
    title: requiredText('Column title is required.'),
    color: colorSchema,
    position: positionSchema.optional(),
  })
  .passthrough();
