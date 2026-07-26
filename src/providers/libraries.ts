import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DiagnosticProvider, updateDiagnostics, validateLaterDocuments } from './diagnostic';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile } from '../scriptsBlocks/scriptsBlocksData';


export function handleOpenTextDocument(document: vscode.TextDocument): Thenable<vscode.TextDocument> | vscode.TextDocument {
    // console.debug(`Handling opened document: ${document.fileName} with languageId: ${document.languageId}`);
    if (
        document.languageId === LANG_ZEDSCRIPTS
    ) { return document; }

    const filePath = path.posix.normalize(document.fileName);

    if (testForScriptRootFile(filePath)) {
        // console.debug(`The opened file is identified as a script file: `, filePath);
        
        // set the file to ZedScripts
        return vscode.languages.setTextDocumentLanguage(document, LANG_ZEDSCRIPTS);
    }

    return document;
}

export async function loadEnvironment(diagnosticProvider: DiagnosticProvider): Promise<void> {
    console.debug("Loading libraries and workspace...");

    // list the folders of the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePaths = workspaceFolders ? workspaceFolders.map(folder => folder.uri.fsPath) : [];
    const validWorkspaceDirs = filterDirs(workspacePaths);

    const config = vscode.workspace.getConfiguration("ZedScripts");
    const libraryDirs: string[] = config.get("searchDirectories", []);

    // filter by verifying the directory exists and is accessible
    const validLibraryDirs: string[] = filterDirs(libraryDirs);


    // get workspace files
    const workspaceFiles = await getTxtFiles(validWorkspaceDirs);

    // get library files
    const libraryFiles = await getTxtFiles(validLibraryDirs);

    // remove files that are in the workspaceFiles from libraryFiles
    const nonWorkspaceLibraryFiles = libraryFiles
        .filter(file => !workspaceFiles.some(workspaceFile => workspaceFile.fsPath === file.fsPath));

    // parse libraries
    await parseFiles(nonWorkspaceLibraryFiles)
        .catch(error => {
            console.error(`Error parsing library files:`, error);
        });
    console.debug(`Finished parsing library files (${nonWorkspaceLibraryFiles.length}).`);

    // parse workspace
    await parseFiles(workspaceFiles, diagnosticProvider)
        .catch(error => {
            console.error(`Error parsing workspace files:`, error);
        });
    console.debug(`Finished parsing workspace files (${workspaceFiles.length}).`);

    // run validate later for all docs that were just updated
    validateLaterDocuments();
}







/**
 * Pre filter the directories by verifying they exist and are accessible
 */
export function filterDirs(dirs: string[]): string[] {
    return dirs.filter(dir => {
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
    });
}

async function getTxtFiles(dirs: string[]): Promise<vscode.Uri[]> {
    const files: vscode.Uri[] = [];
    for (const dir of dirs) {
        const dirFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(dir, "**/*.txt")
        );
        files.push(...dirFiles);
    }
    return files;
}

/**
 * Parse all .txt files in the given directory and its subdirectories
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
            updateDiagnostics(resolvedDocument, diagnosticProvider);
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