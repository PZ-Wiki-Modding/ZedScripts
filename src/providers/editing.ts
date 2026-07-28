import * as vscode from "vscode";
import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";

export function provideDocumentFormattingEdits(
    document: vscode.TextDocument
): vscode.TextEdit[] {
    const block = DocumentBlock.getDocumentBlock(document);
    const edits: vscode.TextEdit[] = [];
    if (block) {
        block.getFormattingEdits(edits);
    }
    return edits;
}
