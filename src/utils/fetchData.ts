import * as vscode from 'vscode';
import { setScriptsTypes, ScriptData } from '../scriptsBlocks/scriptsBlocksData';
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';
import { 
    SCRIPT_DATA_LINK,
    CACHE_DURATION_MS,
    DEFAULT_SCRIPT_BLOCKS
} from '../project';

export async function fetchData(context: vscode.ExtensionContext, forceFetch: boolean = false): Promise<boolean> {
    console.log("Initializing script and translation blocks data...");
    
    // clear DocumentBlock cache to update diagnostics
    DocumentBlock.clearCache();
    await context.globalState.update('lastFetch', Date.now());

    // check if the user wants to use the local copy only
    const config = vscode.workspace.getConfiguration("ZedScripts");
    const onlyUseLocalData: boolean = config.get("onlyUseLocalData", false);
    if (onlyUseLocalData) {
        setScriptsTypes(require('../' + DEFAULT_SCRIPT_BLOCKS));
        console.log("Using local data as per configuration.");
        return true;
    }

    // check cache first
    const cachedScriptsBlocks: ScriptData | undefined = context.globalState.get('scriptBlocks');
    const lastFetch = context.globalState.get<number>('lastFetch', 0);
    if (!forceFetch && Date.now() - lastFetch < CACHE_DURATION_MS) {
        // set data to cache values if they exist
        if (cachedScriptsBlocks) {
            setScriptsTypes(cachedScriptsBlocks);
        }
        if (cachedScriptsBlocks) {
            console.log("Using cached data.");
            return true;
        }
    }

    // fetch data
    try {
        const scriptsData = await fetchScriptBlocksData();
        await context.globalState.update('scriptBlocks', scriptsData);

        // save to cache
        await context.globalState.update('lastFetch', Date.now());
        
        console.log("Fetched data successfully");
        return true;
    } catch (error) {
        setScriptsTypes(cachedScriptsBlocks || require('../' + DEFAULT_SCRIPT_BLOCKS));
        console.warn("Failed to fetch data, using cached or local data.");
        return false;
    }
}

async function fetchScriptBlocksData(): Promise<ScriptData> {
    const response = await fetch(SCRIPT_DATA_LINK);
    const data = await response.json();
    setScriptsTypes(data);
    return data;
}
