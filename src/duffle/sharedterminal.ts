import * as vscode from 'vscode';

import * as config from '../config/config';
import * as shell from '../utils/shell';

let sharedTerminalObj: vscode.Terminal | null = null;

export function sharedTerminal(): vscode.Terminal {
    if (sharedTerminalObj) {
        return sharedTerminalObj;
    }

    const terminalOptions = {
        name: 'Duffle',
        env: shell.shellEnvironment(process.env)
    };
    sharedTerminalObj = vscode.window.createTerminal(terminalOptions);
    const disposable = vscode.window.onDidCloseTerminal((t) => {
        if (t === sharedTerminalObj) {
            sharedTerminalObj = null;
            disposable.dispose();
        }
    });
    vscode.workspace.onDidChangeConfiguration((change) => {
        if (config.affectsExtensionConfiguration(change) && sharedTerminalObj) {
            sharedTerminalObj.dispose();
        }
    });

    return sharedTerminalObj;
}
