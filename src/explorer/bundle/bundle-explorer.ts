import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { LocalBundle } from '../../duffle/duffle.objectmodel';
import { iter, Group } from '../../utils/iterable';

export class BundleExplorer implements vscode.TreeDataProvider<BundleExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<BundleExplorerNode | undefined> = new vscode.EventEmitter<BundleExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<BundleExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: BundleExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: BundleExplorerNode): vscode.ProviderResult<BundleExplorerNode[]> {
        if (!element) {
            return getRootNodes(this.shell);
        }
        return element.getChildren();
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function getRootNodes(shell: Shell): Promise<BundleExplorerNode[]> {
    const bundles = await duffle.bundles(shell);
    if (succeeded(bundles)) {
        const repos = iter(bundles.result).groupBy((b) => b.repository);
        const topLevel = repos.groupBy((r) => prefix(r.key));
        const unprefixed: BundleExplorerNode[] = topLevel
            .filter((g) => !g.key)
            .collect((g) => g.values)
            .map((b) => new LocalRepoNode(b))
            .toArray();
        const prefixed: BundleExplorerNode[] = topLevel
            .filter((g) => !!g.key)
            .map((b) => new RepoContainerNode(b))
            .toArray();
        return prefixed.concat(unprefixed);
    }
    return [new ErrorNode(bundles.error[0])];
}

function prefix(name: string): string | undefined {
    const sepIndex = name.indexOf('/');
    if (sepIndex < 0) {
        return undefined;
    }
    return name.substring(0, sepIndex);

}

interface BundleExplorerNode {
    getChildren(): Promise<BundleExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class LocalRepoNode implements BundleExplorerNode {
    constructor(private readonly repo: Group<string, LocalBundle>) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.repo.key, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.localRepo";
        return treeItem;
    }
}

class RepoContainerNode implements BundleExplorerNode {
    constructor(private readonly container: Group<string | undefined /* it is never actually undefined */, Group<string, LocalBundle>>) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return this.container.values.map((o) => new LocalRepoNode(o));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.container.key!, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = "duffle.localRepoContainer";
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
