import * as vscode from "vscode";
import { TextDocument, DiagnosticSeverity, Diagnostic, Range } from "vscode";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";

import { EXTENSION_ID } from "../project";
import { formatText } from "../utils/format";
import { DiagnosticType } from "../models/DiagnosticType";
import { createReferenceDecoration } from '../models/decorations';

import { PZWorkspace } from "../workspace/workspace";



export async function diagnosticFile(document: TextDocument, diagnosticProvider: DiagnosticProvider) {
    // const documentBlock = await PZWorkspace.update(document, diagnosticProvider);
    // // PZWorkspace.validateAll();
    // if (documentBlock) {
    //     documentBlock.validateRecursive();
    //     // set diagnostics after validateRecursiveLater completes so validateLater diagnostics are included
    //     const diagnostics = documentBlock.diagnostics;
    //     if (diagnostics) {
    //         diagnosticProvider.diagnosticCollection.set(document.uri, diagnostics);
    //     }
    // }
    const documentBlock = await diagnosticProvider.updateDiagnostics(document);
    if (documentBlock) {
        documentBlock.validateRecursive();
        const diagnostics = documentBlock.diagnostics;
        if (diagnostics) {
            diagnosticProvider.diagnosticCollection.set(document.uri, diagnostics);
        }
    }
}

export function loadDecorations(document: vscode.TextDocument) {
    const editor = vscode.window.activeTextEditor;

    if (!editor || editor.document !== document) {
        return;
    }

    const documentBlock = DocumentBlock.getDocumentBlock(document);
    if (documentBlock) {
        const references: Map<string, vscode.Range[]> = new Map();
        documentBlock.collectReferencesPerType(references);

        // for each references, create a decoration
        for (const [refType, ranges] of references) {
            const decoration = createReferenceDecoration(refType);
            editor.setDecorations(decoration, ranges);
        }
    };
}


export class DiagnosticProvider {
    // Static cache for DocumentBlock instances
    public diagnosticCollection: vscode.DiagnosticCollection;
    
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(EXTENSION_ID);
    }
    
    public async updateDiagnostics(document: vscode.TextDocument): Promise<DocumentBlock | void> {
    // console.debug(`Updating diagnostics for document: ${document.fileName}`);
        // return updateDiagnostics(document, this);
        return await PZWorkspace.update(document, this);
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
export const DIAGNOSTIC_PROVIDER = new DiagnosticProvider();




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