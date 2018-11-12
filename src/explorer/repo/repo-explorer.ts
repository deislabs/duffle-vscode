import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded, failed } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { RepoBundle, RepoBundleRef } from '../../duffle/duffle.objectmodel';
import { nameOnly, prefix } from '../../utils/bundleselection';
import { iter, Group, Enumerable } from '../../utils/iterable';
import { readRepoIndex } from '../../duffle/repo';
import { getTreeItem, BundleHierarchyNode } from '../bundlehierarchy';

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

interface RepoBundleInHierarchy extends RepoBundle {
    readonly strippedName: string;
}

function* nodesFor(group: Group<string | undefined, RepoBundleInHierarchy>): IterableIterator<RepoExplorerNode> {
    if (group.key) {
        yield new RepoNamespaceNode(group.key, group.values);
    } else {
        const bundlesByName = iter(group.values).groupBy((b) => b.name).toArray();
        yield* bundlesByName.map((g) => new RepoBundleNode(g.values));
    }
}

function nodes(bundles: Enumerable<RepoBundleInHierarchy>): RepoExplorerNode[] {
    const grouped = bundles
        .groupBy((rb) => prefix(rb.strippedName))
        .collect((g) => nodesFor(g))
        .toArray();
    return grouped;
}

interface RepoExplorerNode {
    getChildren(shell: Shell): Promise<RepoExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class RepoNode implements RepoExplorerNode {
    constructor(private readonly path: string) { }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        const indexResult = await readRepoIndex(this.path);
        if (failed(indexResult)) {
            return [new ErrorNode(indexResult.error[0])];
        }

        const index = indexResult.result;
        if (!index || !index.entries) {
            return [];
        }

        const bundles = this.namedBundles(index.entries);
        return nodes(bundles);
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.path, vscode.TreeItemCollapsibleState.Collapsed);
    }

    private namedBundles(entries: { [key: string]: RepoBundle[] }): Enumerable<RepoBundleInHierarchy> {
        return iter(Object.keys(entries))
            .collect((k) => entries[k].map(
                (v) => ({ name: k, strippedName: k, repository: this.path, version: v.version }))
            );
    }
}

class RepoNamespaceNode implements RepoExplorerNode {
    constructor(
        private readonly namespace: string,
        private readonly bundles: RepoBundleInHierarchy[]) {
    }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        const unnamespaced = iter(this.bundles)
            .map((rb) => ({ name: rb.name, strippedName: this.unnamespace(rb.strippedName), repository: rb.repository, version: rb.version }));
        return nodes(unnamespaced);
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.namespace, vscode.TreeItemCollapsibleState.Collapsed);
    }

    unnamespace(name: string): string {
        const prefix = `${this.namespace}/`;
        if (name.startsWith(prefix)) {
            return name.substring(prefix.length);
        }
        return name;
    }
}

class RepoBundleNode implements RepoExplorerNode, BundleHierarchyNode, RepoBundleRef {
    readonly bundle: RepoBundleInHierarchy;

    constructor(readonly bundles: RepoBundleInHierarchy[]) {
        this.bundle = bundles.find((b) => b.version === 'latest') || bundles[0];
    }

    readonly bundleLocation = 'repo';

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return this.bundles.map((b) => new RepoBundleVersionNode(b));
    }

    getTreeItem(): vscode.TreeItem {
        return getTreeItem(this);
    }

    get label() { return nameOnly(this.bundle); }
    get primary() { return this.bundle; }
    get versions() { return this.bundles; }
    get desiredContext() { return 'duffle.repoBundle'; }
}

class RepoBundleVersionNode implements RepoExplorerNode, RepoBundleRef {
    constructor(readonly bundle: RepoBundleInHierarchy) { }

    readonly bundleLocation = 'repo';

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundle.version, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.repoBundle";
        treeItem.tooltip = `${this.bundle.strippedName}:${this.bundle.version}`;
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
