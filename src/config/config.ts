import * as vscode from 'vscode';

const EXTENSION_CONFIG_KEY = "vscode-duffle";

export function affectsExtensionConfiguration(change: vscode.ConfigurationChangeEvent) {
    return change.affectsConfiguration(EXTENSION_CONFIG_KEY);
}

export function dufflePath(): string | undefined {
    return toolPath('duffle');
}

export function toolPath(tool: string): string | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[`${tool}-path`];
}

export function repositories(): string[] {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)["repositories"] || [];
}
