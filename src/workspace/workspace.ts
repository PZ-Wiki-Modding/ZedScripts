import * as vscode from 'vscode';
import * as path from "path";

import { DiagnosticProvider } from '../providers/diagnostic';
import { findWorkspaceVersion, Version, VersionType } from './version';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile, DEFAULT_ROOT_FILE } from "../scriptsBlocks/scriptsBlocksData";

import { ScriptsBlock } from '../scriptsBlocks/scriptsBlocks';
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';
import { testAndReloadZedScripts, testZedScripts, ResultZedScripts, reopenFile } from '../scriptsBlocks/scriptsBlocksUtility';

import { ZSEnv } from '../extension';

function preparePath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/'); // normalize to unix-style path
    return path.posix.normalize(normalizedPath); // resolve relative segments
}

export enum WorkspaceType {
    LIBRARY = "library",
    WORKSPACE = "workspace",

    /** Files that are not opened as part of a workspace or library but should still be validated. */
    SOLITARY = "solitary",
}

interface PreloadedFile {
    type: string;
    file: vscode.Uri;
    preparedPath: string;
}

export class PZWorkspace {
// MEMBERS
    folder: vscode.Uri;
    workspaceType: WorkspaceType;
    diagnosticProvider?: DiagnosticProvider;

    preloadedFiles: PreloadedFile[] = [];
    versions: Map<Version, Map<string, DocumentBlock>> = new Map();

    // status bar
    isLoading: boolean = false;
    loadingPosition: number = 0;
    loadingCount: number = 0;
    finalLoadedCount: number = 0;
    isLoaded: boolean = false;

    /** Cache of workspaces by folder path */
    static workspaceCache: Map<WorkspaceType, Map<string, PZWorkspace>> = new Map();
    /** Maps document file paths to their corresponding workspace for easy access */
    static fileToWorkspaceMap: Map<string, PZWorkspace> = new Map();
    
    /** Workspace instance for solitary files, the uri is a placeholder */
    static solitaryWorkspace = new PZWorkspace(vscode.Uri.file("solitary"), WorkspaceType.SOLITARY);


// CONSTRUCTOR

    constructor(folder: vscode.Uri, workspaceType: WorkspaceType, diagnosticProvider?: DiagnosticProvider) {
        this.folder = folder;
        this.workspaceType = workspaceType;

        // only register diagnostics for workspace type, not library type
        if (workspaceType === WorkspaceType.WORKSPACE) {
            this.diagnosticProvider = diagnosticProvider;
        }
        
        // cache this workspace
        if (!PZWorkspace.workspaceCache.has(workspaceType)) {
            PZWorkspace.workspaceCache.set(workspaceType, new Map());
        }
        PZWorkspace.workspaceCache.get(workspaceType)?.set(folder.toString(), this);
    }


// WORKSPACE LOADERS

    /**
     * The reason we preload files is to avoid loading the same files and to only load
     * files that are valid ZedScripts files. For example, plenty of .txt files are not ZedScripts files
     * so we preload them by filtering them out first.
     * 
     * This is mostly for the status bar to show the actual proper amount of script files that are being loaded.
     */
    public async preload(): Promise<void> {
        // solitary workspaces should not load anything since the folder is a placeholder
        if (this.workspaceType === WorkspaceType.SOLITARY) {
            console.debug("Solitary workspace does not load files.");
            return;
        }

        // retrieve all unique txt and info files in the workspace folder
        const dirFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(this.folder, "**/*.{txt,info}")
        );
        const files: Map<string, vscode.Uri> = new Map();
        for (const file of dirFiles) {
            files.set(file.fsPath, file);
        }
        let uniqueFiles = Array.from(files.values());

        // if this is a library
        // we remove the files that are already handled by the workspace
        // the workspace files are preloaded already at this point
        if (this.workspaceType === WorkspaceType.LIBRARY) {
            const workspaces = PZWorkspace.workspaceCache.get(WorkspaceType.WORKSPACE) || new Map();
            for (const workspace of workspaces.values()) {
                const preloadedFiles = workspace.preloadedFiles;
                for (const preloadedFile of preloadedFiles) {
                    // compare file to remove duplicates
                    uniqueFiles = uniqueFiles.filter(file => file.fsPath !== preloadedFile.file.fsPath);
                }
            }
        }
        
        // we only keep files that are recognized as ZedScripts files
        const recognizedFiles: PreloadedFile[] = [];
        let lastR = 0;
        this.isLoaded = false; // mark as not loaded until the load() function is called
        this.isLoading = true;
        this.loadingPosition = 0;
        this.loadingCount = uniqueFiles.length;
        for (const file of uniqueFiles) {
            const document = await vscode.workspace.openTextDocument(file);
            const result = testZedScripts(document);
            if (result) {
                recognizedFiles.push({type: result.type, file: file, preparedPath: result.preparedPath});
            }
            this.loadingPosition++;
            const r = Math.round((this.loadingPosition / this.loadingCount) * 100);
            if (r > lastR+10) {
                // console.debug(`${r}%`);
                lastR += 10;
                ZSEnv.updateStatusBar();
            }
        }
        this.isLoading = false;
        this.preloadedFiles = recognizedFiles;
    }

    /**
     * Finally load all the preloaded files into the workspace.
     */
    public async load(): Promise<void> {
        this.loadingCount = this.preloadedFiles.length;

        if (this.loadingCount === 0) {
            console.debug(`No ZedScripts files found in ${this.workspaceType}: ${this.folder.fsPath}`);
            return;
        }

        // parse each file
        let lastR = 0;
        this.isLoading = true;
        this.loadingPosition = 0;
        for (const fileData of this.preloadedFiles) {
            // load the document
            const document = await vscode.workspace.openTextDocument(fileData.file);
            const result = {document: document, type: fileData.type, preparedPath: fileData.preparedPath};

            // reopen file as ZedScripts if needed
            if (!(document.languageId === LANG_ZEDSCRIPTS)) {
                const newDoc = reopenFile(document);
                result.document = await newDoc;
            }

            // add to workspace
            this.addDocument(result);

            // log progress every 10%
            this.loadingPosition++;
            const r = Math.round((this.loadingPosition / this.loadingCount) * 100);
            if (r > lastR+10) {
                // console.debug(`${r}%`);
                lastR += 10;
                ZSEnv.updateStatusBar();
            }
        }
        this.isLoading = false;

        // conclude loading
        this.isLoaded = true;
        this.preloadedFiles = []; // clear preloaded files cache
        this.finalLoadedCount = this.loadingCount;
        console.debug(`Loaded ${this.loadingCount} files from workspace: ${this.workspaceType}`);
    }

    /**
     * Adds a new document to the workspace, creating a DocumentBlock for it.
     * If the document is a pre-42 file, we skip it as they are not supported.
     * @param result The result object containing the document and its metadata which was preloaded.
     * @returns The created DocumentBlock, or void if the document was skipped.
     */
    public addDocument(result: ResultZedScripts): DocumentBlock | void {
        // retrieve the version and pass if B41, they are not supported
        const version = findWorkspaceVersion(result.preparedPath);
        if (version.type === VersionType.PRE_42) { return; }

        // retrieve the diagnostics to add
        const diagnostics: vscode.Diagnostic[] | undefined = this.diagnosticProvider ? [] : undefined;

        // create a DocumentBlock which will parse this file for script blocks and parameters
        const documentBlock = new DocumentBlock(result.document, diagnostics, result.type, this, version);
        if (!this.versions.has(version)) {
            this.versions.set(version, new Map());
        }
        this.versions.get(version)?.set(result.preparedPath, documentBlock);

        // cache the document to workspace mapping for easy access later
        PZWorkspace.fileToWorkspaceMap.set(result.preparedPath, this);

        return documentBlock;
    }

    /** Solitary documents are documents that are not part of a workspace */
    public static addNewSolitaryDocument(result: ResultZedScripts): DocumentBlock | void {
        // add the document to the solitary workspace
        return PZWorkspace.solitaryWorkspace.addDocument(result);
    }

    /** Find the workspace handling the given document */
    public static get(document: vscode.TextDocument): PZWorkspace | undefined {
        const filePath = preparePath(document.fileName);
        const existing = PZWorkspace.fileToWorkspaceMap.get(filePath);
        if (existing) {
            return existing;
        }

        // if no workspace is found, check if the document is part of a workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder) {
            const typeMap = PZWorkspace.workspaceCache.get(WorkspaceType.WORKSPACE);
            if (typeMap) {
                return typeMap.get(workspaceFolder.uri.toString());
            }
        }

        return PZWorkspace.fileToWorkspaceMap.get(filePath);
    }

    /**
     * Try to open the document as a ZedScripts document
     * If that doesn't work, we skip it
     * @param document
     * @param diagnosticProvider
     * @returns The corresponding DocumentBlock if applicable, otherwise void.
     */
    public static async update(document: vscode.TextDocument, diagnosticProvider?: DiagnosticProvider): Promise<DocumentBlock | void> {
        // check if the document is a ZedScripts document
        const result = await testAndReloadZedScripts(document);
        if (!result) {
            // clear diagnostics in case this file had been previously recognized as a ZedScripts document
            diagnosticProvider?.diagnosticCollection.delete(document.uri); 
            return; 
        }

        // try to retrieve the workspace of this document
        const resolvedDocument = result.document;
        const workspace = PZWorkspace.get(resolvedDocument);
        
        // if no workspace is handling this file, we try to mark it as a solitary file
        let documentBlock: DocumentBlock | void;
        if (!workspace) {
            documentBlock = PZWorkspace.addNewSolitaryDocument(result);
        } else {
            documentBlock = workspace.addDocument(result);
        }

        // run diagnostics of the document
        documentBlock?.validateRecursive();

        return documentBlock;
    }


// WORKSPACE MANAGEMENT

    /**
     * Retrieve the workspace associated with a given document, if any
     * @param document
     * @returns The corresponding PZWorkspace if found, otherwise undefined.
     */
    public static getWorkspaceForDocument(document: vscode.TextDocument): PZWorkspace | undefined {
        const filePath = preparePath(document.fileName);
        return PZWorkspace.fileToWorkspaceMap.get(filePath);
    }

    public static getAllWorkspaces(): PZWorkspace[] {
        const allWorkspaces: PZWorkspace[] = [];
        for (const typeMap of PZWorkspace.workspaceCache.values()) {
            allWorkspaces.push(...typeMap.values());
        }
        return allWorkspaces;
    }

    public getAllDocuments(version: Version | undefined = undefined): DocumentBlock[] {
        const result: DocumentBlock[] = [];
        for (const [ver, documentBlocks] of this.versions.entries()) {
            if (!version || ver.toStringSafe() === version.toStringSafe()) {
                result.push(...Array.from(documentBlocks.values()));
            }
        }
        return result;
    }

    public static getAllDocumentsPerType(type: WorkspaceType): DocumentBlock[] {
        const result: DocumentBlock[] = [];
        const typeMap = PZWorkspace.workspaceCache.get(type);
        if (!typeMap) { 
            console.error(`Unexpected workspace type: ${type}`);
            return result;
        }
        for (const workspace of typeMap.values()) {
            result.push(...workspace.getAllDocuments());
        }
        return result;
    }

    public static clearCacheForUri(uri: vscode.Uri): void {
        const filePath = preparePath(uri.fsPath);
        const workspace = PZWorkspace.fileToWorkspaceMap.get(filePath);
        if (workspace) {
            const versions = Array.from(workspace.versions.values());
            for (const documentBlocks of versions) {
                documentBlocks.delete(filePath);
            }
            if (workspace.diagnosticProvider) {
                workspace.diagnosticProvider.diagnosticCollection.delete(uri);
            }
        }
        PZWorkspace.fileToWorkspaceMap.delete(filePath);
        DocumentBlock.clearCacheForUri(uri);
    }


// VALIDATORS

    public validate(): void {
        // only validate workspace type
        if (this.workspaceType !== WorkspaceType.WORKSPACE) {
            return;
        }

        // recursively validate all document blocks in this workspace
        const documentBlocks = this.getAllDocuments();
        let lastR = 0;
        this.isLoading = true;
        this.loadingPosition = 0;
        this.loadingCount = documentBlocks.length;
        for (const documentBlock of documentBlocks) {
            documentBlock.validateRecursive();
            const diagnostics = documentBlock.diagnostics;
            if (diagnostics) {
                this.diagnosticProvider?.diagnosticCollection.set(documentBlock.document.uri, diagnostics);
            }
            this.loadingPosition++;
            const r = Math.round((this.loadingPosition / this.loadingCount) * 100);
            if (r > lastR+10) {
                // console.debug(`${r}%`);
                lastR += 10;
                ZSEnv.updateStatusBar();
            }
        }
        this.isLoading = false;
    }

    public static validateAll(type: WorkspaceType = WorkspaceType.WORKSPACE): void {
        // fetch workspace type
        const typeMap = PZWorkspace.workspaceCache.get(type);
        if (!typeMap) {
            console.error(`Unexpected workspace type: ${type}`);
            return;
        }

        // validate all workspaces of this type
        for (const workspace of typeMap.values()) {
            workspace.validate();
        }
    }


// WORKSPACE GETTERS

    public static findBlockFromFullTypeInVersion(
        targetVersion: Version,
        expectedBlock: string, 
        modules: string[], 
        id: string): ScriptsBlock[]
    {
        const result: Set<ScriptsBlock> = new Set();
        
        // skip the provided version if pre-42, this shouldn't happen
        if (targetVersion.isPre42) {
            console.warn(`Searching for blocks in Pre-42 versions is not supported: ${targetVersion.source}`);
            return Array.from(result);
        }

        for (const workspace of PZWorkspace.getAllWorkspaces()) {
            // we search in the common, any and basegame versions
            // since those can be fully loaded by any versionned scripts
            const versions = Array.from(workspace.versions.keys());
            for (const version of versions) {
                if (version.isCommon || version.isAny || version.isBaseGame) {
                    if (workspace.versions.has(version)) {
                        const documentBlocks = workspace.getAllDocuments(version);
                        const foundBlocks = PZWorkspace.findBlockFromFullTypeInAllDocuments(documentBlocks, expectedBlock, modules, id);
                        foundBlocks.forEach(block => result.add(block));
                    }
                }
            }

            // the next step, we remove all the non-versionned scripts
            const filtered = Version.filter(versions);
            if (filtered.length === 0) { continue; } // skip empty workspaces

            // in this workspace, we search for the closest version below the target version, if any
            // if none, then we take the closest upper one
            const closestVersion = targetVersion.findClosestBelow(filtered);
            if (closestVersion) {
                const documentBlocks = workspace.getAllDocuments(closestVersion);
                const foundBlocks = PZWorkspace.findBlockFromFullTypeInAllDocuments(documentBlocks, expectedBlock, modules, id);
                if (foundBlocks.length > 0) {
                    foundBlocks.forEach(block => result.add(block));
                }
            }
        }

        return Array.from(result);
    }

    public static findBlockFromFullTypeInAllDocuments(
        documents: DocumentBlock[],
        expectedBlock: string, 
        modules: string[], 
        id: string): ScriptsBlock[] 
    {
        const foundBlocks: ScriptsBlock[] = [];
        for (const documentBlock of documents) {
            const found = documentBlock.findBlockFromFullTypeInBlock(expectedBlock, modules, id);
            if (found.length > 0) {
                foundBlocks.push(...found);
            }
        }
        return foundBlocks;
    }
}
