import * as vscode from 'vscode';

import { ScriptsBlock } from '../scriptsBlocks';

export class ItemBlock extends ScriptsBlock {
// CONSTRUCTOR
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

    protected validateID(): boolean {
        if (!super.validateID()) {
            return false;
        }

        // check that the item has a translation entry in 
        // TODO: to implement, needs a way to access the translation files

        return true;
    }
}
