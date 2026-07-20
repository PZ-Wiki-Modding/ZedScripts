import * as vscode from 'vscode';

import { ScriptsBlock } from '../scriptsBlocks';

/**
 * A ScriptBlock that represents a 'component' block specifically.
 */
export class ComponentBlock extends ScriptsBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptsBlock | null,
        type: string,
        id: string | null,
        start: number,
        end: number,
        headerStart: number
    ) {
        super(document, diagnostics, parent, type, id, start, end, headerStart);
    }

    // override isWord to check original script block since ID and scriptBlock are merged
    public isWord(word: string): boolean {
        return this.originalScriptBlock === word;
    }
}
