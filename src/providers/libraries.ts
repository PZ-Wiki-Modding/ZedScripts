import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DiagnosticProvider } from './diagnostic';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile } from '../scriptsBlocks/scriptsBlocksData';
import { PZWorkspace, WorkspaceType } from '../workspace/workspace';


export function handleOpenTextDocument(document: vscode.TextDocument): Thenable<vscode.TextDocument> | vscode.TextDocument {
    // skip if already a ZedScripts document
    if (document.languageId === LANG_ZEDSCRIPTS) { return document; }

    const filePath = path.posix.normalize(document.fileName);

    if (testForScriptRootFile(filePath)) {        
        // set the file to ZedScripts
        return vscode.languages.setTextDocumentLanguage(document, LANG_ZEDSCRIPTS);
    }

    return document;
}

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
    } catch {
        vscode.window.showWarningMessage(`Directory does not exist or is not accessible: ${normalizedDir}`);
        return false;
    }
}


async function getTxtFiles(dirs: string[], acceptManual: boolean = false): Promise<vscode.Uri[]> {
    // use a map to avoid duplicates
    const files: Map<string, vscode.Uri> = new Map();
    for (const dir of dirs) {
        const dirFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(dir, "**/*.{txt,info}")
        );
        for (const file of dirFiles) {
            files.set(file.path, file);
        }
    }
    
    // convert the map to an array
    const allFiles = Array.from(files.values());

    // filter out files inside the following folders by checking if they are valid script files
    const filteredFiles: vscode.Uri[] = [];
    for (const file of allFiles) {
        const filePath = file.path;
        const document = await vscode.workspace.openTextDocument(filePath);
        if (acceptManual && document.languageId === LANG_ZEDSCRIPTS) {
            filteredFiles.push(file);
            continue;
        }
        if (testForScriptRootFile(filePath) !== null) {
            filteredFiles.push(file);
        }
    }

    return filteredFiles;
}

/**
 * Parse all script files in the given directory and its subdirectories
 */
export async function parseFiles(files: vscode.Uri[], diagnosticProvider?: DiagnosticProvider): Promise<void> {
    // parse each file
    let i = 0;
    let lastR = 0;
    const totalFiles = files.length;
    for (const file of files) {
        // update the file language if it is a valid script file
        const document = await vscode.workspace.openTextDocument(file);
        const result = handleOpenTextDocument(document);
        const resolvedDocument = result instanceof Promise ? await result : result;

        // if the file is a script file, parse it
        try {
            // updateDiagnostics(resolvedDocument, diagnosticProvider);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : 'No stack trace';
            console.error(
                `Error updating diagnostics for file ${file.fsPath}:\n` +
                `Message: ${errorMessage}\n` +
                `Stack: ${errorStack}`
            );
        }

        // log progress every 10%
        i++;
        const r = Math.round((i / totalFiles) * 100);
        if (r > lastR+10) {
            console.debug(`${r}%`);
            lastR += 10;
        }
    }
}