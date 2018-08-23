'use strict';

import * as vscode from 'vscode';
import { BundleExplorer } from './explorer/bundle/bundle-explorer';

export function activate(context: vscode.ExtensionContext) {
    const bundleExplorer = new BundleExplorer();

    const subscriptions = [
        vscode.commands.registerCommand('extension.sayHello', () => { }),
        vscode.window.registerTreeDataProvider("duffle.bundleExplorer", bundleExplorer)
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}
