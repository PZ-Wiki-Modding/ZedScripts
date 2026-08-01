import * as vscode from "vscode";

import { VALUE_TYPES, ScriptBlockParameter, BLOCK_NAMES } from "../scriptsBlocks/scriptsBlocksData";
import {
    getScriptBlockData, 
    canHaveParent, 
    shouldHaveID,
    listRequiredParameters,
} from "../scriptsBlocks/scriptsBlocksUtility";
import { DocumentBlock } from "../scriptsBlocks/blockTypes/document";

import { CompletionText } from "../models/CompletionText";

import { formatText, getIndentation } from "../utils/format";



export class PZCompletionItemProvider implements vscode.CompletionItemProvider {
    completionLevel: number = 0;
    indentLevel: number = 0;

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const completion: vscode.CompletionItem[] = [];

        // the document has been diagnosed and parsed
        const documentBlock = DocumentBlock.getDocumentBlock(document);
        if (!documentBlock) { return completion; }

        // retrieve the block at the position of the word
        let parentBlock = documentBlock.getBlock(document.offsetAt(position));
        if (!parentBlock) {
            parentBlock = documentBlock;
        }

        // reset completion level and indent level
        this.completionLevel = 0;
        this.indentLevel = 0;

        // parameter completion
        const blockData = getScriptBlockData(parentBlock.scriptBlock);
        for (const paramName in blockData.parameters || {}) {
            const param = blockData.parameters[paramName];
            const canDuplicate = param.allowedDuplicate || false;
            if (canDuplicate || !parentBlock.isParameterOf(paramName)) {
                const item = new vscode.CompletionItem(paramName, vscode.CompletionItemKind.Field);
                item.detail = param.description;
                this.completionLevel++;
                const snippetStr = this.formatParameter(param, this.completionLevel, getIndentation(document).repeat(this.indentLevel));
                item.insertText = new vscode.SnippetString(snippetStr);
                completion.push(item);
            }
        }

        // script block completion
        for (const blockName of BLOCK_NAMES) {
            const blockData = getScriptBlockData(blockName);
            if (!canHaveParent(blockName, parentBlock.scriptBlock)) {
                // skip blocks that cannot be children of the current block
                continue;
            }

            // create completion item
            const item = new vscode.CompletionItem(blockName, vscode.CompletionItemKind.Keyword);

            // retrieve block formatting
            const snippetStr = this.formatBlock(document, blockName, parentBlock.scriptBlock);
            item.insertText = new vscode.SnippetString(snippetStr);
            item.detail = blockData.shortDescription;

            completion.push(item);
        }

        return completion;
    }

    private formatBlock(document: vscode.TextDocument, blockType: string, parentType: string): string {
        const blockData = getScriptBlockData(blockType);

        // init necessary indentations
        const defaultTabs = getIndentation(document);
        const tabs = defaultTabs.repeat(this.indentLevel);
        const parameterTabs = defaultTabs.repeat(this.indentLevel + 1);

        // should have ID ?
        const id = this.formatID(blockType, parentType, this.completionLevel);

        // format block
        let snippetStr = tabs + formatText(
            CompletionText.BLOCK,
            {
                scriptBlock: blockType,
                id: id,
            }, '<', '>'
        )

        // add required parameter
        const requiredParams = listRequiredParameters(blockType);
        for (const param of requiredParams) {
            this.completionLevel++;
            snippetStr += this.formatParameter(param, this.completionLevel, parameterTabs) + '\n';
        }

        // add required children blocks
        const needsChildren = blockData.needsChildren || null;
        if (needsChildren && needsChildren.length > 0) {
            this.indentLevel++;
            for (const childBlock of needsChildren) {
                this.completionLevel++;
                snippetStr += this.formatBlock(document, childBlock, blockType) + '\n';
            }
        }

        // ending
        snippetStr += tabs + CompletionText.END;

        return snippetStr;
    }

    private formatID(blockType: string, parentType: string, completionLevel: number): string {
        const childShouldHaveID = shouldHaveID(blockType, parentType);
        if (!childShouldHaveID) {
            return '';
        }
        return formatText(
            CompletionText.ID,
            { completionLevel: completionLevel.toString() },
            '<', '>'
        );
    }

    private formatParameter(param: ScriptBlockParameter, completionLevel: number, tabs: string): string {
        const name = param.name;
        let defaultValue = param.default || 'value';
        if (param.type?.main === VALUE_TYPES.ARRAY) {
            const separator = param.type.array?.separator;
            defaultValue = (param.default as string[] || ['list']).join(separator);
        }
        return formatText(
            CompletionText.PARAMETER,
            {
                completionLevel: completionLevel.toString(),
                tabs: tabs,
                parameter: name,
                value: defaultValue.toString(),
            }, '<', '>'
        );
    }
}
