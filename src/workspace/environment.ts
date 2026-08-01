import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DefaultText } from '../models/DefaultText';
import { fetchData } from '../providers/fetchData';
import { DiagnosticProvider } from '../providers/diagnostic';
import { PZWorkspace, WorkspaceType } from './workspace';
import { formatText } from '../utils/format';
import { DocumentBlock } from '../scriptsBlocks/blockTypes/document';



interface StatusBarConfig {
    readonly icon: string;
    readonly color?: vscode.ThemeColor;
    readonly backgroundColor?: vscode.ThemeColor;
}

enum State {
    LAUNCHING = "launching",
    LOADING_DATA = "loading_data",
    PRE_LOADING_LIBRARIES = "pre_loading_libraries",
    PRE_LOADING_WORKSPACE = "pre_loading_workspace",
    LOADING_LIBRARIES = "loading_libraries",
    LOADING_WORKSPACE = "loading_workspace",
    VALIDATING = "validating",
    RUNNING = "ready",
    // ERROR = "error",
    STOPPED = "stopped"
}

export class ZedScriptsEnvironment {
    context: vscode.ExtensionContext;
    diagnosticProvider: DiagnosticProvider;

    // status bar
    statusBar: vscode.StatusBarItem;
    state: State = State.LOADING_LIBRARIES;
    activeWorkspace: PZWorkspace | null = null;

    constructor(context: vscode.ExtensionContext, diagnosticProvider: DiagnosticProvider) {
        this.context = context;
        this.diagnosticProvider = diagnosticProvider;
        this.statusBar = this.initializeStatusBar();
    }


// LOAD PROJECT

    public async load(): Promise<void> {
        await this.loadData(true);

        // we preload the workspace first to remove files in the libraries that are already
        // handled in the workspace (example, opening one of the libraries as a workspace folder)
        console.debug("Pre-loading libraries and workspace...");
        await this.preLoadWorkspace(true);
        await this.preLoadLibraries(true);

        // order doesn't matter here, we already cached all the files we want to process
        console.debug("Loading libraries and workspace...");
        await this.loadLibraries(true);
        await this.loadWorkspace(true);

        this.validateWorkspace();
    }

    /**
     * Load the scripts data.
     */
    public async loadData(skip_final_state: boolean = false): Promise<boolean> {
        console.debug("Loading dataset...");
        this.setState(State.LOADING_DATA);
        const result = await fetchData(this.context);
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
        return result;
    }

    /**
     * Load the libraries from the configured directories.
     */
    public async preLoadLibraries(skip_final_state: boolean = false): Promise<void> {
        this.setState(State.PRE_LOADING_LIBRARIES);

        // preload libraries files
        const config = vscode.workspace.getConfiguration("ZedScripts");
        const libraryDirs: string[] = config.get("searchDirectories", []);
        for (const folder of libraryDirs) {
            const uri = vscode.Uri.file(folder);
            if (!isValidDir(folder)) {
                vscode.window.showWarningMessage(formatText(DefaultText.LIBRARY_LOAD_FAILED, { folder }));
                continue;
            }
            const workspace = new PZWorkspace(uri, WorkspaceType.LIBRARY);
            this.activeWorkspace = workspace;
            await workspace.preload();
            this.activeWorkspace = null;
        }
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
    }

    public async preLoadWorkspace(skip_final_state: boolean = false): Promise<void> {
        this.setState(State.PRE_LOADING_WORKSPACE);
        // list the folders of the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders || [];

        // preload workspace files
        for (const folder of workspaceFolders) {
            if (!isValidDir(folder.uri.fsPath)) {
                vscode.window.showWarningMessage(formatText(DefaultText.WORKSPACE_LOAD_FAILED, { folder: folder.uri.fsPath }));
                continue;
            }
            const workspace = new PZWorkspace(folder.uri, WorkspaceType.WORKSPACE, this.diagnosticProvider);
            this.activeWorkspace = workspace;
            await workspace.preload();
            this.activeWorkspace = null;
        }
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
    }

    /**
     * Load the libraries from the configured directories.
     */
    public async loadLibraries(skip_final_state: boolean = false): Promise<void> {
        this.setState(State.LOADING_LIBRARIES);

        // load libraries files
        const workspaces = PZWorkspace.workspaceCache.get(WorkspaceType.LIBRARY) || new Map();
        for (const workspace of workspaces.values()) {
            this.activeWorkspace = workspace;
            await workspace.load();
            this.activeWorkspace = null;
        }
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
    }

    public async loadWorkspace(skip_final_state: boolean = false): Promise<void> {
        this.setState(State.LOADING_WORKSPACE);

        // load workspace files
        const workspaces = PZWorkspace.workspaceCache.get(WorkspaceType.WORKSPACE) || new Map();
        for (const workspace of workspaces.values()) {
            this.activeWorkspace = workspace;
            await workspace.load();
            this.activeWorkspace = null;
        }
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
    }

    public validateWorkspace(skip_final_state: boolean = false): void {
        this.setState(State.VALIDATING);
        PZWorkspace.validateAll();
        if (!skip_final_state) {
            this.setState(State.RUNNING);
        }
    }

    public clearCacheForUri(uri: vscode.Uri): void {
        PZWorkspace.clearCacheForUri(uri);
    }




// STATUS BAR MANAGEMENT

    public initializeStatusBar(): vscode.StatusBarItem {
        const statusBar = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 0
        );
        statusBar.command = "ZedScripts.showInfo";
        return statusBar;
    }

    public setState(newState: State): void {
        this.state = newState;
        this.updateStatusBar();
    }

    public updateStatusBar(): void {
        // set current config
        const config = this.getStatusBarConfig();
        this.statusBar.text = config.icon;
        this.statusBar.color = config.color;
        this.statusBar.backgroundColor = config.backgroundColor;
        // update tooltip
        this.statusBar.tooltip = this.createTooltip();

        this.statusBar.show();
    }

    private getFileCounter(): string {
        if (this.activeWorkspace && this.activeWorkspace.isLoading) {
            return `${this.activeWorkspace.i}/${this.activeWorkspace.total}`;
        }
        return "";
    }

    private getStatusBarConfig(): StatusBarConfig {
        const fileCounter = this.getFileCounter();
        const configs: Record<State, StatusBarConfig> = {
            [State.LAUNCHING]: { 
                icon: "$(rocket) ZedScripts", 
                // color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.LOADING_DATA]: { 
                icon: "$(sync~spin) ZedScripts: data...", 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.PRE_LOADING_LIBRARIES]: { 
                icon: ("$(sync~spin) ZedScripts: pre-libraries... " + fileCounter).trim(), 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.PRE_LOADING_WORKSPACE]: { 
                icon: ("$(sync~spin) ZedScripts: pre-workspace... " + fileCounter).trim(), 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.LOADING_LIBRARIES]: { 
                icon: ("$(sync~spin) ZedScripts: libraries... " + fileCounter).trim(), 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.LOADING_WORKSPACE]: { 
                icon: ("$(sync~spin) ZedScripts: workspace... " + fileCounter).trim(), 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.VALIDATING]: { 
                icon: ("$(sync~spin) ZedScripts: validating... " + fileCounter).trim(), 
                color: new vscode.ThemeColor("statusBarItem.warningBackground"),
            },
            [State.RUNNING]: { 
                icon: "$(check) ZedScripts", 
                color: new vscode.ThemeColor("statusBarItem.foreground"),
            },
            // [State.ERROR]: { icon: "$(error) ZedScripts", color: new vscode.ThemeColor("statusBarItem.errorBackground") },
            [State.STOPPED]: { 
                icon: "$(debug-stop) ZedScripts", 
                color: new vscode.ThemeColor("statusBarItem.errorBackground"),
            }
        };
        return configs[this.state];
    }

    private createTooltip(): vscode.MarkdownString {
        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;

        tooltip.appendMarkdown(DefaultText.STATUS_BAR_TOOLTIP_TITLE);
        tooltip.appendMarkdown('\n\n')

        if (this.activeWorkspace) {
            tooltip.appendMarkdown(formatText(
                DefaultText.STATUS_BAR_TOOLTIP_PROCESSING, {
                    workspaceType: this.activeWorkspace.workspaceType
                }));
            if (this.activeWorkspace.isLoading) {
                tooltip.appendMarkdown('\n\n');
                tooltip.appendMarkdown(`${this.getFileCounter()}`);
            }
        } else {
            tooltip.appendMarkdown(DefaultText.STATUS_BAR_TOOLTIP_LOADED);
        }

        return tooltip;
    }
}



function isValidDir(dir: string): boolean {
    const normalizedDir = path.normalize(dir);
    try {
        if (!fs.existsSync(normalizedDir)) {
            console.warn(`Directory does not exist: ${normalizedDir}`);
            return false;
        }
        if (!fs.statSync(normalizedDir).isDirectory()) {
            console.warn(`Path is not a directory: ${normalizedDir}`);
            return false;
        }
        return true;
    } catch (error) {
        console.warn(`Error accessing directory: ${normalizedDir}`, error);
        return false;
    }
}
