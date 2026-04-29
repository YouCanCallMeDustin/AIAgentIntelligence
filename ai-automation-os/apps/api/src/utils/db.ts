import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

if (process.env.MOCK_DB === 'true') {
  const mockEvents: any[] = [];
  const mockExecutions: any[] = [];

  prismaInstance = {
    eventLog: {
      create: async ({ data }: any) => {
        const lastEvent = [...mockEvents]
          .filter(e => e.executionId === data.executionId)
          .sort((a, b) => (b.logicalTimestamp || 0) - (a.logicalTimestamp || 0))[0];
        const sequenceNum = (lastEvent?.sequenceNum || 0) + 1;
        const event = { 
          ...data, 
          sequenceNum, 
          id: `evt-${Math.random().toString(36).substring(2, 7)}`, 
          timestamp: new Date() 
        };
        mockEvents.push(event);
        return event;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let filtered = mockEvents.filter(e => e.executionId === where.executionId);
        if (where.eventType) {
          filtered = filtered.filter(e => e.eventType === where.eventType);
        }
        return filtered.sort((a, b) => (b.logicalTimestamp || 0) - (a.logicalTimestamp || 0))[0] || null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let filtered = mockEvents.filter(e => e.executionId === where.executionId);
        // Basic sort
        return filtered.sort((a, b) => (a.logicalTimestamp || 0) - (b.logicalTimestamp || 0));
      }
    },
    execution: {
      upsert: async ({ where, update, create }: any) => {
        let exec = mockExecutions.find(e => e.id === where.id);
        if (exec) {
          Object.assign(exec, update);
          return exec;
        }
        const newExec = { ...create, id: where.id };
        mockExecutions.push(newExec);
        return newExec;
      },
      update: async ({ where, data }: any) => {
        let exec = mockExecutions.find(e => e.id === where.id);
        if (!exec) throw new Error('Not found');
        
        // Handle conditional updates for lease enforcement if needed
        if (where.ownerNodeId && exec.ownerNodeId !== where.ownerNodeId) {
           throw new Error('Lease mismatch');
        }

        Object.assign(exec, data);
        return exec;
      },
      findUnique: async ({ where }: any) => {
        return mockExecutions.find(e => e.id === where.id) || null;
      },
      findMany: async ({ where }: any) => {
        let filtered = [...mockExecutions];
        if (where?.AND) {
           // Simple simulation of orphaned scan
           const now = new Date();
           filtered = filtered.filter(e => e.ownerNodeId !== null && e.leaseExpiresAt < now);
        }
        return filtered;
      }
    },
    intent: {
      create: async ({ data }: any) => data
    }
  } as any;
} else {
  prismaInstance = globalForPrisma.prisma ||
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
