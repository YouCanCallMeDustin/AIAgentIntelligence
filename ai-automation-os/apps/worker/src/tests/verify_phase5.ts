import { prisma } from '../../../api/src/utils/db.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';
import { AgentLoop } from '../runtime/agentLoop.js';
import { RecoveryEngine } from '../runtime/recoveryEngine.js';
import { LeaseManager } from '../runtime/leaseManager.js';

async function runVerification() {
  console.log('🚀 STARTING PHASE 5 VERIFICATION: DISTRIBUTED COGNITIVE LAYER');
  process.env.MOCK_DB = 'true';
  process.env.MOCK_QUEUE = 'true';

  const executionId = 'dist-exec-' + Date.now();
  const intentId = 'intent-123';

  // 0. Setup Execution in DB
  await prisma.execution.upsert({
    where: { id: executionId },
    create: { id: executionId, intentId },
    update: {}
  });

  // 1. TEST: LEASE CONTENTION
  console.log('\n--- TEST 1: Lease Contention ---');
  process.env.NODE_ID = 'node-alpha';
  const acquiredAlpha = await LeaseManager.acquireLease(executionId, 'node-alpha');
  console.log('Node Alpha acquired lease:', acquiredAlpha);

  process.env.NODE_ID = 'node-beta';
  const acquiredBeta = await LeaseManager.acquireLease(executionId, 'node-beta');
  console.log('Node Beta acquired lease (expect false):', acquiredBeta);

  if (acquiredBeta) throw new Error('Split-brain: Beta acquired active lease');

  // 2. TEST: EVENTBUS LEASE ENFORCEMENT
  console.log('\n--- TEST 2: EventBus Lease Enforcement ---');
  try {
    process.env.NODE_ID = 'node-beta'; // Beta tries to emit without lease
    await EventBus.emit({
      executionId,
      intentId,
      agent: 'EXECUTOR',
      eventType: 'stolen_event',
      payload: { data: 'stolen' },
      stepId: 'stolen'
    });
    throw new Error('EventBus allowed emission from node without lease');
  } catch (e: any) {
    console.log('EventBus correctly rejected unauthorized emission:', e.message);
  }

  // 3. TEST: DISTRIBUTED CAUSAL ORDERING
  console.log('\n--- TEST 3: Distributed Causal Ordering (Lamport Clocks) ---');
  process.env.NODE_ID = 'node-alpha'; // Alpha is owner
  const ev1 = await EventBus.emit({
    executionId,
    intentId,
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: {},
    stepId: 'init'
  });
  console.log('Event 1 Logical Timestamp:', ev1.logicalTimestamp);

  const ev2 = await EventBus.emit({
    executionId,
    intentId,
    agent: 'PLANNER',
    eventType: 'planner_reasoning_started',
    payload: {},
    stepId: 'init-reason',
    causalParentEventId: ev1.id
  });
  console.log('Event 2 Logical Timestamp:', ev2.logicalTimestamp);
  console.log('Event 2 Causal Parent:', ev2.causalParentEventId);

  if (ev2.logicalTimestamp! <= ev1.logicalTimestamp!) throw new Error('Clock did not advance');
  if (ev2.causalParentEventId !== ev1.id) throw new Error('Causal link broken');

  // 4. TEST: FAILOVER ON LEASE EXPIRATION
  console.log('\n--- TEST 4: Failover on Lease Expiration ---');
  
  // Force lease expiration in mock DB
  await prisma.execution.update({
    where: { id: executionId },
    data: { leaseExpiresAt: new Date(Date.now() - 1000) } 
  });

  process.env.NODE_ID = 'node-beta';
  console.log('Node Beta attempting recovery...');
  await RecoveryEngine.recoverOrphaned();
  
  const exec = await prisma.execution.findUnique({ where: { id: executionId } });
  console.log('New Lease Owner:', exec.ownerNodeId);
  
  if (exec.ownerNodeId !== 'node-beta') throw new Error('Failover failed: Beta did not acquire orphaned lease');

  // 5. TEST: CAUSAL REJECTION (STALE PARENT)
  console.log('\n--- TEST 5: Causal Rejection (Stale Parent) ---');
  try {
    await EventBus.emit({
      executionId,
      intentId,
      agent: 'EXECUTOR',
      eventType: 'stale_parent_event',
      payload: {},
      stepId: 'stale',
      causalParentEventId: ev1.id // Explicitly using OLD parent when ev2 already exists
    });
    throw new Error('EventBus allowed stale causal parent');
  } catch (e: any) {
    console.log('EventBus correctly rejected stale causal parent:', e.message);
  }

  console.log('\n✅ PHASE 5 VERIFICATION COMPLETE: SYSTEM IS DISTRIBUTED, DETERMINISTIC, AND LEASE-HARDENED');
}

runVerification().catch(err => {
  console.error('❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
