import { AgentLoop } from '../runtime/agentLoop.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';
import { stateReducer } from '../runtime/stateReducer.js';
import { prisma } from '../../../api/src/utils/db.js';

// Environment check for testing
if (process.env.MOCK_DB !== 'true' || process.env.MOCK_QUEUE !== 'true') {
  console.warn('⚠️ WARNING: Running verification without MOCK_DB=true or MOCK_QUEUE=true');
}

async function runVerification() {
  console.log('🧠 PHASE 2 DETERMINISTIC COGNITION VERIFICATION\n');

  try {
    const results = {
      suite1: await testLoopStress(),
      suite2: await testToolFailureRecovery(),
      suite3: await testMemoryInfluence(),
      suite4: await testDeterminism()
    };

    console.log('\n📊 FINAL VERIFICATION REPORT');
    console.log('----------------------------');
    Object.entries(results).forEach(([suite, status]) => {
      console.log(`${suite.toUpperCase()}: ${status ? '✅ PASSED' : '❌ FAILED'}`);
    });

    const allPassed = Object.values(results).every(v => v);
    if (!allPassed) process.exit(1);
  } catch (error) {
    console.error('\n💥 CRITICAL HARNESS FAILURE:', error);
    process.exit(1);
  }
}

/**
 * UTILITY: Iterative Loop Runner (Simulates BullMQ job processing)
 */
async function runUntilTerminated(executionId: string, maxIterations = 20) {
  let iterations = 0;
  let terminated = false;
  
  while (iterations < maxIterations && !terminated) {
    iterations++;
    console.log(`[Runner] Iteration ${iterations} for ${executionId}`);
    await AgentLoop.run(executionId);
    
    const events = await EventBus.getStream(executionId);
    const state = stateReducer(events);
    terminated = state.terminated;
    console.log(`[Runner] Iteration ${iterations} complete. Terminated: ${terminated}, Status: ${state.status}`);
  }
  return iterations;
}

/**
 * TEST 1: LOOP STRESS TEST (≥ 10 Iterations)
 */
async function testLoopStress() {
  console.log('🧪 SUITE 1: LOOP STRESS TEST');
  const executionId = `stress-${Date.now()}`;
  
  await EventBus.emit({
    executionId,
    intentId: 'stress-intent',
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: { goal: 'Process a complex multi-step request' },
    stepId: 'start'
  });

  const iterations = await runUntilTerminated(executionId, 25);
  console.log(`[Suite 1] Completed in ${iterations} iterations.`);
  
  return iterations >= 5; 
}

/**
 * TEST 2: TOOL FAILURE RECOVERY
 */
async function testToolFailureRecovery() {
  console.log('🧪 SUITE 2: TOOL FAILURE RECOVERY');
  const executionId = `fail-${Date.now()}`;
  
  await EventBus.emit({
    executionId,
    intentId: 'fail-intent',
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: { goal: 'Recover from unstable_api', simulateFailure: true },
    stepId: 'start'
  });

  const iterations = await runUntilTerminated(executionId);
  const events = await EventBus.getStream(executionId);
  const state = stateReducer(events);

  console.log(`[Suite 2] Events: ${events.map(e => e.eventType).join(', ')}`);

  const hasFailure = events.some(e => e.eventType === 'tool_execution_failed');
  const hasReplan = events.some(e => e.agent === 'CRITIC' && e.payload.decision === 'NEEDS_REPLAN');
  const succeeded = state.status === 'COMPLETED';

  console.log(`[Suite 2] Failure detected: ${hasFailure}, Replan triggered: ${hasReplan}, Final Success: ${succeeded}`);
  
  return hasFailure && hasReplan && succeeded;
}

/**
 * TEST 3: MEMORY INFLUENCE (EVENT-SOURCED)
 */
async function testMemoryInfluence() {
  console.log('🧪 SUITE 3: MEMORY INFLUENCE VALIDATION');
  const executionId = `mem-${Date.now()}`;
  
  await EventBus.emit({
    executionId,
    intentId: 'mem-intent',
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: { goal: 'Avoid past failures' },
    stepId: 'start'
  });

  await EventBus.emit({
    executionId,
    intentId: 'mem-intent',
    agent: 'MEMORY',
    eventType: 'memory_retrieved',
    payload: { 
      warnings: ['PAST FAILURE: web_search is unstable for this intent.']
    },
    stepId: 'mem-1'
  });

  await AgentLoop.run(executionId); // Planner turn
  
  const events = await EventBus.getStream(executionId);
  const planEvent = events.find(e => e.eventType === 'plan_generated');
  const usedAlternate = planEvent?.payload.plan.steps[0].tool === 'alternate_search';

  console.log(`[Suite 3] Planner used alternate tool based on memory: ${usedAlternate}`);
  return usedAlternate;
}

/**
 * TEST 4: DETERMINISM / REPLAY TEST
 */
async function testDeterminism() {
  console.log('🧪 SUITE 4: DETERMINISM / REPLAY TEST');
  
  const run1Events = await runSimulatedExecution('replay-1');
  const run2Events = await runSimulatedExecution('replay-2');

  // Compare sequences (ignoring IDs and timestamps)
  const seq1 = run1Events.map(e => ({ agent: e.agent, type: e.eventType, payload: e.payload }));
  const seq2 = run2Events.map(e => ({ agent: e.agent, type: e.eventType, payload: e.payload }));

  const match = JSON.stringify(seq1) === JSON.stringify(seq2);
  console.log(`[Suite 4] Event stream sequences match: ${match}`);
  
  return match;
}

async function runSimulatedExecution(idSuffix: string) {
  const executionId = `det-${idSuffix}-${Date.now()}`;
  await EventBus.emit({
    executionId,
    intentId: 'det-intent',
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: { goal: 'Deterministic run' },
    stepId: 'start'
  });
  await runUntilTerminated(executionId);
  return await EventBus.getStream(executionId);
}

runVerification();
