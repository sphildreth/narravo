import fs from "fs";
import path from "path";

const FIXTURE_DIR = process.env.FIXTURE_DIR || "./tests/fixtures/wxr";

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * List all available fixture files in the fixture directory
 * @returns Array of fixture filenames (sorted alphabetically)
 */
export function listFixtures(): string[] {
  const absoluteFixtureDir = path.resolve(process.cwd(), FIXTURE_DIR);
  try {
    const files = fs.readdirSync(absoluteFixtureDir);
    return files
      .filter(file => file.endsWith('.xml') || file.endsWith('.wxr'))
      .sort();
  } catch (error) {
    console.error(`Error reading fixture directory: ${absoluteFixtureDir}`);
    throw error;
  }
}

/**
 * Load a fixture file by name
 * @param name The fixture filename (without path)
 * @returns The fixture file content as a string
 * @throws Error with suggestions if fixture not found
 */
export function loadFixture(name: string): string {
  const absoluteFixtureDir = path.resolve(process.cwd(), FIXTURE_DIR);
  const fixturePath = path.join(absoluteFixtureDir, name);
  
  try {
    return fs.readFileSync(fixturePath, "utf-8");
  } catch (error) {
    const availableFixtures = listFixtures();
    
    // Find close matches using Levenshtein distance (≤ 2 as specified)
    const suggestions = availableFixtures
      .map(fixture => ({ fixture, distance: levenshteinDistance(name, fixture) }))
      .filter(({ distance }) => distance <= 2 && distance > 0)
      .sort((a, b) => a.distance - b.distance)
      .map(({ fixture }) => fixture)
      .slice(0, 3); // Limit to top 3 suggestions

    let errorMessage = `Error loading fixture: ${name} from ${fixturePath}`;
    
    if (suggestions.length > 0) {
      errorMessage += `\n\nDid you mean one of these?`;
      suggestions.forEach(suggestion => {
        errorMessage += `\n- ${suggestion}`;
      });
    }
    
    errorMessage += `\n\nAll available fixtures:`;
    availableFixtures.forEach(fixture => {
      errorMessage += `\n- ${fixture}`;
    });
    
    const enhancedError = new Error(errorMessage);
    enhancedError.cause = error;
    throw enhancedError;
  }
}