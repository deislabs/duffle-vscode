import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { LocalBundle, LocalBundleRef } from '../../duffle/duffle.objectmodel';
import { iter, Group, Enumerable } from '../../utils/iterable';
import { tooltip, collapsibleState, contextValue } from '../bundlehierarchy';

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
        const repos = iter(bundles.result).groupBy((b) => b.name);
        return stratifyByPrefix(repos);
    }
    return [new ErrorNode(bundles.error[0])];
}

// TODO: pretty sure a lot of this should be unified with repo-explorer.ts

function stratifyByPrefix(groups: Enumerable<Group<string, LocalBundle>>): BundleExplorerNode[] {
    const topLevel = groups.groupBy((r) => prefix(r.key));
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

class LocalRepoNode implements BundleExplorerNode, LocalBundleRef {
    constructor(private readonly repo: Group<string, LocalBundle>) {
        this.bundle = repo.values.find((b) => b.version === 'latest') || repo.values[0];
    }

    readonly bundleLocation = 'local';

    readonly bundle: LocalBundle;

    async getChildren(): Promise<BundleExplorerNode[]> {
        return this.repo.values.map((v) => new LocalRepoVersionNode(v));
    }

    getTreeItem(): vscode.TreeItem {
        // TODO: could do with distinctive bundle-y icon here
        const treeItem = new vscode.TreeItem(this.label(), this.collapsibleState());
        treeItem.tooltip = this.tooltip();
        treeItem.contextValue = this.contextValue();
        return treeItem;
    }

    private label(): string {
        return this.repo.key;
    }

    private tooltip(): string {
        return tooltip(this.label(), this.bundle, this.repo.values);
    }

    private collapsibleState(): vscode.TreeItemCollapsibleState {
        return collapsibleState(this.repo.values);
    }

    private contextValue(): string | undefined {
        return contextValue('duffle.localBundle', this.bundle, this.repo.values);
    }
}

class LocalRepoVersionNode implements BundleExplorerNode, LocalBundleRef {
    constructor(readonly bundle: LocalBundle) { }

    readonly bundleLocation = 'local';

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundle.version, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.localBundle";
        return treeItem;
    }
}

class RepoContainerNode implements BundleExplorerNode {
    constructor(private readonly container: Group<string | undefined /* it is never actually undefined */, Group<string, LocalBundle>>) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        const stripped = this.container.values.map((g) => ({ key: g.key!.substring(this.container.key!.length + 1), values: g.values }));
        return stratifyByPrefix(iter(stripped));
    }

    getTreeItem(): vscode.TreeItem {
        // TODO: could do with distinctive folder-y icon here
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
