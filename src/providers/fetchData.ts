import * as vscode from 'vscode';

import { 
    SCRIPTS_BLOCKS_DATA_LINK,
    ROOTS_DATA_LINK,
    CACHE_DURATION_MS
} from '../project';

import { ConfigKeys } from "../models/ConfigKeys";
import { GlobalState } from '../models/GlobalState';

import { 
    setScriptsTypes, ScriptData, 
    DEFAULT_SCRIPTS_BLOCKS_DATA, DEFAULT_ROOTS_DATA 
} from '../scriptsBlocks/scriptsBlocksData';
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';

import { log } from '../utils/logger';

export async function fetchData(context: vscode.ExtensionContext, forceFetch: boolean = false): Promise<boolean> {
    log("Initializing script and translation blocks data...");
    
    // clear DocumentBlock cache to update diagnostics
    DocumentBlock.clearCache();
    await context.globalState.update('lastFetch', Date.now());

    // check if the user wants to use the local copy only
    const config = vscode.workspace.getConfiguration("ZedScripts");
    const onlyUseLocalData: boolean = config.get(ConfigKeys.LOCAL_DATA, false);
    if (onlyUseLocalData) {
        setScriptsTypes(
            DEFAULT_SCRIPTS_BLOCKS_DATA,
            DEFAULT_ROOTS_DATA
        );
        log("Using local data as per configuration.");
        return true;
    }

    // check cache first
    const cachedScriptsBlocks: ScriptData | undefined = context.globalState.get(GlobalState.SCRIPTS_BLOCKS_DATA);
    const cachedRootFiles: ScriptData | undefined = context.globalState.get(GlobalState.ROOTS_DATA);
    const lastFetch = context.globalState.get<number>(GlobalState.LAST_FETCH, 0);
    if (!forceFetch 
        && Date.now() - lastFetch < CACHE_DURATION_MS
        && cachedScriptsBlocks && cachedRootFiles) // we fetch again if one is not found
    {
        // set data to cache values if they exist
        setScriptsTypes(cachedScriptsBlocks, cachedRootFiles);
        log("Using cached data.");
        return true;
    }

    // fetch data
    try {
        await fetchScriptData(context);
        
        log("Fetched data successfully");
        return true;
    } catch (error) {
        setScriptsTypes(cachedScriptsBlocks || DEFAULT_SCRIPTS_BLOCKS_DATA, cachedRootFiles || DEFAULT_ROOTS_DATA);
        log("Failed to fetch data, using cached or local data.", "warn");
        return false;
    }
}

async function fetchScriptData(context: vscode.ExtensionContext): Promise<void> {
    // fetch the data
    const responseScriptsBlocks = await fetch(SCRIPTS_BLOCKS_DATA_LINK);
    const responseRoots = await fetch(ROOTS_DATA_LINK);

    const scriptsBlocks = await responseScriptsBlocks.json();
    const rootFiles = await responseRoots.json();
    
    // set the data
    setScriptsTypes(scriptsBlocks, rootFiles);

    // cache the data in global state
    await context.globalState.update(GlobalState.SCRIPTS_BLOCKS_DATA, scriptsBlocks);
    await context.globalState.update(GlobalState.ROOTS_DATA, rootFiles);
    await context.globalState.update(GlobalState.LAST_FETCH, Date.now());
}
