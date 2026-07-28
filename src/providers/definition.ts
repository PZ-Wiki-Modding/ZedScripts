import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { DEFAULT_DIR } from "../project";

import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";
import { ScriptParameter } from "../scriptsBlocks/scriptsBlocksParameter";


export async function provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
): Promise<vscode.Definition | undefined> {
    const range = document.getWordRangeAtPosition(position, /\b\S+(?:\.\S+)?\b/i);
    if (!range) return;
    
    // only proceed if the document has been parsed
    const documentBlock = DocumentBlock.getDocumentBlock(document);
    if (!documentBlock) return;

    // retrieve the block at the position of the word
    const block = documentBlock.getBlock(document.offsetAt(position));
    if (!block) return;

    const word = document.getText(range);

    // 1. find if the word is part of a parameter value pair
    const param = block.getParameterByIndex(document.offsetAt(position));
    if (param) {
        // check if the word is the value of the parameter
        if (param.value && param.value.toLowerCase() === word.toLowerCase()) {
            // provide reference definition if available
            const loc = provideReferenceDefinition(param);
            if (loc) { return loc; }
        }
    };

    // 2. find references to a block ID
    const references = DocumentBlock.getAllReferences();
    if (block.isWord(word) || block.isID(word)) {
        const range: vscode.Range[] = [];
        for (const refBlock of references) {
            if (refBlock[0] === block) {
                range.push(...refBlock[1]);
            }
        }
        const loc = range.map(r => new vscode.Location(document.uri, r));
        return loc;
    }
}


export function provideReferenceDefinition(param: ScriptParameter): vscode.Location[] | undefined {
    if (param.ref) {
        const loc: vscode.Location[] = [];
        for (const refBlock of param.ref.blocks) {
            loc.push(refBlock.getDefinitionLocation());
        }
        return loc;
    }
    return undefined;
}
