import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DiagnosticProvider } from './diagnostic';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile } from '../scriptsBlocks/scriptsBlocksData';
import { PZWorkspace, WorkspaceType } from '../workspace/workspace';


export async function loadEnvironment(diagnosticProvider: DiagnosticProvider): Promise<void> {
    console.debug("Loading libraries and workspace...");

    // first load libraries files
    const config = vscode.workspace.getConfiguration("ZedScripts");
    const libraryDirs: string[] = config.get("searchDirectories", []);
    for (const folder of libraryDirs) {
        const uri = vscode.Uri.file(folder);
        if (!isValidDir(folder)) {
            vscode.window.showWarningMessage(`Library folder does not exist or is not accessible: ${folder}`);
            continue;
        }
        const workspace = new PZWorkspace(uri, WorkspaceType.LIBRARY);
        await workspace.load();
    }


    // list the folders of the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders || [];

    // load workspace files
    for (const folder of workspaceFolders) {
        if (!isValidDir(folder.uri.fsPath)) {
            vscode.window.showWarningMessage(`Workspace folder does not exist or is not accessible: ${folder.uri.fsPath}`);
            continue;
        }
        const workspace = new PZWorkspace(folder.uri, WorkspaceType.WORKSPACE, diagnosticProvider);
        await workspace.load();
    }

    // validate workspace files
    PZWorkspace.validateAll();
}



function isValidDir(dir: string): boolean {
    const normalizedDir = path.normalize(dir);
    try {
        if (!fs.existsSync(normalizedDir)) {
            console.warn(`Directory does not exist: ${normalizedDir}`);
            return false;
        }
        if (!fs.statSync(normalizedDir).isDirectory()) {
            console.warn(`Path is not a directory: ${normalizedDir}`);
            return false;
        }
        return true;
    } catch (error) {
        console.warn(`Error accessing directory: ${normalizedDir}`, error);
        return false;
    }
}
