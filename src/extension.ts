'use strict';

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const subscriptions = [
        vscode.commands.registerCommand('extension.sayHello', () => { })
    ];

    context.subscriptions.push(...subscriptions);
}

export function deactivate() {
}
