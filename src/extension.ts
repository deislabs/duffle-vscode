'use strict';

import * as vscode from 'vscode';
import { Duffle, DuffleImpl } from './duffle';


var duffle: Duffle = new DuffleImpl();

export function activate(context: vscode.ExtensionContext) {

    const subscriptions = [
        vscode.commands.registerCommand('extension.duffleInit', () => duffle.init()),
        vscode.commands.registerCommand('extension.duffleBuild', () => duffle.build()),
        vscode.commands.registerCommand('extension.dufflePush', () => duffle.push()),
        vscode.commands.registerCommand('extension.duffleImport', () => duffle.import()),
        vscode.commands.registerCommand('extension.duffleExport', () => duffle.export()),
        vscode.commands.registerCommand('extension.duffleRun', () => duffle.run()),
    ];

    subscriptions.forEach((element) => context.subscriptions.push(element));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
