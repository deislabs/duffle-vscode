import * as vscode from 'vscode';

export interface Duffle {
    init(): Promise<void>;
    build(): Promise<void>;
    push(): Promise<void>;
    import(): Promise<void>;
    export(): Promise<void>;
    run(): Promise<void>;
}

export class DuffleImpl implements Duffle {
    init(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle init'));
    }

    build(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle build'));
    }

    push(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle push'));
    }

    import(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle import'));
    }

    export(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle export'));
    }

    run(): Promise<void> {
        return new Promise<void>(() => vscode.window.showInformationMessage('duffle run'));
    }
}
