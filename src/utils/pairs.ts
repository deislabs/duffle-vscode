import { iter } from "./iterable";

export interface Pair {
    readonly key: string;
    readonly value: string;
}

export function fromStringMap(source: { [key: string]: string }): Pair[] {
    return iter(fromStringMapCore(source)).toArray();
}

function* fromStringMapCore(source: { [key: string]: string }): IterableIterator<Pair> {
    for (const k in source) {
        yield { key: k, value: source[k] };
    }
}
