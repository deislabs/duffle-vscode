import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { LocalBundle } from '../../duffle/duffle.objectmodel';

export class BundleExplorer implements vscode.TreeDataProvider<BundleExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<BundleExplorerNode | undefined> = new vscode.EventEmitter<BundleExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<BundleExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: BundleExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: any): vscode.ProviderResult<BundleExplorerNode[]> {
        if (!element) {
            return getBundleNodes(this.shell);
        }
        return [];
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function getBundleNodes(shell: Shell): Promise<BundleExplorerNode[]> {
    const bundles = await duffle.bundles(shell);
    if (succeeded(bundles)) {
        return bundles.result.map((b) => new LocalBundleNode(b));
    }
    return [new ErrorNode(bundles.error[0])];
}

interface BundleExplorerNode {
    getChildren(): Promise<BundleExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class LocalBundleNode implements BundleExplorerNode {
    constructor(private readonly bundle: LocalBundle) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundle.repository, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.bundle";
        return treeItem;
    }
}

class ErrorNode implements BundleExplorerNode {
    constructor(private readonly error: string) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.error;
        return treeItem;
    }
}
