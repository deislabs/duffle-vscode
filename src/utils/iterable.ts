export function iter<T>(i: Iterable<T>): Enumerable<T> {
    return new EnumerableImpl(i);
}

interface Enumerable<T> {
    first(predicate: (t: T) => boolean): T | null;
}

class EnumerableImpl<T> implements Enumerable<T> {
    constructor(private readonly source: Iterable<T>) { }

    first(predicate: (t: T) => boolean): T | null {
        for (const item of this.source) {
            if (predicate(item)) {
                return item;
            }
        }
        return null;
    }
}
