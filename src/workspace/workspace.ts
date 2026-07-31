import * as vscode from 'vscode';
import * as path from "path";

import { DiagnosticProvider } from '../providers/diagnostic';
import { findWorkspaceVersion, Version, VersionType } from './version';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile, DEFAULT_ROOT_FILE } from "../scriptsBlocks/scriptsBlocksData";

import { ScriptsBlock } from '../scriptsBlocks/scriptsBlocks';
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';
import { testForZedScripts, ResultResolvedDocument } from '../scriptsBlocks/scriptsBlocksUtility';


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

export class PZWorkspace {
// MEMBERS
    folder: vscode.Uri;
    type: WorkspaceType;
    diagnosticProvider?: DiagnosticProvider;

    versions: Map<Version, Map<string, DocumentBlock>> = new Map();

    /** Cache of workspaces by folder path */
    static workspaceCache: Map<WorkspaceType, Map<string, PZWorkspace>> = new Map();
    /** Maps document file paths to their corresponding workspace for easy access */
    static fileToWorkspaceMap: Map<string, PZWorkspace> = new Map();
    
    /** Workspace instance for solitary files, the uri is a placeholder */
    static solitaryWorkspace = new PZWorkspace(vscode.Uri.file("solitary"), WorkspaceType.SOLITARY);


// CONSTRUCTOR

    constructor(folder: vscode.Uri, type: WorkspaceType, diagnosticProvider?: DiagnosticProvider) {
        this.folder = folder;
        this.type = type;

        // only register diagnostics for workspace type, not library type
        if (type === WorkspaceType.WORKSPACE) {
            this.diagnosticProvider = diagnosticProvider;
        }
        
        // cache this workspace
        if (!PZWorkspace.workspaceCache.has(type)) {
            PZWorkspace.workspaceCache.set(type, new Map());
        }
        PZWorkspace.workspaceCache.get(type)?.set(folder.toString(), this);
    }


// WORKSPACE LOADERS

    public async load(): Promise<void> {
        // solitary workspaces should not load anything since the folder is a placeholder
        if (this.type === WorkspaceType.SOLITARY) {
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
        const uniqueFiles = Array.from(files.values());
        
        // parse each file
        let i = 0;
        let lastR = 0;
        const totalFiles = uniqueFiles.length;
        for (const file of uniqueFiles) {
            await this.loadFile(file);

            // log progress every 10%
            i++;
            const r = Math.round((i / totalFiles) * 100);
            if (r > lastR+10) {
                console.debug(`${r}%`);
                lastR += 10;
            }
        }
        console.debug(`Loaded ${totalFiles} files from workspace: ${this.type}`);
    }

    public async loadFile(file: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(file);
        // const result = handleOpenTextDocument(document);
        // const resolvedDocument = result instanceof Promise ? await result : result;
        await this.loadDocument(document);
    }

    public async loadDocument(document: vscode.TextDocument): Promise<DocumentBlock | void> {
        const result = await testForZedScripts(document);
        if (!result) { return; }

        return this.addDocument(result);
    }

    public addDocument(result: ResultResolvedDocument): DocumentBlock | void {
        // retrieve the version and pass if B41, they are not supported
        const version = findWorkspaceVersion(result.path);
        if (version.type === VersionType.PRE_42) { return; }

        // retrieve the diagnostics to add
        const diagnostics: vscode.Diagnostic[] | undefined = this.diagnosticProvider ? [] : undefined;

        // create a DocumentBlock which will parse this file for script blocks and parameters
        const documentBlock = new DocumentBlock(result.document, diagnostics, result.type, this, version);
        if (!this.versions.has(version)) {
            this.versions.set(version, new Map());
        }
        this.versions.get(version)?.set(result.path, documentBlock);

        // cache the document to workspace mapping for easy access later
        PZWorkspace.fileToWorkspaceMap.set(result.path, this);

        return documentBlock;
    }

    /** Solitary documents are documents that are not part of a workspace */
    public static addNewSolitaryDocument(result: ResultResolvedDocument): DocumentBlock | void {
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
        const result = await testForZedScripts(document);
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
        if (this.type !== WorkspaceType.WORKSPACE) {
            return;
        }

        // recursively validate all document blocks in this workspace
        for (const documentBlock of this.getAllDocuments()) {
            documentBlock.validateRecursive();
            const diagnostics = documentBlock.diagnostics;
            if (diagnostics) {
                this.diagnosticProvider?.diagnosticCollection.set(documentBlock.document.uri, diagnostics);
            }
        }
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

    public findBlockFromFullType(
        version: Version,
        expectedBlock: string, 
        modules: string[], 
        id: string): ScriptsBlock[] 
    {
        const result: ScriptsBlock[] = [];

        // if this is a version workspace (4*.*), we need to search in this single workspace documents
        // if (version.usesVersioning) {
            PZWorkspace.findBlockFromFullTypeInVersion(
                version, expectedBlock, modules, id
            ).forEach(block => result.push(block));
        // }

        // // we also search in the common workspace documents
        // PZWorkspace.findBlockFromFullTypeInVersion(
        //     Version.COMMON, expectedBlock, modules, id
        // ).forEach(block => result.push(block));

        // // we also search in the base game workspace documents
        // PZWorkspace.findBlockFromFullTypeInVersion(
        //     Version.BASE_GAME, expectedBlock, modules, id
        // ).forEach(block => result.push(block));

        // // then finally search in any versioning
        // PZWorkspace.findBlockFromFullTypeInVersion(
        //     Version.ANY, expectedBlock, modules, id
        // ).forEach(block => result.push(block));

        if (expectedBlock === "animationsMesh") {
            console.debug(`Found ${result.length} blocks for ${expectedBlock} in workspace ${this.folder.fsPath}`);
        }

        return result;
    }

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
