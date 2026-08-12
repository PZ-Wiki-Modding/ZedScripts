import * as vscode from 'vscode';

import { ScriptsBlock } from '../scriptsBlocks';

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
        headerStart: number,
        idStart: number
    ) {
        super(document, diagnostics, parent, type, id, start, end, headerStart, idStart);
    
        this.findImports();
    }

    private findImports(): void {
        const text = this.document.getText().slice(this.braceStart, this.braceEnd);
        
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

