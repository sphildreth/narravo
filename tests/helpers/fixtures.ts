// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Fixture loader utility for WXR tests.
 * Provides safe access to test fixture files with proper error handling.
 */

const DEFAULT_FIXTURE_DIR = "./tests/fixtures/wxr";

/**
 * Get the fixture directory path, with environment override support
 */
function getFixtureDir(): string {
  const dir = process.env.FIXTURE_DIR || DEFAULT_FIXTURE_DIR;
  // If not absolute, resolve from current working directory
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

/**
 * Load a fixture by name from the canonical fixtures directory.
 * @param name - Fixture filename (e.g., "wxr_minimal.xml")
 * @returns Promise resolving to fixture content as string
 * @throws Error if fixture not found, with suggestions for similar names
 */
export async function loadFixture(name: string): Promise<string> {
  const fixtureDir = getFixtureDir();
  const fixturePath = path.join(fixtureDir, name);
  
  try {
    return await readFile(fixturePath, "utf-8");
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // Try to provide helpful suggestions
      const suggestions = await getSimilarFixtureNames(name);
      const suggestionText = suggestions.length > 0 
        ? `\n\nSimilar fixtures found: ${suggestions.join(", ")}`
        : "";
        
      throw new Error(`Fixture not found: ${name}${suggestionText}`);
    }
    throw error;
  }
}

/**
 * List all available fixtures in the fixtures directory.
 * @returns Promise resolving to array of fixture filenames, sorted alphabetically
 */
export async function listFixtures(): Promise<string[]> {
  const fixtureDir = getFixtureDir();
  
  try {
    const files = await readdir(fixtureDir);
    return files
      .filter(file => file.endsWith('.xml') || file.endsWith('.wxr'))
      .sort();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Fixture directory not found: ${fixtureDir}`);
    }
    throw error;
  }
}

/**
 * Get fixture names similar to the given name (simple Levenshtein distance <= 2).
 * Helps with typo suggestions.
 */
async function getSimilarFixtureNames(targetName: string): Promise<string[]> {
  try {
    const allFixtures = await listFixtures();
    return allFixtures.filter(name => levenshteinDistance(name, targetName) <= 2);
  } catch {
    return [];
  }
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fixture name suggestions.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}