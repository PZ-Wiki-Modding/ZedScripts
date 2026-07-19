import * as vscode from 'vscode';

import { ScriptsBlock, assignedClasses } from '../scriptsBlocks';

export class TemplateBlock extends ScriptsBlock {
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
        const splittedID = id ? id.split(" ") : null;
        if (splittedID) {
            type = splittedID[0];
            id = splittedID.slice(1).join(" ") || null;
        }
        
        super(document, diagnostics, parent, type, id, start, end, headerStart);
        this.isTemplate = true;
    }
}

assignedClasses.set("template", TemplateBlock);