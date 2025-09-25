import fs from "fs";
import path from "path";

const FIXTURE_DIR = process.env.FIXTURE_DIR || "./tests/fixtures/wxr";

export function listFixtures(): string[] {
  const absoluteFixtureDir = path.resolve(process.cwd(), FIXTURE_DIR);
  try {
    return fs.readdirSync(absoluteFixtureDir);
  } catch (error) {
    console.error(`Error reading fixture directory: ${absoluteFixtureDir}`);
    throw error;
  }
}

export function loadFixture(name: string): string {
  const absoluteFixtureDir = path.resolve(process.cwd(), FIXTURE_DIR);
  const fixturePath = path.join(absoluteFixtureDir, name);
  try {
    return fs.readFileSync(fixturePath, "utf-8");
  } catch (error) {
    const availableFixtures = listFixtures();
    console.error(`Error loading fixture: ${name} from ${fixturePath}`);
    console.error(`Available fixtures:
- ${availableFixtures.join("\n- ")}`);
    throw error;
  }
}