import * as vscode from "vscode";

import { LANG_ZEDSCRIPTS } from "./project";
import { ZedScriptsEnvironment } from "./workspace/environment";

import { Commands } from "./models/Commands";
import { MainConfigName, ConfigKeys } from "./models/ConfigKeys";

import { DocumentBlock } from "./scriptsBlocks/blockTypes/document";

import { DIAGNOSTIC_PROVIDER } from "./providers/diagnostic";
import { provideDefinition } from "./providers/definition";
import { provideDocumentFormattingEdits } from "./providers/editing";
import { PZCompletionItemProvider } from "./providers/completion";
import { PZHoverProvider } from "./providers/hover";
import { FILE_DECORATOR } from "./providers/fileDecoration";
import { 
    reloadDocument, 
    resetScriptsCache, 
    exportScriptsBlocks, 
    showDiagnosticTypes 
} from "./providers/commands";

import { log } from "./utils/logger";



let debounceTimer: NodeJS.Timeout | undefined;
export let ZSEnv: ZedScriptsEnvironment;


export async function activate(context: vscode.ExtensionContext) {
    log('Activating extension "project-zomboid-scripts"...');
    ZSEnv = new ZedScriptsEnvironment(context, DIAGNOSTIC_PROVIDER);

    // show status bar
    ZSEnv.updateStatusBar();
    context.subscriptions.push(ZSEnv.statusBar);

    // we load the commands first in-case the user wants to show information
    // on the currently loading libraries and workspace
    subscribeCommands(context);

    // load libraries and the workspace
    await ZSEnv.load();

    // these need to be loaded after because they may trigger events
    // during the loading of the libraries and workspace
    subscribeCallbacks(context);

    log('Extension "project-zomboid-scripts" is now active!');
}

export function deactivate() {
    log('Extension "project-zomboid-scripts" is now deactivated.');
}



function subscribeCommands(context: vscode.ExtensionContext) {
    // register commands
    context.subscriptions.push(
        // add a force reset cache function
        vscode.commands.registerCommand(
            Commands.RESET_SCRIPTS_CACHE,
            resetScriptsCache
        ),

        // add an export function
        vscode.commands.registerCommand(
            Commands.EXPORT_SCRIPTS_BLOCKS,
            exportScriptsBlocks
        ),

        vscode.commands.registerCommand(
            Commands.SHOW_DIAGNOSTIC_TYPES,
            showDiagnosticTypes
        )
    );
}


function subscribeCallbacks(context: vscode.ExtensionContext) {
    // implement a file watcher to clear the cache of a DocumentBlock when a .txt file is deleted
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.txt");
    watcher.onDidCreate((uri) => {
        FILE_DECORATOR.refresh(uri);
    });
    watcher.onDidChange((uri) => {
        FILE_DECORATOR.refresh(uri);
    });
    watcher.onDidDelete((uri) => {
        ZSEnv.clearCacheForUri(uri);
        FILE_DECORATOR.refresh(uri);
        log(`Invalidated cache for : ${uri.fsPath}`);
    });
    
    // register commands and event listeners
    context.subscriptions.push(


    // CONFIGURATION

        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration(MainConfigName)) {
                // we change the diagnostic rules
                if (
                    event.affectsConfiguration(`${MainConfigName}.${ConfigKeys.DISABLED_DIAGNOSTICS_LIST}`)
                    || event.affectsConfiguration(`${MainConfigName}.${ConfigKeys.DISABLED_DIAGNOSTICS_ALL}`)
                ) {
                    ZSEnv.validateWorkspace();

                // the libraries changed
                } else if (
                    event.affectsConfiguration(`${MainConfigName}.${ConfigKeys.LIBRARIES}`)
                ) {
                    await ZSEnv.preloadLibraries(true);
                    await ZSEnv.loadLibraries();
                
                // the parsing rules changed
                // we also full reload when the data updates because the parsing rules 
                // are impacted by the dataset (root files)
                } else if (
                    event.affectsConfiguration(`${MainConfigName}.${ConfigKeys.NO_PARSING}`)
                    || event.affectsConfiguration(`${MainConfigName}.${ConfigKeys.LOCAL_DATA}`)
                ) {
                    await ZSEnv.load();
                }
            }
        }),


    // ON DOCUMENT CHANGES

        watcher,

        // triggers anytime we open a text document, or swap active document editor
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor) { return; }
            reloadDocument(editor);
        }),

        // this one triggers when we open a new document
        // not needed since we already handle the active editor change above
        // vscode.workspace.onDidOpenTextDocument((document) => {
        //     diagnosticFile(document, DIAGNOSTIC_PROVIDER);
        //     loadDecorations(document);
        // }),

        // triggers when we type in the document
        vscode.workspace.onDidChangeTextDocument((event) => {
            // debounce to avoid too many diagnostics on fast typing
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(() => reloadDocument(event), 500);
        }),


    // PROVIDERS

        vscode.languages.registerCodeActionsProvider(
            LANG_ZEDSCRIPTS,
            {provideCodeActions(document, range, context) {
                const actions: vscode.CodeAction[] = [];
                // const fileDiagnostics = diagnosticProvider.diagnosticCollection.get(document.uri);
                // if (!fileDiagnostics) { return actions; }

                const documentBlock = DocumentBlock.getDocumentBlock(document);
                if (!documentBlock) { return actions; }

                // register document actions
                const documentActions = documentBlock.getActionsForRange(range);
                for (const [actionRange, diagnostic, action] of documentActions) {
                    if (actionRange.contains(range)) {
                        action.diagnostics = [diagnostic];
                        actions.push(action);
                    }
                }

                return actions;
            }}
        ),

        // extra handlers
        vscode.languages.registerCompletionItemProvider(
            LANG_ZEDSCRIPTS,
            new PZCompletionItemProvider()//,
            // ".",
            // " ",
            // "\t"
        ),

        // handle mouse hover words
        vscode.languages.registerHoverProvider(
            LANG_ZEDSCRIPTS,
            new PZHoverProvider()
        ),
        
        // format document with right click > Format document
        vscode.languages.registerDocumentFormattingEditProvider(
            LANG_ZEDSCRIPTS, 
            {provideDocumentFormattingEdits,}
        ),
        
        // apparently used when ctrl + click something
        vscode.languages.registerDefinitionProvider(LANG_ZEDSCRIPTS, {
            provideDefinition,
        }),

        // show badges in Explorer for recognized ZedScripts files
        FILE_DECORATOR,
        vscode.window.registerFileDecorationProvider(FILE_DECORATOR),
    );
}

