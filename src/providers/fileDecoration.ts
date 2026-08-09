/**
 * Used to provide file decorations for ZedScripts files in the VSCode explorer.
 * This does not replace the base icon from the active icon theme.
 * It adds a badge/tooltip marker so ZedScripts files remain recognizable.
 */

import * as vscode from "vscode";

import { MainConfigName, ConfigKeys } from "../models/ConfigKeys";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";




export class ZedScriptsFileDecorationProvider implements vscode.FileDecorationProvider {
    private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this.emitter.event;

    public refresh(uri?: vscode.Uri | vscode.Uri[]): void {
        this.emitter.fire(uri);
    }

    public dispose(): void {
        this.emitter.dispose();
    }

    provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        if (token.isCancellationRequested) {
            return undefined;
        }
        
        if (uri.scheme !== "file") {
            return undefined;
        }

        const config = vscode.workspace.getConfiguration(MainConfigName);
        if (!config.get(ConfigKeys.FILE_DECORATOR, false)) {
            return undefined;
        }

        const path = uri.fsPath.toLowerCase();
        if (!(path.endsWith(".txt") || path.endsWith(".info"))) {
            return undefined;
        }

        const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
        if (!document) {
            return undefined;
        }

        // check if this is a ZedScripts file by checking
        // if it belongs to a loaded workspace/cache first
        const documentBlock = DocumentBlock.getDocumentBlock(document);
        if (documentBlock) {
            const rootType = documentBlock.scriptBlock;
            return new vscode.FileDecoration(
                "Z",
                `ZedScripts file (${rootType})`,
                // new vscode.ThemeColor("charts.green")
            );
        }

        return undefined;
    }
}
export const FILE_DECORATOR = new ZedScriptsFileDecorationProvider();