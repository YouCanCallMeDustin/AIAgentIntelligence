import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../utils/db.js';

export class StreamController {
  /**
   * Real-time reasoning event stream for the Mission Control UI.
   * Derived from the EventLog append-only source of truth.
   */
  static async stream(request: FastifyRequest, reply: FastifyReply) {
    const { executionId } = request.params as { executionId: string };

    // Set headers for SSE
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    // Send initial history for replayability (Source of Truth)
    const history = await prisma.eventLog.findMany({
      where: { executionId },
      orderBy: { sequenceNum: 'asc' },
    });

    for (const event of history) {
      reply.sse({
        id: event.id,
        event: event.eventType,
        data: event,
      });
    }

    // In a real implementation, we would subscribe to a Redis Pub/Sub here
    // to push new events as they are emitted by the EventBus.
    // For now, we'll simulate a long-polling or just close after history
    // since we are focusing on the architecture.
    
    // NOTE: Strict Event Contract is maintained here.
  }
}
