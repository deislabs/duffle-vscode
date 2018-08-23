import * as vscode from 'vscode';

export class BundleExplorer implements vscode.TreeDataProvider<any> {
    // onDidChangeTreeData?: vscode.Event<any> | undefined;

    getTreeItem(element: any): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
    }

    getChildren(element?: any): vscode.ProviderResult<any[]> {
        return ["test"];
    }


}