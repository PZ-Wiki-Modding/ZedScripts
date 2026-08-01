import * as vscode from 'vscode';
import { ScriptsBlock } from "./scriptsBlocks";
import { DocumentBlock } from "./blockTypes/document";
import { WIKI_LINK } from '../project';
import { 
    formatText,
    formatList,
    getIndentation
} from '../utils/format';
import { DefaultText } from '../models/DefaultText';
import { ThemeColorType } from "../models/ThemeColorType";
import { DiagnosticType } from "../models/DiagnosticType";
import { diagnostic } from '../providers/diagnostic';
import { registerActionTextReplace } from '../providers/actions';
import { 
    DeprecatedInfo,
    ObjectType,
    ArrayType,
    ScriptBlockParameter, 
    VALUE_TYPES
} from './scriptsBlocksData';
import { getScriptBlockData, getMainVariant } from "./scriptsBlocksUtility";
import { color } from "../utils/themeColors";
import { IndexRange } from '../utils/positions'; 

export interface ReferenceData {
    blocks: ScriptsBlock[];
    expectedBlock: string;
}

export class ScriptParameter {
// MEMBERS
    // extra
    document: vscode.TextDocument;
    diagnostics: vscode.Diagnostic[] | undefined;
    actions: vscode.CodeAction[] = [];
    
    // param data
    parent: ScriptsBlock;
    parameter: string;
    value: string;
    comma: string;
    isDuplicate: boolean;
    ref: ReferenceData | undefined = undefined;

    // positions
    parameterRange: IndexRange;
    valueRange: IndexRange;

    colorCode: ThemeColorType = ThemeColorType.PARAMETER;

// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        parent: ScriptsBlock,
        diagnostics: vscode.Diagnostic[] | undefined,
        name: string,
        value: string,
        parameterRange: IndexRange,
        valueRange: IndexRange,
        comma: string,
        isDuplicate: boolean
    ) {
        this.document = document;
        this.parent = parent;
        this.diagnostics = diagnostics;

        this.parameter = name;
        this.value = value;
        this.comma = comma;
        this.isDuplicate = isDuplicate;

        this.parameterRange = parameterRange;
        this.valueRange = valueRange;
    }

    private getLineEnd(): number {
        const line = this.document.positionAt(this.valueRange.end).line;
        const lineEndPosition = this.document.lineAt(line).range.end;
        return this.document.offsetAt(lineEndPosition);
    }

    /** A document root will always be found */
    public getRoot(): DocumentBlock {
        const documentBlock = DocumentBlock.getDocumentBlock(this.document);
        return documentBlock!;
    }

// INFORMATION

    private getTree(): string {
        const depr = this.getDeprecated();
        let parameter = color(this.parameter, this.colorCode);

        if (depr) {
            parameter = "~~" + parameter + "~~";
            const replacement = depr.replacedBy ? "**" + color(depr.replacedBy, ThemeColorType.PARAMETER) + "**" : null;
            if (replacement) {
                parameter += ` ${replacement}`;
            }
        } else {
            parameter = "**" + parameter + "**";
        }

        const parameterData = this.getParameterData();
        if (parameterData) {

            // type information
            const type = parameterData.type
            if (type) {
                const typeMain = type.main;
                const operator = `${color(":", ThemeColorType.OPERATOR)}`;
                const typeColored = `${color(typeMain, ThemeColorType.TYPE)}`;
                parameter += ` ${operator} ${typeColored}`;

                // an array should 'type[]'
                if (typeMain === VALUE_TYPES.ARRAY) {
                    const arrayTypeData = this.getArrayTypeData()!;
                    const arrayType = type.array?.type || "string";
                    const arrayTypeColored = `${color(arrayType, ThemeColorType.TYPE)}`;
                    parameter += `[${arrayTypeColored}]`;

                    const separator = arrayTypeData.separator;
                    parameter += ` (separator '${color(separator, ThemeColorType.TYPE)}')`;

                // an object should show 'type[keyType separator valueType]'
                } else if (typeMain === VALUE_TYPES.OBJECT) {
                    const objectData = this.getObjectTypeData()!;
                    const keyValueSeparator = objectData.keyValueSeparator;
                    const keyType = objectData.keyType;
                    const valueType = objectData.valueType;
                    
                    const keyTypeColored = `${color(keyType, ThemeColorType.TYPE)}`;
                    const valueTypeColored = `${color(valueType, ThemeColorType.TYPE)}`;
                    parameter += `[${keyTypeColored}${color(keyValueSeparator, ThemeColorType.OPERATOR)}${valueTypeColored}]`;

                    // this is the object key-values separator
                    const separator = objectData.pairsSeparator;
                    parameter += ` (separator '${color(separator, ThemeColorType.TYPE)}')`;

                // a block should show the expected block type and if it is a full type or not
                } else if (typeMain === VALUE_TYPES.BLOCK) {
                    const blockType = type.block;
                    if (blockType) {
                        const blockColor = this.parent.colorCode;
                        const blockTypeName = blockType.name;
                        const fullType = blockType.fullType;
                        const blockTypeColored = `${color(blockTypeName, blockColor)}`;
                        parameter += ` (${fullType ? "full" : "type only"} '${blockTypeColored}')`;
                    }
                }
            }

            // default value information
            const defaultValue = parameterData.default;
            if (defaultValue) {
                const operator = `${color("=", ThemeColorType.OPERATOR)}`;
                let text;
                if (type) {
                    const typeMain = type.main;
                    let colorType = ThemeColorType.STRING;
                    // determine color based on type
                    switch (typeMain) {
                        case "integer":
                        case "float":
                            text = color(String(defaultValue), ThemeColorType.NUMBER);
                            break;
                        case "boolean":
                            text = color(String(defaultValue), ThemeColorType.BOOLEAN);
                            break;
                        case "array":
                        // case "object":
                            // color array elements first
                            if (Array.isArray(defaultValue) && defaultValue.length > 1) {
                                const arrayTypeData = this.getArrayTypeData()!;
                                const separator = arrayTypeData.separator;
                                const coloredElements = (defaultValue as string[]).map(elem => color(elem, ThemeColorType.STRING));
                                text = formatList(coloredElements, separator + " ");
                            }
                            break;
                    }
                    text = text || color(String(defaultValue), colorType);
                
                // default color as string if no type provided
                } else {
                    text = color(String(defaultValue), ThemeColorType.STRING)
                }
                const defaultValueColored = `${text}`;
                parameter += ` ${operator} ${defaultValueColored}`;
            }
        }
        const parents = this.parent.getTree(true);
        return parents + " → " + parameter;
    }

    protected getWikiPage(): string {
        const mainVariant = getMainVariant(this.parent.scriptBlock);
        return WIKI_LINK + this.parameter + '_(' + mainVariant.replace(' ', '_') + '_parameter)';
    }

    protected getScriptsDocPage(): string {
        return this.parent.getScriptsDocPage() 
            + '#' 
            + this.parent.scriptBlock.toLowerCase().replace(' ', '-') + '-' 
            + this.parameter.toLowerCase().replace(' ', '-');
    }

    public getHoverText(): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true; // needed for html rendering
        markdown.supportHtml = true;

        // retrieve tree and description
        const tree = this.getTree();
        const desc = this.getDescription();

        // assemble the hover content
        markdown.appendMarkdown(`${tree}  \n`);

        // show description only if that's a valid parameter
        if (this.parent.canHaveParameter(this.parameter)) {
            markdown.appendMarkdown('\n\n---\n\n');
            markdown.appendMarkdown(desc);
            markdown.appendMarkdown('\n\n' + formatText(
                DefaultText.MORE_INFORMATION, 
                { 
                    // wikiPage: this.getWikiPage(),
                    scriptsDoc: this.getScriptsDocPage()
                }
            ));
        }
        
        return markdown;
    }


// DATA

    public getParameterData(): ScriptBlockParameter | null {
        const blockData = getScriptBlockData(this.parent.scriptBlock);
        const parameters = blockData.parameters;
        const name = this.parameter;
        const lowerName = name.toLowerCase();

        if (parameters) {
            const parameterData = parameters[lowerName];
            if (parameterData) {
                return parameterData;
            }
        }
        
        return null;
    }

    public getObjectTypeData(): ObjectType | undefined {
        const parameterData = this.getParameterData();
        return parameterData?.type?.object;
    }

    public getArrayTypeData(): ArrayType | undefined {
        const parameterData = this.getParameterData();
        return parameterData?.type?.array;
    }



    public getDescription(): string {
        const parameterData = this.getParameterData();
        return parameterData?.description || DefaultText.PARAMETER_DESCRIPTION;
    }

    public getExpectedType(): string {
        return this.getParameterData()?.type?.main || VALUE_TYPES.STRING;
    }

    public getTypeOfValue(expectedType: string | undefined = undefined): string {
        expectedType = expectedType || this.getParameterData()?.type?.main;

        // I don't know how I feel about that lol 
        // but that's kind of the problem with scripts
        if (expectedType === VALUE_TYPES.ARRAY || expectedType === VALUE_TYPES.OBJECT) {
            return expectedType;
        }

        return this.tryTypeOfValue(this.value, expectedType || "");
    }

    public tryTypeOfValue(value: string, expectedType: string): string {
        // find the most fitting type
        let type = undefined;

        // a value or a boolean could be used as a string
        // so we need to force to string
        if (expectedType === VALUE_TYPES.STRING) {
            return VALUE_TYPES.STRING;
            
        // check if block: consider as type block directly
        } else if (expectedType === VALUE_TYPES.BLOCK) {
            return VALUE_TYPES.BLOCK;

        // check if callback: consider as type callback directly
        } else if (expectedType === VALUE_TYPES.CALLBACK) {
            return VALUE_TYPES.CALLBACK;
        }

        // check if boolean
        if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
            type = VALUE_TYPES.BOOLEAN;

        // check if number
        } else if (!isNaN(Number(value))) {
            if (value.includes(".")) {
                type = VALUE_TYPES.FLOAT;
            
            // if int, output a float anyway if expected is float
            // done for easier handling of diagnostics later down the line
            } else if (expectedType === VALUE_TYPES.FLOAT) {
                type = VALUE_TYPES.FLOAT;
            } else {
                type = VALUE_TYPES.INT;
            }

        // default to string
        } else {
            type = VALUE_TYPES.STRING;
        }

        return type;
    }

    public getBlockTypeOfValue(): [string | null, string] | null {
        const value = this.value;

        let module: string;
        let block: string;

        // split by . to separate module and block
        const parts = value.split(".");
        if (parts.length === 2) {
            [module, block] = parts;
            return [module, block];
        } else if (parts.length === 1) {
            block = parts[0];

            // verify it's not an empty value
            // if (block === "") {
            //     return null;
            // }
            return [null, block];
        }
        
        // if we reach here, it means there's no value provided and the split did nothing
        return null;
    }

    public canBeDuplicate(): boolean {
        const parameterData = this.getParameterData();
        if (parameterData) {
            return parameterData.allowedDuplicate === true;
        }
        return false;
    }

    public canBeEmpty(): boolean {
        const parameterData = this.getParameterData();
        if (parameterData) {
            return parameterData.canBeEmpty === true;
        }
        return false;
    }

    public getDeprecated(): DeprecatedInfo | null {
        const parameterData = this.getParameterData();
        if (parameterData) {
            return parameterData.deprecated || null;
        }
        return null;
    }

    public getDeprecatedInformation(deprecatedInfo: DeprecatedInfo): string {
        const replacement = deprecatedInfo.replacedBy
        const description = deprecatedInfo.description;
        const version = deprecatedInfo.version;
        
        // format deprecation based on available information
        let txt = "";
        if (replacement && version) {
            txt = formatText(DefaultText.DEPRECATION_REPLACEMENT_VERSION, { replacement, version });
        } else if (replacement) {
            txt = formatText(DefaultText.DEPRECATION_REPLACEMENT, { replacement });
        } else if (version) {
            txt = formatText(DefaultText.DEPRECATION_VERSION, { version });
        } else {
            txt = "This parameter is deprecated.";
        }

        // add description if provided
        if (description) {
            txt += " " + description;
        }
        return txt;
    }

    /**
     * Considers that the value are simply a list, and if no value is present then it returns null.
     * This is used in combination with the accepted values list to verify if the provided value/values are correct.
     */
    public getValues(): string[] {
        const type = this.getTypeOfValue();

        // handle array case
        if (type === VALUE_TYPES.ARRAY) {
            const arrayTypeData = this.getArrayTypeData();
            if (!arrayTypeData) {
                throw new Error("Array type data is missing for parameter " + this.parameter);
            }
            const separator = arrayTypeData.separator;
            const values = this.value.split(separator).map(v => v.trim());
            return values;

        // simple value case
        } else if (type === VALUE_TYPES.OBJECT) {
            const objectTypeData = this.getObjectTypeData();
            if (!objectTypeData) {
                throw new Error("Object type data is missing for parameter " + this.parameter);
            }
            const pairsSeparator = objectTypeData.pairsSeparator;
            const values = this.value.split(pairsSeparator).map(v => v.trim());
            return values;
        } else if (this.value !== "") {
            return [this.value];
        }
        return [];
    }

    /**
     * This function is used to retrieve the values of the parameter-value pair that are invalid. 
    */
    public getForbiddenValues(): string[] {
        const values = this.getValues();
        const parameterData = this.getParameterData();
        if (parameterData && parameterData.values) {
            const acceptedValues = parameterData.values.map(v => String(v));

            const forbiddenValues = values.filter(
                value => !acceptedValues.includes(value)
            );
            return forbiddenValues;
        }
        return values;
    }

    /**
     * Verifies if the provided value is a valid value.
     */
    public isAcceptedValue(value: string): boolean {
        const parameterData = this.getParameterData();
        if (parameterData && parameterData.values) {
            const acceptedValues = parameterData.values.map(v => String(v));
            return acceptedValues.includes(value);
        }
        return false;
    }


// EDITS
    // utility providers of editing the document to format it

    /**
     * Example result:
     * ```ts
     * param = value,
     * block {
     *     param1     = valueLong1,
     *     paramLong2 = value2,
     * }
     * ```
     */
    public getFormattingEdit(): vscode.TextEdit {
        // get indentation level by finding depth level
        const depthLevel = this.parent.getDepthLevel()+1;
        const indentBase = getIndentation(this.document);
        const indentation = indentBase.repeat(depthLevel);

        // retrieve the maximum parameter length in this block to align the equal signs properly
        const maxParameterLength = this.parent.getMaxParameterLength();

        // format the parameter-value pair with proper indentation and alignment
        const formattedParameter = `${indentation}${this.parameter.padEnd(maxParameterLength)} = ${this.value}${this.comma}`;
        
        const lineStartNumber = this.document.positionAt(this.parameterRange.start).line;
        const lineStart = this.document.lineAt(lineStartNumber).range.start;
        const lineEnd = this.document.positionAt(this.valueRange.end + this.comma.length);
        return vscode.TextEdit.replace(
            new vscode.Range(lineStart, lineEnd), 
            formattedParameter
        );
    }



// CHECKERS

    /**
     * This function will validate the parameter-value pair by verifying different conditions.
     * If something is wrong, it adds a diagnostic and, if possible, a quick fix to solve the issue.
     */
    public validate(): boolean {
        if (this.diagnostics === undefined) { return true }

        const name = this.parameter;

        // check if parameter exists in this block
        if (!this.parent.canHaveParameter(name)) {
            this.diagnostic(
                DiagnosticType.UNKNOWN_PARAMETER,
                { parameter: name, scriptBlock: this.parent.scriptBlock },
                this.parameterRange.start,
                this.parameterRange.end,
                vscode.DiagnosticSeverity.Hint
            );
            // return false;
        }

        // verify if parameter is deprecated
        const depr = this.getDeprecated();
        if (depr) {
            const txt = this.getDeprecatedInformation(depr);
            const diagnosticOutput = this.diagnostic(
                txt,
                {},
                this.parameterRange.start, this.parameterRange.end,
                vscode.DiagnosticSeverity.Warning
            );

            // provide deprecation replacement fix if available
            if (diagnosticOutput && depr.replacedBy) {
                const fix = registerActionTextReplace(
                    this.document,
                    new vscode.Range(
                        this.document.positionAt(this.parameterRange.start),
                        this.document.positionAt(this.parameterRange.end)
                    ),
                    depr.replacedBy,
                    `Replace deprecated parameter '${name}' with '${depr.replacedBy}'`
                );
                this.registerFix(fix, diagnosticOutput, new vscode.Range(
                    this.document.positionAt(this.parameterRange.start),
                    this.document.positionAt(this.valueRange.end)
                ));
            }
        }

        // check for duplicate
        if (this.isDuplicate && !this.canBeDuplicate()) {
            if (this.diagnosticDuplicate()) {
                return false;
            }
        }

        // check if value is missing
        if (this.value === "" && !this.canBeEmpty()) {
            const lineEnd = this.getLineEnd();
            if (this.diagnostic(
                DiagnosticType.MISSING_VALUE,
                { parameter: name },
                this.valueRange.start,
                lineEnd,
                vscode.DiagnosticSeverity.Hint
            )) {
                return false;
            }
        }

        // verify if parameter has accepted value
        const forbiddenValues = this.getForbiddenValues();
        if (forbiddenValues.length > 0) {
            const parameterData = this.getParameterData();
            const values = parameterData?.values;
            if (values) {
                if (this.diagnostic(
                    DiagnosticType.WRONG_VALUES,
                    {
                        invalidValues: formatList(forbiddenValues),
                        parameter: name, 
                        validValues: formatList(values) 
                    },
                    this.valueRange.start,
                    this.valueRange.end
                )) {
                    return false;
                }
            }
        }

        // make sure the values if it's an object type properly use the correct separator and types
        if (this.getTypeOfValue() === VALUE_TYPES.OBJECT) {
            const values = this.getValues();
            const objectData = this.getObjectTypeData()!;
            const keyValueSeparator = objectData.keyValueSeparator;
            const invalidFormatValues = values.filter(value => !value.includes(keyValueSeparator));
            if (invalidFormatValues.length > 0) {
                if (this.diagnostic(
                    DiagnosticType.INVALID_OBJECT_FORMAT,
                    { parameter: name, values: formatList(invalidFormatValues), keyValueSeparator: keyValueSeparator },
                    this.valueRange.start,
                    this.valueRange.end
                )) {
                    return false;
                }
            }

            const keyType = objectData.keyType;
            const valueType = objectData.valueType;
            const invalidTypeValues = values.filter(value => {
                const [key, val] = value.split(keyValueSeparator).map(v => v.trim());
                const kType = this.tryTypeOfValue(key, keyType);
                const vType = this.tryTypeOfValue(val, valueType);
                return kType !== keyType || vType !== valueType;
            });
            if (invalidTypeValues.length > 0) {
                if (this.diagnostic(
                    DiagnosticType.INVALID_TYPE_FOR_VALUES_OBJECT,
                    { 
                        parameter: name, 
                        invalidTypeValues: formatList(invalidTypeValues), 
                        keyType: keyType, 
                        valueType: valueType, 
                        keyValueSeparator: keyValueSeparator 
                    },
                    this.valueRange.start,
                    this.valueRange.end
                )) {
                    return false;
                }
            }
        }

        // check if missing comma at the end
        if (this.parent.shouldParameterHaveComma()) {
            if (this.comma === "") {
                const diagnosticOutput = this.diagnostic(
                    DiagnosticType.MISSING_COMMA,
                    {},
                    this.parameterRange.start,
                    this.valueRange.end
                );

                // provide quick fix by replacing the value with the value + comma
                if (diagnosticOutput) {
                    const fix = registerActionTextReplace(
                        this.document,
                        new vscode.Range(
                            this.document.positionAt(this.valueRange.start),
                            this.document.positionAt(this.valueRange.end)
                        ),
                        this.value + ",",
                        `Add missing comma for parameter-value pair`
                    );
                    this.registerFix(fix, diagnosticOutput, new vscode.Range(
                        this.document.positionAt(this.parameterRange.start),
                        this.document.positionAt(this.valueRange.end)
                    ));
                    return false;
                }
            } 
            if (this.comma !== ",") {
                const diagnosticOutput = this.diagnostic(
                    DiagnosticType.INVALID_COMMA,
                    {},
                    this.parameterRange.start,
                    this.valueRange.end + this.comma.length
                );
                if (diagnosticOutput) {
                    // provide quick fix by replacing the invalid comma with a correct one
                    const fix = registerActionTextReplace(
                        this.document,
                        new vscode.Range(
                            this.document.positionAt(this.valueRange.end),
                            this.document.positionAt(this.valueRange.end + this.comma.length)
                        ),
                        ",",
                        `Replace invalid comma with a correct one`
                    );
                    this.registerFix(fix, diagnosticOutput, new vscode.Range(
                        this.document.positionAt(this.parameterRange.start),
                        this.document.positionAt(this.valueRange.end + this.comma.length)
                    ));
                    return false;
                }
            }
        }

        // verify the type
        const parameterData = this.getParameterData();
        if (parameterData && parameterData.type) {
            const expectedType = parameterData.type.main;
            const actualType = this.getTypeOfValue();
            const isValidType = actualType === expectedType;
            if (!isValidType) {
                this.diagnostic(
                    DiagnosticType.INVALID_TYPE_FOR_VALUE,
                    {
                        parameter: this.parameter,
                        scriptBlock: this.parent.scriptBlock,
                        value: this.value,
                        expectedType: expectedType,
                        type: actualType,
                    },
                    this.parameterRange.start,
                    this.valueRange.end,
                    vscode.DiagnosticSeverity.Error
                );
            }
        }

        // verify the block reference if any
        // this needs to be ran after all blocks from libs have been
        if (parameterData 
                && parameterData.type && parameterData.type.block 
                && this.value.toLowerCase() !== "null" // bypass value == "null" case for sound block
            ) {
            // try to access to the module and block from the value
            const blockTypeOfValue = this.getBlockTypeOfValue();
            if (!blockTypeOfValue) {
                this.diagnostic(
                    DiagnosticType.NO_BLOCK_REF,
                    { value: this.value, parameter: this.parameter },
                    this.valueRange.start,
                    this.valueRange.end,
                    vscode.DiagnosticSeverity.Warning
                );
                return false;
            }
            const blockType = parameterData.type.block;
            const canFullType = blockType.fullType;
            
            let [module, block] = blockTypeOfValue;

            // if full type is not allowed, then module should be null
            // this usually means the game considers it as Base by default
            if (!canFullType && module !== null) {
                this.diagnostic(
                    DiagnosticType.CANNOT_PROVIDE_MODULE,
                    { parameter: this.parameter },
                    this.valueRange.start,
                    this.valueRange.end,
                    vscode.DiagnosticSeverity.Error
                );
                return false;
            }

            // not empty, then look for its reference
            if (block !== "") {
                const noAutoImport = blockType.noAutoImport;

                // retrieve searchable modules
                const documentBlock = this.getRoot();
                if (!module) {
                    var searchableModules = documentBlock.getImports();
                } else {
                    var searchableModules: string[] = [];
                }

                // add own module to search into and if allowed
                if (module) {
                    searchableModules.push(module);
                }

                // if noAutoImport is false, then we can also search into the parent block module
                if (!noAutoImport) {
                    const parentModule = this.parent.getModule();
                    const id = parentModule?.id;
                    if (parentModule && id && !searchableModules.includes(id)) {
                        searchableModules.push(id);
                    }
                }

                // search the block reference in the provided modules
                const expectedBlock = blockType.name;
                const refBlocks = this.parent.getRoot().findBlockFromFullTypeInWorkspace(expectedBlock, searchableModules, block);
                
                // no references found
                if (refBlocks.length === 0) {
                    const diagType = noAutoImport ? DiagnosticType.INVALID_BLOCK_REF_NO_AUTO : DiagnosticType.INVALID_BLOCK_REF;
                    this.diagnostic(
                        diagType,
                        { value: this.value, parameter: this.parameter },
                        this.valueRange.start,
                        this.valueRange.end,
                        vscode.DiagnosticSeverity.Error
                    );
                    return false;

                // duplicate block references
                } else if (refBlocks.length > 1) {
                    this.diagnostic(
                        DiagnosticType.MULTIPLE_BLOCK_REFS,
                        { value: this.value, parameter: this.parameter },
                        this.valueRange.start,
                        this.valueRange.end,
                        vscode.DiagnosticSeverity.Warning
                    );
                    // no return, this still counts as valid
                }

                // assign the reference to the parameter for later use in hovers and go to definition
                this.ref = {
                    blocks: refBlocks,
                    expectedBlock: expectedBlock
                };

            // parameter cannot have an empty value
            } else if (!this.canBeEmpty()) {
                this.diagnostic(
                    DiagnosticType.NO_BLOCK_REF,
                    { value: this.value, parameter: this.parameter },
                    this.valueRange.start,
                    this.valueRange.end,
                    vscode.DiagnosticSeverity.Error
                );
                return false;
            }
        }

        // validate dependent parameters based on 'needs' property
        if (parameterData && parameterData.needs) {
            const needs = parameterData.needs;
            for (const need of needs) {
                const needsName = need.name;
                if (!needsName) { continue; }

                // verify the block has the dependent parameter
                const dependentParameter = this.parent.getParameter(needsName);
                if (!dependentParameter) {
                    this.diagnostic(
                        DiagnosticType.MISSING_DEPENDENT_PARAMETER,
                        { 
                            parameter: this.parameter, 
                            scriptBlock: this.parent.scriptBlock,
                            dependentParameter: needsName
                        },
                        this.parameterRange.start,
                        this.valueRange.end,
                        vscode.DiagnosticSeverity.Error
                    );
                } else {
                    const values = need.values;
                    const valueToType = need.valueToType;

                    // check if the dependent parameter needs a specific value
                    if (values) {
                        const testValues = values.map(v => String(v).toLowerCase());
                        // make sure the value of the dependent parameter is among the accepted values
                        if (!testValues.includes(dependentParameter.value.toLowerCase())) {
                            const val = formatList(testValues);
                            this.diagnostic(
                                DiagnosticType.DEPENDENT_PARAMETER_WRONG_VALUE,
                                { 
                                    parameter: this.parameter, 
                                    dependentParameter: dependentParameter.parameter,
                                    scriptBlock: this.parent.scriptBlock, 
                                    value: dependentParameter.value, 
                                    dependentValues: val
                                },
                                this.parameterRange.start,
                                this.valueRange.end,
                                vscode.DiagnosticSeverity.Error
                            );
                        }
                    } 

                    // the parameter can be of different type based on the value of the dependent parameter
                    if (valueToType) {
                        // verify the type of the parameter based on the value of the dependent parameter
                        const expectedType = valueToType[dependentParameter.value];
                        const actualType = this.getTypeOfValue(expectedType);
                        if (expectedType && actualType !== expectedType) {
                            this.diagnostic(
                                DiagnosticType.INVALID_TYPE_FOR_VALUE,
                                {
                                    parameter: this.parameter,
                                    scriptBlock: this.parent.scriptBlock,
                                    value: this.value,
                                    expectedType: expectedType,
                                    type: actualType? actualType : "undefined",
                                },
                                this.parameterRange.start,
                                this.valueRange.end,
                                vscode.DiagnosticSeverity.Error
                            );
                        }
                    }
                }
            }
        }

        return true;
    }



// DIAGNOSTICS HELPERS

    public setAsDuplicate(): void {
        if (!this.isDuplicate && !this.canBeDuplicate()) {
            this.isDuplicate = true;
            this.diagnosticDuplicate();
        }
    }

    private diagnosticDuplicate(): vscode.Diagnostic | false {
        return this.diagnostic(
            DiagnosticType.DUPLICATE_PARAMETER,
            { parameter: this.parameter, scriptBlock: this.parent.scriptBlock },
            this.parameterRange.start,
            this.parameterRange.end,
            vscode.DiagnosticSeverity.Warning
        );
    }

    private diagnostic(
        type: DiagnosticType | string,
        params: Record<string, string>,
        index_start: number,index_end?: number,
        severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Error
    ): vscode.Diagnostic | false {
        return diagnostic(
            this.document,
            this.diagnostics,
            type,
            params,
            index_start,
            index_end,
            severity
        );
    }

    private registerFix(
        fix: vscode.CodeAction, diagnostic: vscode.Diagnostic, range: vscode.Range
    ): void {
        const documentBlock = this.getRoot();
        documentBlock.addAction(range, diagnostic, fix);
    }

// EXPORTS

    public export(): Record<string, unknown> {
        return {
            parameter: this.parameter,
            value: this.value,
            comma: this.comma,
            isDuplicate: this.isDuplicate,
            positions: {
                parameterStart: this.parameterRange.start,
                parameterEnd: this.parameterRange.end,
                valueStart: this.valueRange.start,
                valueEnd: this.valueRange.end
            }
        };
    }
}
