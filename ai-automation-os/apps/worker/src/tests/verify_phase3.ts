import { AgentLoop } from '../runtime/agentLoop.js';
import { EventBus } from '../../../api/src/utils/eventBus.js';
import { stateReducer } from '../runtime/stateReducer.js';
import { prisma } from '../../../api/src/utils/db.js';
import assert from 'assert';

async function runUntilTerminated(executionId: string, maxIterations = 10) {
  let terminated = false;
  let iterations = 0;
  
  while (iterations < maxIterations && !terminated) {
    iterations++;
    console.log(`[Runner] Iteration ${iterations} for ${executionId}`);
    await AgentLoop.run(executionId);
    
    const events = await EventBus.getStream(executionId);
    const state = stateReducer(events);
    terminated = state.terminated;
  }
  return iterations;
}

/**
 * Suite 1: Policy Enforcement Test
 * Verifies that the Planner respects the deterministic policy injected into the stream.
 */
async function testPolicyEnforcement() {
  console.log('\n--- SUITE 1: POLICY ENFORCEMENT ---');
  const executionId = `policy-test-${Date.now()}`;
  const intentId = 'intent-policy-1';

  // 1. Start execution
  await EventBus.emit({
    executionId,
    intentId,
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: { 
      // Force a custom policy via mock logic if needed, 
      // but here we just verify the default logic.
    },
    stepId: 'init'
  });

  await runUntilTerminated(executionId);

  const events = await EventBus.getStream(executionId);
  const state = stateReducer(events);

  const policyEvent = events.find(e => e.eventType === 'policy_applied');
  assert.ok(policyEvent, 'policy_applied event missing');
  
  console.log(`[Suite 1] Policy Applied: ${JSON.stringify(policyEvent.payload.policy.constraints)}`);
  
  // Verify plan respects allowed_tools (default includes 'web_search')
  const planGenerated = events.find(e => e.eventType === 'plan_generated');
  const planSteps = planGenerated?.payload.plan.steps;
  const allowedTools = policyEvent.payload.policy.constraints.allowed_tools;
  
  const allToolsAllowed = planSteps.every((s: any) => allowedTools.includes(s.tool));
  assert.strictEqual(allToolsAllowed, true, 'Planner included a forbidden tool');
  
  console.log('SUITE 1: PASSED');
}

/**
 * Suite 2: Idempotency Guard Test
 * Verifies that policy/learning injections are only emitted once.
 */
async function testIdempotency() {
  console.log('\n--- SUITE 2: IDEMPOTENCY GUARD ---');
  const executionId = `idem-test-${Date.now()}`;
  
  // Manually emit policy_applied twice
  await EventBus.emit({
    executionId,
    intentId: 'i1',
    agent: 'POLICY',
    eventType: 'policy_applied',
    payload: { policy: { id: 'p1' } },
    stepId: 's1'
  });

  await EventBus.emit({
    executionId,
    intentId: 'i1',
    agent: 'POLICY',
    eventType: 'policy_applied',
    payload: { policy: { id: 'p2' } }, // Different payload
    stepId: 's2'
  });

  const events = await EventBus.getStream(executionId);
  const policyEvents = events.filter(e => e.eventType === 'policy_applied');
  
  assert.strictEqual(policyEvents.length, 1, 'Idempotency guard failed: duplicate policy_applied found');
  assert.strictEqual(policyEvents[0].payload.policy.id, 'p1', 'First event should be preserved');

  console.log('SUITE 2: PASSED');
}

/**
 * Suite 3: Learning Context Influence
 * Verifies that learning patterns successfully reach the Planner.
 */
async function testLearningInfluence() {
  console.log('\n--- SUITE 3: LEARNING INFLUENCE ---');
  const executionId = `learn-test-${Date.now()}`;
  
  await EventBus.emit({
    executionId,
    intentId: 'i1',
    agent: 'SYSTEM',
    eventType: 'execution_started',
    payload: {},
    stepId: 'init'
  });

  await runUntilTerminated(executionId, 5); // Just enough to see plan

  const events = await EventBus.getStream(executionId);
  const learningEvent = events.find(e => e.eventType === 'learning_context_injected');
  const plannerStartedEvent = events.find(e => e.eventType === 'planner_reasoning_started');
  
  assert.ok(learningEvent, 'learning_context_injected event missing');
  assert.strictEqual(plannerStartedEvent?.payload.learningApplied, true, 'Planner did not acknowledge learning context');

  console.log('SUITE 3: PASSED');
}

async function runPhase3Verification() {
  try {
    await testPolicyEnforcement();
    await testIdempotency();
    await testLearningInfluence();
    
    console.log('\n📊 PHASE 3 FINAL VERIFICATION REPORT');
    console.log('----------------------------');
    console.log('POLICY ENFORCEMENT: ✅ PASSED');
    console.log('IDEMPOTENCY GUARD: ✅ PASSED');
    console.log('LEARNING INFLUENCE: ✅ PASSED');
  } catch (error) {
    console.error('\n❌ PHASE 3 VERIFICATION FAILED');
    console.error(error);
    process.exit(1);
  }
}

runPhase3Verification();
