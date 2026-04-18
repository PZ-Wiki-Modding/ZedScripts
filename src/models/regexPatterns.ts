// Modification pour capturer item avec ses éventuels sous-blocs component et Fluids
export const itemBlockRegex = /\s*item\s+(\w+)\s*\{((?:[^{}]*|\{(?:[^{}]*|\{(?:[^{}]*|\{[^{}]*\})*\})*\})*)\}/g;


// Script file identifier
export const SCRIPT_FILE_REGEX = /\/media\/scripts\/[\/\w\s]*\.txt/;


/**
 * Matches script block headers.
 * 
 * @example
 * ```ts
 * module Example {
 * ```
 * @example
 * ```ts
 * module Example
 * {
 * ```
 * @example
 * ```ts
 * module
 * {
 * ```
 */
export const scriptBlockRegex = /^\s*(?<type>\w+)[^\r\n]?(?<id>[^\r\n]*?)\s*{/gm;


// NOTE(aoqia): I am not sure if the game ignores whitespace at the end of values.
//   For example: "Icon = EngineParts ," the value could either be "EngineParts" OR "EngineParts "
//   If its the last one, just remove the last \s* (before the comma) in the pattern below
/**
 * Matches script block parameters.
 *
 * @example
 * ```ts
 * Tags = Epic;New,
 * ```
 */
export const parameterRegex = /(?<name>\S+[\/ \S]*?)\s*=[^\S\r\n]*(?<value>[^\r\n,]*)\s*?(?<comma>,*)/g;


/**
 * Regex used to identify inputs/outputs parameters.
 */
// export const inputsOutputsRegex = /(?<name>item|[+-]*fluid)\s*(?<amount>\d+(?:\.\d*)?|\.\d)\s+(?<values>[^\r\n,]*)(?<comma>,*)/g;

export const inputsOutputsRegex = {
    // main identifier for inputs/outputs entries
    main: /(?<name>item|[+-]*fluid)\s*(?<amount>\d+(?:\.\d*)?|\.\d)\s+(?<values>[^\r\n,]*)(?<comma>,*)/g,

    // item properties
    itemList: /(?:^|\s)\[(?<value>.+?)\]/g,
    mode: /mode:(?<value>\w*)/g,
    tags: /tags\[(?<value>.+?)\]/g,
    flags: /flags\[(?<value>.+?)\]/g,
    mappers: /mappers\[(?<value>.+?)\]/g,
    overlayMapper: /overlayMapper/g,

    // fluid properties
    categories: /categories\[(?<value>.+?)\]/g,

    // output properties
    singleValue: /(?:^|\s)(?<value>.+?)(?:$|\s)/g,
}