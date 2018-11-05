import * as vscode from 'vscode';

interface Versioned {
    readonly version: string;
}

export function tooltip(label: string, primary: Versioned, versions: {}[]): string {
    if (primary.version === 'latest') {
        const versionCount = versions.length <= 1 ? '' : ` (+ ${versions.length - 1} other version(s))`;
        return `${label}:${primary.version}${versionCount}`;
    } else if (versions.length === 1) {
        return `${label}:${primary.version}`;
    } else {
        return `${versions.length} versions`;
    }
}

export function collapsibleState(versions: {}[]): vscode.TreeItemCollapsibleState {
    return versions.length > 1 ?
        vscode.TreeItemCollapsibleState.Collapsed :
        vscode.TreeItemCollapsibleState.None;
}

export function contextValue(desired: string, primary: Versioned, versions: {}[]): string | undefined {
    if (primary.version === 'latest' || versions.length === 1) {
        return desired;
    }
    return undefined;
}
