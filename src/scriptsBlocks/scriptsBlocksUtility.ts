import * as vscode from "vscode";

import { testForScriptRootFile } from "./scriptsBlocksData";
import { DEFAULT_ROOT_FILE, ScriptBlockData, ScriptBlockParameter, SCRIPTS_TYPES_LOWER } from "./scriptsBlocksData";
import { preparePath } from "../utils/paths";
import { LANG_ZEDSCRIPTS } from "../project";


export function isScriptBlock(word: string): boolean {
    return word.toLowerCase() in SCRIPTS_TYPES_LOWER;
}

/**
* Retrieve the script block data for a given block type
* @param blockType The script block type
* @returns ScriptBlockData | null
*/
export function getScriptBlockData(blockType: string): ScriptBlockData {
    if (!isScriptBlock(blockType)) {
        throw new Error(`Block type ${blockType} is not a valid script block type. Ensure to check with isScriptBlock() before getting block data.`);
    }
    const blockData =   SCRIPTS_TYPES_LOWER[blockType.toLowerCase()] as ScriptBlockData;
    return blockData;
}

export function canHaveParent(blockType: string, parentType: string): boolean {
    const blockData = getScriptBlockData(blockType);
    // if (!blockData.shouldHaveParent && blockType === DOCUMENT_IDENTIFIER) {
    //     return true;
    // }
    return blockData.parents.includes(parentType);
}

export function shouldHaveID(blockType: string, parentType: string): boolean {
    const blockData = getScriptBlockData(blockType);
    const IDData = blockData.ID;
    if (!IDData) { return false; }

    return shouldChildrenHaveID(blockType, parentType);
}

export function shouldChildrenHaveID(blockType: string, parentType: string): boolean {
    const childrenBlockData = getScriptBlockData(blockType);
    const IDData = childrenBlockData.ID;
    if (!IDData) { return false; }

    // used to check if the parent block requires an ID for this subblock
    const invalidBlocks = IDData.parentsWithout;
    let shouldHaveIDfromParent = true;
    if (invalidBlocks) {
        if (invalidBlocks.includes(parentType)) {
            shouldHaveIDfromParent = false;
        }
    }

    return shouldHaveIDfromParent;
}

export function listRequiredParameters(blockType: string): ScriptBlockParameter[] {
    const blockData = getScriptBlockData(blockType);
    const requiredParams: ScriptBlockParameter[] = [];
    for (const paramName in blockData.parameters) {
        const param = blockData.parameters[paramName];
        if (param.required) {
            requiredParams.push(param);
        }
    }
    return requiredParams;
}

export function getMainVariant(blockType: string): string {
    const blockData = getScriptBlockData(blockType);
    const variant = blockData.isVariant;
    if (variant) {
        return getMainVariant(variant);
    }
    return blockType;
}

export function getVariantTree(blockType: string): string[] {
    const tree: string[] = [];
    const blockData = getScriptBlockData(blockType);
    const variant = blockData.isVariant;
    if (variant) {
        const treeVariant = getVariantTree(variant);
        tree.push(...treeVariant);
        // tree.push(variant);
    }

    tree.push(blockType);
    
    return tree;
}




// document handler

export interface ResultResolvedDocument {
    document: vscode.TextDocument;
    type: string;
    path: string;
}


export function reopenFile(document: vscode.TextDocument): Thenable<vscode.TextDocument> {
    return vscode.languages.setTextDocumentLanguage(document, LANG_ZEDSCRIPTS);
}

export async function testForZedScripts(document: vscode.TextDocument): 
    Promise<ResultResolvedDocument | null> 
{
    const filePath = preparePath(document.fileName); // unix-style path
    
    // retrieve the type of root file
    let type = testForScriptRootFile(filePath);

    // if no type is found, check if the document is forced to be ZedScripts
    const isZedScripts = document.languageId === LANG_ZEDSCRIPTS;
    if (!type && isZedScripts) {
        type = DEFAULT_ROOT_FILE;
    }

    // skip non-script files
    if (!type) { return null; }

    // reopen file as ZedScripts if needed
    let resolvedDocument = document;
    if (!isZedScripts) {
        const newDoc = reopenFile(document);
        resolvedDocument = await newDoc;
    }

    return { document: resolvedDocument, type, path: filePath };
}