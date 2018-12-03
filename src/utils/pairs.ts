import { iter } from "./iterable";

export interface Pair<T> {
    readonly key: string;
    readonly value: T;
}

export function fromStringMap(source: { [key: string]: string }): Pair<string>[] {
    return fromMap(source);
}

export function fromMap<T>(source: { [key: string]: T }): Pair<T>[] {
    return iter(fromMapCore(source)).toArray();
}

function* fromMapCore<T>(source: { [key: string]: T }): IterableIterator<Pair<T>> {
    for (const k in source) {
        yield { key: k, value: source[k] };
    }
}
