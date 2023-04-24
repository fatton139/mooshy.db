import fs from "node:fs/promises";
import path from "node:path";
import { ENTRY_META_FILENAME, TABLE_DIR_NAME } from "./consts";

const run = async () => {
  const tableName = process.argv[2];
  const entryName = process.argv[3];

  const entryPath = path.join(
    process.cwd(),
    TABLE_DIR_NAME,
    tableName,
    entryName
  );

  await fs.mkdir(entryPath, { recursive: true });
  await fs.writeFile(
    path.join(entryPath, ENTRY_META_FILENAME),
    JSON.stringify({})
  );
};

run();
