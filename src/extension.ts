'use strict';

import * as vscode from 'vscode';

import { BundleRef } from './duffle/duffle.objectmodel';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer(shell.shell);
    const repoExplorer = new RepoExplorer(shell.shell);

    const subscriptions = [
        vscode.commands.registerCommand('duffle.refreshBundleExplorer', () => bundleExplorer.refresh()),
        vscode.commands.registerCommand('duffle.bundleStatus', (node) => bundleStatus(node)),
        vscode.commands.registerCommand('duffle.refreshRepoExplorer', () => repoExplorer.refresh()),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer),
        vscode.window.registerTreeDataProvider("duffle.repoExplorer", repoExplorer)
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}

function bundleStatus(bundle: BundleRef) {
    duffle.showStatus(bundle.bundleName);
}
