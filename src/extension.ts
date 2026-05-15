import * as vscode from "vscode";
import * as path from "path";
import { diagnosticNonLibrary, DIAGNOSTIC_PROVIDER } from "./providers/diagnostic";
import { provideDefinition } from "./providers/definition";
import { provideDocumentFormattingEdits } from "./providers/editing";
import { PZCompletionItemProvider } from "./providers/completion";
import { PZHoverProvider } from "./providers/hover";
import { itemCache } from "./providers/cache";
import { loadEnvironment } from "./providers/libraries";
import { fetchData } from "./utils/fetchData";
import { DefaultText, LANG_ZEDSCRIPTS } from "./models/enums";
import { DocumentBlock } from "./scriptsBlocks/scriptsBlocks";

export async function activate(context: vscode.ExtensionContext) {
    console.debug('Activating extension "pz-syntax-extension"...');

    // try to fetch the latest scriptBlocks.json from the GitHub repository
    await fetchData(context);

    // load libraries and the workspace
    await loadEnvironment(DIAGNOSTIC_PROVIDER);

    // handle the initially active document on startup
    if (vscode.window.activeTextEditor) {
        diagnosticNonLibrary(
            vscode.window.activeTextEditor.document,
            DIAGNOSTIC_PROVIDER
        );
    }

    const watcher = vscode.workspace.createFileSystemWatcher("**/*.txt");
    watcher.onDidChange((uri) => {
        itemCache.clearForFile(uri.fsPath);
        console.debug(`Invalidated cache for : ${uri.fsPath}`);
    });
    
    watcher.onDidDelete((uri) => {
        itemCache.clearForFile(uri.fsPath);
        console.debug(`Invalidated cache for : ${uri.fsPath}`);
    });
    
    if (vscode.window.activeTextEditor) {
        diagnosticNonLibrary(
            vscode.window.activeTextEditor.document,
            DIAGNOSTIC_PROVIDER
        );
    }
    
    context.subscriptions.push(
        watcher,

        // add a force reset cache function
        vscode.commands.registerCommand(
            "ZedScripts.resetScriptCache",
            async () => {
                const result = await fetchData(context, true);
                if (result) {
                    vscode.window.showInformationMessage(
                        DefaultText.CACHE_RESET
                    );
                } else {
                    vscode.window.showWarningMessage(
                        DefaultText.CACHE_RESET_FAILED
                    );
                }
            }
        ),

        // add an export function
        vscode.commands.registerCommand(
            "ZedScripts.exportScriptBlocks",
            () => {
                const documentBlocks = DocumentBlock.getAllDocumentBlocks();
                const exportData = documentBlocks.map(block => block.export());
                const exportJson = JSON.stringify(exportData, null, 2);
                const exportPath = path.join(
                    vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
                    "scripts_export.json"
                );
                vscode.workspace.fs.writeFile(
                    vscode.Uri.file(exportPath),
                    Buffer.from(exportJson, "utf-8")
                ).then(() => {
                    vscode.window.showInformationMessage(
                        `Exported script blocks to ${exportPath}`
                    );
                }, (error) => {
                    vscode.window.showErrorMessage(
                        `Failed to export script blocks: ${error.message}`
                    );
                });
            }
        ),


        vscode.window.onDidChangeActiveTextEditor((editor) => {
            // console.debug(`Active editor changed: ${editor?.document.fileName}`);
            if (!editor) { return; }
            diagnosticNonLibrary(editor.document, DIAGNOSTIC_PROVIDER);
        }),

        // diagnostics
        vscode.workspace.onDidOpenTextDocument((document) => {
            diagnosticNonLibrary(document, DIAGNOSTIC_PROVIDER);
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            diagnosticNonLibrary(event.document, DIAGNOSTIC_PROVIDER);
        }),


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
            new PZCompletionItemProvider(),
            ".",
            " ",
            "\t" // Déclencheurs de complétion
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

    console.log('Extension "pz-syntax-extension" is now active!');
}

export function deactivate() {
    console.debug('Extension "pz-syntax-extension" is now deactivated.');
}
