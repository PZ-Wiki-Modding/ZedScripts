import * as path from "path";

export const EXTENSION_ID = "project-zomboid-scripts";
export const LANG_ZEDSCRIPTS = "ZedScripts";
export const DOCUMENT_IDENTIFIER = "_DOCUMENT";

export const SCRIPTS_BLOCKS_DATA_LINK = "https://raw.githubusercontent.com/PZ-Wiki-Modding/pz-scripts-data/refs/tags/pre-lsp/out/scriptsBlocks.json";
export const ROOTS_DATA_LINK = "https://raw.githubusercontent.com/PZ-Wiki-Modding/pz-scripts-data/refs/tags/pre-lsp/out/roots.json";

export const DEFAULT_DIR = path.normalize(
    "C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid/media/scripts/"
);

const CACHE_DURATION_HOURS = 12;
export const CACHE_DURATION_MS = CACHE_DURATION_HOURS * 60 * 60 * 1000; // in milliseconds
export const WIKI_LINK = "https://pzwiki.net/wiki/";
export const DOCS_LINK = "https://pz-wiki-modding.github.io/PZ-API-Docs/scripts/";
