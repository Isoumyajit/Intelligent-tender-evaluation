import { Injectable } from '@angular/core';
import { CriterionStatus } from '../models/evaluation.models';

export type ConfidenceTier = 'high' | 'medium' | 'low';

/**
 * Pure, stateless scoring utilities. Swap in a different scorer later
 * (e.g. ministry-specific thresholds) by providing another implementation.
 */
@Injectable({ providedIn: 'root' })
export class EvaluationScorer {
  readonly highThreshold = 80;
  readonly mediumThreshold = 60;

  tier(score: number): ConfidenceTier {
    if (score >= this.highThreshold) return 'high';
    if (score >= this.mediumThreshold) return 'medium';
    return 'low';
  }

  /** Map a tier to a criterion status for mock evidence generation. */
  statusForTier(tier: ConfidenceTier, lenient = false): CriterionStatus {
    if (tier === 'high') return 'passed';
    if (tier === 'medium') return lenient ? 'passed' : 'partial';
    return 'failed';
  }

  /** Score → normalized 0..100 percent for a given weight. */
  percent(score: number, weight: number): number {
    if (weight <= 0) return 0;
    return Math.round((score / weight) * 100);
  }
}
