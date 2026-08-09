import * as vscode from "vscode";
import * as path from "path";

export interface ScriptData {
    [key: string]: ScriptBlockData;
}

// not using an import because it's easier to manage overall
// also doesn't make it necessary to have the full type definition for ScriptData (supposedly ?)
export const DEFAULT_SCRIPTS_BLOCKS_DATA: ScriptData = require('../pz-scripts-data/out/scriptsBlocks.json');
export const DEFAULT_ROOTS_DATA: ScriptData = require('../pz-scripts-data/out/roots.json');

// current active dataset
export let SCRIPTS_TYPES: ScriptData = DEFAULT_SCRIPTS_BLOCKS_DATA as ScriptData;
export let ROOT_FILES: ScriptData = DEFAULT_ROOTS_DATA as ScriptData;

export enum ValueTypes {
    STRING = "string",
    INT = "integer",
    FLOAT = "float",
    BOOLEAN = "boolean",
    ARRAY = "array",
    OBJECT = "object",
    BLOCK = "block",
    CALLBACK = "callback",
    TRANSLATION = "translation",
}



export interface ScriptBlockData {
    name: string;
    description: string;
    shortDescription?: string;
    shouldHaveParent: boolean;
    needsChildren?: string[];
    parents: string[];
    ID?: ScriptBlockID;
    parameters: { [key: string]: ScriptBlockParameter };
    properties?: { [key: string]: InputParameterData };
    variantOf?: string; // if this block is a variant of another block, the name of the base block

    isRoot?: boolean;
    pattern?: string[]; // to be used as regex patterns for identification
    noComma?: boolean; // default is false
}

export interface IndexRange {
    start: number;
    end: number;
}



// PARAMETER DATA
export type ScriptBlockValue = string | number | boolean;
export interface ScriptBlockParameter {
    name: string;
    description?: string;
    allowedDuplicate?: boolean;
    canBeEmpty?: boolean;
    default?: ScriptBlockValue[];
    type?: ParameterType;
    required?: boolean;
    deprecated?: DeprecatedInfo;
    values?: ScriptBlockValue[];
    needs?: ScriptBlockNeeds[];
}


// TYPINGS
export interface BlockType {
    name: string; // the block type (e.g. "sound", "item", "model"...)
    fullType?: boolean; // if true, this should use the module to reference the block
    noAutoImport?: boolean; // if true, this will not automatically check its own parent block module when fullType is set to true
}

export interface ArrayType {
    separator: string;
    type: "string" | "integer" | "float" | "boolean";
}

export interface ObjectType {
    keyValueSeparator: string; // the separator used to split key and value
    keyType: "string" | "integer" | "float" | "boolean";
    valueType: "string" | "integer" | "float" | "boolean";
    pairsSeparator: string; // the separator used to split different key-value pairs
}

export interface ScriptBlockType {
    block: string;
    fullType: boolean; // if true, this can use the module to reference the block
}

export interface ParameterType {
    main: ValueTypes;
    array?: ArrayType;
    object?: ObjectType;
    block?: BlockType;
    translation?: TranslationProperties;
}


// NEEDS AND DEPRECATED
export interface ScriptBlockNeeds {
    name?: string; // the dependent parameter
    values?: ScriptBlockValue[]; // list of possible values for the dependent parameter
    valueToType?: { [key: string]: string } // mapping of dependent parameter values to types (for dynamic typing based on other parameter's value)
}

export interface DeprecatedInfo {
    replacedBy?: string;
    description?: string;
    version?: string;
}


// ID
export interface ScriptBlockID {
    parentsWithout?: string[];
    values?: string[];
    asType?: boolean;
    optional?: string[];
    canHaveSpace?: boolean;
    translation?: TranslationProperties;
}

export interface TranslationProperties {
    keyPattern: string;
    sourceFile: string;
}

export interface TranslationLocation {
    translationKey: string,
    translationValue: string,
    fileUri: vscode.Uri,
    sourceFile: string,
}

// INPUT FOR CRAFTRECIPE
export interface InputAnalysisProperty {
    source: string,
    value: any,
    range: IndexRange,
    regex: RegExp,
    type: 'array' | 'boolean' | 'string',
}

export interface InputProperty {
    name: string;
    description?: string;
    type: 'array' | 'boolean' | 'string';
    values?: string[];
}

export interface InputParameterData {
    oneOf?: string[];
    properties: { [key: string]: InputProperty };
    description: string;
}


/**
 * Format the script data into a map for easier access and case insensitivity.
 */
function mapScriptTypes(data: ScriptData): Map<string, ScriptBlockData> {
    const typeMap = new Map<string, ScriptBlockData>();
    for (const [key, value] of Object.entries(data)) {
        typeMap.set(key.toLowerCase(), value);
    }
    return typeMap;
}

// generates a regex pattern to match any script block line
export let BLOCK_NAMES = Object.keys(SCRIPTS_TYPES);
export let SCRIPTS_TYPES_LOWER = mapScriptTypes(SCRIPTS_TYPES);
export let blockPattern: RegExp;
export function initBlockRegex() {
    BLOCK_NAMES = Object.keys(SCRIPTS_TYPES);
    SCRIPTS_TYPES_LOWER = mapScriptTypes(SCRIPTS_TYPES);
    blockPattern = new RegExp(
        `^\\s*(${BLOCK_NAMES.join('|')})\\s+.*\\{.*$`
    );
}

export function setScriptsTypes(scriptsBlocks: ScriptData, rootFiles: ScriptData) {
    SCRIPTS_TYPES = scriptsBlocks;
    ROOT_FILES = rootFiles;
    initBlockRegex();
}


export let DEFAULT_ROOT_FILE = "ROOT-Scripts";
export function testForScriptRootFile(filePath: string): string | null{
    filePath = filePath.replace(/\\/g, '/');
    filePath = path.posix.normalize(filePath);
    for (const rootFile of Object.values(ROOT_FILES)) {
        for (const pattern of rootFile.pattern || []) {
            const regex = new RegExp(pattern);
            if (regex.test(filePath)) {
                return rootFile.name;
            }
        }
    }
    // default to scripts file in case of weird match case, 
    // since the user might just want to use the extension 
    // features without following the usual file naming conventions
    return null;
}