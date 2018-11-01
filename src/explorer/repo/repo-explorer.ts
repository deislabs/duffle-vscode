import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded, failed } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { RepoBundle, RepoBundleRef } from '../../duffle/duffle.objectmodel';
import { namespace, nameOnly } from '../../utils/bundleselection';
import { iter, Group } from '../../utils/iterable';

export class RepoExplorer implements vscode.TreeDataProvider<RepoExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<RepoExplorerNode | undefined> = new vscode.EventEmitter<RepoExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<RepoExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    getTreeItem(element: RepoExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: RepoExplorerNode): vscode.ProviderResult<RepoExplorerNode[]> {
        if (!element) {
            return getRootNodes(this.shell);
        }
        return element.getChildren(this.shell);
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }
}

async function getRootNodes(shell: Shell): Promise<RepoExplorerNode[]> {
    const lr = await duffle.listRepos(shell);
    if (succeeded(lr)) {
        return lr.result.map((p) => new RepoNode(p));
    }
    return [new ErrorNode(lr.error[0])];
}

interface RepoExplorerNode {
    getChildren(shell: Shell): Promise<RepoExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class RepoNode implements RepoExplorerNode {
    constructor(private readonly path: string) { }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        const bundles = await duffle.search(shell);
        if (failed(bundles)) {
            return [new ErrorNode(bundles.error[0])];
        }
        const grouped = iter(bundles.result)
            .filter((rb) => rb.repository === this.path)
            .groupBy((rb) => namespace(rb))
            .collect((g) => this.nodes(g))
            .toArray();
        return grouped;
    }

    *nodes(group: Group<string | undefined, RepoBundle>): IterableIterator<RepoExplorerNode> {
        if (group.key) {
            yield new RepoNamespaceNode(group.key, group.values);
        } else {
            yield* group.values.map((rb) => new RepoBundleNode(rb));
        }
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.path, vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class RepoNamespaceNode implements RepoExplorerNode {
    constructor(
        private readonly namespace: string,
        private readonly bundles: RepoBundle[]) {
    }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return this.bundles.map((b) => new RepoBundleNode(b));
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.namespace, vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class RepoBundleNode implements RepoExplorerNode, RepoBundleRef {
    constructor(readonly bundle: RepoBundle) { }

    readonly bundleLocation = 'remote';

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(nameOnly(this.bundle), vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.repoBundle";
        treeItem.tooltip = `${this.bundle.name}:${this.bundle.version}`;
        return treeItem;
    }
}

class ErrorNode implements RepoExplorerNode {
    constructor(private readonly error: string) { }

    async getChildren(): Promise<RepoExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.error;
        return treeItem;
    }
}
