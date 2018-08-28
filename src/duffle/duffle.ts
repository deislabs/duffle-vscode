import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

import * as config from '../config/config';
import { Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';

let sharedTerminalObj: vscode.Terminal | null = null;

function sharedTerminal(): vscode.Terminal {
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

async function invokeObj<T>(sh: shell.Shell, command: string, args: string, opts: shell.ExecOpts, fn: (stdout: string) => T): Promise<Errorable<T>> {
    const bin = config.dufflePath() || 'duffle';
    return await sh.execObj<T>(
        `${bin} ${command} ${args}`,
        `duffle ${command}`,
        opts,
        fn
    );
}

function invokeInTerminal(command: string): void {
    const fullCommand = `duffle ${command}`;
    sharedTerminal().sendText(fullCommand);
    sharedTerminal().show();
}

export function list(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'list', '', {}, parse);
}

export function listRepos(sh: shell.Shell): Promise<Errorable<string[]>> {
    function parse(stdout: string): string[] {
        return stdout.split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    return invokeObj(sh, 'repo list', '', {}, parse);
}

export function showStatus(bundleName: string): void {
    invokeInTerminal(`status ${bundleName}`);
}

export async function build(sh: shell.Shell, folderPath: string): Promise<Errorable<null>> {
    const buildFile = path.join(folderPath, 'duffle.toml');
    if (!fs.existsSync(buildFile)) {
        return { succeeded: false, error: [`${folderPath} does not contain a duffle.toml file`] };
    }
    // duffle build works *only* from the folder containing duffle.toml
    return await invokeObj(sh, 'build', '.', { cwd: folderPath }, (s) => null);
}
