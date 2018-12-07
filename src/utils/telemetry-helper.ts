import { reporter } from './telemetry';
import { Errorable } from './errorable';

export function telemetrise(command: string, callback: (...args: any[]) => any): (...args: any[]) => any {
    return async (a) => {
        if (reporter) {
            reporter.sendTelemetryEvent("command", { command: command });
        }
        return callback(a);
    };
}

export function reportEvent(eventName: string, properties: { [key: string]: string } | undefined): void {
    if (reporter) {
        reporter.sendTelemetryEvent(eventName, properties);
    }
}

export function reportErrorableResult<T>(eventName: string, result: Errorable<T>): void {
    const properties = {
        result: result.succeeded ? "succeeded" : "failed"
    };
    reportEvent(eventName, properties);
}
