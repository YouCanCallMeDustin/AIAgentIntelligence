import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../utils/db.js';

/**
 * Real-time reasoning event stream for the Mission Control UI.
 * Strictly adheres to the Phase 5 Event Consumption Contract.
 */
export class StreamController {
  static async stream(request: FastifyRequest, reply: FastifyReply) {
    const { executionId } = request.params as { executionId: string };

    // SSE Header setup
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    let lastSequenceNum = 0;

    // Helper to send formatted event
    const sendEvent = (event: any) => {
      const contractEvent = {
        executionId: event.executionId,
        nodeId: event.nodeId,
        logicalTimestamp: event.logicalTimestamp,
        agent: event.agent,
        eventType: event.eventType,
        payload: event.payload,
        causalParentEventId: event.causalParentEventId
      };

      reply.raw.write(`id: ${event.id}\n`);
      reply.raw.write(`event: ${event.eventType}\n`);
      reply.raw.write(`data: ${JSON.stringify(contractEvent)}\n\n`);
    };

    // 1. Send History (Catch up)
    const history = await prisma.eventLog.findMany({
      where: { executionId },
      orderBy: { sequenceNum: 'asc' },
    });

    for (const event of history) {
      sendEvent(event);
      lastSequenceNum = Math.max(lastSequenceNum, event.sequenceNum);
    }

    // 2. Poll for new events (Distributed simulation)
    const interval = setInterval(async () => {
      const newEvents = await prisma.eventLog.findMany({
        where: { 
          executionId,
          sequenceNum: { gt: lastSequenceNum }
        },
        orderBy: { sequenceNum: 'asc' }
      });

      for (const event of newEvents) {
        sendEvent(event);
        lastSequenceNum = Math.max(lastSequenceNum, event.sequenceNum);
      }
    }, 1000);

    // Cleanup on close
    request.raw.on('close', () => {
      clearInterval(interval);
    });
  }
}
