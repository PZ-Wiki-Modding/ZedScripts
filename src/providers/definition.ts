import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { DEFAULT_DIR } from "../project";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";


export async function provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
): Promise<vscode.Definition | undefined> {
    const range = document.getWordRangeAtPosition(position, /\b\S+(?:\.\S+)?\b/i);
    if (!range) return;
    
    // only proceed if the document has been diagnosed and parsed
    const documentBlock = DocumentBlock.getDocumentBlock(document);
    if (!documentBlock) return;

    // retrieve the block at the position of the word
    const block = documentBlock.getBlock(document.offsetAt(position));
    if (!block) return;

    // find if the word is part of a parameter value pair
    const param = block.getParameterByIndex(document.offsetAt(position));
    if (!param) return;

    // 1. check if the word is a value of that parameter
    const word = document.getText(range);
    if (param.value && param.value.toLowerCase() === word.toLowerCase()) {
        // return the location to the ref if any
        if (param.ref) {
            const loc: vscode.Location[] = [];
            for (const refBlock of param.ref.blocks) {
                loc.push(refBlock.getDefinitionLocation());
            }
            return loc;
        }
    }
}
