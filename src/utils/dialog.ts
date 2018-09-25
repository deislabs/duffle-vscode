import * as vscode from 'vscode';

export const END_DIALOG_FN = "endDialog()";

export function dialog(tabTitle: string, htmlBody: string, formId: string): Promise<{ [key: string]: string }> {
    return new Promise<any>((resolve, reject) => {
        const postbackScript = `<script>
        function ${END_DIALOG_FN} {
            const vscode = acquireVsCodeApi();
            const s = {};
            for (const e of document.forms['${formId}'].elements) {
                s[e.name] = e.value;
            }
            vscode.postMessage(s);
        }
        </script>`;

        const html = postbackScript + htmlBody;
        const w = vscode.window.createWebviewPanel('duffle-dialog', tabTitle, vscode.ViewColumn.Active, {
            retainContextWhenHidden: false,
            enableScripts: true,
        });
        w.webview.html = html;
        const cancelSubscription = w.onDidDispose(() => resolve(undefined));
        w.webview.onDidReceiveMessage((m) => {
            cancelSubscription.dispose();
            w.dispose();
            resolve(m);
        });
        w.reveal();
    });
}
