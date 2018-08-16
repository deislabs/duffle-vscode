import * as vscode from 'vscode';

export interface Duffle {
    init(): Promise<any>;
    build(): Promise<any>;
    push(): Promise<any>;
    import(): Promise<any>;
    export(): Promise<any>;
    run(): Promise<any>;
}

export class DuffleImpl implements Duffle {
    async init(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle init');
    }

    async build(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle build');
    }

    async push(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle push');
    }

    async import(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle import');
    }

    async export(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle export');
    }

    async run(): Promise<any> {
        return await vscode.window.showInformationMessage('duffle run');
    }
}
