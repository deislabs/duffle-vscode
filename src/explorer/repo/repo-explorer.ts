import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded, failed } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { RepoBundle, RepoBundleRef } from '../../duffle/duffle.objectmodel';
import { namespace, nameOnly } from '../../utils/bundleselection';
import { iter, Group, Enumerable } from '../../utils/iterable';
import { readRepoIndex } from '../../duffle/repo';
import { tooltip, collapsibleState, contextValue } from '../bundlehierarchy';

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

function* nodesFor(group: Group<string | undefined, RepoBundle>): IterableIterator<RepoExplorerNode> {
    if (group.key) {
        yield new RepoNamespaceNode(group.key, group.values);
    } else {
        const groupywoupy = iter(group.values).groupBy((b) => b.name).toArray();
        yield* groupywoupy.map((g) => new RepoBundleNode(g.values));
    }
}

function nodes(bundles: Enumerable<RepoBundle>): RepoExplorerNode[] {
    const grouped = bundles
        .groupBy((rb) => namespace(rb))
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

    private namedBundles(entries: { [key: string]: RepoBundle[] }): Enumerable<RepoBundle> {
        return iter(Object.keys(entries))
            .collect((k) => entries[k].map(
                (v) => ({ name: k, repository: this.path, version: v.version }))
            );
    }
}

class RepoNamespaceNode implements RepoExplorerNode {
    constructor(
        private readonly namespace: string,
        private readonly bundles: RepoBundle[]) {
    }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        const unnamespaced = iter(this.bundles)
            .map((rb) => ({ name: this.unnamespace(rb.name), repository: rb.repository, version: rb.version }));
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

class RepoBundleNode implements RepoExplorerNode, RepoBundleRef {
    readonly bundle: RepoBundle;

    constructor(readonly bundles: RepoBundle[]) {
        this.bundle = bundles.find((b) => b.version === 'latest') || bundles[0];
    }

    readonly bundleLocation = 'repo';

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return this.bundles.map((b) => new RepoBundleVersionNode(b));
    }

    getTreeItem(): vscode.TreeItem {
        // TODO: could do with distinctive bundle-y icon here
        const treeItem = new vscode.TreeItem(this.label(), this.collapsibleState());
        treeItem.tooltip = this.tooltip();
        treeItem.contextValue = this.contextValue();
        return treeItem;
    }

    private label(): string {
        return nameOnly(this.bundle);
    }

    private tooltip(): string {
        return tooltip(this.label(), this.bundle, this.bundles);
    }

    private collapsibleState(): vscode.TreeItemCollapsibleState {
        return collapsibleState(this.bundles);
    }

    private contextValue(): string | undefined {
        return contextValue('duffle.repoBundle', this.bundle, this.bundles);
    }
}

class RepoBundleVersionNode implements RepoExplorerNode, RepoBundleRef {
    constructor(readonly bundle: RepoBundle) { }

    readonly bundleLocation = 'repo';

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundle.version, vscode.TreeItemCollapsibleState.None);
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
