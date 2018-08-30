import * as _ from 'lodash';
import * as path from 'path';
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
        const paths = lr.result.map((p) => p.split(path.sep));
        const firsts = paths.map((p) => p[0]);
        const uniqueFirsts = _.uniq(firsts);
        return uniqueFirsts.map((p) => new RepoNode([p], paths));
    }
    return [new ErrorNode(lr.error[0])];
}

interface RepoExplorerNode {
    getChildren(shell: Shell): Promise<RepoExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class RepoNode implements RepoExplorerNode {
    constructor(private readonly path: string[], private readonly all: string[][]) { }

    async getChildren(shell: Shell): Promise<RepoExplorerNode[]> {
        const remainders = this.getSubPaths();
        const firsts = remainders.map((p) => p[0]);
        const uniqueFirsts = _.uniq(firsts);
        const prefixes = uniqueFirsts.map((a) => Array<string>().concat(this.path, [a]));

        if (prefixes.length > 0) {
            return prefixes.map((p) => new RepoNode(p, this.all));
        }

        const bundles = await duffle.search(shell);
        if (failed(bundles)) {
            return [new ErrorNode(bundles.error[0])];
        }
        return bundles.result
            .filter((rb) => rb.repository === this.path.join('/'))
            .map((rb) => new RepoBundleNode(rb));
    }

    getSubPaths(): string[][] {
        const matching = this.all.filter((p) => this.isSubPathOf(this.path, p));
        const remainders = matching.map((p) => _.slice(p, this.path.length))
            .filter((p) => p.length > 0);
        return remainders;
    }

    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem(this.path[this.path.length - 1], vscode.TreeItemCollapsibleState.Collapsed);
    }

    private isSubPathOf(p: string[], path: string[]): boolean {
        if (p.length > path.length) {
            return false;
        }
        if (p[0] !== path[0]) {
            return false;
        }
        if (p.length === 1 && path.length >= 1) {
            return true;
        }
        return this.isSubPathOf(_.slice(p, 1), _.slice(path, 1));
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