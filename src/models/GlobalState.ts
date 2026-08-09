/**
 * Defines the keys used in the global state (vscode.Memento | vscode.ExtensionContext.globalState) for caching data.
 */
export enum GlobalState {
    SCRIPTS_BLOCKS_DATA = 'scriptBlocks',
    ROOTS_DATA = 'rootFiles',
    LAST_FETCH = 'lastFetch',
}