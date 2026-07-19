import * as vscode from 'vscode';

import { ScriptsBlock, assignedClasses } from '../scriptsBlocks';

export class ImportsBlock extends ScriptsBlock {
    imports: string[] = [];

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
    
        this.findImports();
    }

    private findImports(): void {
        const text = this.document.getText().slice(this.start, this.end);
        
        // split by whitespace
        const parts = text.split(/\s+/);
        
        // filter out empty parts and add to imports
        this.imports = parts.filter(part => part.trim() !== "");
        //
    }

    public getImports(): string[] {
        return this.imports;
    }
}


assignedClasses.set("imports", ImportsBlock);