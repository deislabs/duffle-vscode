'use strict';

import * as vscode from 'vscode';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';
import * as shell from './utils/shell';

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer(shell.shell);

    const subscriptions = [
        vscode.commands.registerCommand('extension.sayHello', () => { }),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer)
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}
