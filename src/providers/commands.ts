import * as vscode from "vscode";
import * as path from "path";

import { ZSEnv } from "../extension";
import { PZWorkspace, WorkspaceType } from "../workspace/workspace";

import { DefaultText } from "../models/DefaultText";

import { diagnosticFile, loadDecorations, DIAGNOSTIC_PROVIDER } from "./diagnostic";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";

import { formatText } from "../utils/format";

export function reloadDocument(source: vscode.TextEditor | vscode.TextDocumentChangeEvent) {
    diagnosticFile(source.document, DIAGNOSTIC_PROVIDER);
    loadDecorations(source.document);
}

export async function resetScriptsCache() {
    const result = await ZSEnv.loadData(false, true);
    if (result) {
        vscode.window.showInformationMessage(
            DefaultText.COMMAND_CACHE_RESET_SUCCESS
        );
    } else {
        vscode.window.showWarningMessage(
            DefaultText.COMMAND_CACHE_RESET_FAILED
        );
    }
}

export async function exportScriptsBlocks() {
    const documentBlocks = PZWorkspace.getAllDocumentsPerType(WorkspaceType.WORKSPACE);
    const exportData = documentBlocks.map(block => block.export());
    const exportJson = JSON.stringify(exportData, null, 2);

    const defaultPath = path.join(
        vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
        "scripts_export.json"
    );
    const result = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultPath),
        title: DefaultText.COMMAND_EXPORT_TITLE,
        filters: {
            'JSON files': ['json'],
            'All files': ['*']
        }
    });
    if (!result) { return; }

    const exportPath = result.fsPath;
    const exportUri = result.toString();
    vscode.workspace.fs.writeFile(
        vscode.Uri.file(exportPath),
        Buffer.from(exportJson, "utf-8")
    ).then(() => {
        vscode.window.showInformationMessage(
            formatText(DefaultText.COMMAND_EXPORT_SUCCESS, { 
                filename: path.basename(exportPath),
                fileUri: exportUri,
            })
        );
    }, (error) => {
        vscode.window.showErrorMessage(
            formatText(DefaultText.COMMAND_EXPORT_FAILED, { errorMessage: error.message })
        );
    });
}