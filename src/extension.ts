'use strict';

import * as vscode from 'vscode';

import { BundleRef } from './duffle/duffle.objectmodel';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import { RepoExplorer } from './explorer/repo/repo-explorer';
import * as shell from './utils/shell';
import * as duffle from './duffle/duffle';
import { DuffleTOMLCompletionProvider } from './completion/duffle.toml.completions';
import { selectWorkspaceFolder } from './utils/host';
import { failed } from './utils/errorable';

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer(shell.shell);
    const repoExplorer = new RepoExplorer(shell.shell);
    const duffleTOMLCompletionProvider = new DuffleTOMLCompletionProvider();

    const subscriptions = [
        vscode.commands.registerCommand('duffle.refreshBundleExplorer', () => bundleExplorer.refresh()),
        vscode.commands.registerCommand('duffle.bundleStatus', (node) => bundleStatus(node)),
        vscode.commands.registerCommand('duffle.build', build),
        vscode.commands.registerCommand('duffle.refreshRepoExplorer', () => repoExplorer.refresh()),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer),
        vscode.window.registerTreeDataProvider("duffle.repoExplorer", repoExplorer),
        vscode.languages.registerCompletionItemProvider({ language: 'toml', pattern: '**/duffle.toml', scheme: 'file' }, duffleTOMLCompletionProvider, '[', ',')
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}

async function build(): Promise<void> {
    const folder = await selectWorkspaceFolder("Choose folder to build");
    if (!folder) {
        return;
    }

    if (folder.uri.scheme !== 'file') {
        vscode.window.showErrorMessage("This command requires a filesystem folder");
    }

    const folderPath = folder.uri.fsPath;
    const buildResult = await duffle.build(shell.shell, folderPath);

    if (failed(buildResult)) {
        await vscode.window.showErrorMessage(`Duffle build failed: ${buildResult.error[0]}`);
    } else {
        await vscode.window.showInformationMessage(`Duffle build complete for ${folderPath}`);
    }
}

function bundleStatus(bundle: BundleRef) {
    duffle.showStatus(bundle.bundleName);
}
