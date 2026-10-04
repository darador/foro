/**
 * ForoFetiche Feature Flags
 * 
 * CRITICAL RULE (Section 43 of Master Prompt):
 * DIRECTORY_ENABLED MUST default to false until explicit legal review and authorization.
 */

export const FEATURE_FLAGS = {
  /**
   * Directory Module (Professional, Place, Event profiles, claims, disputes)
   * MUST REMAIN FALSE BY DEFAULT
   */
  DIRECTORY_ENABLED: process.env.NEXT_PUBLIC_DIRECTORY_ENABLED === 'true',
} as const;

export function isDirectoryEnabled(): boolean {
  return FEATURE_FLAGS.DIRECTORY_ENABLED;
}
