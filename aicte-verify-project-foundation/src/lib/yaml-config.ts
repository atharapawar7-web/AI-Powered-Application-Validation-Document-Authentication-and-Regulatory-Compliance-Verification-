import fs from "fs/promises";
import path from "path";
import { load } from "js-yaml";

export async function readConfigYaml<T>(fileName: string): Promise<T> {
  const fullPath = path.join(process.cwd(), "config", fileName);
  const content = await fs.readFile(fullPath, "utf8");
  const parsed = load(content);
  return parsed as T;
}
