import slugifyLib from 'slugify';
import { formatDistanceToNow } from 'date-fns';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { execSync } from 'child_process';

/**
 * Convert a description to a URL-safe slug
 * @param description - The text to convert to a slug
 * @returns A lowercase, hyphenated slug with max 50 characters
 */
export function generateSlug(description: string): string {
  const slug = slugifyLib(description, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });

  // Truncate to 50 characters, ensuring we don't cut in the middle of a word
  if (slug.length <= 50) {
    return slug;
  }

  const truncated = slug.substring(0, 50);
  const lastHyphen = truncated.lastIndexOf('-');

  // If there's a hyphen in the truncated string, cut at the last hyphen
  // Otherwise, just return the truncated string
  return lastHyphen > 0 ? truncated.substring(0, lastHyphen) : truncated;
}

/**
 * Format a date as relative time (e.g., "2 mins ago", "3 hours ago")
 * @param date - The date to format (string or Date object)
 * @returns A human-readable relative time string
 */
export function formatTimeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date provided');
  }

  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Ensure a directory exists, creating it and any parent directories if needed
 * @param path - The directory path to ensure exists
 */
export async function ensureDirectory(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Get the root directory of the current git repository
 * @returns The absolute path to the git repository root
 * @throws Error if not in a git repository
 */
export function getGitRoot(): string {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return root;
  } catch (error) {
    throw new Error('Not in a git repository');
  }
}
