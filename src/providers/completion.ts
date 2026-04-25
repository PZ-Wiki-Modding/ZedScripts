import {
    TextDocument,
    Position,
    CompletionItem,
    CompletionItemKind,
    SnippetString,
} from "vscode";
import * as vscode from "vscode";
import { VALUE_TYPES, ScriptBlockParameter, BLOCK_NAMES } from "../scriptsBlocks/scriptsBlocksData";
import {
    getScriptBlockData, 
    canHaveParent, 
    shouldHaveID,
    listRequiredParameters,
} from "../scriptsBlocks/scriptsBlocksUtility";
import { DocumentBlock } from "../scriptsBlocks/scriptsBlocks";
import { CompletionText, formatText } from "../models/enums";

export class PZCompletionItemProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: TextDocument,
        position: Position
    ): vscode.ProviderResult<CompletionItem[]> {
        const completion: CompletionItem[] = [];

        // the document has been diagnosed and parsed
        const documentBlock = DocumentBlock.getDocumentBlock(document);
        if (!documentBlock) { return completion; }

        // retrieve the block at the position of the word
        let parentBlock = documentBlock.getBlock(document.offsetAt(position));
        if (!parentBlock) {
            parentBlock = documentBlock;
        }

        // parameter completion
        const blockData = getScriptBlockData(parentBlock.scriptBlock);
        for (const paramName in blockData.parameters || {}) {
            const param = blockData.parameters[paramName];
            const canDuplicate = param.allowedDuplicate || false;
            if (canDuplicate || !parentBlock.isParameterOf(paramName)) {
                const item = new CompletionItem(paramName, CompletionItemKind.Field);
                item.detail = param.description;
                item.insertText = new SnippetString(formatText(
                    CompletionText.PARAMETER_AUTO, { parameter: paramName }
                ));
                completion.push(item);
            }
        }

        // script block completion
        for (const blockName of BLOCK_NAMES) {
            const item = new CompletionItem(blockName, CompletionItemKind.Keyword);
            const blockData = getScriptBlockData(blockName);
            if (!canHaveParent(blockName, parentBlock.scriptBlock)) {
                // skip blocks that cannot be children of the current block
                continue;
            }

            const snippetStr = this.formatBlock(blockName, parentBlock.scriptBlock);
            item.insertText = new SnippetString(snippetStr);

            item.detail = blockData.description;
            completion.push(item);
        }

        return completion;
    }

    private formatBlock(blockType: string, parentType: string, level: number=0): string {
        const blockData = getScriptBlockData(blockType);

        const tabs = '\t'.repeat(level);

        // should have ID ?
        const mainID = this.formatID(blockType, parentType);
        let snippetStr = `${tabs}` + formatText(
            CompletionText.BLOCK,
            {
                scriptBlock: blockType,
                id: formatText(mainID, { level: (level + 1).toString() }),
            }
        )

        // middle part

        // add required parameter
        const requiredParams = listRequiredParameters(blockType);
        for (const param of requiredParams) {
            snippetStr += `${tabs}` + this.formatParameter(param);
        }
        
        // add required children blocks
        const needsChildren = blockData.needsChildren || null;
        if (needsChildren) {
            for (const childBlock of needsChildren) {
                snippetStr += this.formatBlock(childBlock, blockType, level + 1) + '\n';
            }
        } //else {
            // snippetStr += `${tabs}` + CompletionText.MIDDLE;
        //}

        // ending
        snippetStr += `${tabs}` + CompletionText.END;

        return snippetStr;
    }

    private formatID(blockType: string, parentType: string): string {
        const childShouldHaveID = shouldHaveID(blockType, parentType);
        return childShouldHaveID ? CompletionText.ID : '';
    }

    private formatParameter(param: ScriptBlockParameter): string {
        const name = param.name;
        let defaultValue = param.default || 'id';
        if (param.type?.main === VALUE_TYPES.ARRAY) {
            const separator = param.type.array?.separator || ";";
            defaultValue = (param.default as string[] || ['list']).join(separator);
        }
        return formatText(
            CompletionText.PARAMETER,
            {
                parameter: name,
                value: defaultValue.toString(),
            }
        );
    }
}
