import * as vscode from 'vscode';

interface Versioned {
    readonly version: string;
}

export interface BundleHierarchyNode {
    label: string;
    primary: Versioned;
    versions: {}[];
    desiredContext: string;
}

export function getTreeItem(node: BundleHierarchyNode): vscode.TreeItem {
    // TODO: could do with distinctive bundle-y icon here
    const treeItem = new vscode.TreeItem(node.label, collapsibleState(node));
    treeItem.tooltip = tooltip(node);
    treeItem.contextValue = contextValue(node);
    return treeItem;
}

function tooltip(node: BundleHierarchyNode): string {
    if (node.primary.version === 'latest') {
        const versionCount = node.versions.length <= 1 ? '' : ` (+ ${node.versions.length - 1} other version(s))`;
        return `${node.label}:${node.primary.version}${versionCount}`;
    } else if (node.versions.length === 1) {
        return `${node.label}:${node.primary.version}`;
    } else {
        return `${node.versions.length} versions`;
    }
}

function collapsibleState(node: BundleHierarchyNode): vscode.TreeItemCollapsibleState {
    return node.versions.length > 1 ?
        vscode.TreeItemCollapsibleState.Collapsed :
        vscode.TreeItemCollapsibleState.None;
}

function contextValue(node: BundleHierarchyNode): string | undefined {
    if (node.primary.version === 'latest' || node.versions.length === 1) {
        return node.desiredContext;
    }
    return undefined;
}
