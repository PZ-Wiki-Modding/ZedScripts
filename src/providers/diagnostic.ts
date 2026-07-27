import * as vscode from "vscode";
import { TextDocument, DiagnosticSeverity, Diagnostic, Range } from "vscode";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";
import { testForScriptRootFile, DEFAULT_ROOT_FILE } from "../scriptsBlocks/scriptsBlocksData";

import { LANG_ZEDSCRIPTS, EXTENSION_ID } from "../project";
import { DiagnosticType, formatText } from "../models/enums";
import { handleOpenTextDocument } from "./libraries";


export function diagnosticNonLibrary(document: TextDocument, diagnosticProvider: DiagnosticProvider): void {
    handleOpenTextDocument(document);
    const block = diagnosticProvider.updateDiagnostics(document);
    if (block instanceof DocumentBlock) {
        block.validateRecursive();
        // set diagnostics after validateRecursiveLater completes so validateLater diagnostics are included
        const diagnostics = block.diagnostics;
        if (diagnostics) {
            diagnosticProvider.diagnosticCollection.set(document.uri, diagnostics);
        }
    }
}


export class DiagnosticProvider {
    // Static cache for DocumentBlock instances
    public diagnosticCollection: vscode.DiagnosticCollection;
    
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_ID);
    }
    
    public updateDiagnostics(document: vscode.TextDocument): DocumentBlock | void {
    // console.debug(`Updating diagnostics for document: ${document.fileName}`);
        return updateDiagnostics(document, this);
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
export const DIAGNOSTIC_PROVIDER = new DiagnosticProvider();

/**
 * Updates diagnostics for a given document. If the document is of the correct language, it creates a DocumentBlock
 * and validates it, which will populate the diagnostics. If the document is not of the correct language,
 * it clears any existing diagnostics for that document.
 * 
 * If no diagnosticProvider is provided, it will not store any diagnostics
 * but will still parse the document
 */
export function updateDiagnostics(
    document: vscode.TextDocument, 
    diagnosticProvider: DiagnosticProvider|undefined = undefined
): DocumentBlock | void {
    if (document.languageId === LANG_ZEDSCRIPTS) {
        const diagnostics: vscode.Diagnostic[] | undefined = diagnosticProvider ? [] : undefined;

        const path = document.fileName;
        const type = testForScriptRootFile(path) || DEFAULT_ROOT_FILE;

        const block = new DocumentBlock(document, diagnostics, type);
        if (diagnostics) {
            diagnosticProvider?.diagnosticCollection.set(document.uri, diagnostics);
        }
        return block;
    } else {
        // Clear diagnostics for unsupported languages
        diagnosticProvider?.diagnosticCollection.delete(document.uri);
    }
    return;
}









// Diagnostic helpers
export function diagnostic(
    document: TextDocument,
    diagnostics: Diagnostic[] | undefined,
    type: DiagnosticType | string,
    params: Record<string, string>,
    index_start: number, index_end: number = index_start,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
): vscode.Diagnostic | false {
    // skip diagnostics if no diagnostics array is provided
    // used to not store any diagnostics for files that need to be parsed without the intention of showing diagnostics
    // such as library files
    if (!diagnostics) { return false; }

    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    // Skip all diagnostics if the master switch is on
    if (config.get("disableAllDiagnostics")) {
        return false;
    }

    // Check if this diagnostic type is disabled in configuration
    const disabledDiagnostics: string[] = config.get("disabledDiagnostics") || [];
    
    // Find the key name for this diagnostic type value
    const diagnosticKey = Object.entries(DiagnosticType).find(([_, value]) => value === type)?.[0];
    if (diagnosticKey && disabledDiagnostics.includes(diagnosticKey)) {
        return false; // Skip adding this diagnostic
    }

    const positionStart = document.positionAt(index_start);
    const positionEnd = document.positionAt(index_end);
    const message = formatText(type, params);
    const diagnostic = new Diagnostic(
        new Range(positionStart, positionEnd),
        message,
        severity
    );
    diagnostics.push(diagnostic);
    // console.warn(message);
    return diagnostic;
}

export function validateLaterDocuments(): void {
    // run validateRecursiveLater on all cached document blocks
    for (const documentBlock of DocumentBlock.documentBlockCache.values()) {
        documentBlock.validateRecursive();
        const document = documentBlock.document;
        const diagnostics = documentBlock.diagnostics;
        if (diagnostics) {
            DIAGNOSTIC_PROVIDER.diagnosticCollection.set(document.uri, diagnostics);
        }
    }
}