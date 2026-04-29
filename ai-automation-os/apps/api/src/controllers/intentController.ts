import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../utils/db.js';
import { z } from 'zod';

const IntentSchema = z.object({
  intent: z.string(),
  constraints: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  organizationId: z.string(),
});

export class IntentController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = IntentSchema.parse(request.body);
    
    const intent = await prisma.intent.create({
      data: {
        intent: data.intent,
        constraints: data.constraints,
        successCriteria: data.successCriteria,
        organizationId: data.organizationId,
      },
    });

    return reply.status(201).send(intent);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { orgId } = request.query as { orgId: string };
    const intents = await prisma.intent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return intents;
  }
}
