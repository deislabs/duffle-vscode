'use strict';

import * as vscode from 'vscode';
import { Duffle, DuffleImpl } from './duffle';


const duffle: Duffle = new DuffleImpl();

export function activate(context: vscode.ExtensionContext) {

    const subscriptions = [
        vscode.commands.registerCommand('extension.duffleInit', async () => await duffle.init()),
        vscode.commands.registerCommand('extension.duffleBuild', async () => await duffle.build()),
        vscode.commands.registerCommand('extension.dufflePush', async () => await duffle.push()),
        vscode.commands.registerCommand('extension.duffleImport', async () => await duffle.import()),
        vscode.commands.registerCommand('extension.duffleExport', async () => await duffle.export()),
        vscode.commands.registerCommand('extension.duffleRun', async () => await duffle.run()),
    ];

    subscriptions.forEach((element) => context.subscriptions.push(element));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
