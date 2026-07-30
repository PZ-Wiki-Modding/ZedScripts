import * as vscode from 'vscode';
import * as path from "path";

import { DiagnosticProvider } from '../providers/diagnostic';
import { findWorkspaceVersion, Version, VersionType } from './version';
import { LANG_ZEDSCRIPTS } from '../project';
import { testForScriptRootFile, DEFAULT_ROOT_FILE } from "../scriptsBlocks/scriptsBlocksData";
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';


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

    versions: Map<Version, DocumentBlock[]> = new Map();

    /** Cache of workspaces by folder path */
    static workspaceCache: Map<WorkspaceType, Map<string, PZWorkspace>> = new Map();
    /** Maps document file paths to their corresponding workspace for easy access */
    static docToWorkspaceMap: Map<string, PZWorkspace> = new Map();
    
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

// WORKSPACE GETTERS/SETTERS
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

    public reopenFile(document: vscode.TextDocument): Thenable<vscode.TextDocument> {
        return vscode.languages.setTextDocumentLanguage(document, LANG_ZEDSCRIPTS);
    }

    public async loadDocument(document: vscode.TextDocument): Promise<DocumentBlock | void> {
        const filePath = preparePath(document.fileName); // unix-style path

        // retrieve the type of root file
        let type = testForScriptRootFile(filePath);

        // if no type is found, check if the document is forced to be ZedScripts
        const isZedScripts = document.languageId === LANG_ZEDSCRIPTS;
        if (!type && isZedScripts) {
            type = DEFAULT_ROOT_FILE;
        }

        // reopen file as ZedScripts
        let resolvedDocument = document;
        if (type && !isZedScripts) {
            const newDoc = this.reopenFile(document);
            resolvedDocument = newDoc instanceof Promise ? await newDoc : document;
        }

        // skip non-script files
        if (!type) { return; }

        return this.addDocument(resolvedDocument, filePath, type);
    }

    public addDocument(document: vscode.TextDocument, filePath: string, type: string): DocumentBlock | void {
        // retrieve the version and pass if B41, they are not supported
        const version = findWorkspaceVersion(filePath);
        if (version.type === VersionType.PRE_42) { return; }

        // retrieve the diagnostics to add
        const diagnostics: vscode.Diagnostic[] | undefined = this.diagnosticProvider ? [] : undefined;

        // create a DocumentBlock which will parse this file for script blocks and parameters
        const documentBlock = new DocumentBlock(document, diagnostics, type, this);
        if (!this.versions.has(version)) {
            this.versions.set(version, []);
        }
        this.versions.get(version)?.push(documentBlock);

        // cache the document to workspace mapping for easy access later
        PZWorkspace.docToWorkspaceMap.set(filePath, this);

        return documentBlock;
    }

    public static addNewSolitaryDocument(document: vscode.TextDocument): DocumentBlock | void {
        const filePath = preparePath(document.fileName); // unix-style path

        // retrieve the type of root file
        let type = testForScriptRootFile(filePath);

        // if no type is found, check if the document is forced to be ZedScripts
        if (!type && document.languageId === LANG_ZEDSCRIPTS) {
            type = DEFAULT_ROOT_FILE;
        }

        // skip non-script files
        if (!type) { return; }

        // add the document to the solitary workspace
        return PZWorkspace.solitaryWorkspace.addDocument(document, filePath, type);
    }

    /** Find the workspace handling the given document */
    public static get(document: vscode.TextDocument): PZWorkspace | undefined {
        const filePath = preparePath(document.fileName);
        return PZWorkspace.docToWorkspaceMap.get(filePath);
    }

    /** If no workspace is handling this document, it is probably a solitary file */
    public static async getOrCreate(document: vscode.TextDocument): Promise<DocumentBlock | void> {
        const workspace = PZWorkspace.get(document);
        
        // if no workspace is handling this file, we try to mark it as a solitary file
        if (!workspace) {
            return PZWorkspace.addNewSolitaryDocument(document);
        }

        // if a workspace is found, we add the document to it
        return await workspace.loadDocument(document);
    }


    public static async update(document: vscode.TextDocument, diagnosticProvider?: DiagnosticProvider): Promise<DocumentBlock | void> {
        if (document.languageId === LANG_ZEDSCRIPTS) {
            const documentBlock = await PZWorkspace.getOrCreate(document);
            return documentBlock;
        }

        // clear diagnostics for unsupported languages
        diagnosticProvider?.diagnosticCollection.delete(document.uri);
    }

    // public static getAllDocumentBlocks(version: Version): DocumentBlock[] {
        
    // }

    public static getWorkspaceForDocument(document: vscode.TextDocument): PZWorkspace | undefined {
        const filePath = preparePath(document.fileName);
        return PZWorkspace.docToWorkspaceMap.get(filePath);
    }

// VALIDATORS
    public validate(): void {
        // only validate workspace type
        if (this.type !== WorkspaceType.WORKSPACE) {
            return;
        }

        // recursively validate all document blocks in this workspace
        for (const documentBlocks of this.versions.values()) {
            for (const documentBlock of documentBlocks) {
                documentBlock.validateRecursive();
                const diagnostics = documentBlock.diagnostics;
                if (diagnostics) {
                    this.diagnosticProvider?.diagnosticCollection.set(documentBlock.document.uri, diagnostics);
                }
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
}














// export class PZWorkspace_OLD {
// // MEMBERS
//     files: vscode.Uri[];
//     version: Version; // the version of the script files (e.g., 41, 42, 42.1, common ...)
//     documents: Map<string, vscode.TextDocument> = new Map();

//     // static cache of workspaces
//     static workspacesCache: Map<Version, PZWorkspace_OLD> = new Map([
//         [Version.COMMON, new PZWorkspace_OLD([], Version.COMMON)],
//         [Version.ANY, new PZWorkspace_OLD([], Version.ANY)],
//         [Version.PRE_42, new PZWorkspace_OLD([], Version.PRE_42)]
//     ]);

// // CONSTRUCTOR
//     constructor(
//         files: vscode.Uri[],
//         version: Version
//     ) {
//         this.files = files;
//         this.version = version;
//     }
    
    
// // WORKSPACE GETTERS/SETTERS
//     /**
//      * Retrieves the workspace for the given version, or creates a new one if it doesn't exist.
//      */
//     public static getWorkspace(version: Version): PZWorkspace_OLD {
//         if (!PZWorkspace_OLD.workspacesCache.has(version)) {
//             PZWorkspace_OLD.workspacesCache.set(version, new PZWorkspace_OLD([], version));
//         }
//         return PZWorkspace_OLD.workspacesCache.get(version)!;
//     }

//     public static getAllWorkspaces(): PZWorkspace_OLD[] {
//         return Array.from(PZWorkspace_OLD.workspacesCache.values());
//     }

//     public static clearWorkspaces(): void {
//         PZWorkspace_OLD.workspacesCache.clear();
//     }

//     /**
//      * Assigns a file to the workspace for the given version workspace.
//      */
//     public static assignToWorkspace(version: Version, file: vscode.Uri): void {
//         const workspace = PZWorkspace_OLD.getWorkspace(version);
//         if (!workspace.files.includes(file)) {
//             workspace.files.push(file);
//         }
//     }

//     public static assignAllToWorkspace(files: vscode.Uri[]): void {
//         for (const file of files) {
//             const version = findWorkspaceVersion(file);
//             PZWorkspace_OLD.assignToWorkspace(version, file);
//         }
//     }

//     /**
//      * Retrieves the workspace that contains the given file, or creates a new one if it doesn't exist.
//      * @param file The file to find the workspace for
//      */
//     public static getWorkspaceOfFile(file: vscode.Uri): PZWorkspace_OLD {
//         for (const workspace of PZWorkspace_OLD.workspacesCache.values()) {
//             if (workspace.files.includes(file)) {
//                 return workspace;
//             }
//         }

//         // if not found, find the file version and assign it to the appropriate workspace
//         const version = findWorkspaceVersion(file);
//         PZWorkspace_OLD.assignToWorkspace(version, file);
//         return PZWorkspace_OLD.getWorkspace(version);
//     }

//     /**
//      * Retrieves the workspace that contains the common files.
//      */
//     public static getCommon(): PZWorkspace_OLD {
//         return PZWorkspace_OLD.getWorkspace(Version.COMMON);
//     }


// // LOADERS
//     public static loadAllWorkspaces(): void {
//         const workspaces = PZWorkspace_OLD.getAllWorkspaces();
//     }

//     public load(): void {

//     }
// }