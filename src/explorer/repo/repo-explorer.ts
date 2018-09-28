import * as _ from 'lodash';
import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded, failed } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { RepoBundle, RepoBundleRef } from '../../duffle/duffle.objectmodel';

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
        return bundles.result
            .filter((rb) => rb.repository === this.path)
            .map((rb) => new RepoBundleNode(rb));
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.path, vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class RepoBundleNode implements RepoExplorerNode, RepoBundleRef {
    constructor(readonly bundle: RepoBundle) { }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundle.name, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.repoBundle";
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
