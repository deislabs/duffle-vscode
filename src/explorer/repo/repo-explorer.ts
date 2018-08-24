import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';

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
        return element.getChildren();
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
    getChildren(): Promise<RepoExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class RepoNode implements RepoExplorerNode {
    constructor(private readonly path: string[], private readonly all: string[][]) { }

    async getChildren(): Promise<RepoExplorerNode[]> {
        const remainders = this.getSubPaths();
        const firsts = remainders.map((p) => p[0]);
        const uniqueFirsts = _.uniq(firsts);
        const prefixes = uniqueFirsts.map((a) => Array<string>().concat(this.path, [a]));
        return prefixes.map((p) => new RepoNode(p, this.all));
    }

    getSubPaths(): string[][] {
        const matching = this.all.filter((p) => this.isSubPathOf(this.path, p));
        const remainders = matching.map((p) => _.slice(p, this.path.length))
            .filter((p) => p.length > 0);
        return remainders;
    }

    getTreeItem(): vscode.TreeItem {
        const hasChildren = this.getSubPaths().length > 0;
        return new vscode.TreeItem(this.path[this.path.length - 1], hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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