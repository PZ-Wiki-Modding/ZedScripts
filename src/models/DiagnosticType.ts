import * as vscode from "vscode";

/**
 * Diagnostic keys used for validating scripts.
 * Each diagnostic can be deactivated via the extension settings 
 * by providing the enum key.
 */
export enum DiagnosticType {
    // formatting related diagnostics
    MISSING_COMMA = "MISSING_COMMA",
    INVALID_COMMA = "INVALID_COMMA",
    UNMATCHED_BRACE = "UNMATCHED_BRACE",
    UNEXPECTED_CLOSING_BRACKET = "UNEXPECTED_CLOSING_BRACKET",
    NOT_VALID_BLOCK = "NOT_VALID_BLOCK",

    // parent/child block related diagnostics
    MISSING_PARENT_BLOCK = "MISSING_PARENT_BLOCK",
    HAS_PARENT_BLOCK = "HAS_PARENT_BLOCK",
    WRONG_PARENT_BLOCK = "WRONG_PARENT_BLOCK",
    MISSING_CHILD_BLOCK = "MISSING_CHILD_BLOCK",

    // ID related diagnostics
    MISSING_ID = "MISSING_ID",
    HAS_ID = "HAS_ID",
    INVALID_ID = "INVALID_ID",
    HAS_ID_IN_PARENT = "HAS_ID_IN_PARENT",
    ID_CANNOT_CONTAIN_SPACES = "ID_CANNOT_CONTAIN_SPACES",

    // parameter related diagnostics
    UNKNOWN_PARAMETER = "UNKNOWN_PARAMETER",
    MISSING_PARAMETER = "MISSING_PARAMETER",
    DUPLICATE_PARAMETER = "DUPLICATE_PARAMETER",

    MISSING_VALUE = "MISSING_VALUE",
    INVALID_PARAMETER_VALUE = "INVALID_PARAMETER_VALUE",
    WRONG_VALUE = "WRONG_VALUE",
    WRONG_VALUES = "WRONG_VALUES",

    DEPRECATED_PARAMETER = "DEPRECATED_PARAMETER",
    DEPRECATED_PARAMETER_REPLACEMENT = "DEPRECATED_PARAMETER_REPLACEMENT",
    DEPRECATED_PARAMETER_VERSION = "DEPRECATED_PARAMETER_VERSION",
    DEPRECATED_PARAMETER_REPLACEMENT_VERSION = "DEPRECATED_PARAMETER_REPLACEMENT_VERSION",

    MISSING_DEPENDENT_PARAMETER = "MISSING_DEPENDENT_PARAMETER",
    DEPENDENT_PARAMETER_WRONG_VALUE = "DEPENDENT_PARAMETER_WRONG_VALUE",
    INVALID_TYPE_FOR_VALUE = "INVALID_TYPE_FOR_VALUE",
    INVALID_TYPE_FOR_VALUES_OBJECT = "INVALID_TYPE_FOR_VALUES_OBJECT",
    INVALID_OBJECT_FORMAT = "INVALID_OBJECT_FORMAT",

    NO_BLOCK_REF = "NO_BLOCK_REF",
    CANNOT_PROVIDE_MODULE = "CANNOT_PROVIDE_MODULE",
    INVALID_BLOCK_REF = "INVALID_BLOCK_REF",
    INVALID_BLOCK_REF_NO_AUTO = "INVALID_BLOCK_REF_NO_AUTO",
    MULTIPLE_BLOCK_REFS = "MULTIPLE_BLOCK_REFS",

    // craftRecipe related diagnostics
    INVALID_AMOUNT = "INVALID_AMOUNT",
    INTEGER_AMOUNT = "INTEGER_AMOUNT",
    DUPLICATE_PROPERTY = "DUPLICATE_PROPERTY",
    MISSING_ONEOF_PROPERTY = "MISSING_ONEOF_PROPERTY",

    NO_DOTS_ITEM = "NO_DOTS_ITEM",
    MISSING_MODULE = "MISSING_MODULE",
    ALL_WITH_OTHERS = "ALL_WITH_OTHERS",
    SPACES_IN_ITEM = "SPACES_IN_ITEM",
    INVALID_VALUE = "INVALID_VALUE",

    // translations diagnostics
    INVALID_TRANSLATION_KEY = "INVALID_TRANSLATION_KEY",

    _DEBUG = "_DEBUG",
}

/**
 * Metadata for diagnostic messages, including descriptions and other properties.
 */
export const DiagnosticMetadata: Record<DiagnosticType, { message: string, tags?: vscode.DiagnosticTag[] }> = {
    // formatting related diagnostics
    [DiagnosticType.MISSING_COMMA]:              {                                           message: "Missing comma." },
    [DiagnosticType.INVALID_COMMA]:              {                                           message: "Invalid comma." },
    [DiagnosticType.UNMATCHED_BRACE]:            {                                           message: "Missing closing bracket '}' for '{scriptBlock}' block." },
    [DiagnosticType.UNEXPECTED_CLOSING_BRACKET]: {                                           message: "Unexpected extra closing bracket '}'." },
    [DiagnosticType.NOT_VALID_BLOCK]:            { tags: [vscode.DiagnosticTag.Unnecessary], message: "'{scriptBlock}' is an unknown script block." },

    // parent/child block related diagnostics
    [DiagnosticType.MISSING_PARENT_BLOCK]: { message: "'{scriptBlock}' block must be inside a valid parent block: {parentBlocks}." },
    [DiagnosticType.HAS_PARENT_BLOCK]:     { message: "'{scriptBlock}' block cannot be inside any parent block." },
    [DiagnosticType.WRONG_PARENT_BLOCK]:   { message: "'{scriptBlock}' block cannot be inside parent block '{parentBlock}'. Valid parent blocks are: {parentBlocks}." },
    [DiagnosticType.MISSING_CHILD_BLOCK]:  { message: "'{scriptBlock}' block must have child blocks: {childBlocks}. This might be intentional for soft overrides of an existing block." },

    // ID related diagnostics
    [DiagnosticType.MISSING_ID]:               { message: "'{scriptBlock}' block is missing an ID." },
    [DiagnosticType.HAS_ID]:                   { message: "'{scriptBlock}' block cannot have an ID." },
    [DiagnosticType.INVALID_ID]:               { message: "'{scriptBlock}' block has an invalid ID '{id}'. Valid IDs are: {validIDs}." },
    [DiagnosticType.HAS_ID_IN_PARENT]:         { message: "'{scriptBlock}' block cannot have an ID when inside parent block '{parentBlock}', only for: {invalidBlocks}." },
    [DiagnosticType.ID_CANNOT_CONTAIN_SPACES]: { message: "ID '{id}' of '{scriptBlock}' block cannot contain spaces." },

    // parameter related diagnostics
    [DiagnosticType.UNKNOWN_PARAMETER]:   { tags: [vscode.DiagnosticTag.Unnecessary], message: "'{parameter}' is an unknown parameter for '{scriptBlock}' block." },
    [DiagnosticType.MISSING_PARAMETER]:   {                                           message: "'{scriptBlock}' block is missing required parameter(s): {parameters}." },
    [DiagnosticType.DUPLICATE_PARAMETER]: { tags: [vscode.DiagnosticTag.Unnecessary], message: "'{parameter}' is defined multiple times in '{scriptBlock}' block." },

    [DiagnosticType.MISSING_VALUE]:           { message: "Missing a value." },
    [DiagnosticType.INVALID_PARAMETER_VALUE]: { message: "'{parameter}' has an invalid value '{value}'." },
    [DiagnosticType.WRONG_VALUE]:             { message: "'{value}' is not a valid value for parameter '{parameter}'. Valid values are: {validValues}." },
    [DiagnosticType.WRONG_VALUES]:            { message: "Invalid values for parameter '{parameter}' ({invalidValues}). Valid values are: {validValues}." },

    [DiagnosticType.DEPRECATED_PARAMETER]:                     { tags: [vscode.DiagnosticTag.Deprecated], message: "This parameter is deprecated. {description}" },
    [DiagnosticType.DEPRECATED_PARAMETER_REPLACEMENT]:         { tags: [vscode.DiagnosticTag.Deprecated], message: "This parameter is deprecated and replaced by '{replacement}'. {description}" },
    [DiagnosticType.DEPRECATED_PARAMETER_VERSION]:             { tags: [vscode.DiagnosticTag.Deprecated], message: "This parameter is deprecated since version '{version}'. {description}" },
    [DiagnosticType.DEPRECATED_PARAMETER_REPLACEMENT_VERSION]: { tags: [vscode.DiagnosticTag.Deprecated], message: "This parameter is deprecated since version '{version}' and replaced by '{replacement}'. {description}" },

    [DiagnosticType.MISSING_DEPENDENT_PARAMETER]:     { tags: [vscode.DiagnosticTag.Unnecessary], message: "'{parameter}' parameter requires dependent parameter '{dependentParameter}' to be present." },
    [DiagnosticType.DEPENDENT_PARAMETER_WRONG_VALUE]: { message: "'{parameter}' requires dependent parameter '{dependentParameter}' to have a valid value. Current value is '{value}' but valid values are: {dependentValues}." },
    [DiagnosticType.INVALID_TYPE_FOR_VALUE]:          { message: "Type '{type}' of '{parameter}' is invalid for value '{value}'. Expected type is '{expectedType}'." },
    [DiagnosticType.INVALID_TYPE_FOR_VALUES_OBJECT]:  { message: "Values {invalidTypeValues} of '{parameter}' don't have a valid type. Expected types are '{keyType}' for keys and '{valueType}' for values, with '{keyValueSeparator}' as separator." },
    [DiagnosticType.INVALID_OBJECT_FORMAT]:           { message: "Values {values} for parameter '{parameter}' do not follow the expected 'key{keyValueSeparator}value' format." },

    [DiagnosticType.NO_BLOCK_REF]:              {                                          message: "No block reference found in value '{value}' for parameter '{parameter}'. Something might be wrong with the value." },
    [DiagnosticType.CANNOT_PROVIDE_MODULE]:     { tags: [vscode.DiagnosticTag.Deprecated], message: "Referencing a block cannot be done with the full type ('module.block') for '{parameter}'. Make sure the value only contains the ID of the block to reference. This usually means the game defaults to a 'Base' module." },
    [DiagnosticType.INVALID_BLOCK_REF]:         {                                          message: "The block reference '{value}' for parameter '{parameter}' does not match any existing block. Make sure the referenced block exists." },
    [DiagnosticType.INVALID_BLOCK_REF_NO_AUTO]: {                                          message: "The block reference '{value}' for parameter '{parameter}' does not match any existing block. Make sure the referenced block exists. You need to use the full type ('module.block') for this block reference." },
    [DiagnosticType.MULTIPLE_BLOCK_REFS]:       {                                          message: "Multiple block references found for '{value}' for parameter '{parameter}'. Make sure duplicate block references are not present." },

    // craftRecipe related diagnostics
    [DiagnosticType.INVALID_AMOUNT]:         { message: "'{amount}' is not a valid amount for '{type}'." },
    [DiagnosticType.INTEGER_AMOUNT]:         { message: "'{amount}' should be an integer for '{type}'." },
    [DiagnosticType.DUPLICATE_PROPERTY]:     { message: "'{property}' is provided multiple times." },
    [DiagnosticType.MISSING_ONEOF_PROPERTY]: { message: "'{type}' is missing at least one of the following properties: {properties}." },

    [DiagnosticType.NO_DOTS_ITEM]:    { message: "An item type (ID) cannot have dots '.' in its name. ({value})" },
    [DiagnosticType.MISSING_MODULE]:  { message: "The provided item type (ID) is missing its module part: 'module.type'. ({value})" },
    [DiagnosticType.ALL_WITH_OTHERS]: { message: "'*' was provided along with other item types. '*' must be used alone." },
    [DiagnosticType.SPACES_IN_ITEM]:  { message: "An item full type (module and ID) cannot contain spaces. ({value})" },
    [DiagnosticType.INVALID_VALUE]:   { message: "'{value}' is not a valid value for '{property}'. Valid values are: {validValues}." },

    // translations diagnostics
    [DiagnosticType.INVALID_TRANSLATION_KEY]: { message: "'{element}' with value '{value}' expects a translation key '{translationKey}' in source file '{sourceFile}', but was not found." },

    [DiagnosticType._DEBUG]: { message: "This is a debug diagnostic with value: {value}." },
}