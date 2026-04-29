import { prisma } from '../../../api/src/utils/db.js';

/**
 * Execution Lease Manager
 * Implements time-bound, renewable execution ownership for distributed nodes.
 */
export class LeaseManager {
  private static LEASE_DURATION_MS = 30000; // 30 seconds
  private static HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
  private static activeHeartbeats = new Map<string, NodeJS.Timeout>();

  /**
   * Attempts to acquire a lease for an execution.
   */
  static async acquireLease(executionId: string, nodeId: string): Promise<boolean> {
    const now = new Date();
    
    // Use an atomic transaction or conditional update to prevent race conditions
    // In our MOCK_DB environment, we handle this in db.ts if needed, but here we 
    // perform the logic assuming standard Prisma behavior.
    
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId }
      });

      if (!execution) return false;

      const isLeaseActive = execution.ownerNodeId && execution.leaseExpiresAt && execution.leaseExpiresAt > now;
      const isOwner = execution.ownerNodeId === nodeId;

      if (isLeaseActive && !isOwner) {
        console.warn(`[LeaseManager] Execution ${executionId} is currently owned by ${execution.ownerNodeId}`);
        return false;
      }

      // Acquire or renew lease
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          ownerNodeId: nodeId,
          leaseExpiresAt: new Date(Date.now() + this.LEASE_DURATION_MS)
        }
      });

      console.log(`[LeaseManager] Lease acquired for ${executionId} by node ${nodeId}`);
      this.startHeartbeat(executionId, nodeId);
      return true;
    } catch (error) {
      console.error(`[LeaseManager] Failed to acquire lease for ${executionId}:`, error);
      return false;
    }
  }

  /**
   * Manually release a lease.
   */
  static async releaseLease(executionId: string, nodeId: string) {
    this.stopHeartbeat(executionId);
    
    try {
      await prisma.execution.update({
        where: { id: executionId, ownerNodeId: nodeId },
        data: {
          ownerNodeId: null,
          leaseExpiresAt: null
        }
      });
      console.log(`[LeaseManager] Lease released for ${executionId} by node ${nodeId}`);
    } catch (error) {
      // If we failed to release, it will eventually expire anyway
      console.warn(`[LeaseManager] Failed to release lease for ${executionId}:`, error);
    }
  }

  private static startHeartbeat(executionId: string, nodeId: string) {
    this.stopHeartbeat(executionId);
    
    const interval = setInterval(async () => {
      try {
        await prisma.execution.update({
          where: { id: executionId, ownerNodeId: nodeId },
          data: {
            leaseExpiresAt: new Date(Date.now() + this.LEASE_DURATION_MS)
          }
        });
      } catch (error) {
        console.error(`[LeaseManager] Heartbeat failed for ${executionId}:`, error);
        this.stopHeartbeat(executionId);
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    this.activeHeartbeats.set(executionId, interval);
  }

  private static stopHeartbeat(executionId: string) {
    const interval = this.activeHeartbeats.get(executionId);
    if (interval) {
      clearInterval(interval);
      this.activeHeartbeats.delete(executionId);
    }
  }
}
