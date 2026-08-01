import * as vscode from 'vscode';

import { DiagnosticType } from '../../models/DiagnosticType';
import { ScriptsBlock } from '../scriptsBlocks';
import { ImportsBlock } from './imports';
import { PZWorkspace } from '../../workspace/workspace';
import { Version } from '../../workspace/version';

/**
 * A ScriptBlock that represents the entire document. This is more a convenience class to handle everything easily.
 */
export class DocumentBlock extends ScriptsBlock {
// MEMBERS
    public static documentBlockCache: Map<string, DocumentBlock> = new Map();

    actions: [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] = []; // [range, diagnostic, action]
    workspace: PZWorkspace;
    version: Version;

    constructor(
        document: vscode.TextDocument, 
        diagnostics: vscode.Diagnostic[] | undefined, 
        type: string, 
        workspace: PZWorkspace,
        version: Version
    ) {
        // Only document is provided
        const parent = null;
        const id = null;
        const start = 0;
        const end = document.getText().length;
        super(document, diagnostics, parent, type, id, start, end, start);

        this.workspace = workspace;
        this.version = version;

        // cache this document block
        DocumentBlock.documentBlockCache.set(document.uri.toString(), this);

        this.search(); // search for the blocks and parameters in the document
    }


// CACHE

    // Static method to retrieve cached DocumentBlock
    public static getDocumentBlock(document: vscode.TextDocument): DocumentBlock | undefined {
        const documentBlock = DocumentBlock.documentBlockCache.get(document.uri.toString());
        return documentBlock;
    }

    public static clearCache(): void {
        DocumentBlock.documentBlockCache.clear();
    }

    public static clearCacheForUri(uri: vscode.Uri): void {
        DocumentBlock.documentBlockCache.delete(uri.toString());
    }


// ACTIONS

    public addAction(range: vscode.Range, diagnostic: vscode.Diagnostic, action: vscode.CodeAction): void {
        this.actions.push([range, diagnostic, action]);
    }

    public getActionsForRange(range: vscode.Range): [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] {
        const actions: [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] = [];
        for (const [actionRange, diagnostic, action] of this.actions) {
            if (actionRange.contains(range)) {
                actions.push([actionRange, diagnostic, action]);
            }
        }
        return actions;
    }

    public getHeaderEdits(edits: vscode.TextEdit[]): void {}


// ACCESS

    public static getAllDocumentBlocks(): DocumentBlock[] {
        return Array.from(DocumentBlock.documentBlockCache.values());
    }

    public getBlock(index: number): ScriptsBlock | null {
        // check if index is within this document
        if (index < this.headerStart || index >= this.end) {
            return this;
        }

        // recursive search for the block containing the index
        const searchBlock = (block: ScriptsBlock, level: number = 0): ScriptsBlock | null => {
            for (const child of block.children) {
                if (index >= child.headerStart && index < child.end) {
                    // found a child containing the index, search deeper
                    const found = searchBlock(child, level + 1);
                    return found || child;
                }
            }
            if (level === 0) {
                // if we are at the top level and no child contains the index, return the document block
                return this;
            }
            return null; // no child contains the index
        }
        return searchBlock(this);
    }

    /**
     * Returns all blocks with the expected type (ID) in provided modules in the workspace.
     * @param expectedBlock Expected block type (ex: "model")
     * @param modules Modules we can search in
     * @param id ID of the block we are looking for
     * @returns 
     */
    public findBlockFromFullTypeInWorkspace(
        expectedBlock: string, modules: string[], id: string
    ): ScriptsBlock[] {return PZWorkspace.findBlockFromFullTypeInVersion(this.version, expectedBlock, modules, id);}

    /**
     * Search in this document for a block with the expected ID in the provided modules.
     * @param expectedBlock Expected block type (ex: "model")
     * @param modules Modules we can search in
     * @param id ID of the block we are looking for
     * @returns 
     */
    public findBlockFromFullTypeInBlock(expectedBlock: string, modules: string[], id: string): ScriptsBlock[] {
        // in children, find a module block
        // in theory, it should be unique
        let moduleBlock: ScriptsBlock | null = null;
        for (const child of this.children) {
            if (child.scriptBlock === "module") {
                const childId = child.id;
                if (childId && modules.includes(childId)) {
                    moduleBlock = child;
                    break;
                }
            }
        }

        if (!moduleBlock) {
            return []; // no module block found with the expected module name
        }

        // in the module block, find a block with the expected type and ID
        const found: ScriptsBlock[] = [];
        for (const child of moduleBlock.children) {
            if (child.scriptBlock === expectedBlock) {
                if (child.id === id) {
                    // found a block with the expected type and full type
                    found.push(child);
                }
            }
        }

        return found; // return all found blocks
    }

    public getImports(): string[] {
        // retrieve imports block modules
        const imports: string[] = ['Base']; // Base is always implicitly imported
        for (const child of this.children) {
            if (child instanceof ImportsBlock) {
                imports.push(...child.getImports());
            }
        }
        return imports;
    }

    public static getAllReferences(): Map<ScriptsBlock, vscode.Range[]> {
        const documents = DocumentBlock.getAllDocumentBlocks();
        const allReferences: Map<ScriptsBlock, vscode.Range[]> = new Map();
        for (const document of documents) {
            document.collectReferencedToBlocks(allReferences);
        }
        return allReferences;
    }


// VALIDATORS

    // overwrite validates for this class since the rules aren't the same
    protected validateBlock(): boolean { 
        // count { } pairs to catch extra ones
        let count = 0;
        for (let i = this.start; i < this.end; i++) {
            const char = this.document.getText(new vscode.Range(this.document.positionAt(i), this.document.positionAt(i + 1)));
            if (char === '{') {
                count++;
            } else if (char === '}') {
                count--;
                if (count < 0) {
                    // found a closing bracket without an opening one
                    this.diagnostic(
                        DiagnosticType.UNEXPECTED_CLOSING_BRACKET,
                        {},
                        i,
                        i + 1,
                        vscode.DiagnosticSeverity.Error
                    );
                }
            }
        }

        if (count < 0) { return false; } // already reported an error

        return true; 
    }
    // protected validateChildren(): boolean { return true; } // some documents might need children
    protected validateID(): boolean { return true; }
    // protected findParameters(): ScriptParameter[] { return []; }


// EXPORTS
    public gatherExports(): Record<string, unknown> {
        const exports: Record<string, unknown> = {};
        for (const child of this.children) {
            if (child.id) {
                exports[child.id] = child.export();
            }
        }
        return exports;
    }

    public static exportAll(): Record<string, unknown> {
        const allExports: Record<string, unknown> = {};
        for (const documentBlock of DocumentBlock.documentBlockCache.values()) {
            allExports[documentBlock.document.uri.toString()] = documentBlock.gatherExports();
        }
        return allExports;
    }

    public export(): Record<string, unknown> {
        const baseExport = super.export();
        baseExport["filePath"] = this.document.uri.fsPath;
        return baseExport;
    }
}
