import * as vscode from "vscode";

export let outputChannel: vscode.OutputChannel;

export function log(message: string, level: "debug" | "info" | "warn" | "error" = "info") {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("ZedScripts");
    }
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    outputChannel.appendLine(formattedMessage);
}