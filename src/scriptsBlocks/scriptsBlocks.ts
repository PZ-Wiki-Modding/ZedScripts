import * as vscode from 'vscode';

import { 
    DOCUMENT_IDENTIFIER,
    WIKI_LINK,
    DOCS_LINK,
} from '../project';
import { PZWorkspace } from '../workspace/workspace';

import { DefaultText } from '../models/DefaultText';
import { ThemeColorScopes } from "../models/ThemeColorType";
import { DiagnosticType } from "../models/DiagnosticType";
import { scriptBlockRegex, parameterRegex } from '../models/regexPatterns';

import { diagnostic } from '../providers/diagnostic';
import { registerActionTextReplace } from '../providers/actions';

import { ScriptParameter } from './scriptsBlocksParameter';
import { ScriptBlockData, TranslationProperties, TranslationLocation } from './scriptsBlocksData';
import { getScriptBlockData, getVariantTree, getMainVariant, isScriptBlock } from './scriptsBlocksUtility';

import { formatText, getIndentation } from '../utils/format';
import { color } from "../utils/themeColors";
import { createIndexRange, replaceCommentsWithWhitespace } from '../utils/positions';
import { log } from '../utils/logger';

// special implementations
import { DocumentBlock } from './blockTypes/document';



/**
 * Represents a script block in a PZ script file. Handles nested blocks and diagnostics.
 */
export class ScriptsBlock {
// MEMBERS
    // extra
    document: vscode.TextDocument;
    diagnostics: vscode.Diagnostic[] | undefined;
    originalScriptBlock: string | null = null;
    
    // block data
    parent: ScriptsBlock | null = null;
    scriptBlock: string = ""; // the type of the script block
    id: string | null = null;
    children: ScriptsBlock[] = [];
    parameters: ScriptParameter[] = [];
    isTemplate: boolean = false;
    isValid: boolean = true; // whether this block passed the validation checks
    translation: TranslationLocation | undefined = undefined;

    // positions
    start: number = 0;
    end: number = 0;
    lineStart: number = 0;
    lineEnd: number = 0;
    headerStart: number = 0;

    colorCode: ThemeColorScopes = ThemeColorScopes.SCRIPT_BLOCK;


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
        this.document = document;
        this.diagnostics = diagnostics;
        this.parent = parent;
        this.scriptBlock = type;
        this.id = id;
        this.start = start;
        this.end = end;
        this.headerStart = headerStart;
        this.lineStart = document.positionAt(this.start).line;
        this.lineEnd = document.positionAt(this.end).line;
    }

    /** A document root will always be found */
    public getRoot(): DocumentBlock {
        const documentBlock = DocumentBlock.getDocumentBlock(this.document);
        return documentBlock!;
    }

    public getDefinitionLocation(): vscode.Location {
        return new vscode.Location(
            this.document.uri,
            new vscode.Range(
                this.document.positionAt(this.headerStart),
                this.document.positionAt(this.end)
            )
        );
    }


// INFORMATION

    public isWord(word: string): boolean {
        return this.scriptBlock.toLowerCase() === word.toLowerCase();
    }

    public isID(word: string): string | null {
        const lowerWord = word.toLowerCase();
        if (this.id && this.id.toLowerCase() === lowerWord) {
            return this.id;
        }
        return null;
    }

    public isIndexOf(index: number): boolean {
        // check if in main block
        if (index < this.start || index >= this.end) {
            return false;
        }

        // check if in any child block
        for (const child of this.children) {
            if (index >= child.start && index < child.end) {
                return false;
            }
        }

        return true;
    }

    public getParameter(name: string, parameters?: ScriptParameter[]): ScriptParameter | null {
        const paramsToSearch = parameters || this.parameters;
        
        // search by the parameter name
        const nameLower = name.toLowerCase();
        const searchByName = paramsToSearch.find(param => param.parameter.toLowerCase() === nameLower) || null;
        if (searchByName) { return searchByName; }

        return null;
    }

    public getParameterByIndex(index: number): ScriptParameter | undefined {
        // search for the parameter-value pair at the index
        const param = this.parameters
            .find(param => index >= param.parameterRange.start && index < param.valueRange.end);
        return param;
    }

    public isParameterOf(name: string): boolean {
        const lowerCase = name.toLowerCase();
        return this.parameters.some(param => param.parameter.toLowerCase() === lowerCase);
    }

    public canHaveParameter(name: string): boolean {
        const blockData = getScriptBlockData(this.scriptBlock);
        const parameters = blockData.parameters;
        if (parameters) {
            const paramData = parameters[name.toLowerCase()];
            if (paramData) {
                return true;
            }
        }
        return false;
    }

    public shouldParameterHaveComma(): boolean {
        const blockData = getScriptBlockData(this.scriptBlock);
        return !blockData.noComma; // default is false, so should have comma by default
    }

    public getWikiPage(): string {
        const mainVariant = getMainVariant(this.scriptBlock);
        return WIKI_LINK + mainVariant.replace(' ', '_') + '_(scripts)';
    }

    public getScriptsDocPage(): string {
        const tree = getVariantTree(this.scriptBlock);
        return (DOCS_LINK + (tree.join('/')).replace(' ', '-').toLowerCase()) + '.html';
    }

    public getTree(children: boolean = false): string {
        let scriptBlock = color(this.scriptBlock, this.colorCode);
        if (!children) {
            scriptBlock = "**" + scriptBlock + "**";
        }
        const parents = [scriptBlock];
    
        // recursively collect parents
        let current = this.parent;
        while (current && current.scriptBlock !== DOCUMENT_IDENTIFIER) {
            parents.unshift(color(current.scriptBlock, current.colorCode));
            current = current.parent;
        }
        
        // build the tree string
        const str = parents.join(" → ");

        return str;
    }

    public getHoverText(): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true; // needed for html rendering

        // retrieve tree and description
        const tree = this.getTree();
        const desc = this.getDescription();

        // assemble the hover content
        markdown.appendMarkdown(`${tree}  \n`);
        markdown.appendMarkdown('\n\n---\n\n');
        markdown.appendMarkdown(desc);
        markdown.appendMarkdown('\n\n' + formatText(
            DefaultText.MORE_INFORMATION, 
            { 
                // wikiPage: this.getWikiPage(),
                scriptsDoc: this.getScriptsDocPage()
            }
        ));
        
        return markdown;
    }

    public getDescription(): string {
        const blockData = getScriptBlockData(this.scriptBlock);
        return blockData?.description || DefaultText.SCRIPT_BLOCK_DESCRIPTION;
    }

    public canHaveParent(parentBlock: string): boolean {
        const blockData = getScriptBlockData(this.scriptBlock);
        const validParents = blockData.parents;
        if (validParents.includes(parentBlock)) {
            return true;
        }
        return false;
    }

    public getRequiredChildren(): string[] | null {
        const blockData = getScriptBlockData(this.scriptBlock);
        return blockData.needsChildren || null;
    }

    public shouldHaveID(): boolean {
        if (!this.parent) { return true; } // there should always be a parent anyway
        return this.parent.shouldChildrenHaveID(this.scriptBlock);
    }

    public shouldChildrenHaveID(childrenBlock: string): boolean {
        const childrenBlockData = getScriptBlockData(childrenBlock);
        const IDData = childrenBlockData.ID;
        if (!IDData) { return false; }

        // used to check if the parent block requires an ID for this subblock
        const invalidBlocks = IDData.parentsWithout;
        let shouldHaveIDfromParent = true;
        if (invalidBlocks) {
            if (invalidBlocks.includes(this.scriptBlock)) {
                shouldHaveIDfromParent = false;
            }
        }

        return shouldHaveIDfromParent;
    }
    

    public getModule(): ScriptsBlock | null {
        // find the module block by checking parents
        let currentBlock: ScriptsBlock = this;
        while (currentBlock.parent) {
            currentBlock = currentBlock.parent;
            if (currentBlock.scriptBlock === "module") {
                return currentBlock;
            }
        }
        return null; // no module block found in parents
    }

    public collectReferencedToBlocks(refs: Map<ScriptsBlock, vscode.Range[]>): void {
        // collect references from parameters
        for (const param of this.parameters) {
            // collect block references
            if (param.ref) {
                // get position
                const valueRange = param.valueRange;
                const startPos = this.document.positionAt(valueRange.start);
                const endPos = this.document.positionAt(valueRange.end);

                const referencedBlocks = param.ref.blocks;
                for (const refBlock of referencedBlocks) {
                    if (!refs.has(refBlock)) {
                        refs.set(refBlock, []);
                    }

                    refs.get(refBlock)!.push(new vscode.Range(startPos, endPos));
                }
            }
        }

        // collect references from children blocks
        for (const child of this.children) {
            child.collectReferencedToBlocks(refs);
        }
    }

    public collectReferencesPerType(refs: Map<string, vscode.Range[]>): void {
        const refBlocks = new Map<ScriptsBlock, vscode.Range[]>();
        this.collectReferencedToBlocks(refBlocks);

        for (const [refBlock, ranges] of refBlocks) {
            const expectedBlock = refBlock.scriptBlock;
            if (!refs.has(expectedBlock)) {
                refs.set(expectedBlock, []);
            }
            refs.get(expectedBlock)!.push(...ranges);
        }
    }

    public getHeaderEdits(edits: vscode.TextEdit[]): void {
        // get indentation level by finding depth level
        const depthLevel = this.getDepthLevel();
        const indentBase = getIndentation(this.document);
        const indentation = indentBase.repeat(depthLevel);

        // get header position
        const lineStartNumber = this.document.positionAt(this.headerStart).line;
        const lineStart = this.document.lineAt(lineStartNumber).range.start;

        // retrieve block edits, that is the scriptBlock + ID
        // then the opening brace, then the closing brace
        const blockHeader = `${indentation}${this.scriptBlock}${this.id ? " " + this.id : ""} {`;
        const currentHeaderRange = new vscode.Range(
            lineStart,
            this.document.positionAt(this.start)
        );
        const headerEdit = vscode.TextEdit.replace(currentHeaderRange, blockHeader);
        edits.push(headerEdit);

        // add edit for the closing brace
        const closingBraceLine = this.document.lineAt(this.lineEnd);
        const closingBraceRange = new vscode.Range(
            closingBraceLine.range.start,
            closingBraceLine.range.end
        );
        const closingBraceEdit = vscode.TextEdit.replace(closingBraceRange, `${indentation}}`);
        edits.push(closingBraceEdit);
    }

    public getFormattingEdits(edits: vscode.TextEdit[]): void {
        // retrieve parameter edits
        for (const param of this.parameters) {
            const edit = param.getFormattingEdit();
            edits.push(edit);
        }

        this.getHeaderEdits(edits);

        // get children edits recursively
        for (const child of this.children) {
            child.getFormattingEdits(edits);
        }
    }

    public getDepthLevel(): number {
        let depth = -1; // -1 since final parent is always the document block
        let current = this.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    public getMaxParameterLength(): number {
        let maxLength = 0;
        for (const param of this.parameters) {
            if (param.parameter.length > maxLength) {
                maxLength = param.parameter.length;
            }
        }
        return maxLength;
    }


// SEARCHERS

    public search(): void {
        this.children = this.findChildBlocks();
        this.parameters = this.findParameters();
    }


    protected findChildBlocks(): ScriptsBlock[] {
        const children: ScriptsBlock[] = [];

        const document = this.document;
        const text = replaceCommentsWithWhitespace(
            document.getText()
        );

        const blockHeader = scriptBlockRegex;
        let match: RegExpExecArray | null;
        let searchPos = this.start;

        while (searchPos < text.length) {
            // find the first script block
            blockHeader.lastIndex = searchPos;
            match = blockHeader.exec(text);            
            if (!match) break;

            // retrieve the match informations
            const blockType = match[1];
            const id = match[2].trim();
            const headerStart = match.index + match[0].indexOf(blockType); // position of the block keyword
            const braceStart = blockHeader.lastIndex - 1; // position of the '{'

            // stop if the block is outside the current block
            let braceCount = 1;
            let i = braceStart + 1;
            if (i >= this.end) {
                break;
            }

            // find the matching closing brace
            for (; i < text.length; ++i) {
                if (text[i] === '{') braceCount++;
                else if (text[i] === '}') braceCount--;
                if (braceCount === 0) break;
            }

            // unmatched braces
            if (braceCount !== 0) {
                if (this.diagnostic(
                    DiagnosticType.UNMATCHED_BRACE,
                    { scriptBlock: blockType },
                    headerStart
                )) {
                    break;
                }
            }

            // create the child block
            const blockEnd = i + 1; // position after the '}'
            const startOffset = braceStart + 1;
            const endOffset = blockEnd;
            const blockClass = assignedClasses.get(blockType) || ScriptsBlock;
            const childBlock = new blockClass(
                document,
                this.diagnostics,
                this,
                blockType,
                id || null,
                startOffset,
                endOffset,
                headerStart
            );
            children.push(childBlock);
            searchPos = endOffset;
        
            // stop if we reached the end of this block
            if (searchPos >= this.end) {
                break;
            }
        }

        // search recursively in children blocks
        for (const child of children) {
            if (child.isValid) {
                child.search();
            }
        }

        return children;
    }

    protected findParameters(): ScriptParameter[] {
        const document = this.document;
        const text = replaceCommentsWithWhitespace(
            document.getText().slice(this.start, this.end)
        );

        const parameters: ScriptParameter[] = [];

        const matches = Array.from(text.matchAll(parameterRegex));

        for (const match of matches) {
            const groups = match.groups;
            if (!groups) continue;
            const fullMatch = match[0];
            const name = groups.name.trim();
            const value = groups.value.trim();
            const comma = groups.comma.trim();

            const index = match.index!;

            const nameRange = createIndexRange(this.start, index, fullMatch, name);

            // const nameStart = this.start + index + fullMatch.indexOf(name);
            // const nameEnd = nameStart + name.length;
            // const nameRange: IndexRange = {start: nameStart, end: nameEnd};

            const valueRange = createIndexRange(this.start, index, fullMatch, value);
            
            // const valueStart = this.start + index + fullMatch.indexOf(value);
            // const valueEnd = valueStart + value.length;
            // const valueRange: IndexRange = {start: valueStart, end: valueEnd};

            // verify it is within this block and not in a child block
            if (!this.isIndexOf(nameRange.start) || !this.isIndexOf(nameRange.end - 1)) {
                continue;
            }

            // verify it isn't already a parameter of the block
            const param = this.getParameter(name, parameters);
            let isDuplicate = false;
            if (param) {
                isDuplicate = true;
                param.setAsDuplicate(); // set the other parameter as duplicate too
            }

            const parameter = new ScriptParameter(
                document,
                this,
                this.diagnostics,
                name,
                value,
                nameRange,
                valueRange,
                comma,
                isDuplicate
            );

            parameters.push(parameter);
        }
        return parameters;
    }

    public getTranslationData(): TranslationProperties | undefined {
        const blockData = getScriptBlockData(this.scriptBlock) as ScriptBlockData;
        const IDData = blockData.ID;
        return IDData?.translation;
    }

    public getTranslationSearchInfo(translationData: TranslationProperties): {translationKey: string, sourceFile: string} {
        const keyPattern = translationData.keyPattern;
        const sourceFile = translationData.sourceFile;
        const id = this.id || ""; // should be here only if has ID, but just in case
        const module = this.getModule()?.id || "Base"; // there must be a module, but just in case

        const translationKey = formatText(
            keyPattern, { module, value: id }
        );
        return {
            translationKey: translationKey,
            sourceFile: sourceFile
        };
    }

    public getTranslationReference(): TranslationLocation | null {
        if (this.translation) {
            return this.translation;
        }
        
        const translationData = this.getTranslationData();
        if (!translationData) { return null; }

        const info = this.getTranslationSearchInfo(translationData)
        const result = PZWorkspace.getTranslationKeyFromVersion(
            this.getRoot().version,
            info.translationKey, 
            info.sourceFile
        );

        // cache for easier access later
        // for definitions
        this.translation = result;

        return result || null;
    }

// CHECKERS

    public shouldValidate(): boolean {
        if (this.diagnostics === undefined) {
            return false;
        }
        return true;
    }

    protected validateBlock(): boolean {
        if (!this.shouldValidate()) { return true; }

        const type = this.scriptBlock;

        // verify it's a script block
        if (!isScriptBlock(type)) {
            this.diagnostic(
                DiagnosticType.NOT_VALID_BLOCK,
                { scriptBlock: type },
                this.headerStart
            );
            return false;
        }

        // verify ID
        if (!this.validateID()) {
            // return false;
        }

        // verify parent block
        if (!this.validateParent()) {
            // return false;
        }

        // verify children blocks
        if (!this.validateChildren()) {
            // return false;
        }

        return true;
    }


    /**
     * Validates the current relationship between this block and its parent block, if any.
     */
    protected validateParent(): boolean {
        if (!this.shouldValidate()) { return true; }

        const blockData = getScriptBlockData(this.scriptBlock) as ScriptBlockData;

        // check parent type
        const validParents = blockData.parents;
        if (validParents && this.parent) {
            const parentType = this.parent.scriptBlock;
            if (!validParents.includes(parentType)) {
                if (this.diagnostic(
                    DiagnosticType.WRONG_PARENT_BLOCK,
                    { scriptBlock: this.scriptBlock, parentBlock: parentType, parentBlocks: validParents.map(p => `'${p}'`).join(", ") },
                    this.headerStart
                )) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Validates the relationship between this block and its children blocks, if any.
     */
    protected validateChildren(): boolean {
        if (!this.shouldValidate()) { return true; }

        const blockData = getScriptBlockData(this.scriptBlock);

        const validChildren = blockData.needsChildren;
        if (validChildren) {
            const childTypes = this.children.map(child => child.scriptBlock);
            for (const neededChild of validChildren) {
                if (!childTypes.includes(neededChild)) {
                    if (this.diagnostic(
                        DiagnosticType.MISSING_CHILD_BLOCK,
                        { scriptBlock: this.scriptBlock, childBlocks: validChildren.map(p => `'${p}'`).join(", ") },
                        this.headerStart,
                        this.headerStart,
                        vscode.DiagnosticSeverity.Hint
                    )) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    protected validateID(): boolean {
        if (this.scriptBlock === DOCUMENT_IDENTIFIER) {
            return true;
        }

        const blockData = getScriptBlockData(this.scriptBlock) as ScriptBlockData;

        // retrieve ID info
        const id = this.id;
        const hasID = id !== null && id !== undefined;

        // no ID data, means there shouldn't be any ID
        const IDData = blockData.ID;
        if (!IDData) {
            if (hasID) {
                if (this.diagnostic(
                    DiagnosticType.HAS_ID,
                    { scriptBlock: this.scriptBlock }, 
                    this.headerStart
                )) {
                    return false;
                }
            }
            return true;
        }

        const optionalBlocks = IDData.optional;
        if (optionalBlocks && this.parent) {
            if (optionalBlocks.includes(this.parent.scriptBlock)) {
                return true; // ID is optional for this block, so we can skip the rest of the checks
            }
        }

        // used to check if the parent block requires an ID for this subblock
        const invalidBlocks = IDData.parentsWithout;
        let shouldHaveIDfromParent = true;
        if (invalidBlocks && this.parent) {
            if (invalidBlocks.includes(this.parent.scriptBlock)) {
                shouldHaveIDfromParent = false;
            }
        }

        // should have an ID
        if (!hasID && shouldHaveIDfromParent) {
            const diagnosticOutput = this.diagnostic(
                DiagnosticType.MISSING_ID,
                { scriptBlock: this.scriptBlock }, 
                this.headerStart
            );
            
            if (diagnosticOutput) {
                const newID = "yourID"; // placeholder text for the ID
                const fix = registerActionTextReplace(
                    this.document,
                    new vscode.Range(
                        this.document.positionAt(this.headerStart),
                        this.document.positionAt(this.headerStart)
                    ),
                    `${this.scriptBlock} ${newID}`, // placeholder text for the ID
                    "Add an ID to the script block"
                );
                this.registerFix(fix, diagnosticOutput, new vscode.Range(
                    this.document.positionAt(this.headerStart),
                    this.document.positionAt(this.headerStart)
                ));
                return false;
            }
        }

        // has an ID, so validate it
        if (hasID) {
            // check if parent block forbids an ID for this subblock
            if (!shouldHaveIDfromParent) {
                if (this.diagnostic(
                    DiagnosticType.HAS_ID_IN_PARENT,
                    { 
                        scriptBlock: this.scriptBlock, 
                        parentBlock: this.parent ? this.parent.scriptBlock : "unknown", 
                        invalidBlocks: invalidBlocks ? invalidBlocks.map(p => `'${p}'`).join(", ") : "unknown" }, 
                    this.headerStart
                )) {
                    return false;
                }
            }

            // make sure the ID doesn't contain spaces if it isn't considered as part of the type
            if (!IDData.canHaveSpace && id && id.includes(" ")) {
                if (this.diagnostic(
                    DiagnosticType.ID_CANNOT_CONTAIN_SPACES,
                    { scriptBlock: this.scriptBlock, id: id },
                    this.headerStart
                )) {
                    return false;
                }
            }

            // check if the ID has one or more valid value
            const validIDs = IDData.values;
            if (validIDs) {
                // verify the ID is valid
                if (!validIDs.includes(id)) {
                    if (this.diagnostic(
                        DiagnosticType.INVALID_ID,
                        { scriptBlock: this.scriptBlock, id: id, validIDs: validIDs.map(p => `'${p}'`).join(", ") },
                        this.headerStart
                    )) {
                        return false;
                    }
                }

                // consider the ID as part of the script block type
                // this means it will be a script block in itself with its own data
                if (IDData.asType) {
                    this.originalScriptBlock = this.scriptBlock;
                    this.scriptBlock = this.scriptBlock + " " + id;
                    this.id = null; // reset ID to null
                }
            }

            // check if the ID has a translation
            const translationLoc = this.getTranslationReference();   
            const translationData = this.getTranslationData();
            if (!translationLoc && translationData) {
                const info = this.getTranslationSearchInfo(translationData)
                if (this.diagnostic(
                    DiagnosticType.INVALID_TRANSLATION_KEY,
                    { 
                        element: this.scriptBlock, 
                        value: id, 
                        translationKey: info.translationKey,
                        sourceFile: info.sourceFile + '.json',
                    },
                    this.headerStart, this.headerStart + this.scriptBlock.length + 1 + id.length
                )) {
                    return false;
                }
            }
        }
        
        return true;
    }

    public validateRecursive(): void {
        // skip validation if diagnostics are not enabled
        if (!this.shouldValidate()) { return; }

        // validate itself
        try {
            if (!this.validateBlock()) {
                this.isValid = false;
            }
        } catch (error) {
            const position = `${this.lineStart}:${this.lineEnd}`;
            log(`Error validating block (${this.scriptBlock}, ${this.id}, ${position}): ${error}`, "error");
        }

        // validate parameters
        for (const parameter of this.parameters) {
            try {
                parameter.validate();
            } catch (error) {
                const position = `${parameter.parameterRange.start}:${parameter.parameterRange.end}`;
                log(`Error validating parameter (${this.scriptBlock}, ${this.id}, ${parameter.parameter}, ${position}): ${error}`, "error");
            }
        }

        // recursively run validate later on children blocks
        for (const child of this.children) {
            child.validateRecursive();
        }
    }


// DIAGNOSTICS HELPERS

    private registerFix(
        fix: vscode.CodeAction, diagnostic: vscode.Diagnostic, range: vscode.Range
    ): void {
        const documentBlock = this.getRoot();
        documentBlock.addAction(range, diagnostic, fix);
    }

    protected diagnostic(
        type: DiagnosticType,
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

// EXPORTS

    public export(): Record<string, unknown> {
        return {
            scriptBlock: this.scriptBlock,
            id: this.id,
            isTemplate: this.isTemplate,
            isValid: this.isValid,
            originalScriptBlock: this.originalScriptBlock,
            positions: {
                start: this.start,
                end: this.end,
                lineStart: this.lineStart,
                lineEnd: this.lineEnd,
                headerStart: this.headerStart
            },
            parameters: this.parameters.map(param => param.export()),
            children: this.children.map(child => child.export())
        };
    }
}



/**
 * Utility class to deactivate any kind of validation and parsing for certain script blocks.
 */
export class IgnoreAll extends ScriptsBlock {
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

    protected findChildBlocks(): ScriptsBlock[] { 
        return []; 
    }

    protected findParameters(): ScriptParameter[] {
        return [];
    }
}






// later load
import { TemplateBlock } from './blockTypes/template';
import { ComponentBlock } from './blockTypes/component';
import { ImportsBlock } from './blockTypes/imports';
import { InputsBlock } from './blockTypes/inputs';
import { ItemBlock } from './blockTypes/item';
// import { ItemMapperBlock } from './blockTypes/itemMapper';

// ASSIGNED CLASSES FOR SCRIPT BLOCK TYPES
const assignedClasses = new Map<string, typeof ScriptsBlock>();

assignedClasses.set("template", TemplateBlock);
assignedClasses.set("component", ComponentBlock);
assignedClasses.set("imports", ImportsBlock);
assignedClasses.set("inputs", InputsBlock);
assignedClasses.set("item", ItemBlock);
// assignedClasses.set("itemMapper", ItemMapperBlock);

// TODO: needs to implement properly, for now disable those
// the items they refer to should be verified for existence and validity
assignedClasses.set("table", IgnoreAll);
assignedClasses.set("lua", IgnoreAll);
assignedClasses.set("itemMapper", IgnoreAll);
assignedClasses.set("overlayMapper", IgnoreAll);
assignedClasses.set("components", IgnoreAll);
assignedClasses.set("xuiSkin", IgnoreAll);