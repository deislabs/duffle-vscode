import * as vscode from 'vscode';

const EXTENSION_CONFIG_KEY = "vscode-duffle";

export function dufflePath(): string | undefined {
    return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)['duffle-path'];
}