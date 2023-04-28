import fs from "node:fs/promises";
import path from "node:path";
import urlJoin from "url-join";
import { ENTRY_META_FILENAME, TABLE_DIR_NAME } from "./consts.ts";

type EntryMetadata = {
  description?: string;
};

type Entry = {
  url: string;
  meta: EntryMetadata;
};

type TableEntries = {
  table: string;
  entries: Array<Entry>;
};

const DB_META_OUT_FILENAME = "db-meta.json";

const getMeta = async (path: string) => {
  const { default: meta }: { default: EntryMetadata } = await import(path, {
    assert: {
      type: "json",
    },
  });

  return meta;
};

const dirExists = async (path: string) =>
  await fs
    .access(path)
    .then(() => true)
    .catch(() => false);

const run = async () => {
  const tableDir = path.join(process.cwd(), TABLE_DIR_NAME);
  const tables = await fs.readdir(tableDir);

  const unresolvedTableEntries = tables.map((tableName) => {
    const tablePath = path.join(tableDir, tableName);

    return new Promise<TableEntries>(async (resolve) => {
      const entriesNames = await fs.readdir(tablePath);

      const unresolvedEntries = entriesNames.map((entryName) => {
        const entryPath = path.join(tablePath, entryName);

        return new Promise<Array<Entry>>(async (resolve) => {
          const entryFilenames = await fs.readdir(entryPath);

          const metaFile = entryFilenames.find(
            (name) => name === ENTRY_META_FILENAME
          );

          if (metaFile === undefined) {
            console.warn(ENTRY_META_FILENAME, "is not defined.");
          }

          const meta = metaFile
            ? await getMeta(path.join("file://", entryPath, metaFile))
            : {};

          const otherFiles = entryFilenames.filter(
            (name) => name !== ENTRY_META_FILENAME
          );

          const unresolvedFiles = otherFiles.map((filename) => {
            return new Promise<any>(async (resolve) => {
              const stat = await fs.stat(
                path.join(
                  process.cwd(),
                  TABLE_DIR_NAME,
                  tableName,
                  entryName,
                  filename
                )
              );

              resolve({
                url: urlJoin(TABLE_DIR_NAME, tableName, entryName, filename),
                name: entryName,
                meta: {
                  ...meta,
                  size: stat.size,
                },
              });
            });
          });

          resolve(await Promise.all(unresolvedFiles));
        });
      });

      const entries = await Promise.all(unresolvedEntries);

      resolve({
        table: tableName,
        entries: entries.flatMap((entry) => entry),
      });
    });
  });

  const tableEntries = await Promise.all(unresolvedTableEntries);

  const tableEntriesObj: Record<string, any> = {};

  tableEntries.forEach(({ table, entries }) => {
    tableEntriesObj[table] = entries;
  });

  console.info("Writing output...", tableEntriesObj);

  const distDir = path.join(process.cwd(), "dist");

  if (!(await dirExists(distDir))) {
    await fs.mkdir(path.join(process.cwd(), "dist"));
  }

  await fs.writeFile(
    path.join(process.cwd(), "dist", DB_META_OUT_FILENAME),
    JSON.stringify(tableEntriesObj)
  );
};

run();
