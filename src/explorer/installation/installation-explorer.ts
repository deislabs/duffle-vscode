import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { InstallationRef } from '../../duffle/duffle.objectmodel';

export class InstallationExplorer implements vscode.TreeDataProvider<InstallationExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<InstallationExplorerNode | undefined> = new vscode.EventEmitter<InstallationExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<InstallationExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: InstallationExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: any): vscode.ProviderResult<InstallationExplorerNode[]> {
        if (!element) {
            return getBundleNodes(this.shell);
        }
        return [];
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function getBundleNodes(shell: Shell): Promise<InstallationExplorerNode[]> {
    const lr = await duffle.list(shell);
    if (succeeded(lr)) {
        return lr.result.map((n) => new InstallationNode(n));
    }
    return [new ErrorNode(lr.error[0])];
}

interface InstallationExplorerNode {
    getChildren(): Promise<InstallationExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class InstallationNode implements InstallationExplorerNode, InstallationRef {
    constructor(readonly bundleName: string) { }

    async getChildren(): Promise<InstallationExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundleName, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.bundle";
        return treeItem;
    }
}

class ErrorNode implements InstallationExplorerNode {
    constructor(private readonly error: string) { }

    async getChildren(): Promise<InstallationExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.error;
        return treeItem;
    }
}
