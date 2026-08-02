import * as path from "path";

export const EXTENSION_ID = "project-zomboid-scripts";
export const LANG_ZEDSCRIPTS = "ZedScripts";
export const DOCUMENT_IDENTIFIER = "_DOCUMENT";

export const SCRIPT_DATA_LINK = "https://raw.githubusercontent.com/pz-wiki-modding/pz-scripts-data/refs/heads/main/out/scriptBlocks.json";

export const DEFAULT_DIR = path.normalize(
    "C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid/media/scripts/"
);

const CACHE_DURATION_HOURS = 12;
export const CACHE_DURATION_MS = CACHE_DURATION_HOURS * 60 * 60 * 1000; // in milliseconds
export const WIKI_LINK = "https://pzwiki.net/wiki/";
export const DOCS_LINK = "https://pz-wiki-modding.github.io/PZ-API-Docs/scripts/";

export const DEFAULT_SCRIPT_BLOCKS = 'pz-scripts-data/out/scriptBlocks.json';

export const MainConfigName = "ZedScripts";
export enum ConfigKeys {
    LIBRARIES = "searchDirectories",
    LOCAL_DATA = "onlyUseLocalData",
    DISABLED_DIAGNOSTICS_LIST = "disabledDiagnostics",
    DISABLED_DIAGNOSTICS_ALL = "disableAllDiagnostics",
    NO_PARSING = "noParsing",
}