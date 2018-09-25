import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { CredentialSetRef } from '../../duffle/duffle.objectmodel';

export class CredentialExplorer implements vscode.TreeDataProvider<CredentialExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<CredentialExplorerNode | undefined> = new vscode.EventEmitter<CredentialExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<CredentialExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: CredentialExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: any): vscode.ProviderResult<CredentialExplorerNode[]> {
        if (!element) {
            return getCredentialSetNodes(this.shell);
        }
        return [];
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function getCredentialSetNodes(shell: Shell): Promise<CredentialExplorerNode[]> {
    const lr = await duffle.listCredentialSets(shell);
    if (succeeded(lr)) {
        return lr.result.map((n) => new CredentialSetNode(n));
    }
    return [new ErrorNode(lr.error[0])];
}

interface CredentialExplorerNode {
    getChildren(): Promise<CredentialExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class CredentialSetNode implements CredentialExplorerNode, CredentialSetRef {
    constructor(readonly credentialSetName: string) { }

    async getChildren(): Promise<CredentialExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.credentialSetName, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.credentialset";
        return treeItem;
    }
}

class ErrorNode implements CredentialExplorerNode {
    constructor(private readonly error: string) { }

    async getChildren(): Promise<CredentialExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.error;
        return treeItem;
    }
}