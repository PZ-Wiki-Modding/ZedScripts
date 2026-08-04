import * as vscode from 'vscode';
import { ScriptsBlock } from "./scriptsBlocks";

import { 
    formatList
} from '../utils/format';
import { DiagnosticType } from "../models/DiagnosticType";
import { inputsOutputsRegex } from '../models/regexPatterns';

import { IndexRange } from '../utils/positions';

import { 
    InputAnalysisProperty,
    InputParameterData,
} from './scriptsBlocksData';
import { getScriptBlockData } from "./scriptsBlocksUtility";

import { diagnostic } from '../providers/diagnostic';
import { registerActionTextReplace } from '../providers/actions';


export class InputsParameter {
// MEMBERS
    // extra
    document: vscode.TextDocument;
    diagnostics: vscode.Diagnostic[] | undefined;
    
    // param data
    parent: ScriptsBlock;
    parameter: string;
    values: string;
    comma: string;
    amount: number;

    // positions
    parameterRange: IndexRange;
    amountRange: IndexRange;
    valuesRange: IndexRange;

    properties: Record<string, InputAnalysisProperty> = {};

// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        parent: ScriptsBlock,
        diagnostics: vscode.Diagnostic[] | undefined,
        parameter: string,
        values: string,
        amount: string,
        parameterRange: IndexRange,
        amountRange: IndexRange,
        valuesRange: IndexRange,
        comma: string,
    ) {
        this.document = document;
        this.parent = parent;
        this.diagnostics = diagnostics;
        
        this.parameter = parameter;
        this.values = values;
        this.comma = comma;

        this.parameterRange = parameterRange;
        this.amountRange = amountRange;
        this.valuesRange = valuesRange;

        this.amount = -1;
    }


// INFORMATION

    public getParameterData(parameter: string): InputParameterData | null {
        const blockData = getScriptBlockData(this.parent.scriptBlock);
        const properties = blockData.properties;
        if (properties) {
            const parameterData = properties[parameter];
            if (parameterData) {
                return parameterData;
            }
        }
        return null;
    }


// INITIALIZERS

    protected handleAmount(value: string): number {
        return -1;
    }

    /**
     * We identify the different subparameters in the values string with regex 
     */
    protected getParameterInformation(values: string): void {
        // properties starting position in document
        const valueStart = this.valuesRange.start;

        // handle properties based on block data
        for (const key in this.properties) {
            // retrieve the matches for this property
            const property = this.properties[key];
            const matches = this.findMatches(
                property.regex,
                values,
                valueStart
            );
            if (matches.length > 0) {
                // check for duplicate properties
                if (matches.length > 1) {
                    for (let i = 0; i < matches.length; i++) {
                        diagnostic(
                            this.document,
                            this.diagnostics,
                            DiagnosticType.DUPLICATE_PROPERTY,
                            { property: key },
                            matches[i].range.start,
                            matches[i].range.end,
                            vscode.DiagnosticSeverity.Warning
                        );
                        const line = this.document.positionAt(matches[i].range.start).line;
                    }
                }

                // find the value of the property
                const match = matches[0];
                const propValue = match.match.groups?.value;
                if (propValue !== undefined) {
                    switch (property.type) {
                        case 'array':
                            property.value = propValue.split(";");
                            break;
                        case 'boolean':
                            property.value = !property.value; // invert boolean
                            break;
                        case 'string':
                            property.value = propValue;
                            break;
                    }
                    property.source = match.match[0];
                    property.range = match.range;
                }
            }
        }
    }

// CHECKERS

    public shouldValidate(): boolean {
        if (this.diagnostics === undefined) {
            return false;
        }
        return true;
    }

    protected validateOneOf(parameterData: InputParameterData): boolean {
        const oneOf = parameterData.oneOf;
        if (oneOf) {
            // check if at least one of the required properties is provided
            let hasOne = false;
            for (const prop of oneOf) {
                const property = this.properties[prop];
                if (!property) { continue; }

                // check based on type
                switch (property.type) {
                    case 'array':
                        if (Array.isArray(property.value) && property.value.length > 0) {
                            hasOne = true;
                        }
                        break;
                    case 'boolean':
                        if (property.value === true) {
                            hasOne = true;
                        }
                        break;
                    case 'string':
                        if (typeof property.value === 'string' && property.value !== "") {
                            hasOne = true;
                        }
                        break;
                }
            }
            if (!hasOne) {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.MISSING_ONEOF_PROPERTY,
                    { type: this.parameter, properties: formatList(oneOf) },
                    this.valuesRange.start,
                    this.valuesRange.end,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                }
            }
        }
        
        return true;
    }

    protected validateValues(parameterData: InputParameterData): boolean {
        for (const key in this.properties) {
            const property = this.properties[key];
            const propData = parameterData.properties[key];
            const values = propData.values;
            if (!values) { continue; }

            // try based on type
            const value = property.value;
            let pass = true;
            let params = {};
            switch (property.type) {
                case 'array':
                    for (const val of value as string[]) {
                        if (!values.includes(val)) {
                            pass = false;
                            params = { value: val, property: key, validValues: formatList(values) };
                        }
                    }
                    break;
                case 'string':
                    if (!values.includes(value as string)) {
                        pass = false;
                        params = { value: value as string, property: key, validValues: formatList(values) };
                    }
                    break;
            }

            // report invalid value
            if (!pass) {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.INVALID_VALUE,
                    params,
                    property.range.start,
                    property.range.end,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                }
            }

        }
        return true;
    }

    protected validateComma(): boolean {
        if (!this.shouldValidate()) { return true; }
        if (!this.parent.shouldParameterHaveComma()) { return true; }
        if (this.comma === ",") { return true; }

        const missing = this.comma === "";
        const end = this.valuesRange.end + this.comma.length;

        const diagnosticOutput = diagnostic(
            this.document,
            this.diagnostics,
            missing ? DiagnosticType.MISSING_COMMA : DiagnosticType.INVALID_COMMA,
            {},
            this.parameterRange.start,
            end
        );
        if (!diagnosticOutput) { return false; }

        // fix
        const commaRange = new vscode.Range(
            this.document.positionAt(this.valuesRange.end),
            this.document.positionAt(end)
        );
        const fix = registerActionTextReplace(
            this.document,
            commaRange,
            ",",
            missing ? `Add missing comma for '${this.parameter}' entry` : `Replace invalid comma with a correct one`
        );
        this.parent.getRoot().addAction(
            new vscode.Range(
                this.document.positionAt(this.parameterRange.start),
                this.document.positionAt(end)
            ),
            diagnosticOutput,
            fix
        );

        return false;
    }

    // FIXME: this is really shitty but necessary with the current structure of the code
    // the reason is that InputsParameter instances get stored alongside the classic ScriptsBlocksParameters
    public validateLater(): void {}

// UTILITY
    protected findMatches(
        regex: RegExp,
        text: string,
        offset: number
    ): {match: RegExpExecArray, range: IndexRange}[] {
        regex.lastIndex = 0; // reset regex state

        const matches: {match: RegExpExecArray, range: IndexRange}[] = [];
        let searchPos = 0;
        while (searchPos < text.length) {
            let match = regex.exec(text);
            if (!match) { break; }

            // find match position in document
            const fullMatch = match[0];
            const matchStart = offset + text.indexOf(fullMatch);
            const matchEnd = matchStart + fullMatch.length;
            matches.push({match: match, range: {start: matchStart, end: matchEnd}});

            searchPos = regex.lastIndex;
        }
        return matches;
    }

// EXPORT
    public export(): Record<string, unknown> {
        const exportedProperties: Record<string, unknown> = {};
        for (const key in this.properties) {
            const property = this.properties[key];
            exportedProperties[key] = property.value;
        }

        return {
            parameter: this.parameter,
            values: this.values,
            amount: this.amount,
            properties: exportedProperties
        };
    }
}


/**
 * Handles the `item` parameter of inputs block.
 */
export class InputsItemParameter extends InputsParameter {
// MEMBERS
    // properties
    properties: Record<string, InputAnalysisProperty> = {
        itemList: {
            source: "",
            value: [] as string[], 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.itemList,
            type: 'array', },
        mode: { 
            source: "",
            value: "destroy" as string, 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.mode,
            type: 'string', },
        tags: {
            source: "",
            value: [] as string[], 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.tags,
            type: 'array', },
        flags: { 
            source: "",
            value: [] as string[], 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.flags,
            type: 'array', },
        mappers: { 
            source: "",
            value: [] as string[], 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.mappers,
            type: 'array', },
        overlayMapper: { 
            source: "",
            value: false as boolean, 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.overlayMapper,
            type: 'boolean', },
    };

// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        parent: ScriptsBlock,
        diagnostics: vscode.Diagnostic[] | undefined,
        parameter: string,
        values: string,
        amount: string,
        parameterRange: IndexRange,
        amountRange: IndexRange,
        valuesRange: IndexRange,
        comma: string,
    ) {
        super(
            document,
            parent,
            diagnostics,
            parameter,
            values,
            amount,
            parameterRange,
            amountRange,
            valuesRange,
            comma
        );
        this.amount = this.handleAmount(amount);
        this.getParameterInformation(values);

        this.validate();
    }

// INITIALIZERS
    /**
     * The amount for the items parameter should be an integer.
     */
    protected handleAmount(amount: string): number {
        // transform into a number
        const num = parseFloat(amount);
        if (isNaN(num) || num < 0) {
            if (diagnostic(
                this.document,
                this.diagnostics,
                DiagnosticType.INVALID_AMOUNT,
                { amount: amount, type: this.parameter },
                this.amountRange.start,
                this.amountRange.end,
                vscode.DiagnosticSeverity.Error
            )) {
                return -1;
            }
        }

        // verify if integer
        if (!Number.isInteger(num)) {
            if (diagnostic(
                this.document,
                this.diagnostics,
                DiagnosticType.INTEGER_AMOUNT,
                { amount: amount, type: this.parameter },
                this.amountRange.start,
                this.amountRange.end,
                vscode.DiagnosticSeverity.Warning
            )) {
                return -1;
            }
        }

        return num;
    }

// CHECKERS

    protected validate(): boolean {
        if (!this.shouldValidate()) { return true; }

        const parameterData = this.getParameterData(this.parameter);
        if (!parameterData) {
            return false; // that would be weird if we got there with an invalid parameter
        }

        // check the trailing comma, independent from the content of the entry
        this.validateComma();

        // check one of
        const oneOf = this.validateOneOf(parameterData);
        if (!oneOf) {
            return false;
        }

        // check values
        const values = this.validateValues(parameterData);
        if (!values) {
            return false;
        }

        // check itemList format
        const itemListProperty = this.properties['itemList'];
        const propertyRange = itemListProperty.range;
        const itemCount = itemListProperty.value.length;
        for (const item of itemListProperty.value) {
            // get item positions
            const itemStart = propertyRange.start + itemListProperty.source.indexOf(item);
            const itemEnd = itemStart + item.length;

            // check value is *, don't allow for other values
            if (item === "*") {
                if (itemCount > 1) {
                    if (diagnostic(
                        this.document,
                        this.diagnostics,
                        DiagnosticType.ALL_WITH_OTHERS,
                        {},
                        itemStart,
                        itemEnd,
                        vscode.DiagnosticSeverity.Error
                    )) {
                        return false;
                    }
                }
                break; // no need to check other items, only need to correct that one
            }
            
            // verify the item isn't empty
            if (item.trim() === "") {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.MISSING_VALUE,
                    {},
                    itemStart,
                    itemEnd,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                }
            }

            // verify the item doesn't have spaces in its module.id
            if (item.includes(" ")) {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.SPACES_IN_ITEM,
                    { value: item },
                    itemStart,
                    itemEnd,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                }
            }
            
            // verify the item doesn't have dots in its ID
            const splittedItem = item.split(".");
            if (splittedItem.length > 2) {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.NO_DOTS_ITEM,
                    { value: item },
                    itemStart,
                    itemEnd,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                };

            // verify the item has a module part
            }
            if (splittedItem.length === 1) {
                if (diagnostic(
                    this.document,
                    this.diagnostics,
                    DiagnosticType.MISSING_MODULE,
                    { value: item },
                    itemStart,
                    itemEnd,
                    vscode.DiagnosticSeverity.Error
                )) {
                    return false;
                }
            }
        }
        
        return true;
    }
}


/**
 * Handles the `+fluid` and `-fluid` parameters of inputs block.
 */
export class InputsFluidParameter extends InputsParameter {
// MEMBERS
    // properties
    properties: Record<string, InputAnalysisProperty> = {
        fluidList: {
            source: "",
            value: [] as string[],
            range: {start: -1, end: -1} as IndexRange,
            regex: inputsOutputsRegex.itemList,
            type: 'array', },
        // singleValue: { // that one is only for +fluid
        //     source: "",
        //     value: "" as string,
        //     range: {start: -1, end: -1} as IndexRange,
        //     regex: inputsOutputsRegex.singleValue,
        //     type: 'string', },
        categories: {
            source: "",
            value: [] as string[],
            range: {start: -1, end: -1} as IndexRange,
            regex: inputsOutputsRegex.categories,
            type: 'array', },
        flags: {
            source: "",
            value: [] as string[],
            range: {start: -1, end: -1} as IndexRange,
            regex: inputsOutputsRegex.flags,
            type: 'array', },
        mode: { 
            source: "",
            value: "anything" as string, 
            range: {start: -1, end: -1} as IndexRange, 
            regex: inputsOutputsRegex.mode,
            type: 'string', },
    };

// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        parent: ScriptsBlock,
        diagnostics: vscode.Diagnostic[] | undefined,
        parameter: string,
        values: string,
        amount: string,
        parameterRange: IndexRange,
        amountRange: IndexRange,
        valuesRange: IndexRange,
        comma: string,
    ) {
        super(
            document,
            parent,
            diagnostics,
            parameter,
            values,
            amount,
            parameterRange,
            amountRange,
            valuesRange,
            comma
        );
        this.amount = this.handleAmount(amount);
        this.getParameterInformation(values);

        this.validateProperties();
    }

// INITIALIZERS
    protected handleAmount(amount: string): number {
        // transform into a number
        const num = parseFloat(amount);
        if (isNaN(num) || num < 0) {
            if (diagnostic(
                this.document,
                this.diagnostics,
                DiagnosticType.INVALID_AMOUNT,
                { amount: amount, type: this.parameter },
                this.valuesRange.start,
                this.valuesRange.end,
                vscode.DiagnosticSeverity.Error
            )) {
                return -1;
            }
        }

        return num;
    }

// CHECKERS

    protected validateProperties(): boolean {
        if (!this.shouldValidate()) { return true; }

        const parameterData = this.getParameterData(this.parameter);
        if (!parameterData) {
            return false; // that would be weird if we got there with an invalid parameter
        }

        // check the trailing comma, independent from the content of the entry
        this.validateComma();

        // check one of
        const oneOf = this.validateOneOf(parameterData);
        if (!oneOf) {
            return false;
        }

        // check values
        const values = this.validateValues(parameterData);
        if (!values) {
            return false;
        }

        return true;
    }
}
