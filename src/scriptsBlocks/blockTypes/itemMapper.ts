import * as vscode from 'vscode';

import { ScriptsBlock } from '../scriptsBlocks';

export class ItemMapperBlock extends ScriptsBlock {
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

    public canHaveParameter(name: string): boolean {
        // TODO: to implement
        // allow any parameter in itemMapper blocks for now
        return true;
    }
}
