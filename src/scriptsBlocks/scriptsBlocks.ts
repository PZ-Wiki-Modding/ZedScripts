import * as vscode from 'vscode';
import { scriptBlockRegex, parameterRegex, inputsOutputsRegex } from '../models/regexPatterns';
import { 
    DOCUMENT_IDENTIFIER, 
    ThemeColorType, 
    DiagnosticType, 
    DefaultText, 
    WIKI_LINK,
    formatText,
    DOCS_LINK
} from '../models/enums';
import { diagnostic } from '../providers/diagnostic';
import { color } from "../utils/themeColors";
import { ScriptBlockData } from './scriptsBlocksData';
import { getScriptBlockData, getVariantTree, getMainVariant, isScriptBlock } from './scriptsBlocksUtility';
import { IndexRange, createIndexRange, replaceCommentsWithWhitespace } from '../utils/positions';
import { ScriptParameter } from './scriptsBlocksParameter';
import { InputsItemParameter, InputsFluidParameter, InputsParameter } from './scriptsBlocksProperties';

/**
 * Represents a script block in a PZ script file. Handles nested blocks and diagnostics.
 */
export class ScriptBlock {
// MEMBERS
    // extra
    document: vscode.TextDocument;
    diagnostics: vscode.Diagnostic[] | undefined;
    originalScriptBlock: string | null = null;
    
    // block data
    parent: ScriptBlock | null = null; // the parent script block, if any
    scriptBlock: string = ""; // the type of the script block
    id: string | null = null; // the ID of the block, if any
    children: ScriptBlock[] = []; // children script blocks
    parameters: ScriptParameter[] = []; // parameters of the block
    isTemplate: boolean = false; // whether this block is a template block
    isValid: boolean = true;

    // positions
    start: number = 0;
    end: number = 0;
    lineStart: number = 0;
    lineEnd: number = 0;
    headerStart: number = 0;

    colorCode: ThemeColorType = ThemeColorType.SCRIPT_BLOCK;


// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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

        try {
        if (!this.validateBlock()) {
                this.isValid = false;
            }
        } catch (error) {
            console.error(`Error validating block: ${error}`);
            this.isValid = false; // mark as not valid
        }
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
                this.document.positionAt(this.start),
                this.document.positionAt(this.end)
            )
        );
    }


// INFORMATION

    public isWord(word: string): boolean {
        return this.scriptBlock.toLowerCase() === word.toLowerCase();
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
                wikiPage: this.getWikiPage(),
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
    

    public collectReferences(refs: Map<string, vscode.Range[]>): void {
        // collect references from parameters
        for (const param of this.parameters) {
            if (param.ref) {
                // get position
                const valueRange = param.valueRange;
                const startPos = this.document.positionAt(valueRange.start);
                const endPos = this.document.positionAt(valueRange.end);

                const expectedBlock = param.ref.expectedBlock;

                if (!refs.has(expectedBlock)) {
                    refs.set(expectedBlock, []);
                }

                refs.get(expectedBlock)!.push(new vscode.Range(startPos, endPos));
            }
        }

        // collect references from children blocks
        for (const child of this.children) {
            child.collectReferences(refs);
        }
    }


// SEARCHERS

    public search(): void {
        this.children = this.findChildBlocks();
        this.validateChildren();
        this.parameters = this.findParameters();
    }


    protected findChildBlocks(): ScriptBlock[] {
        const children: ScriptBlock[] = [];

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
            const blockClass = assignedClasses.get(blockType) || ScriptBlock;
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

        return true;
    }

    protected validateParent(): boolean {
        if (!this.shouldValidate()) { return true; }

        const blockData = getScriptBlockData(this.scriptBlock) as ScriptBlockData;

        // check should have parent
        const shouldHaveParent = blockData.shouldHaveParent;
        if (shouldHaveParent) {
            if (!this.parent) {
                const parentBlocks = blockData?.parents?.map(p => `'${p}'`).join(", ") || "unknown";
                if (this.diagnostic(
                    DiagnosticType.MISSING_PARENT_BLOCK,
                    { scriptBlock: this.scriptBlock, parentBlocks: parentBlocks },
                    this.headerStart
                )) {
                    return false;
                }
            }
        
        // shouldn't have parent
        } else {
            // but has one when shouldn't
            if (this.parent && this.parent.scriptBlock !== DOCUMENT_IDENTIFIER) {
                if (this.diagnostic(
                    DiagnosticType.HAS_PARENT_BLOCK,
                    { scriptBlock: this.scriptBlock }, 
                    this.headerStart
                )) {
                    return false;
                }
            }
            // all good, no parent as expected
            return true;
        }

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
        
        // check if ID is required
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
            if (this.diagnostic(
                DiagnosticType.MISSING_ID,
                { scriptBlock: this.scriptBlock }, 
                this.headerStart
            )) {
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
        }
        
        return true;
    }

    public validateRecursiveLater(): void {
        // recursively run validate later on children parameters
        for (const child of this.children) {
            for (const parameter of child.parameters) {
                try {
                    parameter.validateLater();
                } catch (error) {
                    console.error(`Error validating parameter: ${error}`);
                }
            }

            child.validateRecursiveLater();
        }
    }


// DIAGNOSTICS HELPERS

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


export class ItemBlock extends ScriptBlock {
// CONSTRUCTOR
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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



/**
 * A ScriptBlock that represents a 'component' block specifically.
 */
export class ComponentBlock extends ScriptBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
        type: string,
        id: string | null,
        start: number,
        end: number,
        headerStart: number
    ) {
        super(document, diagnostics, parent, type, id, start, end, headerStart);
    }

    // override isWord to check original script block since ID and scriptBlock are merged
    public isWord(word: string): boolean {
        return this.originalScriptBlock === word;
    }
}


export class ItemMapperBlock extends ScriptBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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


export class TemplateBlock extends ScriptBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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


export class ImportsBlock extends ScriptBlock {
    imports: string[] = [];

    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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


export class InputsBlock extends ScriptBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
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

export class IgnoreAll extends ScriptBlock {
    constructor(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[] | undefined,
        parent: ScriptBlock | null,
        type: string,
        id: string | null,
        start: number,
        end: number,
        headerStart: number
    ) {
        super(document, diagnostics, parent, type, id, start, end, headerStart);
    }

    protected findChildBlocks(): ScriptBlock[] { 
        return []; 
    }

    protected findParameters(): ScriptParameter[] {
        return [];
    }
}


/**
 * A ScriptBlock that represents the entire document. This is more a convenience class to handle everything easily.
 */
export class DocumentBlock extends ScriptBlock {
    public static documentBlockCache: Map<string, DocumentBlock> = new Map();
    public actions: [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] = []; // [range, diagnostic, action]

    constructor(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[] | undefined, type: string) {
        // Only document is provided
        const parent = null;
        const id = null;
        const start = 0;
        const end = document.getText().length;
        super(document, diagnostics, parent, type, id, start, end, start);

        // cache this document block
        DocumentBlock.documentBlockCache.set(document.uri.toString(), this);

        this.search(); // search for the blocks and parameters in the document
    }


// CACHE

    // Static method to retrieve cached DocumentBlock
    public static getDocumentBlock(document: vscode.TextDocument): DocumentBlock | undefined {
        const documentBlock = DocumentBlock.documentBlockCache.get(document.uri.toString());
        // if (!documentBlock) {
        //     documentBlock = new DocumentBlock(document, []);
        // }
        return documentBlock;
    }

    public static clearCache(): void {
        DocumentBlock.documentBlockCache.clear();
    }

    public static clearCacheForUri(uri: vscode.Uri): void {
        DocumentBlock.documentBlockCache.delete(uri.toString());
    }


// ACTIONS

    public addAction(range: vscode.Range, diagnostic: vscode.Diagnostic, action: vscode.CodeAction): void {
        this.actions.push([range, diagnostic, action]);
    }

    public getActionsForRange(range: vscode.Range): [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] {
        const actions: [vscode.Range, vscode.Diagnostic, vscode.CodeAction][] = [];
        for (const [actionRange, diagnostic, action] of this.actions) {
            if (actionRange.contains(range)) {
                actions.push([actionRange, diagnostic, action]);
            }
        }
        return actions;
    }


// ACCESS

    public static getAllDocumentBlocks(): DocumentBlock[] {
        return Array.from(DocumentBlock.documentBlockCache.values());
    }

    public getBlock(index: number): ScriptBlock | null {
        // check if index is within this document
        if (index < this.headerStart || index >= this.end) {
            return this;
        }

        // recursive search for the block containing the index
        const searchBlock = (block: ScriptBlock, level: number = 0): ScriptBlock | null => {
            for (const child of block.children) {
                if (index >= child.headerStart && index < child.end) {
                    // found a child containing the index, search deeper
                    const found = searchBlock(child, level + 1);
                    return found || child;
                }
            }
            if (level === 0) {
                // if we are at the top level and no child contains the index, return the document block
                return this;
            }
            return null; // no child contains the index
        }
        return searchBlock(this);
    }

    public static findBlockFromFullType(
        expectedBlock: string, modules: string[], id: string
    ): ScriptBlock[] {
        // expectedBlock is the type of block we are looking for (ex: "model")
        // fullType is the module and ID of the block we are looking for (ex: ["Base", "WoodenTable"])

        // search for the block with the expected type and full type
        const foundBlocks: ScriptBlock[] = [];
        for (const documentBlock of DocumentBlock.documentBlockCache.values()) {
            const found = documentBlock.findBlockFromFullTypeInBlock(expectedBlock, modules, id);
            if (found) {
                foundBlocks.push(...found);
            }
        }
        
        return foundBlocks; // return all found blocks
    }

    public findBlockFromFullTypeInBlock(expectedBlock: string, modules: string[], id: string): ScriptBlock[] {
        // in children, find a module block
        let moduleBlock: ScriptBlock | null = null;
        for (const child of this.children) {
            if (child.scriptBlock === "module") {
                const childId = child.id;
                if (childId && modules.includes(childId)) {
                    moduleBlock = child;
                    break;
                }
            }
        }

        if (!moduleBlock) {
            return []; // no module block found with the expected module name
        }

        // in the module block, find a block with the expected type and ID
        const found: ScriptBlock[] = [];
        for (const child of moduleBlock.children) {
            if (child.scriptBlock === expectedBlock) {
                if (child.id === id) {
                    // found a block with the expected type and full type
                    found.push(child);
                }
            }
        }

        return found; // return all found blocks
    }


    public getImports(): string[] {
        // retrieve imports block modules
        const imports: string[] = ['Base']; // Base is always implicitly imported
        for (const child of this.children) {
            if (child instanceof ImportsBlock) {
                imports.push(...child.getImports());
            }
        }

        // also consider direct module children as imports
        for (const child of this.children) {
            if (child.scriptBlock === "module" && child.id && !imports.includes(child.id)) {
                imports.push(child.id);
            }
        }
        return imports;
    }


// VALIDATORS
    public static validateLaterDocuments(): void {
        // run validateRecursiveLater on all cached document blocks
        for (const documentBlock of DocumentBlock.documentBlockCache.values()) {
            documentBlock.validateRecursiveLater();
        }
    }


// OVERWRITES
    // overwrite validates for this class since the rules aren't the same
    protected validateBlock(): boolean { return true; }
    // protected validateChildren(): boolean { return true; } // some documents might need children
    protected validateID(): boolean { return true; }
    // protected findParameters(): ScriptParameter[] { return []; }


// EXPORTS
    public gather_exports(): Record<string, unknown> {
        const exports: Record<string, unknown> = {};
        for (const child of this.children) {
            if (child.id) {
                exports[child.id] = child.export();
            }
        }
        return exports;
    }

    public static exportAll(): Record<string, unknown> {
        const allExports: Record<string, unknown> = {};
        for (const documentBlock of DocumentBlock.documentBlockCache.values()) {
            allExports[documentBlock.document.uri.toString()] = documentBlock.gather_exports();
        }
        return allExports;
    }

    public export(): Record<string, unknown> {
        const baseExport = super.export();
        baseExport["filePath"] = this.document.uri.fsPath;
        return baseExport;
    }
}



// ASSIGNED CLASSES FOR SCRIPT BLOCK TYPES
const assignedClasses = new Map<string, typeof ScriptBlock>();
assignedClasses.set("item", ItemBlock);
assignedClasses.set("component", ComponentBlock);
assignedClasses.set("template", TemplateBlock);
assignedClasses.set("itemMapper", ItemMapperBlock);
assignedClasses.set("imports", ImportsBlock);
assignedClasses.set("inputs", InputsBlock);

assignedClasses.set("table", IgnoreAll);
assignedClasses.set("lua", IgnoreAll);

// TODO: needs to implement properly, for now disable those
// the items they refer to should be verified for existence and validity
assignedClasses.set("itemMapper", IgnoreAll);
assignedClasses.set("overlayMapper", IgnoreAll);
assignedClasses.set("components", IgnoreAll);