import * as vscode from "vscode";
import * as path from "path";

import { LANG_ZEDSCRIPTS } from "./project";
import { ZedScriptsEnvironment } from "./workspace/environment";

import { DocumentBlock } from "./scriptsBlocks/blockTypes/document";

import { diagnosticFile, DIAGNOSTIC_PROVIDER } from "./providers/diagnostic";
import { provideDefinition } from "./providers/definition";
import { provideDocumentFormattingEdits } from "./providers/editing";
import { PZCompletionItemProvider } from "./providers/completion";
import { PZHoverProvider } from "./providers/hover";

import { reloadDocument, resetScriptsCache, exportScriptsBlocks } from "./providers/commands";

let debounceTimer: NodeJS.Timeout | undefined;
export let ZSEnv: ZedScriptsEnvironment;

export async function activate(context: vscode.ExtensionContext) {
    console.debug('Activating extension "project-zomboid-scripts"...');
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

    // // handle the initially active document on startup
    // if (vscode.window.activeTextEditor) {
    //     diagnosticFile(
    //         vscode.window.activeTextEditor.document,
    //         DIAGNOSTIC_PROVIDER
    //     );
    //     loadDecorations(vscode.window.activeTextEditor.document);
    // }

    console.log('Extension "project-zomboid-scripts" is now active!');
}

export function deactivate() {
    console.debug('Extension "project-zomboid-scripts" is now deactivated.');
}



function subscribeCommands(context: vscode.ExtensionContext) {
    // register commands
    context.subscriptions.push(
        // add a force reset cache function
        vscode.commands.registerCommand(
            "ZedScripts.resetScriptsCache",
            resetScriptsCache
        ),

        // add an export function
        vscode.commands.registerCommand(
            "ZedScripts.exportScriptsBlocks",
            exportScriptsBlocks
        ),

        vscode.commands.registerCommand(
            "ZedScripts.showInfo",
            () => {
                vscode.window.showInformationMessage("Hello!");
            }
        ),
    );
}


function subscribeCallbacks(context: vscode.ExtensionContext) {
    // implement a file watcher to clear the cache of a DocumentBlock when a .txt file is deleted
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.txt");
    watcher.onDidDelete((uri) => {
        ZSEnv.clearCacheForUri(uri);
        console.debug(`Invalidated cache for : ${uri.fsPath}`);
    });
    
    // register commands and event listeners
    context.subscriptions.push(

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


    // HELPERS

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
        })
    );
}






