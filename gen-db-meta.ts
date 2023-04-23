import fs from "node:fs/promises";
import path from "node:path";
import urlJoin from "url-join";

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

const TABLE_DIR_NAME = "tables";
const ENTRY_META_FILENAME = "meta.json";
const MOOSHY_DB = "mooshy.db";
const DB_META_OUT_FILENAME = "db-meta.json";

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
            throw new Error(`${ENTRY_META_FILENAME} is not undefined.`, {
              cause: entryFilenames,
            });
          }

          const { default: meta }: { default: EntryMetadata } = await import(
            path.join("file://", entryPath, metaFile),
            {
              assert: {
                type: "json",
              },
            }
          );

          const otherFiles = entryFilenames.filter(
            (name) => name !== ENTRY_META_FILENAME
          );

          resolve(
            otherFiles.map((filename) => {
              return {
                url: urlJoin(TABLE_DIR_NAME, tableName, entryName, filename),
                name: entryName,
                meta,
              };
            })
          );
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

  await fs.writeFile(
    path.join(process.cwd(), DB_META_OUT_FILENAME),
    JSON.stringify(tableEntriesObj)
  );
};

run();
