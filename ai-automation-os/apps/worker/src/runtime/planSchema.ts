import { z } from 'zod';

export const PlanStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  args: z.record(z.any()),
  description: z.string().optional(),
});

export const PlanSchema = z.object({
  steps: z.array(PlanStepSchema),
  strategy: z.enum(['sequential', 'parallel']).default('sequential'),
  reasoning: z.string().optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
