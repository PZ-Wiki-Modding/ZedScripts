import * as vscode from 'vscode';

import { inputsOutputsRegex } from '../../models/regexPatterns';
import { ScriptsBlock, assignedClasses } from '../scriptsBlocks';
import { InputsItemParameter, InputsFluidParameter, InputsParameter } from '../scriptsBlocksProperties';
import { IndexRange } from '../../utils/positions';

export class InputsBlock extends ScriptsBlock {
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

    protected findParameters(): any[] {
        const document = this.document;
        const text = document.getText().slice(this.start, this.end);

        const parameters: InputsParameter[] = [];

        // identify the different inputs/outputs parameters
        const matches = Array.from(text.matchAll(inputsOutputsRegex.main));

        for (const match of matches) {
            const groups = match.groups;
            if (!groups) continue;
            const fullMatch = match[0];
            const name = groups.name.trim();
            const amount = groups.amount.trim();
            const values = groups.values;
            const comma = groups.comma.trim();

            const index = match.index!;

            // retrieve the positions
            const nameStart = this.start + index + fullMatch.indexOf(name);
            const nameEnd = nameStart + name.length;
            const nameRange: IndexRange = {start: nameStart, end: nameEnd};

            const amountStart = this.start + index + fullMatch.indexOf(amount);
            const amountEnd = amountStart + amount.length;
            const amountRange: IndexRange = {start: amountStart, end: amountEnd};
            
            const valuesStart = this.start + index + fullMatch.indexOf(values);
            const valuesEnd = valuesStart + values.length;
            const valuesRange: IndexRange = {start: valuesStart, end: valuesEnd};

            // verify it is within this block and not in a child block
            if (!this.isIndexOf(nameStart) || !this.isIndexOf(valuesEnd - 1)) {
                continue;
            }

            // determine parameter type
            let parameterType;
            if (name === "item") {
                parameterType = InputsItemParameter;
            } else if (name.includes("fluid")) {
                parameterType = InputsFluidParameter;
            } else {
                // unknown parameter type
                continue;
            }

            // create the parameter
            const parameter = new parameterType(
                document,
                this,
                this.diagnostics,
                name,
                values,
                amount,
                nameRange,
                amountRange,
                valuesRange,
                comma
            );

            parameters.push(parameter);
        } 

        return parameters;
    }
}

assignedClasses.set("inputs", InputsBlock);